# Handoff: RankCard — Profile Redesign + Shareable Rank Card

## Overview
RankCard aggregates a competitive gamer's ranks (League of Legends, Valorant, CS2) into one
clean, shareable profile. This handoff covers a **redesign** of the existing Next.js app:

1. **The interactive profile page** — the primary deliverable. Tabbed view (Overall + one tab
   per game), per-game detail (rank hero, stats, match history), and an "Add Game" connect modal.
2. **The shareable rank card** — the signature object: a single card summarizing all ranks,
   designed to be dropped as a link (`rankcard.gg/<user>`).
3. Three visual directions were explored (see the comparison file). **We are building Direction A
   ("Trophy Case" — refined premium dark)**, which extends the app's existing purple-on-black tokens.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the
intended look, layout, and behavior. They are **not** production code to copy verbatim. They are
authored in a lightweight in-house template format (`.dc.html`) and use inline styles; you should
**recreate them in the existing codebase** (Next.js 16 / React 19 / Tailwind v4) using its
established patterns and components.

Open them in a browser to interact with them:
- `RankCard Profile.dc.html` — the interactive profile (tabs, per-game views, Add Game modal).
- `RankCard Redesign (3 directions).dc.html` — a side-by-side comparison of directions A/B/C
  across landing hero, rank card, and profile. Reference only; **build Direction A**.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are specified below and in
the HTML. Recreate the UI pixel-accurately using the codebase's existing libraries (Tailwind v4
tokens already in `app/globals.css`, `lucide-react`, `chart.js`/`react-chartjs-2`,
`simple-icons` for game logos).

## Target Codebase Notes
- Framework: **Next.js 16 (app router), React 19, Tailwind CSS v4**.
- Existing tokens already match Direction A — see `app/globals.css`:
  `--background:#0a0a0f`, `--surface:#15151f`, `--accent:#b16cff`,
  `--text-primary:#f4f3f7`, `--text-secondary:#8a8a9a`, `--border:rgba(177,108,255,.25)`.
  The mock uses `#0b0b12`/`#14131f` surfaces — keep the existing tokens; they're equivalent.
- Components to refactor: `app/components/ProfileClient.jsx` (tabs + overall + per-game),
  `app/components/RankHero.jsx` (per-game hero), `app/components/RankBadge.jsx`,
  `app/components/AddGameModal.jsx` (already exists — **translate its German strings to English**
  and restyle per spec below), `app/page.jsx` (landing).
- Game logos: use `simple-icons` (already a dependency). The mocks use placeholder monograms
  (`LoL`, `VAL`, `CS2`) and geometric pentagon "emblem" placeholders — replace emblems with the
  real rank emblems the app already loads (e.g. communitydragon for League) where available.
- **Language: English everywhere.** The current `AddGameModal.jsx` is in German — translate it.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| Background | `#0a0a0f` / `#0b0b12` | page background |
| Surface | `#14131f` / `#15151f` | cards, panels, modal |
| Surface deep | `#0e0d16` | nested tiles inside cards, modal game buttons |
| Accent (purple) | `#b16cff` | primary actions, active states, rank score |
| Accent soft text | `#c9a6ff` | accent text on dark, links |
| Accent tint bg | `rgba(177,108,255,0.12)` | active tab / selected fills |
| Accent border | `rgba(177,108,255,0.16–0.5)` | accent outlines (lower = idle, higher = active) |
| Hairline border | `rgba(255,255,255,0.06–0.08)` | idle card borders |
| Text primary | `#f4f3f7` | headings, values |
| Text secondary | `#8a8a9a` | labels, meta |
| Positive (win) | `#4ade80` | win rate, win badge, +LP |
| Negative (loss) | `#f87171` | loss badge, −LP |

### Per-game accent colors
| Game | Hex | Monogram | Emblem gradient (placeholder) |
|---|---|---|---|
| League of Legends | `#C8AA6E` | `LoL` | `linear-gradient(160deg,#bfe3ff,#3f7bd6)` |
| Valorant | `#ff4655` | `VAL` | `linear-gradient(160deg,#ffd1a6,#e0556b)` |
| CS2 | `#4b9fff` | `CS2` | `linear-gradient(160deg,#cfe0ff,#3f63d6)` |

Game crest chip = 30×34px, `border-radius:9–10px`, bg `rgba(<accent>,0.14)`,
border `1px solid rgba(<accent>,0.4)`, monogram text in the accent color, `Geist 700 10–11px`.

### Typography
- **Sans:** Geist (already wired as `--font-geist-sans`). Weights used: 400/500/600/700/800.
- **Mono:** Geist Mono — used for handles, URLs (`rankcard.gg/luca`), KDA, and stat deltas.
- Scale: page name 26px/800; section values 30px/800 (overall metrics) and 20px/800 (stat tiles);
  tier headline 26px/800; body 13–14px; labels 11–12px; section eyebrows 11px/600 uppercase
  `letter-spacing:.14em` in text-secondary.

