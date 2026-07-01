"use client"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import LpHistoryChart from "./LpHistoryChart"
import MatchDetail from "./MatchDetail"

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

// value = Riot's numeric queue ID (queues.json), passed straight through to
// the match-ids endpoint's `queue` filter.
//
// Arena isn't a permanent queue — Riot brings it back for limited rotations
// and has reused a *different* queueId each time (1700, 1710, ... 1750 as of
// the current rotation). The filter option below only targets the latest
// known ID, so it may need bumping again next time Arena returns. Card
// labels (modeLabel below) recognize the whole known family so old match
// history still displays correctly even if this drifts.
const MODE_OPTIONS = [
    { value: '', label: 'All Modes' },
    { value: '420', label: 'Ranked Solo/Duo' },
    { value: '440', label: 'Ranked Flex' },
    { value: '400', label: 'Normal Draft' },
    { value: '450', label: 'ARAM' },
    { value: '700', label: 'Clash' },
    { value: '1750', label: 'Arena' },
]

// All Arena queueIds seen across rotations, for display-label matching only
// (not used for the server-side filter, which needs one exact ID).
const ARENA_QUEUE_IDS = ['1700', '1710', '1720', '1730', '1740', '1750']

// Full queueId -> display name map for the match card. Broader than MODE_OPTIONS
// (which is just the curated filter list) so rotating/limited modes still get a
// proper label instead of showing nothing.
const QUEUE_LABELS = {
    '400': 'Normal Draft',
    '420': 'Ranked Solo/Duo',
    '430': 'Normal Blind',
    '440': 'Ranked Flex',
    '450': 'ARAM',
    '480': 'Swiftplay',
    '490': 'Quickplay',
    '700': 'Clash',
    '720': 'ARAM Clash',
    '830': 'Co-op vs. AI',
    '840': 'Co-op vs. AI',
    '850': 'Co-op vs. AI',
    '870': 'Co-op vs. AI',
    '880': 'Co-op vs. AI',
    '890': 'Co-op vs. AI',
    '900': 'ARURF',
    '1010': 'Snow ARURF',
    '1020': 'One for All',
    '1300': 'Nexus Blitz',
    '1400': 'Ultimate Spellbook',
    '1900': 'URF',
    '2020': 'Tutorial',
}

// Fallback by Riot's info.gameMode string, so even a queueId we don't have
// mapped yet (a brand-new rotation) still gets a readable name.
const GAME_MODE_LABELS = {
    CLASSIC: 'Normal',
    ARAM: 'ARAM',
    URF: 'URF',
    CHERRY: 'Arena',
    NEXUSBLITZ: 'Nexus Blitz',
    ULTBOOK: 'Ultimate Spellbook',
    ONEFORALL: 'One for All',
    PRACTICETOOL: 'Practice Tool',
    TUTORIAL: 'Tutorial',
    DOOMBOTSTEEMO: 'Doom Bots',
}

function modeLabel(queueId, gameMode) {
    if (ARENA_QUEUE_IDS.includes(String(queueId))) return 'Arena'
    const byQueue = QUEUE_LABELS[String(queueId)]
    if (byQueue) return byQueue
    if (gameMode) {
        // Humanize an unmapped gameMode (e.g. "STARGUARDIAN" -> "Starguardian")
        return GAME_MODE_LABELS[gameMode]
            ?? gameMode.charAt(0).toUpperCase() + gameMode.slice(1).toLowerCase()
    }
    return null
}

// Riot's teamPosition uses internal names (UTILITY = the support role). Map
// them to the names players actually use — same labels as the LFG role filter.
const ROLE_LABELS = {
    TOP: 'Top',
    JUNGLE: 'Jungle',
    MIDDLE: 'Mid',
    BOTTOM: 'ADC',
    UTILITY: 'Support',
}

