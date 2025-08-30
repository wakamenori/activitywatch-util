import { streamText } from "ai";
import { NextResponse } from "next/server";
import { persistXML } from "@/lib/analyze-activity/files";
import {
	buildFileSnapshotsFromCommits,
	buildGitCommitEvents,
	collectGitCommitsInRange,
} from "@/lib/analyze-activity/git";
import { type Provider, selectModel } from "@/lib/analyze-activity/llm";
import { buildHumanSummary, buildPrompt } from "@/lib/analyze-activity/prompt";
import { computeStats } from "@/lib/analyze-activity/stats";
import {
	buildStatsSummaryXML,
	formatActivityDataAsXML,
	formatFileSnapshotsAsXML,
} from "@/lib/analyze-activity/xml";
import { activityWatchDB } from "@/lib/database";

export const maxDuration = 30;

// Ensure Node.js runtime to allow filesystem access
export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const timeRange = searchParams.get("range") || "60m";
		const provider = (
			searchParams.get("provider") || "openai"
		).toLowerCase() as Provider;

		// Validate and parse time range
		const timeRanges = {
			"30m": 30 * 60 * 1000,
			"60m": 60 * 60 * 1000,
			"120m": 120 * 60 * 1000,
		};

		const rangeMs = timeRanges[timeRange as keyof typeof timeRanges];
		if (!rangeMs) {
			return NextResponse.json(
				{ error: "Invalid time range. Use 30m, 60m, or 120m" },
				{ status: 400 },
			);
		}

		// Get events from specified time range
		const now = new Date();
		const startTime = new Date(now.getTime() - rangeMs);

		const events = await activityWatchDB.getEventsByTimeRange(startTime, now);
		const gitCommits = await collectGitCommitsInRange(startTime, now);
		const gitEvents = buildGitCommitEvents(gitCommits);
		console.dir(gitEvents, { depth: null });

		// Sort events from oldest to newest
		const sortedEvents = [...events].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
		);

		if (events.length === 0) {
			return NextResponse.json(
				{ error: "No activity data found for analysis" },
				{ status: 404 },
			);
		}

		// Filter out zero-duration events across all buckets
		const nonZeroEvents = sortedEvents.filter((e) => {
			const d =
				typeof e.duration === "string"
					? Number.parseFloat(e.duration)
					: e.duration;
			return Number.isFinite(d) && d > 0;
		});

		// Compute stats using only ActivityWatch events to avoid skew
		const stats = computeStats(nonZeroEvents, rangeMs);
		const statsXML = buildStatsSummaryXML(stats);
		// Merge commit events (Option 2: same <events> with type="git.commit")
		const mergedEvents = [...nonZeroEvents, ...gitEvents].sort(
			(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
		);
		// Build file snapshots and arrange order: before -> events -> after
		const snapshots = await buildFileSnapshotsFromCommits(gitCommits);
		const beforeXML = formatFileSnapshotsAsXML(snapshots, "before");
		const eventsXML = formatActivityDataAsXML(mergedEvents);
		const afterXML = formatFileSnapshotsAsXML(snapshots, "after");
		const activityXML = `${statsXML}\n${beforeXML}\n${eventsXML}\n${afterXML}`;

		// Persist XML to xml/<timestamp>.xml for inspection
		await persistXML(activityXML);

		// Create prompt for LLM
		const timeRangeLabel =
			timeRange === "30m" ? "30分" : timeRange === "60m" ? "1時間" : "2時間";
		const humanSummary = buildHumanSummary(stats);
		const prompt = buildPrompt({
			start: startTime,
			end: now,
			timeRangeLabel,
			humanSummary,
			activityXML,
		});

		console.log(prompt);
		// Select model by provider
		const modelSel = selectModel(provider);
		if (!modelSel.ok) {
			const status = modelSel.error.includes("Invalid provider") ? 400 : 500;
			return NextResponse.json({ error: modelSel.error }, { status });
		}

		// Create streaming response
		const result = streamText({
			model: modelSel.model,
			prompt,
			temperature: 0.7,
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		console.error("Error analyzing activity:", error);
		return NextResponse.json(
			{ error: "Failed to analyze activity data" },
			{ status: 500 },
		);
	}
}
