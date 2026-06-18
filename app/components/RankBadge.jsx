"use client"
import { useState, useEffect } from "react"

export default function RankBadge({account}) {

    const [rank, setRank] = useState(null)

    useEffect(() => {
        async function fetchRank() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}`);
            const data = await response.json();
            setRank(data.rankData[0].tier + " " + data.rankData[0].rank);
        }

        fetchRank();
        
    }, [])

    return (
        <div>
            <p className="text-accent font-bold text-base">{rank ?? "..."}</p>
            <p className="text-text-secondary text-xs">54% WR · 187 games</p>
        </div>
    )
}