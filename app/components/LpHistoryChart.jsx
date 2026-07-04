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

// Riot's API never exposes the LP delta of a past match, so we can't recover
// exact historical LP. We reconstruct an approximate trail by walking
// backwards from the current (real) LP value using a typical LP-per-game
// estimate — clearly labeled as an estimate in the UI, never presented as fact.
function buildEstimatedPoints(rankedMatches, currentLeaguePoints) {
    const sorted = [...rankedMatches].sort((a, b) => b.timestamp - a.timestamp)

    let runningLp = currentLeaguePoints
    const points = [{ timestamp: Date.now(), lp: runningLp, delta: null, champion: null, win: null, matchId: null, isEstimated: true }]

    for (const match of sorted) {
        const delta = match.win ? ESTIMATED_LP_GAIN : -ESTIMATED_LP_LOSS
        const lpBefore = Math.max(0, Math.round(runningLp - delta))
        points.push({ timestamp: match.timestamp, lp: lpBefore, delta, champion: match.champion ?? null, win: match.win, matchId: match.matchId ?? null, isEstimated: true })
        runningLp = lpBefore
    }

    return points.reverse() // oldest first
}

function formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
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
                .select("recorded_on, league_points")
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
        // matchHistory (the short, detail-rich list already fetched by RankHero)
        // takes priority for any match that appears in both sources, since it
        // carries champion/full context for the tooltip. The extended timeline
        // only fills in games further back that matchHistory doesn't cover.
        const shortRankedMatches = matchHistory
            .filter(m => m.queueId === RANKED_SOLO_QUEUE_ID)
            .map(m => ({ matchId: m.matchId, win: m.win, timestamp: m.gameEndTimestamp, champion: m.champion }))

        const knownMatchIds = new Set(shortRankedMatches.map(m => m.matchId))
        const extendedMatches = timelinePoints
            .filter(p => !knownMatchIds.has(p.matchId))
            .map(p => ({ matchId: p.matchId, win: p.win, timestamp: p.timestamp, champion: null }))

        const rankedMatches = [...shortRankedMatches, ...extendedMatches]

        const estimatedPoints = buildEstimatedPoints(rankedMatches, currentLeaguePoints)

        const history = trackedHistory ?? []
        const trackedPoints = history.map((entry, i) => ({
            timestamp: new Date(entry.recorded_on).getTime(),
            lp: entry.league_points,
            delta: i === 0 ? null : entry.league_points - history[i - 1].league_points,
            champion: null,
            win: null,
            matchId: null,
            isEstimated: false
        }))

        const points = [...estimatedPoints, ...trackedPoints]
        const estimatedCount = estimatedPoints.length
        // Games actually covered by the win/loss-based estimate (excludes the
        // synthetic "now" point at index 0, and excludes tracked/daily-snapshot
        // points which aren't per-game). This is the real, honest count shown in
        // the "Last N games" label below — never hardcoded to 100.
        const gamesCovered = estimatedCount > 0 ? estimatedCount - 1 : 0

        const labels = points.map(p => formatFullDate(p.timestamp))

        const estimatedData = points.map((p, i) => (i < estimatedCount ? p.lp : null))
        const trackedData = points.map((p, i) => (i >= estimatedCount - 1 ? p.lp : null))

        // Net LP change across the whole combined series (oldest plotted point
        // vs. the current real LP), for the "▲/▼ N LP" summary.
        const firstPoint = points[0] ?? null
        const lastPoint = points[points.length - 1] ?? null
        const netLpChange = firstPoint && lastPoint ? Math.round(lastPoint.lp - firstPoint.lp) : null

        // Tier reference lines. Prefer the precise ladder anchored on the real
        // tier/rank (when RankHero passes it through); otherwise approximate a
        // plausible division-sized band purely from the LP values being plotted
        // (e.g. min/max of 0-100-ish -> draw the boundaries around that range).
        const plottedLpValues = points.map(p => p.lp).filter(v => typeof v === "number")
        const minLp = plottedLpValues.length ? Math.min(...plottedLpValues) : 0
        const maxLp = plottedLpValues.length ? Math.max(...plottedLpValues) : 100

        let referenceLines = []
        if (tier && TIER_LADDER.some(e => e.tier === tier.toUpperCase())) {
            const anchor = toLadderValue(tier, rank, currentLeaguePoints)
            if (anchor != null) {
                // Convert every plotted LP point onto ladder units relative to the
                // anchor, so reference lines line up with the actual chart data
                // even though the chart itself still plots raw within-division LP.
                const bufferLp = 60
                const ladderMin = anchor - (currentLeaguePoints - minLp) - bufferLp
                const ladderMax = anchor + (maxLp - currentLeaguePoints) + bufferLp
                referenceLines = TIER_LADDER
                    .filter(e => e.floor >= ladderMin && e.floor <= ladderMax)
                    .map(e => ({ label: e.label, lpValue: e.floor - anchor + currentLeaguePoints }))
            }
        }
        if (referenceLines.length === 0) {
            // Fallback: no tier/rank prop available — approximate boundaries
            // purely from the visible LP range using the same 100-LP-per-division
            // convention, unanchored to a specific real tier name.
            const bufferLp = 30
            const from = Math.floor((minLp - bufferLp) / LP_PER_DIVISION) * LP_PER_DIVISION
            const to = Math.ceil((maxLp + bufferLp) / LP_PER_DIVISION) * LP_PER_DIVISION
            for (let lpValue = from; lpValue <= to; lpValue += LP_PER_DIVISION) {
                referenceLines.push({ label: `${lpValue} LP`, lpValue })
            }
        }
        // Never show more than a handful at once — keep the grid readable.
        referenceLines = referenceLines.slice(0, 6)

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

        return { points, labels, data, gamesCovered, trackedPointsCount: trackedPoints.length, netLpChange, referenceLines, minLp, maxLp }
    }, [matchHistory, timelinePoints, trackedHistory, currentLeaguePoints, tier, rank, accentColor])

    const { points, labels, data, gamesCovered, trackedPointsCount, netLpChange, referenceLines, minLp, maxLp } = derived

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
            y: { display: false }
        }
    }), [points, labels])

    if (trackedHistory === null) {
        return <p className="text-text-secondary text-xs">Loading LP history...</p>
    }

    const championIconUrl = (championName) =>
        ddragonVersion && championName ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championName}.png` : null

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-text-secondary text-xs">
                    Last {gamesCovered || trackedPointsCount} game{(gamesCovered || trackedPointsCount) === 1 ? "" : "s"}
                </p>
                {netLpChange != null && (
                    <p className={`text-xs font-bold ${netLpChange >= 0 ? "text-positive" : "text-negative"}`}>
                        {netLpChange >= 0 ? "▲" : "▼"} {Math.abs(netLpChange)} LP
                    </p>
                )}
            </div>
            <div className="relative w-full h-[90px] flex">
                {referenceLines.length > 0 && (
                    <div className="relative w-7 flex-shrink-0 h-full">
                        {referenceLines.map((line) => {
                            const range = maxLp - minLp || 1
                            const clamped = Math.min(Math.max(line.lpValue, minLp), maxLp)
                            const topPct = 100 - ((clamped - minLp) / range) * 100
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
                                    {tooltip.point.lp} LP{tooltip.point.isEstimated ? <span className="text-text-secondary"> (estimated)</span> : null}
                                </p>
                                {tooltip.point.delta != null && (
                                    <p className={`text-[11px] font-semibold ${tooltip.point.delta > 0 ? "text-positive" : "text-negative"}`}>
                                        {tooltip.point.delta > 0 ? "+" : ""}{tooltip.point.delta} LP this game
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
                <span>{gamesCovered || trackedPointsCount} games ago</span>
                <span>Last game</span>
            </div>
            <p className="text-text-secondary text-[10px] mt-1.5">
                {trackedPointsCount < 2
                    ? "Dashed = estimated from recent match results. Hover for details. We're now tracking your real LP daily."
                    : "Dashed = estimated, solid = tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
