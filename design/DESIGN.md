# Gospel Wars: design spec

The look is **stained glass in a dark nave**. The world is a rose window: every agent is a pane of colored glass, and every faith is a glass color. When an agent converts, its pane changes color. Scripture (gospels and sermons) sits on vellum. Everything else stays quiet: dark violet ground, thin hairlines, plain sans-serif UI.

The rose window is where the design spends its boldness. Nothing else on any page competes with it.

## Primary references

These mockups are the source of truth. Build to match them; where the mockup and this file disagree, the mockup wins on look and this file wins on behavior.

| Screen | Static HTML (open in a browser) | Reference screenshots |
|---|---|---|
| The Nave (home, live world) | `mockups/html/Main.html` | `mockups/png/Main-1440.png`, `-1024`, `-390` |
| Faiths (season leaderboard) | `mockups/html/Faiths.html` | `mockups/png/Faiths-*.png` |
| Faith page (gospel, lineage, flock) | `mockups/html/Faith.html` | `mockups/png/Faith-*.png` |
| Encounter (sermon, rubric, roll) | `mockups/html/Encounter.html` | `mockups/png/Encounter-*.png` |
| Agent profile | `mockups/html/Agent.html` | `mockups/png/Agent-*.png` |
| Write a gospel (editor and heresy linter) | `mockups/html/Write.html` | `mockups/png/Write-*.png` |
| Phone: Nave, Encounter, Faith | `mockups/html/Phone*.html` | `mockups/png/Phone*-390.png` |
| Conversion card (OG image) | `mockups/html/Card.html` | `mockups/png/Card-1200x630.png` |

`mockups/source/*.dc.html` are the original design-canvas files. Read them only for the exact data and logic behind a screen. For example, `Main.dc.html` contains the rose-window geometry and the tick-advance demo.

The **desktop mockups at 1440 are primary**. The phone mockups show how the same screens collapse below 768px: a top bar, a bottom tab bar, and a single column.

## Tokens

Put these in `app/globals.css` as CSS variables and map them in `tailwind.config.ts`. Don't hard-code hex values in components.

### Ground and text

| Token | Hex | Use |
|---|---|---|
| `--nave` | `#191430` | Page background |
| `--nave-deep` | `#150F2A` | Sidebar, top bar, bottom tab bar |
| `--nave-well` | `#120D25` | Inputs, meter tracks, rose window interior |
| `--panel` | `#221B42` | Raised panels (selected agent, rubric) |
| `--panel-2` | `#2A2150` | Active nav item, selected segment |
| `--hairline` | `#332A57` | Dividers, sidebar edge |
| `--edge` | `#3A3163` | Panel borders |
| `--lead` | `#0E0A1E` | Lead came: the 2–8px borders around every piece of glass |
| `--text` | `#F3EFFA` | Primary text |
| `--text-2` | `#E4DEF2` | Body text on panels |
| `--muted` | `#C9C0E3` | Secondary text |
| `--faint` | `#B4AACF` | Meta text such as tick labels (passes 4.5:1 on `--nave`) |
| `--gold` | `#E7BE57` | Primary actions, prophets, boss lead, tick medallion, focus ring |
| `--gold-bright` | `#F6D98E` | Outcome headlines, conversion glow |
| `--vellum` | `#EFE6D2` | Scripture panels only (gospels, sermons) |
| `--ink` | `#2A2140` | Text on vellum |
| `--heresy` | `#FF6B4A` | Heresy underline; `--heresy-text #FFB4A0`, `--heresy-bg #2A1621` |
| `--grace` | `#9FD9C4` | Gains and passed checks; `--grace-bg #16302B` |

### Glass: faith colors

Each active faith gets one glass color from this fixed palette, picked by the prophet when publishing, first come first served. The palette caps active faiths at 12 (`maxActiveFaiths` in GAME.md). `Unaligned` is always pewter `#5B5478`.

| Name | Hex | Name | Hex |
|---|---|---|---|
| Cobalt | `#2F5FD8` | Rose | `#E06AA3` |
| Amber | `#EDA53A` | Olive | `#8AA33A` |
| Ruby | `#D8435F` | Sky | `#5BAEF0` |
| Violet | `#A57BEA` | Copper | `#C46A3A` |
| Emerald | `#2DA877` | Indigo | `#6A6FE8` |
| Teal | `#24A3B5` | Plum | `#9A4A95` |

A color never carries meaning alone. Every faith mark sits next to the faith's name, and panes have an accessible label. Boss panes use a pewter gradient (`#6B6390` to `#3A3360`) with a **double gold lead** (`3px double var(--gold)`). Faiths started by an agent use a **dashed gold lead**.

### Type

Load all three with `next/font/google`.

| Family | Role | Weights |
|---|---|---|
| **Grenze Gotisch** | Display: page titles, section titles, faith and agent names in headers, outcome banners, the wordmark, the tick number | 500–800 |
| **Instrument Sans** | All UI: nav, body, labels, tables, buttons, numbers (use `tabular-nums` for figures) | 400–700 |
| **Spectral** | Scripture only: gospel bodies, sermons, agent replies, memories | 400, 600, 400 italic |

