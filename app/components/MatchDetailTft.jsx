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

// Small composition icon row for the scoreboard — a lighter-weight cousin of
// TftHero's UnitIcon (no item docking) since 8 rows of full unit cards would
// be too dense for the expanded match detail.
function CompactUnitIcon({ unit }) {
    return (
        <div
            className="w-5 h-5 rounded overflow-hidden flex items-center justify-center text-[8px] font-bold text-text-secondary bg-surface border border-hairline flex-shrink-0"
            style={unit.tier > 1 ? { borderColor: unit.tier >= 3 ? "#facc15" : "#b16cff" } : undefined}
            title={unit.name}
        >
            {unit.icon ? (
                <img src={unit.icon} alt={unit.name} className="w-full h-full object-cover" />
            ) : (
                unit.name?.[0] ?? "?"
            )}
        </div>
    )
}

function ParticipantRow({ participant, isYou, accentColor }) {
    const sortedUnits = [...(participant.allUnits ?? [])].sort((a, b) => b.tier - a.tier).slice(0, 8)
    const displayName = participant.name
        ? `${participant.name}${participant.tag ? `#${participant.tag}` : ""}`
        : "Unknown player"

    return (
        <div className={`flex items-center gap-2 sm:gap-3 py-2 px-2 rounded-lg flex-wrap ${isYou ? "bg-accent-tint" : ""}`}>
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0 text-background"
                style={{ backgroundColor: placementColor(participant.placement) }}
            >
                {placementLabel(participant.placement)}
            </div>

            <div className="w-[110px] sm:w-[140px] flex-shrink-0 min-w-0">
                <p className={`text-[11px] sm:text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {displayName}
                </p>
                {participant.level != null && (
                    <p className="text-text-secondary text-[10px]">Level {participant.level}</p>
                )}
            </div>

            <div className="flex gap-1 flex-wrap flex-1 min-w-[140px]">
                {sortedUnits.length > 0 ? (
                    sortedUnits.map((unit, i) => <CompactUnitIcon key={i} unit={unit} />)
                ) : (
                    <span className="text-text-secondary text-[10px]">No composition data</span>
                )}
            </div>

            {participant.topTraits?.length > 0 && (
                <div className="flex gap-1 flex-shrink-0">
                    {participant.topTraits.slice(0, 3).map((trait, i) => (
                        <div
                            key={i}
                            className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-surface"
                            style={{ border: `1.5px solid ${accentColor}` }}
                            title={`${trait.name} (${trait.numUnits} units)`}
                        >
                            {trait.icon ? (
                                <img src={trait.icon} alt={trait.name} className="w-2.5 h-2.5 object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                            ) : (
                                <span className="text-[7px] font-bold text-text-primary">{trait.name?.[0]?.toUpperCase()}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="text-right flex-shrink-0 text-text-secondary text-[10px] hidden sm:block">
                {participant.playersEliminated != null && <p>{participant.playersEliminated} eliminated</p>}
                {participant.damageDealt != null && <p>{participant.damageDealt} dmg</p>}
            </div>
        </div>
    )
}

export default function MatchDetailTft({ match, yourPuuid, accentColor = "#0bc4e3" }) {
    if (!match.participants || match.participants.length === 0) {
        return <p className="text-text-secondary text-xs px-2 py-2">No detailed scoreboard available for this match.</p>
    }

    const sortedParticipants = [...match.participants].sort((a, b) => a.placement - b.placement)

    return (
        <div className="px-2 py-2 flex flex-col gap-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-text-secondary">Lobby</p>
            {sortedParticipants.map((participant) => (
                <ParticipantRow
                    key={participant.puuid}
                    participant={participant}
                    isYou={participant.puuid === yourPuuid}
                    accentColor={accentColor}
                />
            ))}
        </div>
    )
}
