import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { activityWatchDB } from "@/lib/database";
import type { EventModel } from "@/types/activitywatch";

export const maxDuration = 30;

interface ActivitySummary {
	apps: { name: string; duration: number; percentage: number }[];
	websites: { domain: string; duration: number; percentage: number }[];
	totalActiveTime: number;
	totalAfkTime: number;
	focusedTime: number;
	distractedTime: number;
	timeRange: { start: string; end: string };
}

function formatActivityDataForLLM(events: EventModel[]): ActivitySummary {
	const now = new Date();
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

	// Group events by app/website
	const appUsage = new Map<string, number>();
	const websiteUsage = new Map<string, number>();
	let totalActiveTime = 0;
	let totalAfkTime = 0;

	for (const event of events) {
		const duration =
			typeof event.duration === "string"
				? parseFloat(event.duration)
				: event.duration;

		if (event.bucketmodel?.type === "currentwindow") {
			const data = JSON.parse(event.datastr);
			const app = data.app || "Unknown";
			appUsage.set(app, (appUsage.get(app) || 0) + duration);
			totalActiveTime += duration;
		} else if (event.bucketmodel?.type === "web.tab.current") {
			const data = JSON.parse(event.datastr);
			if (data.url) {
				try {
					const domain = new URL(data.url).hostname;
					websiteUsage.set(domain, (websiteUsage.get(domain) || 0) + duration);
				} catch {
					// Invalid URL, skip
				}
			}
		} else if (event.bucketmodel?.type === "afkstatus") {
			const data = JSON.parse(event.datastr);
			if (data.status === "not-afk") {
				totalActiveTime += duration;
			} else {
				totalAfkTime += duration;
			}
		}
	}

	// Convert to arrays and calculate percentages
	const totalTime = totalActiveTime + totalAfkTime;

	const apps = Array.from(appUsage.entries())
		.map(([name, duration]) => ({
			name,
			duration,
			percentage: totalTime > 0 ? (duration / totalTime) * 100 : 0,
		}))
		.sort((a, b) => b.duration - a.duration)
		.slice(0, 10); // Top 10 apps

	const websites = Array.from(websiteUsage.entries())
		.map(([domain, duration]) => ({
			domain,
			duration,
			percentage: totalTime > 0 ? (duration / totalTime) * 100 : 0,
		}))
		.sort((a, b) => b.duration - a.duration)
		.slice(0, 10); // Top 10 websites

	// Calculate focus vs distraction time (simplified heuristic)
	const productiveApps = [
		"Visual Studio Code",
		"Terminal",
		"IntelliJ IDEA",
		"Xcode",
		"Sublime Text",
	];
	const distractiveWebsites = [
		"youtube.com",
		"twitter.com",
		"x.com",
		"facebook.com",
		"instagram.com",
		"tiktok.com",
	];

	let focusedTime = 0;
	let distractedTime = 0;

	for (const app of apps) {
		if (
			productiveApps.some((prod) =>
				app.name.toLowerCase().includes(prod.toLowerCase()),
			)
		) {
			focusedTime += app.duration;
		}
	}

	for (const website of websites) {
		if (distractiveWebsites.includes(website.domain.toLowerCase())) {
			distractedTime += website.duration;
		}
	}

	return {
		apps,
		websites,
		totalActiveTime,
		totalAfkTime,
		focusedTime,
		distractedTime,
		timeRange: {
			start: oneHourAgo.toISOString(),
			end: now.toISOString(),
		},
	};
}

export async function POST() {
	try {
		// Get events from last 1 hour (same as timeline API)
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

		const events = await activityWatchDB.getEventsByTimeRange(oneHourAgo, now);

		if (events.length === 0) {
			return NextResponse.json(
				{ error: "No activity data found for analysis" },
				{ status: 404 },
			);
		}

		// Transform data for LLM analysis
		const activitySummary = formatActivityDataForLLM(events);

		// Create prompt for LLM
		const prompt = `あなたは生産性アドバイザーです。以下の1時間のアクティビティデータを分析して、日本語で簡潔な要約とアドバイスを提供してください。

アクティビティデータ:
- 期間: ${new Date(activitySummary.timeRange.start).toLocaleString("ja-JP")} ～ ${new Date(activitySummary.timeRange.end).toLocaleString("ja-JP")}
- 総アクティブ時間: ${Math.round(activitySummary.totalActiveTime / 60)}分
- AFK時間: ${Math.round(activitySummary.totalAfkTime / 60)}分

主要アプリ使用状況:
${activitySummary.apps.map((app) => `- ${app.name}: ${Math.round(app.duration / 60)}分 (${app.percentage.toFixed(1)}%)`).join("\n")}

主要ウェブサイト:
${activitySummary.websites.map((site) => `- ${site.domain}: ${Math.round(site.duration / 60)}分 (${site.percentage.toFixed(1)}%)`).join("\n")}

集中時間: ${Math.round(activitySummary.focusedTime / 60)}分
気が散る時間: ${Math.round(activitySummary.distractedTime / 60)}分

以下の観点から300文字程度で分析してください:
1. この1時間の活動パターンの特徴
2. 生産性に関する気づき
3. 改善提案（具体的で実行可能なもの）

親しみやすく、建設的なトーンでお願いします。`;

		// Create streaming response
		const result = streamText({
			model: openai.responses("gpt-5"),
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
