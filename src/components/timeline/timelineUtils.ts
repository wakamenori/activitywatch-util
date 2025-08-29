import type { TimelineEvent, TimelineTrack } from "./TimelineTypes";

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

// App category detection for `currentwindow`
export type AppCategory =
	| "Browser"
	| "Editor"
	| "Terminal"
	| "Communication"
	| "Design"
	| "Media"
	| "Docs"
	| "DevTools"
	| "File"
	| "System"
	| "Other";

export const CATEGORY_COLORS: Record<AppCategory, string> = {
	Browser: "#3B82F6", // blue-500
	Editor: "#8B5CF6", // violet-500
	Terminal: "#7C3AED", // violet-600
	Communication: "#F59E0B", // amber-500
	Design: "#EC4899", // pink-500
	Media: "#EF4444", // red-500
	Docs: "#84CC16", // lime-500
	DevTools: "#06B6D4", // cyan-500
	File: "#6366F1", // indigo-500
	System: "#64748B", // slate-500
	Other: "#6B7280", // gray-500
};

export const CATEGORIES: AppCategory[] = [
	"Browser",
	"Editor",
	"Terminal",
	"Communication",
	"Design",
	"Media",
	"Docs",
	"DevTools",
	"File",
	"System",
	"Other",
];

export const detectAppCategory = (app: string, title: string): AppCategory => {
	const a = app.toLowerCase();
	const t = title.toLowerCase();

	// Browsers
	if (
		/(chrome|arc|safari|firefox|vivaldi|edge|brave)/.test(a) ||
		/(chrome|arc|safari|firefox|vivaldi|edge|brave)/.test(t)
	) {
		return "Browser";
	}

	// Editors / IDEs
	if (
		/(code|cursor|vscode|webstorm|intellij|pycharm|goland|xcode|sublime)/.test(
			a,
		) ||
		/(code|cursor|vscode|webstorm|intellij|xcode)/.test(t)
	) {
		return "Editor";
	}

	// Terminals
	if (
		/(terminal|iterm|alacritty|wezterm|warp|kitty|hyper)/.test(a) ||
		/(terminal|iterm|alacritty|wezterm|warp|kitty|hyper)/.test(t)
	) {
		return "Terminal";
	}

	// Communication
	if (
		/(slack|discord|teams|zoom|skype|meet|line)/.test(a) ||
		/(slack|discord|teams|zoom|skype|meet|line)/.test(t)
	) {
		return "Communication";
	}

	// Design
	if (
		/(figma|sketch|photoshop|illustrator|xd|affinity)/.test(a) ||
		/(figma|sketch|photoshop|illustrator|xd|affinity)/.test(t)
	) {
		return "Design";
	}

	// Media
	if (/spotify|music|vlc|quicktime|itunes/.test(a) || /spotify|music/.test(t)) {
		return "Media";
	}

	// Docs / Office
	if (
		/(word|excel|powerpoint|onenote|pages|numbers|keynote|preview|acrobat|notion)/.test(
			a,
		) ||
		/(word|excel|powerpoint|pages|numbers|keynote|preview|acrobat|notion)/.test(
			t,
		)
	) {
		return "Docs";
	}

	// DevTools
	if (
		/(postman|insomnia|docker|studio 3t)/.test(a) ||
		/(postman|insomnia)/.test(t)
	) {
		return "DevTools";
	}

	// File manager
	if (/(finder|explorer)/.test(a) || /(finder|explorer)/.test(t)) {
		return "File";
	}

	// System
	if (/system settings|settings|preferences/.test(t)) {
		return "System";
	}

	return "Other";
};

export const getColorForCategory = (category: AppCategory): string => {
	return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
};

export const getColorForEvent = (
	trackType: string,
	event: TimelineEvent,
): string => {
	if (trackType === "currentwindow") {
		const app = (event.data.app as string) || "";
		const title = (event.data.title as string) || "";
		const cat = detectAppCategory(app, title);
		return getColorForCategory(cat);
	}
	return getColorForType(trackType);
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

// Desired track order; others appear after these in original order
const TRACK_ORDER = [
	"afkstatus",
	"currentwindow",
	"web.tab.current",
	"app.editor.activity",
] as const;

export const sortTimelineTracks = (
	tracks: TimelineTrack[],
): TimelineTrack[] => {
	const priorityMap = new Map<string, number>();
	TRACK_ORDER.forEach((t, i) => {
		priorityMap.set(t, i);
	});
	return tracks.slice().sort((a, b) => {
		const pa = priorityMap.get(a.type);
		const pb = priorityMap.get(b.type);
		const ai = pa === undefined ? Number.POSITIVE_INFINITY : pa;
		const bi = pb === undefined ? Number.POSITIVE_INFINITY : pb;
		if (ai !== bi) return ai - bi;
		// Stable-ish fallback: keep original relative order for same priority
		return 0;
	});
};
