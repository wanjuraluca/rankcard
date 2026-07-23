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
    return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// CS2/Leetify has no Premier-rating history endpoint, so unlike League/
// Valorant this isn't a rank-over-time chart — it's Leetify's own per-match
// performance rating (roughly -1 to 1, 0 is average), which is real data
// straight from the match stats, not an estimate.
export default function Cs2RatingChart({ matchHistory, accentColor = "#4b9fff" }) {

    const [tooltip, setTooltip] = useState(null)

    const points = matchHistory
        .filter(m => m.leetifyRating != null)
        .slice()
        .reverse() // oldest first

    if (points.length === 0) {
        return <p className="text-text-secondary text-xs">No rating history yet.</p>
    }

    const labels = points.map(p => formatFullDate(p.gameStartTimestamp))
    const data = {
        labels,
        datasets: [
            {
                data: points.map(p => p.leetifyRating),
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
                        className="absolute z-10 bg-surface border border-hairline rounded-lg px-2.5 py-2 pointer-events-none shadow-lg"
                        style={{
                            top: Math.max(tooltip.y - 50, 0),
                            left: tooltip.align === "right" ? undefined : tooltip.x + 10,
                            right: tooltip.align === "right" ? `calc(100% - ${tooltip.x - 10}px)` : undefined
                        }}
                    >
                        <div className="whitespace-nowrap">
                            <p className="text-text-primary text-xs font-bold">{tooltip.label}</p>
                            <p className="text-text-primary text-xs">{tooltip.point.leetifyRating.toFixed(2)} rating · {tooltip.point.map}</p>
                        </div>
                    </div>
                )}
            </div>
            <p className="text-text-secondary text-[10px] mt-1.5">Leetify performance rating per match (0 = average). Hover for details.</p>
        </div>
    )
}
