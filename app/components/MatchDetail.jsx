"use client"

import { useEffect, useRef, useState } from "react"

const TOOLTIP_WIDTH = 224 // w-56
const VIEWPORT_MARGIN = 8

function itemIconUrl(itemId, ddragonVersion) {
    return ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/item/${itemId}.png` : null
}

function championIconUrl(championName, ddragonVersion) {
    return ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championName}.png` : null
}

function rankEmblemUrl(tier) {
    return tier
        ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`
        : null
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
                    className="hidden group-hover:block fixed z-50 w-56 bg-surface border border-hairline rounded-lg p-2.5 shadow-lg pointer-events-none"
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

// Small rank emblem next to each scoreboard row. Shows nothing until the
// on-demand rank lookup (see MatchDetail below) finishes, and nothing at all
// for unranked/unresolvable players — no broken image, no placeholder icon.
function RankEmblem({ rankLookupState, rank }) {
    if (rankLookupState === "loading") {
        return <span className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 rounded-full border border-hairline border-t-accent-soft animate-spin" />
    }
    const url = rankEmblemUrl(rank?.tier)
    if (!url) return <span className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0" />

    return (
        <img
            src={url}
            alt={rank.tier}
            title={`${rank.tier} ${rank.rank ?? ""} · ${rank.leaguePoints} LP`.trim()}
            className="w-7 h-7 sm:w-9 sm:h-9 flex-shrink-0 object-contain"
            onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
        />
    )
}

function SummonerSpellIcons({ summonerSpells, summonerSpellIconById }) {
    const icons = (summonerSpells ?? []).filter(id => id != null && summonerSpellIconById?.[id])
    if (icons.length === 0) return null

    return (
        <div className="flex flex-col gap-0.5 flex-shrink-0">
            {icons.map((id, i) => (
                <img
                    key={i}
                    src={summonerSpellIconById[id]}
                    alt="Summoner spell"
                    className="w-3.5 h-3.5 rounded-[3px]"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            ))}
        </div>
    )
}

function RuneIcons({ primaryRuneId, subRuneStyleId, runeIconById, runeStyleIconById }) {
    const primaryIcon = primaryRuneId != null ? runeIconById?.[primaryRuneId] : null
    const subIcon = subRuneStyleId != null ? runeStyleIconById?.[subRuneStyleId] : null
    if (!primaryIcon && !subIcon) return null

    return (
        <div className="flex flex-col gap-0.5 items-center flex-shrink-0">
            {primaryIcon && (
                <img
                    src={primaryIcon}
                    alt="Keystone"
                    className="w-4 h-4 rounded-full bg-surface"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            )}
            {subIcon && (
                <img
                    src={subIcon}
                    alt="Rune tree"
                    className="w-3 h-3 rounded-full bg-surface opacity-80"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            )}
        </div>
    )
}

function PlayerRow({
    player,
    ddragonVersion,
    itemData,
    isYou,
    summonerSpellIconById,
    runeIconById,
    runeStyleIconById,
    rankLookupState,
    rank,
    maxDamage
}) {
    const kda = ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(1)
    const damagePct = maxDamage > 0 ? Math.round((player.damageDealt / maxDamage) * 100) : 0

    return (
        <div className={`flex items-center gap-1.5 sm:gap-2 py-1.5 px-2 rounded-lg ${isYou ? "bg-accent-tint" : ""}`}>
            <RankEmblem rankLookupState={rankLookupState} rank={rank} />

            <div className="relative flex-shrink-0">
                <img
                    src={championIconUrl(player.champion, ddragonVersion)}
                    alt={player.champion}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover bg-surface"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                />
                {player.champLevel != null && (
                    <span className="absolute -bottom-1 -right-1 bg-surface border border-hairline rounded-full text-text-primary text-[8px] leading-none px-[3px] py-[2px] font-bold">
                        {player.champLevel}
                    </span>
                )}
            </div>

            <SummonerSpellIcons summonerSpells={player.summonerSpells} summonerSpellIconById={summonerSpellIconById} />
            <RuneIcons
                primaryRuneId={player.primaryRuneId}
                subRuneStyleId={player.subRuneStyleId}
                runeIconById={runeIconById}
                runeStyleIconById={runeStyleIconById}
            />

            <div className="w-[70px] sm:w-[110px] flex-shrink-0 min-w-0">
                <p className={`text-[11px] sm:text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {player.summonerName}{player.summonerTag ? `#${player.summonerTag}` : ""}
                </p>
                <p className="text-text-secondary text-[10px] truncate">{player.champion}</p>
            </div>

            <div className="w-[50px] sm:w-[70px] flex-shrink-0 font-mono text-[11px] sm:text-xs text-text-primary">
                {player.kills}/{player.deaths}/{player.assists}
                <span className="text-text-secondary text-[10px] block">{kda} KDA</span>
            </div>

            <div className="w-[60px] sm:w-[90px] flex-shrink-0">
                <span className="text-text-primary text-[10px] sm:text-xs font-mono">{player.damageDealt?.toLocaleString("en-US")}</span>
                <div className="h-1 bg-hairline rounded-full mt-0.5 overflow-hidden">
                    <div
                        className="h-1 rounded-full bg-negative/70"
                        style={{ width: `${damagePct}%` }}
                    />
                </div>
            </div>

            <div className="w-[42px] sm:w-[55px] flex-shrink-0 text-text-secondary text-[10px] sm:text-xs hidden sm:block">
                {player.goldEarned != null ? `${(player.goldEarned / 1000).toFixed(1)}k` : "—"}
            </div>

            <div className="w-[36px] sm:w-[46px] flex-shrink-0 text-text-secondary text-[10px] sm:text-xs hidden sm:block">{player.cs} CS</div>

            <div className="w-[52px] sm:w-[68px] flex-shrink-0 text-text-secondary text-[10px] sm:text-xs hidden md:block" title="Vision score">
                {player.visionScore != null ? `${player.visionScore} vision` : "—"}
            </div>

            <div className="hidden sm:flex gap-0.5 flex-wrap flex-1 justify-end">
                {(player.items ?? []).map((itemId, i) => (
                    <ItemIcon key={i} itemId={itemId} ddragonVersion={ddragonVersion} itemData={itemData} />
                ))}
            </div>

            {player.impactScore != null && (
                <span
                    className="text-[10px] sm:text-xs font-bold text-accent-soft bg-accent-tint rounded-lg px-1.5 py-0.5 flex-shrink-0 ml-1"
                    title="Impact: our own performance estimate (not an official Riot stat): 40% kill participation, 40% team damage share, 20% gold-per-minute rank"
                >
                    <span className="text-[9px] sm:text-[10px] font-semibold text-text-secondary mr-1">Impact</span>
                    {player.impactScore}
                </span>
            )}
        </div>
    )
}

