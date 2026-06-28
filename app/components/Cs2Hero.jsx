"use client"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import Cs2RatingChart from "./Cs2RatingChart"
import MatchDetailCs2 from "./MatchDetailCs2"

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

function average(values) {
    const valid = values.filter(v => v != null)
    return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null
}

// Valve's own Premier color bands — there's no "tier name" from the API
// (Premier is a raw rating), so this is purely a display label/color.
const PREMIER_BANDS = [
    { min: 30000, name: "Yellow", color: "#facc15" },
    { min: 25000, name: "Red", color: "#f87171" },
    { min: 20000, name: "Pink", color: "#f472b6" },
    { min: 15000, name: "Purple", color: "#c084fc" },
    { min: 10000, name: "Blue", color: "#60a5fa" },
    { min: 5000, name: "Light Blue", color: "#7dd3fc" },
    { min: 0, name: "Grey", color: "#9a96a8" },
]

function getPremierBand(rating) {
    return PREMIER_BANDS.find(b => rating >= b.min) ?? PREMIER_BANDS[PREMIER_BANDS.length - 1]
}

function buildTopMaps(matchHistory) {
    const byMap = {}
    for (const match of matchHistory) {
        if (!match.map) continue
        if (!byMap[match.map]) byMap[match.map] = []
        byMap[match.map].push(match)
    }
    return Object.entries(byMap)
        .map(([map, matches]) => {
            const wins = matches.filter(m => m.win).length
            const kda = average(matches.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
            return {
                map,
                games: matches.length,
                winRate: Math.round((wins / matches.length) * 100),
                kda: kda.toFixed(1)
            }
        })
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
}

export default function Cs2Hero({ account, accentColor = "#4b9fff" }) {

    const [cs2Profile, setCs2Profile] = useState(null)
    const [matchHistory, setMatchHistory] = useState([])
    const [yourSteam64Id, setYourSteam64Id] = useState(null)
    const [expandedMatchId, setExpandedMatchId] = useState(null)
    const [loading, setLoading] = useState(true)
    const scrollYBeforeToggle = useRef(null)

    function toggleMatch(matchId) {
        scrollYBeforeToggle.current = window.scrollY
        setExpandedMatchId(prev => (prev === matchId ? null : matchId))
    }

    useLayoutEffect(() => {
        if (scrollYBeforeToggle.current !== null) {
            window.scrollTo(0, scrollYBeforeToggle.current)
            scrollYBeforeToggle.current = null
        }
    }, [expandedMatchId])

    useEffect(() => {
        async function fetchStats() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`)
            const data = await response.json()
            setCs2Profile(data.cs2Profile ?? null)
            setMatchHistory(data.cs2MatchHistory ?? [])
            setYourSteam64Id(data.steam64Id ?? null)
            setLoading(false)
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6">
                <p className="text-text-secondary text-sm">Loading rank...</p>
            </div>
        )
    }

    const premierRating = cs2Profile?.ranks?.premier ?? null
    if (!cs2Profile || premierRating == null) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6 text-center">
                <p className="text-text-secondary text-sm">No ranked data found yet.</p>
            </div>
        )
    }

    const wins = matchHistory.filter(m => m.win).length
    const totalGames = matchHistory.length
    const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : null

    const avgHeadshotPct = average(matchHistory.map(m => m.headshotPct))
    const avgAdr = average(matchHistory.map(m => m.adr))
    const avgKda = average(matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
    const mvpTotal = matchHistory.reduce((sum, m) => sum + (m.mvps ?? 0), 0)
    const topMaps = buildTopMaps(matchHistory)

    const band = getPremierBand(premierRating)
    const progressInBand = Math.min(((premierRating - band.min) / 5000) * 100, 100)

    return (
        <div
            className="bg-surface border border-line rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            <div className="flex gap-3 sm:gap-5 items-center flex-wrap">

                {/* Rank emblem (Premier has no API icon — color-coded badge instead) */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 flex items-center justify-center">
                    <div
                        className="w-20 h-20 rounded-full flex items-center justify-center border-4"
                        style={{ borderColor: band.color, backgroundColor: `${band.color}1f` }}
                    >
                        <span className="text-text-primary font-extrabold text-sm">{Math.round(premierRating / 1000)}k</span>
                    </div>
                </div>

                {/* Rank info */}
                <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary font-extrabold text-2xl">
                        {band.name}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                        {premierRating.toLocaleString()} Premier Rating
                        {winRate != null && <> · {winRate}% WR</>}
                    </p>
                    <div className="h-2 bg-hairline rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-[width]"
                            style={{ width: `${progressInBand}%`, backgroundColor: accentColor }}
                        />
                    </div>
                    <div className="flex justify-between text-text-secondary text-[10px] mt-1">
                        <span>{band.min.toLocaleString()}</span>
                        <span>{(band.min + 5000).toLocaleString()}</span>
                    </div>
                </div>

                {/* Recent form */}
                {matchHistory.length > 0 && (
                    <div className="text-right">
                        <p className="text-text-secondary text-[10px] uppercase tracking-widest mb-1.5">Recent Form</p>
                        <div className="flex gap-1 justify-end">
                            {matchHistory.map((match) => (
                                <span
                                    key={match.matchId}
                                    className="w-[18px] h-[18px] rounded-[3px]"
                                    style={{ backgroundColor: match.win ? "#4ade80" : "#f87171" }}
                                    title={match.win ? "Win" : "Loss"}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgHeadshotPct != null ? `${Math.round(avgHeadshotPct)}%` : "—"}</p>
                    <p className="text-text-secondary text-xs">Headshot rate</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgAdr != null ? Math.round(avgAdr) : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg. damage/round</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgKda != null ? avgKda.toFixed(2) : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg KDA</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{mvpTotal}</p>
                    <p className="text-text-secondary text-xs">MVPs</p>
                </div>
            </div>

            {/* Top Maps + Rating graph */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">Top Maps</p>
                    <div className="flex flex-col gap-2.5">
                        {topMaps.length === 0 && (
                            <p className="text-text-secondary text-sm">No recent matches yet.</p>
                        )}
                        {topMaps.map((map) => (
                            <div key={map.map} className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-md bg-surface flex-shrink-0 flex items-center justify-center text-text-secondary text-xs font-bold">
                                    {map.map?.replace('de_', '').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-[13px] font-bold truncate">{map.map}</p>
                                    <p className="text-text-secondary text-[10px]">{map.kda} KDA · {map.games} games</p>
                                </div>
                                <p className="text-positive text-[13px] font-bold flex-shrink-0">{map.winRate}%</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">Rating History</p>
                    <Cs2RatingChart matchHistory={matchHistory} accentColor={accentColor} />
                </div>
            </div>

            {/* Match history */}
            {matchHistory.length > 0 && (
                <div className="mt-5">
                    <div className="flex items-center gap-2 mb-2.5">
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Match History</p>
                        <div className="flex-1 h-px bg-hairline" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {matchHistory.map((match) => {
                            const isExpanded = expandedMatchId === match.matchId
                            return (
                                <div
                                    key={match.matchId}
                                    className="bg-surface-deep rounded-xl overflow-hidden"
                                    style={{ borderLeft: `3px solid ${match.win ? "#4ade80" : "#f87171"}` }}
                                >
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => toggleMatch(match.matchId)}
                                        className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 text-left active:bg-hairline/40 transition-colors"
                                    >
                                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-surface flex-shrink-0 flex items-center justify-center text-text-secondary text-xs font-bold">
                                            {match.map?.replace('de_', '').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="w-[64px] sm:w-[110px] flex-shrink-0">
                                            <p className="text-text-primary text-xs sm:text-sm font-bold truncate">{match.map}</p>
                                            <p className="text-text-secondary text-[10px] truncate capitalize hidden sm:block">{match.mode}</p>
                                        </div>
                                        <div className="flex-1 font-mono text-xs sm:text-sm text-text-primary">
                                            {match.kills}/{match.deaths}/{match.assists}
                                            <span className="text-text-secondary text-[10px] sm:text-xs ml-1 sm:ml-2">{match.adr ?? "—"} ADR</span>
                                            {match.isMvp && <span className="text-accent-soft text-[10px] sm:text-xs ml-1 sm:ml-2">MVP</span>}
                                        </div>
                                        <p className={`text-xs sm:text-sm font-bold flex-shrink-0 ${match.win ? "text-positive" : "text-negative"}`}>
                                            {match.win ? "Win" : "Loss"}
                                        </p>
                                        <div className="text-right flex-shrink-0 hidden sm:block">
                                            <p className="text-text-secondary text-[10px]">
                                                {match.gameStartTimestamp ? formatTimeAgo(match.gameStartTimestamp) : ""}
                                            </p>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-hairline">
                                            <MatchDetailCs2 match={match} yourSteam64Id={yourSteam64Id} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
