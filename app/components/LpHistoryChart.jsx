"use client"
import { useState, useEffect, useMemo } from "react"
import { Line } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip
} from "chart.js"
import { supabase } from "@/lib/supabase"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const RANKED_SOLO_QUEUE_ID = 420
const ESTIMATED_LP_GAIN = 17
const ESTIMATED_LP_LOSS = 15

// How many ranked games /api/lp-timeline is allowed to pull win/loss+timestamp
// for, on top of whatever's already in the matchHistory prop. This mirrors
// the MAX_COUNT clamp server-side — kept here too so the UI's own "requested
// N games" number can't drift from what the server will actually allow.
const LP_TIMELINE_MAX_GAMES = 30

// Same tier ladder League itself uses (Riot's league/v4 tier names), ordered
// low to high. Divisions only apply to Iron-Diamond — Master and up are
// divisionless and just keep climbing on LP alone.
const LEAGUE_TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]
const LEAGUE_DIVISIONS = ["IV", "III", "II", "I"]
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]
const TIER_SHORT_LABEL = { IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G", PLATINUM: "P", EMERALD: "E", DIAMOND: "D" }
// Approximation used across the whole reference-line grid: every division
// within the staged tiers (Iron..Diamond) is treated as exactly 100 LP wide,
// stacked back to back. This is the same convention Riot's own UI and most
// third-party sites (op.gg, u.gg) use for these guide-line style charts —
// it's not Riot's literal internal LP model, just a readable approximation.
const LP_PER_DIVISION = 100

// Builds an absolute "LP position on the ladder" value for every
// tier+division boundary within the staged tiers, e.g. IRON IV -> 0,
// IRON III -> 100, ..., DIAMOND I -> 2300, then MASTER+ continues counting
// up from there using raw LP (since apex tiers have no divisions).
function buildTierLadder() {
    const ladder = []
    let cursor = 0
    for (const tier of LEAGUE_TIER_ORDER) {
        if (APEX_TIERS.includes(tier)) {
            ladder.push({ tier, rank: null, floor: cursor, label: tier === "MASTER" ? "M" : tier === "GRANDMASTER" ? "GM" : "C" })
            // Apex tiers are open-ended; only draw one reference line each
            // (no meaningful "next boundary" without real LP-distribution data).
            cursor += LP_PER_DIVISION * 4
            continue
        }
        for (const rank of LEAGUE_DIVISIONS) {
            ladder.push({ tier, rank, floor: cursor, label: `${TIER_SHORT_LABEL[tier]}${rank}` })
            cursor += LP_PER_DIVISION
        }
    }
    return ladder
}

const TIER_LADDER = buildTierLadder()

// Converts a real (tier, division, leaguePoints) triple into the same
// absolute ladder scale buildTierLadder() uses, so the current player's LP
// history can be plotted alongside the reference lines on one consistent
// axis instead of a per-division 0-100 value.
function toLadderValue(tier, rank, leaguePoints) {
    if (!tier) return null
    const entry = TIER_LADDER.find(e => e.tier === tier.toUpperCase() && (APEX_TIERS.includes(tier.toUpperCase()) || e.rank === rank))
    if (!entry) return null
    return entry.floor + (leaguePoints ?? 0)
}

function titleCase(tier) {
    return tier.charAt(0) + tier.slice(1).toLowerCase()
}

// Inverse of toLadderValue: turn an absolute ladder value back into a readable
// "Platinum III · 30 LP" string, for tooltips and axis labels. TIER_LADDER is
// ordered ascending by floor, so the player's tier/division is the highest
// entry whose floor is at or below the value.
function fromLadderValue(value) {
    if (typeof value !== "number") return null
    let entry = TIER_LADDER[0]
    for (const e of TIER_LADDER) {
        if (e.floor <= value) entry = e
        else break
    }
    const lp = Math.max(0, Math.round(value - entry.floor))
    const name = APEX_TIERS.includes(entry.tier)
        ? titleCase(entry.tier)
        : `${titleCase(entry.tier)} ${entry.rank}`
    return { name, lp, text: `${name} · ${lp} LP` }
}

// Riot's API never exposes the LP delta of a past match, so we can't recover
// exact historical LP. We reconstruct an approximate trail by walking backwards
// from a known anchor (the earliest real tracked snapshot, or the current live
// value) using a typical LP-per-game estimate — clearly labeled as an estimate
// in the UI, never presented as fact.
//
// Values are on the absolute ladder scale (buildTierLadder), so the walk
// crosses promotion/demotion boundaries smoothly: winning up from Plat IV 90 LP
// to Plat III 5 LP is a continuous climb, not a jump from 90 down to 5. This is
// the whole fix for "a promotion showed up as an LP loss".
function buildEstimatedPoints(rankedMatches, anchorValue, anchorTimestamp) {
    const sorted = [...rankedMatches].sort((a, b) => b.timestamp - a.timestamp)

    let running = anchorValue
    const points = [{ timestamp: anchorTimestamp, value: running, delta: null, champion: null, win: null, matchId: null, isEstimated: true }]

    for (const match of sorted) {
        const delta = match.win ? ESTIMATED_LP_GAIN : -ESTIMATED_LP_LOSS
        const valueBefore = Math.max(0, Math.round(running - delta))
        points.push({ timestamp: match.timestamp, value: valueBefore, delta, champion: match.champion ?? null, win: match.win, matchId: match.matchId ?? null, isEstimated: true })
        running = valueBefore
    }

    return points.reverse() // oldest first
}

function formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

// Only project within a recent window so an old slump doesn't drag down the
// pace of someone who just turned their climb around (and vice versa).
const PROJECTION_WINDOW_DAYS = 14
// Below this daily rate the trend is noise — call it "holding steady" instead
// of projecting a milestone that's months out on a 0.4 LP/day drift.
const MIN_PACE_LP_PER_DAY = 1
// An ETA further out than this isn't a prediction, it's a guess — hide it.
const MAX_PROJECTION_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

// Climb pace + next-milestone ETA, computed ONLY from real tracked snapshots
// (never the win/loss estimate — projecting off fabricated data would present
// fiction as forecast). Returns null until there's enough signal: >= 3 real
// points spanning >= 3 days inside the recent window.
function buildProjection(realPoints) {
    if (realPoints.length < 3) return null
    const last = realPoints[realPoints.length - 1]
    const windowStart = last.timestamp - PROJECTION_WINDOW_DAYS * DAY_MS
    const windowPoints = realPoints.filter(p => p.timestamp >= windowStart)
    if (windowPoints.length < 3) return null
    const first = windowPoints[0]
    const daySpan = (last.timestamp - first.timestamp) / DAY_MS
    if (daySpan < 3) return null

    const pace = (last.value - first.value) / daySpan
    if (Math.abs(pace) < MIN_PACE_LP_PER_DAY) return { pace: 0, milestone: null, days: null }
    if (pace < 0) return { pace, milestone: null, days: null }

    // Next ladder boundary strictly above the current position — the division
    // (or apex tier) the player is climbing toward. Above the last ladder
    // entry (deep in Challenger) there's nothing left to promote into.
    const next = TIER_LADDER.find(e => e.floor > last.value)
    if (!next) return { pace, milestone: null, days: null }
    const days = Math.max(1, Math.ceil((next.floor - last.value) / pace))
    if (days > MAX_PROJECTION_DAYS) return { pace, milestone: null, days: null }

    const name = APEX_TIERS.includes(next.tier) ? titleCase(next.tier) : `${titleCase(next.tier)} ${next.rank}`
    return { pace, milestone: name, days }
}

// accountId, matchHistory, currentLeaguePoints, accentColor, ddragonVersion:
// existing props, unchanged contract.
//
// puuid (new, optional): needed to fetch /api/lp-timeline's extended
// win/loss window. NOTE: as of this change, RankHero.jsx (the only caller)
// does NOT pass this prop yet — it still needs `puuid={yourPuuid}` added to
// its <LpHistoryChart /> call for the extended estimate window below to
// activate. Until then this component simply falls back to the same short
// matchHistory-only estimate it always used, no crash either way.
//
// tier / rank (new, optional): the account's current Solo/Duo tier + division
// (e.g. "GOLD", "II"), used to anchor the tier reference lines precisely.
// RankHero.jsx already computes this as `rankEntry.tier` / `rankEntry.rank`
// but doesn't forward either prop yet — if absent, reference lines fall back
// to approximating a plausible band purely from the plotted LP values
// (see the `referenceLines.length === 0` fallback branch below).
export default function LpHistoryChart({
    accountId,
    matchHistory,
    currentLeaguePoints,
    accentColor = "#b16cff",
    ddragonVersion = null,
    puuid = null,
    tier = null,
    rank = null
}) {

    const [trackedHistory, setTrackedHistory] = useState(null)
    const [timelinePoints, setTimelinePoints] = useState([])
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        async function fetchHistory() {
            const { data } = await supabase
                .from("lp_history")
                .select("recorded_on, league_points, tier, rank")
                .eq("connected_account_id", accountId)
                .order("recorded_on", { ascending: true })

            setTrackedHistory(data ?? [])
        }

        fetchHistory()
    }, [accountId])

    useEffect(() => {
        // No puuid yet (parent hasn't wired it up) — skip the extended fetch
        // entirely rather than calling the API with a missing param.
        // timelinePoints already defaults to [], so there's nothing to reset.
        if (!puuid) return

        let cancelled = false
        async function fetchTimeline() {
            try {
                const response = await fetch(`/api/lp-timeline?puuid=${encodeURIComponent(puuid)}&count=${LP_TIMELINE_MAX_GAMES}`)
                const json = await response.json()
                if (cancelled) return
                setTimelinePoints(Array.isArray(json?.points) ? json.points : [])
            } catch {
                if (!cancelled) setTimelinePoints([])
            }
        }

        fetchTimeline()
        return () => { cancelled = true }
    }, [puuid])

    // All of this is pure derivation from props/state — wrapped in useMemo so
    // it only recomputes when a real input changes. Without this, every
    // render (including the ones the chart's own tooltip triggers) rebuilds
    // `data`/`points` as brand-new objects, which makes react-chartjs-2 push
    // a fresh update to Chart.js, which re-invokes the external tooltip
    // callback, which calls setTooltip(), which re-renders — a feedback loop
    // that made the chart lag/flicker under the mouse.
    const derived = useMemo(() => {
        // The absolute "ladder position" of the player's current rank. When we
        // have it (tier known) every point is plotted on this one continuous
        // scale, so a promotion climbs smoothly instead of snapping back to the
        // new division's low LP. If tier is missing (freshly unranked) we fall
        // back to plotting raw within-division LP, same as before.
        const currentAbs = toLadderValue(tier, rank, currentLeaguePoints)
        const useLadder = currentAbs != null
        const valueOf = (t, r, lp) => (useLadder ? toLadderValue(t, r, lp) : lp)

        // Real tracked daily snapshots — the accurate part of the history. Each
        // row carries its own tier/rank, so a past Gold IV day and a current
        // Plat II day land at their true positions on the ladder.
        const history = trackedHistory ?? []
        const trackedPoints = history
            .map((entry) => ({
                timestamp: new Date(entry.recorded_on).getTime(),
                value: valueOf(entry.tier, entry.rank, entry.league_points),
                tier: entry.tier, rank: entry.rank, lp: entry.league_points,
                delta: null, champion: null, win: null, matchId: null, isEstimated: false
            }))
            .filter(p => typeof p.value === "number")
        trackedPoints.forEach((p, i) => {
            p.delta = i === 0 ? null : Math.round(p.value - trackedPoints[i - 1].value)
        })

        // Real tracked daily snapshots are the accurate source. Once at least two
        // exist we show only the real line — clean and exact, the way u.gg/op.gg
        // do it. The win/loss estimate is only a bootstrap for brand-new accounts
        // that don't have a couple of days of tracking yet, so a promotion in the
        // real data reads as an honest upward step (and the net LP is real),
        // instead of being averaged against a fabricated estimate.
        const hasEnoughTracked = trackedPoints.length >= 2

        let points = []
        let gamesCovered = 0

        if (hasEnoughTracked) {
            points = [...trackedPoints]
            // Cap with the live value when it's newer than the last snapshot, so
            // the chart ends on the real "right now" rank (today's games show up
            // before the daily cron records them).
            if (useLadder && points.length > 0) {
                const last = points[points.length - 1]
                if (last.value !== currentAbs) {
                    points.push({
                        timestamp: Date.now(), value: currentAbs, tier, rank, lp: currentLeaguePoints,
                        delta: Math.round(currentAbs - last.value), champion: null, win: null, matchId: null, isEstimated: false
                    })
                }
            }
        } else if (typeof currentAbs === "number") {
            // Bootstrap: reconstruct a recent trail by walking back from the live
            // value over recent ranked games. matchHistory (short, detail-rich) is
            // preferred; the extended timeline only fills games it doesn't cover.
            const shortRankedMatches = matchHistory
                .filter(m => m.queueId === RANKED_SOLO_QUEUE_ID)
                .map(m => ({ matchId: m.matchId, win: m.win, timestamp: m.gameEndTimestamp, champion: m.champion }))
            const knownMatchIds = new Set(shortRankedMatches.map(m => m.matchId))
            const extendedMatches = timelinePoints
                .filter(p => !knownMatchIds.has(p.matchId))
                .map(p => ({ matchId: p.matchId, win: p.win, timestamp: p.timestamp, champion: null }))
            const rankedMatches = [...shortRankedMatches, ...extendedMatches]

            const estimatedPoints = buildEstimatedPoints(rankedMatches, currentAbs, Date.now())
            gamesCovered = Math.max(0, estimatedPoints.length - 1)
            points = estimatedPoints
        }

        // Human-readable rank text per point for the tooltip (estimated points
        // only carry an absolute value, no raw LP field).
        const describe = (v) => (useLadder ? (fromLadderValue(v)?.text ?? `${Math.round(v)} LP`) : `${Math.round(v)} LP`)
        points.forEach(p => { p.rankText = describe(p.value) })

        const labels = points.map(p => formatFullDate(p.timestamp))

        // Split the two visual styles by whether each point is estimated. The
        // junction point (first tracked) is added to the estimated series too so
        // the dashed and solid lines connect instead of leaving a gap.
        const boundaryIndex = points.findIndex(p => !p.isEstimated)
        const hasEstimatedSegment = points.some(p => p.isEstimated)
        const estimatedData = points.map((p, i) =>
            (p.isEstimated || (hasEstimatedSegment && i === boundaryIndex)) ? p.value : null)
        const trackedData = points.map(p => (p.isEstimated ? null : p.value))

        // Net change across the whole series, on the absolute scale — now a real
        // "how far did you climb", counting promotions instead of being fooled by
        // per-division LP resets.
        const firstPoint = points[0] ?? null
        const lastPoint = points[points.length - 1] ?? null
        const netLpChange = typeof firstPoint?.value === "number" && typeof lastPoint?.value === "number"
            ? Math.round(lastPoint.value - firstPoint.value)
            : null

        const plottedValues = points.map(p => p.value).filter(v => typeof v === "number")
        const minLp = plottedValues.length ? Math.min(...plottedValues) : 0
        const maxLp = plottedValues.length ? Math.max(...plottedValues) : 100

        // Tier/division reference lines: the ladder floors inside the visible
        // range, labelled by their real tier+division. On the absolute scale they
        // line up exactly with the plotted data — no per-point re-projection.
        let referenceLines = []
        if (useLadder) {
            // A full division of padding so the tier lines bracketing the data
            // always show (e.g. data sitting mid-division at Gold IV 59 LP still
            // draws the Gold IV and Gold III boundaries around it).
            const buffer = LP_PER_DIVISION
            referenceLines = TIER_LADDER
                .filter(e => e.floor >= minLp - buffer && e.floor <= maxLp + buffer)
                .map(e => ({ label: e.label, lpValue: e.floor }))
        }
        if (referenceLines.length === 0) {
            // Fallback (no tier): plain LP grid lines around the visible raw range.
            const buffer = 30
            const from = Math.floor((minLp - buffer) / LP_PER_DIVISION) * LP_PER_DIVISION
            const to = Math.ceil((maxLp + buffer) / LP_PER_DIVISION) * LP_PER_DIVISION
            for (let lpValue = from; lpValue <= to; lpValue += LP_PER_DIVISION) {
                referenceLines.push({ label: `${lpValue} LP`, lpValue })
            }
        }
        // Keep the grid readable — thin to the handful nearest the data's centre.
        if (referenceLines.length > 6) {
            const mid = (minLp + maxLp) / 2
            referenceLines = [...referenceLines]
                .sort((a, b) => Math.abs(a.lpValue - mid) - Math.abs(b.lpValue - mid))
                .slice(0, 6)
                .sort((a, b) => a.lpValue - b.lpValue)
        }

        // Fixed y-range spanning both the data and the reference lines, with a
        // little headroom — shared by the chart scale and the left-edge tier
        // labels so they line up exactly (Chart.js auto-scaling would drift, and
        // would also clip reference lines that sit outside the raw data range).
        const refFloors = referenceLines.map(l => l.lpValue)
        const lo = Math.min(minLp, ...(refFloors.length ? refFloors : [minLp]))
        const hi = Math.max(maxLp, ...(refFloors.length ? refFloors : [maxLp]))
        const yPad = Math.max(15, (hi - lo) * 0.12)
        const yMin = lo - yPad
        const yMax = hi + yPad

        const referenceDatasets = referenceLines.map(line => ({
            label: `ref-${line.label}`,
            data: points.map(() => line.lpValue),
            borderColor: "#ffffff1f",
            borderDash: [3, 5],
            borderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
            order: 10
        }))

        const data = {
            labels,
            datasets: [
                ...referenceDatasets,
                {
                    label: "Estimated",
                    data: estimatedData,
                    borderColor: accentColor,
                    borderDash: [4, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: accentColor,
                    fill: false,
                    spanGaps: true,
                    order: 1
                },
                {
                    label: "Tracked",
                    data: trackedData,
                    borderColor: accentColor,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: accentColor,
                    fill: true,
                    backgroundColor: `${accentColor}14`,
                    spanGaps: true,
                    order: 0
                }
            ]
        }

        // Includes the live "right now" cap point when present, so today's games
        // count toward the pace even before the daily cron records them.
        const projection = useLadder ? buildProjection(points.filter(p => !p.isEstimated)) : null

        return { points, labels, data, gamesCovered, trackedPointsCount: trackedPoints.length, netLpChange, referenceLines, minLp, maxLp, yMin, yMax, firstTimestamp: firstPoint?.timestamp ?? null, projection }
    }, [matchHistory, timelinePoints, trackedHistory, currentLeaguePoints, tier, rank, accentColor])

    const { points, labels, data, gamesCovered, trackedPointsCount, netLpChange, referenceLines, minLp, maxLp, yMin, yMax, firstTimestamp, projection } = derived

    const options = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: false,
                external: (context) => {
                    const tooltipModel = context.tooltip
                    if (!tooltipModel || tooltipModel.opacity === 0 || !tooltipModel.dataPoints?.length) {
                        setTooltip(prev => (prev === null ? prev : null))
                        return
                    }
                    // Reference-line datasets are drawn first and can also
                    // report a data point at this index — ignore those and
                    // find the real LP series entry instead.
                    const realDataPoint = tooltipModel.dataPoints.find(dp => dp.dataset.label === "Estimated" || dp.dataset.label === "Tracked")
                    const dataIndex = (realDataPoint ?? tooltipModel.dataPoints[0]).dataIndex
                    const point = points[dataIndex]
                    if (!point) {
                        setTooltip(prev => (prev === null ? prev : null))
                        return
                    }
                    setTooltip(prev => {
                        const next = {
                            x: tooltipModel.caretX,
                            y: tooltipModel.caretY,
                            align: tooltipModel.caretX > context.chart.width / 2 ? "right" : "left",
                            label: labels[dataIndex],
                            point
                        }
                        // Same position + same point => same content. Bail out
                        // with the previous object so React doesn't re-render
                        // (and re-trigger the chart update loop) on every
                        // animation frame while the mouse sits still.
                        if (prev && prev.x === next.x && prev.y === next.y && prev.point === next.point) return prev
                        return next
                    })
                }
            }
        },
        scales: {
            x: { display: false },
            // Fixed range (not Chart.js auto-scale) so the tier labels on the
            // left line up with the reference lines drawn inside the plot.
            y: { display: false, min: yMin, max: yMax }
        }
    }), [points, labels, yMin, yMax])

    if (trackedHistory === null) {
        return <p className="text-text-secondary text-xs">Loading LP history...</p>
    }

    const championIconUrl = (championName) =>
        ddragonVersion && championName ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championName}.png` : null

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-text-secondary text-xs">
                    {gamesCovered > 0
                        ? `Last ${gamesCovered} ranked game${gamesCovered === 1 ? "" : "s"}`
                        : `Last ${trackedPointsCount} day${trackedPointsCount === 1 ? "" : "s"}`}
                </p>
                {netLpChange != null && (
                    <p className={`text-xs font-bold ${netLpChange > 0 ? "text-positive" : netLpChange < 0 ? "text-negative" : "text-text-secondary"}`}>
                        {netLpChange > 0 ? "▲ " : netLpChange < 0 ? "▼ " : ""}{netLpChange === 0 ? "±0" : Math.abs(netLpChange)} LP
                    </p>
                )}
            </div>
            <div className="relative w-full h-[90px] flex">
                {referenceLines.length > 0 && (
                    <div className="relative w-7 flex-shrink-0 h-full">
                        {referenceLines.map((line) => {
                            const range = yMax - yMin || 1
                            const topPct = 100 - ((line.lpValue - yMin) / range) * 100
                            return (
                                <span
                                    key={line.label}
                                    className="absolute right-1 -translate-y-1/2 text-text-secondary text-[9px] font-mono whitespace-nowrap"
                                    style={{ top: `${topPct}%` }}
                                >
                                    {line.label}
                                </span>
                            )
                        })}
                    </div>
                )}
                <div className="relative flex-1 h-full min-w-0">
                    <Line data={data} options={options} />
                    {tooltip && (
                        <div
                            className="absolute z-10 bg-surface border border-hairline rounded-lg px-2.5 py-2 pointer-events-none shadow-lg flex items-center gap-2"
                            style={{
                                top: Math.max(tooltip.y - 50, 0),
                                left: tooltip.align === "right" ? undefined : tooltip.x + 10,
                                right: tooltip.align === "right" ? `calc(100% - ${tooltip.x - 10}px)` : undefined
                            }}
                        >
                            {championIconUrl(tooltip.point.champion) && (
                                <img
                                    src={championIconUrl(tooltip.point.champion)}
                                    alt={tooltip.point.champion}
                                    className="w-8 h-8 rounded-lg object-cover bg-surface-deep flex-shrink-0"
                                    onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                />
                            )}
                            <div className="whitespace-nowrap">
                                <p className="text-text-primary text-xs font-bold">{tooltip.label}</p>
                                <p className="text-text-primary text-xs">
                                    {tooltip.point.rankText}{tooltip.point.isEstimated ? <span className="text-text-secondary"> (estimated)</span> : null}
                                </p>
                                {tooltip.point.delta != null && tooltip.point.delta !== 0 && (
                                    <p className={`text-[11px] font-semibold ${tooltip.point.delta > 0 ? "text-positive" : "text-negative"}`}>
                                        {tooltip.point.delta > 0 ? "+" : ""}{tooltip.point.delta} LP{tooltip.point.win != null ? " this game" : ""}
                                    </p>
                                )}
                                {tooltip.point.win != null && (
                                    <p className="text-text-secondary text-[10px]">
                                        {tooltip.point.champion ? `${tooltip.point.champion} · ` : ""}{tooltip.point.win ? "Win" : "Loss"}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-between text-text-secondary text-[9px] mt-1">
                <span>{firstTimestamp ? formatFullDate(firstTimestamp) : "Start"}</span>
                <span>Now</span>
            </div>
            {projection && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                    <span className={`font-semibold ${projection.pace > 0 ? "text-positive" : projection.pace < 0 ? "text-negative" : "text-text-secondary"}`}>
                        {projection.pace > 0 ? "▲" : projection.pace < 0 ? "▼" : "◆"} {projection.pace === 0 ? "Holding steady" : `${Math.abs(projection.pace).toFixed(1)} LP/day`}
                    </span>
                    {projection.milestone && (
                        <span className="text-text-secondary">
                            · On pace for <span className="text-text-primary font-semibold">{projection.milestone}</span> in ~{projection.days} day{projection.days === 1 ? "" : "s"}
                        </span>
                    )}
                </div>
            )}
            <p className="text-text-secondary text-[10px] mt-1.5">
                {gamesCovered > 0
                    ? "Dashed = estimated from recent match results. We're now tracking your real LP daily. Hover for details."
                    : "Real LP, tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
