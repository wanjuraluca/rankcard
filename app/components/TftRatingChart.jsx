"use client"

import { useEffect, useState } from "react"
import { Line } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function TftRatingChart({ accountId }) {
    const [points, setPoints] = useState(null)

    useEffect(() => {
        fetch(`/api/profile/history?accountId=${accountId}`)
            .then(r => r.json())
            .then(data => setPoints(Array.isArray(data) ? data : []))
            .catch(() => setPoints([]))
    }, [accountId])

    if (points === null) {
        return (
            <div className="h-32 flex items-center justify-center">
                <p className="text-text-secondary text-xs">Loading history…</p>
            </div>
        )
    }

    if (points.length < 2) {
        return (
            <div className="h-32 flex items-center justify-center">
                <p className="text-text-secondary text-xs">Not enough data yet — check back after a few days.</p>
            </div>
        )
    }

    const labels = points.map(p => {
        const d = new Date(p.date)
        return d.toLocaleDateString("en", { month: "short", day: "numeric" })
    })
    const scores = points.map(p => p.score)

    const data = {
        labels,
        datasets: [{
            data: scores,
            borderColor: "var(--accent)",
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: "var(--accent)",
            tension: 0.4,
            fill: true,
            backgroundColor: (ctx) => {
                const canvas = ctx.chart.ctx
                const gradient = canvas.createLinearGradient(0, 0, 0, ctx.chart.height)
                gradient.addColorStop(0, "rgba(177,108,255,0.18)")
                gradient.addColorStop(1, "rgba(177,108,255,0)")
                return gradient
            },
        }],
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "#15151f",
                borderColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                titleColor: "#8a8a9a",
                bodyColor: "#f4f3f7",
                bodyFont: { weight: "bold" },
                callbacks: {
                    title: (items) => items[0].label,
                    label: (item) => `  Rank Score: ${item.raw.toLocaleString()}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: {
                    color: "#8a8a9a",
                    font: { size: 10 },
                    maxTicksLimit: 6,
                    maxRotation: 0,
                },
            },
            y: {
                grid: { color: "rgba(255,255,255,0.04)" },
                border: { display: false },
                ticks: {
                    color: "#8a8a9a",
                    font: { size: 10 },
                    maxTicksLimit: 4,
                },
            },
        },
    }

    return (
        <div style={{ height: 160 }}>
            <Line data={data} options={options} />
        </div>
    )
}
