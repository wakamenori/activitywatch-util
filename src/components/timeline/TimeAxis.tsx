import { formatTime } from "./timelineUtils";

interface TimeAxisProps {
	startTime: string;
	endLabel?: string;
}

export function TimeAxis({ startTime, endLabel = "現在" }: TimeAxisProps) {
	return (
		<div className="mb-2">
			<div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
				<span>{formatTime(startTime)}</span>
				<span>{endLabel}</span>
			</div>
		</div>
	);
}
