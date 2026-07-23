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

// TFT has no per-match LP delta in the API (same limitation as League), and
// LP swings depend on placement rather than win/loss. This rough table is a
// typical mid-ladder estimate, clearly labeled — never presented as fact.
const ESTIMATED_LP_BY_PLACEMENT = {
    1: 8,
    2: 6,
    3: 4,
    4: 2,
    5: -2,
    6: -4,
    7: -6,
    8: -8
}

// TFT uses the exact same tier ladder as League (Iron..Challenger, divisions
// IV-I, apex tiers divisionless), so the LP history reference grid can label
// real rank boundaries (e.g. "G IV") the same way the League chart does.
const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]
const DIVISIONS = ["IV", "III", "II", "I"]
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]
const TIER_SHORT_LABEL = { IRON: "I", BRONZE: "B", SILVER: "S", GOLD: "G", PLATINUM: "P", EMERALD: "E", DIAMOND: "D" }
const LP_PER_DIVISION = 100

function buildTierLadder() {
    const ladder = []
    let cursor = 0
    for (const tier of TIER_ORDER) {
        if (APEX_TIERS.includes(tier)) {
            ladder.push({ tier, rank: null, floor: cursor, label: tier === "MASTER" ? "M" : tier === "GRANDMASTER" ? "GM" : "C" })
            cursor += LP_PER_DIVISION * 4
            continue
        }
        for (const rank of DIVISIONS) {
            ladder.push({ tier, rank, floor: cursor, label: `${TIER_SHORT_LABEL[tier]}${rank}` })
            cursor += LP_PER_DIVISION
        }
    }
    return ladder
}

const TIER_LADDER = buildTierLadder()

function toLadderValue(tier, rank, leaguePoints) {
    if (!tier) return null
    const entry = TIER_LADDER.find(e => e.tier === tier.toUpperCase() && (APEX_TIERS.includes(tier.toUpperCase()) || e.rank === rank))
    if (!entry) return null
    return entry.floor + (leaguePoints ?? 0)
}

function titleCase(tier) {
    return tier.charAt(0) + tier.slice(1).toLowerCase()
}

// Inverse of toLadderValue: absolute ladder value -> "Platinum III · 30 LP".
function fromLadderValue(value) {
    if (typeof value !== "number") return null
    let entry = TIER_LADDER[0]
    for (const e of TIER_LADDER) {
        if (e.floor <= value) entry = e
        else break
    }
    const lp = Math.max(0, Math.round(value - entry.floor))
    const name = APEX_TIERS.includes(entry.tier) ? titleCase(entry.tier) : `${titleCase(entry.tier)} ${entry.rank}`
    return { name, lp, text: `${name} · ${lp} LP` }
}

// Walk backwards from a known anchor on the absolute ladder scale, so a
// promotion (LP reset in the new division) reads as a continuous climb instead
// of a drop. Estimate only, clearly labeled — TFT has no per-match LP delta.
function buildEstimatedPoints(matchHistory, anchorValue, anchorTimestamp) {
    const sortedMatches = [...matchHistory].sort((a, b) => (b.game_datetime ?? 0) - (a.game_datetime ?? 0))

    let running = anchorValue
    const points = [{ timestamp: anchorTimestamp, value: running, delta: null, placement: null, topTrait: null, isEstimated: true }]

    for (const match of sortedMatches) {
        const delta = ESTIMATED_LP_BY_PLACEMENT[match.placement] ?? 0
        const valueBefore = Math.max(0, Math.round(running - delta))
        points.push({
            timestamp: match.game_datetime,
            value: valueBefore,
            delta,
            placement: match.placement,
            topTrait: match.topTraits?.[0] ?? null,
            isEstimated: true
        })
        running = valueBefore
    }

    return points.reverse() // oldest first
}

function formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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
// (never the placement estimate — projecting off fabricated data would present
// fiction as forecast). Returns null until there's enough signal: >= 3 real
// points spanning >= 3 days inside the recent window. Same logic as the
// League chart's buildProjection (kept local like the rest of the ladder math).
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

    const next = TIER_LADDER.find(e => e.floor > last.value)
    if (!next) return { pace, milestone: null, days: null }
    const days = Math.max(1, Math.ceil((next.floor - last.value) / pace))
    if (days > MAX_PROJECTION_DAYS) return { pace, milestone: null, days: null }

    const name = APEX_TIERS.includes(next.tier) ? titleCase(next.tier) : `${titleCase(next.tier)} ${next.rank}`
    return { pace, milestone: name, days }
}

