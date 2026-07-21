import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getLeagueScore, getValorantScore, getCs2Score, getTftScore, getOverwatchScore, getMarvelRivalsScore, estimateMarvelRivalsRankFromScore } from '@/lib/rankScore'
import { markServiceDown, markServiceUp } from '@/lib/serviceStatus'
import { detectRouting } from '@/lib/riotPlatform'

// A background cache refresh occasionally hits a transient Riot/Henrik
// hiccup (rate limit, brief 5xx, or an expired dev key — "Unknown apikey",
// 401) and gets back either an empty match-history array or, for rankData/
// tftData specifically, a JSON error object like {"status":{"status_code":
// 401,...}} instead of an array — Riot's error responses are still valid
// JSON, so nothing upstream throws on this. Without this guard, that broken
// result gets written straight into account_cache and served as truth for
// up to DB_CACHE_STALE_MS: a real "Platinum IV" flashes to "Unranked" until
// the next refresh happens to succeed. Keep the previous good value for any
// of these fields instead of trusting a fetch that came back non-array
// (rankData/tftData must always be arrays when valid, per extractGameStats)
// or suspiciously emptier than what we already had.
function withStaleArrayGuard(previous, fresh) {
  if (!previous) return fresh
  const guarded = { ...fresh }
  for (const key of ['matchHistory', 'valorantMatchHistory', 'tftMatchHistory', 'rankData', 'tftData', 'valorantMmrHistory', 'cs2MatchHistory', 'mrMatchHistory']) {
    const hadGoodData = Array.isArray(previous[key]) && previous[key].length > 0
    const freshIsBroken = !Array.isArray(guarded[key]) || guarded[key].length === 0
    if (hadGoodData && freshIsBroken) {
      guarded[key] = previous[key]
    }
  }
  // Same idea for the single-object rank fields (Valorant/Overwatch/Marvel
  // Rivals/CS2): a transient failure normally comes back as null instead of
  // throwing (see fetchOverwatchData's OVERWATCH_EMPTY_RESULT, etc.), so
  // without this a real rank would flash to "Unranked" for a full
  // DB_CACHE_STALE_MS window. Keep the previous value if we had one and the
  // fresh fetch came back empty.
  for (const key of ['valorantData', 'owRanks', 'mrRank', 'cs2Profile', 'owStats', 'mrOverallStats', 'mrStats']) {
    if (previous[key] && !guarded[key]) {
      guarded[key] = previous[key]
    }
  }
  return guarded
}

// Piggybacks on data we already fetched live (no extra Riot calls) to keep
// lp_history/tft_lp_history fresh throughout the day, not just once via the
// daily snapshot-lp cron — so the LP chart moves the same day you play,
// not just tomorrow. Same upsert shape as app/api/cron/snapshot-lp/route.js,
// just triggered opportunistically on profile views instead of on a timer.
async function snapshotLpHistoryLive(platform, accountId, data) {
  try {
    const recordedOn = new Date().toISOString().slice(0, 10)
    if (platform === 'League of Legends') {
      const soloDuo = Array.isArray(data.rankData)
        ? data.rankData.find(e => e.queueType === 'RANKED_SOLO_5x5')
        : null
      if (!soloDuo) return
      await supabaseAdmin.from('lp_history').upsert({
        connected_account_id: accountId,
        tier: soloDuo.tier,
        rank: soloDuo.rank,
        league_points: soloDuo.leaguePoints,
        wins: soloDuo.wins,
        losses: soloDuo.losses,
        recorded_on: recordedOn
      }, { onConflict: 'connected_account_id,recorded_on' })
    }
    if (platform === 'TFT') {
      const entries = Array.isArray(data.tftData)
        ? data.tftData.filter(e => e.queueType === 'RANKED_TFT' || e.queueType === 'RANKED_TFT_DOUBLE_UP')
        : []
      await Promise.all(entries.map(entry =>
        supabaseAdmin.from('tft_lp_history').upsert({
          connected_account_id: accountId,
          queue_type: entry.queueType,
          tier: entry.tier,
          rank: entry.rank,
          league_points: entry.leaguePoints,
          wins: entry.wins,
          losses: entry.losses,
          recorded_on: recordedOn
        }, { onConflict: 'connected_account_id,queue_type,recorded_on' })
      ))
    }
  } catch {
    // Best-effort — never let LP-history snapshotting break the profile fetch.
  }
}

// Several components on the same profile page (Overall tab, the connected-
// games card, the per-game tab) each independently request the same
// account, multiplying calls to Henrik's rate-limited Valorant API. This
// short-lived in-memory cache collapses those near-simultaneous duplicate
// requests into one. It's per-server-process (not shared across Vercel
// lambdas), so it stays alongside the DB cache below as a cheap first line
// of defense against duplicate near-simultaneous requests.
const CACHE_TTL_MS = 45_000
const requestCache = new Map()

// DB-level cache (account_cache table) for the unfiltered (no mode) request —
// this is what RankBadge/Overall-tab/per-game-tab all load on page open, and
// what made profiles feel slow (several sequential Riot/Henrik/Leetify calls
// every single visit). Mode-filtered requests (user picked "Ranked Flex" etc.)
// always go live since they're an explicit, infrequent user action.
const DB_CACHE_STALE_MS = 30 * 60 * 1000

