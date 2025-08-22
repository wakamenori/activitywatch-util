import { PrismaClient } from "../generated/prisma";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

// Create Prisma client with read-only configuration
// Note: This is a read-only connection to ActivityWatch database
// DO NOT perform any write operations (CREATE, UPDATE, DELETE)
export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: ["warn", "error"],
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Export only read operations
export const activityWatchDB = {
	// Buckets (activity trackers)
	getBuckets: async () => {
		return await prisma.bucketmodel.findMany();
	},
	getBucket: async (id: string) => {
		return await prisma.bucketmodel.findUnique({
			where: { id },
		});
	},

	// Events (activity data)
	getEvents: async (bucketId?: number, limit = 100) => {
		return await prisma.eventmodel.findMany({
			where: bucketId ? { bucket_id: bucketId } : undefined,
			take: limit,
			orderBy: { timestamp: "desc" },
			include: { bucketmodel: true },
		});
	},
	getEventsByTimeRange: async (
		startTime: Date,
		endTime: Date,
		bucketId?: number,
	) => {
		return await prisma.eventmodel.findMany({
			where: {
				timestamp: {
					gte: startTime,
					lte: endTime,
				},
				...(bucketId && { bucket_id: bucketId }),
			},
			orderBy: { timestamp: "desc" },
			include: { bucketmodel: true },
		});
	},
};
