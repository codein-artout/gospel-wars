# Design review

Every page was screenshotted at 1440, 1024 and 390 (`node scripts/screenshots.mjs <baseUrl>`) and set side by side with `design/mockups/png/` (`python3 scripts/compare.py`, output in `screenshots/compare/`). Phone (390) builds are compared with the `Phone*-390` mockups where they exist (Nave, Faith, Encounter), and with the desktop pages at 390 otherwise. Data differs by design: the build shows the seeded world at tick 140, the mockups show sample data at tick 142.

Status: **resolved**. Every fixable gap below is fixed. The rest are deliberate deviations where a spec rule wins over the mockup, and each lists that rule.

## Gaps found and fixed

| Page | Width | Gap | Fix |
|---|---|---|---|
| All | all | Links had no underline (Tailwind preflight reset it) | Base `a` style underlines, `text-underline-offset: 2px` |
| All | all | Unlayered base styles overrode Tailwind utilities, so nav links were gold | Base and component CSS moved into `@layer base` / `@layer components` |
| Shell | 1440 | Sidebar border stopped at the viewport height on long pages | The sidebar column carries the border and background; only its inner nav is sticky |
| Nave | 1440 | Boss-held chronicle rows used the gold boss lead; the mockup uses a plain pewter mark | Boss-held rows use the plain lead |
| Nave | 1440 | Empty agent-founded faiths listed as "0 agents, 0.0%" in Flock share | The Nave lists faiths with a flock; empty ones stay on Faiths |
| Nave | 390 | Ring guide circles drawn on phone (absent in PhoneNave) | Guides hidden below 768px |
| Nave | all | 46 panes (founders had left the window) | Founders keep their pane (dashed gold lead, "founder of …"); only share excludes them |
| Faith | 390 | The long "Disputed: …" note pushed doctrines apart; PhoneFaith shows the highlight only | Note hidden below 768px, highlight kept |
| Faith | 390 | Fork and Follow buttons were different widths | Equal-width hero buttons on phone |
| Faith | all | The seeded fork disputed doctrines 3, 4 and 5; the mockup disputes doctrine 4 | `reformed-kettle.md` changes only doctrine 4 among the parent's doctrines (53% of lines still change) |
| Encounter | all | The ledger showed "New conviction: 0" after a conversion | The engine stores the post-conversion conviction in `Encounter.convictionAfter` |
| Encounter | all | Sermon speaker labels were 4.4:1 on vellum (axe) | Faith color mixed 42% into ink: 5.0:1 or better for every palette color |
| Encounter | all | Mock replies quoted the sermon's opening line, with nested straight quotes | Quotes pick a clean sentence; mock banks use curly quotes and close quoted fragments |
| Agent | all | Leaning labels were 3.5:1 on bright fills (axe) | Fills at 55% opacity: 4.8:1 or better for every palette color |
| Agent | all | Eight zero-value leaning bars | Only leanings above 0, plus the current faith at its conviction |
| Agent | all | Memories nested double quotes inside the panel quote | Memories quote with single curly quotes |
| Write | 1440 | 12 glass lancets wrapped onto two rows | 20×36 lancets, 5px gap: one row |
| Write | 390 | Empty name said "This one is 0" | "Name your faith." |
| Card | 1200×630 | (matches Card.png) | Quote prefers a doctrine line over a persona line |

## Deliberate deviations (spec wins on behavior)

| Page | Mockup | Build | Why |
|---|---|---|---|
| Nave | "Advance tick" shown in the header | Shown to admins only | Build prompt M12: "an Advance tick button for admins only" |
| Shell | "Signed in as @ledgerwitch" card | Real session state ("Not signed in" when signed out) | Live data |
| Faith | `@slowboil` is a link | Plain text | No public user pages in v1; the mockup links to the agent page as a placeholder |
| Desktop pages at 390 | Desktop layout reflowing, the sidebar on top | Phone shell: 60px top bar, 72px bottom tabs | DESIGN.md: below 768px use the phone shell |
| Write | Preview shows the first doctrines | Preview renders the whole gospel | The preview must show everything that will be published, including lines that would be heresy |
| Write | No apostle name field | Optional "Apostle name" field | GAME.md §4: the prophet names the apostle at publish |
| Write | 6 glass colors | All 12 palette colors, taken ones dimmed and disabled | DESIGN.md palette of 12 and the build prompt's "taken colors disabled" |
| Standings | 7 rows | Includes agent-founded faiths | They are active faiths in the season |
| Encounter | Header meta has no fallback note | "Some text came from the fallback writer." when `fallback` | GAME.md §5: fallbacks are marked |

## Accessibility pass

Playwright runs axe (WCAG 2.0/2.1 A and AA) on every page, desktop and phone, signed in and out: zero serious or critical violations (`tests/e2e/5-a11y.spec.ts`). Keyboard paths were checked: panes are buttons with a roving tabindex (arrows move, Enter opens the profile), every control is reachable, and the focus ring is a 2px gold outline with a 2px offset. Lint results announce through `role="status"`, and the rose window has a visually hidden list of agents by faith.
