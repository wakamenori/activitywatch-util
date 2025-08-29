import type { TimelineEvent, TimelineTrack } from "./TimelineTypes";
import { getColorForType } from "./timelineUtils";

interface TimelineTrackProps {
	track: TimelineTrack;
	startTime: Date;
	totalDuration: number;
	onMouseEnter: (event: TimelineEvent, e: React.MouseEvent) => void;
	onMouseLeave: () => void;
}

export function TimelineTrackRow({
	track,
	startTime,
	totalDuration,
	onMouseEnter,
	onMouseLeave,
}: TimelineTrackProps) {
	return (
		<div className="relative">
			<div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				{track.type}
			</div>
			<div className="relative h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
				{track.events.map((event) => {
					const eventStart = new Date(event.start);
					const eventEnd = new Date(event.end);
					const left =
						((eventStart.getTime() - startTime.getTime()) / totalDuration) *
						100;
					const width =
						((eventEnd.getTime() - eventStart.getTime()) / totalDuration) * 100;

					if (width < 0.1) return null;

					return (
						<div
							key={event.id}
							role="tooltip"
							className="absolute top-0 h-full flex items-center justify-center text-white text-xs font-medium px-1 overflow-hidden cursor-pointer hover:opacity-90"
							style={{
								left: `${left}%`,
								width: `${width}%`,
								backgroundColor: getColorForType(track.type),
							}}
							onMouseEnter={(e) => onMouseEnter(event, e)}
							onMouseLeave={onMouseLeave}
						>
							<span className="truncate">
								{(event.data.app as string) ||
									(event.data.title as string) ||
									(event.data.status as string) ||
									track.type}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
