// Shared by RankHero.jsx's match-history rows and LpHistoryChart.jsx/
// TftLpHistoryChart.jsx's line charts — both need the SAME per-game LP delta
// for the same match, or the two views visibly disagree (e.g. match history
// says a game was +17 while the chart, computed independently, says +30).
// Single source of truth lives here.

// Local Y-M-D key, used to line a game up with the daily snapshot taken the
// same calendar day. Never UTC, so a late-night game and its snapshot match
// the way they read on screen for the viewer.
export function dayKey(timestamp) {
    const d = new Date(timestamp)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Give every game its REAL LP delta wherever provable, instead of a blanket
// estimate. Daily snapshots hold the true ladder value at the end of each
// day; the live value is the truth for today. So a game's real delta is
// derivable when its day's end-value and the prior known day's end-value are
// both known and only that one game happened that day:
// delta = todayValue - yesterdayValue (exact, correct across a promotion —
// Plat IV 90 -> Plat III 20 reads as +30, not a hardcoded +17).
//
// - single game on a day with both day-boundaries known -> exact
// - multiple games that day -> the real net is split across them by their
//   estimate weights (the daily total stays exact, per-game stays approximate)
// - day we can't bracket with real values -> fall back to the typical estimate
//
// Mutates each game with .delta and .isEstimated. `games` must have a
// `.timestamp`; `estimateOf(game)` returns that game's typical-gain/-loss
// fallback (win/loss for League, placement table for TFT).
export function assignGameDeltas(games, snapshots, currentValue, estimateOf) {
    const checkpoints = snapshots.map(s => ({ dayK: dayKey(s.timestamp), t: s.timestamp, value: s.value }))
    const todayK = dayKey(Date.now())
    const today = checkpoints.find(c => c.dayK === todayK)
    if (today) today.value = currentValue
    else checkpoints.push({ dayK: todayK, t: Date.now(), value: currentValue })
    checkpoints.sort((a, b) => a.t - b.t)
    const valueByDay = new Map(checkpoints.map(c => [c.dayK, c.value]))

    const gamesByDay = new Map()
    for (const g of games) {
        const k = dayKey(g.timestamp)
        if (!gamesByDay.has(k)) gamesByDay.set(k, [])
        gamesByDay.get(k).push(g)
    }

    for (const [dayK, dayGames] of gamesByDay) {
        const after = valueByDay.get(dayK)
        const idx = checkpoints.findIndex(c => c.dayK === dayK)
        const before = idx > 0 ? checkpoints[idx - 1].value : undefined
        if (after != null && before != null) {
            const realNet = after - before
            if (dayGames.length === 1) {
                dayGames[0].delta = realNet
                dayGames[0].isEstimated = false
            } else {
                // Keep the day's real net exact, split it across the day's games
                // in proportion to their typical estimates (sign-aware). Per-game
                // stays an estimate; only the daily total is guaranteed real.
                const estTotal = dayGames.reduce((s, g) => s + estimateOf(g), 0) || dayGames.length
                let acc = 0
                dayGames.forEach((g, i) => {
                    const share = i === dayGames.length - 1
                        ? realNet - acc
                        : Math.round(realNet * (estimateOf(g) / estTotal))
                    g.delta = share
                    g.isEstimated = true
                    acc += share
                })
            }
        } else {
            for (const g of dayGames) {
                // No real bracket for this day — a measured per-game delta from
                // match_lp (League only, see mergeRealLpDeltas) is the next best
                // thing, else the typical estimate.
                g.delta = (g.measuredDelta != null) ? g.measuredDelta : estimateOf(g)
                g.isEstimated = g.measuredDelta == null
            }
        }
    }
    return games
}
