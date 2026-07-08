"use client"

import { useEffect, useState } from "react"
import { Share2, Check, Minus } from "lucide-react"
import { platformConfig } from "@/lib/platforms"
import { getRankTier } from "@/lib/rankScore"
import AnimatedNumber from "./AnimatedNumber"

// The signature RankCard — the shareable object the product is named after.
// A self-contained vertical card: identity, big Rank Score with tier + weekly
// delta, one row per connected game, and the profile URL. Rendered as a
// sticky sidebar on desktop and above the tab content on mobile.
export default function SignatureCard({ username, avatarUrl, isPro, accounts, gameStats, avgRankScore, onShare, shareCopied }) {
    const [weeklyDelta, setWeeklyDelta] = useState(null)

    useEffect(() => {
        // Same endpoint RankHistoryChart uses; here only to compute the
        // "this week" delta (latest score vs. the last point ≥7 days old).
        fetch(`/api/profile/history?username=${username}`)
            .then(r => r.json())
            .then(points => {
                if (!Array.isArray(points) || points.length < 2) return
                const latest = points[points.length - 1]
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                const baseline = [...points].reverse().find(p => new Date(p.date) <= weekAgo) ?? points[0]
                const delta = Math.round(latest.score - baseline.score)
                if (delta !== 0) setWeeklyDelta(delta)
            })
            .catch(() => {})
    }, [username])

    const rankInfo = avgRankScore != null ? getRankTier(Math.round(avgRankScore)) : null

    // Best rank first — the card is a trophy shelf, lead with the strongest.
    const sortedAccounts = [...accounts].sort((a, b) => (gameStats[b.id]?.rankScore ?? -1) - (gameStats[a.id]?.rankScore ?? -1))

    return (
        <div className="relative overflow-hidden rounded-2xl border border-accent/30 bg-surface shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
            {/* Holographic top hairline + ambient glow (Direction A spec) */}
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(199,155,255,1),transparent)]" />
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_70%_120%_at_50%_-20%,rgba(177,108,255,0.22),transparent_70%)] pointer-events-none" />

            <div className="relative p-5">
                {/* Identity */}
                <div className="flex items-center gap-3">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={username} className="w-12 h-12 rounded-xl object-cover border border-accent/40" />
                    ) : (
                        <div className="w-12 h-12 rounded-xl border border-accent/40 bg-gradient-to-br from-[#3f3265] to-[#191525] grid place-items-center text-accent-soft font-extrabold text-lg">
                            {username[0].toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-text-primary font-extrabold text-base leading-tight truncate">{username}</p>
                            {isPro && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint flex-shrink-0">PRO</span>
                            )}
                        </div>
                        <p className="text-text-secondary text-xs font-mono truncate">@{username}</p>
                    </div>
                </div>

                {/* Rank Score */}
                <div className="mt-5">
                    <p className="text-text-secondary text-[11px] font-semibold uppercase tracking-[0.14em]">Rank Score</p>
                    <div className="flex items-end gap-2.5 mt-1">
                        <p className="text-accent text-[40px] font-extrabold leading-none">
                            {avgRankScore != null ? <AnimatedNumber value={Math.round(avgRankScore)} localize /> : "—"}
                        </p>
                        {weeklyDelta != null && (
                            <span className={`font-mono text-xs font-bold mb-1 ${weeklyDelta > 0 ? "text-positive" : "text-negative"}`}>
                                {weeklyDelta > 0 ? "+" : ""}{weeklyDelta} this week
                            </span>
                        )}
                    </div>
                    {rankInfo && (
                        <p className="text-sm font-bold mt-1.5" style={{ color: rankInfo.tier.color }}>
                            {rankInfo.tier.name} <span className="text-text-secondary font-semibold text-xs">· Top {rankInfo.topPercent.toFixed(1)}%</span>
                        </p>
                    )}
                </div>

                {/* Game rows */}
                <div className="mt-4 divide-y divide-hairline border-t border-hairline">
                    {sortedAccounts.map((account) => {
                        const config = platformConfig[account.platform]
                        const stats = gameStats[account.id]
                        if (!config) return null
                        const emblem = stats?.emblem
                        return (
                            <div key={account.id} className="flex items-center gap-2.5 py-2.5">
                                {/* Real rank emblem when available (matches RankBadge's art);
                                    falls back to the game's own logo chip when unranked or
                                    still loading, so the row never shows an empty box. */}
                                {emblem?.type === "image" ? (
                                    <div className="w-9 h-9 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                        <img
                                            src={emblem.url}
                                            alt={stats?.tierLabel ?? ""}
                                            className={emblem.scale ? "w-full h-full object-contain scale-450 translate-y-1" : "w-full h-full object-contain"}
                                        />
                                    </div>
                                ) : emblem?.type === "badge" ? (
                                    <div
                                        className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center border-2"
                                        style={{ borderColor: emblem.color, backgroundColor: `${emblem.color}1f` }}
                                    >
                                        <span className="text-text-primary font-extrabold text-[9px]">{emblem.label}</span>
                                    </div>
                                ) : emblem?.type === "unranked" ? (
                                    <div className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center border border-hairline bg-surface-deep">
                                        <Minus size={14} className="text-text-muted" />
                                    </div>
                                ) : (
                                    <div className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, backgroundColor: `${config.color}24`, border: `1px solid ${config.color}66` }}>
                                        {config.imageUrl ? (
                                            <img src={config.imageUrl} width="13" height="13" style={{ transform: `scale(${config.logoScale ?? 1})` }} alt="" />
                                        ) : (
                                            <svg role="img" viewBox="0 0 24 24" width="13" height="13" fill={config.color} aria-hidden="true">
                                                <path d={config.icon.path} fillRule={config.icon.fillRule ?? "nonzero"} />
                                            </svg>
                                        )}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-text-primary text-[13px] font-bold leading-tight truncate">{stats?.tierLabel ?? "Unranked"}</p>
                                    <p className="text-text-secondary text-[10px] leading-tight">{config.shortName}</p>
                                </div>
                                {stats?.winRate != null && (
                                    <p className="text-positive text-xs font-semibold font-mono flex-shrink-0">{Math.round(stats.winRate)}%</p>
                                )}
                            </div>
                        )
                    })}
                    {accounts.length === 0 && (
                        <p className="text-text-secondary text-xs py-3">No games connected yet.</p>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-1 pt-3.5 border-t border-hairline flex items-center justify-between gap-3">
                    <p className="text-text-secondary text-xs font-mono truncate">rankcard.app/{username}</p>
                    <button
                        onClick={onShare}
                        className="btn-shine flex-shrink-0 bg-accent text-black text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 hover:text-white hover:shadow-[0_0_22px_rgba(177,108,255,0.5)] active:scale-95 transition-all"
                    >
                        {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
                        {shareCopied ? "Copied" : "Share"}
                    </button>
                </div>
            </div>
        </div>
    )
}