function ordinal(n) {
    const s = ["th", "st", "nd", "rd"]
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Arena (CHERRY) row — no lanes, CS, vision, runes or Solo/Duo rank apply, so
// it's a stripped-down row: champion, name, KDA and damage only.
function ArenaPlayerRow({ player, ddragonVersion, isYou, maxDamage }) {
    const kda = ((player.kills + player.assists) / Math.max(player.deaths, 1)).toFixed(1)
    const damagePct = maxDamage > 0 ? Math.round((player.damageDealt / maxDamage) * 100) : 0

    return (
        <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${isYou ? "bg-accent-tint" : ""}`}>
            <div className="relative flex-shrink-0">
                <img
                    src={championIconUrl(player.champion, ddragonVersion)}
                    alt={player.champion}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover bg-surface"
                    onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                />
                {player.champLevel != null && (
                    <span className="absolute -bottom-1 -right-1 bg-surface border border-hairline rounded-full text-text-primary text-[8px] leading-none px-[3px] py-[2px] font-bold">
                        {player.champLevel}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className={`text-[11px] sm:text-xs font-bold truncate ${isYou ? "text-accent-soft" : "text-text-primary"}`}>
                    {player.summonerName}{player.summonerTag ? `#${player.summonerTag}` : ""}
                </p>
                <p className="text-text-secondary text-[10px] truncate">{player.champion}</p>
            </div>

            <div className="w-[64px] sm:w-[80px] flex-shrink-0 font-mono text-[11px] sm:text-xs text-text-primary">
                {player.kills}/{player.deaths}/{player.assists}
                <span className="text-text-secondary text-[10px] block">{kda} KDA</span>
            </div>

            <div className="w-[70px] sm:w-[90px] flex-shrink-0">
                <span className="text-text-primary text-[10px] sm:text-xs font-mono">{player.damageDealt?.toLocaleString("en-US")}</span>
                <div className="h-1 bg-hairline rounded-full mt-0.5 overflow-hidden">
                    <div className="h-1 rounded-full bg-negative/70" style={{ width: `${damagePct}%` }} />
                </div>
            </div>
        </div>
    )
}

export default function MatchDetail({
    match,
    ddragonVersion,
    yourPuuid,
    itemData,
    summonerSpellIconById,
    runeIconById,
    runeStyleIconById
}) {
    const [ranksByPuuid, setRanksByPuuid] = useState({})
    const [ranksLoaded, setRanksLoaded] = useState(false)

    // Fires once per mount — MatchDetail is only ever rendered while its
    // match card is expanded (see RankHero.jsx's isExpanded && <MatchDetail />),
    // so mounting IS "the user expanded this match". Deliberately not fetched
    // upfront for every card in the list — 10 Riot calls per match adds up
    // fast across a whole match-history list.
    useEffect(() => {
        let cancelled = false
        const puuids = (match.players ?? []).map(p => p.puuid).filter(Boolean)

        async function fetchRanks() {
            // Arena groups by placement, not rank — skip the (batched but still
            // costly for 18 players) Solo/Duo rank lookup entirely.
            if (match.gameMode === 'CHERRY' || puuids.length === 0) {
                if (!cancelled) setRanksLoaded(true)
                return
            }
            try {
                const response = await fetch('/api/match/player-ranks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ puuids })
                })
                const data = await response.json()
                if (cancelled) return
                setRanksByPuuid(data?.ranks ?? {})
            } catch {
                if (!cancelled) setRanksByPuuid({})
            } finally {
                if (!cancelled) setRanksLoaded(true)
            }
        }

        fetchRanks()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!match.players || match.players.length === 0) {
        return <p className="text-text-secondary text-xs px-2 py-2">No detailed scoreboard available for this match.</p>
    }

    // Arena (CHERRY): teamId is only 100/200, so the standard two-team split is
    // meaningless here — group by subteam and order by final placement instead.
    if (match.gameMode === "CHERRY") {
        const bySubteam = {}
        for (const p of match.players) {
            const key = p.subteamId ?? "?"
            ;(bySubteam[key] ??= []).push(p)
        }
        const teams = Object.values(bySubteam)
            .map(members => ({ members, placement: Math.min(...members.map(m => m.placement ?? 99)) }))
            .sort((a, b) => a.placement - b.placement)
        const arenaMaxDamage = Math.max(...match.players.map(p => p.damageDealt ?? 0), 1)

        return (
            <div className="px-2 py-2 flex flex-col gap-2.5">
                {teams.map(team => (
                    <div key={`${team.placement}-${team.members[0].puuid}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${team.placement === 1 ? "text-positive" : "text-text-secondary"}`}>
                            {team.placement <= 6 ? `${ordinal(team.placement)} place` : "Placement N/A"}
                        </p>
                        <div className="flex flex-col gap-0.5">
                            {team.members.map(player => (
                                <ArenaPlayerRow
                                    key={player.puuid}
                                    player={player}
                                    ddragonVersion={ddragonVersion}
                                    isYou={player.puuid === yourPuuid}
                                    maxDamage={arenaMaxDamage}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                <p className="text-text-secondary text-[9px] sm:text-[10px] leading-relaxed border-t border-hairline pt-2">
                    Arena: teams of {teams[0]?.members.length ?? 3}, ranked by final placement ·{" "}
                    <span className="font-semibold">KDA</span> kills/deaths/assists ·{" "}
                    <span className="font-semibold">DMG</span> damage to champions
                </p>
            </div>
        )
    }

    const teamA = match.players.filter(p => p.teamId === match.players[0].teamId)
    const teamB = match.players.filter(p => p.teamId !== match.players[0].teamId)
    const maxDamage = Math.max(...match.players.map(p => p.damageDealt ?? 0), 1)

    function renderTeam(team) {
        return team.map(player => (
            <PlayerRow
                key={player.puuid}
                player={player}
                ddragonVersion={ddragonVersion}
                itemData={itemData}
                isYou={player.puuid === yourPuuid}
                summonerSpellIconById={summonerSpellIconById}
                runeIconById={runeIconById}
                runeStyleIconById={runeStyleIconById}
                rankLookupState={ranksLoaded ? "done" : "loading"}
                rank={ranksByPuuid[player.puuid] ?? null}
                maxDamage={maxDamage}
            />
        ))
    }

    return (
        <div className="px-2 py-2 flex flex-col gap-3">
            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${teamA[0].win ? "text-positive" : "text-negative"}`}>
                    {teamA[0].win ? "Victory" : "Defeat"}
                </p>
                <div className="flex flex-col gap-0.5">
                    {renderTeam(teamA)}
                </div>
            </div>
            <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${teamB[0].win ? "text-positive" : "text-negative"}`}>
                    {teamB[0].win ? "Victory" : "Defeat"}
                </p>
                <div className="flex flex-col gap-0.5">
                    {renderTeam(teamB)}
                </div>
            </div>

            {/* Column key — the scoreboard is dense and several values (vision
                score, our Impact estimate) aren't self-explanatory. */}
            <p className="text-text-secondary text-[9px] sm:text-[10px] leading-relaxed border-t border-hairline pt-2">
                <span className="font-semibold">KDA</span> kills/deaths/assists ·{" "}
                <span className="font-semibold">DMG</span> damage to champions ·{" "}
                <span className="font-semibold">CS</span> creep score ·{" "}
                <span className="font-semibold">Vision</span> vision score ·{" "}
                <span className="font-semibold text-accent-soft">Impact</span> our own performance estimate (kill participation, damage &amp; gold share)
            </p>
        </div>
    )
}
