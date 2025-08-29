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

	const buckets = db
		.prepare(`
    SELECT key, id, type, client, hostname
    FROM bucketmodel
    ORDER BY created DESC
  `)
		.all();

	console.log(`\n合計バケット数: ${buckets.length}\n`);

	// Group by type
	const typeCount = {};
	buckets.forEach((bucket) => {
		typeCount[bucket.type] = (typeCount[bucket.type] || 0) + 1;
	});

	console.log("バケットタイプ別:");
	Object.entries(typeCount).forEach(([type, count]) => {
		console.log(`  ${type}: ${count}個`);
	});

	console.log("\nバケット一覧:");
	buckets.forEach((bucket) => {
		console.log(
			`  - ${bucket.id} (type: ${bucket.type}, client: ${bucket.client})`,
		);
	});

	db.close();
} catch (error) {
	console.error("Error:", error.message);
}
