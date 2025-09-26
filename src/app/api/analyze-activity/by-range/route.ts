import { NextResponse } from "next/server";
import { type Provider } from "@/lib/analyze-activity/llm";
import { parseDateInput } from "@/lib/analyze-activity/range";
import {
	RangeAnalysisError,
	runRangeAnalysis,
} from "@/lib/analyze-activity/run-range-analysis";

export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(request: Request) {
	try {
		const LOG = "[api/analyze-activity/by-range]";
		const { searchParams } = new URL(request.url);
		const startParam = searchParams.get("start");
		const endParam = searchParams.get("end");
		const provider = (
			searchParams.get("provider") || "openai"
		).toLowerCase() as Provider;
		const createCalendar = /^(1|true|yes)$/i.test(
			searchParams.get("create") || "",
		);
		console.info(LOG, "request", {
			startParam,
			endParam,
			provider,
			createCalendar,
		});

		// Log calendar env readiness (no secrets)
		const calendarIdPresent = Boolean(
			process.env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_CALENDAR_ID,
		);
		const serviceCredsPresent = Boolean(
			(process.env.GOOGLE_CALENDAR_CLIENT_EMAIL ||
				process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL) &&
				(process.env.GOOGLE_CALENDAR_PRIVATE_KEY ||
					process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY),
		);
		console.info(LOG, "calendar-config", {
			requested: createCalendar,
			calendarIdPresent,
			serviceCredsPresent,
		});

		const start = parseDateInput(startParam);
		const end = parseDateInput(endParam);

		console.info(LOG, "parsed-range", {
			startISO: start?.toISOString(),
			endISO: end?.toISOString(),
		});

		if (!start || !end) {
			return NextResponse.json(
				{
					error:
						"Missing or invalid 'start'/'end'. Use ISO string or epoch (s/ms)",
				},
				{ status: 400 },
			);
		}
		const result = await runRangeAnalysis({
			start,
			end,
			provider,
			createCalendar,
			logPrefix: LOG,
			logger: console,
		});

		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof RangeAnalysisError) {
			console.error("Error in analyze-activity/by-range:", error.message);
			return NextResponse.json({ error: error.message }, { status: error.status });
		}
		console.error("Error in analyze-activity/by-range:", error);
		return NextResponse.json(
			{ error: "Failed to analyze activity data for the given range" },
			{ status: 500 },
		);
	}
}
