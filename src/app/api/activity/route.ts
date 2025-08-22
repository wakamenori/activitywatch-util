import { NextResponse } from "next/server";
import { activityWatchDB } from "@/lib/database";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const timeRange = searchParams.get("range") || "today";
		const bucketId = searchParams.get("bucketId");

		let startTime: Date;
		const endTime = new Date();

		switch (timeRange) {
			case "today":
				startTime = new Date();
				startTime.setHours(0, 0, 0, 0);
				break;
			case "week":
				startTime = new Date();
				startTime.setDate(startTime.getDate() - 7);
				break;
			case "month":
				startTime = new Date();
				startTime.setMonth(startTime.getMonth() - 1);
				break;
			default:
				startTime = new Date();
				startTime.setHours(0, 0, 0, 0);
		}

		const [buckets, events] = await Promise.all([
			activityWatchDB.getBuckets(),
			activityWatchDB.getEventsByTimeRange(
				startTime,
				endTime,
				bucketId ? Number.parseInt(bucketId, 10) : undefined,
			),
		]);

		return NextResponse.json({
			buckets,
			events,
			timeRange: {
				start: startTime,
				end: endTime,
			},
		});
	} catch (error) {
		console.error("Error fetching activity data:", error);
		return NextResponse.json(
			{ error: "Failed to fetch activity data" },
			{ status: 500 },
		);
	}
}
