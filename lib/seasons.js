// Riot's own past-season rank history isn't exposed by any public API
// (league-v4 only ever returns the CURRENT rank) — confirmed by direct
// research 2026-07-09, see project_redesign_handoff memory. op.gg's own help
// center says they self-track via periodic snapshots too, not a Riot
// endpoint. So "season badges" here are OUR OWN forward-tracking, built from
// the daily lp_history/tft_lp_history snapshots this app already writes —
// they start empty and fill in as splits complete, they are NOT Riot's
// official season/split numbering (exact patch-day boundaries shift every
// year and aren't published in a queryable form). Splits are approximated as
// three roughly-equal thirds of the calendar year, which is close to Riot's
// real cadence (~4 months/split) without pretending to be authoritative.
const RANK_ORDER = ["IV", "III", "II", "I"]

export function getSeasonLabel(dateStr) {
    const date = new Date(dateStr)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth() // 0-11
    const split = month < 4 ? 1 : month < 8 ? 2 : 3
    return `${year} S${split}`
}

export function getCurrentSeasonLabel() {
    return getSeasonLabel(new Date().toISOString())
}

// Compares two {tier, rank} entries, returns true if `a` is a strictly
// higher rank than `b`. Apex tiers (Master+) have no rank subdivisions.
export function isHigherRank(a, b, tierOrder) {
    const tierDiff = tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
    if (tierDiff !== 0) return tierDiff > 0
    return RANK_ORDER.indexOf(a.rank ?? "IV") - RANK_ORDER.indexOf(b.rank ?? "IV") > 0
}

// Reduces a list of daily {recorded_on, tier, rank} snapshots into one peak
// entry per season label, dropping the current (still in-progress) season —
// that one isn't "history" yet, it's just today's live rank shown elsewhere.
export function peaksBySeasonExcludingCurrent(snapshots, tierOrder) {
    const currentSeason = getCurrentSeasonLabel()
    const bySeasonPeak = {}
    for (const snap of snapshots) {
        if (!snap.tier || !tierOrder.includes(snap.tier)) continue
        const season = getSeasonLabel(snap.recorded_on)
        if (season === currentSeason) continue
        const existing = bySeasonPeak[season]
        if (!existing || isHigherRank(snap, existing, tierOrder)) {
            bySeasonPeak[season] = { tier: snap.tier, rank: snap.rank ?? null }
        }
    }
    return Object.entries(bySeasonPeak)
        .map(([season, peak]) => ({ season, ...peak }))
        .sort((a, b) => b.season.localeCompare(a.season))
}
