"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import TopNav from "@/app/components/TopNav"

function formatDate(iso) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
}

export default function AdminPage() {
    const [status, setStatus] = useState("checking") // checking | denied | loading | ready | error
    const [stats, setStats] = useState(null)

    useEffect(() => {
        (async () => {
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) {
                setStatus("denied")
                return
            }
            setStatus("loading")
            try {
                const res = await fetch("/api/admin/stats", { headers: { Authorization: `Bearer ${token}` } })
                if (!res.ok) {
                    setStatus("denied")
                    return
                }
                const data = await res.json()
                setStats(data)
                setStatus("ready")
            } catch {
                setStatus("error")
            }
        })()
    }, [])

    if (status === "checking" || status === "loading") {
        return (
            <div className="bg-background min-h-screen">
                <TopNav />
                <p className="text-text-secondary text-sm p-8 text-center">Loading…</p>
            </div>
        )
    }

    if (status === "denied" || status === "error") {
        return (
            <div className="bg-background min-h-screen">
                <TopNav />
                <div className="flex items-center justify-center p-8">
                    <p className="text-text-secondary text-sm">
                        {status === "denied" ? "You don't have access to this page." : "Could not load admin stats."}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-background min-h-screen">
            <TopNav />
            <div className="p-3 max-w-[1000px] mx-auto">
                <div className="mt-4 mb-5">
                    <p className="text-text-primary text-2xl font-extrabold">Admin</p>
                    <p className="text-text-secondary text-sm mt-1">Live snapshot of users, Pro conversion, and connected games.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatCard label="Total users" value={stats.totalUsers.toLocaleString()} />
                    <StatCard label="Pro users" value={stats.totalPro.toLocaleString()} accent />
                    <StatCard label="Conversion rate" value={`${(stats.conversionRate * 100).toFixed(1)}%`} />
                    <StatCard label="Discord linked" value={stats.discordLinked.toLocaleString()} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <StatCard label="Signups (7d)" value={stats.signupsLast7d.toLocaleString()} />
                    <StatCard label="Signups (30d)" value={stats.signupsLast30d.toLocaleString()} />
                    <StatCard label="Active LFG posts" value={stats.activeLfgPosts.toLocaleString()} />
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Connected games</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {Object.entries(platformConfig).map(([key, config]) => (
                        <StatCard key={key} label={config.shortName} value={(stats.platformCounts[key] ?? 0).toLocaleString()} dotColor={config.color} />
                    ))}
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Recent signups</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
                    {stats.recentSignups.length === 0 && (
                        <p className="text-text-secondary text-sm p-4">No signups yet.</p>
                    )}
                    {stats.recentSignups.map((p, i) => (
                        <a
                            key={p.username}
                            href={`/${p.username}`}
                            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${i !== 0 ? "border-t border-hairline" : ""}`}
                        >
                            <div className="w-7 h-7 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                                {p.avatar_url && <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-sm text-text-primary flex-1 truncate">{p.username}</span>
                            {p.is_pro && (
                                <span className="text-[10px] font-bold text-accent-soft flex-shrink-0">PRO</span>
                            )}
                            <span className="text-text-secondary text-xs flex-shrink-0">{formatDate(p.created_at)}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, accent = false, dotColor }) {
    return (
        <div className="bg-surface border border-hairline rounded-2xl p-4">
            <p className={`text-2xl font-extrabold ${accent ? "text-accent" : "text-text-primary"}`}>{value}</p>
            <p className="text-text-secondary text-xs mt-1 flex items-center gap-1.5">
                {dotColor && <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dotColor }} />}
                {label}
            </p>
        </div>
    )
}
