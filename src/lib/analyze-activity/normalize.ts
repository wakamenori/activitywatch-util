import type { EventModel } from "@/types/activitywatch";

export type Category =
	| "coding"
	| "browsing"
	| "communication"
	| "terminal"
	| "media"
	| "settings"
	| "afk"
	| "other";

export type NormalizedEvent = {
	start: Date;
	end: Date;
	durationSec: number;
	bucketType: string;
	app?: string | null;
	url?: string | null;
	domain?: string | null;
	title?: string | null;
	project?: string | null;
	file?: string | null;
	language?: string | null;
	slackChannel?: string | null;
	slackWorkspace?: string | null;
	category: Category;
};

export function parseJsonSafe(input: string): Record<string, unknown> | null {
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
}

export function extractDomain(url?: string | null): string | null {
	if (!url) return null;
	try {
		const u = new URL(url);
		return u.hostname.toLowerCase();
	} catch {
		const m = url.match(/^https?:\/\/([^/:?#]+)/i);
		return m ? m[1].toLowerCase() : null;
	}
}

export function parseCursorTitle(title?: string | null): {
	file?: string;
	project?: string;
	isSettings?: boolean;
	isExtension?: boolean;
} {
	if (!title) return {};
	// Patterns: "filename — project", "Settings — project", "Extension: name — project"
	const settings = title.match(/^Settings\s+—\s+(.+)$/);
	if (settings) return { project: settings[1], isSettings: true };
	const ext = title.match(/^Extension:\s*([^\n]+?)\s+—\s+(.+)$/);
	if (ext) return { file: ext[1], project: ext[2], isExtension: true };
	const m = title.match(/^(.+?)\s+—\s+(.+)$/);
	if (m) {
		return { file: m[1], project: m[2] };
	}
	return {};
}

export function parseSlackTitle(title?: string | null): {
	channel?: string;
	workspace?: string;
} {
	if (!title) return {};
	// Japanese UI examples:
	// "matching_all（チャンネル） - Algomatic - Slack"
	let m = title.match(
		/^(.+?)（(?:チャンネル|スレッド|ダイレクトメッセージ)）\s+-\s+(.+?)\s+-\s+Slack$/,
	);
	if (m) return { channel: m[1], workspace: m[2] };
	// Fallback English UI: "#general - Org - Slack"
	m = title.match(/^(.+?)\s+-\s+(.+?)\s+-\s+Slack$/);
	if (m) return { channel: m[1], workspace: m[2] };
	return {};
}

export function categorizeFrom(
	type: string,
	app?: string | null,
	domain?: string | null,
	title?: string | null,
): Category {
	const appL = (app || "").toLowerCase();
	const domL = (domain || "").toLowerCase();
	const titleL = (title || "").toLowerCase();
	if (type === "app.editor.activity") return "coding";
	if (type === "web.tab.current") {
		if (domL.endsWith("youtube.com") || /- youtube$/.test(titleL))
			return "media";
		return "browsing";
	}
	if (type === "afkstatus") return "afk";
	if (type === "git.commit") return "coding";
	if (type === "currentwindow") {
		if (appL.includes("slack")) return "communication";
		if (appL.includes("iterm") || appL.includes("terminal")) return "terminal";
		if (
			appL.includes("arc") ||
			appL.includes("chrome") ||
			appL.includes("safari")
		)
			return "browsing";
		if (appL.includes("cursor") || appL.includes("code")) {
			// Heuristic: settings/extension views count as settings
			if (/^settings\s+—/i.test(titleL) || /^extension:/i.test(titleL))
				return "settings";
			return "coding";
		}
	}
	return "other";
}

export function normalizeEvent(e: EventModel): NormalizedEvent | null {
	const duration =
		typeof e.duration === "string" ? Number.parseFloat(e.duration) : e.duration;
	if (!Number.isFinite(duration) || duration <= 0) return null;
	const start = e.timestamp;
	const end = new Date(start.getTime() + Math.floor(duration * 1000));
	const type = e.bucketmodel?.type || "unknown";
	const data = parseJsonSafe(e.datastr) || {};
	const app = typeof data.app === "string" ? (data.app as string) : null;
	const title = typeof data.title === "string" ? (data.title as string) : null;
	const url = typeof data.url === "string" ? (data.url as string) : null;
	const domain = extractDomain(url);

	let project: string | null = null;
	let file: string | null = null;
	let language: string | null = null;
	let slackChannel: string | null = null;
	let slackWorkspace: string | null = null;

	if (type === "app.editor.activity") {
		if (typeof (data as Record<string, unknown>).project === "string")
			project = (data as Record<string, unknown>).project as string;
		if (typeof (data as Record<string, unknown>).file === "string")
			file = (data as Record<string, unknown>).file as string;
		if (typeof (data as Record<string, unknown>).language === "string")
			language = (data as Record<string, unknown>).language as string;
	} else if (type === "currentwindow" && app && title) {
		if (/cursor/i.test(app)) {
			const p = parseCursorTitle(title);
			project = p.project || null;
			file = p.file || null;
		}
		if (/slack/i.test(app)) {
			const s = parseSlackTitle(title);
			slackChannel = s.channel || null;
			slackWorkspace = s.workspace || null;
		}
	}

	const category = categorizeFrom(type, app, domain, title);

	return {
		start,
		end,
		durationSec: Math.floor(duration),
		bucketType: type,
		app,
		url,
		domain,
		title,
		project,
		file,
		language,
		slackChannel,
		slackWorkspace,
		category,
	};
}
