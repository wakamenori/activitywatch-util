import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import type { Provider } from "@/lib/analyze-activity/llm";
import { parseDateInput } from "@/lib/analyze-activity/range";
import {
	RangeAnalysisError,
	runRangeAnalysis,
} from "@/lib/analyze-activity/run-range-analysis";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(__filename), "..");
process.chdir(projectRoot);

const WINDOW_MINUTES = 30;
const WINDOW_MS = WINDOW_MINUTES * 60_000;

function loadEnvironment() {
	const envLocalPath = resolve(projectRoot, ".env.local");
	const envPath = resolve(projectRoot, ".env");
	let loaded = false;

	if (existsSync(envLocalPath)) {
		const result = loadEnv({ path: envLocalPath, override: true });
		if (result.error) {
			console.warn("Failed to load .env.local:", result.error);
		} else {
			loaded = true;
		}
	}

	if (!loaded && existsSync(envPath)) {
		const result = loadEnv({ path: envPath, override: false });
		if (result.error) {
			console.warn("Failed to load .env:", result.error);
		} else {
			loaded = true;
		}
	}

	if (!loaded) {
		const result = loadEnv();
		if (result.error) {
			console.warn(
				"Failed to load environment variables via dotenv:",
				result.error,
			);
		}
	}
}

function readBooleanEnv(...names: string[]): boolean | undefined {
	for (const name of names) {
		const raw = process.env[name];
		if (typeof raw !== "string") continue;
		const normalized = raw.trim().toLowerCase();
		if (normalized.length === 0) continue;
		if (["1", "true", "yes", "y", "on"].includes(normalized)) {
			return true;
		}
		if (["0", "false", "no", "n", "off"].includes(normalized)) {
			return false;
		}
	}
	return undefined;
}

function hasCalendarCredentials(): boolean {
	const calendarId =
		process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_CALENDAR_ID;
	const serviceAccountEmail =
		process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ||
		process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL;
	const credentialEnvNames = [
		"GOOGLE_CALENDAR_PRIVATE_KEY",
		"GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY",
		"GOOGLE_CALENDAR_PRIVATE_KEY_BASE64",
		"GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64",
		"GOOGLE_CALENDAR_CREDENTIALS_JSON",
	] as const;
	const credentialValue = credentialEnvNames.find((name) => {
		const value = process.env[name];
		return typeof value === "string" && value.trim().length > 0;
	});
	return Boolean(calendarId && serviceAccountEmail && credentialValue);
}

