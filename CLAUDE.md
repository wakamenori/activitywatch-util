# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

ActivityWatch utility application built with Next.js 15, React 19, and TypeScript. Uses App Router for routing and Biome for code formatting and linting.

## Architecture

### Tech Stack

- **Framework**: Next.js 15.5.0 with Turbopack
- **UI Library**: React 19.1.0
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Database ORM**: Prisma 6.14.0 (READ-ONLY access to ActivityWatch SQLite database)
- **Code Quality**: Biome 2.2.0 (formatter and linter)
- **Package Manager**: pnpm

### Project Structure

```
activitywatch-util/
├── src/
│   └── app/           # Next.js App Router pages
├── public/            # Static assets
├── biome.json         # Biome configuration
├── next.config.ts     # Next.js configuration
├── tsconfig.json      # TypeScript configuration
└── package.json       # Dependencies and scripts
```

## Development Workflow

### Available Scripts

```bash
pnpm run dev          # Start development server with Turbopack
pnpm run build        # Build for production with Turbopack
pnpm run start        # Start production server
pnpm run format       # Format code with Biome
pnpm run format:unsafe # Format with unsafe fixes
pnpm run lint         # Run Biome linter
pnpm run typecheck    # Type check with TypeScript
pnpm run db:pull      # Pull schema from ActivityWatch database
pnpm run db:generate  # Generate Prisma Client
pnpm run db:studio    # Open Prisma Studio to browse data (READ-ONLY)
```

### Code Style

- **Indentation**: Tabs (configured in Biome)
- **Quotes**: Double quotes for strings
- **Formatting**: Biome handles all formatting automatically
- **Linting**: Biome with recommended rules enabled

## Important Configuration

### Biome Configuration

- Uses Biome 2.2.0 for both formatting and linting
- Git integration enabled with `.gitignore` respect
- Excludes: `node_modules`, `.next`, `out`, `build`, `coverage`
- Includes all TypeScript, JavaScript, and JSX/TSX files

### Next.js Configuration

- Turbopack enabled for faster builds
- App Router architecture
- Source code in `src/` directory

## Development Guidelines

1. **Before committing**: Always run `pnpm run format` and `pnpm run lint`
2. **Type safety**: Run `pnpm run typecheck` to ensure no TypeScript errors
3. **File organization**: Place all application code in the `src/` directory
4. **Components**: Use functional components with TypeScript
5. **Routing**: Use Next.js App Router conventions in `src/app/`

## ActivityWatch Integration

This utility is designed to work with ActivityWatch data. It connects to the local ActivityWatch SQLite database in **READ-ONLY mode** to prevent any accidental data corruption.

### Database Access

**IMPORTANT: The database connection is READ-ONLY. Never attempt to modify the ActivityWatch database.**

- **Database Location**: `~/Library/Application Support/activitywatch/aw-server/peewee-sqlite.v2.db`
- **Access Method**: Prisma ORM with read-only helper functions in `src/lib/prisma.ts`
- **Available Data**:
  - `bucketmodel`: Activity tracking buckets (different trackers like window, AFK, etc.)
  - `eventmodel`: Individual activity events with timestamps and duration

### Safe Database Operations

Use the `activityWatchDB` helper from `src/lib/prisma.ts`:
- `getBuckets()`: Get all activity buckets
- `getBucket(id)`: Get a specific bucket
- `getEvents(bucketId?, limit)`: Get recent events
- `getEventsByTimeRange(start, end, bucketId?)`: Get events in a time range

### Future Features

- Data visualization components
- Activity analysis tools
- Export functionality
- Custom reporting features

