"use client"
import { useState, useEffect } from "react"

export default function RankBadge({ account }) {

    const [rankEntry, setRankEntry] = useState(null)
    const [valorantEntry, setValorantEntry] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}`);
            const data = await response.json();
            const entry = data.rankData?.find((queue) => queue.queueType === "RANKED_SOLO_5x5");
            setRankEntry(entry ?? null)
            setValorantEntry(data.valorantData?.data?.current_data ?? null)
            setLoading(false)
        }

        fetchRank();

    }, [])

    if (loading) {
        return <p className="text-text-secondary text-xs">Loading rank...</p>
    }

    if (account.platform === "Valorant") {
        if (!valorantEntry) {
            return <p className="text-text-secondary text-sm">Unranked</p>
        }

        return (
            <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {valorantEntry.images?.small && (
                        <img src={valorantEntry.images.small} alt={valorantEntry.currenttierpatched} className="w-full h-full object-contain" />
                    )}
                </div>
                <div>
                    <p className="text-text-primary text-sm font-bold">{valorantEntry.currenttierpatched}</p>
                    <p className="text-text-secondary text-[11px]">{valorantEntry.ranking_in_tier} RR</p>
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
