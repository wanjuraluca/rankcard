import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET() {
    try {
        const { data: posts, error } = await supabaseAdmin
            .from("lfg_posts")
            .select("id, user_id, game, looking_for, roles, region, message, is_boosted, created_at, expires_at, rank_label, rank_score")
            .gt("expires_at", new Date().toISOString())
            .order("is_boosted", { ascending: false })
            .order("created_at", { ascending: false })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        const userIds = [...new Set((posts ?? []).map(p => p.user_id))]
        if (userIds.length === 0) {
            return NextResponse.json({ posts: [] })
        }

        // Discord tags are intentionally NOT selected here — they must only
        // ever be returned by /api/lfg/reveal after the freemium gate check.
        const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("user_id, username, avatar_url")
            .in("user_id", userIds)

        const profileByUserId = {}
        for (const p of profiles ?? []) {
            profileByUserId[p.user_id] = p
        }

        // Pull League/TFT puuids so the client can check live-game status per
        // post — same pattern as the friends list in
        // app/api/profile/connections/route.js. Only League and TFT posts
        // can ever show an online dot (Valorant/CS2 have no live-status API).
        const { data: liveCapableAccounts } = await supabaseAdmin
            .from("connected_accounts")
            .select("user_id, platform, puuid")
            .in("platform", ["League of Legends", "TFT"])
            .in("user_id", userIds)

        const puuidByUserIdAndPlatform = {}
        for (const account of liveCapableAccounts ?? []) {
            puuidByUserIdAndPlatform[`${account.user_id}:${account.platform}`] = account.puuid
        }

        const enriched = (posts ?? []).map(post => ({
            ...post,
            username: profileByUserId[post.user_id]?.username ?? null,
            avatar_url: profileByUserId[post.user_id]?.avatar_url ?? null,
            puuid: puuidByUserIdAndPlatform[`${post.user_id}:${post.game}`] ?? null,
        })).filter(post => post.username) // skip orphaned posts with no matching profile

        return NextResponse.json({ posts: enriched })
    } catch {
        return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
    }
}
