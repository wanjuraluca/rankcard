// Several components on the same profile page (Overall tab, the connected-
// games card, the per-game tab) each independently request the same
// account, multiplying calls to Henrik's rate-limited Valorant API. This
// short-lived in-memory cache collapses those near-simultaneous duplicate
// requests into one. It's per-server-process (not shared across Vercel
// lambdas), so it's a stopgap — the real fix is caching ranks in
// game_stats, see the roadmap.
const CACHE_TTL_MS = 45_000
const requestCache = new Map()

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const tag = searchParams.get('tag')
  const platform = searchParams.get('platform')
  const valorantMode = searchParams.get('mode') || null

  const cacheKey = `${platform}:${name}:${tag}:${valorantMode}`.toLowerCase()
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json(cached.data)
  }

  const data = platform === 'CSGO'
    ? await fetchCs2Data(name)
    : await fetchSummonerData(name, tag, valorantMode)
  requestCache.set(cacheKey, { data, timestamp: Date.now() })
  return Response.json(data)
}

// CS2 has no Riot account, so it skips the entire Riot/Henrik flow below and
// uses Steam + Leetify instead. See fetchCs2Data.
async function fetchSummonerData(name, tag, valorantMode) {
  const response = await fetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const valAccountData = await fetch(
    `https://api.henrikdev.xyz/valorant/v2/account/${name}/${tag}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )

  const account = await response.json()
  const valorantAccountData = await valAccountData.json()
  // Henrik shards Valorant data by region (eu/na/ap/kr/br/latam) — using the
  // wrong one returns "Invalid UUID/PUUID" even for a real, active account.
  // The account lookup above tells us which shard this player is actually on.
  const valorantRegion = valorantAccountData?.data?.region || 'eu'
  // Henrik's own puuid for this account can differ from Riot's official one
  // (their account cache can lag behind a tag change) — their by-puuid
  // endpoints only recognize their own puuid, so use that, not Riot's.
  const valorantPuuid = valorantAccountData?.data?.puuid ?? account.puuid

  const respone2 = await fetch(
    `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const respone4 = await fetch(
    `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${valorantRegion}/pc/${valorantPuuid}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )

  const response3 = await fetch(
    `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${account.puuid}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const rankData = await respone2.json()
  const valorantData = await respone4.json()
  const tftData = await response3.json()
  const matchHistory = await fetchMatchHistory(account.puuid)
  const ddragonVersion = await fetchDdragonVersion()
  const valorantMatchHistory = await fetchValorantMatchHistory(valorantPuuid, valorantRegion, valorantMode)
  const valorantMmrHistory = await fetchValorantMmrHistory(valorantPuuid, valorantRegion)

  return {
    puuid: account.puuid,
    valorantPuuid,
    rankData,
    tftData,
    valorantData,
    matchHistory,
    ddragonVersion,
    valorantMatchHistory,
    valorantMmrHistory
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

async function fetchDdragonVersion() {
  const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  const versions = await response.json()
  return Array.isArray(versions) ? versions[0] : null
}

async function fetchMatchHistory(puuid) {
  const idsResponse = await fetch(
    `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )
  const matchIds = await idsResponse.json()
  if (!Array.isArray(matchIds)) return []

  const matches = await Promise.all(
    matchIds.map(async (matchId) => {
      const matchResponse = await fetch(
        `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: {
            'X-Riot-Token': process.env.RIOT_API_KEY
          }
        }
      )
      const match = await matchResponse.json()
      const participant = match.info?.participants?.find(p => p.puuid === puuid)
      if (!participant) return null

      const teamKills = match.info.participants
        .filter(p => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0)

      const allPlayers = match.info.participants.map(p => ({
        puuid: p.puuid,
        summonerName: p.riotIdGameName || p.summonerName,
        summonerTag: p.riotIdTagline || null,
        champion: p.championName,
        teamId: p.teamId,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        damageDealt: p.totalDamageDealtToChampions,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0)
      }))

      return {
        matchId,
        champion: participant.championName,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        role: participant.teamPosition,
        visionScore: participant.visionScore,
        damageDealt: participant.totalDamageDealtToChampions,
        killParticipationPct: teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : null,
        gameDurationSeconds: match.info.gameDuration,
        gameEndTimestamp: match.info.gameEndTimestamp,
        queueId: match.info.queueId,
        players: allPlayers
      }
    })
  )

  return matches.filter(Boolean)
}