import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET() {
    try {
        const { data: posts, error } = await supabaseAdmin
            .from("lfg_posts")
            .select("id, user_id, game, looking_for, roles, region, message, is_boosted, created_at, expires_at")
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

        const enriched = (posts ?? []).map(post => ({
            ...post,
            username: profileByUserId[post.user_id]?.username ?? null,
            avatar_url: profileByUserId[post.user_id]?.avatar_url ?? null,
        })).filter(post => post.username) // skip orphaned posts with no matching profile

        return NextResponse.json({ posts: enriched })
    } catch {
        return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
    }
}
