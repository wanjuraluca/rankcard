import { NextResponse } from "next/server"
import { detectPlatform } from "@/lib/riotPlatform"

const QUEUE_LABELS = {
    420: "Ranked Solo/Duo",
    440: "Ranked Flex",
    450: "ARAM",
    400: "Normal",
    700: "Clash",
}

// Valorant and CS2 have no public live-match-status API — Riot doesn't expose
// one for Valorant, and Henrik's (unofficial) Valorant API dropped its old
// presence endpoint for privacy reasons. League and TFT both have an
// official Spectator-v5 endpoint, just under different paths.
const SPECTATOR_PATH = {
    lol: "lol/spectator/v5/active-games/by-summoner",
    tft: "tft/spectator/v5/active-games/by-puuid",
}

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const puuid = searchParams.get("puuid")
    const game = searchParams.get("game") ?? "lol"

    if (!puuid) return NextResponse.json({ inGame: false })

    const path = SPECTATOR_PATH[game]
    if (!path) return NextResponse.json({ inGame: false })

    // Spectator-v5 is platform-shard-routed. The caller can't reliably know the
    // shard (ProfileClient hardcoded euw1, so non-EUW players never showed as
    // in-game — the same region-hardcode class as the summoner/snapshot/discord
    // fixes), so derive it from the puuid itself, like every other Riot call.
    const host = await detectPlatform(puuid)

    try {
        const res = await fetch(
            `https://${host}.api.riotgames.com/${path}/${puuid}`,
            { headers: { "X-Riot-Token": process.env.RIOT_API_KEY }, next: { revalidate: 60 } }
        )

        if (res.status === 404) return NextResponse.json({ inGame: false })
        if (!res.ok) return NextResponse.json({ inGame: false })

        const activeGame = await res.json()
        const queueLabel = game === "tft" ? "Ranked TFT" : (QUEUE_LABELS[activeGame.gameQueueConfigId] ?? "Custom Game")

        return NextResponse.json({ inGame: true, queue: queueLabel, gameId: activeGame.gameId, game })
    } catch {
        return NextResponse.json({ inGame: false })
    }
}
