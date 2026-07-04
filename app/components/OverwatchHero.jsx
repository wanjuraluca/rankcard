"use client"
import { useState, useEffect } from "react"
import { HeroSkeleton } from "./Skeleton"
import { getOverwatchScore } from "@/lib/rankScore"

const ROLE_LABELS = { tank: "Tank", damage: "Damage", support: "Support", open: "Open Queue" }
const ROLES = ["tank", "damage", "support", "open"]

export default function OverwatchHero({ account, accentColor = "#f99e1a" }) {

    const [ranks, setRanks] = useState(null)
    const [title, setTitle] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}&puuid=${encodeURIComponent(account.puuid)}`)
            const data = await response.json()
            setRanks(data.owRanks ?? null)
            setTitle(data.owTitle ?? null)
            setLoading(false)
        }

        fetchStats()
    }, [])

    if (loading) {
        return <HeroSkeleton accentColor={accentColor} />
    }

    const best = getOverwatchScore(ranks)
    if (!ranks || !best) {
        return (
            <div className="bg-surface border border-hairline rounded-2xl p-6 text-center">
                <p className="text-text-secondary text-sm">No competitive rank found yet — career profile may be private, or no ranked games played this season.</p>
            </div>
        )
    }

    return (
        <div
            className="bg-surface border border-hairline rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: accentColor }}
        >
            {title && (
                <p className="text-text-secondary text-xs mb-3">{title}</p>
            )}

            {/* Overwatch has no single rank — role queue and Open Queue are tracked
                separately, so this shows all four side by side instead of one big emblem. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ROLES.map((role) => {
                    const rank = ranks[role]
                    const isBest = best.role === role
                    return (
                        <div
                            key={role}
                            className="bg-surface-deep rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
                            style={isBest ? { boxShadow: `0 0 0 1.5px ${accentColor}` } : undefined}
                        >
                            <div className="w-11 h-11 flex items-center justify-center">
                                {rank?.rankIcon ? (
                                    <img src={rank.rankIcon} alt={rank.division} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-hairline" />
                                )}
                            </div>
                            <p className="text-text-secondary text-[10px] uppercase tracking-widest">{ROLE_LABELS[role]}</p>
                            <p className="text-text-primary text-xs font-bold capitalize">
                                {rank ? `${rank.division} ${rank.tier}` : "—"}
                            </p>
                        </div>
                    )
                })}
            </div>

            <p className="text-text-secondary text-[11px] mt-4">
                Rank Score uses your highest role — there's no single "main" rank in Overwatch.
            </p>
        </div>
    )
}
