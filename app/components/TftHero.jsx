"use client"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import TftLpHistoryChart from "./TftLpHistoryChart"
import MatchDetailTft from "./MatchDetailTft"

const RANKED_MODES = [
    { key: "RANKED_TFT", label: "Ranked" },
    { key: "RANKED_TFT_DOUBLE_UP", label: "Double Up" }
]

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

// Small square unit icon with item icons docked underneath. Falls back to a
// letter badge when the server couldn't resolve an icon URL (Community
// Dragon's set data can lag behind a new TFT patch) — a missing icon should
// never break the rest of the match-history card.
function UnitIcon({ unit }) {
    return (
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
            <div
                className="w-7 h-7 rounded-md overflow-hidden flex items-center justify-center text-[10px] font-bold text-text-secondary bg-surface border border-hairline flex-shrink-0"
                style={unit.tier > 1 ? { borderColor: unit.tier >= 3 ? "#facc15" : "#b16cff" } : undefined}
                title={`${unit.name}${unit.items?.length ? ` (${unit.items.map(i => i.name).join(", ")})` : ""}`}
            >
                {unit.icon ? (
                    <img src={unit.icon} alt={unit.name} className="w-full h-full object-cover" />
                ) : (
                    unit.name?.[0] ?? "?"
                )}
            </div>
            {unit.items?.length > 0 && (
                <div className="flex gap-[1px]">
                    {unit.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="w-[11px] h-[11px] rounded-[2px] overflow-hidden bg-surface border border-hairline flex-shrink-0" title={item.name}>
                            {item.icon && <img src={item.icon} alt={item.name} className="w-full h-full object-cover" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function TraitBadge({ trait, accentColor }) {
    return (
        <div
            className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-surface"
            style={{ border: `1.5px solid ${accentColor}` }}
            title={`${trait.name} (${trait.numUnits} units)`}
        >
            {trait.icon ? (
                <img src={trait.icon} alt={trait.name} className="w-3 h-3 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            ) : (
                <span className="text-[8px] font-bold text-text-primary">{trait.name?.slice(0, 1).toUpperCase()}</span>
            )}
        </div>
    )
}

function AugmentBadge({ augment }) {
    if (augment.icon) {
        return (
            <div
                className="w-5 h-5 rounded overflow-hidden bg-surface border border-hairline flex-shrink-0"
                title={augment.name}
            >
                <img src={augment.icon} alt={augment.name} className="w-full h-full object-cover" />
            </div>
        )
    }
    return (
        <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-hairline text-text-secondary truncate max-w-[120px]"
            title={augment.name}
        >
            {augment.name}
        </span>
    )
}

export default function TftHero({ account, accentColor = "#0bc4e3" }) {
    const [tftData, setTftData] = useState([])
    const [allMatchHistory, setAllMatchHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeMode, setActiveMode] = useState("RANKED_TFT")
    const [expandedMatchId, setExpandedMatchId] = useState(null)
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
            const response = await fetch(
                `/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`
            )
            const data = await response.json()
            const entries = Array.isArray(data.tftData) ? data.tftData : []
            const history = data.tftMatchHistory ?? []
            setTftData(entries)
            setAllMatchHistory(history)
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

    const rankEntry = tftData.find(q => q.queueType === activeMode) ?? null
    const matchHistory = allMatchHistory.filter(m => (m.queueType ?? "RANKED_TFT") === activeMode)

    const modeTabs = RANKED_MODES.map(mode => ({
        ...mode,
        games: allMatchHistory.filter(m => (m.queueType ?? "RANKED_TFT") === mode.key).length,
        hasRank: tftData.some(q => q.queueType === mode.key)
    }))

    return (
        <div
            className="bg-surface border border-line rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            {/* Mode tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
                {modeTabs.map(mode => (
                    <button
                        key={mode.key}
                        onClick={() => setActiveMode(mode.key)}
                        className={`border rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors ${activeMode === mode.key ? "border-accent/50 bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {!rankEntry ? (
                <div className="text-center py-6">
                    <p className="text-text-secondary text-sm">No ranked {modeTabs.find(m => m.key === activeMode)?.label} games found yet.</p>
                </div>
            ) : (
                <TftModeContent
                    rankEntry={rankEntry}
                    matchHistory={matchHistory}
                    account={account}
                    activeMode={activeMode}
                    accentColor={accentColor}
                    expandedMatchId={expandedMatchId}
                    toggleMatch={toggleMatch}
                />
            )}
        </div>
    )
}

function TftModeContent({ rankEntry, matchHistory, account, activeMode, accentColor, expandedMatchId, toggleMatch }) {
    const [hoveredPlacement, setHoveredPlacement] = useState(null)
    const totalGames = rankEntry.wins + rankEntry.losses
    const winRate = totalGames > 0 ? Math.round((rankEntry.wins / totalGames) * 100) : 0
    const avgPlacement = average(matchHistory.map(m => m.placement))
    const top4Count = matchHistory.filter(m => m.placement <= 4).length
    const top4Rate = matchHistory.length > 0 ? Math.round((top4Count / matchHistory.length) * 100) : null
    const winsInHistory = matchHistory.filter(m => m.placement === 1).length
    const winRateFromHistory = matchHistory.length > 0 ? Math.round((winsInHistory / matchHistory.length) * 100) : null
    const avgDamage = average(matchHistory.map(m => m.damageDealt))
    const avgEliminated = average(matchHistory.map(m => m.playersEliminated))
    const avgLevel = average(matchHistory.map(m => m.level))

    // Placement distribution: how many of the recent matches landed on each
    // of the 8 possible placements, as a simple bar chart built from divs.
    const placementCounts = Array.from({ length: 8 }, (_, i) => {
        const placement = i + 1
        return { placement, count: matchHistory.filter(m => m.placement === placement).length }
    })
    const maxPlacementCount = Math.max(1, ...placementCounts.map(p => p.count))

    return (
        <>
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
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {avgDamage != null ? Math.round(avgDamage) : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Avg. damage</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {avgEliminated != null ? avgEliminated.toFixed(1) : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Avg. eliminated</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">
                        {avgLevel != null ? avgLevel.toFixed(1) : "—"}
                    </p>
                    <p className="text-text-secondary text-xs">Avg. level</p>
                </div>
            </div>

            {/* Placement distribution */}
            <div className="mt-5">
                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-secondary text-xs uppercase tracking-widest">
                        Placement Distribution {matchHistory.length > 0 && <span className="normal-case text-text-secondary/70">· {matchHistory.length} {matchHistory.length === 1 ? "game" : "games"}</span>}
                    </p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-surface-deep rounded-xl p-4">
                    <div className="flex items-end justify-between gap-2 h-24 relative">
                        {placementCounts.map(({ placement, count }) => (
                            <div
                                key={placement}
                                className="flex-1 flex flex-col items-center justify-end h-full relative"
                                onMouseEnter={() => setHoveredPlacement(placement)}
                                onMouseLeave={() => setHoveredPlacement(prev => (prev === placement ? null : prev))}
                            >
                                {hoveredPlacement === placement && (
                                    <div className="absolute bottom-full mb-1.5 z-10 bg-surface border border-line rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none whitespace-nowrap">
                                        <p className="text-text-primary text-xs font-bold">{placementLabel(placement)} place</p>
                                        <p className="text-text-secondary text-[11px]">
                                            {count} {count === 1 ? "game" : "games"}
                                            {matchHistory.length > 0 && <> · {Math.round((count / matchHistory.length) * 100)}%</>}
                                        </p>
                                    </div>
                                )}
                                <p className="text-text-secondary text-[10px] mb-1">{count > 0 ? count : ""}</p>
                                <div
                                    className="w-full rounded-t-md transition-[height,opacity]"
                                    style={{
                                        height: `${Math.max((count / maxPlacementCount) * 100, count > 0 ? 6 : 2)}%`,
                                        backgroundColor: placementColor(placement),
                                        opacity: hoveredPlacement === placement ? 1 : (count > 0 ? 0.85 : 0.15)
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between gap-2 mt-1.5">
                        {placementCounts.map(({ placement }) => (
                            <p key={placement} className="flex-1 text-center text-text-secondary text-[10px]">#{placement}</p>
                        ))}
                    </div>
                </div>
            </div>

            {/* Rank history */}
            <div className="mt-5">
                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-secondary text-xs uppercase tracking-widest">Rank History</p>
                    <div className="flex-1 h-px bg-hairline" />
                </div>
                <div className="bg-surface-deep rounded-xl p-4">
                    <TftLpHistoryChart
                        accountId={account.id}
                        matchHistory={matchHistory}
                        currentLeaguePoints={rankEntry.leaguePoints}
                        accentColor={accentColor}
                        queueType={activeMode}
                    />
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
                        {matchHistory.map((match) => {
                            const sortedUnits = [...(match.allUnits ?? [])].sort((a, b) => b.tier - a.tier).slice(0, 8)
                            const isExpanded = expandedMatchId === match.matchId
                            return (
                                <div
                                    key={match.matchId}
                                    className="bg-surface-deep rounded-xl overflow-hidden"
                                    style={{ borderLeft: `3px solid ${placementColor(match.placement)}` }}
                                >
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => toggleMatch(match.matchId)}
                                        className="w-full text-left p-2.5 sm:p-3 active:bg-hairline/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-wrap">
                                            {/* Placement badge */}
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-base flex-shrink-0 text-background"
                                                style={{ backgroundColor: placementColor(match.placement) }}
                                            >
                                                {placementLabel(match.placement)}
                                            </div>

                                            {/* Composition + traits + augments */}
                                            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                {sortedUnits.length > 0 && (
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {sortedUnits.map((unit, i) => (
                                                            <UnitIcon key={i} unit={unit} />
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {match.topTraits?.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {match.topTraits.map((trait, i) => (
                                                                <TraitBadge key={i} trait={trait} accentColor={accentColor} />
                                                            ))}
                                                        </div>
                                                    )}
                                                    {match.augments?.length > 0 && (
                                                        <div className="flex gap-1">
                                                            {match.augments.map((augment, i) => (
                                                                <AugmentBadge key={i} augment={augment} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
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
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-hairline">
                                            <MatchDetailTft match={match} yourPuuid={account.puuid} accentColor={accentColor} />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}