### Spacing / Radius / Shadow
- Radius: cards 16–18px, tiles 12px, chips/buttons 9–11px, avatar 24–26px, modal 22px,
  emblem uses `clip-path: polygon(50% 0,100% 30%,82% 100%,18% 100%,0 30%)` (pentagon).
- Card padding: 18–22px. Tile padding: 14px. Gaps: 8–12px.
- Banner gradient: `radial-gradient(ellipse 55% 130% at 20% 60%, rgba(177,108,255,.45), transparent 60%), linear-gradient(180deg,#1a1530,#0e0c18)`.
- Modal overlay: `rgba(5,4,10,0.65)` + `backdrop-filter: blur(3px)`.

---

## Screens / Views

### 1. Profile — header (shared across all tabs)
- **Layout:** centered column, `max-width:1000px`. Slim top nav (logo left, "Dashboard" + avatar
  right). Below: a **banner** (140px tall, rounded top, purple radial glow) with the **profile
  strip** card overlapping it (avatar pulled up `-48px`).
- **Avatar:** 100×100px, `border-radius:26px`, gradient `linear-gradient(150deg,#3f3265,#191525)`,
  3px `#14131f` border + `0 0 0 1px rgba(177,108,255,.4)` ring, monogram "L" 38px/800 `#c9a6ff`.
- **Name row:** "Luca" 26px/800 + `PRO` pill (10px/700 `#c9a6ff`, accent-tint bg, accent border,
  `border-radius:20px`). Sub-line in Geist Mono 13px text-secondary: `@luca · EUW · mid lane main…`.
- **Action:** "Share profile ↗" outline button (accent border, text-primary, `border-radius:11px`).

### 2. Tab bar (shared)
- Horizontal, `gap:8px`, wraps on narrow widths.
- Tabs: **Overall, League, Valorant, CS2**, then a dashed **"+ Add Game"** button.
- Game tabs show an 8px square dot in the game's accent color before the label.
- **Idle tab:** bg `#14131f`, border `rgba(255,255,255,.08)`, text `#8a8a9a`, weight 600.
- **Active tab:** bg `rgba(177,108,255,.12)`, border `rgba(177,108,255,.5)`, text `#f4f3f7`.
- **Add Game:** transparent, dashed accent border `rgba(177,108,255,.45)`, text `#c9a6ff`.
- All `border-radius:11px`, padding `9px 15px`, font 13px.

### 3. Overall tab
- **Section eyebrow:** "OVERALL PERFORMANCE" + hairline rule.
- **Metric grid:** 4 columns, `gap:12px`. Cards (`#14131f`, radius 16, padding 18):
  - `2,000` (accent `#b16cff`, 30px/800) — "Rank Score"
  - `61%` — "Avg Win Rate"
  - `2.47` — "Avg KDA"
  - `3` — "Games Connected"
  - First card uses accent border; rest hairline border.
