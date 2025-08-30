import type { EventModel } from "@/types/activitywatch";
import {
	basenameMaybe,
	escapeXML,
	fileRelativeToProjectMaybe,
	formatDuration,
	formatTimestampToJST,
} from "./format";
import type { FileSnapshot } from "./git";
import type { Stats } from "./stats";
import { formatKVList, topN } from "./stats";

export function formatActivityDataAsXML(events: EventModel[]): string {
	const lines: string[] = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		"<events>",
	];

	for (const event of events) {
		const duration =
			typeof event.duration === "string"
				? parseFloat(event.duration)
				: event.duration;

		const timestamp = formatTimestampToJST(event.timestamp);
		const formattedDuration = formatDuration(duration);
		const type = event.bucketmodel?.type || "unknown";

		const parts: string[] = [];
		parts.push(`<timestamp>${escapeXML(timestamp)}</timestamp>`);
		parts.push(`<duration>${escapeXML(formattedDuration)}</duration>`);
		parts.push(`<type>${escapeXML(type)}</type>`);

		// Build data section inline (no newlines) based on type
		let dataInner = "";
		try {
			const data = JSON.parse(event.datastr);
			if (type === "currentwindow") {
				if (data.app) dataInner += `<app>${escapeXML(data.app)}</app>`;
				if (data.title) dataInner += `<title>${escapeXML(data.title)}</title>`;
			} else if (type === "web.tab.current") {
				if (data.url) dataInner += `<url>${escapeXML(data.url)}</url>`;
				if (data.title) dataInner += `<title>${escapeXML(data.title)}</title>`;
			} else if (type === "afkstatus") {
				if (data.status)
					dataInner += `<status>${escapeXML(data.status)}</status>`;
			} else if (type === "app.editor.activity") {
				if (data.file) {
					const rel = fileRelativeToProjectMaybe(data.file, data.project);
					const fileOut = rel || basenameMaybe(data.file) || String(data.file);
					dataInner += `<file>${escapeXML(fileOut)}</file>`;
				}
				if (data.language)
					dataInner += `<language>${escapeXML(data.language)}</language>`;
				if (data.project) {
					const projName = basenameMaybe(data.project) || String(data.project);
					dataInner += `<project>${escapeXML(projName)}</project>`;
				}
				if (data.branch)
					dataInner += `<branch>${escapeXML(String(data.branch))}</branch>`;
			} else if (type === "git.commit") {
				// Commit event from git collector
				if ((data as Record<string, unknown>).repo)
					dataInner += `<repo>${escapeXML(String((data as Record<string, unknown>).repo))}</repo>`;
				if ((data as Record<string, unknown>).subject)
					dataInner += `<subject>${escapeXML(String((data as Record<string, unknown>).subject))}</subject>`;
				if ((data as Record<string, unknown>).path)
					dataInner += `<path>${escapeXML(String((data as Record<string, unknown>).path))}</path>`;
				if ((data as Record<string, unknown>).diff)
					dataInner += `<diff>${escapeXML(String((data as Record<string, unknown>).diff))}</diff>`;
			}
		} catch {
			// Invalid JSON, skip data parsing
		}

		parts.push(`<data>${dataInner}</data>`);

		// One <event> per line
		lines.push(`<event>${parts.join("")}</event>`);
	}

	lines.push("</events>");
	return lines.join("\n");
}

export function buildStatsSummaryXML(stats: Stats): string {
	const lines: string[] = ["<stats>"];
	lines.push(
		`<total seconds="${stats.totalSeconds}">${escapeXML(formatDuration(stats.totalSeconds))}</total>`,
	);
	lines.push(
		`<byBucket>${escapeXML(formatKVList(topN(stats.byBucket, 10)))}</byBucket>`,
	);
	lines.push(
		`<byCategory>${escapeXML(formatKVList(topN(stats.byCategory, 10)))}</byCategory>`,
	);
	lines.push(`<apps>${escapeXML(formatKVList(topN(stats.byApp, 5)))}</apps>`);
	lines.push(
		`<projects>${escapeXML(formatKVList(topN(stats.byProject, 5)))}</projects>`,
	);
	lines.push(
		`<languages>${escapeXML(formatKVList(topN(stats.byLanguage, 5)))}</languages>`,
	);
	lines.push(
		`<domains>${escapeXML(formatKVList(topN(stats.byDomain, 5)))}</domains>`,
	);
	lines.push(
		`<slack>${escapeXML(formatKVList(topN(stats.bySlackChannel, 5)))}</slack>`,
	);
	lines.push(
		`<switches category="${stats.switches.category}" app="${stats.switches.app}" densityPer10m="${stats.switchDensityPer10m.toFixed(1)}"/>`,
	);
	if (stats.longestFocus.category)
		lines.push(
			`<longestFocusCategory label="${escapeXML(stats.longestFocus.category.label)}">${escapeXML(formatDuration(stats.longestFocus.category.seconds))}</longestFocusCategory>`,
		);
	if (stats.longestFocus.app)
		lines.push(
			`<longestFocusApp label="${escapeXML(stats.longestFocus.app.label)}">${escapeXML(formatDuration(stats.longestFocus.app.seconds))}</longestFocusApp>`,
		);
	if (stats.peak10m)
		lines.push(
			`<peak10m start="${escapeXML(formatTimestampToJST(stats.peak10m.start))}">${escapeXML(formatDuration(stats.peak10m.seconds))}</peak10m>`,
		);
	if (stats.peak5m)
		lines.push(
			`<peak5m start="${escapeXML(formatTimestampToJST(stats.peak5m.start))}">${escapeXML(formatDuration(stats.peak5m.seconds))}</peak5m>`,
		);
	if (stats.localDevSeconds > 0)
		lines.push(
			`<localDev>${escapeXML(formatDuration(stats.localDevSeconds))}</localDev>`,
		);
	lines.push("</stats>");
	return lines.join("\n");
}

export function formatFileSnapshotsAsXML(
	snapshots: FileSnapshot[],
	which: "before" | "after",
): string {
	const lines: string[] = [`<fileSnapshots kind="${which}">`];
	for (const s of snapshots) {
		const content = which === "before" ? s.before : s.after;
		lines.push(
			`<file repo="${escapeXML(s.repoName)}" path="${escapeXML(s.path)}"><content>${escapeXML(content)}</content></file>`,
		);
	}
	lines.push("</fileSnapshots>");
	return lines.join("\n");
}
