import { ActivityAnalysis } from "@/components/ActivityAnalysis";
import { HourlyTimeline } from "@/components/HourlyTimeline";

export default function TimelinePage() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<div className="container mx-auto px-4 py-8">
				<HourlyTimeline />
				<ActivityAnalysis />
			</div>
		</div>
	);
}
