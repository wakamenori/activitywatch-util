"use client";

import { useState } from "react";
import { ActivityAnalysis } from "@/components/ActivityAnalysis";
import { HourlyTimeline } from "@/components/HourlyTimeline";

export default function TimelinePage() {
	const [timeRange, setTimeRange] = useState('60m');

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="container mx-auto px-4 py-8">
				<HourlyTimeline 
					timeRange={timeRange}
					onTimeRangeChange={setTimeRange}
				/>
				<ActivityAnalysis timeRange={timeRange} />
			</div>
		</div>
	);
}
