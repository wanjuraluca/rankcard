import MarvelRankIcon from "./MarvelRankIcon"

const CDN = "https://marvelrivalsapi.com/rivals"

// Fixed grid so every row's stats line up under a header — matches tracker.gg's
// scoreboard layout more closely than a single wrapping line of stat chips did.
const GRID_COLS = "minmax(120px,2fr) 34px 70px 56px 48px 60px 64px 64px 64px 56px"

const COLUMNS = [
    { label: "Rank", key: "rank" },
    { label: "K / D / A", key: "kda" },
    { label: "KDA", key: "kdaRatio" },
    { label: "Solo", key: "soloKills" },
    { label: "Final Hits", key: "finalHits" },
    { label: "Damage", key: "damage" },
    { label: "Taken", key: "damageTaken" },
    { label: "Healing", key: "healing" },
    { label: "Acc.", key: "accuracy" },
]

function HeaderRow() {
    return (
        <div
            className="grid items-center gap-2 px-2 py-1.5 text-text-muted text-[9px] uppercase tracking-widest"
            style={{ gridTemplateColumns: GRID_COLS }}
        >
            <span>Player</span>
            {COLUMNS.map(col => (
                <span key={col.key} className="text-right">{col.label}</span>
            ))}
        </div>
    )
}

// Marvel Rivals' match endpoint gives each player's raw rank_score, not a
// tier name — `player.rank` is derived from it server-side (see
// estimateMarvelRivalsRankFromScore in lib/rankScore.js) using the game's
// own wiki rule (100 pts/division, 3 divisions/tier, Bronze-Celestial).
// Anything at or above the Celestial cap shows as "Eternity" since Eternity
// and One Above All can't be told apart by score alone.
function PlayerRow({ player, isYou }) {
    const kda = ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(1)

    return (
        <div
            className={`grid items-center gap-2 px-2 py-1.5 rounded-lg ${isYou ? "bg-accent-tint" : ""}`}
            style={{ gridTemplateColumns: GRID_COLS }}
        >
            <div className="flex items-center gap-2 min-w-0">
                {player.heroIcon ? (
                    <img
                        src={`${CDN}${player.heroIcon}`}
                        alt=""
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover bg-surface flex-shrink-0"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                    />
                ) : (
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-surface flex-shrink-0" />
                )}
                <p className={`text-[11px] sm:text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {player.name}
                </p>
            </div>
            <div className="flex justify-end">
                <MarvelRankIcon rank={player.rank} size={22} />
            </div>
            <span className="text-right font-mono text-[11px] text-text-primary">{player.kills}/{player.deaths}/{player.assists}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{kda}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.soloKills}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.finalHits}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.damage.toLocaleString()}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.damageTaken.toLocaleString()}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.healing > 0 ? player.healing.toLocaleString() : "—"}</span>
            <span className="text-right font-mono text-[11px] text-text-secondary">{player.accuracy != null ? `${player.accuracy}%` : "—"}</span>
        </div>
    )
}

// Marvel Rivals has no bundled match-history endpoint with all players —
// this data is fetched separately and lazily (see MarvelRivalsHero and
// the `matchId` branch of app/api/summoner) only when a match is expanded.
export default function MatchDetailMarvelRivals({ detail, yourUid }) {
    if (!detail?.players || detail.players.length === 0) {
        return <p className="text-text-secondary text-xs px-2 py-2">No detailed scoreboard available for this match.</p>
    }

    const teamA = detail.players.filter(p => p.side === detail.players[0].side)
    const teamB = detail.players.filter(p => p.side !== detail.players[0].side)

    return (
        <div className="px-1 py-2 overflow-x-auto">
            <div className="min-w-[560px] flex flex-col gap-3">
                {[teamA, teamB].map((team, i) => (
                    <div key={i}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 px-2 text-text-secondary">
                            Team {i + 1}
                        </p>
                        <HeaderRow />
                        <div className="flex flex-col gap-0.5">
                            {team
                                .slice()
                                .sort((a, b) => b.kills - a.kills)
                                .map(player => (
                                    <PlayerRow key={player.uid} player={player} isYou={String(player.uid) === String(yourUid)} />
                                ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
