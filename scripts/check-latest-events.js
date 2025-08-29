const Database = require("better-sqlite3");
const os = require("node:os");
const path = require("node:path");

// Get database path
const home = os.homedir();
const dbPath = path.join(
	home,
	"Library",
	"Application Support",
	"activitywatch",
	"aw-server",
	"peewee-sqlite.v2.db",
);

try {
	const db = new Database(dbPath, { readonly: true });

	console.log("=== 最新のイベントを確認 ===\n");

	// Get latest events from each bucket
	const buckets = db
		.prepare(`
    SELECT key, id, type
    FROM bucketmodel
  `)
		.all();

	buckets.forEach((bucket) => {
		const latestEvent = db
			.prepare(`
      SELECT timestamp, duration, datastr
      FROM eventmodel
      WHERE bucket_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `)
			.get(bucket.key);

		if (latestEvent) {
			const timestamp = new Date(latestEvent.timestamp);
			console.log(`${bucket.id} (${bucket.type}):`);
			console.log(`  最新イベント (UTC): ${latestEvent.timestamp}`);
			console.log(
				`  最新イベント (JST): ${timestamp.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
			);
			console.log(
				`  現在との差: ${Math.floor((Date.now() - timestamp.getTime()) / 1000 / 60)}分前`,
			);
			console.log();
		}
	});

	// Get total count of events in last 24 hours
	const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const eventCount = db
		.prepare(`
    SELECT COUNT(*) as count
    FROM eventmodel
    WHERE timestamp >= ?
  `)
		.get(oneDayAgo);

	console.log(`\n過去24時間の総イベント数: ${eventCount.count}`);

	// Check raw timestamp format
	console.log("\n=== タイムスタンプ形式の確認 ===");
	const sample = db
		.prepare(`
    SELECT timestamp
    FROM eventmodel
    ORDER BY timestamp DESC
    LIMIT 5
  `)
		.all();

	sample.forEach((row) => {
		console.log(`Raw: ${row.timestamp}`);
		console.log(
			`JST: ${new Date(row.timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`,
		);
	});

	db.close();
} catch (error) {
	console.error("Error:", error.message);
}
