"use client"
import { useEffect, useState } from "react"

// Same emblem URL formula as lib/rankEmblem.js's riotEmblem() — duplicated
// rather than imported since that file's exported getGameEmblem() expects a
// full live apiData blob, not a bare tier string like these historical
// snapshots give us.
const emblemUrl = (tier) => `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`

const GAME_LABEL = { "League of Legends": "LoL", "TFT": "TFT" }

export default function SeasonBadges({ username }) {
    const [badges, setBadges] = useState(null)

    useEffect(() => {
        fetch(`/api/profile/season-badges?username=${username}`)
            .then(r => r.json())
            .then(d => setBadges(d.badges ?? []))
            .catch(() => setBadges([]))
    }, [username])

    if (badges === null) return null
    if (badges.length === 0) {
        return (
            <div className="bg-surface border border-hairline rounded-2xl p-4">
                <p className="text-text-secondary text-sm text-center py-4">
                    Not enough data yet. Season badges fill in automatically as each split completes. Check back in a few months.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-surface border border-hairline rounded-2xl p-4">
            <div className="flex flex-wrap gap-3 justify-center">
                {badges.map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 bg-background border border-hairline rounded-xl px-3 py-3 w-24">
                        <div className="w-10 h-10 flex-shrink-0 overflow-hidden">
                            <img
                                src={emblemUrl(b.tier)}
                                alt={b.tier}
                                className="w-full h-full object-contain scale-450 translate-y-1"
                            />
                        </div>
                        <p className="text-text-primary text-xs font-bold text-center leading-tight">
                            {b.tier}{b.rank && !["MASTER", "GRANDMASTER", "CHALLENGER"].includes(b.tier) ? ` ${b.rank}` : ""}
                        </p>
                        <p className="text-text-muted text-[10px] text-center">{b.season} · {GAME_LABEL[b.game] ?? b.game}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}
