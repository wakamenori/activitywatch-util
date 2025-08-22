import Database from "better-sqlite3";
import type {
	BucketModel,
	BucketModelRow,
	EventModel,
} from "@/types/activitywatch";

// Database path from environment variable or default
const DB_PATH =
	process.env.DATABASE_URL?.replace("file:", "") ||
	"/Users/matsukokuumahikari/Library/Application Support/activitywatch/aw-server/peewee-sqlite.v2.db";

// Create database connection (read-only)
let db: Database.Database | null = null;

function getDatabase(): Database.Database {
	if (!db) {
		try {
			// Open database in read-only mode
			db = new Database(DB_PATH, {
				readonly: true,
				fileMustExist: true,
			});
			console.log("Connected to ActivityWatch database (read-only)");
		} catch (error) {
			console.error("Failed to connect to database:", error);
			throw new Error(`Cannot connect to ActivityWatch database: ${error}`);
		}
	}
	return db;
}

// Helper function to safely convert potentially binary data to string
function safeToString(data: any): string | null {
	if (data === null || data === undefined) return null;

	// If it's a Buffer, try to decode it
	if (Buffer.isBuffer(data)) {
		try {
			// Try UTF-8 first
			const str = data.toString("utf8");
			// Check for replacement characters that indicate encoding issues
			if (str.includes("\ufffd")) {
				// Fallback to latin1
				return data.toString("latin1");
			}
			return str;
		} catch {
			// If all else fails, return hex representation
			return data.toString("hex");
		}
	}

	// If it's already a string, return as is
	if (typeof data === "string") return data;

	// Otherwise, convert to string
	return String(data);
}

// Helper function to parse datastr JSON safely
function safeParseDataStr(datastr: any): string {
	const str = safeToString(datastr);
	if (!str) return "{}";

	// Check if it's valid JSON
	try {
		JSON.parse(str);
		return str;
	} catch {
		// If not valid JSON, wrap in quotes to make it a JSON string
		return JSON.stringify(str);
	}
}

// Convert database row to BucketModel
function rowToBucket(row: BucketModelRow): BucketModel {
	return {
		key: row.key,
		id: row.id,
		created: new Date(row.created),
		name: safeToString(row.name),
		type: row.type,
		client: row.client,
		hostname: row.hostname,
		datastr: safeToString(row.datastr),
	};
}

// Export database functions
export const activityWatchDB = {
	// Get all buckets
	getBuckets: async (): Promise<BucketModel[]> => {
		try {
			const db = getDatabase();
			const stmt = db.prepare(`
				SELECT key, id, created, name, type, client, hostname, datastr
				FROM bucketmodel
				ORDER BY created DESC
			`);

			const rows = stmt.all() as BucketModelRow[];
			return rows.map(rowToBucket);
		} catch (error) {
			console.error("Error fetching buckets:", error);
			return [];
		}
	},

	// Get a specific bucket by ID
	getBucket: async (id: string): Promise<BucketModel | null> => {
		try {
			const db = getDatabase();
			const stmt = db.prepare(`
				SELECT key, id, created, name, type, client, hostname, datastr
				FROM bucketmodel
				WHERE id = ?
			`);

			const row = stmt.get(id) as BucketModelRow | undefined;
			return row ? rowToBucket(row) : null;
		} catch (error) {
			console.error("Error fetching bucket:", error);
			return null;
		}
	},

	// Get events with optional bucket filter
	getEvents: async (bucketId?: number, limit = 100): Promise<EventModel[]> => {
		try {
			const db = getDatabase();
			let query = `
				SELECT 
					e.id,
					e.bucket_id,
					e.timestamp,
					e.duration,
					e.datastr,
					b.key,
					b.id as bucket_id_str,
					b.created,
					b.name,
					b.type,
					b.client,
					b.hostname
				FROM eventmodel e
				JOIN bucketmodel b ON e.bucket_id = b.key
			`;

			if (bucketId) {
				query += ` WHERE e.bucket_id = ?`;
			}

			query += ` ORDER BY e.timestamp DESC LIMIT ?`;

			const stmt = db.prepare(query);
			const rows = bucketId ? stmt.all(bucketId, limit) : stmt.all(limit);

			return rows.map((row: any) => ({
				id: row.id,
				bucket_id: row.bucket_id,
				timestamp: new Date(row.timestamp),
				duration:
					typeof row.duration === "string"
						? parseFloat(row.duration)
						: row.duration,
				datastr: safeParseDataStr(row.datastr),
				bucketmodel: {
					key: row.key,
					id: row.bucket_id_str,
					created: new Date(row.created),
					name: safeToString(row.name),
					type: row.type,
					client: row.client,
					hostname: row.hostname,
				},
			}));
		} catch (error) {
			console.error("Error fetching events:", error);
			return [];
		}
	},

	// Get events by time range
	getEventsByTimeRange: async (
		startTime: Date,
		endTime: Date,
		bucketId?: number,
	): Promise<EventModel[]> => {
		try {
			const db = getDatabase();
			let query = `
				SELECT 
					e.id,
					e.bucket_id,
					e.timestamp,
					e.duration,
					e.datastr,
					b.key,
					b.id as bucket_id_str,
					b.created,
					b.name,
					b.type,
					b.client,
					b.hostname
				FROM eventmodel e
				JOIN bucketmodel b ON e.bucket_id = b.key
				WHERE e.timestamp >= ? AND e.timestamp <= ?
			`;

			if (bucketId) {
				query += ` AND e.bucket_id = ?`;
			}

			query += ` ORDER BY e.timestamp DESC`;

			const stmt = db.prepare(query);
			const rows = bucketId
				? stmt.all(startTime.toISOString(), endTime.toISOString(), bucketId)
				: stmt.all(startTime.toISOString(), endTime.toISOString());

			return rows.map((row: any) => ({
				id: row.id,
				bucket_id: row.bucket_id,
				timestamp: new Date(row.timestamp),
				duration:
					typeof row.duration === "string"
						? parseFloat(row.duration)
						: row.duration,
				datastr: safeParseDataStr(row.datastr),
				bucketmodel: {
					key: row.key,
					id: row.bucket_id_str,
					created: new Date(row.created),
					name: safeToString(row.name),
					type: row.type,
					client: row.client,
					hostname: row.hostname,
				},
			}));
		} catch (error) {
			console.error("Error fetching events by time range:", error);
			return [];
		}
	},

	// Close database connection (for cleanup)
	close: () => {
		if (db) {
			db.close();
			db = null;
			console.log("Database connection closed");
		}
	},
};

// Close database on process exit
process.on("exit", () => {
	activityWatchDB.close();
});

process.on("SIGINT", () => {
	activityWatchDB.close();
	process.exit(0);
});

process.on("SIGTERM", () => {
	activityWatchDB.close();
	process.exit(0);
});
