import { ImageResponse } from "next/og"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import { extractGameStats, average } from "@/lib/gameStats"
import { getGameEmblem } from "@/lib/rankEmblem"

const SIZE = { width: 1200, height: 630 }

async function getCachedData(accountId) {
    const { data } = await supabase
        .from("account_cache")
        .select("data")
        .eq("account_id", accountId)
        .maybeSingle()
    return data?.data ?? {}
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    const platform = searchParams.get("platform")

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, is_pro")
        .eq("username", username)
        .single()

    if (!profile) {
        return Response.json({ error: "Profile not found." }, { status: 404 })
    }

    // Per-game cards are a Pro feature — the free export is always the overall card.
    if (platform && !profile.is_pro) {
        return Response.json({ error: "Per-game cards are a Pro feature." }, { status: 403 })
    }

    const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("id, platform, platform_username, platform_tag")
        .eq("user_id", profile.user_id)

    const accountList = accounts ?? []

    const image = platform
        ? await renderGameCard(profile, accountList, platform)
        : await renderOverallCard(profile, accountList)

    if (!image) {
        return Response.json({ error: "No data found for this card." }, { status: 404 })
    }

    const filename = platform ? `rankcard-${username}-${platform}.png` : `rankcard-${username}.png`
    return new ImageResponse(image, {
        ...SIZE,
        headers: { "Content-Disposition": `attachment; filename="${filename}"` },
    })
}

