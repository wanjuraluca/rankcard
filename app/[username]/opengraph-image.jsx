import { ImageResponse } from "next/og"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Layout below is authored against the logical 1200x630 og:image size.
// We render at 2x and let consumers downscale it, so text and avatars stay crisp on HiDPI previews.
const SCALE = 2
const px = (n) => n * SCALE

export default async function Image({ params }) {
    const { username } = await params
    const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, bio, avatar_url")
        .eq("username", username)
        .single()

    const { data: accounts } = profile
        ? await supabase
            .from("connected_accounts")
            .select("platform")
            .eq("user_id", profile.id)
        : { data: [] }

    const displayName = profile?.username ?? username

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
                    {profile?.avatar_url ? (
                        <img
                            src={profile.avatar_url}
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
                        </div>
                        {profile?.bio && (
                            <span style={{ fontSize: px(16), color: "#8a8a9a", marginTop: px(6) }}>
                                {profile.bio}
                            </span>
                        )}
                    </div>
                </div>

                {/* Stats row */}
                <div style={{ display: "flex", gap: px(12), marginTop: px(32) }}>
                    {[
                        { value: "2,000", label: "Rank Score", accent: true },
                        { value: "55%", label: "Avg Win Rate" },
                        { value: "2.47", label: "Avg KDA" },
                        { value: String(accounts?.length ?? 0), label: "Games Connected" },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                                backgroundColor: "#15151f",
                                border: `1px solid ${stat.accent ? "rgba(177,108,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                                borderRadius: px(12),
                                padding: `${px(16)}px ${px(18)}px`,
                            }}
                        >
                            <span style={{ fontSize: px(28), fontWeight: 800, color: stat.accent ? "#b16cff" : "#f4f3f7" }}>
                                {stat.value}
                            </span>
                            <span style={{ fontSize: px(12), color: "#8a8a9a", marginTop: px(4) }}>
                                {stat.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Connected games */}
                {accounts && accounts.length > 0 && (
                    <div style={{ display: "flex", gap: px(8), marginTop: px(20) }}>
                        {accounts.map((account, i) => {
                            const config = platformConfig[account.platform]
                            if (!config) return null
                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: px(8),
                                        backgroundColor: "#15151f",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: 999,
                                        padding: `${px(7)}px ${px(14)}px`,
                                    }}
                                >
                                    <div
                                        style={{
                                            width: px(8),
                                            height: px(8),
                                            borderRadius: "50%",
                                            backgroundColor: config.color,
                                        }}
                                    />
                                    <span style={{ fontSize: px(13), color: "#f4f3f7", fontWeight: 600 }}>
                                        {config.shortName}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: px(15), color: "#b16cff", fontWeight: 700 }}>
                        rankcard.app
                    </span>
                </div>
            </div>
        ),
        { width: size.width * SCALE, height: size.height * SCALE }
    )
}
