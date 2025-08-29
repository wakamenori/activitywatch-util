"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TimeAxis } from "./timeline/TimeAxis";
import { TimelineHeader } from "./timeline/TimelineHeader";
import { TimelineLegend } from "./timeline/TimelineLegend";
import { TimelineStats } from "./timeline/TimelineStats";
import { TimelineTooltip } from "./timeline/TimelineTooltip";
import { TimelineTrackRow } from "./timeline/TimelineTrack";
import type {
	HourlyTimelineProps,
	TimelineData,
	TimelineEvent,
	TooltipState,
} from "./timeline/TimelineTypes";
import {
	CATEGORIES,
	detectAppCategory,
	getColorForCategory,
	getTimeRangeLabel,
	sortTimelineTracks,
} from "./timeline/timelineUtils";

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

	// Build legend from currentwindow categories present in data
	const currentWindowTrack = data.timeline.find(
		(t) => t.type === "currentwindow",
	);
	const usedCategories = new Set<string>();
	if (currentWindowTrack) {
		for (const e of currentWindowTrack.events) {
			const app = (e.data.app as string) || "";
			const title = (e.data.title as string) || "";
			const cat = detectAppCategory(app, title);
			usedCategories.add(cat);
		}
	}
	const legendItems = CATEGORIES.filter((c) => usedCategories.has(c)).map(
		(c) => ({
			label: c,
			color: getColorForCategory(c),
		}),
	);

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
			<TimelineHeader
				timeRange={timeRange}
				lastUpdate={lastUpdate}
				onTimeRangeChange={onTimeRangeChange}
				label={`直近${getTimeRangeLabel(timeRange)}のタイムライン`}
			/>

			<TimeAxis startTime={data.startTime} />

			{/* Legend for currentwindow categories */}
			<TimelineLegend items={legendItems} />

			<div className="space-y-4 relative" ref={containerRef}>
				{sortTimelineTracks(data.timeline).map((track) => (
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