async function main() {
	loadEnvironment();
	const { values } = parseArgs({
		options: {
			provider: { type: "string" },
			create: { type: "boolean" },
			minutes: { type: "string" },
			hours: { type: "string" },
			interval: { type: "string" },
			start: { type: "string" },
			json: { type: "boolean" },
		},
		allowPositionals: false,
	});

	const provider = (values.provider || "gemini").toLowerCase() as Provider;
	const logPrefix = "[cli/run-range-analysis-scheduler]";

	const createOption = values.create;
	const envCreate = readBooleanEnv(
		"ANALYZE_RANGE_SCHEDULER_CREATE",
		"RANGE_ANALYSIS_SCHEDULER_CREATE",
		"RANGE_ANALYSIS_CREATE_CALENDAR",
		"ANALYZE_RANGE_CREATE_CALENDAR",
	);
	const calendarConfigured = hasCalendarCredentials();
	const createCalendar =
		typeof createOption === "boolean"
			? createOption
			: (envCreate ?? calendarConfigured);

	console.info(`${logPrefix} calendar settings`, {
		flag: createOption,
		env: envCreate,
		calendarConfigured,
		createCalendar,
	});
	if (typeof createOption !== "boolean") {
		const reason = envCreate !== undefined ? "env" : "calendar-config";
		console.info(`${logPrefix} calendar default`, {
			reason,
			enabled: createCalendar,
		});
	}

	const parseNumberOption = (value: unknown) => {
		if (typeof value !== "string" || value.trim().length === 0) {
			return Number.NaN;
		}
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : Number.NaN;
	};

	const intervalMinutesInput = parseNumberOption(values.interval);
	if (
		Number.isFinite(intervalMinutesInput) &&
		intervalMinutesInput !== WINDOW_MINUTES
	) {
		console.warn(
			`${logPrefix} interval option ${intervalMinutesInput}m is ignored; forcing ${WINDOW_MINUTES}m interval`,
		);
	}

	const minutesInput = parseNumberOption(values.minutes);
	const hoursInput = parseNumberOption(values.hours);
	if (
		(Number.isFinite(minutesInput) && minutesInput !== WINDOW_MINUTES) ||
		(Number.isFinite(hoursInput) && hoursInput * 60 !== WINDOW_MINUTES)
	) {
		console.warn(
			`${logPrefix} custom lookback is ignored; forcing ${WINDOW_MINUTES}m window`,
		);
	}

	const lookbackMs = WINDOW_MS;

	const floorToBoundary = (date: Date) =>
		new Date(Math.floor(date.getTime() / WINDOW_MS) * WINDOW_MS);
	const nextBoundaryAfter = (date: Date) => {
		const remainder = date.getTime() % WINDOW_MS;
		const base =
			remainder === 0
				? date.getTime() + WINDOW_MS
				: date.getTime() + (WINDOW_MS - remainder);
		return new Date(base);
	};
	const isExactBoundary = (date: Date) => date.getTime() % WINDOW_MS === 0;

	let lastEnd = (() => {
		const parsed = parseDateInput(values.start);
		if (!parsed) return null;
		if (Number.isNaN(parsed.getTime())) return null;
		const aligned = floorToBoundary(parsed);
		if (!isExactBoundary(parsed)) {
			console.warn(
				`${logPrefix} start option rounded down to ${aligned.toISOString()} to maintain ${WINDOW_MINUTES}m window alignment`,
			);
		}
		return aligned;
	})();

	let isRunning = false;
	let timer: NodeJS.Timeout | undefined;

	const runOnce = async (trigger: string, targetEnd: Date) => {
		if (isRunning) {
			console.warn(
				`${logPrefix} skip run triggered by ${trigger} because previous run is in progress`,
			);
			return;
		}

		isRunning = true;
		const end = new Date(targetEnd.getTime());
		let start: Date;

		if (lastEnd && lastEnd.getTime() < end.getTime()) {
			start = new Date(lastEnd.getTime());
		} else {
			start = new Date(end.getTime() - lookbackMs);
		}

		if (start.getTime() >= end.getTime()) {
			start = new Date(end.getTime() - lookbackMs);
		}

		const runLabel = `${start.toISOString()} → ${end.toISOString()}`;
		console.info(`${logPrefix} start`, { trigger, range: runLabel });

		try {
			const result = await runRangeAnalysis({
				start,
				end,
				provider,
				createCalendar,
				logPrefix,
				logger: console,
			});

			lastEnd = new Date(end.getTime());

			if (values.json) {
				console.log(
					JSON.stringify(
						{
							timestamp: new Date().toISOString(),
							trigger,
							result,
						},
						null,
						2,
					),
				);
			} else {
				console.info(`${logPrefix} success`, {
					range: result.range,
					counts: result.counts,
					provider: result.provider,
					calendar: result.calendarResult,
				});
			}
		} catch (error) {
			if (error instanceof RangeAnalysisError) {
				console.error(`${logPrefix} failed`, {
					type: "RangeAnalysisError",
					status: error.status,
					message: error.message,
				});
			} else {
				console.error(`${logPrefix} failed`, error);
			}
		} finally {
			isRunning = false;
		}
	};

	const scheduleNextRun = (reason: string, reference: Date) => {
		const next = nextBoundaryAfter(reference);
		const delayMs = Math.max(0, next.getTime() - Date.now());
		console.info(`${logPrefix} scheduling next run`, {
			reason,
			nextISO: next.toISOString(),
			delaySeconds: Math.round(delayMs / 1000),
		});
		timer = setTimeout(() => {
			timer = undefined;
			void (async () => {
				await runOnce("scheduled", next);
				scheduleNextRun("post-run", next);
			})();
		}, delayMs);
	};

	const now = new Date();
	if (isExactBoundary(now)) {
		await runOnce("startup-boundary", now);
		scheduleNextRun("post-run", now);
	} else {
		const firstRunAt = nextBoundaryAfter(now);
		const waitSeconds = Math.round(
			(firstRunAt.getTime() - now.getTime()) / 1000,
		);
		console.info(
			`${logPrefix} waiting ${waitSeconds}s for first boundary run at ${firstRunAt.toISOString()}`,
		);
		scheduleNextRun("startup", now);
	}

	const shutdown = (signal: NodeJS.Signals) => {
		console.info(`${logPrefix} received ${signal}, shutting down scheduler`);
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

main().catch((error) => {
	console.error("run-range-analysis scheduler failed:", error);
	process.exit(1);
});
