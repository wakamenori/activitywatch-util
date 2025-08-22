// Type definitions for ActivityWatch database models

export interface BucketModel {
	key: number;
	id: string;
	created: Date;
	name: string | null;
	type: string;
	client: string;
	hostname: string;
	datastr?: string | null;
}

export interface EventModel {
	id: number;
	bucket_id: number;
	timestamp: Date;
	duration: number | string; // Can be decimal or string from database
	datastr: string;
	bucketmodel: BucketModel; // Always included from JOIN query
}

// Database row types (raw from SQLite)
export interface BucketModelRow {
	key: number;
	id: string;
	created: string; // ISO date string from SQLite
	name: string | null | Buffer; // May contain binary data
	type: string;
	client: string;
	hostname: string;
	datastr?: string | null | Buffer; // May contain binary data
}

export interface EventModelRow {
	id: number;
	bucket_id: number;
	timestamp: string; // ISO date string from SQLite
	duration: number | string;
	datastr: string | Buffer; // May contain binary data
}