// accountId is only ever meant to be the caller's own connected_accounts.id,
// used purely as the account_cache key (see ProfileClient.jsx's fetch call —
// it always sends id/platform/name/tag from the same row). But since it's a
// client-supplied query param, nothing stopped someone from passing a
// different (real) accountId alongside an arbitrary platform/name/tag,
// silently overwriting a stranger's cached rank data with whatever that
// request fetched live. Confirm the id actually belongs to this
// platform/name/tag before trusting it for either the cache read or write.
async function verifyAccountOwnership(accountId, platform, name, tag) {
  const { data: row } = await supabaseAdmin
    .from('connected_accounts')
    .select('platform, platform_username, platform_tag')
    .eq('id', accountId)
    .maybeSingle()
  if (!row) return false
  return (
    row.platform === platform &&
    row.platform_username?.toLowerCase() === name?.toLowerCase() &&
    (row.platform_tag ?? '').toLowerCase() === (tag ?? '').toLowerCase()
  )
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const tag = searchParams.get('tag')
  const platform = searchParams.get('platform')
  let accountId = searchParams.get('accountId')
  if (accountId && !(await verifyAccountOwnership(accountId, platform, name, tag))) {
    accountId = null
  }
  // Reused for both games' mode filters since a single request only ever
  // targets one game — Valorant's is a mode slug (e.g. "competitive"),
  // League's is a numeric Riot queue ID (e.g. 420 for Ranked Solo/Duo).
  const mode = searchParams.get('mode') || null
  // On-demand single-match detail fetch (Marvel Rivals only) — the account-level
  // match_history response has no team/opponent data, so the Hero component
  // lazily requests the full scoreboard only when a match row is expanded,
  // same UX as Valorant/League's expand-to-see-scoreboard but fetched live
  // instead of pre-embedded, since Marvel Rivals' match-history endpoint
  // doesn't include other players.
  const matchId = searchParams.get('matchId')
  if (platform === 'Marvel Rivals' && matchId) {
    return Response.json(await fetchMarvelRivalsMatchDetail(matchId))
  }

  const cacheKey = `${platform}:${name}:${tag}:${mode}`.toLowerCase()
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json(cached.data)
  }

  // Overwatch tracks its own up/down status internally (fetchOverwatchData),
  // since it can distinguish a normal "battle tag not found" 404 from a real
  // OverFast/Blizzard outage. The other platforms don't make that
  // distinction yet, so here we only treat a thrown/rejected fetch (network
  // error, DNS failure, timeout) as a real outage — a bad account name
  // normally comes back as a resolved (if empty) response, not a throw.
  async function fetchLive() {
    if (platform === 'Overwatch') return await fetchOverwatchData(name, tag)

    const service = platform === 'CSGO' ? 'cs2' : platform === 'Marvel Rivals' ? 'marvel-rivals' : 'riot'
    try {
      const result = platform === 'CSGO' ? await fetchCs2Data(name)
        : platform === 'Marvel Rivals' ? await fetchMarvelRivalsData(name)
        : await fetchSummonerData(name, tag, mode)
      await markServiceUp(service)
      return result
    } catch (err) {
      await markServiceDown(service, err.message)
      throw err
    }
  }

  // Only the unfiltered request is DB-cached.
  if (accountId && !mode) {
    const { data: row } = await supabaseAdmin
      .from('account_cache')
      .select('data, updated_at')
      .eq('account_id', accountId)
      .maybeSingle()

    if (row) {
      const age = Date.now() - new Date(row.updated_at).getTime()
      requestCache.set(cacheKey, { data: row.data, timestamp: Date.now() })
      if (age > DB_CACHE_STALE_MS) {
        // Serve the stale-but-fast cached data now, refresh it in the
        // background after the response is sent so the next visit is fresh.
        after(async () => {
          const fresh = withStaleArrayGuard(row.data, await fetchLive())
          await supabaseAdmin
            .from('account_cache')
            .upsert({ account_id: accountId, data: fresh, updated_at: new Date().toISOString() })
          const score = extractScore(fresh, platform)
          if (score != null) {
            await supabaseAdmin.from('rank_history').upsert(
              { account_id: accountId, score, recorded_date: new Date().toISOString().slice(0, 10) },
              { onConflict: 'account_id,recorded_date' }
            )
          }
          await snapshotLpHistoryLive(platform, accountId, fresh)
        })
      }
      return Response.json(row.data)
    }
  }

  const data = await fetchLive()
  requestCache.set(cacheKey, { data, timestamp: Date.now() })

  if (accountId && !mode) {
    await supabaseAdmin
      .from('account_cache')
      .upsert({ account_id: accountId, data, updated_at: new Date().toISOString() })
    const score = extractScore(data, platform)
    if (score != null) {
      await supabaseAdmin.from('rank_history').upsert(
        { account_id: accountId, score, recorded_date: new Date().toISOString().slice(0, 10) },
        { onConflict: 'account_id,recorded_date' }
      )
    }
    await snapshotLpHistoryLive(platform, accountId, data)
  }

  return Response.json(data)
}

// Riot/Henrik normally return a valid JSON error body even on 4xx (e.g. an
// expired dev key gives {"status":{"status_code":401,...}}, still parseable)
// — but a real infra-level outage (Cloudflare/nginx gateway error) can return
// an HTML/plain-text body instead, and response.json() throws a SyntaxError
// on that. Left unguarded, that throw crashes the *entire* request (all of
// League+Valorant+TFT, since they're fetched together) instead of degrading
// gracefully like the Overwatch/CS2 paths already do.
async function safeJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

// Mode-filtered requests only come from the League match-history dropdown
// (RankHero.jsx) — they only need rankData + the filtered matchHistory, not
// Valorant/TFT data that's completely unaffected by a League queue filter.
// Skipping those calls turns a ~10-request waterfall into 2-3 fast ones.
async function fetchLeagueOnlyData(name, tag, mode) {
  const response = await fetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,
    { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
  )
  const account = (await safeJson(response)) ?? {}
  const { continent, platform } = await detectRouting(account.puuid)

  const [rankRes, matchHistory, ddragonVersion] = await Promise.all([
    fetch(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    ),
    fetchMatchHistory(account.puuid, mode, continent),
    fetchDdragonVersion(),
  ])
  const rankData = await safeJson(rankRes)

  // Surfaces *why* puuid is missing when it is — a real "no such Riot ID"
  // is a clean 404, but a bad/expired RIOT_API_KEY or a Riot outage comes
  // back as 401/403/5xx on this same lookup and looked identical to the
  // client before this, so users got told to double-check a name/tag that
  // was actually fine.
  return { puuid: account.puuid, accountLookupStatus: response.status, rankData, matchHistory, ddragonVersion }
}

