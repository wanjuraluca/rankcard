import { ImageResponse } from "next/og"
import { supabase } from "@/lib/supabase"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }) {
    const { username } = await params
    const { data: profile } = await supabase
        .from("profiles")
        .select("username, bio, avatar_url")
        .eq("username", username)
        .single()

    const displayName = profile?.username ?? username

    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#0a0a0f",
                    backgroundImage:
                        "radial-gradient(ellipse 60% 60% at 20% 20%, rgba(177,108,255,0.35), transparent 60%)",
                    fontFamily: "sans-serif",
                }}
            >
                {profile?.avatar_url ? (
                    <img
                        src={profile.avatar_url}
                        width={160}
                        height={160}
                        style={{
                            borderRadius: "50%",
                            border: "4px solid #b16cff",
                            objectFit: "cover",
                            marginBottom: 32,
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: 160,
                            height: 160,
                            borderRadius: "50%",
                            border: "4px solid #b16cff",
                            backgroundColor: "#15151f",
                            marginBottom: 32,
                        }}
                    />
                )}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                    }}
                >
                    <span style={{ fontSize: 64, fontWeight: 800, color: "#f4f3f7" }}>
                        {displayName}
                    </span>
                    <span
                        style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: "#c9a6ff",
                            backgroundColor: "rgba(177,108,255,0.12)",
                            border: "1px solid rgba(177,108,255,0.4)",
                            borderRadius: 999,
                            padding: "6px 18px",
                        }}
                    >
                        PRO
                    </span>
                </div>
                {profile?.bio && (
                    <span style={{ fontSize: 28, color: "#8a8a9a", marginTop: 16 }}>
                        {profile.bio}
                    </span>
                )}
                <span style={{ fontSize: 28, color: "#b16cff", marginTop: 48, fontWeight: 700 }}>
                    rankcard.app
                </span>
            </div>
        ),
        { ...size }
    )
}
