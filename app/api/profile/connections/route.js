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
            .select("username, avatar_url")
            .in("user_id", mutualIds)

        return NextResponse.json({ users: users ?? [] })
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
