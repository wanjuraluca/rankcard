"use client"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { HeroSkeleton } from "./Skeleton"
import MatchDetailMarvelRivals from "./MatchDetailMarvelRivals"

const CDN = "https://marvelrivalsapi.com/rivals"

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
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

// Aggregates the (already limited) recent match history by hero — there's no
// dedicated "heroes ranked" breakdown wired up yet, unlike Overwatch's
// per-hero career totals, so this is a best-effort "recent form" list only.
function buildTopHeroes(matchHistory) {
    const byHero = {}
    for (const match of matchHistory) {
        if (!match.hero) continue
        if (!byHero[match.hero]) byHero[match.hero] = { matches: [], icon: match.heroIcon }
        byHero[match.hero].matches.push(match)
    }
    return Object.entries(byHero)
        .map(([hero, { matches, icon }]) => {
            const wins = matches.filter(m => m.win).length
            const kda = average(matches.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
            return {
                hero,
                icon,
                games: matches.length,
                winRate: Math.round((wins / matches.length) * 100),
                kda: kda.toFixed(1),
            }
        })
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
}

const ROLE_LABELS = { vanguard: "Vanguard", duelist: "Duelist", strategist: "Strategist" }

export default function MarvelRivalsHero({ account, accentColor = "#f0c929" }) {

    const [mrRank, setMrRank] = useState(null)
    const [overallStats, setOverallStats] = useState(null)
    const [matchHistory, setMatchHistory] = useState([])
    const [roleStats, setRoleStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [expandedMatchId, setExpandedMatchId] = useState(null)
    const [matchDetails, setMatchDetails] = useState({}) // matchId -> detail
    const [matchDetailLoading, setMatchDetailLoading] = useState(null)
    const scrollYBeforeToggle = useRef(null)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&accountId=${account.id}`)
            const data = await response.json()
            setMrRank(data.mrRank ?? null)
            setOverallStats(data.mrOverallStats ?? null)
            setMatchHistory(data.mrMatchHistory ?? [])
            setRoleStats(data.mrRoleStats ?? null)
            setLoading(false)
        }

        fetchRank()
    }, [])

    useLayoutEffect(() => {
        if (scrollYBeforeToggle.current !== null) {
            window.scrollTo(0, scrollYBeforeToggle.current)
            scrollYBeforeToggle.current = null
        }
    }, [expandedMatchId])

    async function toggleMatch(matchId) {
        scrollYBeforeToggle.current = window.scrollY
        if (expandedMatchId === matchId) {
            setExpandedMatchId(null)
            return
        }
        setExpandedMatchId(matchId)
        if (!matchDetails[matchId]) {
            setMatchDetailLoading(matchId)
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&matchId=${encodeURIComponent(matchId)}`)
            const detail = await response.json()
            setMatchDetails(prev => ({ ...prev, [matchId]: detail }))
            setMatchDetailLoading(null)
        }
    }

    if (loading) {
        return <HeroSkeleton accentColor={accentColor} />
    }

    if (!mrRank) {
        return (
            <div className="bg-surface border border-hairline rounded-2xl p-6 text-center">
                <p className="text-text-secondary text-sm">No ranked data found yet.</p>
            </div>
        )
    }

    const ranked = overallStats?.ranked
    const winRate = ranked?.total_matches > 0 ? Math.round((ranked.total_wins / ranked.total_matches) * 100) : null
    const kda = ranked ? (ranked.total_kills + ranked.total_assists) / Math.max(ranked.total_deaths, 1) : null
    const topHeroes = buildTopHeroes(matchHistory)
    const roleEntries = roleStats
        ? Object.entries(roleStats).filter(([, r]) => r && r.matches > 0)
        : []

    return (
        <div
            className="bg-surface border border-hairline rounded-2xl p-4 sm:p-5 relative"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            <div className="flex gap-3 sm:gap-5 items-center flex-wrap">

                {/* Rank emblem */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {mrRank.image && (
                        <img src={`${CDN}${mrRank.image}`} alt={mrRank.rank} className="w-full h-full object-contain" />
                    )}
                </div>

                {/* Rank info */}
                <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary font-extrabold text-2xl">{mrRank.rank}</p>
                    <p className="text-text-secondary text-sm mt-1">
                        {ranked?.total_matches ?? 0} ranked games
                        {winRate != null && <> · {winRate}% WR</>}
                    </p>
                </div>

                {/* Recent form */}
                {matchHistory.length > 0 && (
                    <div className="text-right">
                        <p className="text-text-muted text-[10px] uppercase tracking-widest mb-1.5">Recent Form</p>
                        <div className="flex gap-1 justify-end">
                            {matchHistory.slice(0, 10).map((match) => (
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
                <div className="bg-surface-deep rounded-lg p-3">
                    <p className="text-text-primary font-extrabold text-xl">{kda != null ? kda.toFixed(2) : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg KDA</p>
                </div>
                <div className="bg-surface-deep rounded-lg p-3">
                    <p className="text-text-primary font-extrabold text-xl">{ranked?.total_kills ?? "—"}</p>
                    <p className="text-text-secondary text-xs">Total Kills</p>
                </div>
                <div className="bg-surface-deep rounded-lg p-3">
                    <p className="text-text-primary font-extrabold text-xl">{ranked?.total_mvp ?? 0}</p>
                    <p className="text-text-secondary text-xs">MVPs</p>
                </div>
                <div className="bg-surface-deep rounded-lg p-3">
                    <p className="text-text-primary font-extrabold text-xl">{ranked?.total_svp ?? 0}</p>
                    <p className="text-text-secondary text-xs">SVPs</p>
                </div>
            </div>

            {/* Role win rates — only rendered if the (occasionally flaky) v2 API came through */}
            {roleEntries.length > 0 && (
                <div className="bg-surface-deep rounded-lg p-4 mt-5">
                    <p className="text-text-muted text-[11px] uppercase tracking-widest mb-3">Role Win Rate</p>
                    <div className="grid grid-cols-3 gap-2">
                        {roleEntries.map(([role, stats]) => (
                            <div key={role} className="text-center">
                                <p className="text-text-primary font-extrabold text-lg">
                                    {stats.winRate != null ? `${Math.round(stats.winRate * 100)}%` : "—"}
                                </p>
                                <p className="text-text-secondary text-[11px]">{ROLE_LABELS[role] ?? role}</p>
                                <p className="text-text-secondary text-[10px]">{stats.matches} games</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top Heroes */}
            {topHeroes.length > 0 && (
                <div className="bg-surface-deep rounded-lg p-4 mt-5">
                    <p className="text-text-muted text-[11px] uppercase tracking-widest mb-3">Top Heroes (recent)</p>
                    <div className="flex flex-col gap-2.5">
                        {topHeroes.map((hero) => (
                            <div key={hero.hero} className="flex items-center gap-2.5">
                                {hero.icon ? (
                                    <img
                                        src={`${CDN}${hero.icon}`}
                                        alt={hero.hero}
                                        className="w-9 h-9 rounded-lg object-cover bg-surface flex-shrink-0"
                                        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-lg bg-surface flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-[13px] font-bold truncate capitalize">{hero.hero}</p>
                                    <p className="text-text-secondary text-[10px]">{hero.kda} KDA · {hero.games} games</p>
                                </div>
                                <p className="text-positive text-[13px] font-bold flex-shrink-0">{hero.winRate}%</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Match history */}
            <div className="mt-5">
                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-muted text-xs uppercase tracking-widest">Match History</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                {matchHistory.length === 0 ? (
                    <p className="text-text-secondary text-sm">No matches found yet.</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {matchHistory.map((match) => {
                            const isExpanded = expandedMatchId === match.matchId
                            return (
                                <div
                                    key={match.matchId}
                                    className="bg-surface-deep rounded-lg overflow-hidden"
                                    style={{ borderLeft: `3px solid ${match.win ? "#4ade80" : "#f87171"}` }}
                                >
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => toggleMatch(match.matchId)}
                                        className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 text-left active:bg-hairline/40 transition-colors"
                                    >
                                        {match.heroIcon ? (
                                            <img
                                                src={`${CDN}${match.heroIcon}`}
                                                alt={match.hero}
                                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover bg-surface flex-shrink-0"
                                                onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                            />
                                        ) : (
                                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-surface flex-shrink-0" />
                                        )}
                                        <div className="w-[64px] sm:w-[110px] flex-shrink-0">
                                            <p className="text-text-primary text-xs sm:text-sm font-bold truncate capitalize">{match.hero}</p>
                                        </div>
                                        <div className="flex-1 font-mono text-xs sm:text-sm text-text-primary">
                                            {match.kills}/{match.deaths}/{match.assists}
                                        </div>
                                        <p className={`text-xs sm:text-sm font-bold flex-shrink-0 ${match.win ? "text-positive" : "text-negative"}`}>
                                            {match.win ? "Win" : "Loss"}
                                        </p>
                                        <div className="text-right flex-shrink-0 hidden sm:block">
                                            <p className="text-text-secondary font-mono text-xs">
                                                {match.durationSeconds ? formatDuration(match.durationSeconds) : "—"}
                                            </p>
                                            <p className="text-text-secondary text-[10px]">
                                                {match.gameStartTimestamp ? formatTimeAgo(match.gameStartTimestamp) : ""}
                                            </p>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-hairline">
                                            {matchDetailLoading === match.matchId ? (
                                                <p className="text-text-secondary text-xs px-2 py-2">Loading scoreboard...</p>
                                            ) : (
                                                <MatchDetailMarvelRivals detail={matchDetails[match.matchId]} yourUid={account.puuid} />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
