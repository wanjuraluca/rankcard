// Riot's account-v1 (by-riot-id) is scoped to a continent (europe/americas/
// asia/sea), not a platform shard — but that routing value is really just a
// choice of API server, so it resolves ANY account's identity regardless of
// where they actually play (confirmed live: a Singapore/SG2 account still
// resolves fine via the "europe" continent). match-v5 (match history) and
// league-v4/tft-v4 (rank) are genuinely region-scoped though — querying them
// under the wrong continent/platform for a non-EU player comes back empty,
// which looked identical to "actually unranked with no matches".
const CONTINENTS = ['europe', 'americas', 'asia', 'sea']

// Finds which continent actually has this puuid's match history, and derives
// their platform shard from the first match ID's prefix (e.g. "SG2_12345"
// -> platform "sg2") in the same round-trip. Falls back to europe/euw1 if
// nothing turns up on any continent (e.g. a brand-new account with zero
// recent games) — same fallback this always had.
export async function detectRouting(puuid) {
    const results = await Promise.all(CONTINENTS.map(async (continent) => {
        try {
            const response = await fetch(
                `https://${continent}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`,
                { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
            )
            let ids = null
            try {
                ids = await response.json()
            } catch {
                ids = null
            }
            const prefix = Array.isArray(ids) && ids[0]?.split('_')[0]
            return prefix ? { continent, platform: prefix.toLowerCase() } : null
        } catch {
            return null
        }
    }))
    return results.find(Boolean) ?? { continent: 'europe', platform: 'euw1' }
}

// Back-compat wrapper for callers (lib/discordSync.js) that only need the
// platform shard, not the continent.
export async function detectPlatform(puuid) {
    return (await detectRouting(puuid)).platform
}
