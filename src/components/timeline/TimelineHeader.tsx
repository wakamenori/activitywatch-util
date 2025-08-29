"use client";

import { useId } from "react";

interface TimelineHeaderProps {
	timeRange: string;
	lastUpdate: Date;
	onTimeRangeChange?: (range: string) => void;
	label: string;
}

export function TimelineHeader({
	timeRange,
	lastUpdate,
	onTimeRangeChange,
	label,
}: TimelineHeaderProps) {
	const selectId = useId();
	return (
		<div className="flex justify-between items-center mb-4">
			<div className="flex items-center gap-4">
				<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
					{label}
				</h2>
			</div>
			<div className="flex items-center gap-4">
				{onTimeRangeChange && (
					<div className="flex items-center gap-2">
						<label
							htmlFor={selectId}
							className="text-sm text-gray-600 dark:text-gray-400"
						>
							期間:
						</label>
						<select
							id={selectId}
							value={timeRange}
							onChange={(e) => onTimeRangeChange(e.target.value)}
							className="text-sm border rounded px-3 py-1 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
						>
							<option value="30m">30分</option>
							<option value="60m">1時間</option>
							<option value="120m">2時間</option>
						</select>
					</div>
				)}
				<div className="text-sm text-gray-500 dark:text-gray-400">
					最終更新: {lastUpdate.toLocaleTimeString("ja-JP")}
				</div>
			</div>
		</div>
	);
}
