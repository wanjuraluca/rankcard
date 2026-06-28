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

  const data = await fetchSummonerData(name, tag, valorantMode)
  requestCache.set(cacheKey, { data, timestamp: Date.now() })
  return Response.json(data)
}

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