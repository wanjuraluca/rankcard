// Lightweight companion to /api/summoner's match-history fetch, built
// specifically for the LP-history chart's win/loss-based estimate.
//
// Why this exists instead of just asking for more games from the existing
// match-history endpoint: that endpoint returns full per-participant detail
// (KDA, items, all 10 players, etc.) for every match, which is fine for ~8
// recent games shown in the Match History list but would multiply into a
// rate-limit problem if pulled for a much longer window on every profile
// visit. Here we only need two fields per match — win/loss and a
// timestamp — so we extract just those from the same Riot match-detail
// response and cache the result (see requestCache below) so repeated chart
// renders/profile visits don't re-trigger the full fetch fan-out.
//
// Honest scope note: this still hits the same match-detail endpoint per
// match (Riot doesn't offer a lighter "just give me win/loss" endpoint), so
// it's capped at MAX_COUNT games, not an unbounded "full history" fetch —
// see the count clamp below.

const RANKED_SOLO_QUEUE_ID = 420
const DEFAULT_COUNT = 30
const MAX_COUNT = 30

// Same in-memory-cache idea as app/api/summoner/route.js's requestCache —
// collapses repeated near-simultaneous requests (e.g. re-renders of the LP
// chart) into one Riot API round trip. Per-server-process only, not shared
// across Vercel lambdas, which is fine here since the goal is just to avoid
// hammering Riot on every chart render, not a durable cache.
const CACHE_TTL_MS = 10 * 60 * 1000
const requestCache = new Map()

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const puuid = searchParams.get('puuid')
  const platform = searchParams.get('platform') || 'euw1'
  const requestedCount = parseInt(searchParams.get('count'), 10)
  // Never trust the client for how many Riot calls we're about to fan out —
  // clamp to MAX_COUNT no matter what's passed in the query string.
  const count = Number.isFinite(requestedCount) && requestedCount > 0
    ? Math.min(requestedCount, MAX_COUNT)
    : DEFAULT_COUNT

  if (!puuid) {
    return Response.json({ points: [], totalFetched: 0, error: 'Missing puuid' }, { status: 200 })
  }

  const cacheKey = `${puuid}:${platform}:${count}`.toLowerCase()
  const cached = requestCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Response.json(cached.data)
  }

  try {
    const idsResponse = await fetch(
      `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}&queue=${RANKED_SOLO_QUEUE_ID}`,
      { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    )

    if (!idsResponse.ok) {
      const data = { points: [], totalFetched: 0, error: `Riot match-ids request failed (${idsResponse.status})` }
      requestCache.set(cacheKey, { data, timestamp: Date.now() })
      return Response.json(data)
    }

    const matchIds = await idsResponse.json()
    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      const data = { points: [], totalFetched: 0 }
      requestCache.set(cacheKey, { data, timestamp: Date.now() })
      return Response.json(data)
    }

    const rawPoints = await Promise.all(
      matchIds.map(async (matchId) => {
        try {
          const matchResponse = await fetch(
            `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
            { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
          )
          if (!matchResponse.ok) return null

          const match = await matchResponse.json()
          const participant = match.info?.participants?.find(p => p.puuid === puuid)
          if (!participant || typeof match.info?.gameEndTimestamp !== 'number') return null

          return {
            matchId,
            win: Boolean(participant.win),
            timestamp: match.info.gameEndTimestamp
          }
        } catch {
          return null
        }
      })
    )

    const points = rawPoints.filter(Boolean).sort((a, b) => a.timestamp - b.timestamp)

    const data = { points, totalFetched: points.length }
    requestCache.set(cacheKey, { data, timestamp: Date.now() })
    return Response.json(data)
  } catch (error) {
    // Never let a Riot outage / rate-limit response break the chart — fall
    // back to an empty timeline so the caller just uses its existing
    // shorter estimate instead of showing a broken UI state.
    return Response.json({ points: [], totalFetched: 0, error: error.message ?? 'Unknown error' })
  }
}
