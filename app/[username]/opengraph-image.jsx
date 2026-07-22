import { ImageResponse } from "next/og"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import { extractGameStats, average } from "@/lib/gameStats"
import { getGameEmblem } from "@/lib/rankEmblem"
import { getRankTier } from "@/lib/rankScore"
import { resolveStaticAvatar } from "@/lib/avatarPoster"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
// Next's metadata-image convention statically caches this route by default
// (generated once, then served from cache indefinitely) — without this, a
// profile's og:image would freeze at whatever ranks/stats existed the first
// time anyone's client fetched the link, same class of bug as Discord's own
// embed cache below.
export const revalidate = 300

// Layout below is authored against the logical 1200x630 og:image size.
// We render at 2x and let consumers downscale it, so text and avatars stay crisp on HiDPI previews.
const SCALE = 2
const px = (n) => n * SCALE

async function getCachedData(accountId) {
    const { data } = await supabase
        .from("account_cache")
        .select("data")
        .eq("account_id", accountId)
        .maybeSingle()
    return data?.data ?? {}
}

export default async function Image({ params }) {
    const { username } = await params
    const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, bio, avatar_url, is_pro")
        .eq("username", username)
        .single()

    const { data: accounts } = profile
        ? await supabase
            .from("connected_accounts")
            .select("id, platform")
            .eq("user_id", profile.user_id)
        : { data: [] }

    const accountList = accounts ?? []
    const statsList = await Promise.all(
        accountList.map(async (account) => {
            const apiData = await getCachedData(account.id)
            return { ...extractGameStats(account.platform, apiData), emblem: getGameEmblem(account.platform, apiData) }
        })
    )

    const avgRankScore = average(statsList.map(s => s?.rankScore))
    const rankInfo = avgRankScore != null ? getRankTier(Math.round(avgRankScore)) : null

    // Best rank first, mirroring the signature card's "trophy shelf" order —
    // this is the same object shared as a link, so it must show the same rows.
    const gameRows = accountList
        .map((account, i) => ({ account, stats: statsList[i], config: platformConfig[account.platform] }))
        .filter(row => row.config)
        .sort((a, b) => (b.stats?.rankScore ?? -1) - (a.stats?.rankScore ?? -1))

    const displayName = profile?.username ?? username
    // GIF avatars can't be decoded by Satori — resolve to the static poster
    // (or null → placeholder ring). PNGs/JPEGs pass through unchanged.
    const avatarSrc = await resolveStaticAvatar(profile?.avatar_url)

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "#0a0a0f",
                    backgroundImage:
                        "radial-gradient(ellipse 70% 70% at 15% 10%, rgba(177,108,255,0.30), transparent 60%)",
                    fontFamily: "sans-serif",
                    padding: px(48),
                }}
            >
                {/* Header: avatar + name/bio */}
                <div style={{ display: "flex", alignItems: "center", gap: px(24) }}>
                    <div style={{ display: "flex", flex: 1, alignItems: "center", gap: px(24) }}>
                    {avatarSrc ? (
                        <img
                            src={avatarSrc}
                            width={px(100)}
                            height={px(100)}
                            style={{
                                borderRadius: "50%",
                                border: `${px(3)}px solid #b16cff`,
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: px(100),
                                height: px(100),
                                borderRadius: "50%",
                                border: `${px(3)}px solid #b16cff`,
                                backgroundColor: "#15151f",
                            }}
                        />
                    )}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: px(10) }}>
                            <span style={{ fontSize: px(36), fontWeight: 800, color: "#f4f3f7" }}>
                                {displayName}
                            </span>
                            {profile?.is_pro && (
                                <span
                                    style={{
                                        fontSize: px(13),
                                        fontWeight: 700,
                                        color: "#c9a6ff",
                                        backgroundColor: "rgba(177,108,255,0.12)",
                                        border: "1px solid rgba(177,108,255,0.4)",
                                        borderRadius: 999,
                                        padding: `${px(4)}px ${px(11)}px`,
                                    }}
                                >
                                    PRO
                                </span>
                            )}
                        </div>
                        {profile?.bio && (
                            <span style={{ fontSize: px(16), color: "#8a8a9a", marginTop: px(6) }}>
                                {profile.bio}
                            </span>
                        )}
                    </div>
                    </div>
                    {avgRankScore != null && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span style={{ fontSize: px(40), fontWeight: 800, color: "#b16cff" }}>
                                {Math.round(avgRankScore).toLocaleString("en-US")}
                            </span>
                            <span style={{ fontSize: px(13), color: "#8a8a9a" }}>
                                Rank Score{rankInfo ? ` · ${rankInfo.tier.name}` : ""}
                            </span>
                        </div>
                    )}
                </div>

                {/* Per-game rank rows, sorted best-first and carrying the same real
                    rank-icon art as the signature card and RankBadge — this image is
                    what shows up when the profile link is shared, so it has to match
                    what the owner sees on their own page, not a simplified summary.
                    Row padding/gaps/fonts shrink once more than 4 games are connected,
                    so 5-6 rows still fit the fixed 630px canvas instead of overflowing
                    into (and being clipped by) the footer below. */}
                {gameRows.length > 0 && (() => {
                    const rowScale = Math.min(1, 4.2 / gameRows.length)
                    const rpx = (n) => px(n * rowScale)
                    return (
                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: rpx(16), marginTop: px(24), flex: 1 }}>
                            {gameRows.map(({ account, stats, config }, i) => {
                                const emblem = stats?.emblem
                                const emblemSize = rpx(56)
                                return (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        backgroundColor: "#15151f",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderLeft: `${px(4)}px solid ${config.color}`,
                                        borderRadius: px(12),
                                        padding: `${rpx(16)}px ${rpx(20)}px`,
                                        gap: rpx(18),
                                    }}
                                >
                                    {emblem?.type === "image" ? (
                                        // Satori (next/og's renderer) handles a CSS transform: scale()
                                        // on an <img> unreliably — it cropped Riot's ranked-emblem PNGs
                                        // in half instead of zooming in centered, unlike the identical
                                        // transform in RankBadge/RankHero which render in a real browser
                                        // (and a background-image swap in place of it rendered nothing
                                        // at all). Rendering the <img> itself oversized inside a
                                        // fixed-size, centered, overflow:hidden box gets the same
                                        // "zoomed in" crop via plain layout instead of a transform.
                                        <div style={{ display: "flex", width: emblemSize, height: emblemSize, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                                            <img
                                                src={emblem.url}
                                                width={emblem.scale ? emblemSize * 4.5 : emblemSize}
                                                height={emblem.scale ? emblemSize * 4.5 : emblemSize}
                                                style={{ objectFit: "contain" }}
                                            />
                                        </div>
                                    ) : emblem?.type === "badge" ? (
                                        <div style={{ display: "flex", width: emblemSize, height: emblemSize, borderRadius: "50%", border: `${px(2)}px solid ${emblem.color}`, backgroundColor: `${emblem.color}1f`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <span style={{ fontSize: rpx(14), fontWeight: 800, color: "#f4f3f7" }}>{emblem.label}</span>
                                        </div>
                                    ) : emblem?.type === "unranked" ? (
                                        <div style={{ display: "flex", width: emblemSize, height: emblemSize, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#0e0d16", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <div style={{ width: rpx(16), height: px(2), backgroundColor: "#5c5c6c", borderRadius: px(1) }} />
                                        </div>
                                    ) : (
                                        <div style={{ display: "flex", width: emblemSize, height: emblemSize, borderRadius: px(10), backgroundColor: `${config.color}24`, border: `1px solid ${config.color}66`, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            <div style={{ width: rpx(10), height: rpx(10), borderRadius: "50%", backgroundColor: config.color }} />
                                        </div>
                                    )}
                                    <div style={{ display: "flex", flexDirection: "column", width: px(190) }}>
                                        <span style={{ fontSize: rpx(13), color: "#8a8a9a", fontWeight: 600 }}>
                                            {config.shortName}
                                        </span>
                                        <span style={{ fontSize: rpx(24), fontWeight: 800, color: "#f4f3f7", marginTop: px(2) }}>
                                            {stats?.tierLabel ?? "Unranked"}
                                        </span>
                                    </div>
                                    <div style={{ display: "flex", flex: 1, gap: px(28), justifyContent: "flex-end" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                            <span style={{ fontSize: rpx(20), fontWeight: 700, color: "#f4f3f7" }}>
                                                {stats?.winRate != null ? `${Math.round(stats.winRate)}%` : "—"}
                                            </span>
                                            <span style={{ fontSize: rpx(11), color: "#8a8a9a", marginTop: px(2) }}>Win Rate</span>
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                                            <span style={{ fontSize: rpx(20), fontWeight: 700, color: config.color }}>
                                                {stats?.rankScore != null ? Math.round(stats.rankScore).toLocaleString("en-US") : "—"}
                                            </span>
                                            <span style={{ fontSize: rpx(11), color: "#8a8a9a", marginTop: px(2) }}>Rank Score</span>
                                        </div>
                                    </div>
                                </div>
                                )
                            })}
                        </div>
                    )
                })()}

                {/* Footer */}
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end", marginTop: px(20) }}>
                    <span style={{ fontSize: px(15), color: "#b16cff", fontWeight: 700 }}>
                        rankcard.app/{displayName}
                    </span>
                </div>
            </div>
        ),
        { width: size.width * SCALE, height: size.height * SCALE }
    )
}
