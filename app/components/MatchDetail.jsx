"use client"

import { useRef, useState } from "react"

const TOOLTIP_WIDTH = 224 // w-56
const VIEWPORT_MARGIN = 8

function itemIconUrl(itemId, ddragonVersion) {
    return ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png` : null
}

function championIconUrl(championName, ddragonVersion) {
    return ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championName}.png` : null
}

// Data Dragon's item description is HTML (stats, line breaks, tooltips-within-tooltips).
// Strip it down to readable plain text for our simple hover card.
function stripItemDescription(html) {
    return html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
}

function ItemIcon({ itemId, ddragonVersion, itemData }) {
    const item = itemData?.[itemId]
    const wrapperRef = useRef(null)
    const [tooltipStyle, setTooltipStyle] = useState(null)

    const handleMouseEnter = () => {
        const rect = wrapperRef.current?.getBoundingClientRect()
        if (!rect) return

        const centeredLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
        const clampedLeft = Math.min(
            Math.max(centeredLeft, VIEWPORT_MARGIN),
            window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN
        )

        setTooltipStyle({ left: clampedLeft, bottom: window.innerHeight - rect.top + 6 })
    }

    return (
        <div ref={wrapperRef} className="relative group" onMouseEnter={handleMouseEnter}>
            <img
                src={itemIconUrl(itemId, ddragonVersion)}
                alt={item?.name ?? ""}
                className="w-5 h-5 rounded-[3px] bg-surface"
                onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
            />
            {item && tooltipStyle && (
                <div
                    style={{ left: tooltipStyle.left, bottom: tooltipStyle.bottom }}
                    className="hidden group-hover:block fixed z-50 w-56 bg-surface border border-line rounded-lg p-2.5 shadow-lg pointer-events-none"
                >
                    <p className="text-text-primary text-xs font-bold mb-1">{item.name}</p>
                    {item.gold?.total > 0 && (
                        <p className="text-accent-soft text-[10px] mb-1">{item.gold.total} gold</p>
                    )}
                    <p className="text-text-secondary text-[10px] whitespace-pre-line leading-snug">
                        {stripItemDescription(item.description)}
                    </p>
                </div>
            )}
        </div>
    )
}

function PlayerRow({ player, ddragonVersion, itemData, isYou }) {
    const kda = ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(1)

    return (
        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${isYou ? "bg-accent-tint" : ""}`}>
            <img
                src={championIconUrl(player.champion, ddragonVersion)}
                alt={player.champion}
                className="w-7 h-7 rounded-md object-cover bg-surface flex-shrink-0"
                onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
            />
            <div className="w-[120px] flex-shrink-0 min-w-0">
                <p className={`text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {player.summonerName}{player.summonerTag ? `#${player.summonerTag}` : ""}
                </p>
                <p className="text-text-secondary text-[10px] truncate">{player.champion}</p>
            </div>
            <div className="w-[80px] flex-shrink-0 font-mono text-xs text-text-primary">
                {player.kills}/{player.deaths}/{player.assists}
                <span className="text-text-secondary text-[10px] block">{kda} KDA</span>
            </div>
            <div className="w-[50px] flex-shrink-0 text-text-secondary text-xs">{player.cs} CS</div>
            <div className="flex gap-0.5 flex-wrap flex-1 justify-end">
                {player.items.map((itemId, i) => (
                    <ItemIcon key={i} itemId={itemId} ddragonVersion={ddragonVersion} itemData={itemData} />
                ))}
            </div>
        </div>
    )
}

export default function MatchDetail({ match, ddragonVersion, yourPuuid, itemData }) {
    if (!match.players || match.players.length === 0) {
        return <p className="text-text-secondary text-xs px-2 py-2">No detailed scoreboard available for this match.</p>
    }

    const teamA = match.players.filter(p => p.teamId === match.players[0].teamId)
    const teamB = match.players.filter(p => p.teamId !== match.players[0].teamId)

    return (
        <div className="px-2 py-2 flex flex-col gap-3">
            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${teamA[0].win ? "text-positive" : "text-negative"}`}>
                    {teamA[0].win ? "Victory" : "Defeat"}
                </p>
                <div className="flex flex-col gap-0.5">
                    {teamA.map(player => (
                        <PlayerRow key={player.puuid} player={player} ddragonVersion={ddragonVersion} itemData={itemData} isYou={player.puuid === yourPuuid} />
                    ))}
                </div>
            </div>
            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${teamB[0].win ? "text-positive" : "text-negative"}`}>
                    {teamB[0].win ? "Victory" : "Defeat"}
                </p>
                <div className="flex flex-col gap-0.5">
                    {teamB.map(player => (
                        <PlayerRow key={player.puuid} player={player} ddragonVersion={ddragonVersion} itemData={itemData} isYou={player.puuid === yourPuuid} />
                    ))}
                </div>
            </div>
        </div>
    )
}
