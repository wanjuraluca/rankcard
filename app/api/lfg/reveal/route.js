import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const FREE_DAILY_REVEAL_LIMIT = 3

export async function POST(request) {
    try {
        const { targetPostId } = await request.json()

        // The viewer's identity is derived from their auth token, never from
        // the request body — otherwise a free user could just send a random
        // (or someone else's) id each time and sail past the daily limit, and
        // the whole Discord-tag gate would be trivially bypassable.
        const token = request.headers.get("Authorization")?.replace("Bearer ", "")
        if (!token) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
        }
        const { data: authData } = await supabaseAdmin.auth.getUser(token)
        const viewerUserId = authData?.user?.id
        if (!viewerUserId) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
        }

        if (!targetPostId) {
            return NextResponse.json({ error: "Missing targetPostId" }, { status: 400 })
        }

        const { data: post } = await supabaseAdmin
            .from("lfg_posts")
            .select("user_id")
            .eq("id", targetPostId)
            .single()

        if (!post) {
            return NextResponse.json({ error: "Post not found" }, { status: 404 })
        }

        const { data: viewerProfile } = await supabaseAdmin
            .from("profiles")
            .select("is_pro")
            .eq("user_id", viewerUserId)
            .single()

        const isPro = viewerProfile?.is_pro ?? false

        if (!isPro) {
            const today = new Date().toISOString().slice(0, 10)
            // Atomic claim via a DB function (serialized per-viewer with an
            // advisory lock) — a plain read-count-then-upsert here let two
            // concurrent reveal requests for different posts both read the
            // same pre-upsert count and both slip past the daily limit.
            const { data: allowed, error: claimError } = await supabaseAdmin.rpc("claim_lfg_reveal", {
                p_viewer_user_id: viewerUserId,
                p_target_post_id: targetPostId,
                p_day: today,
                p_limit: FREE_DAILY_REVEAL_LIMIT,
            })

            if (claimError) {
                return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
            }
            if (!allowed) {
                return NextResponse.json({ allowed: false })
            }
        }

        const { data: targetProfile } = await supabaseAdmin
            .from("profiles")
            .select("discord_tag")
            .eq("user_id", post.user_id)
            .single()

        return NextResponse.json({ allowed: true, discordTag: targetProfile?.discord_tag ?? null })
    } catch {
        return NextResponse.json({ error: "Something went wrong." }, { status: 500 })
    }
}
