import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type LanguageModel, streamText } from "ai";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { activityWatchDB } from "@/lib/database";
import type { EventModel } from "@/types/activitywatch";

export const maxDuration = 30;

// Ensure Node.js runtime to allow filesystem access
export const runtime = "nodejs";

function formatDuration(seconds: number): string {
	const totalSeconds = Math.floor(seconds);
	const minutes = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;

	if (minutes > 0) {
		return secs > 0 ? `${minutes}m${secs}s` : `${minutes}m`;
	}
	return `${secs}s`;
}

function formatTimestampToJST(date: Date): string {
	return date.toLocaleTimeString("ja-JP", {
		timeZone: "Asia/Tokyo",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function escapeXML(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function basenameMaybe(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/[/\\]+$/, "");
    const parts = trimmed.split(/[\\/]/);
    const name = parts[parts.length - 1];
    return name || trimmed;
}

function normalizePathLike(value: string): string {
    // Convert Windows separators to POSIX-style and trim trailing separators
    return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

function fileRelativeToProjectMaybe(fileVal: unknown, projectVal: unknown): string | null {
    if (typeof fileVal !== "string" || typeof projectVal !== "string") return null;
    const file = normalizePathLike(fileVal);
    const project = normalizePathLike(projectVal);
    if (!file || !project) return null;
    // If file is under project, return clean relative path
    if (file.startsWith(`${project}/`)) {
        return file.slice(project.length + 1);
    }
    // Fallback: try Node's relative (may produce ../..). If it climbs out, prefer basename.
    const rel = relative(project, file);
    if (!rel.startsWith("..")) return rel;
    return basenameMaybe(file) || null;
}

function formatActivityDataAsXML(events: EventModel[]): string {
    const lines: string[] = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<events>"];

	for (const event of events) {
		const duration =
			typeof event.duration === "string"
				? parseFloat(event.duration)
				: event.duration;

		const timestamp = formatTimestampToJST(event.timestamp);
		const formattedDuration = formatDuration(duration);
		const type = event.bucketmodel?.type || "unknown";

		const parts: string[] = [];
		parts.push(`<timestamp>${escapeXML(timestamp)}</timestamp>`);
		parts.push(`<duration>${escapeXML(formattedDuration)}</duration>`);
		parts.push(`<type>${escapeXML(type)}</type>`);

		// Build data section inline (no newlines) based on type
		let dataInner = "";
		try {
			const data = JSON.parse(event.datastr);
			if (type === "currentwindow") {
				if (data.app) dataInner += `<app>${escapeXML(data.app)}</app>`;
				if (data.title) dataInner += `<title>${escapeXML(data.title)}</title>`;
			} else if (type === "web.tab.current") {
				if (data.url) dataInner += `<url>${escapeXML(data.url)}</url>`;
				if (data.title) dataInner += `<title>${escapeXML(data.title)}</title>`;
            } else if (type === "afkstatus") {
                if (data.status)
                    dataInner += `<status>${escapeXML(data.status)}</status>`;
            } else if (type === "app.editor.activity") {
                if (data.file) {
                    const rel = fileRelativeToProjectMaybe(data.file, data.project);
                    const fileOut = rel || basenameMaybe(data.file) || String(data.file);
                    dataInner += `<file>${escapeXML(fileOut)}</file>`;
                }
                if (data.language)
                    dataInner += `<language>${escapeXML(data.language)}</language>`;
                if (data.project) {
                    const projName = basenameMaybe(data.project) || String(data.project);
                    dataInner += `<project>${escapeXML(projName)}</project>`;
                }
                if (data.branch)
                    dataInner += `<branch>${escapeXML(String(data.branch))}</branch>`;
            }
		} catch {
			// Invalid JSON, skip data parsing
		}

		parts.push(`<data>${dataInner}</data>`);

		// One <event> per line
		lines.push(`<event>${parts.join("")}</event>`);
	}

    lines.push("</events>");
    return lines.join("\n");
}

export async function POST(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const timeRange = searchParams.get("range") || "60m";
		const provider = (searchParams.get("provider") || "openai").toLowerCase();

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
			const d = typeof e.duration === "string" ? Number.parseFloat(e.duration) : e.duration;
			return Number.isFinite(d) && d > 0;
		});

		// Transform data for LLM analysis
		const activityXML = formatActivityDataAsXML(nonZeroEvents);

        // Persist XML to xml/<timestamp>.xml for inspection
        try {
            const outDir = join(process.cwd(), "xml");
            await mkdir(outDir, { recursive: true });

            const nowTs = new Date();
            const pad = (n: number) => n.toString().padStart(2, "0");
            const ts = `${nowTs.getFullYear()}${pad(nowTs.getMonth() + 1)}${pad(nowTs.getDate())}-${pad(nowTs.getHours())}${pad(nowTs.getMinutes())}${pad(nowTs.getSeconds())}`;
            const filename = join(outDir, `${ts}.xml`);
			await writeFile(filename, activityXML, { encoding: "utf8" });
        } catch (e) {
            console.error("Failed to write XML file:", e);
        }

		// Create prompt for LLM
		const timeRangeLabel =
			timeRange === "30m" ? "30分" : timeRange === "60m" ? "1時間" : "2時間";
		const prompt = `あなたは生産性アドバイザーです。以下のXML形式のアクティビティデータを分析して、日本語で簡潔な要約とアドバイスを提供してください。

データ期間: ${startTime.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ～ ${now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} (JST)
時間範囲: ${timeRangeLabel}

アクティビティデータ（XML形式）:
${activityXML}

以下の観点から300文字程度で分析してください:
1. この${timeRangeLabel}の活動パターンの特徴（時系列での作業の流れ）
2. 生産性に関する気づき（集中度、効率性など）
3. 改善提案（具体的で実行可能なもの）

時間は既にJST形式で表示されており、durationは人間が読みやすい形式（例：10m12s）で表示されています。
親しみやすく、建設的なトーンでお願いします。`;

		console.log(prompt);
		// Select model by provider
		let selectedModel: LanguageModel;
		if (provider === "gemini") {
			if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
				return NextResponse.json(
					{ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY for Gemini provider" },
					{ status: 500 },
				);
			}
			selectedModel = google("gemini-2.5-pro");
		} else if (provider === "openai") {
			selectedModel = openai.responses("gpt-5");
		} else {
			return NextResponse.json(
				{ error: "Invalid provider. Use 'openai' or 'gemini'" },
				{ status: 400 },
			);
		}

		// Create streaming response
		const result = streamText({
			model: selectedModel,
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
