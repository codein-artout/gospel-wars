Build v1 of **Gospel Wars**, a desktop-first web game. Humans ("prophets") write a `gospel.md` for an invented faith. A house AI "apostle" preaches it to a persistent world of 48 AI agents. Agents hear sermons, argue back, remember, doubt and convert. Converts can preach, and agents can even start schisms of their own. Faiths compete for flock share over a 168-tick season, and every conversion becomes a shareable card. This is a real v1 for real users, not a demo.

## How to work (read first)

- **This is an unattended overnight run. Nobody will answer questions.** Never stop to ask. Make the reasonable call, record it in `DECISIONS.md` (one line each: decision, why, alternative rejected), and keep going.
- Work through **every** milestone below in order. Don't stop after scaffolding or after the core loop. End only when all milestones are done and every check in "Done means" passes. If something is truly impossible in this environment (for example, a browser download is blocked), document it in `STATUS.md` with what's left and how to finish it, then continue with everything else.
- **Keep `STATUS.md` current**: the milestone you're on, what's done, what's next, known gaps, and the exact commands to run. Update it at every milestone.
- **Commit and push after every milestone** with a clear message (`M7: llm layer with mock and anthropic providers`). Push to your working branch each time, so progress survives if the session ends.
- If the repo already contains app code from an earlier session, replace it. Keep `design/` untouched.
- Quality bar: production code. TypeScript strict end to end, zod on every input and every LLM output, authorization on every mutation, no N+1 queries, indexes on every foreign key and query path, and no `any` without a comment explaining it.

## Specs (non-negotiable)

- `design/GAME.md`: the exact rules. Every number in it is a key in one typed, zod-validated `GameConfig` in `lib/game/config.ts`, overridable per world from the DB. Never hard-code a rule number anywhere else.
- `design/DESIGN.md`: tokens, type, components, desktop layout, motion, copy voice, don'ts.
- `design/mockups/`: `html/` holds the static reference pages (open them), `png/` the reference screenshots at 1440, 1024 and 390, and `source/` the original canvas files with sample data and the rose-window geometry. **The desktop mockups at 1440 are primary.** Match them closely. Where the mockups and DESIGN.md disagree, the mockups win on look and the specs win on behavior.
- Read all three before writing code, and re-read the relevant section at the start of each milestone.

## Stack

- Next.js (App Router, Server Components, Server Actions where they fit) + TypeScript strict + Tailwind (tokens from DESIGN.md as CSS variables mapped in the Tailwind config), using **pnpm**.
- Prisma + Postgres. **Fallback**: when `DATABASE_URL` is unset, the app, seed and tests run on **PGlite**, through a Prisma driver adapter or a local PGlite socket server, whichever works reliably. Record the choice. A clean clone must run with zero external services.
- Auth.js v5 with the Prisma adapter: an email magic link provider (with no SMTP configured, it logs the link to the server console), plus a **credentials provider enabled only in development and test** for local login and e2e. Admins come from an `ADMIN_EMAILS` allowlist.
- Vitest (unit and integration, plus `fast-check` for property tests) and Playwright with `@axe-core/playwright`.
- Fonts self-hosted through Fontsource packages (Grenze Gotisch, Instrument Sans, Spectral), so the build never needs network font fetches.
- Markdown: `remark` + `rehype-sanitize`, never `dangerouslySetInnerHTML` on unsanitized input.
- Deploy target is **Vercel + Neon**: config and docs only, **no deploy**.

## Architecture rules

- **`lib/game/`** is the pure rules engine: no I/O, no Date.now, no Math.random. A seeded RNG (`xmur3` string hash into `sfc32` or `mulberry32`) is derived from `seed(worldSeed, tick, purpose, ...ids)`. Exports include `resolveEncounter`, `applyConversion`, `scheduleEncounters`, `schismPull`, `rollAgentSchism`, `decayAndRegen`, `checkPreacherEligibility`, `seasonClose`, `countTokens`, `lintGospel`, and the leaderboard ranking. Exhaustive unit tests: every rule, every threshold edge (just under, at, and just over), every apostle style, bosses, clamps, ties, determinism (same seed gives the same result; a different seed gives different noise), and the **worked example in GAME.md §6 as a named test**.
- **`lib/llm/`**: one interface, `LLMProvider.generate<T>(role, input, schema): Promise<T>`, with roles `sermon`, `reply`, `judge`, `memory`, `amendment`, `post` and `moderation`. `AnthropicProvider` is active only when `ANTHROPIC_API_KEY` is set (official SDK, model per role from config). `MockProvider` is deterministic from `hash(role, input)` with template banks, and is good enough that the game is fun to watch with no key. All outputs are zod-validated; retry once, then fall back to Mock and set `fallback = true`. Prompts are versioned modules in `lib/llm/prompts/`, and every untrusted string enters a prompt **only** through `fenceUntrusted()` (GAME.md §12). Include a test that fails if a prompt module interpolates user text without it. Enforce a per-tick call budget.
- **`lib/engine/`** is the tick runner. `runTick(worldId)` loads state, calls the pure rules, calls the LLM layer, and writes everything in a transaction-safe way. It is idempotent per `(worldId, tick)`. It is exposed as `pnpm tick` (with `--n 10` to run several), `POST /api/cron/tick` (`CRON_SECRET` bearer), and an admin "Advance tick" button.
- **`lib/social/`**: `SocialProvider` with `LogSocialProvider` only, a stub `XSocialProvider` that throws "not configured", and a draft post queue per agent with admin approve and discard. **No real posting.**
- **`lib/moderation/`**: a `Moderation` interface with `MockModeration` (denylists) and `LLMModeration` (only with a key).
- **No crypto token in v1.** Write `TOKEN.md` with ideas only (a single faith token, staking pools per faith, a bonding-curve launch, airdrops to participants), stating plainly that **it needs legal review before anything is built** and that no token code exists in this repo.

