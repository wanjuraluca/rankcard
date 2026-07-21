"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getRankTier } from "@/lib/rankScore"

// The leaderboard page itself is statically cached (revalidate 3600), so
// everything viewer-specific lives here on the client: the signed-in user's
// own ladder position and a highlight on their row if it's in the top 100.
export default function LeaderboardYou() {
    const [me, setMe] = useState(null)

    useEffect(() => {
        let cancelled = false

        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || cancelled) return

            const { data: profile } = await supabase
                .from("profiles")
                .select("username, season_high")
                .eq("user_id", user.id)
                .single()
            if (!profile?.username || profile.season_high == null || cancelled) return

            const { count } = await supabase
                .from("profiles")
                .select("user_id", { count: "exact", head: true })
                .not("username", "is", null)
                .neq("username", "")
                .gt("season_high", profile.season_high)
            if (cancelled) return

            setMe({ ...profile, position: (count ?? 0) + 1 })
        }

        load()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        if (!me) return
        const row = document.querySelector(`[data-lb-username="${CSS.escape(me.username.toLowerCase())}"]`)
        if (!row) return
        // Inline styles so this reliably beats the row's bg-surface/border-hairline
        // utilities regardless of stylesheet order.
        row.style.borderColor = "rgba(177, 108, 255, 0.6)"
        row.style.backgroundColor = "rgba(177, 108, 255, 0.08)"
        return () => {
            row.style.borderColor = ""
            row.style.backgroundColor = ""
        }
    }, [me])

    if (!me) return null

    const rankInfo = getRankTier(me.season_high)

    function jumpToRow() {
        document
            .querySelector(`[data-lb-username="${CSS.escape(me.username.toLowerCase())}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    return (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent-tint px-4 py-3">
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-accent/40 bg-background text-xs font-extrabold text-accent-soft">
                #{me.position}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Your ladder position</p>
                <p className="text-[11px] text-text-secondary">
                    {me.season_high.toLocaleString("en-US")} Rank Score
                    {rankInfo && (
                        <>
                            {" · "}
                            <span className="font-semibold" style={{ color: rankInfo.tier.color }}>
                                {rankInfo.tier.name}
                            </span>
                        </>
                    )}
                </p>
            </div>
            {me.position <= 100 ? (
                <button
                    onClick={jumpToRow}
                    className="flex-shrink-0 rounded-lg border border-accent/40 bg-background px-3 py-1.5 text-xs font-bold text-accent-soft transition-colors hover:bg-accent hover:text-background"
                >
                    Jump to you
                </button>
            ) : (
                <p className="flex-shrink-0 text-[11px] font-semibold text-text-secondary">Outside top 100</p>
            )}
        </div>
    )
}
