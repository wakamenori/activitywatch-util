"use client";

interface Event {
	id: number;
	bucket_id: number;
	timestamp: Date;
	duration: number | string; // Can be either number or string from database
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

interface ActivitySummaryProps {
	events: Event[];
}

export function ActivitySummary({ events }: ActivitySummaryProps) {
	const totalDuration = events.reduce((sum, event) => {
		return sum + Number(event.duration);
	}, 0);

	const totalHours = (totalDuration / 3600).toFixed(1);
	const uniqueBuckets = new Set(events.map((e) => e.bucketmodel.id)).size;
	const _avgDuration = events.length > 0 ? totalDuration / events.length : 0;

	return (
		<>
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
							Total Active Time
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{totalHours} hours
						</p>
					</div>
					<div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
						<svg
							className="w-6 h-6 text-blue-600 dark:text-blue-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Clock Icon</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
							Total Events
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{events.length}
						</p>
					</div>
					<div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
						<svg
							className="w-6 h-6 text-green-600 dark:text-green-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Activity Icon</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M13 10V3L4 14h7v7l9-11h-7z"
							/>
						</svg>
					</div>
				</div>
			</div>

			<div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
							Active Trackers
						</p>
						<p className="text-2xl font-bold text-gray-900 dark:text-white">
							{uniqueBuckets}
						</p>
					</div>
					<div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
						<svg
							className="w-6 h-6 text-purple-600 dark:text-purple-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<title>Trackers Icon</title>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
					</div>
				</div>
			</div>
		</>
	);
}
