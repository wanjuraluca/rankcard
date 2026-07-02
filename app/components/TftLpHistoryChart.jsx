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

function buildEstimatedPoints(matchHistory, currentLeaguePoints) {
    const sortedMatches = [...matchHistory].sort((a, b) => (b.game_datetime ?? 0) - (a.game_datetime ?? 0))

    let runningLp = currentLeaguePoints
    const points = [{ timestamp: Date.now(), lp: runningLp, delta: null, placement: null, topTrait: null, isEstimated: true }]

    for (const match of sortedMatches) {
        const delta = ESTIMATED_LP_BY_PLACEMENT[match.placement] ?? 0
        const lpBefore = Math.max(0, Math.round(runningLp - delta))
        points.push({
            timestamp: match.game_datetime,
            lp: lpBefore,
            delta,
            placement: match.placement,
            topTrait: match.topTraits?.[0] ?? null,
            isEstimated: true
        })
        runningLp = lpBefore
    }

    return points.reverse() // oldest first
}

function formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function TftLpHistoryChart({ accountId, matchHistory, currentLeaguePoints, accentColor = "#0bc4e3", queueType = "RANKED_TFT", tier = null, rank = null }) {

    const [trackedHistory, setTrackedHistory] = useState(null)
    const [tooltip, setTooltip] = useState(null)

    useEffect(() => {
        async function fetchHistory() {
            const { data } = await supabase
                .from("tft_lp_history")
                .select("recorded_on, league_points")
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

        const estimatedPoints = buildEstimatedPoints(matchHistory, currentLeaguePoints)

        const trackedPoints = trackedHistory.map((entry, i) => ({
            timestamp: new Date(entry.recorded_on).getTime(),
            lp: entry.league_points,
            delta: i === 0 ? null : entry.league_points - trackedHistory[i - 1].league_points,
            placement: null,
            topTrait: null,
            isEstimated: false
        }))

        const points = [...estimatedPoints, ...trackedPoints]
        const estimatedCount = estimatedPoints.length
        const gamesCovered = estimatedCount > 0 ? estimatedCount - 1 : 0

        const labels = points.map(p => formatFullDate(p.timestamp))
        const estimatedData = points.map((p, i) => (i < estimatedCount ? p.lp : null))
        const trackedData = points.map((p, i) => (i >= estimatedCount - 1 ? p.lp : null))

        const plottedLp = points.map(p => p.lp).filter(v => typeof v === "number")
        const minLp = plottedLp.length ? Math.min(...plottedLp) : 0
        const maxLp = plottedLp.length ? Math.max(...plottedLp) : 100

        const firstPoint = points[0] ?? null
        const lastPoint = points[points.length - 1] ?? null
        const netLpChange = firstPoint && lastPoint ? Math.round(lastPoint.lp - firstPoint.lp) : null

        // Reference lines: prefer the real tier ladder anchored on the current
        // tier/rank so the guides read as rank boundaries (G IV, G III, ...);
        // otherwise fall back to plain LP guide values from the visible range.
        let referenceLines = []
        if (tier && TIER_LADDER.some(e => e.tier === tier.toUpperCase())) {
            const anchor = toLadderValue(tier, rank, currentLeaguePoints)
            if (anchor != null) {
                const bufferLp = 60
                const ladderMin = anchor - (currentLeaguePoints - minLp) - bufferLp
                const ladderMax = anchor + (maxLp - currentLeaguePoints) + bufferLp
                referenceLines = TIER_LADDER
                    .filter(e => e.floor >= ladderMin && e.floor <= ladderMax)
                    .map(e => ({ label: e.label, lpValue: e.floor - anchor + currentLeaguePoints }))
            }
        }
        if (referenceLines.length === 0) {
            const bufferLp = 30
            const from = Math.floor((minLp - bufferLp) / LP_PER_DIVISION) * LP_PER_DIVISION
            const to = Math.ceil((maxLp + bufferLp) / LP_PER_DIVISION) * LP_PER_DIVISION
            for (let lpValue = from; lpValue <= to; lpValue += LP_PER_DIVISION) {
                referenceLines.push({ label: `${lpValue} LP`, lpValue })
            }
        }
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

        return { points, labels, data, referenceLines, minLp, maxLp, gamesCovered, trackedCount: trackedPoints.length, netLpChange }
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
                y: { display: false }
            }
        }
    }, [derived])

    if (trackedHistory === null || !derived) {
        return <p className="text-text-secondary text-xs">Loading LP history...</p>
    }

    const { referenceLines, minLp, maxLp, gamesCovered, trackedCount, netLpChange, data } = derived
    const gameLabelCount = gamesCovered || trackedCount

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-text-secondary text-xs">
                    Last {gameLabelCount} game{gameLabelCount === 1 ? "" : "s"}
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
                            className="absolute z-10 bg-surface border border-line rounded-lg px-2.5 py-2 pointer-events-none shadow-lg flex items-center gap-2"
                            style={{
                                top: Math.max(tooltip.y - 50, 0),
                                left: tooltip.align === "right" ? undefined : tooltip.x + 10,
                                right: tooltip.align === "right" ? `calc(100% - ${tooltip.x - 10}px)` : undefined
                            }}
                        >
                            {tooltip.point.topTrait?.icon && (
                                <div
                                    className="w-8 h-8 rounded-md bg-surface-deep flex-shrink-0 flex items-center justify-center"
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
                                    {tooltip.point.lp} LP{tooltip.point.isEstimated ? <span className="text-text-secondary"> (estimated)</span> : null}
                                </p>
                                {tooltip.point.delta != null && (
                                    <p className={`text-[11px] font-semibold ${tooltip.point.delta > 0 ? "text-positive" : "text-negative"}`}>
                                        {tooltip.point.delta > 0 ? "+" : ""}{tooltip.point.delta} LP this game
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
                <span>{gameLabelCount} game{gameLabelCount === 1 ? "" : "s"} ago</span>
                <span>Last game</span>
            </div>
            <p className="text-text-secondary text-[10px] mt-1.5">
                {trackedCount < 2
                    ? "Dashed = estimated from recent placements. Hover for details. We're now tracking your real LP daily."
                    : "Dashed = estimated, solid = tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
