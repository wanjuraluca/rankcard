"use client"
import { useState } from "react"
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

function formatFullDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

// Same dashed guide-line grid as the League LP chart, generic over the plotted
// unit. Picks a "nice" step so ~5-6 evenly spaced reference lines span the
// whole value range (never negative — RR/LP have a floor of 0). `buffer` adds
// a little headroom past the data so the line isn't glued to the top/bottom.
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

// Unlike League's LP history, Henrik's mmr-history endpoint reports the real
// RR after every match, so this chart needs no estimation logic.
export default function RrHistoryChart({ mmrHistory, accentColor = "#ff4655" }) {

    const [tooltip, setTooltip] = useState(null)

    if (!mmrHistory || mmrHistory.length === 0) {
        return <p className="text-text-secondary text-xs">No RR history yet.</p>
    }

    const labels = mmrHistory.map(p => formatFullDate(p.timestamp))
    const rrValues = mmrHistory.map(p => p.rr)
    const minV = Math.min(...rrValues)
    const maxV = Math.max(...rrValues)

    const { lines: referenceLines, axisMin, axisMax } = buildReferenceGrid(minV, maxV, "RR", 10)

    const gameCount = mmrHistory.length
    const netChange = gameCount > 1 ? Math.round(rrValues[gameCount - 1] - rrValues[0]) : null

    const referenceDatasets = referenceLines.map(line => ({
        label: `ref-${line.label}`,
        data: mmrHistory.map(() => line.value),
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
                label: "RR",
                data: rrValues,
                borderColor: accentColor,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: accentColor,
                fill: true,
                backgroundColor: `${accentColor}14`,
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
                    // pick the real RR series entry instead.
                    const realDataPoint = tooltipModel.dataPoints.find(dp => dp.dataset.label === "RR")
                    const dataIndex = (realDataPoint ?? tooltipModel.dataPoints[0]).dataIndex
                    const point = mmrHistory[dataIndex]
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
                    Last {gameCount} game{gameCount === 1 ? "" : "s"}
                </p>
                {netChange != null && (
                    <p className={`text-xs font-bold ${netChange >= 0 ? "text-positive" : "text-negative"}`}>
                        {netChange >= 0 ? "▲" : "▼"} {Math.abs(netChange)} RR
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
                            className="absolute z-10 bg-surface border border-line rounded-lg px-2.5 py-2 pointer-events-none shadow-lg"
                            style={{
                                top: Math.max(tooltip.y - 50, 0),
                                left: tooltip.align === "right" ? undefined : tooltip.x + 10,
                                right: tooltip.align === "right" ? `calc(100% - ${tooltip.x - 10}px)` : undefined
                            }}
                        >
                            <div className="whitespace-nowrap">
                                <p className="text-text-primary text-xs font-bold">{tooltip.label}</p>
                                <p className="text-text-primary text-xs">{tooltip.point.tier} · {tooltip.point.rr} RR</p>
                                {tooltip.point.change != null && (
                                    <p className={`text-[11px] font-semibold ${tooltip.point.change > 0 ? "text-positive" : "text-negative"}`}>
                                        {tooltip.point.change > 0 ? "+" : ""}{tooltip.point.change} RR this game
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-between text-text-secondary text-[9px] mt-1">
                <span>{gameCount} game{gameCount === 1 ? "" : "s"} ago</span>
                <span>Last game</span>
            </div>
            <p className="text-text-secondary text-[10px] mt-1.5">Real RR after every tracked match. Hover for details.</p>
        </div>
    )
}