## Milestones (do all, in order)

1. **Orient.** Read the specs and mockups. Write `STATUS.md` (a plan with these milestones), `DECISIONS.md`, and a `CLAUDE.md` for future sessions (stack, commands, architecture rules, "rules engine decides, LLMs write").
2. **Scaffold.** Next.js + TS strict + Tailwind + pnpm, with ESLint and Prettier, Vitest, and Playwright + axe. Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `db:seed`, `tick`, `verify` (lint, typecheck, unit, build and e2e in one). Add `.env.example` and a GitHub Actions CI workflow running `pnpm verify` on PGlite.
3. **Tokens, fonts and the shell.** CSS variables and the Tailwind mapping from DESIGN.md, the three fonts, and an AppShell with a sidebar at 768px and up, plus the phone top bar and bottom tab bar below 768px. Start `/dev/components`.
4. **Shared components first,** all of DESIGN.md's component list, built and shown with their states (default, hover or focus, empty, loading, error, and long text) on `/dev/components`. The RoseWindow takes props and does the geometry from `design/mockups/source/Main.dc.html`, with keyboard navigation and the conversion pulse with reduced-motion handling. Add component tests for the RoseWindow geometry and the LeaningBar threshold marker.
5. **Data model.** A Prisma schema covering Auth.js tables, World (seed, config overrides, current tick), Season, Faith (palette color, founderType human or agent, parent, forkedAtTick, changedDoctrines, status, strikes, silenced, hidden), GospelRevision, Apostle (style, style changes), Agent (traits, faith, conviction, leanings JSON, status fields, boss, convertedAtTick, wins), AgentMemory and summary, Encounter (seed label, rubric scores, heresy, S, R, noise, pull, before and after values, outcome, fallback), EncounterTurn, ChronicleEvent, ShareSnapshot, ConversionCard, DraftPost, Report, Follow, RateLimitHit, TickRun (a unique `(worldId, tick)`), SeasonAward and AdminAction. Add indexes for every query path. Migrations should run on both Postgres and PGlite.
6. **Rules engine.** `lib/game/config.ts` with every GAME.md key, the seeded RNG, and all pure functions. Exhaustive tests as above, plus property tests: values stay in 0..100, at most one conversion per agent per tick, schism pull never exceeds `forkMaxPullRatio`, and the boss floor holds.
7. **Heresy and moderation.** `fenceUntrusted`, `lintGospel` (every pattern class in §12, NFKC normalization, line numbers), the real-faith denylist, and the moderation interface. Fixtures: at least 30 injection attempts in `tests/fixtures/injections/`, all flagged (directly by the linter, or paraphrased by the Mock judge), and at least 10 benign narrative uses, none flagged.
8. **LLM layer.** Provider interface, MockProvider, AnthropicProvider, prompts per role, zod schemas (judge output exactly per §6, including `bestLine`), retry and fallback, and the call budget. Tests run entirely on Mock. Add one opt-in live test, skipped without a key.
9. **Tick engine.** `runTick` following the exact order in §5, with idempotency, `pnpm tick`, the cron route, and an admin action. Integration tests on PGlite: a tick produces encounters, chronicle events and share snapshots; running the same tick twice is a no-op; and replaying a stored encounter gives an identical result.
10. **Seed.** `pnpm db:seed` builds the world from the mockup data: 48 agents with the mockup names and 3 bosses, the 6 faiths and prophets from the mockups (Final Spreadsheet, Patient Kettle, Second Moon, Open Door, Unbuffered, and Reformed Kettle as a fork of Patient Kettle), full invented gospels for each, demo users (one per prophet, plus an admin and a plain follower), and then **runs 140 ticks** on MockProvider so the world has rich history on first load: conversions, at least one human fork and one agent-started schism (pick seeds or nudge config in the seed only, never in the engine), heresy strikes, boss resistances, cards and draft posts. It's deterministic: the same seed gives the same world. It must finish in under 2 minutes.
11. **Auth.** Magic link, the dev-only credentials provider, the admin allowlist, middleware, sign-in and sign-out pages in the design language, and authorization helpers used by every mutation.
12. **The Nave** (`/`): a live RoseWindow from DB state, the selected agent panel, flock share, chronicle, an "Advance tick" button for admins only, and auto-refresh when a new tick lands (poll a lightweight tick endpoint every 30s). Match `Main.html` at 1440.
13. **Faiths** (`/faiths`): podium, standings table, season and all-time toggle, boss cards, and season archive pages (`/seasons/[n]`) with awards.
14. **Faith page** (`/f/[slug]`): glass band hero, ScripturePanel rendering the current revision (sanitized markdown, disputed doctrines highlighted), revision history, lineage tree (human forks solid, agent schisms dashed), flock, recent moves, Follow, Fork this faith, and Report. Match `Faith.html`.
15. **Write, edit and fork** (`/write`, `/f/[slug]/edit`, `/f/[slug]/fork`): the editor with live lint (debounced, findings with line numbers), token meter, preview, glass color picker (taken colors disabled), apostle style picker, attestation, and publish. Enforce edits per season, cooldowns, one active faith per user, the Narthex queue past `maxActiveFaiths`, rate limits, and on forks the diff view with `forkMinChangeRatio` and the schism pull on publish. Match `Write.html`.
16. **Encounters and agents** (`/e/[id]` encounter view, `/encounters` index, `/a/[slug]` agent profile, `/agents` index): the exchange, RubricTable, RollLedger (show every number from the stored roll), heresy note, outcome banner, the draft post; and on profiles the faith journey strip, temperament, leanings with the threshold marker, memory, and encounter log. Match `Encounter.html` and `Agent.html`.
17. **Cards, posts and admin.** OG images at `/api/card/[eventId]` with `next/og` in all three variants (match `Card.png`), share pages with OG meta, and `generateMetadata` on encounter and faith pages. Admin at `/admin`: advance or run N ticks, replay encounter, reports queue (auto-hide at the threshold), the post queue (approve to the log provider, discard), config overrides editor (zod-validated), hide, silence and ban.
18. **Phone and polish.** Phone layouts per `Phone*.png`. Empty, loading (skeleton) and error states on every page. Error and copy text in the DESIGN.md voice. Accessibility: keyboard paths through everything, a visually hidden list alternative for the rose window, visible focus rings, `role="status"` on lint results. Rate limits wired up and tested.
19. **E2E and visual check.** Playwright e2e on the seeded PGlite world: browse the Nave, select a pane, open an agent, open an encounter; sign in (dev credentials), write a gospel, see a lint error, fix it, publish, then see it on Faiths; as admin, advance a tick and see the chronicle update; fork a faith; report a gospel; and fetch an OG card that returns 200 `image/png`. Run axe on every page with zero serious or critical violations. Then take screenshots of every page at **1440, 1024 and 390** and compare them side by side with `design/mockups/png/` (look at both images). Write `design-review.md` listing each gap and fix every one that's fixable. Repeat until the screens match.
20. **Ship-ready.** `vercel.json` with the cron (hourly `/api/cron/tick`), a Neon setup section in the README, `.env.example` complete, `TOKEN.md`, and a README with what the game is, setup in 3 commands, scripts, the env vars, an **architecture diagram (Mermaid)** showing UI to server actions and routes to the engine to the rules (pure), plus LLM providers, moderation and the social queue, then Prisma to Postgres or PGlite. Also cover how to add a real key, and known limitations. Finally, delete `node_modules` and `.next`, then run the full "Done means" sequence from scratch.

## Done means

All of these pass, from a clean clone with **no env vars and no external services** (PGlite and MockProvider):

```
pnpm install
pnpm db:migrate
pnpm db:seed        # world with 140 ticks of history
pnpm build
pnpm lint && pnpm typecheck
pnpm test           # unit + integration, all green, rules engine exhaustively covered
pnpm test:e2e       # Playwright + axe, all green
pnpm tick           # advances one tick and prints a summary
```

And:

- `pnpm dev`, then opening `/`, shows the seeded rose window, chronicle and flock share matching `Main.png` at 1440.
- Every page has been compared against the mockups at 1440, 1024 and 390, and `design-review.md` is resolved.
- The worked example from GAME.md §6 is a passing test; replaying any stored encounter is identical; and all injection fixtures are flagged with no false positives on the benign set.
- No real posting, no token code, no deploy. `README.md`, `STATUS.md`, `DECISIONS.md`, `CLAUDE.md` and `TOKEN.md` are up to date, and everything is committed and pushed.
