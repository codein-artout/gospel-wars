# CLAUDE.md: working on Gospel Wars

Gospel Wars is a desktop-first web game. Humans (prophets) write a `gospel.md` for an invented faith; a house AI apostle preaches it to a persistent world of 48 AI agents; faiths compete for flock share over a 168-tick season.

**Rules engine decides, LLMs write.** Every state change (conviction, leanings, conversion, schism, strikes) comes from pure, seeded functions in `lib/game/`. LLMs only produce words (sermons, replies, memories, posts) and rubric integers that the engine clamps.

## Specs (read before changing behavior or look)

- `design/GAME.md`: exact rules. Every number is a key in `lib/game/config.ts` (`GameConfig`, zod-validated, overridable per world via `World.configOverrides`). Never hard-code a rule number elsewhere.
- `design/DESIGN.md`: tokens, type, components, layout, motion, copy voice, don'ts.
- `design/mockups/`: `html/` reference pages, `png/` reference screenshots (1440 primary), `source/` canvas files with sample data. Mockups win on look; specs win on behavior.
- Never edit anything under `design/`.

## Stack

Next.js 16 (App Router, Server Components, Server Actions) + TypeScript strict + Tailwind 4 (tokens as CSS variables in `app/globals.css`, mapped in `tailwind.config.ts`), pnpm. Prisma 7 with driver adapters: `@prisma/adapter-pg` when `DATABASE_URL` is set, PGlite (`pglite-prisma-adapter`, data in `.pglite/`) when it is not. Auth.js v5 (magic link that logs to the console without SMTP, plus a dev/test-only credentials provider). Vitest + fast-check, Playwright + axe. Fonts via Fontsource. Markdown via remark + rehype-sanitize rendered to React (no `dangerouslySetInnerHTML`).

## Commands

```
pnpm install
pnpm db:migrate        # applies prisma/migrations (PGlite or Postgres)
pnpm db:seed           # 48 agents, 6 faiths, 140 ticks of history (MockProvider)
pnpm dev               # http://localhost:3000
pnpm tick [--n 10]     # advance the world
pnpm lint && pnpm typecheck
pnpm test              # vitest unit + integration (PGlite in memory)
pnpm test:e2e          # playwright + axe against a copy of the seeded world
pnpm verify            # lint, typecheck, unit, build, e2e
```

With PGlite only one process can open `.pglite/` at a time. Stop `pnpm dev` before `pnpm tick` or `pnpm db:seed`, or use the admin "Advance tick" button.

## Architecture rules

- `lib/game/` is pure: no I/O, no `Date.now`, no `Math.random`. Randomness comes from `seed(worldSeed, tick, purpose, ...ids)` (xmur3 into sfc32). Exhaustive tests live in `tests/unit/game/`.
- `lib/llm/`: `LLMProvider.generate<T>(role, input, schema)`. `MockProvider` (deterministic, default) and `AnthropicProvider` (only with `ANTHROPIC_API_KEY`). All output is zod-validated; retry once, then fall back to Mock and mark `fallback`. Prompts are versioned modules in `lib/llm/prompts/`; untrusted text enters only via `fenceUntrusted()`, scalars only via `trusted()`. A test greps the prompts folder for violations.
- `lib/engine/`: `runTick(worldId)` loads state, calls pure rules and the LLM layer, writes in one transaction guarded by `(worldId, tick)` uniqueness and a world `stateVersion`.
- `lib/moderation/`, `lib/social/`: interfaces with mock/log implementations. No real posting, no token code.
- `lib/server/`: queries (no N+1: load with `include`/`in` batches) and server actions. Every mutation: zod-parse input, `requireUser()`/`requireAdmin()`, rate limit where GAME.md §14 says so.
- Components in `components/`, shown with their states on `/dev/components`.
- Copy voice: the world speaks in ceremonial deadpan; the interface speaks plainly. Vocabulary: faith, gospel, prophet, apostle, agent, flock, convert, schism, fork, heresy, strike, tick, season, boss skeptic, chronicle.

## Housekeeping

- Keep `STATUS.md` and `DECISIONS.md` current. One line per decision: decision, why, alternative rejected.
- Commit per milestone, push to the working branch.
