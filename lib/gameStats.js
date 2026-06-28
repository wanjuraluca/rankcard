import { getLeagueScore, getValorantScore, getCs2Score } from "@/lib/rankScore"

// Mirrors RankBadge/Cs2Hero's PREMIER_BANDS — duplicated rather than shared
// since it's just a display label, not scoring logic.
const PREMIER_BANDS = [
    { min: 30000, name: "Yellow" },
    { min: 25000, name: "Red" },
    { min: 20000, name: "Pink" },
    { min: 15000, name: "Purple" },
    { min: 10000, name: "Blue" },
    { min: 5000, name: "Light Blue" },
    { min: 0, name: "Grey" },
]

export function average(numbers) {
    const valid = numbers.filter(n => n != null)
    if (valid.length === 0) return null
    return valid.reduce((sum, n) => sum + n, 0) / valid.length
}

// Only games with a live rank/match API behind them (lib/rankScore.js) feed
// into the overall averages — CS2 has no API integration yet, so it's
// simply excluded until that's wired up. Adding a new game means adding a
// branch here and a percentile table in lib/rankScore.js, nothing else.
export function extractGameStats(platform, apiData) {
    if (platform === "League of Legends") {
        if (!Array.isArray(apiData.rankData)) return null
        const entry = apiData.rankData.find(q => q.queueType === "RANKED_SOLO_5x5")
        if (!entry) return null
        const totalGames = entry.wins + entry.losses
        const matchHistory = Array.isArray(apiData.matchHistory) ? apiData.matchHistory : []
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        return {
            tierLabel: `${entry.tier} ${entry.rank}`,
            winRate: totalGames > 0 ? (entry.wins / totalGames) * 100 : null,
            rankScore: getLeagueScore(entry.tier, entry.rank),
            kda: average(kdas),
        }
    }

    if (platform === "Valorant") {
        const tierName = apiData.valorantData?.data?.current?.tier?.name
        const matchHistory = Array.isArray(apiData.valorantMatchHistory) ? apiData.valorantMatchHistory : []
        const wins = matchHistory.filter(m => m.win).length
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        return {
            tierLabel: tierName ?? null,
            winRate: matchHistory.length > 0 ? (wins / matchHistory.length) * 100 : null,
            rankScore: getValorantScore(tierName),
            kda: average(kdas),
        }
    }

    if (platform === "CSGO") {
        const matchHistory = Array.isArray(apiData.cs2MatchHistory) ? apiData.cs2MatchHistory : []
        const wins = matchHistory.filter(m => m.win).length
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        const premierRating = apiData.cs2Profile?.ranks?.premier
        const band = premierRating != null
            ? (PREMIER_BANDS.find(b => premierRating >= b.min) ?? PREMIER_BANDS[PREMIER_BANDS.length - 1])
            : null
        return {
            tierLabel: band?.name ?? null,
            winRate: matchHistory.length > 0 ? (wins / matchHistory.length) * 100 : null,
            rankScore: getCs2Score(premierRating),
            kda: average(kdas),
        }
    }

    return null
}
