import { NextResponse } from "next/server";
import { detectAppCategory } from "@/components/timeline/timelineUtils";
import { activityWatchDB } from "@/lib/database";

type SunburstNode = {
	name: string;
	value?: number;
	children?: SunburstNode[];
};

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const timeRange = searchParams.get("range") || "60m";

		// Validate and parse time range (aligned with timeline API)
		const timeRanges = {
			"30m": 30 * 60 * 1000,
			"60m": 60 * 60 * 1000,
			"120m": 120 * 60 * 1000,
		} as const;

		const rangeMs = timeRanges[timeRange as keyof typeof timeRanges];
		if (!rangeMs) {
			return NextResponse.json(
				{ error: "Invalid time range. Use 30m, 60m, or 120m" },
				{ status: 400 },
			);
		}

		const now = new Date();
		const startTime = new Date(now.getTime() - rangeMs);

		const events = await activityWatchDB.getEventsByTimeRange(startTime, now);

		// Aggregate only currentwindow events into Category -> App -> Title
		type TitleAgg = Map<string, number>; // title -> seconds
		type AppAgg = Map<string, TitleAgg>; // app -> titles
		const agg: Map<string, AppAgg> = new Map(); // category -> apps

		for (const e of events) {
			if (e.bucketmodel?.type !== "currentwindow") continue;
			const duration =
				typeof e.duration === "string" ? parseFloat(e.duration) : e.duration;
			if (!Number.isFinite(duration) || duration <= 0) continue;

			let app = "unknown";
			let title = "unknown";
			try {
				const data = JSON.parse(e.datastr);
				if (data && typeof data === "object") {
					app =
						typeof data.app === "string" && data.app.trim() ? data.app : app;
					title =
						typeof data.title === "string" && data.title.trim()
							? data.title
							: title;
				}
			} catch {
				// ignore parse errors
			}

			const category = detectAppCategory(app, title);

			if (!agg.has(category)) agg.set(category, new Map());
			let apps = agg.get(category);
			if (!apps) {
				apps = new Map();
				agg.set(category, apps);
			}
			let titles = apps.get(app);
			if (!titles) {
				titles = new Map();
				apps.set(app, titles);
			}
			titles.set(title, (titles.get(title) || 0) + duration);
		}

		// Helper to build limited children with "Other" grouping
		const toLimitedChildren = (
			entries: [string, number][],
			limit: number,
		): SunburstNode[] => {
			if (entries.length <= limit) {
				return entries.map(([name, value]) => ({ name, value }));
			}
			const sorted = entries.sort((a, b) => b[1] - a[1]);
			const top = sorted
				.slice(0, limit)
				.map(([name, value]) => ({ name, value }));
			const other = sorted.slice(limit).reduce((sum, [, v]) => sum + v, 0);
			if (other > 0) top.push({ name: "Other", value: other });
			return top;
		};

		// Build sunburst structure
		// Limits chosen to keep the chart legible
        const TITLE_LIMIT = 4;
        const APP_LIMIT = 6;

		const root: SunburstNode = { name: "Activity", children: [] };
		for (const [category, apps] of agg.entries()) {
			// App-level totals and nodes
			const appTotals: [string, number][] = [];
			const appChildren: SunburstNode[] = [];
			for (const [app, titles] of apps.entries()) {
				const titleEntries = Array.from(titles.entries());
				const total = titleEntries.reduce((sum, [, v]) => sum + v, 0);
				appTotals.push([app, total]);
				const titleChildren = toLimitedChildren(titleEntries, TITLE_LIMIT);
				appChildren.push({ name: app, children: titleChildren });
			}

			// Limit apps and add "Other" if needed
			const topApps = appTotals
				.sort((a, b) => b[1] - a[1])
				.slice(0, APP_LIMIT)
				.map(([a]) => a);
			const children: SunburstNode[] = [];
			let otherAppsTotal = 0;
			for (const node of appChildren) {
				if (topApps.includes(node.name)) {
					children.push(node);
				} else {
					// Sum entire app into Other
					const total = (node.children || []).reduce(
						(sum, c) => sum + (c.value || 0),
						0,
					);
					otherAppsTotal += total;
				}
			}
			if (otherAppsTotal > 0)
				children.push({ name: "Other", value: otherAppsTotal });

			root.children?.push({ name: category, children });
		}

		// Sort categories by total desc for stable visuals
		root.children?.sort((a, b) => {
			const at = (a.children || []).reduce(
				(s, n) =>
					s +
					(n.value ??
						(n.children || []).reduce((ss, t) => ss + (t.value || 0), 0)),
				0,
			);
			const bt = (b.children || []).reduce(
				(s, n) =>
					s +
					(n.value ??
						(n.children || []).reduce((ss, t) => ss + (t.value || 0), 0)),
				0,
			);
			return bt - at;
		});

		return NextResponse.json({
			range: timeRange,
			startTime,
			endTime: now,
			root,
		});
	} catch (error) {
		console.error("Error building activity sunburst:", error);
		return NextResponse.json(
			{ error: "Failed to build activity sunburst" },
			{ status: 500 },
		);
	}
}
