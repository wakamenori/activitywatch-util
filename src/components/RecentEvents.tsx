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

interface RecentEventsProps {
	events: Event[];
}

export function RecentEvents({ events }: RecentEventsProps) {
	const formatDuration = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${secs}s`;
		}
		return `${secs}s`;
	};

	const formatTimestamp = (timestamp: Date) => {
		const date = new Date(timestamp);
		return date.toLocaleString("ja-JP", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	};

	const parseEventData = (datastr: string) => {
		try {
			return JSON.parse(datastr);
		} catch {
			return {};
		}
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
					Recent Events
				</h2>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead className="bg-gray-50 dark:bg-gray-700">
						<tr>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Timestamp
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Tracker
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Duration
							</th>
							<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
								Details
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
						{events.map((event) => {
							const data = parseEventData(event.datastr);
							return (
								<tr
									key={event.id}
									className="hover:bg-gray-50 dark:hover:bg-gray-700"
								>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
										{formatTimestamp(event.timestamp)}
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<div className="text-sm text-gray-900 dark:text-gray-100">
											{event.bucketmodel.id}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											{event.bucketmodel.type}
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
										{formatDuration(Number(event.duration))}
									</td>
									<td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
										<div className="max-w-xs truncate">
											{data.app || data.title || data.status || "-"}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
