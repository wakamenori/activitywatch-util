import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { BucketModel, EventModel } from "@/types/activitywatch";

const execFileAsync = promisify(execFile);

export type GitChange =
	| { status: "M" | "A" | "D"; path: string }
	| { status: "R"; oldPath: string; newPath: string };

export type GitCommit = {
	hash: string;
	subject: string;
	timestamp: number; // seconds since epoch
	repoPath: string;
	repoName: string;
	diff: string;
	changes: GitChange[];
};

async function isGitRepo(dir: string): Promise<boolean> {
	try {
		const s = await stat(join(dir, ".git"));
		return s.isDirectory();
	} catch {
		return false;
	}
}

async function listReposAtDepth2(root: string): Promise<string[]> {
	const out: string[] = [];
	const level1 = await readdir(root, { withFileTypes: true });
	for (const org of level1) {
		if (!org.isDirectory()) continue;
		const orgPath = join(root, org.name);
		let level2: import("fs").Dirent[] = [];
		try {
			level2 = await readdir(orgPath, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const repo of level2) {
			if (!repo.isDirectory()) continue;
			const repoPath = join(orgPath, repo.name);
			if (await isGitRepo(repoPath)) out.push(repoPath);
		}
	}
	return out;
}

async function resolveAuthorFilters(): Promise<{
	email?: string;
	name?: string;
	regex?: string;
}> {
	// Prefer explicit env config
	if (process.env.GIT_AUTHOR_REGEX)
		return { regex: process.env.GIT_AUTHOR_REGEX };
	if (process.env.GIT_AUTHOR_EMAIL)
		return { email: process.env.GIT_AUTHOR_EMAIL };
	if (process.env.GIT_AUTHOR_NAME) return { name: process.env.GIT_AUTHOR_NAME };

	// Fallback to global git config
	try {
		const { stdout: email } = await execFileAsync("git", [
			"config",
			"--global",
			"user.email",
		]);
		const e = email.trim();
		if (e) return { email: e };
	} catch {}
	try {
		const { stdout: name } = await execFileAsync("git", [
			"config",
			"--global",
			"user.name",
		]);
		const n = name.trim();
		if (n) return { name: n };
	} catch {}
	return {};
}

async function collectCommitsFromRepo(params: {
	repoPath: string;
	sinceISO: string;
	untilISO: string;
	author: { email?: string; name?: string; regex?: string };
	maxCommits?: number;
}): Promise<GitCommit[]> {
	const { repoPath, sinceISO, untilISO, author, maxCommits = 1000 } = params;
	const pretty = "%H%x1f%at%x1f%s"; // unit-separator to avoid commas etc
	const args = [
		"log",
		"--all",
		`--since=${sinceISO}`,
		`--until=${untilISO}`,
		"--no-show-signature",
		`--pretty=${pretty}`,
		"-n",
		String(maxCommits),
	];

	if (author.regex) args.splice(4, 0, `--author=${author.regex}`);
	else if (author.email)
		args.splice(4, 0, `--author=${author.email.replaceAll("/", "\\/")}`);
	else if (author.name)
		args.splice(4, 0, `--author=${author.name.replaceAll("/", "\\/")}`);

	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd: repoPath,
			maxBuffer: 10 * 1024 * 1024,
		});
		const lines = stdout.split("\n").filter(Boolean);
		const repoName = repoPath.split("/").pop() || repoPath;
		const commits: GitCommit[] = [];
		const maxChars = Number.parseInt(
			process.env.GIT_MAX_DIFF_CHARS || "20000",
			10,
		);
		const context = Number.parseInt(process.env.GIT_DIFF_CONTEXT || "0", 10);
		for (const line of lines) {
			const [hash, at, subject] = line.split("\x1f");
			if (!hash || !at) continue;
			let diff = "";
			try {
				const { stdout: patch } = await execFileAsync(
					"git",
					[
						"show",
						"--no-color",
						"--format=",
						context === 0 ? "-U0" : `-U${context}`,
						hash,
					],
					{ cwd: repoPath, maxBuffer: 20 * 1024 * 1024 },
				);
				diff = patch || "";
				if (maxChars > 0 && diff.length > maxChars) {
					diff = `${diff.slice(0, maxChars)}\n[truncated]`;
				}
			} catch (e) {
				console.warn(`[git] Failed to get diff for ${repoName}@${hash}:`, e);
				diff = "";
			}

			// Collect changed files and rename info for this commit
			let changes: GitChange[] = [];
			try {
				const { stdout: filesOut } = await execFileAsync(
					"git",
					[
						"show",
						"--name-status",
						"--pretty=",
						"-M",
						"--diff-filter=ACMDRTUXB",
						hash,
					],
					{ cwd: repoPath, maxBuffer: 4 * 1024 * 1024 },
				);
				const linesFS = filesOut.split("\n").filter(Boolean);
				changes = linesFS
					.map((l): GitChange | null => {
						const parts = l.split("\t");
						if (parts[0].startsWith("R")) {
							return parts.length >= 3
								? { status: "R", oldPath: parts[1], newPath: parts[2] }
								: null;
						}
						const status = parts[0] as "M" | "A" | "D";
						const p = parts[1];
						if (!status || !p) return null;
						if (status === "M" || status === "A" || status === "D")
							return { status, path: p };
						return null;
					})
					.filter(Boolean) as GitChange[];
			} catch (e) {
				console.warn(
					`[git] Failed to get changed files for ${repoName}@${hash}:`,
					e,
				);
			}

			commits.push({
				hash,
				subject: subject || "",
				timestamp: Number.parseInt(at, 10),
				repoPath,
				repoName,
				diff,
				changes,
			});
		}
		return commits;
	} catch (e) {
		console.warn(`[git] Failed to read log for ${repoPath}:`, e);
		return [];
	}
}

