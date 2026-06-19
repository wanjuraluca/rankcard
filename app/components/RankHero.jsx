"use client"
import { useState, useEffect } from "react"

export default function RankHero({ account }) {

    const [rankData, setRankData] = useState(null)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}`);
            const data = await response.json();
            const entry = data.rankData?.[1];
            setRankData(entry ?? null);
        }

        fetchRank();
    }, [])

    if (!rankData) {
        return (
            <div className="bg-surface border border-line rounded-xl p-6">
                <p className="text-text-secondary text-sm">Loading rank...</p>
            </div>
        );
    }

    const winRate = Math.round((rankData.wins / (rankData.wins + rankData.losses)) * 100) || 0;
    const totalGames = rankData.wins + rankData.losses;

    return (
        <div className="flex bg-surface border border-line rounded-xl p-6 gap-6 items-center">

            {/* Emblem */}
            <div className="w-24 h-24 rounded-lg bg-accent/10 border border-line flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img
                    src={`https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${rankData.tier.toLowerCase()}.png`}
                    alt={rankData.tier}
                    className="w-full h-full object-contain scale-450 translate-y-2"
                />
            </div>

            {/* Rank Info */}
            <div className="flex-1">
                <p className="text-text-primary font-medium text-2xl">
                    {rankData.tier} {rankData.rank}
                </p>
                <p className="text-text-secondary text-sm mt-1">
                    {rankData.leaguePoints} LP · Solo/Duo
                </p>
                <div className="h-2 bg-line rounded-full mt-3">
                    <div
                        className="h-2 bg-accent rounded-full"
                        style={{ width: `${rankData.leaguePoints}%` }}
                    />
                </div>
                <div className="flex justify-between text-text-secondary text-[10px] mt-1">
                    <span>0 LP</span>
                    <span>{rankData.tier} {rankData.rank} → 100 LP</span>
                </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                    <p className="text-green-400 font-medium text-lg leading-tight">{winRate}%</p>
                    <p className="text-text-secondary text-xs">Win Rate</p>
                </div>
                <div className="text-right">
                    <p className="font-medium text-lg leading-tight">{totalGames}</p>
                    <p className="text-text-secondary text-xs">Games</p>
                </div>
            </div>

        </div>
    );
}