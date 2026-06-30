"use client"
import { useState, useEffect } from "react"

function formatTimeAgo(timestampMs) {
    const diffMs = Date.now() - timestampMs
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 1) return "today"
    if (diffDays === 1) return "1 day ago"
    if (diffDays < 30) return `${diffDays} days ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths === 1) return "1 month ago"
    return `${diffMonths} months ago`
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

function average(values) {
    const valid = values.filter(v => v != null)
    return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null
}

function placementColor(placement) {
    if (placement === 1) return "#facc15"
    if (placement <= 4) return "#4ade80"
    return "#f87171"
}

function placementLabel(placement) {
    const suffixes = ["st", "nd", "rd", "th"]
    const suffix = placement <= 3 ? suffixes[placement - 1] : suffixes[3]
    return `${placement}${suffix}`
}

export default function TftHero({ account, accentColor = "#0bc4e3" }) {
    const [rankEntry, setRankEntry] = useState(null)
    const [matchHistory, setMatchHistory] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(
                `/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`
            )
            const data = await response.json()
            const entry = Array.isArray(data.tftData)
                ? data.tftData.find(q => q.queueType === "RANKED_TFT")
                : null
            setRankEntry(entry ?? null)
            setMatchHistory(data.tftMatchHistory ?? [])
            setLoading(false)
        }
        fetchRank()
    }, [])

    if (loading) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6">
                <p className="text-text-secondary text-sm">Loading rank...</p>
            </div>
        )
    }

    if (!rankEntry) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6 text-center">
                <p className="text-text-secondary text-sm">No ranked TFT games found yet.</p>
            </div>
        )
    }

    const totalGames = rankEntry.wins + rankEntry.losses
    const winRate = totalGames > 0 ? Math.round((rankEntry.wins / totalGames) * 100) : 0
    const avgPlacement = average(matchHistory.map(m => m.placement))
    const top4Count = matchHistory.filter(m => m.placement <= 4).length
    const top4Rate = matchHistory.length > 0 ? Math.round((top4Count / matchHistory.length) * 100) : null
    const winsInHistory = matchHistory.filter(m => m.placement === 1).length
    const winRateFromHistory = matchHistory.length > 0 ? Math.round((winsInHistory / matchHistory.length) * 100) : null

    return (
        <div
            className="bg-surface border border-line rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            {/* Rank hero row */}
            <div className="flex gap-3 sm:gap-5 items-center flex-wrap">

                {/* Rank emblem */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden">
                    <img
                        src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${rankEntry.tier.toLowerCase()}.png`}
                        alt={rankEntry.tier}
                        className="w-full h-full object-contain scale-[4.5] translate-y-2"
                    />
                </div>

                {/* Rank info */}
                <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary font-extrabold text-2xl">
                        {rankEntry.tier} {rankEntry.rank}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                        {rankEntry.leaguePoints} LP · {rankEntry.wins}W {rankEntry.losses}L · {winRate}% WR
                    </p>
                    <div className="h-2 bg-hairline rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-[width]"
                            style={{ width: `${rankEntry.leaguePoints}%`, backgroundColor: accentColor }}
                        />
                    </div>
                    <div className="flex justify-between text-text-secondary text-[10px] mt-1">
                        <span>0 LP</span>
                        <span>100 LP</span>
                    </div>
                </div>

                {/* Recent placements */}
                {matchHistory.length > 0 && (
                    <div className="text-right">
                        <p className="text-text-secondary text-[10px] uppercase tracking-widest mb-1.5">Recent Placements</p>
                        <div className="flex gap-1 justify-end">
                            {matchHistory.map((match) => (
                                <span
                                    key={match.matchId}
                                    className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center text-[9px] font-bold text-background"
                                    style={{ backgroundColor: placementColor(match.placement) }}
                                    title={`#${match.placement}`}
                                >
                                    {match.placement}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {avgPlacement != null ? avgPlacement.toFixed(1) : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Avg. placement</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {top4Rate != null ? `${top4Rate}%` : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Top 4 rate</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {winRateFromHistory != null ? `${winRateFromHistory}%` : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Win rate (1st)</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{totalGames}</p>
                    <p className="text-text-secondary text-xs">Total games</p>
                </div>
            </div>

            {/* Match history */}
            <div className="mt-5">
                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-secondary text-xs uppercase tracking-widest">Match History</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>

                {matchHistory.length === 0 ? (
                    <p className="text-text-secondary text-sm">No recent matches found.</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {matchHistory.map((match) => (
                            <div
                                key={match.matchId}
                                className="bg-surface-deep rounded-xl p-2.5 sm:p-3"
                                style={{ borderLeft: `3px solid ${placementColor(match.placement)}` }}
                            >
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Placement badge */}
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-base flex-shrink-0 text-background"
                                        style={{ backgroundColor: placementColor(match.placement) }}
                                    >
                                        {placementLabel(match.placement)}
                                    </div>

                                    {/* Augments */}
                                    <div className="flex-1 min-w-0">
                                        {match.augments.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {match.augments.map((aug, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-hairline text-text-secondary truncate max-w-[120px]"
                                                        title={aug}
                                                    >
                                                        {aug}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {/* Top traits */}
                                        {match.topTraits.length > 0 && (
                                            <div className="flex gap-1">
                                                {match.topTraits.map((trait, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold text-background"
                                                        style={{ backgroundColor: accentColor }}
                                                        title={`${trait.name} (${trait.numUnits} units)`}
                                                    >
                                                        {trait.name.slice(0, 3).toUpperCase()}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Time info */}
                                    <div className="text-right flex-shrink-0 hidden sm:block">
                                        {match.gameLength != null && (
                                            <p className="text-text-secondary font-mono text-xs">{formatDuration(match.gameLength)}</p>
                                        )}
                                        {match.game_datetime != null && (
                                            <p className="text-text-secondary text-[10px]">{formatTimeAgo(match.game_datetime)}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
