"use client"
import { useState, useEffect } from "react"
import { HeroSkeleton } from "./Skeleton"
import { getOverwatchScore } from "@/lib/rankScore"

const ROLE_LABELS = { tank: "Tank", damage: "Damage", support: "Support", open: "Open Queue" }
const ROLES = ["tank", "damage", "support", "open"]

function formatNumber(value) {
    return value == null ? "—" : Math.round(value).toLocaleString()
}

// Career stats report time in seconds — most values here run into the
// hundreds/thousands of hours, so "Xh Ym" reads better than raw seconds.
function formatDuration(seconds) {
    if (seconds == null) return "—"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

// The handful of stats worth a big, prominent tile — the rest go in the
// smaller "everything else" grid below. Field names come straight from
// OverFast's career stats categories (combat/game/assists/match_awards).
const KEY_STATS = [
    { key: "eliminations", label: "Eliminations", get: (d) => d.combat?.eliminations, format: formatNumber },
    { key: "kd", label: "K/D", get: (d) => d.combat?.eliminations / Math.max(d.combat?.deaths ?? 0, 1), format: (v) => v == null || isNaN(v) ? "—" : v.toFixed(2) },
    { key: "hero_damage_done", label: "Hero Damage Done", get: (d) => d.combat?.hero_damage_done, format: formatNumber },
    { key: "objective_time", label: "Objective Time", get: (d) => d.combat?.objective_time, format: formatDuration },
    { key: "games_won", label: "Games Won", get: (d) => d.game?.games_won, format: formatNumber },
]

const SECONDARY_STATS = [
    { label: "Deaths", get: (d) => d.combat?.deaths },
    { label: "Assists", get: (d) => d.assists?.assists },
    { label: "Final Blows", get: (d) => d.combat?.final_blows },
    { label: "Objective Kills", get: (d) => d.combat?.objective_kills },
    { label: "Solo Kills", get: (d) => d.combat?.solo_kills },
    { label: "Multikills", get: (d) => d.combat?.multikills },
    { label: "Offensive Assists", get: (d) => d.assists?.offensive_assists },
    { label: "Defensive Assists", get: (d) => d.assists?.defensive_assists },
    { label: "Recon Assists", get: (d) => d.assists?.recon_assists },
    { label: "Melee Final Blows", get: (d) => d.combat?.melee_final_blows },
    { label: "Environmental Kills", get: (d) => d.combat?.environmental_kills },
    { label: "Healing Done", get: (d) => d.assists?.healing_done },
    { label: "Cards", get: (d) => d.match_awards?.cards },
    { label: "Time Played", get: (d) => d.game?.time_played, format: formatDuration },
    { label: "Games Played", get: (d) => d.game?.games_played },
]

const GAMEMODE_TABS = [
    { key: "competitive", label: "Competitive" },
    { key: "quickplay", label: "Quickplay" },
]

export default function OverwatchHero({ account, accentColor = "#4a4c4e" }) {

    const [ranks, setRanks] = useState(null)
    const [title, setTitle] = useState(null)
    const [stats, setStats] = useState(null)
    const [gamemode, setGamemode] = useState("competitive")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`)
            const data = await response.json()
            setRanks(data.owRanks ?? null)
            setTitle(data.owTitle ?? null)
            setStats(data.owStats ?? null)
            setLoading(false)
        }

        fetchStats()
    }, [])

    if (loading) {
        return <HeroSkeleton accentColor={accentColor} />
    }

    const best = getOverwatchScore(ranks)
    if (!ranks || !best) {
        return (
            <div className="bg-surface border border-hairline rounded-2xl p-6 text-center">
                <p className="text-text-secondary text-sm">No competitive rank found yet. The career profile may be private, or no ranked games were played this season.</p>
            </div>
        )
    }

    const activeStats = stats?.[gamemode] ?? null
    const gamesPlayed = activeStats?.game?.games_played
    const gamesWon = activeStats?.game?.games_won
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : null

    return (
        <div
            className="bg-surface border border-hairline rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            {title && (
                <p className="text-text-secondary text-xs mb-3">{title}</p>
            )}

            {/* Overwatch has no single rank — role queue and Open Queue are tracked
                separately, so this shows all four side by side instead of one big emblem. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ROLES.map((role) => {
                    const rank = ranks[role]
                    const isBest = best.role === role
                    return (
                        <div
                            key={role}
                            className="bg-surface-deep rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
                            style={isBest ? { boxShadow: `0 0 0 1.5px ${accentColor}` } : undefined}
                        >
                            <div className="w-11 h-11 flex items-center justify-center">
                                {rank?.rankIcon ? (
                                    <img src={rank.rankIcon} alt={rank.division} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-hairline" />
                                )}
                            </div>
                            <p className="text-text-secondary text-[10px] uppercase tracking-widest">{ROLE_LABELS[role]}</p>
                            <p className="text-text-primary text-xs font-bold capitalize">
                                {rank ? `${rank.division} ${rank.tier}` : "—"}
                            </p>
                        </div>
                    )
                })}
            </div>

            <p className="text-text-secondary text-[11px] mt-4">
                Rank Score uses your highest role, since there's no single "main" rank in Overwatch.
            </p>

            {/* Gamemode tabs — Blizzard's own data has no Open Queue vs Role Queue
                split for career stats, only Competitive vs Quickplay. */}
            <div className="flex gap-2 mt-5">
                {GAMEMODE_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setGamemode(tab.key)}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                            gamemode === tab.key
                                ? "border-accent/50 bg-accent-tint text-text-primary"
                                : "border-hairline bg-background text-text-secondary"
                        }`}
                        style={gamemode === tab.key ? { borderColor: `${accentColor}80`, backgroundColor: `${accentColor}1f` } : undefined}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {!activeStats ? (
                <p className="text-text-secondary text-sm mt-4">No {gamemode} stats found for this account.</p>
            ) : (
                <>
                    {/* Key stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                        {KEY_STATS.map((stat) => (
                            <div key={stat.key} className="bg-surface-deep rounded-lg p-3">
                                <p className="text-text-primary font-extrabold text-xl">{stat.format(stat.get(activeStats))}</p>
                                <p className="text-text-secondary text-xs">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {gamesPlayed != null && (
                        <p className="text-text-secondary text-xs mt-2.5">
                            {formatNumber(gamesPlayed)} games played
                            {winRate != null && <> · <span className="text-positive font-semibold">{winRate}% WR</span></>}
                        </p>
                    )}

                    {/* Top heroes by playtime */}
                    {activeStats.topHeroes?.length > 0 && (
                        <div className="mt-5">
                            <div className="flex items-center gap-2 mb-2.5">
                                <p className="text-text-muted text-[11px] uppercase tracking-widest">Top Heroes</p>
                                <div className="flex-1 h-px bg-hairline" />
                            </div>
                            <div className="flex flex-col gap-2">
                                {activeStats.topHeroes.map((hero) => (
                                    <div key={hero.key} className="bg-surface-deep rounded-lg p-2.5 flex items-center gap-3">
                                        {hero.portrait ? (
                                            <img src={hero.portrait} alt={hero.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-background flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-text-primary text-sm font-bold truncate">{hero.name}</p>
                                            <p className="text-text-secondary text-[11px]">
                                                {formatDuration(hero.timePlayed)} · {hero.gamesPlayed} games
                                                {hero.eliminations != null && <> · {formatNumber(hero.eliminations)} elims</>}
                                            </p>
                                        </div>
                                        {hero.winPercentage != null && (
                                            <p className="text-positive text-xs font-semibold flex-shrink-0">{hero.winPercentage}% WR</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Secondary stats */}
                    <div className="mt-5">
                        <div className="flex items-center gap-2 mb-2.5">
                            <p className="text-text-muted text-[11px] uppercase tracking-widest">More Stats</p>
                            <div className="flex-1 h-px bg-hairline" />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {SECONDARY_STATS.map((stat) => {
                                const value = stat.get(activeStats)
                                if (value == null) return null
                                return (
                                    <div key={stat.label} className="bg-surface-deep rounded-lg p-2.5">
                                        <p className="text-text-primary font-bold text-sm">
                                            {(stat.format ?? formatNumber)(value)}
                                        </p>
                                        <p className="text-text-secondary text-[11px]">{stat.label}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
