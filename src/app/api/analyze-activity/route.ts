import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { NextResponse } from "next/server";
import { activityWatchDB } from "@/lib/database";
import type { EventModel } from "@/types/activitywatch";

export const maxDuration = 30;

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
	return `${date.toLocaleString("ja-JP", { 
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit", 
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	}).replace(/\//g, "-")} (JST)`;
}

function escapeXML(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatActivityDataAsXML(events: EventModel[]): string {
	let xml = "<events>\n";
	
	for (const event of events) {
		const duration = typeof event.duration === "string" 
			? parseFloat(event.duration) 
			: event.duration;
		
		const timestamp = formatTimestampToJST(event.timestamp);
		const formattedDuration = formatDuration(duration);
		const type = event.bucketmodel?.type || "unknown";
		
		xml += `  <event>\n`;
		xml += `    <timestamp>${escapeXML(timestamp)}</timestamp>\n`;
		xml += `    <duration>${escapeXML(formattedDuration)}</duration>\n`;
		xml += `    <type>${escapeXML(type)}</type>\n`;
		xml += `    <data>\n`;
		
		try {
			const data = JSON.parse(event.datastr);
			
			if (type === "currentwindow") {
				if (data.app) xml += `      <app>${escapeXML(data.app)}</app>\n`;
				if (data.title) xml += `      <title>${escapeXML(data.title)}</title>\n`;
			} else if (type === "web.tab.current") {
				if (data.url) xml += `      <url>${escapeXML(data.url)}</url>\n`;
				if (data.title) xml += `      <title>${escapeXML(data.title)}</title>\n`;
			} else if (type === "afkstatus") {
				if (data.status) xml += `      <status>${escapeXML(data.status)}</status>\n`;
			}
		} catch {
			// Invalid JSON, skip data parsing
		}
		
		xml += `    </data>\n`;
		xml += `  </event>\n`;
	}
	
	xml += "</events>";
	return xml;
}

export async function POST(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const timeRange = searchParams.get('range') || '60m';
		
		// Validate and parse time range
		const timeRanges = {
			'30m': 30 * 60 * 1000,
			'60m': 60 * 60 * 1000,
			'120m': 120 * 60 * 1000,
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

		if (events.length === 0) {
			return NextResponse.json(
				{ error: "No activity data found for analysis" },
				{ status: 404 },
			);
		}

		// Transform data for LLM analysis
		const activityXML = formatActivityDataAsXML(events);

		// Create prompt for LLM  
		const timeRangeLabel = timeRange === '30m' ? '30分' : timeRange === '60m' ? '1時間' : '2時間';
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
