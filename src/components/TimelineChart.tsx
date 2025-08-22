"use client";

import { useMemo } from "react";

interface Event {
	id: number;
	bucket_id: number;
	timestamp: Date;
	duration: any; // Decimal type from Prisma
	datastr: string;
	bucketmodel: {
		key: number;
		id: string;
		created: Date;
		name: string | null;
		type: string;
		client: string;
		hostname: string;
	};
}

interface TimelineChartProps {
	events: Event[];
}

export function TimelineChart({ events }: TimelineChartProps) {
	const timelineData = useMemo(() => {
		const hourlyData: Record<number, number> = {};

		for (let i = 0; i < 24; i++) {
			hourlyData[i] = 0;
		}

		events.forEach((event) => {
			const date = new Date(event.timestamp);
			const hour = date.getHours();
			const duration = Number(event.duration);
			hourlyData[hour] += duration;
		});

		return Object.entries(hourlyData).map(([hour, duration]) => ({
			hour: Number.parseInt(hour, 10),
			duration: duration / 60, // Convert to minutes
			percentage: Math.min((duration / 3600) * 100, 100), // Percentage of hour active
		}));
	}, [events]);

	const _maxDuration = Math.max(...timelineData.map((d) => d.duration));

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
				Today's Activity Timeline
			</h2>
			<div className="space-y-2">
				<div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
					<span>Hour</span>
					<span>Activity Level</span>
				</div>
				{timelineData.map((data) => (
					<div key={data.hour} className="flex items-center gap-3">
						<span className="text-xs text-gray-600 dark:text-gray-400 w-12">
							{String(data.hour).padStart(2, "0")}:00
						</span>
						<div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
							<div
								className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 dark:from-blue-500 dark:to-blue-700 rounded-full transition-all duration-500"
								style={{
									width: `${data.percentage}%`,
								}}
							/>
							<span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700 dark:text-gray-300">
								{data.duration > 0 ? `${Math.round(data.duration)}m` : ""}
							</span>
						</div>
					</div>
				))}
			</div>
			<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
				<div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
					<span>Total events: {events.length}</span>
					<span>
						Peak hour:{" "}
						{timelineData.reduce(
							(max, data) =>
								data.duration > timelineData[max].duration ? data.hour : max,
							0,
						)}
						:00
					</span>
				</div>
			</div>
		</div>
	);
}
