"use client"
import { useState, useEffect } from "react"
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

// Same dashed guide-line grid as the League LP chart. Picks a "nice" step so
// ~5-6 evenly spaced reference lines span the whole value range (never
// negative — LP has a floor of 0). `buffer` adds a little headroom past the
// data so the line isn't glued to the top/bottom.
function buildReferenceGrid(minV, maxV, unit, buffer) {
    const lo = Math.max(0, minV - buffer)
    const hi = maxV + buffer
    const range = Math.max(hi - lo, 1)
    const rough = range / 5
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
    const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= rough) ?? 10 * magnitude
    const axisMin = Math.floor(lo / step) * step
    const axisMax = Math.ceil(hi / step) * step
    const lines = []
    for (let v = axisMin; v <= axisMax + step * 0.001; v += step) lines.push({ label: `${Math.round(v)} ${unit}`, value: v })
    return { lines, axisMin, axisMax }
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

export default function TftLpHistoryChart({ accountId, matchHistory, currentLeaguePoints, accentColor = "#0bc4e3", queueType = "RANKED_TFT" }) {

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

    if (trackedHistory === null) {
        return <p className="text-text-secondary text-xs">Loading LP history...</p>
    }

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
    // Games actually covered by the placement-based estimate (excludes the
    // synthetic "now" point at index 0), for the honest "Last N games" label.
    const gamesCovered = estimatedCount > 0 ? estimatedCount - 1 : 0

    const labels = points.map(p => formatFullDate(p.timestamp))

    const estimatedData = points.map((p, i) => (i < estimatedCount ? p.lp : null))
    const trackedData = points.map((p, i) => (i >= estimatedCount - 1 ? p.lp : null))

    const lpValues = points.map(p => p.lp).filter(v => typeof v === "number")
    const minV = lpValues.length ? Math.min(...lpValues) : 0
    const maxV = lpValues.length ? Math.max(...lpValues) : 100
    const { lines: referenceLines, axisMin, axisMax } = buildReferenceGrid(minV, maxV, "LP", 30)

    const firstPoint = points[0] ?? null
    const lastPoint = points[points.length - 1] ?? null
    const netLpChange = firstPoint && lastPoint ? Math.round(lastPoint.lp - firstPoint.lp) : null

    const referenceDatasets = referenceLines.map(line => ({
        label: `ref-${line.label}`,
        data: points.map(() => line.value),
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

    const options = {
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
                        setTooltip(null)
                        return
                    }
                    // Reference-line datasets report a point at this index too —
                    // pick the real LP series entry instead.
                    const realDataPoint = tooltipModel.dataPoints.find(dp => dp.dataset.label === "Estimated" || dp.dataset.label === "Tracked")
                    const dataIndex = (realDataPoint ?? tooltipModel.dataPoints[0]).dataIndex
                    const point = points[dataIndex]
                    if (!point) {
                        setTooltip(null)
                        return
                    }
                    setTooltip({
                        x: tooltipModel.caretX,
                        y: tooltipModel.caretY,
                        align: tooltipModel.caretX > context.chart.width / 2 ? "right" : "left",
                        label: labels[dataIndex],
                        point
                    })
                }
            }
        },
        scales: {
            x: { display: false },
            y: { display: false, min: axisMin, max: axisMax }
        }
    }

    return (
        <div className="w-full">
            <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-text-secondary text-xs">
                    Last {gamesCovered || trackedPoints.length} game{(gamesCovered || trackedPoints.length) === 1 ? "" : "s"}
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
                            const range = axisMax - axisMin || 1
                            const topPct = 100 - ((line.value - axisMin) / range) * 100
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
                <span>{gamesCovered || trackedPoints.length} game{(gamesCovered || trackedPoints.length) === 1 ? "" : "s"} ago</span>
                <span>Last game</span>
            </div>
            <p className="text-text-secondary text-[10px] mt-1.5">
                {trackedPoints.length < 2
                    ? "Dashed = estimated from recent placements. Hover for details. We're now tracking your real LP daily."
                    : "Dashed = estimated, solid = tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
