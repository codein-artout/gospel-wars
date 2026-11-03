# STATUS

Current milestone: **M20 Ship-ready: done.** All milestones are complete, and the "Done means" sequence has been run from a clean tree (results below).

## Milestones

| # | Milestone | State |
|---|---|---|
| 1 | Orient: specs read, STATUS/DECISIONS/CLAUDE.md | done |
| 2 | Scaffold: Next 16 + TS strict + Tailwind 4 + pnpm, ESLint/Prettier, Vitest, Playwright + axe, scripts, CI | done |
| 3 | Tokens, self-hosted fonts, AppShell, `/dev/components` | done |
| 4 | Shared components with states; RoseWindow geometry, keyboard and pulse; LeaningBar tests | done |
| 5 | Data model (Prisma 7), indexes on every FK, migrations on Postgres and PGlite | done |
| 6 | Rules engine (`lib/game`), exhaustive and property tests, GAME.md §6 worked example | done |
| 7 | Heresy linter, `fenceUntrusted`, moderation, 49 injection and 14 benign fixtures | done |
| 8 | LLM layer: Mock and Anthropic providers, versioned fenced prompts, retry/fallback, call budget | done |
| 9 | Tick engine: idempotent `runTick`, replay, season close, `pnpm tick`, cron route, admin button | done |
| 10 | Seed: 48 agents, 6 faiths, a human fork, agent schisms, 140 ticks, deterministic, about 25s | done |
| 11 | Auth: magic link (console without SMTP), dev login, admin allowlist, proxy, authorization helpers | done |
| 12 | The Nave `/` | done |
| 13 | Faiths `/faiths`, seasons `/seasons/[n]` | done |
| 14 | Faith page `/f/[slug]` and revision history | done |
| 15 | Write, edit, fork with live lint, diff, rules and rate limits | done |
| 16 | Encounter view, encounters index, agent profile, agents index | done |
| 17 | OG cards (three variants), share pages, post queue, admin console | done |
| 18 | Phone layouts, loading, error and not-found states, copy | done |
| 19 | Playwright e2e and axe on every page; visual review (`design-review.md` resolved) | done |
| 20 | `vercel.json`, Neon docs, README, TOKEN.md, clean-room verification | done |

## Commands

```bash
pnpm install
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm build
```

```bash
pnpm lint && pnpm typecheck
```

```bash
pnpm test
```

```bash
pnpm test:e2e
```

```bash
pnpm tick
```

Then `pnpm dev` and open http://localhost:3000. Dev login: `admin@gospelwars.test` (admin), `pilgrim@gospelwars.test` (no faith yet), or any prophet (`slowboil@`, `ledgerwitch@`, `moonclerk@`, `hingeworks@`, `latency_saint@`, `hotwater@` at `gospelwars.test`).

## Clean-room verification

Run on a fresh `git clone` of this branch (no `node_modules`, `.next`, `.pglite*` or generated client) with no app env vars set:

| Step | Result |
|---|---|
| `pnpm install` | ok (postinstall generates the Prisma client) |
| `pnpm db:migrate` | ok, 4s (PGlite) |
| `pnpm db:seed` | ok, 27s: 140 ticks, 2,626 encounters, 78 conversions, 1 human fork, 2 agent schisms, 2 heresy strikes, 75 boss resistances, 87 cards, 165 draft posts |
| `pnpm build` | ok, 25s, no warnings |
| `pnpm lint && pnpm typecheck` | ok, zero warnings |
| `pnpm test` | ok: 19 files, 392 passed, 1 skipped (the opt-in live LLM test) |
| `pnpm test:e2e` | ok: 13 passed, axe clean on every page |
| `pnpm tick` | ok: "Tick 141 done. 0 conversions. 24 encounters, …" |

Determinism: seeding the clean clone and this checkout gives the same world digest (`pnpm tsx scripts/dump.ts` → `994096ad2ae4e32a`).

## Known gaps

- PGlite is single-process: stop `pnpm dev` before `pnpm tick` or `pnpm db:seed` (the lockfile reports which process holds the database).
- The live Anthropic test is opt-in and was not run here (no key in this environment). Every LLM path is covered by the MockProvider and by retry/fallback tests with a failing provider.
- CI (`.github/workflows/ci.yml`) is written but has not been observed running on GitHub from this session.
- One public world per deployment; real social posting and tokens are out of scope for v1.