Scale (px): 80 (agent name hero), 72 (faith hero), 56 (page title), 46, 34 (section title), 30–32 (panel title), 24, 18, 17, 15 (UI body), 14, 13 (meta), 12 (minimum). Gothic display never goes below 24px. The gospel editor textarea uses the system monospace stack, and that is the only monospace in the app.

### Shape and space

- Spacing on a 4px grid. Page padding is 28px top and 36px sides on desktop, 16px on phone. Gaps between sections are 28–36px.
- **Lancet** (`border-radius: 999px 999px 3px 3px`) is reserved for glass: rose-window panes, faith marks, rubric pips, glass color pickers, agent portraits.
- **Arch** (`border-radius: 160px 160px 6px 6px`, or 120px on phone) is reserved for scripture panels.
- Panels use 6px radius, controls 4px. No shadows except the conversion glow. No gradient washes, except the dark scrim over the faith hero's glass band.

## Components

Build these first, in `components/`, and show every one with its states on `/dev/components`.

- **AppShell**: a 220px sidebar (wordmark, nav, signed-in card at the bottom) plus content at 768px and up. Below 768px, a 60px top bar (wordmark and one action) plus a 72px bottom tab bar (Nave, Faiths, Encounters, Write).
- **PageHeader**: a meta line in `--faint` 14px, a gothic 56px title, and actions on the right. Actions wrap below on narrow widths.
- **RoseWindow**: the signature component. Takes agents (id, name, faith color, boss flag) and flock shares. Rings of 8, 16 and 24 panes at radii 17%, 29% and 41% of the diameter, with offsets 0°, 11.25° and 7.5°. Each pane is a rotated lancet `<button>`. The outer band is a conic gradient of flock share, the center medallion shows the tick number, and the window is fluid at `min(100%, 660px)` with a 1:1 aspect ratio. For world sizes other than 48, compute rings so each ring holds about 1.5× the previous one. Clicking a pane selects the agent. Arrow keys move between panes, Enter opens the profile.
- **GlassPane**, **FaithMark** (small lancet swatch plus name), **ShareBar**, **Meter** (labelled value bar), **LeaningBar** (with a dashed gold marker at the conversion threshold).
- **ChronicleList**: rows of tick, faith mark, sentence and kind label. Kind colors: Conversion gold, Schism text, Heresy flagged `--heresy-text`, Boss held muted, Agent preached grace.
- **FaithCard** (top-3 podium), **StandingsTable** (horizontal scroll inside its own box on narrow widths), **BossCard** (double gold border).
- **ScripturePanel**: an arch-topped vellum panel that renders gospel markdown with Spectral, a gothic H1, and a footer with revision, token count and the report button. Disputed doctrines (a line a schism changed) get an amber highlight and a note.
- **GospelEditor**: a textarea, token meter, live ScripturePanel preview, **HeresyLinter** panel (findings with line number, kind and a wavy `--heresy` underline), GlassColorPicker (lancet radios), ApostleStylePicker (segmented radio), and the invented-faith attestation checkbox.
- **SermonBlock** (vellum, lead border) and **ReplyBlock** (panel, indented 48px), **RubricTable** with 4 lancet pips per criterion, **RollLedger** (definition list of the deterministic math), **OutcomeBanner** (3px gold border, gothic headline, actions), **HeresyCheckNote** (grace when passed, heresy when flagged).
- **AgentHero** (lancet portrait in the faith color), **FaithJourneyStrip** (proportional lancet segments per faith over ticks), **TraitMeter**, **MemoryList** (Spectral entries with a faith-colored left rule; the summary line is in sans), **EncounterLog**.
- **LineageTree**: a vertical tree with indented children joined by a 2px rule. Human forks use a solid rule; agent-started schisms use a dashed rule and a dashed gold lead.
- **ConversionCard**: a 1200×630 OG image built with `next/og`, in three variants: conversion, schism and boss (see `Card.html`). Left is a lancet window split in two (old faith faded, new faith bright) with a gold medallion showing the sermon count. Right is the kicker, a gothic headline, a sermon quote, and the wordmark with the score line.
- Buttons: **primary** (gold fill, `#1C1430` text), **secondary** (gold outline), **quiet** (edge outline, text color). All are at least 44px tall. Also: SegmentedControl, Toast, EmptyState, ErrorState, Skeleton.

## Desktop layout (1440)

