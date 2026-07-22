// Absolute League/TFT rank ladder: turns a (tier, division, LP) triple into one
// continuous number (Iron IV = 0, Iron III = 100, ... Diamond I = 2300, then
// Master+ keep counting up on raw LP). This is what lets us measure the real LP
// change of a single game across a promotion — e.g. Plat IV 90 (1690) to Plat
// III 20 (1720) is +30, not a reset to 20. Same ladder the LP history chart
// plots on. Kept framework-free so both server routes and client components can
// use it.
const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]
const DIVISIONS = ["IV", "III", "II", "I"]
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]
const LP_PER_DIVISION = 100
const LP_PER_TIER = LP_PER_DIVISION * DIVISIONS.length // staged tiers span 4 divisions

export function toLadderValue(tier, rank, leaguePoints) {
    if (!tier) return null
    const upper = tier.toUpperCase()
    const tierIndex = TIER_ORDER.indexOf(upper)
    if (tierIndex < 0) return null
    let floor = tierIndex * LP_PER_TIER
    if (!APEX_TIERS.includes(upper)) {
        const divIndex = DIVISIONS.indexOf(rank)
        if (divIndex < 0) return null
        floor += divIndex * LP_PER_DIVISION
    }
    return floor + (leaguePoints ?? 0)
}
