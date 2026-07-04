"use client"
import { useState, useEffect } from "react"
import { platformConfig } from "@/lib/platforms"
import { extractGameStats, average } from "@/lib/gameStats"
import { getRankTier } from "@/lib/rankScore"

const PLATFORMS = ["League of Legends", "Valorant", "CSGO"]

function Avatar({ url, username, size = 56 }) {
    return (
        <div
            className="rounded-lg bg-surface border border-hairline flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ width: size, height: size }}
        >
            {url
                ? <img src={url} alt={username} className="w-full h-full object-cover" />
                : <span className="text-accent font-extrabold text-xl">{username?.[0]?.toUpperCase()}</span>
            }
        </div>
    )
}

function StatBar({ labelA, labelB, valueA, valueB, format = (v) => v }) {
    const both = valueA != null && valueB != null
    const aWins = both && valueA > valueB
    const bWins = both && valueB > valueA

    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <p className={`text-right text-sm font-bold ${aWins ? "text-text-primary" : "text-text-secondary"}`}>
                {valueA != null ? format(valueA) : "—"}
            </p>
            <div className={`h-1.5 w-16 rounded-full bg-hairline overflow-hidden relative`}>
                {both && (
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-accent transition-all"
                        style={{ width: `${(valueA / (valueA + valueB)) * 100}%` }}
                    />
                )}
            </div>
            <p className={`text-left text-sm font-bold ${bWins ? "text-text-primary" : "text-text-secondary"}`}>
                {valueB != null ? format(valueB) : "—"}
            </p>
        </div>
    )
}