async function renderOverallCard(profile, accountList) {
    const statsList = await Promise.all(
        accountList.map(async (account) => {
            const apiData = await getCachedData(account.id)
            return { ...extractGameStats(account.platform, apiData), emblem: getGameEmblem(account.platform, apiData) }
        })
    )

    const avgRankScore = average(statsList.map(s => s?.rankScore))
    const avgWinRate = average(statsList.map(s => s?.winRate))
    const avgKda = average(statsList.map(s => s?.kda))

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#0a0a0f",
                backgroundImage: "radial-gradient(ellipse 70% 70% at 15% 10%, rgba(177,108,255,0.30), transparent 60%)",
                fontFamily: "sans-serif",
                padding: 56,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} width={100} height={100} style={{ borderRadius: "50%", border: "3px solid #b16cff", objectFit: "cover" }} />
                ) : (
                    <div style={{ width: 100, height: 100, borderRadius: "50%", border: "3px solid #b16cff", backgroundColor: "#15151f" }} />
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 40, fontWeight: 800, color: "#f4f3f7" }}>{profile.username}</span>
                        {profile.is_pro && (
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#c9a6ff", backgroundColor: "rgba(177,108,255,0.12)", border: "1px solid rgba(177,108,255,0.4)", borderRadius: 999, padding: "4px 12px" }}>
                                PRO
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 18, color: "#b16cff", fontWeight: 700, marginTop: 6 }}>
                        One Account. All Games.
                    </span>
                </div>
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
                {[
                    { value: avgRankScore != null ? Math.round(avgRankScore).toLocaleString("en-US") : "—", label: "Rank Score", accent: true },
                    { value: avgWinRate != null ? `${Math.round(avgWinRate)}%` : "—", label: "Avg Win Rate" },
                    { value: avgKda != null ? avgKda.toFixed(2) : "—", label: "Avg KDA" },
                    { value: String(accountList.length), label: "Games Connected" },
                ].map((stat) => (
                    <div key={stat.label} style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: "#15151f", border: `1px solid ${stat.accent ? "rgba(177,108,255,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: "20px 22px" }}>
                        <span style={{ fontSize: 32, fontWeight: 800, color: stat.accent ? "#b16cff" : "#f4f3f7" }}>{stat.value}</span>
                        <span style={{ fontSize: 13, color: "#8a8a9a", marginTop: 4 }}>{stat.label}</span>
                    </div>
                ))}
            </div>

            {accountList.length > 0 && (() => {
                // Best rank first, same "trophy shelf" order as the signature card —
                // this export is the same object, just downloadable.
                const rows = accountList
                    .map((account, i) => ({ account, stats: statsList[i], config: platformConfig[account.platform] }))
                    .filter(row => row.config)
                    .sort((a, b) => (b.stats?.rankScore ?? -1) - (a.stats?.rankScore ?? -1))
                return (
                    <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                        {rows.map(({ config, stats }, i) => {
                            const emblem = stats?.emblem
                            return (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#15151f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "6px 16px 6px 6px" }}>
                                    {emblem?.type === "image" ? (
                                        <div style={{ display: "flex", width: 28, height: 28, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                                            <img
                                                src={emblem.url}
                                                width={28}
                                                height={28}
                                                style={emblem.scale ? { objectFit: "contain", transform: "scale(4.5) translateY(2px)" } : { objectFit: "contain" }}
                                            />
                                        </div>
                                    ) : emblem?.type === "badge" ? (
                                        <div style={{ display: "flex", width: 28, height: 28, borderRadius: "50%", border: `2px solid ${emblem.color}`, backgroundColor: `${emblem.color}1f`, alignItems: "center", justifyContent: "center" }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: "#f4f3f7" }}>{emblem.label}</span>
                                        </div>
                                    ) : emblem?.type === "unranked" ? (
                                        <div style={{ display: "flex", width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#0e0d16", alignItems: "center", justifyContent: "center" }}>
                                            <div style={{ width: 10, height: 2, backgroundColor: "#5c5c6c", borderRadius: 1 }} />
                                        </div>
                                    ) : (
                                        <div style={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: config.color, margin: "0 9px" }} />
                                    )}
                                    <span style={{ fontSize: 14, color: "#f4f3f7", fontWeight: 600 }}>{config.shortName}</span>
                                </div>
                            )
                        })}
                    </div>
                )
            })()}

            <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 17, color: "#b16cff", fontWeight: 700 }}>rankcard.app</span>
            </div>
        </div>
    )
}

async function renderGameCard(profile, accountList, platform) {
    const account = accountList.find(a => a.platform === platform)
    const config = platformConfig[platform]
    if (!account || !config) return null

    const apiData = await getCachedData(account.id)
    const stats = extractGameStats(platform, apiData)
    if (!stats) return null

    const handle = account.platform_tag ? `${account.platform_username}#${account.platform_tag}` : account.platform_username

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                backgroundColor: "#0a0a0f",
                backgroundImage: `radial-gradient(ellipse 70% 70% at 15% 10%, ${config.color}33, transparent 60%)`,
                fontFamily: "sans-serif",
                padding: 56,
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} width={92} height={92} style={{ borderRadius: "50%", border: `3px solid ${config.color}`, objectFit: "cover" }} />
                ) : (
                    <div style={{ width: 92, height: 92, borderRadius: "50%", border: `3px solid ${config.color}`, backgroundColor: "#15151f" }} />
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 36, fontWeight: 800, color: "#f4f3f7" }}>{profile.username}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a6ff", backgroundColor: "rgba(177,108,255,0.12)", border: "1px solid rgba(177,108,255,0.4)", borderRadius: 999, padding: "4px 12px" }}>
                            PRO
                        </span>
                    </div>
                    <span style={{ fontSize: 16, color: "#8a8a9a", marginTop: 4 }}>{handle}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", backgroundColor: `${config.color}1f`, border: `1px solid ${config.color}66`, borderRadius: 999, padding: "10px 20px" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: config.color }} />
                    <span style={{ fontSize: 18, color: "#f4f3f7", fontWeight: 700 }}>{config.name}</span>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
                <span style={{ fontSize: 64, fontWeight: 800, color: config.color }}>
                    {stats.tierLabel ?? "Unranked"}
                </span>
            </div>

            <div style={{ display: "flex", gap: 14, marginTop: 28 }}>
                {[
                    { value: stats.rankScore != null ? Math.round(stats.rankScore).toLocaleString("en-US") : "—", label: "Rank Score" },
                    { value: stats.winRate != null ? `${Math.round(stats.winRate)}%` : "—", label: "Win Rate" },
                    { value: stats.kda != null ? stats.kda.toFixed(2) : "—", label: "Avg KDA" },
                ].map((stat) => (
                    <div key={stat.label} style={{ display: "flex", flexDirection: "column", flex: 1, backgroundColor: "#15151f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 22px" }}>
                        <span style={{ fontSize: 32, fontWeight: 800, color: "#f4f3f7" }}>{stat.value}</span>
                        <span style={{ fontSize: 13, color: "#8a8a9a", marginTop: 4 }}>{stat.label}</span>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 17, color: config.color, fontWeight: 700 }}>rankcard.app</span>
            </div>
        </div>
    )
}
