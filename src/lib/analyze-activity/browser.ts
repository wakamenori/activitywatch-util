export function extractEncodedUrlFromTitle(title?: string | null): {
	url: string | null;
	cleanTitle: string;
} {
	const original = title || "";
	// Match the last parentheses group at end of string: ... (ENCODED_URL)
	const m = original.match(/\s*\(([^()]+)\)\s*$/);
	if (!m) return { url: null, cleanTitle: original };
	const encoded = m[1];
	try {
		const decoded = decodeURIComponent(encoded);
		if (/^https?:\/\//i.test(decoded)) {
			const clean = original.replace(/\s*\([^()]*\)\s*$/, "").trim();
			return { url: decoded, cleanTitle: clean };
		}
		return { url: null, cleanTitle: original };
	} catch {
		return { url: null, cleanTitle: original };
	}
}

export function extractDomainFromUrl(url?: string | null): string | null {
	if (!url) return null;
	try {
		const u = new URL(url);
		return u.hostname.toLowerCase();
	} catch {
		return null;
	}
}
