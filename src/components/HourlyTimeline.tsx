"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TimeAxis } from "./timeline/TimeAxis";
import { TimelineHeader } from "./timeline/TimelineHeader";
import { TimelineStats } from "./timeline/TimelineStats";
import { TimelineTooltip } from "./timeline/TimelineTooltip";
import { TimelineTrackRow } from "./timeline/TimelineTrack";
import type {
	HourlyTimelineProps,
	TimelineData,
	TimelineEvent,
	TooltipState,
} from "./timeline/TimelineTypes";
import { getTimeRangeLabel } from "./timeline/timelineUtils";

export function HourlyTimeline({
	timeRange = "60m",
	onTimeRangeChange,
}: HourlyTimelineProps = {}) {
	const [data, setData] = useState<TimelineData | null>(null);
	const [loading, setLoading] = useState(true);
	const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
	const [tooltip, setTooltip] = useState<TooltipState>({
		visible: false,
		x: 0,
		y: 0,
		event: null,
	});
	const containerRef = useRef<HTMLDivElement>(null);

	const fetchTimeline = useCallback(async () => {
		try {
			const response = await fetch(`/api/timeline?range=${timeRange}`);
			const json = await response.json();
			setData(json);
			setLastUpdate(new Date());
		} catch (error) {
			console.error("Failed to fetch timeline:", error);
		} finally {
			setLoading(false);
		}
	}, [timeRange]);

	useEffect(() => {
		fetchTimeline();
		const interval = setInterval(fetchTimeline, 30000); // Refresh every 30 seconds
		return () => clearInterval(interval);
	}, [fetchTimeline]);

	const handleMouseEnter = (event: TimelineEvent, e: React.MouseEvent) => {
		const rect = containerRef.current?.getBoundingClientRect();
		if (rect) {
			setTooltip({
				visible: true,
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
				event,
			});
		}
	};

	const handleMouseLeave = () => {
		setTooltip((prev) => ({ ...prev, visible: false }));
	};

	const renderTooltip = () => {
		if (!tooltip.visible || !tooltip.event) return null;

		return (
			<TimelineTooltip
				tooltip={tooltip}
				containerWidth={containerRef.current?.clientWidth || 0}
			/>
		);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">Loading timeline...</div>
			</div>
		);
	}

	if (!data) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-gray-500">No data available</div>
			</div>
		);
	}

	const startTime = new Date(data.startTime);
	const endTime = new Date(data.endTime);
	const totalDuration = endTime.getTime() - startTime.getTime();

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
			<TimelineHeader
				timeRange={timeRange}
				lastUpdate={lastUpdate}
				onTimeRangeChange={onTimeRangeChange}
				label={`直近${getTimeRangeLabel(timeRange)}のタイムライン`}
			/>

			<TimeAxis startTime={data.startTime} />

			<div className="space-y-4 relative" ref={containerRef}>
				{data.timeline.map((track) => (
					<TimelineTrackRow
						key={track.type}
						track={track}
						startTime={startTime}
						totalDuration={totalDuration}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
					/>
				))}
				{renderTooltip()}
			</div>

			<TimelineStats
				totalEvents={data.totalEvents}
				timeRangeLabel={getTimeRangeLabel(timeRange)}
				tracksCount={data.timeline.length}
			/>
		</div>
	);
}
