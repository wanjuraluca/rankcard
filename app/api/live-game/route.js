import { NextResponse } from "next/server"

const QUEUE_LABELS = {
    420: "Ranked Solo/Duo",
    440: "Ranked Flex",
    450: "ARAM",
    400: "Normal",
    700: "Clash",
}

const PLATFORM_HOSTS = {
    euw1: "euw1",
    eun1: "eun1",
    na1: "na1",
    kr: "kr",
    br1: "br1",
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
    const platform = searchParams.get("platform") ?? "euw1"
    const game = searchParams.get("game") ?? "lol"

    if (!puuid) return NextResponse.json({ inGame: false })

    const path = SPECTATOR_PATH[game]
    if (!path) return NextResponse.json({ inGame: false })

    const host = PLATFORM_HOSTS[platform] ?? "euw1"

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
