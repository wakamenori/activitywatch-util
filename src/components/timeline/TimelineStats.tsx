interface TimelineStatsProps {
	totalEvents: number;
	timeRangeLabel: string;
	tracksCount: number;
}

export function TimelineStats({
	totalEvents,
	timeRangeLabel,
	tracksCount,
}: TimelineStatsProps) {
	return (
		<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
			<div className="grid grid-cols-3 gap-4 text-sm">
				<div>
					<div className="text-gray-500 dark:text-gray-400">総イベント数</div>
					<div className="text-lg font-semibold text-gray-900 dark:text-white">
						{totalEvents}
					</div>
				</div>
				<div>
					<div className="text-gray-500 dark:text-gray-400">記録期間</div>
					<div className="text-lg font-semibold text-gray-900 dark:text-white">
						{timeRangeLabel}
					</div>
				</div>
				<div>
					<div className="text-gray-500 dark:text-gray-400">トラック数</div>
					<div className="text-lg font-semibold text-gray-900 dark:text-white">
						{tracksCount}
					</div>
				</div>
			</div>
		</div>
	);
}