- **Connected games:** eyebrow "CONNECTED GAMES" + rule, then 3-col grid.
  Each game card (clickable → switches to that game's tab):
  - 3px top bar in game accent color.
  - Crest chip + game name.
  - Pentagon emblem (46px) + tier (15px/700) + sub (e.g. "47 LP · Solo/Duo").
  - Footer: "`58%` WR" (green) left, "View details →" (accent) right.
  - Hover: border → `rgba(177,108,255,.4)`.
  - **Add Game card:** dashed accent card with "＋ / Add Game", opens the modal.

### 4. Per-game detail tab (League / Valorant / CS2)
Driven by the active game object; same layout for all three, content differs.
- **Eyebrow:** full game name uppercased (e.g. "LEAGUE OF LEGENDS").
- **Rank hero card** (`#14131f`, radius 18, padding 22, 3px top bar in game color):
  - Left: pentagon emblem 96px (game gradient) + shadow.
  - Center: tier headline (e.g. "Diamond II" 26px/800), sub-line "47 LP · Solo/Duo · Peak Diamond I",
    a **progress bar** (8px, track `rgba(255,255,255,.07)`, fill in game color, width = `barPct`),
    with min/max labels under it (e.g. "0 LP" … "Diamond I · 100 LP").
  - Right: "RECENT FORM" label + a row of 8 pips (18px squares, green=win `#4ade80`,
    red=loss `#f87171`).
  - Below: 4 **stat tiles** (`#0e0d16`, radius 12), value 20px/800 + label. Stats are game-specific:
    - League: Win Rate 58% · KDA 2.9 · CS/min 7.4 · Games 312
    - Valorant: Win Rate 64% · K/D 1.31 · Avg ACS 287 · Games 188
    - CS2: Win Rate 61% · K/D 1.18 · Avg ADR 94 · Games 240
- **Match history:** eyebrow "MATCH HISTORY" + rule, then a vertical list of match rows.
  Each row (`#14131f`, radius 12, `border-left:3px solid <win/loss color>`):
  - 36px square **W/L badge** (tinted bg in result color, letter in result color, 800/14px).
  - Title (champion/agent/map, 14px/700) + meta (role/map/mode) — fixed ~130px column.
  - KDA (Geist Mono) + secondary stat (CS / ACS / ADR), flex-grow column.
  - Right: **delta** (`+18 LP` green / `-16 LP` red, Geist Mono 700) + `duration · time ago`.
  - Sample match data is in the HTML logic (`data()` method) — 4 matches per game.

### 5. Add Game modal
- Fixed overlay (`rgba(5,4,10,.65)` + blur), centered card 460px wide (`#14131f`, radius 22,
  padding 26, accent border). Click overlay = close; click inside = stopPropagation.
- **Header:** "Connect a game" 19px/800 + sub "Pick a game and link your account." + ✕ close.
- **GAME grid:** 4 columns of selectable buttons — League, Valorant, CS2 (linked), Dota 2, Apex,
  Overwatch, TFT (placeholders), plus a dashed "+ soon" tile. Each: monogram chip + label.
  Selected = accent border + accent-tint bg; idle = hairline border on `#0e0d16`.
- **ACCOUNT:** two inputs — "Game name" (flex 2) + "# Tag" (flex 1), `#0b0b12` bg, hairline border,
  radius 11, focus → accent border. Helper text: "e.g. DinDjarin#1007 — we'll verify it before it
  goes live."
- **Footer:** "Cancel" (outline) + "Connect" (solid accent `#b16cff`, black text, glow
  `0 0 26px rgba(177,108,255,.4)`).
- Real behavior (from existing `AddGameModal.jsx`): on Connect, validate Riot accounts via
  `/api/summoner`, then insert into Supabase `connected_accounts`; non-Riot (Steam) skip tag/puuid.

### 6. The shareable rank card (signature object)
A self-contained vertical card summarizing all ranks — the thing a user links/shares. See the
"02 — THE SHAREABLE RANK CARD" frame, Direction A, in the comparison file. Structure:
avatar + name + `@handle · EUW` + `PRO` pill → big "RANK SCORE 2,000" with tier word "Elite" and a
weekly delta → 3 game rows (crest + tier + LP/sub + win rate + game count) → footer with
`rankcard.gg/luca` and a "Share ↗". Holographic top hairline
(`linear-gradient(90deg,transparent,rgba(199,155,255,1),transparent)`), radial purple glow.
This should render at a fixed shareable size and ideally have an OG-image / export variant.

---

## Interactions & Behavior
- **Tab switching:** `activeTab` state; clicking a tab or a connected-game card sets it. Overall vs
  per-game views are conditionally rendered.
- **Add Game modal:** `showModal` boolean; opens from the "+ Add Game" tab/button and the dashed
  Add Game card. `selectedGame`, `username`, `tag` controlled inputs. Connect closes + resets.
- **Hover:** connected-game cards brighten their border; buttons lighten text/border.
- **Responsive:** single centered column. On narrow widths the 4-col metric grid and 3-col game
  grid should collapse (2-col, then 1-col); the tab bar wraps; the rank-hero row wraps (emblem
  over info over form). Min touch target 44px.
- **No entry animations** are required (an opacity fade was intentionally removed — it caused
  flashes). Keep transitions subtle (border/color only).

## State Management
- `activeTab: 'overall' | 'league' | 'valorant' | 'cs2'`
- `showAddGame: boolean`
- `selectedGame`, `username`, `tag` (modal form)
- `connectedAccounts: Account[]` — fetched from Supabase; each `{ platform, platform_username,
  platform_tag, puuid }`. Per-game rank/match data is fetched per platform (e.g. `/api/summoner`
  for Riot). The mock uses static sample data — wire these to the real endpoints.

## Assets
- **Fonts:** Geist + Geist Mono (Google Fonts; app already uses Geist).
- **Game logos:** `simple-icons` package (dependency). Mocks use monogram placeholders.
- **Rank emblems:** real emblems via the app's existing source (e.g. communitydragon for League);
  mocks use geometric pentagon placeholders colored per game.
- **Avatar/banner:** user-uploaded avatar (existing `AvatarUpload.jsx`); banner is a CSS gradient.

## Files in this bundle
- `RankCard Profile.dc.html` — interactive profile prototype (tabs, per-game detail, modal). The
  `data()` method inside holds the exact sample copy (tiers, stats, matches) used in the mock.
- `RankCard Redesign (3 directions).dc.html` — comparison of Directions A/B/C (reference only).
  We are implementing **Direction A**.
