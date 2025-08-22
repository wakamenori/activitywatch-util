"use client";

interface Bucket {
	key: number;
	id: string;
	created: Date;
	name: string | null;
	type: string;
	client: string;
	hostname: string;
}

interface BucketListProps {
	buckets: Bucket[];
}

export function BucketList({ buckets }: BucketListProps) {
	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString("ja-JP", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	};

	const getTypeColor = (type: string) => {
		const colors: Record<string, string> = {
			afkstatus:
				"bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
			currentwindow:
				"bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
			"web.tab.current":
				"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
			"app.editor.activity":
				"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
		};
		return (
			colors[type] ||
			"bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
		);
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
					Activity Trackers (Buckets)
				</h2>
			</div>
			<div className="p-6">
				<div className="space-y-4">
					{buckets.map((bucket) => (
						<div
							key={bucket.key}
							className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
						>
							<div className="flex items-start justify-between">
								<div className="flex-1">
									<h3 className="text-sm font-medium text-gray-900 dark:text-white">
										{bucket.id}
									</h3>
									<p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
										{bucket.name || "No name"}
									</p>
									<div className="flex items-center gap-2 mt-2">
										<span
											className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(bucket.type)}`}
										>
											{bucket.type}
										</span>
										<span className="text-xs text-gray-500 dark:text-gray-400">
											Client: {bucket.client}
										</span>
									</div>
								</div>
								<div className="text-right">
									<p className="text-xs text-gray-500 dark:text-gray-400">
										Created
									</p>
									<p className="text-sm text-gray-900 dark:text-white">
										{formatDate(bucket.created)}
									</p>
								</div>
							</div>
							<div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
								Host: {bucket.hostname}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
