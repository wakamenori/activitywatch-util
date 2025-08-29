"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ActivitySummary } from "@/components/ActivitySummary";
import { BucketList } from "@/components/BucketList";
import { RecentEvents } from "@/components/RecentEvents";
import { TimelineChart } from "@/components/TimelineChart";

interface Bucket {
	key: number;
	id: string;
	created: Date;
	name: string | null;
	type: string;
	client: string;
	hostname: string;
}

interface Event {
	id: number;
	bucket_id: number;
	timestamp: Date;
	duration: number | string;
	datastr: string;
	bucketmodel: Bucket;
}

interface DashboardClientProps {
	initialBuckets: Bucket[];
	initialEvents: Event[];
	initialTodayEvents: Event[];
}

export function DashboardClient({
	initialBuckets,
	initialEvents,
	initialTodayEvents,
}: DashboardClientProps) {
	const [buckets, setBuckets] = useState(initialBuckets);
	const [events, setEvents] = useState(initialEvents);
	const [todayEvents, setTodayEvents] = useState(initialTodayEvents);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [autoRefresh, setAutoRefresh] = useState(true);
	const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

	const fetchLatestData = useCallback(async () => {
		setIsRefreshing(true);
		try {
			const response = await fetch("/api/activity?range=today");
			const data = await response.json();

			if (data.buckets) setBuckets(data.buckets);
			if (data.events) {
				setTodayEvents(data.events);
				// Get the 50 most recent events for the recent events table
				setEvents(data.events.slice(0, 50));
			}
		} catch (error) {
			console.error("Failed to refresh data:", error);
		} finally {
			setIsRefreshing(false);
		}
	}, []);

	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(fetchLatestData, refreshInterval);
		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval, fetchLatestData]);

	return (
		<div className="container mx-auto p-6">
			<header className="mb-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-gray-900 dark:text-white">
							ActivityWatch Dashboard
						</h1>
						<p className="text-gray-600 dark:text-gray-400 mt-2">
							Your computer activity tracking overview
						</p>
					</div>
					<div className="flex items-center gap-4">
						<Link
							href="/timeline"
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
						>
							📊 タイムライン
						</Link>
						<button
							type="button"
							onClick={fetchLatestData}
							disabled={isRefreshing}
							className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
						>
							{isRefreshing ? (
								<>
									<span className="animate-spin">⟳</span>
									Refreshing...
								</>
							) : (
								"↻ Refresh"
							)}
						</button>
						<div className="flex items-center gap-2">
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									checked={autoRefresh}
									onChange={(e) => setAutoRefresh(e.target.checked)}
									className="rounded"
								/>
								<span className="text-sm text-gray-700 dark:text-gray-300">
									Auto-refresh
								</span>
							</label>
							{autoRefresh && (
								<select
									value={refreshInterval}
									onChange={(e) => setRefreshInterval(Number(e.target.value))}
									className="ml-2 text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
								>
									<option value={10000}>10s</option>
									<option value={30000}>30s</option>
									<option value={60000}>1m</option>
									<option value={300000}>5m</option>
								</select>
							)}
						</div>
					</div>
				</div>
			</header>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
				<ActivitySummary events={todayEvents} />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
				<TimelineChart events={todayEvents} />
				<BucketList buckets={buckets} />
			</div>

			<div className="mt-6">
				<RecentEvents events={events} />
			</div>
		</div>
	);
}
