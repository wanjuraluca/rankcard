// On-demand lookup for the Solo/Duo rank of every player in a match's
// scoreboard. Deliberately NOT called until a match card is expanded
// (10x Riot calls per match is too expensive to fire for every card in the
// list up front) — see MatchDetail.jsx, which POSTs here once on first
// expand and caches the result for the component's lifetime.
import { detectPlatform } from '@/lib/riotPlatform'

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const puuids = Array.isArray(body?.puuids) ? body.puuids : []

  if (puuids.length === 0) {
    return Response.json({ ranks: {} })
  }

  // league-v4 is platform-shard-routed. The client sent no platform (so this
  // defaulted to euw1 and every non-EUW scoreboard came back rankless) — all
  // players in a match share the searched player's shard, so derive it once
  // from the first puuid. Same region-hardcode class as the other fixes.
  const platform = await detectPlatform(puuids[0])

  const results = await Promise.allSettled(
    puuids.map(async (puuid) => {
      const response = await fetch(
        `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
        { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
      )
      if (!response.ok) return { puuid, rank: null }
      const entries = await response.json()
      const soloDuo = Array.isArray(entries)
        ? entries.find(e => e.queueType === 'RANKED_SOLO_5x5')
        : null
      const rank = soloDuo
        ? { tier: soloDuo.tier, rank: soloDuo.rank, leaguePoints: soloDuo.leaguePoints }
        : null
      return { puuid, rank }
    })
  )

  const ranks = {}
  results.forEach((result, i) => {
    const puuid = puuids[i]
    // A single failed lookup (rate limit, bad puuid, etc.) shouldn't take
    // down the rest of the scoreboard — it just falls back to "no rank".
    ranks[puuid] = result.status === 'fulfilled' ? result.value.rank : null
  })

  return Response.json({ ranks })
}
