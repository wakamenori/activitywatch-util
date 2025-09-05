import { generateObject, generateText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { persistXML } from "@/lib/analyze-activity/files";
import {
	buildFileSnapshotsFromCommits,
	buildGitCommitEvents,
	collectGitCommitsInRange,
} from "@/lib/analyze-activity/git";
import { type Provider, selectModel } from "@/lib/analyze-activity/llm";
import {
	buildCalendarObjectPrompt,
	buildHumanSummary,
	buildPrompt,
} from "@/lib/analyze-activity/prompt";
import { computeStats } from "@/lib/analyze-activity/stats";
import {
	buildStatsSummaryXML,
	formatActivityDataAsXML,
	formatFileSnapshotsAsXML,
} from "@/lib/analyze-activity/xml";
import { activityWatchDB } from "@/lib/database";
import { createCalendarEventIfConfigured } from "@/lib/google/calendar";

export const maxDuration = 30;
export const runtime = "nodejs";

function parseDate(input: string | null): Date | null {
	if (!input) return null;
	const trimmed = input.trim();
	// Epoch seconds or ms
	if (/^\d+$/.test(trimmed)) {
		const n = Number.parseInt(trimmed, 10);
		const ms = trimmed.length <= 10 ? n * 1000 : n;
		const d = new Date(ms);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	// Allow space-separated ISO-like strings
	const normalized = trimmed.replace(" ", "T");
	const d = new Date(normalized);
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatRangeLabel(start: Date, end: Date): string {
	const ms = end.getTime() - start.getTime();
	const totalMinutes = Math.max(0, Math.round(ms / 60000));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0) return `${hours}時間${minutes > 0 ? `${minutes}分` : ""}`;
	return `${minutes}分`;
}

export async function POST(request: Request) {
	try {
		const LOG = "[api/analyze-activity/by-range]";
		const { searchParams } = new URL(request.url);
		const startParam = searchParams.get("start");
		const endParam = searchParams.get("end");
		const provider = (
			searchParams.get("provider") || "openai"
		).toLowerCase() as Provider;
		const createCalendar = /^(1|true|yes)$/i.test(
			searchParams.get("create") || "",
		);
		console.info(LOG, "request", {
			startParam,
			endParam,
			provider,
			createCalendar,
		});

		// Log calendar env readiness (no secrets)
		const calendarIdPresent = Boolean(
			process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_CALENDAR_ID,
		);
		const serviceCredsPresent = Boolean(
			(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ||
				process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL) &&
				(process.env.GOOGLE_CALENDAR_PRIVATE_KEY ||
					process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY),
		);
		console.info(LOG, "calendar-config", {
			requested: createCalendar,
			calendarIdPresent,
			serviceCredsPresent,
		});

		const start = parseDate(startParam);
		const end = parseDate(endParam);

		console.info(LOG, "parsed-range", {
			startISO: start?.toISOString(),
			endISO: end?.toISOString(),
		});

		if (!start || !end) {
			return NextResponse.json(
				{
					error:
						"Missing or invalid 'start'/'end'. Use ISO string or epoch (s/ms)",
				},
				{ status: 400 },
			);
		}
		if (end.getTime() <= start.getTime()) {
			return NextResponse.json(
				{ error: "'end' must be after 'start'" },
				{ status: 400 },
			);
		}

		// Collect ActivityWatch events and Git commits within the range
		const events = await activityWatchDB.getEventsByTimeRange(start, end);
		const gitCommits = await collectGitCommitsInRange(start, end);
		const gitEvents = buildGitCommitEvents(gitCommits);

		console.info(LOG, "fetched", {
			awEvents: events.length,
			gitCommits: gitCommits.length,
		});

		const sortedEvents = [...events].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
		);

		if (sortedEvents.length === 0 && gitEvents.length === 0) {
			return NextResponse.json(
				{ error: "No activity or commit data found for the given range" },
				{ status: 404 },
			);
		}

		// Filter out zero-duration ActivityWatch events
		const nonZeroEvents = sortedEvents.filter((e) => {
			const d =
				typeof e.duration === "string" ? parseFloat(e.duration) : e.duration;
			return Number.isFinite(d) && d > 0;
		});

		console.info(LOG, "prepared", {
			nonZeroEvents: nonZeroEvents.length,
			gitEvents: gitEvents.length,
		});

		// Compute stats from ActivityWatch events only (not including gitEvents)
		const rangeMs = end.getTime() - start.getTime();
		const stats = computeStats(nonZeroEvents, rangeMs);
		const statsXML = buildStatsSummaryXML(stats);
		console.info(LOG, "stats", {
			totalSeconds: stats.totalSeconds,
			switches: stats.switches,
			localDevSeconds: stats.localDevSeconds,
			peak10mSec: stats.peak10m?.seconds ?? 0,
			peak5mSec: stats.peak5m?.seconds ?? 0,
		});

		// Merge with Git commit events for context and build XML blocks
		const mergedEvents = [...nonZeroEvents, ...gitEvents].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
		);
		const snapshots = await buildFileSnapshotsFromCommits(gitCommits);
		const beforeXML = formatFileSnapshotsAsXML(snapshots, "before");
		const eventsXML = formatActivityDataAsXML(mergedEvents);
		const afterXML = formatFileSnapshotsAsXML(snapshots, "after");
		const activityXML = `${statsXML}\n${beforeXML}\n${eventsXML}\n${afterXML}`;

		console.info(LOG, "snapshots", { files: snapshots.length });

		// Persist XML for inspection/debugging
		const xmlPath = await persistXML(activityXML);
		console.info(LOG, "xml", { path: xmlPath, chars: activityXML.length });

		// Build prompt and generate non-streamed text (analysis summary)
		const timeRangeLabel = formatRangeLabel(start, end);
		const humanSummary = buildHumanSummary(stats);
		const prompt = buildPrompt({
			start,
			end,
			timeRangeLabel,
			humanSummary,
			activityXML,
		});
		console.info(LOG, "prompt", { chars: prompt.length });

		const modelSel = selectModel(provider);
		if (!modelSel.ok) {
			const status = modelSel.error.includes("Invalid provider") ? 400 : 500;
			return NextResponse.json({ error: modelSel.error }, { status });
		}

		const { text } = await generateText({
			model: modelSel.model,
			prompt,
			temperature: 0.7,
		});
		console.info(LOG, "analysis-generated", { chars: text.length });

		// Build calendar-specific prompt and get title/summary/bullets as structured object
		const calPrompt = buildCalendarObjectPrompt({
			start,
			end,
			timeRangeLabel,
			humanSummary,
			activityXML,
		});
		const calendarSchema = z.object({
			title: z.string(),
			summary: z.string(),
			bullets: z.array(z.string()),
		});

		type CalendarObject = z.infer<typeof calendarSchema>;

		const result = await generateObject({
			model: modelSel.model,
			prompt: calPrompt,
			temperature: 0.3,
			schema: calendarSchema,
		});

		const calendarObject: CalendarObject = result.object;
		console.info(LOG, "calendar-object", {
			title: calendarObject?.title,
			bullets: calendarObject?.bullets?.length ?? 0,
			summaryChars: calendarObject?.summary?.length ?? 0,
		});

		// Optionally create a Google Calendar event
		let calendar: null | {
			inserted: boolean;
			calendarId?: string;
			eventId?: string;
			htmlLink?: string;
			reason?: string;
		} = null;
		if (createCalendar) {
			calendar = await createCalendarEventIfConfigured({
				start,
				end,
				summary: (calendarObject?.title || `作業 (${timeRangeLabel})`).slice(
					0,
					50,
				),
				description: (() => {
					const lines: string[] = [];
					if (calendarObject?.summary) lines.push(calendarObject.summary);
					if (calendarObject?.bullets && calendarObject.bullets.length > 0)
						lines.push(`\n・${calendarObject.bullets.join("\n・")}`);
					const out = lines.join("\n").trim();
					return out.length > 0 ? out : text; // fallback
				})(),
				timeZone: "Asia/Tokyo",
			});
			console.info(LOG, "calendar-insert", {
				inserted: calendar?.inserted,
				htmlLink: calendar?.htmlLink,
				reason: calendar?.reason,
			});
		} else {
			console.info(LOG, "calendar-skip", {
				reason:
					"create flag is false. Pass ?create=1|true|yes to enable calendar insertion.",
			});
		}

		return NextResponse.json({
			ok: true,
			range: {
				start: start.toISOString(),
				end: end.toISOString(),
				label: timeRangeLabel,
			},
			provider,
			counts: {
				activityEvents: nonZeroEvents.length,
				gitCommits: gitCommits.length,
			},
			humanSummary,
			prompt,
			result: text,
			xmlPath,
			calendarObject,
			calendarResult: calendar,
		});
	} catch (error) {
		console.error("Error in analyze-activity/by-range:", error);
		return NextResponse.json(
			{ error: "Failed to analyze activity data for the given range" },
			{ status: 500 },
		);
	}
}
