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

async function main() {
	loadEnvironment();

	const { values } = parseArgs({
		options: {
			start: { type: "string" },
			end: { type: "string" },
			provider: { type: "string" },
			create: { type: "boolean" },
			"no-calendar": { type: "boolean" },
			"save-xml": { type: "boolean" },
			minutes: { type: "string" },
			hours: { type: "string" },
			json: { type: "boolean" },
		},
		allowPositionals: false,
	});

	const provider = (values.provider || "gemini").toLowerCase() as Provider;
	const disableCalendar = Boolean(values["no-calendar"]);
	const saveXml = Boolean(values["save-xml"]);
	let createCalendar = true;

	if (typeof values.create === "boolean") {
		createCalendar = values.create;
	}

	if (disableCalendar) {
		createCalendar = false;
	}

	const now = new Date();
	const end = parseDateInput(values.end) ?? now;

	const minutesInput = values.minutes
		? Number.parseInt(values.minutes, 10)
		: NaN;
	const hoursInput = values.hours ? Number.parseInt(values.hours, 10) : NaN;
	const lookbackMinutes = Number.isFinite(minutesInput)
		? minutesInput
		: Number.isFinite(hoursInput)
			? hoursInput * 60
			: 30;

	let start = parseDateInput(values.start);
	if (!start) {
		start = new Date(end.getTime() - lookbackMinutes * 60_000);
	}

	if (Number.isNaN(start.getTime())) {
		throw new RangeAnalysisError("Invalid start date", 400);
	}
	if (Number.isNaN(end.getTime())) {
		throw new RangeAnalysisError("Invalid end date", 400);
	}

	const logPrefix = "[cli/run-range-analysis]";

	const result = await runRangeAnalysis({
		start,
		end,
		provider,
		createCalendar,
		saveXml,
		logPrefix,
		logger: console,
	});

	if (values.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log("=== run-range-analysis ===");
	console.log(
		`range: ${result.range.start} -> ${result.range.end} (${result.range.label})`,
	);
	console.log(`provider: ${result.provider}`);
	console.log(
		`counts: activity=${result.counts.activityEvents}, commits=${result.counts.gitCommits}`,
	);
	console.log("");
	console.log("human summary:");
	console.log(result.humanSummary);
	console.log("");
	console.log("analysis:");
	console.log(result.result);
	console.log("");
	if (result.xmlPath) {
		console.log(`xml: ${result.xmlPath}`);
	} else if (saveXml) {
		console.log("xml: save requested but file was not written");
	} else {
		console.log("xml: not saved (--save-xml not set)");
	}
	if (result.calendarResult) {
		console.log("calendar:", result.calendarResult);
	} else if (!createCalendar) {
		console.log("calendar: disabled (--no-calendar)");
	} else {
		console.log("calendar: not requested");
	}
}

main().catch((error) => {
	if (error instanceof RangeAnalysisError) {
		console.error("run-range-analysis failed:", error.message);
		process.exitCode = error.status >= 500 ? 1 : 2;
		return;
	}
	console.error("run-range-analysis failed:", error);
	process.exitCode = 1;
});
