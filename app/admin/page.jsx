"use client"

import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import TopNav from "@/app/components/TopNav"
import AdminBarChart from "@/app/components/AdminBarChart"
import AdminUserEditor from "@/app/components/AdminUserEditor"
import { Search, ExternalLink, Pencil } from "lucide-react"

function formatDate(iso) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })
}

function timeAgo(iso) {
    if (!iso) return "—"
    const diffMs = Date.now() - new Date(iso).getTime()
    const min = Math.floor(diffMs / 60000)
    if (min < 1) return "just now"
    if (min < 60) return `${min}m ago`
    const hours = Math.floor(min / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
}

const timeRangeOptions = [
    { key: "all", label: "All time" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
]

const proFilterOptions = [
    { key: "all", label: "All" },
    { key: "pro", label: "Pro only" },
    { key: "free", label: "Free only" },
]

export default function AdminPage() {
    const [status, setStatus] = useState("checking") // checking | denied | loading | ready | error
    const [stats, setStats] = useState(null)
    const [search, setSearch] = useState("")
    const [proFilter, setProFilter] = useState("all")
    const [timeRange, setTimeRange] = useState("all")
    const [editing, setEditing] = useState(null) // the signup row being edited

    // Merge an editor save back into the in-memory stats so the row (and the
    // Pro/view totals it feeds) reflect the change without a full reload.
    function applyUserUpdate(username, updated) {
        setStats(prev => {
            if (!prev) return prev
            const before = prev.recentSignups.find(p => p.username === username)
            const recentSignups = prev.recentSignups.map(p =>
                p.username === username ? { ...p, ...updated } : p
            )
            // Adjust the Pro total by the delta (recentSignups may be a subset
            // of all profiles, so don't recompute it from that list).
            let totalPro = prev.totalPro
            if (before && before.is_pro !== updated.is_pro) {
                totalPro += updated.is_pro ? 1 : -1
            }
            return {
                ...prev,
                recentSignups,
                totalPro,
                conversionRate: prev.totalUsers ? totalPro / prev.totalUsers : 0,
            }
        })
    }

    // Drop a deleted user from the list and roll back the totals it fed.
    function applyUserDelete(username) {
        setStats(prev => {
            if (!prev) return prev
            const removed = prev.recentSignups.find(p => p.username === username)
            const recentSignups = prev.recentSignups.filter(p => p.username !== username)
            const totalUsers = Math.max(0, prev.totalUsers - 1)
            const totalPro = prev.totalPro - (removed?.is_pro ? 1 : 0)
            return {
                ...prev,
                recentSignups,
                totalUsers,
                totalPro,
                conversionRate: totalUsers ? totalPro / totalUsers : 0,
            }
        })
    }

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

    const filteredSignups = useMemo(() => {
        if (!stats) return []
        const now = Date.now()
        const rangeMs = timeRange === "7d" ? 7 * 24 * 60 * 60 * 1000 : timeRange === "30d" ? 30 * 24 * 60 * 60 * 1000 : null
        const query = search.trim().toLowerCase()
        return stats.recentSignups.filter(p => {
            if (proFilter === "pro" && !p.is_pro) return false
            if (proFilter === "free" && p.is_pro) return false
            if (rangeMs && (!p.created_at || now - new Date(p.created_at).getTime() > rangeMs)) return false
            if (query && !p.username.toLowerCase().includes(query)) return false
            return true
        })
    }, [stats, search, proFilter, timeRange])

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
                    <StatCard label="Total users" value={stats.totalUsers.toLocaleString("en-US")} />
                    <StatCard label="Pro users" value={stats.totalPro.toLocaleString("en-US")} accent />
                    <StatCard label="Conversion rate" value={`${(stats.conversionRate * 100).toFixed(1)}%`} />
                    <StatCard label="Discord linked" value={stats.discordLinked.toLocaleString("en-US")} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <StatCard label="Signups (7d)" value={stats.signupsLast7d.toLocaleString("en-US")} />
                    <StatCard label="Signups (30d)" value={stats.signupsLast30d.toLocaleString("en-US")} />
                    <StatCard label="Active LFG posts" value={stats.activeLfgPosts.toLocaleString("en-US")} />
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Engagement</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <StatCard label="Active today (DAU)" value={stats.dau.toLocaleString("en-US")} accent />
                    <StatCard label="Active this week (WAU)" value={stats.wau.toLocaleString("en-US")} />
                    <StatCard label="Active last 30d (MAU)" value={stats.mau.toLocaleString("en-US")} />
                    <StatCard label="Stickiness (DAU/MAU)" value={`${(stats.stickiness * 100).toFixed(0)}%`} />
                </div>
                <div className="bg-surface border border-hairline rounded-2xl p-4 mb-6">
                    <p className="text-text-secondary text-xs mb-2">Daily active users, last 14 days</p>
                    <AdminBarChart points={stats.activityByDay} tooltipLabel="Active users" />
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Growth</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-surface border border-hairline rounded-2xl p-4 mb-6">
                    <p className="text-text-secondary text-xs mb-2">Signups, last 30 days</p>
                    <AdminBarChart points={stats.signupsByDay} tooltipLabel="Signups" />
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Monetization funnel</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <StatCard label="Reached checkout, didn't convert" value={stats.abandonedCheckout.toLocaleString("en-US")} />
                    <StatCard label="Signups with 0 connected accounts" value={stats.zeroAccountUsers.toLocaleString("en-US")} />
                    <StatCard label="Avg. accounts per user" value={stats.avgAccountsPerUser.toFixed(1)} />
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Social & content</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <StatCard label="Total profile views" value={stats.totalViews.toLocaleString("en-US")} />
                    <StatCard label="Total follows" value={stats.totalFollows.toLocaleString("en-US")} />
                    <StatCard label="LFG posts (all time)" value={stats.totalLfgPosts.toLocaleString("en-US")} />
                    <StatCard label="Discord servers using bot" value={stats.discordServers.toLocaleString("en-US")} />
                </div>

                {stats.topViewed.length > 0 && (
                    <>
                        <div className="flex items-center gap-2 mb-2.5">
                            <p className="text-text-muted text-xs uppercase tracking-widest">Most viewed profiles</p>
                            <div className="flex-1 h-px bg-hairline" />
                        </div>
                        <div className="bg-surface border border-hairline rounded-2xl overflow-hidden mb-6">
                            {stats.topViewed.map((p, i) => (
                                <a
                                    key={p.username}
                                    href={`/${p.username}`}
                                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${i !== 0 ? "border-t border-hairline" : ""}`}
                                >
                                    <div className="w-7 h-7 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                                        {p.avatar_url && <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />}
                                    </div>
                                    <span className="text-sm text-text-primary flex-1 truncate">{p.username}</span>
                                    <span className="text-text-secondary text-xs flex-shrink-0">{p.view_count.toLocaleString("en-US")} views</span>
                                </a>
                            ))}
                        </div>
                    </>
                )}

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Connected games</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {Object.entries(platformConfig).map(([key, config]) => (
                        <StatCard key={key} label={config.shortName} value={(stats.platformCounts[key] ?? 0).toLocaleString("en-US")} dotColor={config.color} />
                    ))}
                </div>

                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Recent signups</p>
                    <div className="flex-1 h-px bg-hairline" />
                    <p className="text-text-secondary text-xs">{filteredSignups.length} of {stats.recentSignups.length}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <div className="flex items-center gap-2 bg-surface border border-hairline rounded-lg px-3 py-2 flex-1">
                        <Search size={14} className="text-text-secondary flex-shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search username..."
                            className="bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none flex-1 min-w-0"
                        />
                    </div>
                    <div className="flex gap-1.5">
                        {proFilterOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setProFilter(opt.key)}
                                className={`border rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${proFilter === opt.key ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-1.5">
                        {timeRangeOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setTimeRange(opt.key)}
                                className={`border rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${timeRange === opt.key ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-surface border border-hairline rounded-2xl overflow-hidden">
                    {filteredSignups.length === 0 && (
                        <p className="text-text-secondary text-sm p-4">No signups match these filters.</p>
                    )}
                    {filteredSignups.map((p, i) => (
                        <div
                            key={p.username}
                            title={formatDate(p.created_at)}
                            className={`group flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors ${i !== 0 ? "border-t border-hairline" : ""}`}
                        >
                            <div className="w-7 h-7 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                                {p.avatar_url && <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-sm text-text-primary flex-1 truncate">{p.username}</span>
                            {p.is_pro && (
                                <span className="text-[10px] font-bold text-accent-soft flex-shrink-0">PRO</span>
                            )}
                            <span className="text-text-secondary text-xs flex-shrink-0 tabular-nums">{p.view_count?.toLocaleString("en-US") ?? 0} views</span>
                            <span className="text-text-secondary text-xs flex-shrink-0 w-16 text-right">{timeAgo(p.created_at)}</span>
                            <button
                                onClick={() => setEditing(p)}
                                title="Edit user"
                                className="flex-shrink-0 grid place-items-center h-7 w-7 rounded-lg border border-hairline text-text-secondary hover:border-accent hover:text-accent transition-colors"
                            >
                                <Pencil size={13} />
                            </button>
                            <a
                                href={`/${p.username}`}
                                title="View profile"
                                className="flex-shrink-0 grid place-items-center h-7 w-7 rounded-lg border border-hairline text-text-secondary hover:border-accent hover:text-accent transition-colors"
                            >
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {editing && (
                <AdminUserEditor
                    user={editing}
                    onClose={() => setEditing(null)}
                    onSaved={(updated) => {
                        applyUserUpdate(editing.username, updated)
                        setEditing(null)
                    }}
                    onDeleted={(username) => {
                        applyUserDelete(username)
                        setEditing(null)
                    }}
                />
            )}
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