export async function collectGitCommitsInRange(
	start: Date,
	end: Date,
): Promise<GitCommit[]> {
	const root =
		process.env.GIT_SCAN_ROOT || "/Users/matsukokuumahikari/src/github.com";
	const author = await resolveAuthorFilters();
	if (!author.email && !author.name && !author.regex) {
		console.warn(
			"[git] No author filter found. Set GIT_AUTHOR_EMAIL, GIT_AUTHOR_NAME or GIT_AUTHOR_REGEX to restrict commits.",
		);
	}

	let repos: string[] = [];
	try {
		repos = await listReposAtDepth2(root);
	} catch (e) {
		console.warn(`[git] Failed to scan repos under ${root}:`, e);
		return [];
	}

	const sinceISO = start.toISOString();
	const untilISO = end.toISOString();

	const allCommits: GitCommit[] = [];
	for (const repo of repos) {
		const commits = await collectCommitsFromRepo({
			repoPath: repo,
			sinceISO,
			untilISO,
			author,
			maxCommits: 1000,
		});
		allCommits.push(...commits);
	}
	return allCommits.sort((a, b) => a.timestamp - b.timestamp);
}

export function buildGitCommitEvents(commits: GitCommit[]): EventModel[] {
	const bucket: BucketModel = {
		key: -1000,
		id: "git-commits",
		created: new Date(),
		name: "Git Commits",
		type: "git.commit",
		client: "git",
		hostname: hostname(),
		datastr: undefined,
	};
	let eid = -1;
	const events: EventModel[] = commits.map((c) => ({
		id: eid--,
		bucket_id: bucket.key,
		timestamp: new Date(c.timestamp * 1000),
		duration: 1,
		datastr: JSON.stringify({
			repo: c.repoName,
			path: c.repoPath,
			subject: c.subject,
			diff: c.diff,
		}),
		bucketmodel: bucket,
	}));
	events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
	return events;
}

export type FileSnapshot = {
	repoName: string;
	repoPath: string;
	path: string;
	before: string;
	after: string;
};

export async function buildFileSnapshotsFromCommits(
	commits: GitCommit[],
): Promise<FileSnapshot[]> {
	// Group commits by repo
	const byRepo = new Map<string, { repoName: string; commits: GitCommit[] }>();
	for (const c of commits) {
		const cur = byRepo.get(c.repoPath) || { repoName: c.repoName, commits: [] };
		cur.commits.push(c);
		byRepo.set(c.repoPath, cur);
	}
	const maxFiles = Number.parseInt(
		process.env.GIT_MAX_SNAPSHOT_FILES || "50",
		10,
	);
	const maxChars = Number.parseInt(
		process.env.GIT_MAX_FILE_CHARS || "20000",
		10,
	);
	const snapshots: FileSnapshot[] = [];

	for (const [repoPath, { repoName, commits: repoCommits }] of byRepo) {
		type Bounds = {
			earliest?: { hash: string; path: string; change: GitChange };
			latest?: { hash: string; path: string; change: GitChange };
		};
		const fileMap = new Map<string, Bounds>();
		for (const c of repoCommits.sort((a, b) => a.timestamp - b.timestamp)) {
			for (const ch of c.changes) {
				const key = ch.status === "R" ? ch.newPath : ch.path;
				const entry = fileMap.get(key) || {};
				if (!entry.earliest)
					entry.earliest = { hash: c.hash, path: key, change: ch };
				entry.latest = { hash: c.hash, path: key, change: ch };
				fileMap.set(key, entry);
			}
		}

		for (const [key, b] of fileMap) {
			if (snapshots.length >= maxFiles) break;
			if (!b.earliest || !b.latest) continue;
			const earliest = b.earliest;
			const latest = b.latest;
			const beforePath =
				earliest.change.status === "R"
					? earliest.change.oldPath
					: earliest.path;
			const afterPath =
				latest.change.status === "R" ? latest.change.newPath : latest.path;
			let before = "";
			let after = "";
			try {
				const { stdout } = await execFileAsync(
					"git",
					["show", `${earliest.hash}^:${beforePath}`],
					{ cwd: repoPath, maxBuffer: 20 * 1024 * 1024 },
				);
				before = stdout || "";
			} catch {
				before = "";
			}
			try {
				const { stdout } = await execFileAsync(
					"git",
					["show", `${latest.hash}:${afterPath}`],
					{ cwd: repoPath, maxBuffer: 20 * 1024 * 1024 },
				);
				after = stdout || "";
			} catch {
				after = "";
			}
			if (maxChars > 0) {
				if (before.length > maxChars)
					before = `${before.slice(0, maxChars)}\n[truncated]`;
				if (after.length > maxChars)
					after = `${after.slice(0, maxChars)}\n[truncated]`;
			}
			snapshots.push({ repoName, repoPath, path: key, before, after });
		}
	}
	return snapshots;
}

export async function getGitCommitEventsByTimeRange(
	start: Date,
	end: Date,
): Promise<EventModel[]> {
	const commits = await collectGitCommitsInRange(start, end);
	return buildGitCommitEvents(commits);
}
