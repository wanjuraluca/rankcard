import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
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
                <span
                    style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: "#c9a6ff",
                        backgroundColor: "rgba(177,108,255,0.12)",
                        border: "1px solid rgba(177,108,255,0.4)",
                        borderRadius: 999,
                        padding: "8px 20px",
                        marginBottom: 32,
                    }}
                >
                    For competitive gamers
                </span>
                <span style={{ fontSize: 72, fontWeight: 800, color: "#f4f3f7", textAlign: "center", lineHeight: 1.1 }}>
                    All your ranks.
                </span>
                <span style={{ fontSize: 72, fontWeight: 800, color: "#b16cff", textAlign: "center", lineHeight: 1.1 }}>
                    One profile.
                </span>
                <span style={{ fontSize: 28, color: "#8a8a9a", marginTop: 32 }}>
                    rankcard.app
                </span>
            </div>
        ),
        { ...size }
    )
}