// Small, self-contained icon pair used both on the collapsed match card and
// (via the same lookup maps) inside MatchDetail's scoreboard rows. Renders
// nothing for a spell/rune it can't resolve instead of a broken <img>.
function SummonerSpellIcons({ summonerSpells, summonerSpellIconById }) {
    const icons = (summonerSpells ?? []).filter(id => id != null && summonerSpellIconById[id])
    if (icons.length === 0) return null

    return (
        <div className="flex flex-col gap-0.5">
            {icons.map((id, i) => (
                <img
                    key={i}
                    src={summonerSpellIconById[id]}
                    alt="Summoner spell"
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px]"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            ))}
        </div>
    )
}

function RuneIcons({ primaryRuneId, subRuneStyleId, runeIconById, runeStyleIconById }) {
    const primaryIcon = primaryRuneId != null ? runeIconById[primaryRuneId] : null
    const subIcon = subRuneStyleId != null ? runeStyleIconById[subRuneStyleId] : null
    if (!primaryIcon && !subIcon) return null

    return (
        <div className="flex flex-col gap-0.5 items-center">
            {primaryIcon && (
                <img
                    src={primaryIcon}
                    alt="Keystone"
                    className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full bg-surface"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            )}
            {subIcon && (
                <img
                    src={subIcon}
                    alt="Rune tree"
                    className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-surface opacity-80"
                    onError={(e) => { e.currentTarget.style.display = "none" }}
                />
            )}
        </div>
    )
}

function buildTopChampions(matchHistory) {
    const byChampion = {}
    for (const match of matchHistory) {
        if (!byChampion[match.champion]) byChampion[match.champion] = []
        byChampion[match.champion].push(match)
    }
    return Object.entries(byChampion)
        .map(([champion, matches]) => {
            const wins = matches.filter(m => m.win).length
            const kda = average(matches.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
            return {
                champion,
                games: matches.length,
                winRate: Math.round((wins / matches.length) * 100),
                kda: kda.toFixed(1)
            }
        })
        .sort((a, b) => b.games - a.games)
        .slice(0, 3)
}

export default function RankHero({ account, accentColor = "#b16cff" }) {

    const [rankEntry, setRankEntry] = useState(null)
    const [matchHistory, setMatchHistory] = useState([])
    const [ddragonVersion, setDdragonVersion] = useState(null)
    const [yourPuuid, setYourPuuid] = useState(null)
    const [expandedMatchId, setExpandedMatchId] = useState(null)
    const [itemData, setItemData] = useState(null)
    const [summonerSpellIconById, setSummonerSpellIconById] = useState({})
    const [runeIconById, setRuneIconById] = useState({})
    const [runeStyleIconById, setRuneStyleIconById] = useState({})
    const [loading, setLoading] = useState(true)
    const [modeFilter, setModeFilter] = useState('')
    const [modeMenuOpen, setModeMenuOpen] = useState(false)
    const [matchesLoading, setMatchesLoading] = useState(false)
    const scrollYBeforeToggle = useRef(null)

    function toggleMatch(matchId) {
        scrollYBeforeToggle.current = window.scrollY
        setExpandedMatchId(prev => (prev === matchId ? null : matchId))
    }

    // Expanding/collapsing a match row can shift layout enough that the
    // browser auto-scrolls (focus handling, scroll anchoring) — pin the
    // scroll position back to where it was right before the click so the
    // row just unfolds in place instead of the page jumping around.
    useLayoutEffect(() => {
        if (scrollYBeforeToggle.current !== null) {
            window.scrollTo(0, scrollYBeforeToggle.current)
            scrollYBeforeToggle.current = null
        }
    }, [expandedMatchId])

    useEffect(() => {
        // Switching filters fast enough can let an older, slower response
        // resolve after a newer one — this flag makes a stale response a
        // no-op instead of clobbering the state with the wrong mode's data.
        let cancelled = false

        async function fetchRank() {
            const modeQuery = modeFilter ? `&mode=${modeFilter}` : ''
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}${modeQuery}`);
            const data = await response.json();
            if (cancelled) return
            // Guard with Array.isArray: on a Riot error (rate limit / bad key)
            // rankData is an error object, not an array — .find would throw and
            // leave the hero stuck on "Loading rank...".
            const entry = Array.isArray(data.rankData) ? data.rankData.find((queue) => queue.queueType === "RANKED_SOLO_5x5") : null;
            setRankEntry(entry ?? null)
            setMatchHistory(data.matchHistory ?? [])
            setDdragonVersion(data.ddragonVersion ?? null)
            setYourPuuid(data.puuid ?? null)
            setLoading(false)
            setMatchesLoading(false)
        }

        fetchRank();
        return () => { cancelled = true }
    }, [modeFilter])

    function selectMode(value) {
        setModeFilter(value)
        setModeMenuOpen(false)
        setMatchesLoading(true)
    }

    useEffect(() => {
        if (!ddragonVersion) return
        async function fetchItemData() {
            const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/item.json`)
            const json = await response.json()
            setItemData(json.data ?? null)
        }
        fetchItemData()
    }, [ddragonVersion])

    // Same pattern as fetchItemData above: fire once the ddragon version is
    // known, build a lookup map keyed by the numeric IDs Riot's match API
    // returns (summoner1Id/summoner2Id, perk IDs), so cards/scoreboard rows
    // can resolve an icon URL with a plain object lookup.
    useEffect(() => {
        if (!ddragonVersion) return

        async function fetchSummonerSpellData() {
            try {
                const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/summoner.json`)
                const json = await response.json()
                const byId = {}
                for (const spell of Object.values(json.data ?? {})) {
                    if (spell?.key && spell?.image?.full) {
                        byId[spell.key] = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/spell/${spell.image.full}`
                    }
                }
                setSummonerSpellIconById(byId)
            } catch {
                // Missing spell icons should never break the match cards — they
                // just render without spell icons.
                setSummonerSpellIconById({})
            }
        }

        async function fetchRuneData() {
            try {
                const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/data/en_US/runesReforged.json`)
                const trees = await response.json()
                const runeById = {}
                const styleById = {}
                for (const tree of Array.isArray(trees) ? trees : []) {
                    if (tree?.id && tree?.icon) {
                        styleById[tree.id] = `https://ddragon.leagueoflegends.com/cdn/img/${tree.icon}`
                    }
                    for (const slot of tree?.slots ?? []) {
                        for (const rune of slot?.runes ?? []) {
                            if (rune?.id && rune?.icon) {
                                runeById[rune.id] = `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
                            }
                        }
                    }
                }
                setRuneIconById(runeById)
                setRuneStyleIconById(styleById)
            } catch {
                setRuneIconById({})
                setRuneStyleIconById({})
            }
        }

        fetchSummonerSpellData()
        fetchRuneData()
    }, [ddragonVersion])

    if (loading) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6">
                <p className="text-text-secondary text-sm">Loading rank...</p>
            </div>
        );
    }

    if (!rankEntry) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6 text-center">
                <p className="text-text-secondary text-sm">No ranked Solo/Duo games found yet.</p>
            </div>
        );
    }

    const winRate = Math.round((rankEntry.wins / (rankEntry.wins + rankEntry.losses)) * 100) || 0;
    const totalGames = rankEntry.wins + rankEntry.losses;

    const avgKda = average(matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1)))
    const avgCsPerMin = average(matchHistory.map(m => m.cs / (m.gameDurationSeconds / 60)))
    const avgVision = average(matchHistory.map(m => m.visionScore))
    const avgKillParticipation = average(matchHistory.map(m => m.killParticipationPct).filter(v => v != null))
    const avgDamage = average(matchHistory.map(m => m.damageDealt))
    const topChampions = buildTopChampions(matchHistory)

    function championIconUrl(championName) {
        return ddragonVersion ? `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${championName}.png` : null
    }

    return (
        <div
            className="bg-surface border border-line rounded-2xl p-4 sm:p-5 relative"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            <div className="flex gap-3 sm:gap-5 items-center flex-wrap">

                {/* Rank emblem */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden">
                    <img
                        src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${rankEntry.tier.toLowerCase()}.png`}
                        alt={rankEntry.tier}
                        className="w-full h-full object-contain scale-450 translate-y-2"
                    />
                </div>

                {/* Rank info */}
                <div className="flex-1 min-w-[180px]">
                    <p className="text-text-primary font-extrabold text-2xl">
                        {rankEntry.tier} {rankEntry.rank}
                    </p>
                    <p className="text-text-secondary text-sm mt-1">
                        {rankEntry.leaguePoints} LP · Solo/Duo
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
                    <p className="text-text-primary font-extrabold text-xl">{avgCsPerMin ? avgCsPerMin.toFixed(1) : "—"}</p>
                    <p className="text-text-secondary text-xs">CS / min</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgVision ? Math.round(avgVision) : "—"}</p>
                    <p className="text-text-secondary text-xs">Vision / game</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgKillParticipation ? `${Math.round(avgKillParticipation)}%` : "—"}</p>
                    <p className="text-text-secondary text-xs">Kill part.</p>
                </div>
                <div className="bg-surface-deep rounded-xl p-3">
                    <p className="text-text-primary font-extrabold text-xl">{avgDamage ? `${(avgDamage / 1000).toFixed(1)}k` : "—"}</p>
                    <p className="text-text-secondary text-xs">Avg. dmg</p>
                </div>
            </div>

            {/* Top Champions + LP graph */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">Top Champions</p>
                    <div className="flex flex-col gap-2.5">
                        {topChampions.length === 0 && (
                            <p className="text-text-secondary text-sm">No recent ranked games yet.</p>
                        )}
                        {topChampions.map((champ) => (
                            <div key={champ.champion} className="flex items-center gap-2.5">
                                {championIconUrl(champ.champion) && (
                                    <img
                                        src={championIconUrl(champ.champion)}
                                        alt={champ.champion}
                                        className="w-9 h-9 rounded-md object-cover bg-surface flex-shrink-0"
                                        onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-[13px] font-bold truncate">{champ.champion}</p>
                                    <p className="text-text-secondary text-[10px]">{champ.kda} KDA · {champ.games} games</p>
                                </div>
                                <p className="text-positive text-[13px] font-bold flex-shrink-0">{champ.winRate}%</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-surface-deep rounded-xl p-4">
                    <p className="text-text-secondary text-[11px] uppercase tracking-widest mb-3">LP History</p>
                    <LpHistoryChart
                        accountId={account.id}
                        matchHistory={matchHistory}
                        currentLeaguePoints={rankEntry.leaguePoints}
                        accentColor={accentColor}
                        ddragonVersion={ddragonVersion}
                        puuid={yourPuuid}
                        tier={rankEntry.tier}
                        rank={rankEntry.rank}
                    />
                </div>
            </div>

            {/* Match history */}
            <div className="mt-5">
                <div className="flex items-center gap-2 mb-2.5">
                    <p className="text-text-secondary text-xs uppercase tracking-widest">Match History</p>
                    <div className="flex-1 h-px bg-hairline" />
                    <div className="relative">
                        <button
                            onClick={() => setModeMenuOpen(prev => !prev)}
                            className="text-text-secondary hover:text-text-primary text-xs border border-hairline rounded-lg px-2.5 py-1 flex items-center gap-1.5"
                        >
                            {MODE_OPTIONS.find(o => o.value === modeFilter)?.label ?? 'All Modes'}
                            <span className="text-[9px]">▾</span>
                        </button>
                        {modeMenuOpen && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-line rounded-lg py-1 w-36 shadow-lg">
                                {MODE_OPTIONS.map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => selectMode(option.value)}
                                        className={`w-full text-left text-xs px-3 py-1.5 hover:bg-accent-tint ${option.value === modeFilter ? "text-accent-soft font-semibold" : "text-text-primary"}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {matchesLoading ? (
                    <p className="text-text-secondary text-sm">Loading matches...</p>
                ) : matchHistory.length === 0 ? (
                    <p className="text-text-secondary text-sm">No matches found for this mode.</p>
                ) : (
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
                                        {championIconUrl(match.champion) && (
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={championIconUrl(match.champion)}
                                                    alt={match.champion}
                                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-md object-cover bg-surface"
                                                    onError={(e) => { e.currentTarget.style.visibility = "hidden" }}
                                                />
                                                {match.champLevel != null && (
                                                    <span className="absolute -bottom-1 -right-1 bg-surface border border-hairline rounded-full text-text-primary text-[9px] leading-none px-[3px] py-[2px] font-bold">
                                                        {match.champLevel}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <SummonerSpellIcons summonerSpells={match.summonerSpells} summonerSpellIconById={summonerSpellIconById} />
                                        <RuneIcons
                                            primaryRuneId={match.primaryRuneId}
                                            subRuneStyleId={match.subRuneStyleId}
                                            runeIconById={runeIconById}
                                            runeStyleIconById={runeStyleIconById}
                                        />
                                        <div className="w-[64px] sm:w-[110px] flex-shrink-0">
                                            <p className="text-text-primary text-xs sm:text-sm font-bold truncate">{match.champion}</p>
                                            <p className="text-text-secondary text-[10px] uppercase hidden sm:block">{ROLE_LABELS[match.role] ?? "—"}</p>
                                        </div>
                                        <div className="flex-1 font-mono text-xs sm:text-sm text-text-primary">
                                            {match.kills}/{match.deaths}/{match.assists}
                                            <span className="text-text-secondary text-[10px] sm:text-xs ml-1 sm:ml-2">
                                                {(match.cs / (match.gameDurationSeconds / 60)).toFixed(1)} CS/min
                                            </span>
                                            <span className="text-text-secondary text-[10px] sm:text-xs ml-1.5 hidden sm:inline">
                                                ({match.cs} CS)
                                            </span>
                                            {match.visionScore != null && (
                                                <span className="text-text-secondary text-[10px] sm:text-xs ml-1.5 hidden sm:inline">
                                                    · {match.visionScore} vision
                                                </span>
                                            )}
                                        </div>
                                        {match.lpDelta != null && (
                                            <p
                                                className={`text-[10px] sm:text-xs font-bold flex-shrink-0 ${match.lpDelta > 0 ? "text-positive" : "text-negative"}`}
                                                title={match.lpDeltaIsEstimate ? "Estimated LP change — Riot doesn't expose the real per-match value" : undefined}
                                            >
                                                {match.lpDelta > 0 ? "▲" : "▼"} {match.lpDelta > 0 ? "+" : ""}{match.lpDelta} LP
                                            </p>
                                        )}
                                        <p className={`text-xs sm:text-sm font-bold flex-shrink-0 ${match.win ? "text-positive" : "text-negative"}`}>
                                            {match.win ? "Win" : "Loss"}
                                        </p>
                                        <div className="text-right flex-shrink-0 hidden sm:block">
                                            <p className="text-text-secondary font-mono text-xs">{formatDuration(match.gameDurationSeconds)}</p>
                                            <p className="text-text-secondary text-[10px]">{formatTimeAgo(match.gameEndTimestamp)}</p>
                                            {modeLabel(match.queueId, match.gameMode) && (
                                                <p className="text-accent-soft text-[10px]">{modeLabel(match.queueId, match.gameMode)}</p>
                                            )}
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="border-t border-hairline">
                                            <MatchDetail
                                                match={match}
                                                ddragonVersion={ddragonVersion}
                                                yourPuuid={yourPuuid}
                                                itemData={itemData}
                                                summonerSpellIconById={summonerSpellIconById}
                                                runeIconById={runeIconById}
                                                runeStyleIconById={runeStyleIconById}
                                            />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
