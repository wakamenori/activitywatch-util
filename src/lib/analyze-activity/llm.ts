import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type Provider = "openai" | "gemini";

export function selectModel(
	provider: Provider,
): { ok: true; model: LanguageModel } | { ok: false; error: string } {
	if (provider === "gemini") {
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return {
				ok: false,
				error: "Missing GOOGLE_GENERATIVE_AI_API_KEY for Gemini provider",
			};
		}
		return { ok: true, model: google("gemini-2.5-pro") };
	}
	if (provider === "openai") {
		return { ok: true, model: openai.responses("gpt-5") };
	}
	return { ok: false, error: "Invalid provider. Use 'openai' or 'gemini'" };
}