// CS2 has no Riot account, so it skips the entire Riot/Henrik flow below and
// uses Steam + Leetify instead. See fetchCs2Data.
async function fetchSummonerData(name, tag, mode) {
  if (mode) return fetchLeagueOnlyData(name, tag, mode)

  // Stage 1: the two independent identity lookups run in parallel — nothing
  // downstream needs both at once, so there's no reason to wait on them
  // sequentially.
  const [response, valAccountData] = await Promise.all([
    fetch(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    ),
    fetch(
      `https://api.henrikdev.xyz/valorant/v2/account/${name}/${tag}`,
      { headers: { 'Authorization': process.env.VAL_API_KEY } }
    ),
  ])

  const account = (await safeJson(response)) ?? {}
  const valorantAccountData = await safeJson(valAccountData)
  // Henrik shards Valorant data by region (eu/na/ap/kr/br/latam) — using the
  // wrong one returns "Invalid UUID/PUUID" even for a real, active account.
  // The account lookup above tells us which shard this player is actually on.
  const valorantRegion = valorantAccountData?.data?.region || 'eu'
  // Henrik's own puuid for this account can differ from Riot's official one
  // (their account cache can lag behind a tag change) — their by-puuid
  // endpoints only recognize their own puuid, so use that, not Riot's.
  const valorantPuuid = valorantAccountData?.data?.puuid ?? account.puuid

  // League/TFT's platform shard (euw1/eun1/tr1/ru) AND continent isn't known
  // yet at this point — kick off detection now so it resolves alongside
  // everything else below instead of adding a fully sequential round-trip.
  const routingPromise = detectRouting(account.puuid)

  // Stage 2: everything here only depends on Stage 1's results, not on each
  // other — fire them all at once instead of one giant sequential waterfall.
  const [
    valorantRes,
    matchHistory,
    ddragonVersion,
    valorantMatchHistory,
    valorantMmrHistory,
    tftMatchHistory,
  ] = await Promise.all([
    fetch(
      `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${valorantRegion}/pc/${valorantPuuid}`,
      { headers: { 'Authorization': process.env.VAL_API_KEY } }
    ),
    // Fired against the europe default without waiting on routingPromise —
    // correct for the vast majority (EU) of players, and costs them zero
    // extra latency. Re-fetched below only for the non-EU minority this
    // guessed wrong for.
    fetchMatchHistory(account.puuid, mode),
    fetchDdragonVersion(),
    fetchValorantMatchHistory(valorantPuuid, valorantRegion, mode),
    fetchValorantMmrHistory(valorantPuuid, valorantRegion),
    fetchTftMatchHistory(account.puuid),
  ])

  const { continent, platform } = await routingPromise
  const [rankRes, tftRes] = await Promise.all([
    fetch(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    ),
    fetch(
      `https://${platform}.api.riotgames.com/tft/league/v1/by-puuid/${account.puuid}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    ),
  ])

  // The europe-default match history fetch above comes back empty for any
  // player whose games aren't stored under europe's match-v5 cluster (e.g.
  // a Singapore/SG2 account) — not because they have no matches, but
  // because we asked the wrong continent. Re-fetch once with the continent
  // detectRouting actually found before giving up on match history.
  const finalMatchHistory = matchHistory.length === 0 && continent !== 'europe'
    ? await fetchMatchHistory(account.puuid, mode, continent)
    : matchHistory

  const rankData = await safeJson(rankRes)
  const valorantData = await safeJson(valorantRes)
  const tftData = await safeJson(tftRes)

  return {
    puuid: account.puuid,
    // See fetchLeagueOnlyData's identical field for why this exists — lets
    // the client tell "no such Riot ID" (404) apart from an upstream/key
    // failure (401/403/5xx) instead of showing the same generic message.
    accountLookupStatus: response.status,
    valorantPuuid,
    rankData,
    tftData,
    valorantData,
    matchHistory: finalMatchHistory,
    ddragonVersion,
    valorantMatchHistory,
    valorantMmrHistory,
    tftMatchHistory
  }
}

// Henrik's API is an unofficial, community-run wrapper around Valorant data
// (Riot has no public Valorant match-history API). Endpoints and field names
// have changed across versions before (v1 -> v2 -> v3 -> v4) — if this starts
// returning empty data, check https://docs.henrikdev.xyz for schema changes.
async function fetchValorantMatchHistory(puuid, region, mode) {
  // No platform segment here — unlike the mmr endpoints, by-puuid/matches
  // takes only the region. Adding /pc/ (like the mmr endpoint needs) 404s.
  const modeQuery = mode ? `&mode=${mode}` : ''
  const response = await fetch(
    `https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/${region}/${puuid}?size=8${modeQuery}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )
  const json = await response.json()
  const matches = json?.data
  if (!Array.isArray(matches)) return []

  return matches.map((match) => {
    const allPlayers = match.players?.all_players ?? []
    const me = allPlayers.find(p => p.puuid === puuid)
    if (!me) return null

    const myTeam = allPlayers.filter(p => p.team === me.team)
    const won = match.teams?.[me.team?.toLowerCase()]?.has_won ?? null
    const roundsPlayed = match.metadata?.rounds_played || 1
    const myShots = (me.stats?.headshots ?? 0) + (me.stats?.bodyshots ?? 0) + (me.stats?.legshots ?? 0)
    const topScore = Math.max(...allPlayers.map(p => p.stats?.score ?? 0))

    const players = allPlayers.map(p => ({
      puuid: p.puuid,
      name: p.name,
      tag: p.tag,
      team: p.team,
      agent: p.character,
      agentIcon: p.assets?.agent?.small ?? null,
      kills: p.stats?.kills ?? 0,
      deaths: p.stats?.deaths ?? 0,
      assists: p.stats?.assists ?? 0,
      score: p.stats?.score ?? 0
    }))

    return {
      matchId: match.metadata?.matchid,
      agent: me.character,
      agentIcon: me.assets?.agent?.small ?? null,
      map: match.metadata?.map,
      mode: match.metadata?.mode,
      win: won,
      kills: me.stats?.kills ?? 0,
      deaths: me.stats?.deaths ?? 0,
      assists: me.stats?.assists ?? 0,
      score: me.stats?.score ?? 0,
      acs: Math.round((me.stats?.score ?? 0) / roundsPlayed),
      headshotPct: myShots > 0 ? Math.round(((me.stats?.headshots ?? 0) / myShots) * 100) : 0,
      isMvp: myTeam.every(p => (p.stats?.score ?? 0) <= (me.stats?.score ?? 0)) && (me.stats?.score ?? 0) === topScore,
      roundsPlayed,
      gameLengthSeconds: match.metadata?.game_length ? Math.round(match.metadata.game_length / 1000) : null,
      gameStartTimestamp: match.metadata?.game_start ? match.metadata.game_start * 1000 : null,
      players
    }
  }).filter(Boolean)
}

async function fetchValorantMmrHistory(puuid, region) {
  // v1, not v2 — the v2/by-puuid/mmr-history route doesn't exist (404s).
  const response = await fetch(
    `https://api.henrikdev.xyz/valorant/v1/by-puuid/mmr-history/${region}/${puuid}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )
  const json = await response.json()
  const history = json?.data
  if (!Array.isArray(history)) return []

  return history.map(entry => ({
    tier: entry.currenttierpatched,
    rr: entry.ranking_in_tier,
    change: entry.mmr_change_to_last_game,
    image: entry.images?.large ?? null,
    timestamp: entry.date_raw ? entry.date_raw * 1000 : null
  })).reverse() // oldest first, matching the League match-history convention
}

// CS2 has no official rank/match-history API (Valve doesn't expose Premier
// rating). Leetify (leetify.com) runs a documented public API for this —
// see https://api-public-docs.cs-prod.leetify.com/. It works without a key
// at a lower rate limit; LEETIFY_API_KEY is optional.
async function fetchCs2Data(steamInput) {
  const steam64Id = await resolveSteam64Id(steamInput)
  if (!steam64Id) {
    return { steam64Id: null, cs2Profile: null, cs2MatchHistory: [] }
  }

  const leetifyHeaders = process.env.LEETIFY_API_KEY
    ? { 'Authorization': `Bearer ${process.env.LEETIFY_API_KEY}` }
    : {}

  const [profileResponse, matchesResponse] = await Promise.all([
    fetch(`https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${steam64Id}`, { headers: leetifyHeaders }),
    fetch(`https://api-public.cs-prod.leetify.com/v3/profile/matches?steam64_id=${steam64Id}`, { headers: leetifyHeaders })
  ])

  // Leetify only has data for players who've actually used Leetify (synced
  // a match/demo) — most CS2 accounts simply aren't in their system, and
  // that 404 comes back as a plain "Not Found" string, not JSON.
  const cs2Profile = profileResponse.ok ? await profileResponse.json() : null
  const rawMatches = matchesResponse.ok ? await matchesResponse.json() : []

  // /v3/profile/matches only returns the queried player's own row per match
  // (a personal history list), not the full scoreboard — that needs a
  // second call per match, same two-stage pattern as the League fetch above.
  const recentMatchIds = Array.isArray(rawMatches) ? rawMatches.slice(0, 8).map(m => m.id) : []
  const fullMatches = await Promise.all(
    recentMatchIds.map(async (matchId) => {
      const res = await fetch(`https://api-public.cs-prod.leetify.com/v2/matches/${matchId}`, { headers: leetifyHeaders })
      return res.ok ? res.json() : null
    })
  )
  const cs2MatchHistory = fullMatches
    .map(match => match && buildCs2Match(match, steam64Id))
    .filter(Boolean)

  return { steam64Id, cs2Profile, cs2MatchHistory }
}

// A Steam vanity name (what most people type, e.g. their profile URL slug)
// has to be resolved to a numeric SteamID64 — Leetify and the rest of the
// Steam Web API only accept the numeric ID. If the input is already a
// 17-digit SteamID64, skip the resolution call.
async function resolveSteam64Id(input) {
  if (/^\d{17}$/.test(input)) return input

  const response = await fetch(
    `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${process.env.STEAM_API_KEY}&vanityurl=${encodeURIComponent(input)}`
  )
  const json = await response.json()
  return json?.response?.success === 1 ? json.response.steamid : null
}

function buildCs2Match(match, steam64Id) {
  const allStats = match.stats ?? []
  const me = allStats.find(p => p.steam64_id === steam64Id)
  if (!me) return null

  const myTeamScore = match.team_scores?.find(t => t.team_number === me.initial_team_number)
  const otherTeamScore = match.team_scores?.find(t => t.team_number !== me.initial_team_number)
  const won = myTeamScore && otherTeamScore ? myTeamScore.score > otherTeamScore.score : null
  const topScore = Math.max(...allStats.map(p => p.score ?? 0))

  const players = allStats.map(p => ({
    steam64Id: p.steam64_id,
    name: p.name,
    team: p.initial_team_number,
    kills: p.total_kills ?? 0,
    deaths: p.total_deaths ?? 0,
    assists: p.total_assists ?? 0,
    score: p.score ?? 0
  }))

  return {
    matchId: match.id,
    map: match.map_name,
    mode: match.data_source,
    win: won,
    kills: me.total_kills ?? 0,
    deaths: me.total_deaths ?? 0,
    assists: me.total_assists ?? 0,
    score: me.score ?? 0,
    adr: me.rounds_count ? Math.round(me.total_damage / me.rounds_count) : null,
    headshotPct: me.accuracy_head != null ? Math.round(me.accuracy_head * 100) : null,
    mvps: me.mvps ?? 0,
    isMvp: (me.score ?? 0) === topScore,
    roundsPlayed: me.rounds_count ?? null,
    leetifyRating: me.leetify_rating ?? null,
    gameStartTimestamp: match.finished_at ? new Date(match.finished_at).getTime() : null,
    players
  }
}

// Overwatch has no official rank/match API — OverFast API
// (https://github.com/TeKrop/overfast-api) scrapes Blizzard's public career
// pages instead. Actively maintained public instance, no API key needed:
// https://overfast-api.tekrop.fr (30 req/s per IP). BattleTag's "#" becomes
// "-" in the URL. Unlike League/Valorant, there's no match-history endpoint —
// only current competitive ranks per role (tank/damage/support) + Open Queue,
// plus lifetime career stat totals (fetched separately below).
// OverFast's per-player endpoints scrape Blizzard's live career pages, which
// occasionally hang indefinitely (no response at all) instead of erroring
// when Blizzard's page changes or blocks the scraper — an 8s timeout keeps
// that from stalling the whole request.
const OVERWATCH_EMPTY_RESULT = { puuid: null, owRanks: null, owUsername: null, owAvatar: null, owTitle: null, owStats: null }
const OVERWATCH_FETCH_TIMEOUT_MS = 8000

async function fetchOverwatchData(name, tag) {
  const battleTag = `${name}-${tag}`
  let response
  try {
    response = await fetch(`https://overfast-api.tekrop.fr/players/${encodeURIComponent(battleTag)}/summary`, {
      signal: AbortSignal.timeout(OVERWATCH_FETCH_TIMEOUT_MS),
    })
  } catch (err) {
    // Network error or the AbortSignal timeout firing — OverFast/Blizzard
    // isn't responding at all, a real outage rather than a normal 404.
    await markServiceDown('overwatch', err.name === 'TimeoutError' ? 'request timed out' : err.message)
    return OVERWATCH_EMPTY_RESULT
  }
  if (!response.ok) {
    // A 404 just means this battle tag doesn't exist — not an outage. Only
    // 5xx (or OverFast's own "couldn't reach Blizzard" 502/504) counts.
    if (response.status >= 500) {
      await markServiceDown('overwatch', `HTTP ${response.status}`)
    } else {
      await markServiceUp('overwatch')
    }
    return OVERWATCH_EMPTY_RESULT
  }
  await markServiceUp('overwatch')

  const summary = await response.json()
  // Console competitive is tracked separately and rarely used by our players —
  // fall back to it only if the account has no PC ranks at all.
  const platformRanks = summary?.competitive?.pc ?? summary?.competitive?.console ?? null
  const platform = summary?.competitive?.pc ? 'pc' : 'console'

  function mapRole(role) {
    return role ? { division: role.division, tier: role.tier, rankIcon: role.rank_icon } : null
  }

  const [competitiveStats, quickplayStats] = await Promise.all([
    fetchOverwatchCareerStats(battleTag, 'competitive', platform),
    fetchOverwatchCareerStats(battleTag, 'quickplay', platform),
  ])

  return {
    puuid: battleTag, // reused generically as "platform external ID" like CS2's SteamID64
    owUsername: summary?.username ?? null,
    owAvatar: summary?.avatar ?? null,
    owTitle: summary?.title ?? null,
    owRanks: platformRanks ? {
      tank: mapRole(platformRanks.tank),
      damage: mapRole(platformRanks.damage),
      support: mapRole(platformRanks.support),
      open: mapRole(platformRanks.open),
    } : null,
    owStats: { competitive: competitiveStats, quickplay: quickplayStats },
  }
}

// Hero portraits/names/roles for the "Top Heroes" list — rarely changes, so
// cache in-memory for a day rather than refetching on every request (same
// pattern as fetchTftIconMaps below).
const OW_HEROES_CACHE_TTL_MS = 24 * 60 * 60 * 1000
let owHeroesCache = null
let owHeroesCacheTimestamp = 0

async function fetchOverwatchHeroesMap() {
  if (owHeroesCache && Date.now() - owHeroesCacheTimestamp < OW_HEROES_CACHE_TTL_MS) {
    return owHeroesCache
  }
  try {
    const response = await fetch('https://overfast-api.tekrop.fr/heroes', {
      signal: AbortSignal.timeout(OVERWATCH_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) return owHeroesCache ?? {}
    const heroes = await response.json()
    const map = {}
    for (const hero of Array.isArray(heroes) ? heroes : []) {
      if (hero?.key) map[hero.key] = { name: hero.name, portrait: hero.portrait, role: hero.role }
    }
    owHeroesCache = map
    owHeroesCacheTimestamp = Date.now()
    return map
  } catch {
    return owHeroesCache ?? {}
  }
}

// Lifetime career stat totals — grouped by category (combat/game/assists/average/
// best/match_awards/miscellaneous). Requesting without a `hero` filter returns
// per-hero breakdowns too (keyed by hero slug), which we use to build a
// "Top Heroes by playtime" list alongside the all-heroes totals.
// NOTE: Blizzard's own data has no Open Queue vs Role Queue split — "competitive"
// is a single combined bucket for both queue types, only quickplay/competitive
// and platform (pc/console) can be filtered.
async function fetchOverwatchCareerStats(battleTag, gamemode, platform) {
  let response
  try {
    response = await fetch(
      `https://overfast-api.tekrop.fr/players/${encodeURIComponent(battleTag)}/stats/career?gamemode=${gamemode}&platform=${platform}`,
      { signal: AbortSignal.timeout(OVERWATCH_FETCH_TIMEOUT_MS) }
    )
  } catch {
    return null
  }
  if (!response.ok) return null
  const json = await response.json()
  const allHeroes = json?.['all-heroes'] ?? null
  if (!allHeroes) return null

  const heroesMap = await fetchOverwatchHeroesMap()
  const topHeroes = Object.entries(json)
    .filter(([key, stats]) => key !== 'all-heroes' && stats?.game?.time_played > 0)
    .sort((a, b) => (b[1].game?.time_played ?? 0) - (a[1].game?.time_played ?? 0))
    .slice(0, 6)
    .map(([key, stats]) => ({
      key,
      name: heroesMap[key]?.name ?? key,
      portrait: heroesMap[key]?.portrait ?? null,
      role: heroesMap[key]?.role ?? null,
      timePlayed: stats.game?.time_played ?? 0,
      gamesPlayed: stats.game?.games_played ?? 0,
      winPercentage: stats.game?.win_percentage ?? null,
      eliminations: stats.combat?.eliminations ?? null,
    }))

  return { ...allHeroes, topHeroes }
}

// Marvel Rivals has no official stats API — marvelrivalsapi.com is an
// unofficial third party that scrapes the game's own backend, hence the
// disclaimer on their site that it "was not explicitly made usable ... and
// thus may be subject to change at any time". Requires an API key (unlike
// OverFast) on every request. Players are identified by plain username, no
// discriminator tag. Gives real match history (unlike Overwatch/OverFast),
// so win rate/KDA/top heroes can all be computed from it directly.
//
// A brand-new lookup (a player nobody has ever searched for on
// marvelrivalsapi.com before) 404s even though the account is real and
// public in-game — the API just hasn't scraped it yet. `/player/{name}/update`
// triggers that scrape on demand, so on a 404 we kick it off and retry once
// after giving it a moment to finish, instead of reporting "not found" for
// an account that simply hasn't been indexed yet.
async function fetchMarvelRivalsPlayer(name) {
  const response = await fetch(`https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(name)}`, {
    headers: { 'x-api-key': process.env.MARVEL_RIVALS_API_KEY }
  })
  if (response.status !== 404) return response

  try {
    // The update endpoint has been observed hanging for 60s+ before erroring
    // on marvelrivalsapi.com's side — cap it so one slow/broken account
    // doesn't stall the whole profile page for the user.
    await fetch(`https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(name)}/update`, {
      headers: { 'x-api-key': process.env.MARVEL_RIVALS_API_KEY },
      signal: AbortSignal.timeout(8000)
    })
  } catch {
    // update trigger is best-effort — fall through to the retry regardless
  }
  await new Promise(resolve => setTimeout(resolve, 3000))

  return fetch(`https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(name)}`, {
    headers: { 'x-api-key': process.env.MARVEL_RIVALS_API_KEY }
  })
}

async function fetchMarvelRivalsData(name) {
  const response = await fetchMarvelRivalsPlayer(name)
  if (!response.ok) {
    return { puuid: null, mrRank: null, mrStats: null, mrMatchHistory: null }
  }

  const json = await response.json()
  if (json?.error) {
    return { puuid: null, mrRank: null, mrStats: null, mrMatchHistory: null }
  }

  const matchHistory = Array.isArray(json?.match_history) ? json.match_history.map(m => {
    const perf = m.player_performance
    return {
      matchId: m.match_uid,
      hero: perf?.hero_name ?? null,
      heroIcon: perf?.hero_type ?? null,
      kills: perf?.kills ?? 0,
      deaths: perf?.deaths ?? 0,
      assists: perf?.assists ?? 0,
      win: perf?.is_win?.is_win ?? false,
      durationSeconds: m.duration ?? null,
      gameStartTimestamp: m.match_time_stamp ? m.match_time_stamp * 1000 : null,
    }
  }) : []

  const roleStats = await fetchMarvelRivalsRoleStats(name)

  return {
    puuid: String(json?.uid ?? name), // reused generically as "platform external ID", like CS2's SteamID64
    mrUsername: json?.player?.name ?? json?.name ?? null,
    mrIcon: json?.player?.icon?.player_icon ?? null,
    mrRank: json?.player?.rank ?? null, // { rank: "Gold III", image, color }
    mrOverallStats: json?.overall_stats ?? null,
    mrMatchHistory: matchHistory,
    mrRoleStats: roleStats,
  }
}

// Full both-teams scoreboard for a single match — the account-level
// match_history endpoint above only returns the requested player's own
// performance, so a match's other 11 players are only available through
// this dedicated per-match endpoint. Fetched on-demand (see the `matchId`
// branch in GET) rather than for every match in history, to stay well
// under the free tier's daily quota.
async function fetchMarvelRivalsMatchDetail(matchUid) {
  const response = await fetch(`https://marvelrivalsapi.com/api/v1/match/${encodeURIComponent(matchUid)}`, {
    headers: { 'x-api-key': process.env.MARVEL_RIVALS_API_KEY }
  })
  if (!response.ok) return { players: null }
  const json = await response.json()
  const details = json?.match_details
  if (!details || json?.error) return { players: null }

  const players = Array.isArray(details.match_players) ? details.match_players.map(p => {
    // A player's per-match accuracy isn't reported directly — only per-hero
    // "session_hit_rate" on the heroes they played that match. We take the
    // rate from whichever hero they played the most (their `cur_hero_id`).
    const heroSession = Array.isArray(p.player_heroes)
      ? p.player_heroes.find(h => h.hero_id === p.cur_hero_id) ?? p.player_heroes[0]
      : null
    return {
      uid: p.player_uid,
      name: p.nick_name,
      side: p.camp, // 0 or 1 — the two teams
      hero: p.cur_hero_id,
      heroIcon: p.cur_hero_icon,
      win: p.is_win === 1,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      finalHits: p.final_hits ?? 0,
      soloKills: p.solo_kill ?? 0,
      damage: Math.round(p.total_hero_damage ?? 0),
      healing: Math.round(p.total_hero_heal ?? 0),
      damageTaken: Math.round(p.total_damage_taken ?? 0),
      accuracy: heroSession?.session_hit_rate != null ? Math.round(heroSession.session_hit_rate * 100) : null,
      scoreChange: p.dynamic_fields?.add_score ?? null,
      rankScore: p.dynamic_fields?.new_score ?? null,
      // The match endpoint gives no rank name/tier per player, only the raw
      // score above — this derives an approximate tier from it (Bronze-
      // Celestial are exact per the game's own wiki; anything past Celestial
      // is labeled "Eternity" since Eternity/One Above All can't be told
      // apart from score alone). See lib/rankScore.js for the source rule.
      rank: estimateMarvelRivalsRankFromScore(p.dynamic_fields?.new_score),
    }
  }) : null

  return {
    mvpUid: details.mvp_uid ?? null,
    svpUid: details.svp_uid ?? null,
    gameMode: details.game_mode?.game_mode_name ?? null,
    players,
  }
}

// Role win rates (Vanguard/Duelist/Strategist) — only exposed via the v2
// endpoint, which the docs themselves warn is "not always reliable" when
// queried by username. Best-effort: any failure here just means the role
// win-rate section doesn't render, same fallback pattern as everything else
// in this file when a third-party API hiccups.
async function fetchMarvelRivalsRoleStats(name) {
  try {
    const response = await fetch(`https://marvelrivalsapi.com/api/v2/player/${encodeURIComponent(name)}`, {
      headers: { 'x-api-key': process.env.MARVEL_RIVALS_API_KEY }
    })
    if (!response.ok) return null
    const json = await response.json()
    if (json?.error) return null

    function mapRole(role) {
      if (!role) return null
      return {
        matches: role.matches_played ?? 0,
        wins: role.matches_won ?? 0,
        winRate: role.win_percentage?.win_rate_raw ?? null,
        kda: role.kda_ratio?.raw ?? null,
      }
    }

    return {
      vanguard: mapRole(json.vanguard),
      duelist: mapRole(json.duelist),
      strategist: mapRole(json.strategist),
    }
  } catch {
    return null
  }
}

// Community Dragon's TFT data dump (champions/traits/items for the current
// set) doesn't have a versioned/stable URL like Data Dragon does — it's
// always "latest", and the schema has shifted before across sets. We cache
// the resolved lookup maps in-memory for a while so every match-history
// request doesn't re-fetch/re-parse a ~20MB JSON blob, but keep parsing
// defensive (try/catch, optional chaining everywhere) so a schema change
// degrades to "no icons" instead of crashing the whole route.
const TFT_DATA_CACHE_TTL_MS = 60 * 60 * 1000
let tftDataCache = null
let tftDataCacheTimestamp = 0

function tftAssetPathToUrl(path) {
  if (!path || typeof path !== 'string') return null
  return `https://raw.communitydragon.org/latest/game/${path.toLowerCase().replace(/\.tex$/, '.png')}`
}

async function fetchTftIconMaps() {
  if (tftDataCache && Date.now() - tftDataCacheTimestamp < TFT_DATA_CACHE_TTL_MS) {
    return tftDataCache
  }

  const empty = { championIconByApiName: {}, traitIconByApiName: {}, itemIconByApiName: {} }

  try {
    const response = await fetch('https://raw.communitydragon.org/latest/cdragon/tft/en_us.json')
    if (!response.ok) return empty
    const json = await response.json()

    const setData = Array.isArray(json?.setData) ? json.setData : []
    const latestSet = setData.reduce((best, current) => {
      if (!best) return current
      return (current?.number ?? -1) > (best?.number ?? -1) ? current : best
    }, null)

    const championIconByApiName = {}
    for (const champ of latestSet?.champions ?? []) {
      const url = tftAssetPathToUrl(champ?.tileIcon ?? champ?.squareIcon ?? champ?.icon)
      if (champ?.apiName && url) championIconByApiName[champ.apiName.toLowerCase()] = url
    }

    const traitIconByApiName = {}
    for (const trait of latestSet?.traits ?? []) {
      const url = tftAssetPathToUrl(trait?.icon)
      if (trait?.apiName && url) traitIconByApiName[trait.apiName.toLowerCase()] = url
    }

    const itemIconByApiName = {}
    for (const item of Array.isArray(json?.items) ? json.items : []) {
      const url = tftAssetPathToUrl(item?.icon)
      if (item?.apiName && url) itemIconByApiName[item.apiName.toLowerCase()] = url
    }

    const result = { championIconByApiName, traitIconByApiName, itemIconByApiName }
    tftDataCache = result
    tftDataCacheTimestamp = Date.now()
    return result
  } catch {
    return empty
  }
}

// Resolves which ranked queue a TFT match belongs to. Verified live against
// the Riot API (real match data, not guessed): normal Ranked matches carry
// info.queue_id === 1100 and info.tft_game_type === "standard", while Double
// Up matches carry info.queue_id === 1160 and info.tft_game_type === "pairs"
// (and participants get a partner_group_id pairing them with their teammate).
// Falls back to the partner_group_id heuristic, then to "RANKED_TFT", so an
// unrecognized/new queue id never crashes mode filtering — it just gets
// bucketed into normal Ranked.
function resolveTftQueueType(info, participants) {
  if (info?.queue_id === 1160 || info?.tft_game_type === 'pairs') return 'RANKED_TFT_DOUBLE_UP'
  if (info?.queue_id === 1100 || info?.tft_game_type === 'standard') return 'RANKED_TFT'
  const hasPartnerGroups = Array.isArray(participants) && participants.some(p => p?.partner_group_id != null)
  return hasPartnerGroups ? 'RANKED_TFT_DOUBLE_UP' : 'RANKED_TFT'
}

// Builds the same shape used for the requesting player's own row (icons,
// sorted units/traits) so it can be reused for every participant in the full
// 8-player scoreboard. Defensive throughout — a missing/odd field should
// degrade to a blank icon, never throw and take the whole match down.
function buildTftParticipantView(participant, iconMaps) {
  const { championIconByApiName, traitIconByApiName, itemIconByApiName } = iconMaps

  const topTraits = [...(participant.traits ?? [])]
    .filter(t => t.style > 0)
    .sort((a, b) => b.style - a.style || b.num_units - a.num_units)
    .slice(0, 3)
    .map(t => ({
      name: t.name?.replace(/^TFT\d+_/, '') ?? '?',
      style: t.style,
      numUnits: t.num_units,
      icon: traitIconByApiName[t.name?.toLowerCase()] ?? null
    }))

  const topUnits = [...(participant.units ?? [])]
    .filter(u => u.itemNames?.length > 0)
    .sort((a, b) => b.tier - a.tier || b.itemNames.length - a.itemNames.length)
    .slice(0, 3)
    .map(u => ({
      name: u.character_id?.replace(/^TFT\d+_/, '') ?? '?',
      tier: u.tier,
      items: (u.itemNames ?? []).map(i => i.replace(/^TFT_Item_/, '')),
      icon: championIconByApiName[u.character_id?.toLowerCase()] ?? null
    }))

  const allUnits = [...(participant.units ?? [])]
    .sort((a, b) => b.tier - a.tier)
    .map(u => ({
      characterId: u.character_id,
      name: u.character_id?.replace(/^TFT\d+_/, '') ?? '?',
      tier: u.tier,
      items: (u.itemNames ?? []).map(i => ({
        name: i.replace(/^TFT_Item_/, ''),
        icon: itemIconByApiName[i?.toLowerCase()] ?? null
      })),
      icon: championIconByApiName[u.character_id?.toLowerCase()] ?? null
    }))

  const augments = (participant.augments ?? []).map(a => ({
    name: a.replace(/^TFT\d+_Augment_/, ''),
    icon: itemIconByApiName[a?.toLowerCase()] ?? null
  }))

  return {
    puuid: participant.puuid ?? null,
    name: participant.riotIdGameName || null,
    tag: participant.riotIdTagline || null,
    placement: participant.placement,
    augments,
    topTraits,
    topUnits,
    allUnits,
    level: participant.level ?? null,
    damageDealt: participant.total_damage_to_players ?? null,
    playersEliminated: participant.players_eliminated ?? null,
    goldLeft: participant.gold_left ?? null,
    partnerGroupId: participant.partner_group_id ?? null
  }
}

async function fetchTftMatchHistory(puuid) {
  const idsResponse = await fetch(
    `https://europe.api.riotgames.com/tft/match/v1/matches/by-puuid/${puuid}/ids?count=10`,
    { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
  )
  const matchIds = await safeJson(idsResponse)
  if (!Array.isArray(matchIds)) return []

  const iconMaps = await fetchTftIconMaps()

  const matches = await Promise.all(
    matchIds.map(async (matchId) => {
      try {
        const res = await fetch(
          `https://europe.api.riotgames.com/tft/match/v1/matches/${matchId}`,
          { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
        )
        const match = await res.json()
        const participants = match.info?.participants ?? []
        const participant = participants.find(p => p.puuid === puuid)
        if (!participant) return null

        const own = buildTftParticipantView(participant, iconMaps)
        const allParticipants = participants.map(p => {
          try {
            return buildTftParticipantView(p, iconMaps)
          } catch {
            return null
          }
        }).filter(Boolean)

        return {
          matchId,
          queueType: resolveTftQueueType(match.info, participants),
          placement: own.placement,
          augments: own.augments,
          topTraits: own.topTraits,
          topUnits: own.topUnits,
          allUnits: own.allUnits,
          level: own.level,
          damageDealt: own.damageDealt,
          playersEliminated: own.playersEliminated,
          goldLeft: own.goldLeft,
          partnerGroupId: own.partnerGroupId,
          participants: allParticipants,
          gameLength: match.info?.game_length ?? null,
          game_datetime: match.info?.game_datetime ?? null
        }
      } catch {
        return null
      }
    })
  )
  return matches.filter(Boolean)
}

async function fetchDdragonVersion() {
  const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  const versions = await response.json()
  return Array.isArray(versions) ? versions[0] : null
}

// Duplicated from LpHistoryChart.jsx's ESTIMATED_LP_GAIN/ESTIMATED_LP_LOSS on
// purpose (not imported) — that file is owned by a separate, parallel change.
// Riot's API never exposes a match's actual LP delta, so this is a rough
// estimate only, always paired with lpDeltaIsEstimate: true so the UI never
// presents it as a real number.
const RANKED_SOLO_QUEUE_ID = 420
const ESTIMATED_LP_GAIN = 17
const ESTIMATED_LP_LOSS = 15

// Our own transparent 0-100 "how much did this player influence the game"
// number — explicitly NOT a clone of u.gg's proprietary "Carry Score" (its
// formula isn't public). Weighted blend of three simple, explainable signals:
//   40% kill participation (kills+assists / team kills)
//   40% share of team damage (own damage / summed damage of that player's team)
//   20% gold-per-minute rank among all 10 players in the match (1st = 100%, 10th = 0%)
// Each signal is already 0-1, combined with the weights above and rounded to 0-100.
function calculateImpactScore(participant, allParticipants) {
  const team = allParticipants.filter(p => p.teamId === participant.teamId)
  const teamKills = team.reduce((sum, p) => sum + p.kills, 0)
  const killParticipation = teamKills > 0
    ? (participant.kills + participant.assists) / teamKills
    : 0

  const teamDamage = team.reduce((sum, p) => sum + p.totalDamageDealtToChampions, 0)
  const damageShare = teamDamage > 0
    ? participant.totalDamageDealtToChampions / teamDamage
    : 0

  const durationMinutes = Math.max(1, participant.timePlayed ?? 0) / 60
  const goldPerMinute = (participant.goldEarned ?? 0) / durationMinutes
  const sortedByGpm = [...allParticipants]
    .map(p => (p.goldEarned ?? 0) / durationMinutes)
    .sort((a, b) => a - b)
  const gpmRankIndex = sortedByGpm.indexOf(goldPerMinute)
  const gpmPercentile = allParticipants.length > 1 ? gpmRankIndex / (allParticipants.length - 1) : 0

  const raw = killParticipation * 0.4 + damageShare * 0.4 + gpmPercentile * 0.2
  return Math.round(Math.min(1, Math.max(0, raw)) * 100)
}

async function fetchMatchHistory(puuid, queueId, continent = 'europe') {
  const queueQuery = queueId ? `&queue=${queueId}` : ''
  const idsResponse = await fetch(
    `https://${continent}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8${queueQuery}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )
  const matchIds = await safeJson(idsResponse)
  if (!Array.isArray(matchIds)) return []

  const matches = await Promise.all(
    matchIds.map(async (matchId) => {
      const matchResponse = await fetch(
        `https://${continent}.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: {
            'X-Riot-Token': process.env.RIOT_API_KEY
          }
        }
      )
      const match = await safeJson(matchResponse)
      const participant = match?.info?.participants?.find(p => p.puuid === puuid)
      if (!participant) return null

      const allParticipants = match.info.participants

      const teamKills = allParticipants
        .filter(p => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0)

      const allPlayers = allParticipants.map(p => {
        const primaryStyle = p.perks?.styles?.[0]
        const subStyle = p.perks?.styles?.[1]
        return {
          puuid: p.puuid,
          summonerName: p.riotIdGameName || p.summonerName,
          summonerTag: p.riotIdTagline || null,
          champion: p.championName,
          champLevel: p.champLevel ?? null,
          teamId: p.teamId,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          cs: p.totalMinionsKilled + p.neutralMinionsKilled,
          damageDealt: p.totalDamageDealtToChampions,
          goldEarned: p.goldEarned ?? null,
          visionScore: p.visionScore ?? null,
          // Arena (CHERRY) only: 6 subteams of 3, ranked by final placement.
          subteamId: p.playerSubteamId ?? null,
          placement: p.placement ?? null,
          summonerSpells: [p.summoner1Id ?? null, p.summoner2Id ?? null],
          primaryRuneId: primaryStyle?.selections?.[0]?.perk ?? null,
          primaryRuneStyleId: primaryStyle?.style ?? null,
          subRuneStyleId: subStyle?.style ?? null,
          items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0),
          impactScore: calculateImpactScore(p, allParticipants)
        }
      })

      const primaryStyle = participant.perks?.styles?.[0]
      const subStyle = participant.perks?.styles?.[1]
      const lpDelta = match.info.queueId === RANKED_SOLO_QUEUE_ID
        ? (participant.win ? ESTIMATED_LP_GAIN : -ESTIMATED_LP_LOSS)
        : null

      return {
        matchId,
        champion: participant.championName,
        champLevel: participant.champLevel ?? null,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        role: participant.teamPosition,
        visionScore: participant.visionScore,
        damageDealt: participant.totalDamageDealtToChampions,
        goldEarned: participant.goldEarned ?? null,
        summonerSpells: [participant.summoner1Id ?? null, participant.summoner2Id ?? null],
        primaryRuneId: primaryStyle?.selections?.[0]?.perk ?? null,
        primaryRuneStyleId: primaryStyle?.style ?? null,
        subRuneStyleId: subStyle?.style ?? null,
        killParticipationPct: teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : null,
        // Estimate only — Riot's API never returns the real per-match LP delta.
        lpDelta,
        lpDeltaIsEstimate: lpDelta != null ? true : undefined,
        impactScore: calculateImpactScore(participant, allParticipants),
        gameDurationSeconds: match.info.gameDuration,
        gameEndTimestamp: match.info.gameEndTimestamp,
        queueId: match.info.queueId,
        gameMode: match.info?.gameMode ?? null,
        placement: participant.placement ?? null,
        players: allPlayers
      }
    })
  )

  return matches.filter(Boolean)
}

