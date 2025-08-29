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

	// Get events from last 1 hour
	const now = new Date();
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

	// Format for SQL query (matching ActivityWatch format)
	const formatForSQL = (date) => {
		return date.toISOString().replace("T", " ").replace("Z", "+00:00");
	};

	const oneHourAgoSQL = formatForSQL(oneHourAgo);
	const nowSQL = formatForSQL(now);

	console.log(`データ期間 (UTC): ${oneHourAgoSQL} 〜 ${nowSQL}`);
	console.log(
		`データ期間 (JST): ${oneHourAgo.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} 〜 ${now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}\n`,
	);

	// Get all events with bucket info
	const events = db
		.prepare(`
    SELECT 
      e.id,
      e.bucket_id,
      e.timestamp,
      e.duration,
      e.datastr,
      b.type as bucket_type,
      b.client,
      b.id as bucket_name
    FROM eventmodel e
    JOIN bucketmodel b ON e.bucket_id = b.key
    WHERE e.timestamp >= ? AND e.timestamp <= ?
    ORDER BY e.timestamp DESC
  `)
		.all(oneHourAgoSQL, nowSQL);

	console.log(`総イベント数: ${events.length}\n`);

	// Group by bucket type
	const bucketTypes = {};
	events.forEach((event) => {
		if (!bucketTypes[event.bucket_type]) {
			bucketTypes[event.bucket_type] = {
				count: 0,
				totalDuration: 0,
				events: [],
			};
		}
		bucketTypes[event.bucket_type].count++;
		bucketTypes[event.bucket_type].totalDuration += parseFloat(
			event.duration || 0,
		);
		bucketTypes[event.bucket_type].events.push(event);
	});

	console.log("バケットタイプ別サマリー:");
	Object.entries(bucketTypes).forEach(([type, data]) => {
		console.log(`\n${type}:`);
		console.log(`  イベント数: ${data.count}`);
		console.log(`  合計時間: ${(data.totalDuration / 60).toFixed(2)}分`);

		// Sample data structure
		if (data.events.length > 0) {
			const sample = data.events[0];
			console.log(`  データ構造例:`);
			try {
				const datastr = JSON.parse(sample.datastr);
				console.log(
					`    ${JSON.stringify(datastr, null, 2).split("\n").slice(0, 10).join("\n    ")}`,
				);
			} catch (_e) {
				console.log(`    ${sample.datastr}`);
			}
		}
	});

	// Analyze activity patterns
	console.log("\n\n=== 詳細分析 ===\n");

	// Window activity
	const windowEvents = bucketTypes.currentwindow?.events || [];
	if (windowEvents.length > 0) {
		console.log("アクティブウィンドウ TOP 5:");
		const windowSummary = {};
		windowEvents.forEach((event) => {
			try {
				const data = JSON.parse(event.datastr);
				const key = `${data.app} - ${data.title}`;
				windowSummary[key] =
					(windowSummary[key] || 0) + parseFloat(event.duration || 0);
			} catch (_e) {}
		});
		Object.entries(windowSummary)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.forEach(([app, duration]) => {
				console.log(`  ${app}: ${(duration / 60).toFixed(2)}分`);
			});
	}

	// Web activity
	const webEvents = bucketTypes["web.tab.current"]?.events || [];
	if (webEvents.length > 0) {
		console.log("\nWeb閲覧 TOP 5:");
		const webSummary = {};
		webEvents.forEach((event) => {
			try {
				const data = JSON.parse(event.datastr);
				const key = `${data.title} (${data.url.split("/")[2]})`;
				webSummary[key] =
					(webSummary[key] || 0) + parseFloat(event.duration || 0);
			} catch (_e) {}
		});
		Object.entries(webSummary)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.forEach(([page, duration]) => {
				console.log(`  ${page}: ${(duration / 60).toFixed(2)}分`);
			});
	}

	// AFK status
	const afkEvents = bucketTypes.afkstatus?.events || [];
	if (afkEvents.length > 0) {
		let afkTime = 0;
		let activeTime = 0;
		afkEvents.forEach((event) => {
			try {
				const data = JSON.parse(event.datastr);
				if (data.status === "afk") {
					afkTime += parseFloat(event.duration || 0);
				} else {
					activeTime += parseFloat(event.duration || 0);
				}
			} catch (_e) {}
		});
		console.log("\nアクティビティ状態:");
		console.log(`  アクティブ: ${(activeTime / 60).toFixed(2)}分`);
		console.log(`  離席: ${(afkTime / 60).toFixed(2)}分`);
	}

	db.close();
} catch (error) {
	console.error("Error:", error.message);
}
