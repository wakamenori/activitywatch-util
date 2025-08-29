import type { TooltipState } from "./TimelineTypes";
import { formatDuration, formatTime } from "./timelineUtils";

interface TimelineTooltipProps {
	tooltip: TooltipState;
	containerWidth: number;
}

export function TimelineTooltip({
	tooltip,
	containerWidth,
}: TimelineTooltipProps) {
	if (!tooltip.visible || !tooltip.event) return null;

	const event = tooltip.event;
	const app = (event.data.app as string) || "";
	const title = (event.data.title as string) || "";
	const status = (event.data.status as string) || "";

	return (
		<div
			className="absolute z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
			style={{
				left: Math.min(tooltip.x + 10, containerWidth - 320),
				top: tooltip.y - 10,
			}}
		>
			<div className="space-y-1">
				<div className="font-semibold text-blue-300">
					{formatTime(event.start)} - {formatTime(event.end)}
				</div>
				<div className="text-gray-300">
					継続時間: {formatDuration(event.duration)}
				</div>
				{app && (
					<div>
						<span className="text-gray-400">アプリ:</span> {app}
					</div>
				)}
				{title && (
					<div>
						<span className="text-gray-400">タイトル:</span> {title}
					</div>
				)}
				{status && (
					<div>
						<span className="text-gray-400">状態:</span> {status}
					</div>
				)}
			</div>
		</div>
	);
}
