import type { EventModel } from "@/types/activitywatch";
import { formatDuration } from "./format";
import { type NormalizedEvent, normalizeEvent } from "./normalize";

export function addTo(
	map: Map<string, number>,
	key: string | null | undefined,
	val: number,
) {
	if (!key) return;
	map.set(key, (map.get(key) || 0) + val);
}

export function topN(
	map: Map<string, number>,
	n: number,
): Array<{ key: string; seconds: number }> {
	return [...map.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([key, seconds]) => ({ key, seconds }));
}

export function bucketTimeBy(
	events: NormalizedEvent[],
	minutes: number,
): { start: Date; seconds: number } | null {
	if (events.length === 0) return null;
	const bucketMs = minutes * 60 * 1000;
	const buckets = new Map<number, number>();
	for (const ev of events) {
		const t = Math.floor(ev.start.getTime() / bucketMs) * bucketMs;
		buckets.set(t, (buckets.get(t) || 0) + ev.durationSec);
	}
	let best: [number, number] | null = null;
	for (const [t, sec] of buckets) {
		if (!best || sec > best[1]) best = [t, sec];
	}
	if (!best) return null;
	return { start: new Date(best[0]), seconds: best[1] };
}

export function formatKVList(
	pairs: Array<{ key: string; seconds: number }>,
): string {
	return pairs.map((p) => `${p.key} ${formatDuration(p.seconds)}`).join(", ");
}

export type Stats = ReturnType<typeof computeStats>;

export function computeStats(events: EventModel[], rangeMs: number) {
	const normalized: NormalizedEvent[] = [];
	for (const e of events) {
		const n = normalizeEvent(e);
		if (n) normalized.push(n);
	}

	const byBucket = new Map<string, number>();
	const byCategory = new Map<string, number>();
	const byApp = new Map<string, number>();
	const byProject = new Map<string, number>();
	const byFile = new Map<string, number>();
	const byLanguage = new Map<string, number>();
	const byDomain = new Map<string, number>();
	const bySlackChannel = new Map<string, number>();

	let totalSeconds = 0;
	let localDevSeconds = 0;

	for (const ev of normalized) {
		totalSeconds += ev.durationSec;
		addTo(byBucket, ev.bucketType, ev.durationSec);
		addTo(byCategory, ev.category, ev.durationSec);
		// App grouping: editor events as "Editor" to avoid double counting with Cursor title
		const appKey =
			ev.bucketType === "app.editor.activity" ? "Editor" : ev.app || "unknown";
		addTo(byApp, appKey, ev.durationSec);
		addTo(byProject, ev.project, ev.durationSec);
		addTo(byFile, ev.file, ev.durationSec);
		addTo(byLanguage, ev.language, ev.durationSec);
		addTo(byDomain, ev.domain, ev.durationSec);
		addTo(bySlackChannel, ev.slackChannel, ev.durationSec);

		// Heuristics for local development
		if (
			ev.domain === "localhost" ||
			(ev.title && /—\s*activitywatch-util/i.test(ev.title)) ||
			(ev.project && /activitywatch-util/i.test(ev.project))
		) {
			localDevSeconds += ev.durationSec;
		}
	}

	// Switch counts and focus streaks (by category and by appKey)
	let switchesCat = 0;
	let switchesApp = 0;
	let longestCat = { label: "", seconds: 0 } as {
		label: string;
		seconds: number;
	};
	let longestApp = { label: "", seconds: 0 } as {
		label: string;
		seconds: number;
	};
	let curCatLabel: string | null = null;
	let curCatAccum = 0;
	let curAppLabel: string | null = null;
	let curAppAccum = 0;

	for (const ev of normalized.sort(
		(a, b) => a.start.getTime() - b.start.getTime(),
	)) {
		const appKey =
			ev.bucketType === "app.editor.activity" ? "Editor" : ev.app || "unknown";
		// Category streaks
		if (curCatLabel === null) {
			curCatLabel = ev.category;
			curCatAccum = ev.durationSec;
		} else if (curCatLabel === ev.category) {
			curCatAccum += ev.durationSec;
		} else {
			// switch
			switchesCat++;
			if (curCatAccum > longestCat.seconds)
				longestCat = { label: curCatLabel, seconds: curCatAccum };
			curCatLabel = ev.category;
			curCatAccum = ev.durationSec;
		}
		// App streaks
		if (curAppLabel === null) {
			curAppLabel = appKey;
			curAppAccum = ev.durationSec;
		} else if (curAppLabel === appKey) {
			curAppAccum += ev.durationSec;
		} else {
			switchesApp++;
			if (curAppAccum > longestApp.seconds)
				longestApp = { label: curAppLabel, seconds: curAppAccum };
			curAppLabel = appKey;
			curAppAccum = ev.durationSec;
		}
	}
	if (curCatLabel && curCatAccum > longestCat.seconds)
		longestCat = { label: curCatLabel, seconds: curCatAccum };
	if (curAppLabel && curAppAccum > longestApp.seconds)
		longestApp = { label: curAppLabel, seconds: curAppAccum };

	const peak10m = bucketTimeBy(normalized, 10);
	const peak5m = bucketTimeBy(normalized, 5);

	const switchDensityPer10m =
		rangeMs > 0 ? switchesCat / (rangeMs / (10 * 60 * 1000)) : 0;

	return {
		totalSeconds,
		byBucket,
		byCategory,
		byApp,
		byProject,
		byFile,
		byLanguage,
		byDomain,
		bySlackChannel,
		switches: { category: switchesCat, app: switchesApp },
		longestFocus: {
			category: longestCat.seconds > 0 ? longestCat : null,
			app: longestApp.seconds > 0 ? longestApp : null,
		},
		peak10m,
		peak5m,
		localDevSeconds,
		switchDensityPer10m,
		normalized,
	};
}
