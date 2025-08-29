"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

interface TimelineEvent {
	id: number;
	start: string;
	end: string;
	duration: number;
	bucketType: string;
	bucket: string;
	data: Record<string, unknown>;
}

interface TimelineTrack {
	type: string;
	events: TimelineEvent[];
}

interface TimelineData {
	timeline: TimelineTrack[];
	startTime: string;
	endTime: string;
	timeRange: string;
	totalEvents: number;
}

interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
	event: TimelineEvent | null;
}

interface HourlyTimelineProps {
	timeRange?: string;
	onTimeRangeChange?: (range: string) => void;
}

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
	const selectId = useId();

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

	const getColorForType = (type: string): string => {
		const colors: Record<string, string> = {
			currentwindow: "#3B82F6", // blue
			"web.tab.current": "#10B981", // green
			afkstatus: "#FCD34D", // yellow
			"app.editor.activity": "#8B5CF6", // purple
			"general.stopwatch": "#EC4899", // pink
		};
		return colors[type] || "#6B7280"; // gray as default
	};

	const formatTime = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleTimeString("ja-JP", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const formatDuration = (seconds: number) => {
		if (seconds < 60) return `${Math.round(seconds)}秒`;
		return `${Math.round(seconds / 60)}分`;
	};

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

		const event = tooltip.event;
		const app = (event.data.app as string) || "";
		const title = (event.data.title as string) || "";
		const status = (event.data.status as string) || "";

		return (
			<div
				className="absolute z-50 bg-gray-900 text-white text-sm rounded-lg shadow-lg p-3 pointer-events-none max-w-xs"
				style={{
					left: Math.min(
						tooltip.x + 10,
						(containerRef.current?.clientWidth || 0) - 320,
					),
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

	const getTimeRangeLabel = (range: string): string => {
		switch (range) {
			case "30m":
				return "30分";
			case "60m":
				return "1時間";
			case "120m":
				return "2時間";
			default:
				return "1時間";
		}
	};

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
			<div className="flex justify-between items-center mb-4">
				<div className="flex items-center gap-4">
					<h2 className="text-2xl font-bold text-gray-900 dark:text-white">
						直近{getTimeRangeLabel(timeRange)}のタイムライン
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

			{/* Time axis */}
			<div className="mb-2">
				<div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
					<span>{formatTime(data.startTime)}</span>
					<span>現在</span>
				</div>
			</div>

			{/* Timeline tracks */}
			<div className="space-y-4 relative" ref={containerRef}>
				{data.timeline.map((track) => (
					<div key={track.type} className="relative">
						<div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
							{track.type}
						</div>
						<div className="relative h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
							{track.events.map((event) => {
								const eventStart = new Date(event.start);
								const eventEnd = new Date(event.end);
								const left =
									((eventStart.getTime() - startTime.getTime()) /
										totalDuration) *
									100;
								const width =
									((eventEnd.getTime() - eventStart.getTime()) /
										totalDuration) *
									100;

								// Skip events that are too small to display
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
										onMouseEnter={(e) => handleMouseEnter(event, e)}
										onMouseLeave={handleMouseLeave}
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
				))}
				{renderTooltip()}
			</div>

			{/* Statistics */}
			<div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
				<div className="grid grid-cols-3 gap-4 text-sm">
					<div>
						<div className="text-gray-500 dark:text-gray-400">総イベント数</div>
						<div className="text-lg font-semibold text-gray-900 dark:text-white">
							{data.totalEvents}
						</div>
					</div>
					<div>
						<div className="text-gray-500 dark:text-gray-400">記録期間</div>
						<div className="text-lg font-semibold text-gray-900 dark:text-white">
							{getTimeRangeLabel(timeRange)}
						</div>
					</div>
					<div>
						<div className="text-gray-500 dark:text-gray-400">トラック数</div>
						<div className="text-lg font-semibold text-gray-900 dark:text-white">
							{data.timeline.length}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
