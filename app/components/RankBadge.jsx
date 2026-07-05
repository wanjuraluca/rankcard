"use client"
import { useState, useEffect } from "react"
import { RankBadgeSkeleton } from "./Skeleton"
import { getOverwatchScore } from "@/lib/rankScore"

// Mirrors Cs2Hero's PREMIER_BANDS — kept duplicated rather than shared since
// this is just a display color, not scoring logic (see lib/rankScore.js).
const PREMIER_BANDS = [
    { min: 30000, name: "Yellow", color: "#facc15" },
    { min: 25000, name: "Red", color: "#f87171" },
    { min: 20000, name: "Pink", color: "#f472b6" },
    { min: 15000, name: "Purple", color: "#c084fc" },
    { min: 10000, name: "Blue", color: "#60a5fa" },
    { min: 5000, name: "Light Blue", color: "#7dd3fc" },
    { min: 0, name: "Grey", color: "#9a96a8" },
]

export default function RankBadge({ account }) {

    const [rankEntry, setRankEntry] = useState(null)
    const [tftEntry, setTftEntry] = useState(null)
    const [valorantEntry, setValorantEntry] = useState(null)
    const [valorantImage, setValorantImage] = useState(null)
    const [cs2Profile, setCs2Profile] = useState(null)
    const [owRanks, setOwRanks] = useState(null)
    const [owStats, setOwStats] = useState(null)
    const [mrRank, setMrRank] = useState(null)
    const [mrOverallStats, setMrOverallStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`);
            const data = await response.json();
            // Guard with Array.isArray: on a Riot error (rate limit / bad key)
            // the API returns an error object here, not an array — calling
            // .find on it would throw and freeze the badge on "Loading...".
            const entry = Array.isArray(data.rankData) ? data.rankData.find((queue) => queue.queueType === "RANKED_SOLO_5x5") : null;
            setRankEntry(entry ?? null)
            const tft = Array.isArray(data.tftData) ? data.tftData.find((queue) => queue.queueType === "RANKED_TFT") : null;
            setTftEntry(tft ?? null)
            setValorantEntry(data.valorantData?.data?.current ?? null)
            const mmrHistory = data.valorantMmrHistory ?? []
            setValorantImage(mmrHistory[mmrHistory.length - 1]?.image ?? null)
            setCs2Profile(data.cs2Profile ?? null)
            setOwRanks(data.owRanks ?? null)
            setOwStats(data.owStats ?? null)
            setMrRank(data.mrRank ?? null)
            setMrOverallStats(data.mrOverallStats ?? null)
            setLoading(false)
        }

        fetchRank();

    }, [])

    if (loading) {
        return <RankBadgeSkeleton />
    }

    if (account.platform === "TFT") {
        if (!tftEntry) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }

        const winRate = Math.round((tftEntry.wins / (tftEntry.wins + tftEntry.losses)) * 100) || 0
        const totalGames = tftEntry.wins + tftEntry.losses

        return (
            <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden">
                    <img
                        src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tftEntry.tier.toLowerCase()}.png`}
                        alt={tftEntry.tier}
                        className="w-full h-full object-contain scale-450 translate-y-1"
                    />
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold">{tftEntry.tier} {tftEntry.rank}</p>
                    <p className="text-text-secondary text-[11px]">{tftEntry.leaguePoints} LP</p>
                </div>
                <div className="ml-auto text-right">
                    <p className="text-positive text-xs font-semibold">{winRate}% WR</p>
                    <p className="text-text-secondary text-[10px]">{totalGames} games</p>
                </div>
            </div>
        )
    }

    if (account.platform === "CSGO") {
        const premierRating = cs2Profile?.ranks?.premier
        if (premierRating == null) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }
        const band = PREMIER_BANDS.find(b => premierRating >= b.min) ?? PREMIER_BANDS[PREMIER_BANDS.length - 1]

        return (
            <div className="flex items-center gap-3">
                <div
                    className="w-[46px] h-[46px] flex-shrink-0 rounded-full flex items-center justify-center border-2"
                    style={{ borderColor: band.color, backgroundColor: `${band.color}1f` }}
                >
                    <span className="text-text-primary font-extrabold text-[11px]">{Math.round(premierRating / 1000)}k</span>
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold">{band.name}</p>
                    <p className="text-text-secondary text-[11px]">{premierRating.toLocaleString()} Premier</p>
                </div>
            </div>
        )
    }

    if (account.platform === "Overwatch") {
        const best = getOverwatchScore(owRanks)
        if (!best) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }
        const bestRank = owRanks[best.role]
        // Same source + formula as OverwatchHero's own win-rate line — the
        // competitive career stats block, not match history (OverFast has
        // none for Overwatch).
        const compGames = owStats?.competitive?.game
        const winRate = compGames?.games_played > 0 ? Math.round((compGames.games_won / compGames.games_played) * 100) : null

        return (
            <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {bestRank.rankIcon && (
                        <img src={bestRank.rankIcon} alt={bestRank.division} className="w-full h-full object-contain" />
                    )}
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold capitalize">{bestRank.division} {bestRank.tier}</p>
                    <p className="text-text-secondary text-[11px] capitalize">
                        {best.role === "open" ? "Open Queue" : best.role}
                        {winRate != null && <> · <span className="text-positive font-semibold">{winRate}% WR</span></>}
                    </p>
                </div>
            </div>
        )
    }

    if (account.platform === "Marvel Rivals") {
        if (!mrRank?.rank) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }
        const ranked = mrOverallStats?.ranked
        const winRate = ranked?.total_matches > 0 ? Math.round((ranked.total_wins / ranked.total_matches) * 100) : null

        return (
            <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {mrRank.image && (
                        <img src={`https://marvelrivalsapi.com/rivals${mrRank.image}`} alt={mrRank.rank} className="w-full h-full object-contain" />
                    )}
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold">{mrRank.rank}</p>
                    {winRate != null && <p className="text-text-secondary text-[11px]">{winRate}% WR</p>}
                </div>
            </div>
        )
    }

    if (account.platform === "Valorant") {
        if (!valorantEntry) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }

        return (
            <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {valorantImage && (
                        <img src={valorantImage} alt={valorantEntry.tier?.name} className="w-full h-full object-contain" />
                    )}
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold">{valorantEntry.tier?.name}</p>
                    <p className="text-text-secondary text-[11px]">{valorantEntry.rr} RR</p>
                </div>
            </div>
        )
    }

    if (!rankEntry) {
        return <p className="text-text-secondary text-sm">Unranked</p>
    }

    const winRate = Math.round((rankEntry.wins / (rankEntry.wins + rankEntry.losses)) * 100) || 0
    const totalGames = rankEntry.wins + rankEntry.losses

    return (
        <div className="flex items-center gap-3">
            <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden">
                <img
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${rankEntry.tier.toLowerCase()}.png`}
                    alt={rankEntry.tier}
                    className="w-full h-full object-contain scale-450 translate-y-1"
                />
            </div>
            <div>
                <p className="text-text-primary text-sm font-bold">{rankEntry.tier} {rankEntry.rank}</p>
                <p className="text-text-secondary text-[11px]">{rankEntry.leaguePoints} LP · Solo/Duo</p>
            </div>
            <div className="ml-auto text-right">
                <p className="text-positive text-xs font-semibold">{winRate}% WR</p>
                <p className="text-text-secondary text-[10px]">{totalGames} games</p>
            </div>
        </div>
    )
}