// Pull the cross-game rank score out of whatever the API returned so we can
// store it in rank_history without re-importing the full lib/rankScore module.
function extractScore(data, platform) {
  try {
    if (platform === 'League of Legends') {
      const solo = Array.isArray(data.rankData)
        ? data.rankData.find(e => e.queueType === 'RANKED_SOLO_5x5')
        : null
      return solo ? getLeagueScore(solo.tier, solo.rank) : null
    }
    if (platform === 'Valorant') {
      // valorantData is Henrik's v3 by-puuid/mmr response — the current tier
      // is nested at data.current.tier.name (same path gameStats.js reads for
      // the live profile score). The old `currenttierpatched` field only
      // exists on the *mmr-history* v1 shape, so it was always undefined here
      // and Valorant accounts never got a rank_history row (empty rating chart).
      const valTier = data.valorantData?.data?.current?.tier?.name
      return valTier ? getValorantScore(valTier) : null
    }
    if (platform === 'CSGO') {
      return data.cs2Profile?.ranks?.premier != null
        ? getCs2Score(data.cs2Profile.ranks.premier)
        : null
    }
    if (platform === 'TFT') {
      const entry = Array.isArray(data.tftData) ? data.tftData.find(e => e.queueType === 'RANKED_TFT') : null
      return entry ? getTftScore(entry.tier, entry.rank) : null
    }
    if (platform === 'Overwatch') {
      return getOverwatchScore(data.owRanks)?.score ?? null
    }
    if (platform === 'Marvel Rivals') {
      return data.mrRank?.rank ? getMarvelRivalsScore(data.mrRank.rank) : null
    }
  } catch {
    return null
  }
  return null
}