```
┌──────────────┬────────────────────────────────────────────────────────────────────────────┐
│ Gospel Wars  │ Season 1, the First Tithing. Tick 142 of 168.          [Advance tick][Write]│
│              │ The Nave  (gothic 56)                                                       │
│ The Nave  ◀  ├──────────────────────────────────────────────────┬─────────────────────────┤
│ Faiths       │                                                  │ ┌ Selected agent ─────┐ │
│ Agents       │              ╭──── flock-share band ────╮        │ │ ▮ Dolores           │ │
│ Encounters   │           ╭──╯  ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮  ╰──╮     │ │ persona             │ │
│ Write a      │          │  ▮   ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮   ▮   │     │ │ conviction ████░    │ │
│ gospel       │          │ ▮  ▮    ╭──────╮     ▮  ▮  │     │ │ skepticism ███░░    │ │
│              │          │ ▮  ▮    │ 142  │     ▮  ▮  │     │ │ "memory…"           │ │
│              │          │  ▮   ▮  ╰──────╯   ▮   ▮   │     │ └─────────────────────┘ │
│              │           ╰──╮  ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮ ▮  ╭──╯     │ Flock share             │
│              │              ╰─────────────────────╯        │ ▮ Faith A ███████ 26.7% │
│              │          (rose window, max 660px)          │ ▮ Faith B █████   20.0% │
│ ┌──────────┐ ├──────────────────────────────────────────────────┴─────────────────────────┤
│ │signed in │ │ Chronicle                                           See the latest encounter │
│ └──────────┘ │ Tick 142 ▮ Dolores left the Patient Kettle for …                 Conversion │
└──────────────┴────────────────────────────────────────────────────────────────────────────┘
   220px            content: flex 999 1 560px, padding 28/36; two columns wrap below ~920px
```

Other desktop pages follow the same shell. Faith, Encounter and Agent use a **3:2 split**: the main column (scripture or exchange) is `flex: 3 1 500px` and the side column (lineage, rubric, leanings) is `flex: 2 1 340px`, wrapping to one column when they don't fit. The Faith page opens with a full-width **glass band hero**: a row of faith-colored lancets at 55% opacity under a dark scrim, with the gothic name, stats and actions.

Breakpoints: at 768px and up, use the sidebar shell. Below 768px, use the phone shell: top bar, bottom tabs, single column, the rose window at full width minus 32px, and Encounter turns collapsed behind "Show all N turns". Tables scroll inside their box, and the page itself never scrolls horizontally.

## Motion

- **The one orchestrated moment is a conversion on the rose window.** When a tick lands, each converted pane cross-fades to its new glass color over 600ms and pulses a gold glow (`0 0 0 3px var(--gold-bright), 0 0 22px 4px rgb(246 217 142 / .55)`) for 1.2s. Conversions in one tick stagger by 120ms. The flock-share band eases its segments over 600ms.
- The OutcomeBanner on an Encounter page reveals once on load: the headline fades in over 300ms. Nothing else animates on load.
- Responses to actions: segment switch 150ms, toast slide 200ms, and the linter result updates as the user types (debounced 300ms) with no animation.
- `prefers-reduced-motion`: color changes are instant, and the glow becomes a static 2s gold outline. No staggers.

## Copy voice

The **world** speaks in a dry, ceremonial deadpan, as in "Brother Null heard the Second Moon and remained unmoved." The **interface** speaks plainly: sentence case, active verbs, no jokes in labels.

- Vocabulary, used consistently: **faith** (never "religion" in the UI), **gospel**, **prophet** (the human author), **apostle** (the house agent preaching a faith), **agent**, **flock**, **convert**, **schism**, **fork** (the action that makes a schism), **heresy**, **strike**, **tick**, **season**, **boss skeptic**, **chronicle**.
- Buttons name the action, and the result uses the same word: "Publish gospel" → toast "Gospel published." "Fork this faith" → "Fork published." "Advance tick" → "Tick 143 done. 3 conversions."
- Chronicle sentences are templated (see GAME.md): `{agent} left {from} for {to}.`, `{agent} joined {to}.`, `{faith} split from {parent} over doctrine {n}. {k} agents followed.`, `{boss} heard {faith} and remained unmoved.`, `A {faith} sermon tried to instruct the judge. Penalized and logged.`
- Errors state what happened and how to fix it: "This gospel is 1,612 tokens. Trim 112 to publish." Empty states invite action: "No faith yet. Write the first gospel."
- Numbers: "20.0%", "tick 142", "conviction 44". No middle dots between meta items; write sentences or use separate elements.

## Accessibility

- Text meets 4.5:1. `--faint` on `--nave` is the floor for small text, and `--ink` on `--vellum` is used for scripture.
- Every pane is a real `<button>` with an `aria-label` naming the agent and faith. The rose window has a text alternative: a visually hidden list of agents by faith.
- Focus ring: 2px `--gold` with a 2px offset everywhere. Heresy findings are announced with `role="status"`. The rubric pips carry `aria-label="3 of 4"`.
- Color is never the only signal. Faith marks always sit beside names, kinds are written out, and gains and losses say "Gained" and "Lost".

## Don'ts

- No cream page background and no parchment everywhere. Vellum is for scripture only.
- No all-caps labels, no eyebrow labels above every heading, no "A · B · C" meta strings, no `→` glued onto links, no emoji, no gradient washes on cards, no identical rounded-card grids with soft grey shadows.
- No real religions, real scripture, real religious figures, or real people in seed data, placeholders, or generated content.
- No crypto UI (wallets, prices, tokens) in v1.
- Don't animate entrances on every section. The conversion pulse is the only showpiece.
- Don't let an LLM's words appear as the outcome. Outcomes are stated by the rules engine; LLM text appears only as sermons, replies, memories and posts.
