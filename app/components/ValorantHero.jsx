"use client"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import RrHistoryChart from "./RrHistoryChart"
import MatchDetailValorant from "./MatchDetailValorant"

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

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
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
}

function buildTopAgents(matchHistory) {
    const byAgent = {}
    for (const match of matchHistory) {
        if (!match.agent) continue
        if (!byAgent[match.agent]) byAgent[match.agent] = { matches: [], icon: match.agentIcon }
        byAgent[match.agent].matches.push(match)
    }
    return Object.entries(byAgent)
        .map(([agent, { matches, icon }]) => {
            const wins = matches.filter(m => m.win).length
            const kda = average(matches.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
            return {
                agent,
                icon,
                games: matches.length,
                winRate: Math.round((wins / matches.length) * 100),
                kda: kda.toFixed(1)
            }
        })
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
}

export default function ValorantHero({ account, accentColor = "#ff4655" }) {

    const [valorantData, setValorantData] = useState(null)
    const [matchHistory, setMatchHistory] = useState([])
    const [mmrHistory, setMmrHistory] = useState([])
    const [yourPuuid, setYourPuuid] = useState(null)
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
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}`)
            const data = await response.json()
            setValorantData(data.valorantData?.data?.current_data ?? null)
            setMatchHistory(data.valorantMatchHistory ?? [])
            setMmrHistory(data.valorantMmrHistory ?? [])
            setYourPuuid(data.puuid ?? null)
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

    if (!valorantData) {
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
    const avgAcs = average(matchHistory.map(m => m.acs))
    const avgKda = average(matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
    const mvpCount = matchHistory.filter(m => m.isMvp).length
    const topAgents = buildTopAgents(matchHistory)

    const rankImage = valorantData.images?.large ?? null

    return (
        <div
            className="bg-surface border border-line rounded-2xl p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            <div className="flex gap-5 items-center flex-wrap">

                {/* Rank emblem */}
                <div className="w-24 h-24 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {rankImage && (
                        <img src={rankImage} alt={valorantData.currenttierpatched} className="w-full h-full object-contain" />
                    )}
                </div>

                {/* Rank info */}
                <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary font-extrabold text-2xl">
                        {valorantData.currenttierpatched}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                        {valorantData.ranking_in_tier} RR
                        {winRate != null && <> · {winRate}% WR</>}
                    </p>
                    <div className="h-2 bg-hairline rounded-full mt-3 overflow-hidden">
                        <div
                            className="h-2 rounded-full transition-[width]"
                            style={{ width: `${valorantData.ranking_in_tier}%`, backgroundColor: accentColor }}
                        />
                    </div>
                    <div className="flex justify-between text-text-secondary text-[10px] mt-1">
                        <span>0 RR</span>
                        <span>100 RR</span>
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
                    <p className="text-text-primary font-extrabold text-xl">{avgAcs != null ? Math.round(avgAcs) : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg. combat score</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgKda != null ? avgKda.toFixed(2) : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg KDA</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{mvpCount}</p>
                    <p className="text-text-secondary text-xs">MVPs</p>
                </div>
            </div>

            {/* Top Agents + RR graph */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">Top Agents</p>
                    <div className="flex flex-col gap-2.5">
                        {topAgents.length === 0 && (
                            <p className="text-text-secondary text-sm">No recent ranked games yet.</p>
                        )}
                        {topAgents.map((agent) => (
                            <div key={agent.agent} className="flex items-center gap-2.5">
                                {agent.icon ? (
                                    <img
                                        src={agent.icon}
                                        alt={agent.agent}
                                        className="w-9 h-9 rounded-md object-cover bg-surface flex-shrink-0"
                                        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-md bg-surface flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-[13px] font-bold truncate">{agent.agent}</p>
                                    <p className="text-text-secondary text-[10px]">{agent.kda} KDA · {agent.games} games</p>
                                </div>
                                <p className="text-positive text-[13px] font-bold flex-shrink-0">{agent.winRate}%</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">RR History</p>
                    <RrHistoryChart mmrHistory={mmrHistory} accentColor={accentColor} />
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
                                        className="w-full flex items-center gap-3 p-3 text-left"
                                    >
                                        {match.agentIcon ? (
                                            <img
                                                src={match.agentIcon}
                                                alt={match.agent}
                                                className="w-9 h-9 rounded-md object-cover bg-surface flex-shrink-0"
                                                onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                            />
                                        ) : (
                                            <div className="w-9 h-9 rounded-md bg-surface flex-shrink-0" />
                                        )}
                                        <div className="w-[110px] flex-shrink-0">
                                            <p className="text-text-primary text-sm font-bold truncate">{match.agent}</p>
                                            <p className="text-text-secondary text-[10px] truncate">{match.map}</p>
                                        </div>
                                        <div className="flex-1 font-mono text-sm text-text-primary">
                                            {match.kills}/{match.deaths}/{match.assists}
                                            <span className="text-text-secondary text-xs ml-2">{match.acs} ACS</span>
                                            {match.isMvp && <span className="text-accent-soft text-xs ml-2">MVP</span>}
                                        </div>
                                        <p className={`text-sm font-bold flex-shrink-0 ${match.win ? "text-positive" : "text-negative"}`}>
                                            {match.win ? "Win" : "Loss"}
                                        </p>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-text-secondary font-mono text-xs">
                                                {match.gameLengthSeconds ? formatDuration(match.gameLengthSeconds) : "—"}
                                            </p>
                                            <p className="text-text-secondary text-[10px]">
                                                {match.gameStartTimestamp ? formatTimeAgo(match.gameStartTimestamp) : ""}
                                            </p>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-hairline">
                                            <MatchDetailValorant match={match} yourPuuid={yourPuuid} />
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