export default function CompareClient({ profileA, accountsA, profileB, accountsB }) {
    const [statsA, setStatsA] = useState({})
    const [statsB, setStatsB] = useState({})
    const [loadingA, setLoadingA] = useState(true)
    const [loadingB, setLoadingB] = useState(true)

    useEffect(() => {
        const scored = accountsA.filter(a => PLATFORMS.includes(a.platform))
        if (!scored.length) { setLoadingA(false); return }
        Promise.all(scored.map(async acc => {
            const res = await fetch(`/api/summoner?platform=${acc.platform}&name=${acc.platform_username}&tag=${acc.platform_tag}&accountId=${acc.id}`)
            const data = await res.json()
            return { platform: acc.platform, stats: extractGameStats(acc.platform, data) }
        })).then(results => {
            const map = {}
            results.forEach(r => { if (r.stats) map[r.platform] = r.stats })
            setStatsA(map)
            setLoadingA(false)
        })
    }, [])

    useEffect(() => {
        const scored = accountsB.filter(a => PLATFORMS.includes(a.platform))
        if (!scored.length) { setLoadingB(false); return }
        Promise.all(scored.map(async acc => {
            const res = await fetch(`/api/summoner?platform=${acc.platform}&name=${acc.platform_username}&tag=${acc.platform_tag}&accountId=${acc.id}`)
            const data = await res.json()
            return { platform: acc.platform, stats: extractGameStats(acc.platform, data) }
        })).then(results => {
            const map = {}
            results.forEach(r => { if (r.stats) map[r.platform] = r.stats })
            setStatsB(map)
            setLoadingB(false)
        })
    }, [])

    const loading = loadingA || loadingB

    const scoreA = average(Object.values(statsA).map(s => s?.rankScore)) ?? null
    const scoreB = average(Object.values(statsB).map(s => s?.rankScore)) ?? null
    const tierA = scoreA != null ? getRankTier(scoreA) : null
    const tierB = scoreB != null ? getRankTier(scoreB) : null

    const winRateA = average(Object.values(statsA).map(s => s?.winRate))
    const winRateB = average(Object.values(statsB).map(s => s?.winRate))
    const kdaA = average(Object.values(statsA).map(s => s?.kda))
    const kdaB = average(Object.values(statsB).map(s => s?.kda))

    const aWinsOverall = scoreA != null && scoreB != null && scoreA > scoreB
    const bWinsOverall = scoreA != null && scoreB != null && scoreB > scoreA

    const sharedPlatforms = PLATFORMS.filter(p =>
        accountsA.some(a => a.platform === p) || accountsB.some(a => a.platform === p)
    )

    return (
        <div className="bg-background min-h-screen p-3 max-w-[700px] mx-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-6 mt-2">
                <a href={`/${profileA.username}`} className="text-text-secondary text-sm hover:text-text-primary transition-colors">
                    ← {profileA.username}
                </a>
                <p className="text-text-muted text-xs font-semibold uppercase tracking-widest">vs</p>
                <a href={`/${profileB.username}`} className="text-text-secondary text-sm hover:text-text-primary transition-colors">
                    {profileB.username} →
                </a>
            </div>

            {/* Avatars + names */}
            <div className="bg-surface border border-hairline rounded-2xl p-5 flex items-center gap-4">
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                    <Avatar url={profileA.avatar_url} username={profileA.username} size={72} />
                    <div>
                        <p className="text-text-primary font-extrabold text-lg leading-none">{profileA.username}</p>
                        {profileA.is_pro && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint">PRO</span>
                        )}
                    </div>
                </div>

                <div className="text-text-secondary text-2xl font-black select-none">vs</div>

                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                    <Avatar url={profileB.avatar_url} username={profileB.username} size={72} />
                    <div>
                        <p className="text-text-primary font-extrabold text-lg leading-none">{profileB.username}</p>
                        {profileB.is_pro && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint">PRO</span>
                        )}
                    </div>
                </div>
            </div>

            {loading && (
                <div className="mt-4 text-center text-text-secondary text-sm py-8">Loading rank data…</div>
            )}

            {!loading && (
                <>
                    {/* Overall Rank Score */}
                    <div className="bg-surface border border-hairline rounded-2xl p-5 mt-3">
                        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-widest mb-4 text-center">Overall Rank Score</p>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 mb-3">
                            <div className={`text-center ${aWinsOverall ? "" : "opacity-50"}`}>
                                <p className={`text-4xl font-black ${aWinsOverall ? "text-accent" : "text-text-primary"}`}>
                                    {scoreA != null ? Math.round(scoreA).toLocaleString() : "—"}
                                </p>
                                {tierA && <p className="text-xs mt-1" style={{ color: tierA.color }}>{tierA.name}</p>}
                            </div>
                            <div className="text-text-secondary text-lg font-black pb-2 select-none">vs</div>
                            <div className={`text-center ${bWinsOverall ? "" : "opacity-50"}`}>
                                <p className={`text-4xl font-black ${bWinsOverall ? "text-accent" : "text-text-primary"}`}>
                                    {scoreB != null ? Math.round(scoreB).toLocaleString() : "—"}
                                </p>
                                {tierB && <p className="text-xs mt-1" style={{ color: tierB.color }}>{tierB.name}</p>}
                            </div>
                        </div>

                        {(aWinsOverall || bWinsOverall) && (
                            <p className="text-center text-xs text-text-secondary mt-2">
                                <span className="text-text-primary font-semibold">
                                    {aWinsOverall ? profileA.username : profileB.username}
                                </span>{" "}
                                leads by{" "}
                                <span className="text-accent font-semibold">
                                    {Math.abs(Math.round((scoreA ?? 0) - (scoreB ?? 0))).toLocaleString()} pts
                                </span>
                            </p>
                        )}
                    </div>

                    {/* Per-game comparison */}
                    {sharedPlatforms.length > 0 && (
                        <div className="bg-surface border border-hairline rounded-2xl p-5 mt-3 flex flex-col gap-4">
                            <p className="text-text-muted text-[11px] font-semibold uppercase tracking-widest text-center">By Game</p>
                            {sharedPlatforms.map(platform => {
                                const config = platformConfig[platform]
                                const sA = statsA[platform]
                                const sB = statsB[platform]
                                const hasA = accountsA.some(a => a.platform === platform)
                                const hasB = accountsB.some(a => a.platform === platform)

                                return (
                                    <div key={platform} className="border-t border-hairline pt-4 first:border-0 first:pt-0">
                                        <div className="flex items-center justify-center gap-2 mb-3">
                                            {config?.imageUrl ? (
                                                <img src={config.imageUrl} className="w-3.5 h-3.5 flex-shrink-0" alt={config.shortName} />
                                            ) : config?.icon && (
                                                <svg role="img" viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0 fill-current text-text-secondary">
                                                    <path d={config.icon.path} fillRule={config.icon.fillRule ?? "nonzero"} />
                                                </svg>
                                            )}
                                            <p className="text-text-secondary text-xs font-semibold">{config?.shortName ?? platform}</p>
                                        </div>
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                            <p className={`text-right text-sm font-bold ${sA?.rankScore > (sB?.rankScore ?? -1) ? "text-text-primary" : "text-text-secondary"}`}>
                                                {hasA ? (sA?.tierLabel ?? "Unranked") : <span className="text-[11px]">Not connected</span>}
                                            </p>
                                            <div className="w-px h-6 bg-hairline" />
                                            <p className={`text-left text-sm font-bold ${sB?.rankScore > (sA?.rankScore ?? -1) ? "text-text-primary" : "text-text-secondary"}`}>
                                                {hasB ? (sB?.tierLabel ?? "Unranked") : <span className="text-[11px]">Not connected</span>}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Stats */}
                    <div className="bg-surface border border-hairline rounded-2xl p-5 mt-3 flex flex-col gap-3">
                        <p className="text-text-muted text-[11px] font-semibold uppercase tracking-widest text-center mb-1">Stats</p>
                        <div className="grid grid-cols-[1fr_auto_1fr] text-[11px] text-text-secondary text-center mb-1">
                            <span className="text-right">{profileA.username}</span>
                            <span className="w-16" />
                            <span className="text-left">{profileB.username}</span>
                        </div>
                        <StatBar labelA="Win Rate" labelB="Win Rate" valueA={winRateA} valueB={winRateB} format={v => `${Math.round(v)}%`} />
                        <StatBar labelA="KDA" labelB="KDA" valueA={kdaA} valueB={kdaB} format={v => v.toFixed(2)} />
                    </div>
                </>
            )}
        </div>
    )
}
