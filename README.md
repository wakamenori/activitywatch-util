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

## Range Analysis Scheduler & LaunchAgent

This project ships with a CLI scheduler that executes `runRangeAnalysis` every 30 minutes, even when the Next.js server is not running.

### Requirements

- `.env.local` (or `.env`) containing the required secrets, at minimum:
  - `OPENAI_API_KEY` (or switch `provider` via CLI flags).
  - Optional: `GOOGLE_GENERATIVE_AI_API_KEY`, calendar credentials, etc.
- Dependencies installed via `pnpm install` so `pnpm run analyze:range:scheduler` can resolve `tsx`.

### Manual execution

```bash
pnpm run analyze:range            # single run (looks back 30 minutes by default)
pnpm run analyze:range:scheduler  # daemon-style scheduler; waits for next xx:00/xx:30
```

The scheduler enforces a 30 minute window and start times aligned to `HH:00` / `HH:30`. It skips overlapping runs and persists XML outputs under `./xml/`.

### LaunchAgent (macOS) auto-start

1. Create a wrapper script so macOS executes the scheduler with the correct PATH:

   ```bash
   mkdir -p ~/Library/Scripts
   cat <<'EOF' > ~/Library/Scripts/run-range-analysis-scheduler.sh
   #!/bin/zsh
   cd /Users/<username>/src/github.com/wakamenori/activitywatch-util
   /Users/<username>/.volta/bin/pnpm run analyze:range:scheduler
   EOF
   chmod +x ~/Library/Scripts/run-range-analysis-scheduler.sh
   ```

2. Install the LaunchAgent definition at `~/Library/LaunchAgents/com.matsukokuumahikari.activitywatch.range.plist`:

   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
     <dict>
       <key>Label</key>
       <string>com.matsukokuumahikari.activitywatch.range</string>
       <key>ProgramArguments</key>
       <array>
         <string>/bin/zsh</string>
         <string>-lc</string>
         <string>~/Library/Scripts/run-range-analysis-scheduler.sh</string>
       </array>
       <key>WorkingDirectory</key>
       <string>/Users/<username>/src/github.com/wakamenori/activitywatch-util</string>
       <key>EnvironmentVariables</key>
       <dict>
         <key>PATH</key>
         <string>/Users/<username>/.volta/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
       </dict>
       <key>KeepAlive</key>
       <true/>
       <key>RunAtLoad</key>
       <true/>
       <key>StandardOutPath</key>
       <string>/Users/<username>/Library/Logs/run-range-analysis-scheduler.log</string>
       <key>StandardErrorPath</key>
       <string>/Users/<username>/Library/Logs/run-range-analysis-scheduler.error.log</string>
     </dict>
   </plist>
   ```

3. Load the agent (run once after creating the plist):

   ```bash
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.matsukokuumahikari.activitywatch.range.plist
   ```

4. Restart it after code or config changes:

   ```bash
   launchctl kickstart -k gui/$(id -u)/com.matsukokuumahikari.activitywatch.range
   ```

5. Stop or remove it when needed:

   ```bash
   launchctl bootout gui/$(id -u)/com.matsukokuumahikari.activitywatch.range
   ```

### Monitoring & troubleshooting

- Logs: `tail -f ~/Library/Logs/run-range-analysis-scheduler.log` and `.error.log`.
- Verify status: `launchctl print gui/$(id -u)/com.matsukokuumahikari.activitywatch.range` should show `state = running`.
- Calendar creation requires the relevant environment variables (`GOOGLE_CALENDAR_*`) and `--create` flag (set in the LaunchAgent wrapper if needed).
