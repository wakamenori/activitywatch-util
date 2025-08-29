import { relative } from "node:path";

export function formatDuration(seconds: number): string {
	const totalSeconds = Math.floor(seconds);
	const minutes = Math.floor(totalSeconds / 60);
	const secs = totalSeconds % 60;

	if (minutes > 0) {
		return secs > 0 ? `${minutes}m${secs}s` : `${minutes}m`;
	}
	return `${secs}s`;
}

export function formatTimestampToJST(date: Date): string {
	return date.toLocaleTimeString("ja-JP", {
		timeZone: "Asia/Tokyo",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

export function escapeXML(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export function basenameMaybe(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.replace(/[/\\]+$/, "");
	const parts = trimmed.split(/[\\/]/);
	const name = parts[parts.length - 1];
	return name || trimmed;
}

export function normalizePathLike(value: string): string {
	// Convert Windows separators to POSIX-style and trim trailing separators
	return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function fileRelativeToProjectMaybe(
	fileVal: unknown,
	projectVal: unknown,
): string | null {
	if (typeof fileVal !== "string" || typeof projectVal !== "string")
		return null;
	const file = normalizePathLike(fileVal);
	const project = normalizePathLike(projectVal);
	if (!file || !project) return null;
	// If file is under project, return clean relative path
	if (file.startsWith(`${project}/`)) {
		return file.slice(project.length + 1);
	}
	// Fallback: try Node's relative (may produce ../..). If it climbs out, prefer basename.
	const rel = relative(project, file);
	if (!rel.startsWith("..")) return rel;
	return basenameMaybe(file) || null;
}
