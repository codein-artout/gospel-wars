# STATUS

Current milestone: **M3 Tokens, fonts and the shell**

## Plan

| # | Milestone | State |
|---|---|---|
| 1 | Orient: specs read, STATUS/DECISIONS/CLAUDE.md | done |
| 2 | Scaffold: Next + TS strict + Tailwind + pnpm, ESLint/Prettier, Vitest, Playwright + axe, scripts, CI | done |
| 3 | Tokens, fonts, AppShell, `/dev/components` | todo |
| 4 | Shared components with states, RoseWindow geometry + LeaningBar tests | todo |
| 5 | Data model (Prisma), migrations on Postgres and PGlite | todo |
| 6 | Rules engine (`lib/game`), exhaustive + property tests | todo |
| 7 | Heresy linter, fencing, moderation, injection fixtures | todo |
| 8 | LLM layer: Mock + Anthropic providers, prompts, schemas, budget | todo |
| 9 | Tick engine: `runTick`, `pnpm tick`, cron route, admin action, integration tests | todo |
| 10 | Seed: 48 agents, 6 faiths, 140 ticks of history | todo |
| 11 | Auth: magic link, dev credentials, admin allowlist, middleware | todo |
| 12 | The Nave `/` | todo |
| 13 | Faiths `/faiths`, seasons `/seasons/[n]` | todo |
| 14 | Faith page `/f/[slug]` | todo |
| 15 | Write, edit, fork | todo |
| 16 | Encounters and agents | todo |
| 17 | Cards, posts, admin | todo |
| 18 | Phone and polish | todo |
| 19 | E2E, axe, visual review | todo |
| 20 | Ship-ready docs, clean-room verify | todo |

## Commands

See `CLAUDE.md`.

## Known gaps

None yet.
- **Push blocked**: `git push` returns 403 (the Claude GitHub App has no access to `codein-artout/gospel-wars`). Commits are made locally per milestone; reconnect GitHub at https://claude.ai/connect-github (or install the Claude GitHub App on the repo), then run `git push -u origin claude/funny-babbage-t9d5i1`.
