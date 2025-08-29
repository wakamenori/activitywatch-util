export interface TimelineEvent {
	id: number;
	start: string;
	end: string;
	duration: number;
	bucketType: string;
	bucket: string;
	data: Record<string, unknown>;
}

export interface TimelineTrack {
	type: string;
	events: TimelineEvent[];
}

export interface TimelineData {
	timeline: TimelineTrack[];
	startTime: string;
	endTime: string;
	timeRange: string;
	totalEvents: number;
}

export interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
	event: TimelineEvent | null;
}

export interface HourlyTimelineProps {
	timeRange?: string;
	onTimeRangeChange?: (range: string) => void;
}
