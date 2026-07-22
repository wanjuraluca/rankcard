import TopNav from "../components/TopNav"
import Footer from "../components/Footer"
import LeaderboardYou from "../components/LeaderboardYou"
import { supabase } from "@/lib/supabase"
import { getRankTier } from "@/lib/rankScore"
import { platformConfig } from "@/lib/platforms"
import { resolveDisplayAvatar } from "@/lib/avatarPoster"
import { Trophy } from "lucide-react"

export const metadata = {
    title: "Leaderboard",
    description: "The highest cross-game Rank Scores on RankCard. One ladder across League, TFT, Valorant, CS2, Overwatch and Marvel Rivals.",
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
        .select("user_id, username, avatar_url, is_pro, season_high")
        .not("username", "is", null)
        .neq("username", "")
        .not("season_high", "is", null)
        .order("season_high", { ascending: false })
        .limit(100)

    const entries = profiles ?? []

    const { data: accounts } = entries.length
        ? await supabase
              .from("connected_accounts")
              .select("user_id, platform")
              .in("user_id", entries.map(p => p.user_id))
        : { data: [] }

    const gamesByUser = {}
    for (const account of accounts ?? []) {
        ;(gamesByUser[account.user_id] ??= new Set()).add(account.platform)
    }
    const platformOrder = Object.keys(platformConfig)

    // GIF avatars are Pro-only — non-Pro owners show a static first-frame.
    await Promise.all(entries.map(async (e) => {
        e.displayAvatar = await resolveDisplayAvatar(e.avatar_url, e.is_pro)
    }))

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

                <LeaderboardYou />

                <div className="mt-5 flex flex-col gap-1.5">
                    {entries.length === 0 && (
                        <p className="text-text-secondary text-sm">No ranked players yet. Connect a game to be the first.</p>
                    )}
                    {entries.map((profile, i) => {
                        const rankInfo = getRankTier(profile.season_high)
                        const games = platformOrder.filter(p => gamesByUser[profile.user_id]?.has(p))
                        return (
                            <a
                                key={profile.username}
                                href={`/${profile.username}`}
                                data-lb-username={profile.username.toLowerCase()}
                                className="group flex items-center gap-3 bg-surface border border-hairline rounded-2xl px-4 py-3 hover:border-accent/40 hover:-translate-y-0.5 transition-all"
                            >
                                <span
                                    className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border text-xs font-extrabold ${
                                        MEDAL_STYLES[i] ?? "text-text-secondary bg-background border-hairline"
                                    }`}
                                >
                                    {i + 1}
                                </span>
                                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-background border border-hairline">
                                    {profile.displayAvatar && (
                                        <img src={profile.displayAvatar} alt={profile.username} className="h-full w-full object-cover" />
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
                                {games.length > 0 && (
                                    <div className="hidden sm:flex flex-shrink-0 items-center gap-2">
                                        {games.map(platform => {
                                            const config = platformConfig[platform]
                                            return config.imageUrl ? (
                                                <img
                                                    key={platform}
                                                    src={config.imageUrl}
                                                    alt={config.shortName}
                                                    title={config.name}
                                                    className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity"
                                                    style={{ transform: `scale(${config.logoScale ?? 1})` }}
                                                />
                                            ) : (
                                                <svg
                                                    key={platform}
                                                    role="img"
                                                    viewBox="0 0 24 24"
                                                    className="h-3.5 w-3.5 fill-current text-text-secondary opacity-60 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <title>{config.name}</title>
                                                    <path d={config.icon.path} fillRule={config.icon.fillRule ?? "nonzero"} />
                                                </svg>
                                            )
                                        })}
                                    </div>
                                )}
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
