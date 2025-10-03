import { hostname } from "node:os";
import { generateObject, generateText } from "ai";
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
import { formatRangeLabel } from "@/lib/analyze-activity/range";
import { computeStats } from "@/lib/analyze-activity/stats";
import {
	buildStatsSummaryXML,
	formatActivityDataAsXML,
	formatFileSnapshotsAsXML,
} from "@/lib/analyze-activity/xml";
import { activityWatchDB } from "@/lib/database";
import { createCalendarEventIfConfigured } from "@/lib/google/calendar";

const calendarSchema = z.object({
	title: z.string(),
	summary: z.string(),
	bullets: z.array(z.string()),
});

type CalendarObject = z.infer<typeof calendarSchema>;

type ConsoleLogger = Pick<typeof console, "info" | "error">;

const MACHINE_NAME = (() => {
	try {
		return hostname().trim();
	} catch {
		return "";
	}
})();

export interface RangeAnalysisInput {
	start: Date;
	end: Date;
	provider: Provider;
	createCalendar: boolean;
	saveXml: boolean;
	logPrefix?: string;
	logger?: ConsoleLogger;
}

export interface RangeAnalysisResult {
	ok: true;
	range: {
		start: string;
		end: string;
		label: string;
	};
	provider: Provider;
	counts: {
		activityEvents: number;
		gitCommits: number;
	};
	humanSummary: string;
	prompt: string;
	result: string;
	xmlPath: string | null;
	calendarObject: CalendarObject;
	calendarResult: null | {
		inserted: boolean;
		calendarId?: string;
		eventId?: string;
		htmlLink?: string;
		reason?: string;
	};
}

export class RangeAnalysisError extends Error {
	status: number;

	constructor(message: string, status = 500, options?: ErrorOptions) {
		super(message, options);
		this.name = "RangeAnalysisError";
		this.status = status;
	}
}

export async function runRangeAnalysis({
	start,
	end,
	provider,
	createCalendar,
	saveXml,
	logPrefix = "[runRangeAnalysis]",
	logger = console,
}: RangeAnalysisInput): Promise<RangeAnalysisResult> {
	if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
		throw new RangeAnalysisError("Invalid start date", 400);
	}
	if (!(end instanceof Date) || Number.isNaN(end.getTime())) {
		throw new RangeAnalysisError("Invalid end date", 400);
	}
	if (end.getTime() <= start.getTime()) {
		throw new RangeAnalysisError("'end' must be after 'start'", 400);
	}

	const log = (message: string, details?: unknown) => {
		if (typeof details === "undefined") {
			logger.info(logPrefix, message);
			return;
		}
		logger.info(logPrefix, message, details);
	};

	log("range", { startISO: start.toISOString(), endISO: end.toISOString() });

	const events = await activityWatchDB.getEventsByTimeRange(start, end);
	const gitCommits = await collectGitCommitsInRange(start, end);
	const gitEvents = buildGitCommitEvents(gitCommits);

	log("fetched", { awEvents: events.length, gitCommits: gitCommits.length });

	const sortedEvents = [...events].sort(
		(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
	);

	if (sortedEvents.length === 0 && gitEvents.length === 0) {
		throw new RangeAnalysisError(
			"No activity or commit data found for the given range",
			404,
		);
	}

	const nonZeroEvents = sortedEvents.filter((event) => {
		const duration =
			typeof event.duration === "string"
				? Number.parseFloat(event.duration)
				: event.duration;
		return Number.isFinite(duration) && duration > 0;
	});

	log("prepared", {
		nonZeroEvents: nonZeroEvents.length,
		gitEvents: gitEvents.length,
	});

	const rangeMs = end.getTime() - start.getTime();
	const stats = computeStats(nonZeroEvents, rangeMs);
	const statsXML = buildStatsSummaryXML(stats);

	log("stats", {
		totalSeconds: stats.totalSeconds,
		switches: stats.switches,
		localDevSeconds: stats.localDevSeconds,
		peak10mSec: stats.peak10m?.seconds ?? 0,
		peak5mSec: stats.peak5m?.seconds ?? 0,
	});

	const mergedEvents = [...nonZeroEvents, ...gitEvents].sort(
		(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
	);
	const snapshots = await buildFileSnapshotsFromCommits(gitCommits);
	const beforeXML = formatFileSnapshotsAsXML(snapshots, "before");
	const eventsXML = formatActivityDataAsXML(mergedEvents);
	const afterXML = formatFileSnapshotsAsXML(snapshots, "after");
	const activityXML = `${statsXML}\n${beforeXML}\n${eventsXML}\n${afterXML}`;

	log("snapshots", { files: snapshots.length });

	let xmlPath: string | null = null;
	if (saveXml) {
		xmlPath = await persistXML(activityXML);
		log("xml", { path: xmlPath, chars: activityXML.length });
	} else {
		log("xml-skip", { reason: "disabled", chars: activityXML.length });
	}

	const timeRangeLabel = formatRangeLabel(start, end);
	const humanSummary = buildHumanSummary(stats);
	const prompt = buildPrompt({
		start,
		end,
		timeRangeLabel,
		humanSummary,
		activityXML,
	});
	log("prompt", { chars: prompt.length });

	const modelSel = selectModel(provider);
	if (!modelSel.ok) {
		const status = modelSel.error.includes("Invalid provider") ? 400 : 500;
		throw new RangeAnalysisError(modelSel.error, status);
	}

	const { text } = await generateText({
		model: modelSel.model,
		prompt,
		temperature: 0.7,
	});
	log("analysis-generated", { chars: text.length });

	const calPrompt = buildCalendarObjectPrompt({
		start,
		end,
		timeRangeLabel,
		humanSummary,
		activityXML,
	});

	const result = await generateObject({
		model: modelSel.model,
		prompt: calPrompt,
		temperature: 0.3,
		schema: calendarSchema,
	});

	const calendarObject: CalendarObject = result.object;
	log("calendar-object", {
		title: calendarObject?.title,
		bullets: calendarObject?.bullets?.length ?? 0,
		summaryChars: calendarObject?.summary?.length ?? 0,
	});

	let calendar: RangeAnalysisResult["calendarResult"] = null;
	if (createCalendar) {
		const titleCandidate = calendarObject?.title?.trim();
		const baseSummary =
			titleCandidate && titleCandidate.length > 0
				? titleCandidate
				: `作業 (${timeRangeLabel})`;
		const prefixedSummary = MACHINE_NAME
			? `[${MACHINE_NAME}] ${baseSummary}`
			: baseSummary;
		calendar = await createCalendarEventIfConfigured({
			start,
			end,
			summary: prefixedSummary.slice(0, 50),
			description: (() => {
				const lines: string[] = [];
				if (calendarObject?.summary) lines.push(calendarObject.summary);
				if (calendarObject?.bullets && calendarObject.bullets.length > 0) {
					lines.push(`\n・${calendarObject.bullets.join("\n・")}`);
				}
				const output = lines.join("\n").trim();
				return output.length > 0 ? output : text;
			})(),
			timeZone: "Asia/Tokyo",
		});
		log("calendar-insert", {
			inserted: calendar?.inserted,
			htmlLink: calendar?.htmlLink,
			reason: calendar?.reason,
		});
	} else {
		log("calendar-skip", {
			reason:
				"create flag is false. Pass ?create=1|true|yes to enable calendar insertion.",
		});
	}

	return {
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
	};
}
