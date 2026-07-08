import { ImageResponse } from "next/og"
import { supabase } from "@/lib/supabase"
import { extractGameStats, average } from "@/lib/gameStats"

const SIZE = { width: 600, height: 140 }

async function getCachedData(accountId) {
    const { data } = await supabase
        .from("account_cache")
        .select("data")
        .eq("account_id", accountId)
        .maybeSingle()
    return data?.data ?? {}
}

// Small, embeddable badge — meant for GitHub READMEs, forum signatures, or
// OBS browser sources, the same way Shields.io badges work. Unlike /api/card
// this has no Content-Disposition, so it renders inline wherever it's embedded.
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")

    const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url, is_pro")
        .eq("username", username)
        .single()

    if (!profile) {
        return Response.json({ error: "Profile not found." }, { status: 404 })
    }

    const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("id, platform")
        .eq("user_id", profile.user_id)

    const accountList = accounts ?? []
    const statsList = await Promise.all(
        accountList.map(async (account) => {
            const apiData = await getCachedData(account.id)
            return extractGameStats(account.platform, apiData)
        })
    )

    const avgRankScore = average(statsList.map(s => s?.rankScore))
    const avgWinRate = average(statsList.map(s => s?.winRate))

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#0e0d16",
                    border: "2px solid #b16cff",
                    borderRadius: 18,
                    fontFamily: "sans-serif",
                    padding: "0 28px",
                    gap: 20,
                }}
            >
                {profile.avatar_url ? (
                    <img src={profile.avatar_url} width={84} height={84} style={{ borderRadius: 10, border: "3px solid #b16cff", objectFit: "cover" }} />
                ) : (
                    <div style={{ width: 84, height: 84, borderRadius: 10, border: "3px solid #b16cff", backgroundColor: "#15151f" }} />
                )}

                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 26, fontWeight: 800, color: "#f4f3f7" }}>{profile.username}</span>
                        {profile.is_pro && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a6ff", backgroundColor: "rgba(177,108,255,0.12)", border: "1px solid rgba(177,108,255,0.4)", borderRadius: 999, padding: "2px 9px" }}>
                                PRO
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 14, color: "#8a8a9a", marginTop: 4 }}>on RankCard.app</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 30, fontWeight: 800, color: "#b16cff" }}>
                        {avgRankScore != null ? Math.round(avgRankScore).toLocaleString("en-US") : "—"}
                    </span>
                    <span style={{ fontSize: 12, color: "#8a8a9a" }}>
                        Rank Score{avgWinRate != null ? ` · ${Math.round(avgWinRate)}% WR` : ""}
                    </span>
                </div>
            </div>
        ),
        SIZE
    )
}
