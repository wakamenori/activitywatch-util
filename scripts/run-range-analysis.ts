import { parseArgs } from "node:util";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Provider } from "@/lib/analyze-activity/llm";
import { parseDateInput } from "@/lib/analyze-activity/range";
import {
	RangeAnalysisError,
	runRangeAnalysis,
} from "@/lib/analyze-activity/run-range-analysis";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(__filename), "..");
process.chdir(projectRoot);

async function main() {
	const dotenvSpecifier: string = "dotenv/config";
	try {
		await import(dotenvSpecifier);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
			console.warn("Failed to load dotenv/config:", error);
		}
	}

	const { values } = parseArgs({
		options: {
			start: { type: "string" },
			end: { type: "string" },
			provider: { type: "string" },
			create: { type: "boolean" },
			minutes: { type: "string" },
			hours: { type: "string" },
			json: { type: "boolean" },
		},
		allowPositionals: false,
	});

	const provider = (values.provider || "openai").toLowerCase() as Provider;
	const createCalendar = Boolean(values.create);

	const now = new Date();
	const end = parseDateInput(values.end) ?? now;

	const minutesInput = values.minutes ? Number.parseInt(values.minutes, 10) : NaN;
	const hoursInput = values.hours ? Number.parseInt(values.hours, 10) : NaN;
	const lookbackMinutes = Number.isFinite(minutesInput)
		? minutesInput
		: Number.isFinite(hoursInput)
			? hoursInput * 60
			: 60;

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
		logPrefix,
		logger: console,
	});

	if (values.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log("=== run-range-analysis ===");
	console.log(`range: ${result.range.start} -> ${result.range.end} (${result.range.label})`);
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
	console.log(`xml: ${result.xmlPath || "(not saved)"}`);
	if (result.calendarResult) {
		console.log("calendar:", result.calendarResult);
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
