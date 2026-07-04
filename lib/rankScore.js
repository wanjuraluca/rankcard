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

// RankCard's own tier ladder — independent of any single game's tier names,
// since the Rank Score is a cross-game percentile (see percentileToScore
// below). Boundaries are chosen on the score scale, and the "top X%" label
// shown to users is derived from the same formula so the two always agree.
export const RANK_TIERS = [
    { name: "Bronze", min: 0, color: "#a0683e" },
    { name: "Silver", min: 750, color: "#9ca3af" },
    { name: "Gold", min: 1500, color: "#e8c468" },
    { name: "Platinum", min: 2100, color: "#5fd9c3" },
    { name: "Diamond", min: 2400, color: "#6ec9f2" },
    { name: "Master", min: 2700, color: "#b16cff" },
    { name: "Grandmaster", min: 2880, color: "#ff6b9d" },
    { name: "Legend", min: 2970, color: "#ffd166" },
]

function scoreToTopPercent(score) {
    return Math.max(0, Math.min(100, 100 * (1 - score / MAX_SCORE)))
}

// Returns the tier a given Rank Score falls into, plus the next tier up
// (null if already at the top) and how far through the current tier the
// score is, for progress-bar UI.
export function getRankTier(score) {
    if (score == null) return null
    const clamped = Math.max(0, Math.min(MAX_SCORE, score))
    const index = [...RANK_TIERS].reverse().findIndex(t => clamped >= t.min)
    const tier = RANK_TIERS[RANK_TIERS.length - 1 - index]
    const next = RANK_TIERS[RANK_TIERS.indexOf(tier) + 1] ?? null
    const tierMax = next ? next.min : MAX_SCORE
    const progress = next ? (clamped - tier.min) / (tierMax - tier.min) : 1

    return {
        tier,
        next,
        progress,
        topPercent: scoreToTopPercent(clamped),
    }
}

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

// TFT uses the same tier/division structure as League of Legends, with very
// similar rank distributions. The top-percent table mirrors LEAGUE_TIER_TOP_PERCENT
// — TFT tends to have slightly more Challengers/GMs (smaller active player base
// inflates the top bucket) but the difference is within rounding for our purposes.
const TFT_TIER_TOP_PERCENT = {
    CHALLENGER: 0.03,
    GRANDMASTER: 0.1,
    MASTER: 0.8,
    DIAMOND: 4,
    EMERALD: 15,
    PLATINUM: 34,
    GOLD: 57,
    SILVER: 79,
    BRONZE: 95,
    IRON: 100,
}

export function getTftScore(tier, rank) {
    if (!tier) return null
    const tierKey = tier.toUpperCase()
    const topPercent = TFT_TIER_TOP_PERCENT[tierKey]
    if (topPercent === undefined) return null

    const tierIndex = LEAGUE_TIER_ORDER.indexOf(tierKey)
    if (tierIndex <= 0 || !rank || !LEAGUE_DIVISIONS.includes(rank)) {
        return percentileToScore(topPercent)
    }

    const tierBelowPercent = TFT_TIER_TOP_PERCENT[LEAGUE_TIER_ORDER[tierIndex - 1]]
    const divisionIndex = LEAGUE_DIVISIONS.indexOf(rank)
    const progress = (divisionIndex + 1) / (LEAGUE_DIVISIONS.length + 1)
    const interpolated = tierBelowPercent - (tierBelowPercent - topPercent) * progress
    return percentileToScore(interpolated)
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

// Overwatch divisions (bronze -> ultimate, per OverFast API's CompetitiveDivision
// enum) plus a 1-5 tier within each division (tier 1 = best/closest to promotion).
// Percentiles are rough public estimates (Blizzard doesn't publish exact
// distributions) — placeholder until real data is available, same caveat as
// the other tables in this file.
const OVERWATCH_DIVISION_TOP_PERCENT = {
    ULTIMATE: 0.3,
    GRANDMASTER: 2,
    MASTER: 8,
    DIAMOND: 26,
    PLATINUM: 48,
    GOLD: 70,
    SILVER: 88,
    BRONZE: 100,
}

const OVERWATCH_DIVISION_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER", "GRANDMASTER", "ULTIMATE"]

export function getOverwatchRoleScore(division, tier) {
    if (!division) return null
    const key = division.toUpperCase()
    const topPercent = OVERWATCH_DIVISION_TOP_PERCENT[key]
    if (topPercent === undefined) return null

    const divisionIndex = OVERWATCH_DIVISION_ORDER.indexOf(key)
    if (divisionIndex <= 0 || tier == null) {
        return percentileToScore(topPercent)
    }

    // Interpolate within the division using tier (1=best, 5=worst) as progress.
    const divisionBelowPercent = OVERWATCH_DIVISION_TOP_PERCENT[OVERWATCH_DIVISION_ORDER[divisionIndex - 1]]
    const progress = (6 - tier) / 5
    const interpolated = divisionBelowPercent - (divisionBelowPercent - topPercent) * progress
    return percentileToScore(interpolated)
}

// Overwatch has no single "rank" — role queue (tank/damage/support) and the
// 6v6 Open Queue are tracked as four separate ranks. Per product decision,
// the Rank Score always takes the highest of the four rather than averaging,
// since most players only play 1-2 of these seriously.
export function getOverwatchScore(ranks) {
    if (!ranks) return null
    let best = null
    for (const role of ["tank", "damage", "support", "open"]) {
        const rank = ranks[role]
        if (!rank) continue
        const score = getOverwatchRoleScore(rank.division, rank.tier)
        if (score != null && (best == null || score > best.score)) {
            best = { score, role, division: rank.division, tier: rank.tier }
        }
    }
    return best
}

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
