export const getColorForType = (type: string): string => {
	const colors: Record<string, string> = {
		currentwindow: "#3B82F6",
		"web.tab.current": "#10B981",
		afkstatus: "#FCD34D",
		"app.editor.activity": "#8B5CF6",
		"general.stopwatch": "#EC4899",
	};
	return colors[type] || "#6B7280";
};

export const formatTime = (dateString: string) => {
	const date = new Date(dateString);
	return date.toLocaleTimeString("ja-JP", {
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const formatDuration = (seconds: number) => {
	if (seconds < 60) return `${Math.round(seconds)}秒`;
	return `${Math.round(seconds / 60)}分`;
};

export const getTimeRangeLabel = (range: string): string => {
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
