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

    const labels = points.map(p => formatFullDate(p.timestamp))

    const estimatedData = points.map((p, i) => (i < estimatedCount ? p.lp : null))
    const trackedData = points.map((p, i) => (i >= estimatedCount - 1 ? p.lp : null))

    const data = {
        labels,
        datasets: [
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
                spanGaps: true
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
                spanGaps: true
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
                    const dataIndex = tooltipModel.dataPoints[0].dataIndex
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
            y: { display: false }
        }
    }

    return (
        <div className="w-full">
            <div className="relative w-full h-[90px]">
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
            <p className="text-text-secondary text-[10px] mt-1.5">
                {trackedPoints.length < 2
                    ? "Dashed = estimated from recent placements. Hover for details. We're now tracking your real LP daily."
                    : "Dashed = estimated, solid = tracked daily since you connected this account. Hover for details."}
            </p>
        </div>
    )
}
