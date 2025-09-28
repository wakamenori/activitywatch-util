# AGENTS.md

This document tracks the guidance each automation agent should follow when working in this repository. Keep it synchronized with the companion agent-specific guides.

## Repository Snapshot

- ActivityWatch utility built with Next.js 15.5.0 (Turbopack) and React 19.1.0
- TypeScript 5 with Tailwind CSS 4 for styling
- better-sqlite3 12.2.0 provides **read-only** access to the ActivityWatch SQLite database
- Biome 2.2.0 handles formatting and linting; package manager is pnpm
- App Router lives under `src/`; supporting libs in `src/lib/`; types in `src/types/`

```
activitywatch-util/
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   │   └── database.ts
│   └── types/
│       └── activitywatch.ts
├── public/
├── biome.json
├── next.config.ts
├── tsconfig.json
└── package.json
```

### Common Operational Expectations

- Do not write to the ActivityWatch database; connections must remain read-only.
- Run `pnpm run format`, `pnpm run lint`, and `pnpm run typecheck` before committing substantial changes.
- Follow App Router conventions and keep all application code inside `src/`.
- Prefer functional React components with TypeScript annotations.

## Agent Directory

- **Claude Code**: See `CLAUDE.md` for Claude-specific instructions.
- **ChatGPT (Codex GPT-5)**: Active in the Codex CLI; follow the operating notes below.

## ChatGPT (Codex GPT-5) Operating Notes

### Command Execution

- All shell calls should use `shell(["bash", "-lc", ...], workdir=...)`; avoid `cd` by setting `workdir` explicitly.
- Prefer `rg`/`rg --files` for searches; fall back only if unavailable.
- Honor the current sandbox (`workspace-write`) and restricted network access; request escalation only when the task truly requires it.

### Editing & Style Constraints

- Default to ASCII; introduce other characters only if already present and necessary.
- Add concise comments only when they clarify non-obvious logic.
- Never revert or overwrite unrelated user changes; if unexpected edits appear, pause and ask for guidance.

### Planning Guidance

- Use the planning tool for multi-step or non-trivial tasks; skip it for the simplest ~25% of tasks.
- Plans must contain at least two steps and be updated after completing a planned step.

### Approvals & Sandbox Etiquette

- Approval policy is `on-request`: ask for escalated permissions when writes/tests require leaving the sandbox, performing destructive actions, or accessing the network.
- Provide a one-sentence justification whenever requesting escalated commands.

### Communication & Reporting

- Responses are plain text with lightweight structure; be concise and collaborative.
- Reference files with inline code paths (e.g., `src/lib/database.ts:42`).
- Lead code-change reports with the main outcome, then note per-file context.
- Summaries should mention remaining risks or suggested follow-up actions when relevant.

Keep this document current whenever agent behavior, tooling, or repository conventions change.
