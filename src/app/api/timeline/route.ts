import { NextResponse } from "next/server";
import { activityWatchDB } from "@/lib/database";
import type { EventModel } from "@/types/activitywatch";

export async function GET() {
	try {
		// Get events from last 1 hour
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

		const events = await activityWatchDB.getEventsByTimeRange(oneHourAgo, now);

		// Sort events by timestamp
		events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

		// Group overlapping events by bucket type
		const timeline = processTimelineData(events);

		return NextResponse.json({
			timeline,
			startTime: oneHourAgo,
			endTime: now,
			totalEvents: events.length,
		});
	} catch (error) {
		console.error("Error fetching timeline data:", error);
		return NextResponse.json(
			{ error: "Failed to fetch timeline data" },
			{ status: 500 },
		);
	}
}

interface ProcessedTimelineEvent {
	id: number;
	start: Date;
	end: Date;
	duration: number;
	bucketType: string;
	bucket: string;
	data: Record<string, unknown>;
}

interface TimelineTrack {
	type: string;
	events: ProcessedTimelineEvent[];
}

function processTimelineData(events: EventModel[]): TimelineTrack[] {
	const timeline: TimelineTrack[] = [];
	const bucketTracks = new Map<string, ProcessedTimelineEvent[]>();

	// Group events by bucket type
	for (const event of events) {
		const bucketType = event.bucketmodel?.type || "unknown";
		if (!bucketTracks.has(bucketType)) {
			bucketTracks.set(bucketType, []);
		}

		// Parse data for display
		let displayData: Record<string, unknown> = {};
		try {
			const data = JSON.parse(event.datastr);

			switch (bucketType) {
				case "currentwindow":
					displayData = {
						app: data.app,
						title: data.title,
					};
					break;
				case "web.tab.current":
					displayData = {
						title: data.title,
						url: data.url,
						domain: new URL(data.url).hostname,
					};
					break;
				case "afkstatus":
					displayData = {
						status: data.status,
					};
					break;
				case "app.editor.activity":
					displayData = {
						file: data.file || data.project || "editor",
						language: data.language,
					};
					break;
				default:
					displayData = data;
			}
		} catch (_e) {
			displayData = { raw: event.datastr };
		}

		const duration = typeof event.duration === 'string' ? parseFloat(event.duration) : event.duration;
		
		const processedEvent: ProcessedTimelineEvent = {
			id: event.id,
			start: event.timestamp,
			end: new Date(event.timestamp.getTime() + duration * 1000),
			duration,
			bucketType,
			bucket: event.bucketmodel?.id || "",
			data: displayData,
		};

		bucketTracks.get(bucketType)?.push(processedEvent);
	}

	// Convert to array format for timeline
	bucketTracks.forEach((events, type) => {
		timeline.push({
			type,
			events,
		});
	});

	return timeline;
}
