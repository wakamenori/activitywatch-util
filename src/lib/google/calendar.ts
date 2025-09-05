import { google } from "googleapis";

type CreateParams = {
	start: Date;
	end: Date;
	summary: string;
	description?: string;
	timeZone?: string;
};

function readEnv(name: string): string | undefined {
	const v = process.env[name];
	if (v && typeof v === "string" && v.trim().length > 0) return v.trim();
	return undefined;
}

function normalizePrivateKey(raw: string): string {
	let v = raw.trim();
	// Drop wrapping quotes if present
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		v = v.slice(1, -1);
	}
	// Replace escaped newlines and normalize CRLF; drop BOM if exists
	v = v
		.replace(/\\n/g, "\n")
		.replace(/\r\n/g, "\n")
		.replace(/^\uFEFF/, "");
	// If header is not at the start but exists later, slice from there
	const beginIdx = v.indexOf("-----BEGIN ");
	if (beginIdx > 0) {
		v = v.slice(beginIdx);
	}
	// If the key looks like bare base64 (no BEGIN/END) then wrap as PKCS8
	const hasBegin = v.includes("-----BEGIN ");
	const hasEnd = v.includes("-----END ");
	if (!hasBegin || !hasEnd) {
		const body = v.replace(/\s+/g, "");
		if (/^[A-Za-z0-9+/=]+$/.test(body)) {
			v = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
			console.info("[google/calendar] coerced bare base64 to PEM");
		}
	}
	return v;
}

function getJWT() {
	// 1) Prefer full JSON creds if provided
	let clientEmail =
		readEnv("GOOGLE_CALENDAR_CLIENT_EMAIL") ||
		readEnv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL");
	const privateKeyBase64 =
		readEnv("GOOGLE_CALENDAR_PRIVATE_KEY_BASE64") ||
		readEnv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64");
	let privateKeyRaw =
		readEnv("GOOGLE_CALENDAR_PRIVATE_KEY") ||
		readEnv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY");
	const credsJson = readEnv("GOOGLE_CALENDAR_CREDENTIALS_JSON");
	if (credsJson) {
		try {
			const parsed = JSON.parse(credsJson);
			if (parsed.client_email && parsed.private_key) {
				clientEmail = parsed.client_email;
				privateKeyRaw = parsed.private_key;
			}
		} catch {
			console.warn(
				"[google/calendar] failed to parse GOOGLE_CALENDAR_CREDENTIALS_JSON",
			);
		}
	}

	if (!clientEmail || (!privateKeyRaw && !privateKeyBase64)) return null;
	let privateKey = "";
	if (privateKeyBase64) {
		try {
			privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");
		} catch (_e) {
			console.warn("[google/calendar] failed to decode base64 private key");
		}
	}
	if (!privateKey && privateKeyRaw) {
		privateKey = normalizePrivateKey(privateKeyRaw);
	}

	// Lightweight sanity checks without exposing secrets
	const beginMarker = privateKey.startsWith("-----BEGIN ");
	const endMarker = privateKey.trimEnd().endsWith("-----END PRIVATE KEY-----");
	const containsEscaped = privateKeyRaw ? /\\n/.test(privateKeyRaw) : false;
	const containsRealNL = /\n/.test(privateKey);
	console.info("[google/calendar] jwt-config", {
		clientEmailPresent: true,
		keyLength: privateKey.length,
		beginMarker,
		endMarker,
		containsEscapedNewlines: containsEscaped,
		containsRealNewlines: containsRealNL,
	});

	const jwt = new google.auth.JWT({
		email: clientEmail,
		key: privateKey,
		scopes: ["https://www.googleapis.com/auth/calendar"],
	});
	return jwt;
}

export async function createCalendarEventIfConfigured(
	params: CreateParams,
): Promise<{
	inserted: boolean;
	calendarId?: string;
	eventId?: string;
	htmlLink?: string;
	reason?: string;
}> {
	const calendarId =
		readEnv("GOOGLE_CALENDAR_ID") || readEnv("GOOGLE_CALENDAR_CALENDAR_ID");
	const jwt = getJWT();
	if (!calendarId || !jwt) {
		return {
			inserted: false,
			reason: !calendarId
				? "Missing GOOGLE_CALENDAR_ID"
				: "Missing service account credentials",
		};
	}

	try {
		const calendar = google.calendar({ version: "v3", auth: jwt });
		const timeZone = params.timeZone || "UTC";
		const res = await calendar.events.insert({
			calendarId,
			requestBody: {
				summary: params.summary,
				description: params.description || "",
				start: {
					dateTime: params.start.toISOString(),
					timeZone,
				},
				end: {
					dateTime: params.end.toISOString(),
					timeZone,
				},
			},
		});
		const event = res.data;
		return {
			inserted: true,
			calendarId,
			eventId: event.id || undefined,
			htmlLink: event.htmlLink || undefined,
		};
	} catch (e) {
		console.error("Failed to create calendar event:", e);
		return { inserted: false, reason: String(e) };
	}
}
