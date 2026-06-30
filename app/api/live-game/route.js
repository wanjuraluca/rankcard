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

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const puuid = searchParams.get("puuid")
    const platform = searchParams.get("platform") ?? "euw1"

    if (!puuid) return NextResponse.json({ inGame: false })

    const host = PLATFORM_HOSTS[platform] ?? "euw1"

    try {
        const res = await fetch(
            `https://${host}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`,
            { headers: { "X-Riot-Token": process.env.RIOT_API_KEY }, next: { revalidate: 60 } }
        )

        if (res.status === 404) return NextResponse.json({ inGame: false })
        if (!res.ok) return NextResponse.json({ inGame: false })

        const game = await res.json()
        const queueLabel = QUEUE_LABELS[game.gameQueueConfigId] ?? "Custom Game"

        return NextResponse.json({ inGame: true, queue: queueLabel, gameId: game.gameId })
    } catch {
        return NextResponse.json({ inGame: false })
    }
}
