"use client"
import { useState, useMemo } from "react"
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

const VAL_TIER_ORDER = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "ascendant", "immortal", "radiant"]
const VAL_TIER_SHORT = { iron: "Iron", bronze: "Bronze", silver: "Silver", gold: "Gold", platinum: "Plat", diamond: "Dia", ascendant: "Asc", immortal: "Imm", radiant: "Radiant" }

// Henrik reports the tier per point as a name with the division baked in
// ("Immortal 3", "Gold 2", "Radiant", "Unrated").
function parseValTier(name) {
    if (!name) return null
    const m = name.trim().match(/^([A-Za-z]+)\s*(\d)?$/)
    if (!m) return null
    const base = m[1].toLowerCase()
    if (!VAL_TIER_ORDER.includes(base)) return null
    return { base, div: m[2] ? Number(m[2]) : null }
}

// Rank-boundary reference lines expressed in the same RR coordinate the chart
// plots. Valorant's RR has two regimes, so we anchor on the *current* rank:
//  - Immortal/Radiant: RR is cumulative across the band (Imm 1 = 0, Imm 2 =
//    100, Imm 3 = 200, Radiant ≈ 300+), so the boundaries are absolute.
//  - Below Immortal: RR is 0-100 within the current division, so we mark this
//    division's floor and the promotion line at 100.
// Returns null when the rank is unknown (e.g. Unrated) so the caller can fall
// back to a plain numeric grid.
function buildValorantReferenceLines(currentTierName, minV, maxV) {
    const parsed = parseValTier(currentTierName)
    if (!parsed) return null

    if (parsed.base === "immortal" || parsed.base === "radiant") {
        const bands = [[0, "Imm 1"], [100, "Imm 2"], [200, "Imm 3"], [300, "Radiant"]]
        const lines = bands
            .filter(([v]) => v >= minV - 50 && v <= maxV + 50)
            .map(([value, label]) => ({ value, label }))
        return lines.length ? lines : null
    }

    const shortName = VAL_TIER_SHORT[parsed.base]
    const div = parsed.div ?? 1
    return [
        { value: 0, label: `${shortName} ${div}` },
        { value: 100, label: div < 3 ? `${shortName} ${div + 1}` : "Promo" }
    ]
}

// Plain fallback grid (nice step over the value range) when the rank is unknown.
function buildNumericGrid(minV, maxV) {
    const lo = Math.max(0, minV - 10)
    const hi = maxV + 10
    const range = Math.max(hi - lo, 1)
    const rough = range / 5
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
    const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= rough) ?? 10 * magnitude
    const lines = []
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.001; v += step) lines.push({ value: v, label: `${Math.round(v)} RR` })
    return lines
}

// Unlike League's LP history, Henrik's mmr-history endpoint reports the real
// RR after every match, so this chart needs no estimation logic.
export default function RrHistoryChart({ mmrHistory, accentColor = "#ff4655" }) {

    const [tooltip, setTooltip] = useState(null)

    // Memoized so a tooltip-triggered re-render doesn't rebuild `data` into a
    // fresh object, which would make react-chartjs-2 push another chart update
    // -> re-fire the external tooltip -> setState -> loop (same guard as the
    // League LP chart).
    const derived = useMemo(() => {
        if (!mmrHistory || mmrHistory.length === 0) return null

        const labels = mmrHistory.map(p => formatFullDate(p.timestamp))
        const rrValues = mmrHistory.map(p => p.rr)
        const minV = Math.min(...rrValues)
        const maxV = Math.max(...rrValues)

        const currentTier = mmrHistory[mmrHistory.length - 1]?.tier ?? null
        const referenceLines = buildValorantReferenceLines(currentTier, minV, maxV) ?? buildNumericGrid(minV, maxV)

        // Pin the axis to encompass both the data and the reference lines so the
        // gridlines and their left labels line up exactly.
        const spread = [minV, maxV, ...referenceLines.map(l => l.value)]
        const axisMin = Math.max(0, Math.min(...spread) - 12)
        const axisMax = Math.max(...spread) + 12

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

        return { labels, rrValues, referenceLines, axisMin, axisMax, gameCount, netChange, data }
    }, [mmrHistory, accentColor])

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
                        // Reference-line datasets report a point at this index
                        // too — pick the real RR series entry instead.
                        const realDataPoint = tooltipModel.dataPoints.find(dp => dp.dataset.label === "RR")
                        const dataIndex = (realDataPoint ?? tooltipModel.dataPoints[0]).dataIndex
                        const point = mmrHistory[dataIndex]
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
                y: { display: false, min: derived.axisMin, max: derived.axisMax }
            }
        }
    }, [derived, mmrHistory])

    if (!derived) {
        return <p className="text-text-secondary text-xs">No RR history yet.</p>
    }

    const { referenceLines, axisMin, axisMax, gameCount, netChange, data } = derived

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
                    <div className="relative w-9 flex-shrink-0 h-full">
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
