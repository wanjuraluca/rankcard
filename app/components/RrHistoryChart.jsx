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

// Unlike League's LP history, Henrik's mmr-history endpoint reports the real
// RR after every match, so this chart needs no estimation logic.
export default function RrHistoryChart({ mmrHistory, accentColor = "#ff4655" }) {

    const [tooltip, setTooltip] = useState(null)

    if (!mmrHistory || mmrHistory.length === 0) {
        return <p className="text-text-secondary text-xs">No RR history yet.</p>
    }

    const labels = mmrHistory.map(p => formatFullDate(p.timestamp))
    const data = {
        labels,
        datasets: [
            {
                data: mmrHistory.map(p => p.rr),
                borderColor: accentColor,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: accentColor,
                fill: true,
                backgroundColor: `${accentColor}14`
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
            y: { display: false }
        }
    }

    return (
        <div className="w-full">
            <div className="relative w-full h-[90px]">
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
            <p className="text-text-secondary text-[10px] mt-1.5">Real RR after every tracked match. Hover for details.</p>
        </div>
    )
}
