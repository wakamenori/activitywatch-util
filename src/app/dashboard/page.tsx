import { DashboardClient } from "@/components/DashboardClient";
import { activityWatchDB } from "@/lib/database";

export default async function DashboardPage() {
	const [buckets, recentEvents] = await Promise.all([
		activityWatchDB.getBuckets(),
		activityWatchDB.getEvents(undefined, 50),
	]);

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const todayEvents = await activityWatchDB.getEventsByTimeRange(
		today,
		tomorrow,
	);

	return (
		<DashboardClient
			initialBuckets={buckets}
			initialEvents={recentEvents}
			initialTodayEvents={todayEvents}
		/>
	);
}
