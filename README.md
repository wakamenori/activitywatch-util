This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## LLM Provider Selection

The analysis API supports both OpenAI (default) and Google Gemini.

- Endpoint: `POST /api/analyze-activity?range=60m&provider=openai|gemini`
- Default provider: `openai`

Environment variables:

- OpenAI: follow `@ai-sdk/openai` configuration as in your environment.
- Gemini: set `GOOGLE_GENERATIVE_AI_API_KEY` to your Google Generative AI API key.

To use Gemini from the UI or API, pass `provider=gemini` in the query string.

## Range Analysis Scheduler & Cron

This project ships with a CLI scheduler that executes `runRangeAnalysis` every 30 minutes, even when the Next.js server is not running.

### Requirements

- `.env.local` (or `.env`) containing the required secrets, at minimum:
  - `OPENAI_API_KEY` (or switch `provider` via CLI flags).
  - Optional: `GOOGLE_GENERATIVE_AI_API_KEY`, calendar credentials, etc.
- Dependencies installed via `pnpm install` so `pnpm run analyze:range` resolves `tsx` and other dependencies.

### Manual execution

```bash
pnpm run analyze:range            # single run (looks back 30 minutes by default)
pnpm run analyze:range -- --save-xml   # include XML persistence when needed
pnpm run analyze:range:scheduler  # legacy daemon-style scheduler; still available for interactive runs
```

The scheduler enforces a 30 minute window aligned to `HH:00` / `HH:30`. It skips overlapping runs and only writes XML when `saveXml` is enabled (CLI flag, env, or query param).

### Cron (macOS/Linux) auto-start

1. Use the in-repo wrapper located at `scripts/run-range-analysis-cron.sh`. It sets up PATH (Volta/PNPM aware), writes daily logs to `logs/run-range-analysis/`, and invokes `pnpm run analyze:range`.

   ```bash
   # One-off test
   bash scripts/run-range-analysis-cron.sh
   tail -f logs/run-range-analysis/$(date +%Y%m%d).log
   ```

2. Schedule it every 30 minutes aligned to `HH:00` and `HH:30` via `crontab`:

   ```bash
   crontab -l  # optional: inspect current entries
   (crontab -l 2>/dev/null; echo "0,30 * * * * /Users/<username>/src/github.com/wakamenori/activitywatch-util/scripts/run-range-analysis-cron.sh") | crontab -
   ```

   Cron uses a minimal environment, so the wrapper handles PATH/Volta automatically. Logs accumulate at `logs/run-range-analysis/YYYYMMDD.log`.

3. To disable or adjust the schedule, edit the crontab:

   ```bash
   crontab -e            # edit entries
   crontab -r            # remove all cron jobs for the current user
   ```

   After removing the job, you can delete the `logs/run-range-analysis/` directory if desired.

### Monitoring & troubleshooting

- Logs: `tail -f logs/run-range-analysis/$(date +%Y%m%d).log`
- Cron diagnostics (macOS): `log show --predicate 'process == "cron"' --last 1h`
- Calendar creation requires the relevant environment variables (`GOOGLE_CALENDAR_*`) and `--create` flag or env override.
