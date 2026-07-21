import TopNav from "../components/TopNav"
import Footer from "../components/Footer"
import { supabase } from "@/lib/supabase"
import { getRankTier } from "@/lib/rankScore"
import { Trophy } from "lucide-react"

export const metadata = {
    title: "Leaderboard",
    description: "The highest cross-game Rank Scores on RankCard — one ladder across League, TFT, Valorant, CS2, Overwatch and Marvel Rivals.",
}

// Season-high scores only move when a player visits their own profile, so
// this page can be statically cached and refreshed once an hour.
export const revalidate = 3600

const MEDAL_STYLES = [
    "text-[#ffd166] bg-[#ffd166]/10 border-[#ffd166]/40",
    "text-[#9ca3af] bg-[#9ca3af]/10 border-[#9ca3af]/40",
    "text-[#a0683e] bg-[#a0683e]/10 border-[#a0683e]/40",
]

export default async function Leaderboard() {
    const { data: profiles } = await supabase
        .from("profiles")
        .select("username, avatar_url, is_pro, season_high")
        .not("username", "is", null)
        .neq("username", "")
        .not("season_high", "is", null)
        .order("season_high", { ascending: false })
        .limit(100)

    const entries = profiles ?? []

    return (
        <>
            <TopNav />
            <div className="p-3 max-w-[720px] mx-auto">
                <div className="mt-6 flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-tint border border-accent/40">
                        <Trophy size={18} className="text-accent-soft" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-text-primary">Leaderboard</h1>
                        <p className="text-text-secondary text-xs">
                            Season-high Rank Score across all connected games. Climb in yours to move up.
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-1.5">
                    {entries.length === 0 && (
                        <p className="text-text-secondary text-sm">No ranked players yet — connect a game to be the first.</p>
                    )}
                    {entries.map((profile, i) => {
                        const rankInfo = getRankTier(profile.season_high)
                        return (
                            <a
                                key={profile.username}
                                href={`/${profile.username}`}
                                className="flex items-center gap-3 bg-surface border border-hairline rounded-2xl px-4 py-3 hover:border-accent/40 hover:-translate-y-0.5 transition-all"
                            >
                                <span
                                    className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border text-xs font-extrabold ${
                                        MEDAL_STYLES[i] ?? "text-text-secondary bg-background border-hairline"
                                    }`}
                                >
                                    {i + 1}
                                </span>
                                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-background border border-hairline">
                                    {profile.avatar_url && (
                                        <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                                        <span className="truncate">{profile.username}</span>
                                        {profile.is_pro && (
                                            <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                                        )}
                                    </p>
                                    {rankInfo && (
                                        <p className="text-[11px] font-semibold" style={{ color: rankInfo.tier.color }}>
                                            {rankInfo.tier.name} · Top {rankInfo.topPercent.toFixed(1)}%
                                        </p>
                                    )}
                                </div>
                                <p className="flex-shrink-0 text-accent text-lg font-extrabold">
                                    {profile.season_high.toLocaleString("en-US")}
                                </p>
                            </a>
                        )
                    })}
                </div>
            </div>
            <Footer />
        </>
    )
}
