// Percentile-based rank scoring: every game's rank gets converted into
// "top X% of players", then mapped onto the same 0-3000 scale. This is what
// makes a League Challenger (top ~0.02%) and a Valorant Radiant (top ~0.1%)
// land near each other, while two tiers with very different rarity (e.g.
// League Diamond vs. a hypothetical "Diamond" in a game where it's common)
// don't get treated as equivalent just because the name matches.
//
// The percentile tables below are rough approximations of public rank
// distribution data (op.gg / leagueofgraphs / Riot act-rank reports). They
// are a placeholder until we can pull live distribution numbers — see the
// roadmap note about a self-calibrating distribution.

export const MAX_SCORE = 3000

// "topPercent" = this tier/division sits at-or-above this % of all ranked players.
// Lower number = rarer = higher score.
const LEAGUE_TIER_TOP_PERCENT = {
    CHALLENGER: 0.02,
    GRANDMASTER: 0.07,
    MASTER: 0.6,
    DIAMOND: 3.5,
    EMERALD: 14,
    PLATINUM: 33,
    GOLD: 56,
    SILVER: 78,
    BRONZE: 94,
    IRON: 100,
}

const LEAGUE_TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]
const LEAGUE_DIVISIONS = ["IV", "III", "II", "I"]

function percentileToScore(topPercent) {
    const clamped = Math.min(Math.max(topPercent, 0), 100)
    return Math.round((1 - clamped / 100) * MAX_SCORE)
}

// Apex tiers (Master+) have no divisions — LP alone separates players within them,
// but we don't have enough LP-distribution data to split that further, so we just
// use the tier's flat percentile.
export function getLeagueScore(tier, rank) {
    if (!tier) return null
    const tierKey = tier.toUpperCase()
    const topPercent = LEAGUE_TIER_TOP_PERCENT[tierKey]
    if (topPercent === undefined) return null

    const tierIndex = LEAGUE_TIER_ORDER.indexOf(tierKey)
    if (tierIndex <= 0 || !rank || !LEAGUE_DIVISIONS.includes(rank)) {
        return percentileToScore(topPercent)
    }

    // Interpolate within the tier using division as a coarse proxy for LP progress.
    const tierBelowPercent = LEAGUE_TIER_TOP_PERCENT[LEAGUE_TIER_ORDER[tierIndex - 1]]
    const divisionIndex = LEAGUE_DIVISIONS.indexOf(rank) // IV=0 .. I=3
    const progress = (divisionIndex + 1) / (LEAGUE_DIVISIONS.length + 1)
    const interpolated = tierBelowPercent - (tierBelowPercent - topPercent) * progress

    return percentileToScore(interpolated)
}

// Valorant tiers as reported by Henrik's API, e.g. "Immortal 1", "Radiant".
const VALORANT_TIER_TOP_PERCENT = {
    "RADIANT": 0.1,
    "IMMORTAL 3": 1,
    "IMMORTAL 2": 2,
    "IMMORTAL 1": 3.5,
    "ASCENDANT 3": 6,
    "ASCENDANT 2": 9,
    "ASCENDANT 1": 13,
    "DIAMOND 3": 18,
    "DIAMOND 2": 23,
    "DIAMOND 1": 28,
    "PLATINUM 3": 35,
    "PLATINUM 2": 42,
    "PLATINUM 1": 49,
    "GOLD 3": 58,
    "GOLD 2": 66,
    "GOLD 1": 74,
    "SILVER 3": 81,
    "SILVER 2": 87,
    "SILVER 1": 92,
    "BRONZE 3": 95,
    "BRONZE 2": 97,
    "BRONZE 1": 98.5,
    "IRON 3": 99.3,
    "IRON 2": 99.7,
    "IRON 1": 100,
}

export function getValorantScore(tierName) {
    if (!tierName) return null
    const topPercent = VALORANT_TIER_TOP_PERCENT[tierName.toUpperCase()]
    if (topPercent === undefined) return null
    return percentileToScore(topPercent)
}

// CS2 Premier is a raw numeric rating (roughly 0-35000+), not named tiers, so
// there's no API-provided percentile either. These bands follow Valve's own
// Premier color bands (Grey/Light Blue/.../Yellow) — population estimates
// are rough community data (Blue, 10k-15k, is reportedly the most populated).
const CS2_PREMIER_BANDS = [
    { min: 30000, topPercent: 0.5 },  // Yellow
    { min: 25000, topPercent: 3 },    // Red
    { min: 20000, topPercent: 10 },   // Pink
    { min: 15000, topPercent: 25 },   // Purple
    { min: 10000, topPercent: 50 },   // Blue
    { min: 5000, topPercent: 80 },    // Light Blue
    { min: 0, topPercent: 100 },      // Grey
]

export function getCs2Score(premierRating) {
    if (premierRating == null) return null
    const band = CS2_PREMIER_BANDS.find(b => premierRating >= b.min)
    if (!band) return null
    // Interpolate within the band so two players in the same color aren't scored identically.
    const bandIndex = CS2_PREMIER_BANDS.indexOf(band)
    const bandAbove = CS2_PREMIER_BANDS[bandIndex - 1]
    const bandTop = bandAbove ? bandAbove.min : band.min + 10000
    const progress = Math.min((premierRating - band.min) / (bandTop - band.min), 1)
    const topPercentAbove = bandAbove ? bandAbove.topPercent : 0
    const interpolated = band.topPercent - (band.topPercent - topPercentAbove) * progress
    return percentileToScore(interpolated)
}
