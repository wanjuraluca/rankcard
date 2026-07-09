"use client"

import { Bar } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export default function AdminBarChart({ points, tooltipLabel = "Count" }) {
    const labels = points.map(p => {
        const d = new Date(p.date)
        return d.toLocaleDateString("en", { month: "short", day: "numeric" })
    })

    const data = {
        labels,
        datasets: [{
            data: points.map(p => p.count),
            backgroundColor: "rgba(177,108,255,0.55)",
            hoverBackgroundColor: "var(--accent)",
            borderRadius: 3,
            maxBarThickness: 22,
        }],
    }

    const options = {
        responsive: true,
        maintainAspectRatio: false,
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
                    label: (item) => `  ${tooltipLabel}: ${item.raw.toLocaleString("en-US")}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: false },
                ticks: { color: "#8a8a9a", font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
            },
            y: {
                beginAtZero: true,
                grid: { color: "rgba(255,255,255,0.04)" },
                border: { display: false },
                ticks: { color: "#8a8a9a", font: { size: 10 }, maxTicksLimit: 4, precision: 0 },
            },
        },
    }

    return (
        <div style={{ height: 160 }}>
            <Bar data={data} options={options} />
        </div>
    )
}
