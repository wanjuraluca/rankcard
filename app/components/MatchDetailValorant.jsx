function PlayerRow({ player, isYou }) {
    const kda = ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(1)

    return (
        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${isYou ? "bg-accent-tint" : ""}`}>
            {player.agentIcon ? (
                <img
                    src={player.agentIcon}
                    alt={player.agent}
                    className="w-7 h-7 rounded-md object-cover bg-surface flex-shrink-0"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                />
            ) : (
                <div className="w-7 h-7 rounded-md bg-surface flex-shrink-0" />
            )}
            <div className="w-[120px] flex-shrink-0 min-w-0">
                <p className={`text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {player.name}{player.tag ? `#${player.tag}` : ""}
                </p>
                <p className="text-text-secondary text-[10px] truncate">{player.agent}</p>
            </div>
            <div className="w-[80px] flex-shrink-0 font-mono text-xs text-text-primary">
                {player.kills}/{player.deaths}/{player.assists}
                <span className="text-text-secondary text-[10px] block">{kda} KDA</span>
            </div>
            <div className="flex-1 text-right text-text-secondary text-xs">{player.score} score</div>
        </div>
    )
}

export default function MatchDetailValorant({ match, yourPuuid }) {
    if (!match.players || match.players.length === 0) {
        return <p className="text-text-secondary text-xs px-2 py-2">No detailed scoreboard available for this match.</p>
    }

    const distinctTeams = new Set(match.players.map(p => p.team))
    // Free-for-all modes (Deathmatch etc.) give every player their own
    // "team" (their own puuid) since there's no real team split — Henrik
    // has no separate flag for this, so we infer it: if every player is on
    // a different team, it's FFA and we show one sorted list instead of
    // a two-team breakdown (which would otherwise print a raw puuid as a
    // "team name").
    const isFreeForAll = distinctTeams.size === match.players.length

    const groups = isFreeForAll
        ? [match.players]
        : [
            match.players.filter(p => p.team === match.players[0].team),
            match.players.filter(p => p.team !== match.players[0].team)
        ]

    return (
        <div className="px-2 py-2 flex flex-col gap-3">
            {groups.map((team, i) => (
                <div key={i}>
                    {!isFreeForAll && (
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-text-secondary">
                            {/^[a-z]+$/i.test(team[0]?.team) ? team[0].team : `Team ${i + 1}`}
                        </p>
                    )}
                    <div className="flex flex-col gap-0.5">
                        {team
                            .slice()
                            .sort((a, b) => b.score - a.score)
                            .map(player => (
                                <PlayerRow key={player.puuid} player={player} isYou={player.puuid === yourPuuid} />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
