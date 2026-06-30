import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    const type = searchParams.get("type")

    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }
    if (!["followers", "following", "friends"].includes(type)) {
        return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("username", username)
        .single()

    if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const targetId = profile.user_id

    if (type === "friends") {
        const [{ data: followerRows }, { data: followingRows }] = await Promise.all([
            supabaseAdmin.from("follows").select("follower_id").eq("following_id", targetId),
            supabaseAdmin.from("follows").select("following_id").eq("follower_id", targetId),
        ])

        const followerIds = new Set((followerRows ?? []).map(r => r.follower_id))
        const followingIds = (followingRows ?? []).map(r => r.following_id)
        const mutualIds = followingIds.filter(id => followerIds.has(id))

        if (mutualIds.length === 0) {
            return NextResponse.json({ users: [] })
        }

        const { data: users } = await supabaseAdmin
            .from("profiles")
            .select("username, avatar_url, user_id")
            .in("user_id", mutualIds)

        if (!users?.length) {
            return NextResponse.json({ users: [] })
        }

        // Pull each friend's League puuid so the client can check live-game
        // status — only League has a Spectator-API live-status endpoint.
        const { data: lolAccounts } = await supabaseAdmin
            .from("connected_accounts")
            .select("user_id, puuid")
            .eq("platform", "League of Legends")
            .in("user_id", users.map(u => u.user_id))

        const puuidByUserId = Object.fromEntries((lolAccounts ?? []).map(a => [a.user_id, a.puuid]))

        const enriched = users.map(u => ({
            username: u.username,
            avatar_url: u.avatar_url,
            lolPuuid: puuidByUserId[u.user_id] ?? null,
        }))

        return NextResponse.json({ users: enriched })
    }

    const column = type === "followers" ? "following_id" : "follower_id"
    const selectColumn = type === "followers" ? "follower_id" : "following_id"

    const { data: rows } = await supabaseAdmin
        .from("follows")
        .select(selectColumn)
        .eq(column, targetId)

    const ids = (rows ?? []).map(r => r[selectColumn])

    if (ids.length === 0) {
        return NextResponse.json({ users: [] })
    }

    const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("username, avatar_url")
        .in("user_id", ids)

    return NextResponse.json({ users: users ?? [] })
}
