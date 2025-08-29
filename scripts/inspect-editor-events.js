const Database = require("better-sqlite3");
const os = require("node:os");
const path = require("node:path");

function getDBPath() {
	const home = os.homedir();
	const platform = os.platform();
	if (platform === "darwin") {
		return path.join(
			home,
			"Library",
			"Application Support",
			"activitywatch",
			"aw-server",
			"peewee-sqlite.v2.db",
		);
	}
	if (platform === "win32") {
		return path.join(
			home,
			"AppData",
			"Local",
			"activitywatch",
			"aw-server",
			"peewee-sqlite.v2.db",
		);
	}
	return path.join(
		home,
		".local",
		"share",
		"activitywatch",
		"aw-server",
		"peewee-sqlite.v2.db",
	);
}

function safeToString(data) {
	if (data === null || data === undefined) return null;
	if (Buffer.isBuffer(data)) {
		try {
			const str = data.toString("utf8");
			if (str.includes("\ufffd")) return data.toString("latin1");
			return str;
		} catch {
			return data.toString("hex");
		}
	}
	if (typeof data === "string") return data;
	return String(data);
}

function parseJSON(str) {
	try {
		return JSON.parse(str);
	} catch {
		return { _raw: str };
	}
}

try {
	const db = new Database(getDBPath(), { readonly: true, fileMustExist: true });

	// Find editor buckets
	const editorBuckets = db
		.prepare(`
			SELECT key, id, name, type, client, hostname
			FROM bucketmodel
			WHERE type = 'app.editor.activity'
			ORDER BY created DESC
		`)
		.all();

	if (editorBuckets.length === 0) {
		console.log("No app.editor.activity buckets found.");
		process.exit(0);
	}

	for (const b of editorBuckets) {
		console.log(`\n=== Bucket: ${b.id} (client: ${b.client}) ===`);

		const rows = db
			.prepare(`
				SELECT e.id, e.timestamp, e.duration, e.datastr
				FROM eventmodel e
				WHERE e.bucket_id = ?
				ORDER BY e.timestamp DESC
				LIMIT 50
			`)
			.all(b.key);

		console.log(`Recent events: ${rows.length}`);

		// Collect key frequency across events
		const keyFreq = new Map();
		const samples = [];
		for (const r of rows) {
			const dataStr = safeToString(r.datastr) || "{}";
			const data = parseJSON(dataStr);
			if (data && typeof data === "object") {
				for (const k of Object.keys(data)) {
					keyFreq.set(k, (keyFreq.get(k) || 0) + 1);
				}
			}
			samples.push({
				id: r.id,
				timestamp: r.timestamp,
				duration: r.duration,
				keys: Object.keys(data),
				preview: Object.fromEntries(
					Object.entries(data)
						.slice(0, 6)
						.map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 120) : v]),
				),
			});
		}

		const sortedKeys = [...keyFreq.entries()].sort((a, b) => b[1] - a[1]);
		console.log("Keys frequency (top):");
		for (const [k, c] of sortedKeys.slice(0, 20)) {
			console.log(`  ${k}: ${c}`);
		}

		console.log("\nSample events (first 5):");
		for (const s of samples.slice(0, 5)) {
			console.log(
				`- id=${s.id} ts=${s.timestamp} dur=${s.duration} keys=[${s.keys.join(", ")}]`,
			);
			console.log("  preview:", s.preview);
		}
	}

	db.close();
} catch (err) {
	console.error("Error:", err);
}
