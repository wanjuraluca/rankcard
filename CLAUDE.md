# RankCard – Project Context

## What it is
RankCard is a SaaS web app where gamers connect their accounts (League of Legends, Valorant, CS2, more planned) and get one shareable profile link showing their real ranks across games. Built as both a portfolio piece (for an apprenticeship application) and a planned SaaS business with recurring revenue. Inspired by Marc Lou's lean indie-SaaS approach.

**Live:** rankcard-1awq.vercel.app (personal profile: /Luca)
**Domain:** rankcard.app (Porkbun, DNS + SSL configured via Vercel)
**Repo:** github.com/wanjuraluca/rankcard
**Local path:** C:\Users\lucaw\OneDrive\Dokumente\JavaScript\rankcard\rankcard-next

## Tech stack
React + Next.js (App Router) + Supabase + Stripe (planned) + Vercel. Tailwind CSS v4. Next.js 16.x.

## Working preferences
- **Language:** Chat in German, but ALL code strictly in English — comments, placeholder text, UI strings, error messages, variable names. Everything in the code is English.
- **Learning style:** Learn by doing, not tutorials/reading. Explain concepts with everyday analogies, not code comparisons. Give hints rather than full solutions — only show complete code when genuinely stuck.
- **Styling:** Tailwind utility classes over inline style={{}} objects.
- **Commits:** Conventional Commits (feat:, fix:, refactor:) with imperative English descriptions.
- **Database/SQL:** Don't delegate DB/SQL tasks to the user — handle them directly (the user dislikes DB work). When a Supabase dashboard action is needed (e.g. RLS policy), give exact click-by-click steps.
- **Applications sensitivity:** User is sensitive about AI-generated work looking obviously AI — give things he understands and can make his own.

## Design system
- Background: #0a0a0f / #0b0a10
- Surface: #15151f
- Accent: #b16cff (purple)
- Tailwind tokens in globals.css: bg-background, bg-surface, border-line, text-accent, text-text-primary, text-text-secondary
- Fonts: Bricolage Grotesque / Hanken Grotesk / JetBrains Mono

## Key files & structure
- `app/[username]/page.jsx` — Server Component, fetches profile + accounts from Supabase, passes as props
- `app/components/ProfileClient.jsx` — Client Component, holds all profile UI + tab system (overall / league / valorant / add-game modal trigger)
- `app/components/RankBadge.jsx` — fetches + shows tier+rank for a connected account (own useEffect fetch per account)
- `app/components/RankHero.jsx` — large LoL rank card (emblem via Community Dragon CDN, tier, LP, progress bar, win rate, games)
- `app/components/AddGameModal.jsx` — modal to connect a new account (game grid from platformConfig, Riot validation, Supabase insert)
- `app/components/AvatarUpload.jsx` — avatar upload to Supabase Storage
- `app/api/summoner/route.js` — Riot API (League + TFT) + Henrik Valorant API; returns { puuid, rankData, tftData, valorantData }
- `lib/platforms.js` — platformConfig (name, shortName, icon via simple-icons, color, inputType: 'riot'|'steam')
- `lib/supabase.js` — supabase client (import { supabase } from "@/lib/supabase")

## Supabase
Tables: `profiles`, `connected_accounts`, `game_stats`.
- `connected_accounts` columns: id, user_id (uuid), platform (text), platform_username (text), platform_tag (text), puuid (text), created_at
- RLS enabled. INSERT policy on connected_accounts: `auth.uid() = user_id` (authenticated role). SELECT/Storage policies configured.
- Profile auto-created on signup via DB trigger `handle_new_user()` (SECURITY DEFINER), username passed through signUp options.data.

## Riot API notes
- Dev API key expires every 24h → must regenerate at developer.riotgames.com, replace RIOT_API_KEY in .env.local, restart `npm run dev`. In Vercel: Settings → Environment Variables → replace + redeploy.
- League uses platform routing (euw1) for rank/league endpoints, but continental routing (europe) for account lookup AND match-history.
- Match-history endpoints (for KDA, CS/min, top champions, recent games — all NOT in the rank endpoint):
  - Match IDs: `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20`
  - Match details: `https://europe.api.riotgames.com/lol/match/v5/matches/{matchId}` → info.participants[] (find own puuid)
- Rank emblems (no key needed): `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-{tier-lowercase}.png`

## env vars (.env.local)
RIOT_API_KEY (expires daily), VAL_API_KEY (Henrik), Supabase URL + anon key. (STEAM_API_KEY planned for CS2.)

## Config notes
- `next.config.js` (NOT .ts — JS project). Needs `turbopack: { root: __dirname }` because nested package-lock.json files exist in the OneDrive path (Dokumente/, rankcard/, rankcard-next/) and Next.js otherwise picks the wrong workspace root.
- `images.domains` is deprecated → migrate to `images.remotePatterns` (will need ddragon.leagueoflegends.com domain for champion icons later).
- Chart.js + react-chartjs-2 installed (for LP-history graph, not yet built).

## Current status (June 2026)
WORKING end-to-end: auth flow (register → email confirm → login → profile redirect), profile page with tabs, RankBadge live ranks in Overall tab, LoL tab with RankHero live data, AddGameModal full connect loop (select game → validate via Riot → insert into DB → instant UI update via state, no reload).

## Known open bugs / cleanup
- RankHero uses `rankData[1]` (hardcoded index) to pick Solo/Duo queue — SHOULD use `.find(e => e.queueType === "RANKED_SOLO_5x5")` before launch (index is unreliable, breaks for other accounts).
- Duplicate account prevention missing (same account can be connected twice).
- Connected-games card shows `{username}#{tag}` → renders "name#null" for Steam/CS2 (no tag). Needs conditional display.
- AddGameModal still has German UI strings (Spiel verbinden, etc.) — should be translated to English.
- LP progress bar uses leaguePoints directly as width % — fine for 0-100 LP within a division, verify edge cases.
- "Next division" label in RankHero shows current division as placeholder, not the actual next rank.

## Roadmap highlights (not launch-blocking unless noted)
- BLOCKER (pre-launch): Riot account VERIFICATION (proving you own the account) — via RSO (needs Riot production key approval) or Plan B code-verification flow. Current connect is trust-based (anyone can claim any account) which is OK for now.
- Match-history API integration (KDA, CS/min, vision, top champions, recent games) — needed for full LoL tab + reusable for "recent games" list.
- LP-history chart (Chart.js installed, needs historical data storage).
- Connect flow for Valorant (Henrik) + CS2/Steam.
- Rank Score system: percentile-based (top X% → score on 0-3000 scale), self-calibrating via rank distribution. Overall = average of percentile scores. Do NOT hardcode.
- Pre-launch must: custom SMTP (Resend) + Supabase Site-URL → rankcard.app, username uniqueness constraint, Impressum/Datenschutz/AGB (German DSGVO obligation), OG images (critical — core pitch is "share one link"), Stripe, mobile responsiveness, cache ranks in game_stats (perf + rate limits), replace alert() with inline error UI.