export default function TftLpHistoryChart({ accountId, matchHistory, currentLeaguePoints, accentColor = "#0bc4e3", queueType = "RANKED_TFT", tier = null, rank = null }) {

    const [trackedHistory, setTrackedHistory] = useState(null)
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        async function fetchHistory() {
            const { data } = await supabase
                .from("tft_lp_history")
                .select("recorded_on, league_points, tier, rank")
                .eq("connected_account_id", accountId)
                .eq("queue_type", queueType)
                .order("recorded_on", { ascending: true })

            setTrackedHistory(data ?? [])
        }

        fetchHistory()
    }, [accountId, queueType])

    // Memoized so a tooltip-triggered re-render doesn't rebuild `data` into a
    // fresh object, which would make react-chartjs-2 push another chart update
    // -> re-fire the external tooltip -> setState -> loop (same guard as the
    // League LP chart).
    const derived = useMemo(() => {
        if (trackedHistory === null) return null

        // Absolute ladder position of the current rank; when known, everything is
        // plotted on this one continuous scale so promotions climb smoothly. Falls
        // back to raw within-division LP if the tier is missing.
        const currentAbs = toLadderValue(tier, rank, currentLeaguePoints)
        const useLadder = currentAbs != null
        const valueOf = (t, r, lp) => (useLadder ? toLadderValue(t, r, lp) : lp)

        // Real tracked daily snapshots carry their own tier/rank, so each lands at
        // its true ladder position.
        const trackedPoints = trackedHistory
            .map((entry) => ({
                timestamp: new Date(entry.recorded_on).getTime(),
                value: valueOf(entry.tier, entry.rank, entry.league_points),
                tier: entry.tier, rank: entry.rank, lp: entry.league_points,
                delta: null, placement: null, topTrait: null, isEstimated: false
            }))
            .filter(p => typeof p.value === "number")
        trackedPoints.forEach((p, i) => {
            p.delta = i === 0 ? null : Math.round(p.value - trackedPoints[i - 1].value)
        })

        // Once at least two real snapshots exist, show only the accurate tracked
        // line; the placement-based estimate is a bootstrap for brand-new accounts.
        const hasEnoughTracked = trackedPoints.length >= 2
        let points = []
        let gamesCovered = 0

        if (hasEnoughTracked) {
            points = [...trackedPoints]
            if (useLadder && points.length > 0) {
                const last = points[points.length - 1]
                if (last.value !== currentAbs) {
                    points.push({
                        timestamp: Date.now(), value: currentAbs, tier, rank, lp: currentLeaguePoints,
                        delta: Math.round(currentAbs - last.value), placement: null, topTrait: null, isEstimated: false
                    })
                }
            }
            // Tracked points are daily snapshots, not per-game, so there's no
            // single match to attach to any of them in general — except the
            // very last point on the chart (whether that's today's live cap
            // point above, or the last real snapshot if it already matches the
            // live value), which can reasonably borrow the top trait from the
            // most recent game, since that's the game that produced the rank
            // currently on screen.
            if (points.length > 0) {
                const latestMatch = [...matchHistory]
                    .sort((a, b) => (b.game_datetime ?? 0) - (a.game_datetime ?? 0))[0]
                if (latestMatch?.topTraits?.[0]) points[points.length - 1].topTrait = latestMatch.topTraits[0]
            }
        } else if (typeof currentAbs === "number") {
            const estimatedPoints = buildEstimatedPoints(matchHistory, currentAbs, Date.now())
            gamesCovered = Math.max(0, estimatedPoints.length - 1)
            points = estimatedPoints
        }

        const describe = (v) => (useLadder ? (fromLadderValue(v)?.text ?? `${Math.round(v)} LP`) : `${Math.round(v)} LP`)
        points.forEach(p => { p.rankText = describe(p.value) })

        const labels = points.map(p => formatFullDate(p.timestamp))
        const estimatedData = points.map(p => (p.isEstimated ? p.value : null))
        const trackedData = points.map(p => (p.isEstimated ? null : p.value))

        const plottedValues = points.map(p => p.value).filter(v => typeof v === "number")
        const minLp = plottedValues.length ? Math.min(...plottedValues) : 0
        const maxLp = plottedValues.length ? Math.max(...plottedValues) : 100

        const firstPoint = points[0] ?? null
        const lastPoint = points[points.length - 1] ?? null
        const netLpChange = typeof firstPoint?.value === "number" && typeof lastPoint?.value === "number"
            ? Math.round(lastPoint.value - firstPoint.value)
            : null

        // Tier/division reference lines = ladder floors inside the visible range,
        // labelled by real tier+division (they line up exactly on this scale).
        let referenceLines = []
        if (useLadder) {
            // A full division of padding so the bracketing tier lines always show
            // even when the data sits mid-division far from a floor.
            const buffer = LP_PER_DIVISION
            referenceLines = TIER_LADDER
                .filter(e => e.floor >= minLp - buffer && e.floor <= maxLp + buffer)
                .map(e => ({ label: e.label, lpValue: e.floor }))
        }
        if (referenceLines.length === 0) {
            const buffer = 30
            const from = Math.floor((minLp - buffer) / LP_PER_DIVISION) * LP_PER_DIVISION
            const to = Math.ceil((maxLp + buffer) / LP_PER_DIVISION) * LP_PER_DIVISION
            for (let lpValue = from; lpValue <= to; lpValue += LP_PER_DIVISION) {
                referenceLines.push({ label: `${lpValue} LP`, lpValue })
            }
        }
        if (referenceLines.length > 6) {
            const mid = (minLp + maxLp) / 2
            referenceLines = [...referenceLines]
                .sort((a, b) => Math.abs(a.lpValue - mid) - Math.abs(b.lpValue - mid))
                .slice(0, 6)
                .sort((a, b) => a.lpValue - b.lpValue)
        }

        // y-range spanning both data and reference lines (+ headroom), shared by
        // the chart scale and the tier labels so they align and nothing clips.
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

        return { points, labels, data, referenceLines, minLp, maxLp, yMin, yMax, gamesCovered, trackedCount: trackedPoints.length, netLpChange, firstTimestamp: firstPoint?.timestamp ?? null, projection }
    }, [trackedHistory, matchHistory, currentLeaguePoints, accentColor, tier, rank])

    const options = useMemo(() => {
        if (!derived) return null
        return {
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
                        const realDataPoint = tooltipModel.dataPoints.find(dp => dp.dataset.label === "Estimated" || dp.dataset.label === "Tracked")
                        const dataIndex = (realDataPoint ?? tooltipModel.dataPoints[0]).dataIndex
                        const point = derived.points[dataIndex]
                        if (!point) {
                            setTooltip(prev => (prev === null ? prev : null))
                            return
                        }
                        setTooltip(prev => {
                            const next = {
                                x: tooltipModel.caretX,
                                y: tooltipModel.caretY,
                                align: tooltipModel.caretX > context.chart.width / 2 ? "right" : "left",
                                label: derived.labels[dataIndex],
                                point
                            }
                            if (prev && prev.x === next.x && prev.y === next.y && prev.point === next.point) return prev
                            return next
                        })
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false, min: derived.yMin, max: derived.yMax }
            }
        }
    }, [derived])

    if (trackedHistory === null || !derived) {
        return <p className="text-text-secondary text-xs">Loading LP history...</p>
    }

    const { referenceLines, minLp, maxLp, yMin, yMax, gamesCovered, trackedCount, netLpChange, data, firstTimestamp, projection } = derived

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-text-secondary text-xs">
                    {gamesCovered > 0
                        ? `Last ${gamesCovered} game${gamesCovered === 1 ? "" : "s"}`
                        : `Last ${trackedCount} day${trackedCount === 1 ? "" : "s"}`}
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
                            {tooltip.point.topTrait?.icon && (
                                <div
                                    className="w-8 h-8 rounded-lg bg-surface-deep flex-shrink-0 flex items-center justify-center"
                                    style={{ border: `1.5px solid ${accentColor}` }}
                                >
                                    <img
                                        src={tooltip.point.topTrait.icon}
                                        alt={tooltip.point.topTrait.name}
                                        className="w-5 h-5 object-contain"
                                        style={{ filter: "brightness(0) invert(1)" }}
                                        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                    />
                                </div>
                            )}
                            <div className="whitespace-nowrap">
                                <p className="text-text-primary text-xs font-bold">{tooltip.label}</p>
                                <p className="text-text-primary text-xs">
                                    {tooltip.point.rankText}{tooltip.point.isEstimated ? <span className="text-text-secondary"> (estimated)</span> : null}
                                </p>
                                {tooltip.point.delta != null && tooltip.point.delta !== 0 && (
                                    <p className={`text-[11px] font-semibold ${tooltip.point.delta > 0 ? "text-positive" : "text-negative"}`}>
                                        {tooltip.point.delta > 0 ? "+" : ""}{tooltip.point.delta} LP{tooltip.point.placement != null ? " this game" : ""}
                                    </p>
                                )}
                                {tooltip.point.placement != null && (
                                    <p className="text-text-secondary text-[10px]">#{tooltip.point.placement} place</p>
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
                    ? "Dashed = estimated from recent placements. We're now tracking your real LP daily. Hover for details."
                    : "Real LP, tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
