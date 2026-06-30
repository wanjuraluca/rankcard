import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const FREE_DAILY_REVEAL_LIMIT = 3

export async function POST(request) {
    try {
        const { viewerUserId, targetPostId } = await request.json()

        if (!viewerUserId || !targetPostId) {
            return NextResponse.json({ error: "Missing viewerUserId or targetPostId" }, { status: 400 })
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
            const { data: revealsToday } = await supabaseAdmin
                .from("lfg_discord_reveals")
                .select("target_post_id")
                .eq("viewer_user_id", viewerUserId)
                .eq("revealed_on", today)

            const revealedPostIds = new Set((revealsToday ?? []).map(r => r.target_post_id))
            const alreadyRevealedThisPost = revealedPostIds.has(targetPostId)

            if (!alreadyRevealedThisPost && revealedPostIds.size >= FREE_DAILY_REVEAL_LIMIT) {
                return NextResponse.json({ allowed: false })
            }

            if (!alreadyRevealedThisPost) {
                await supabaseAdmin
                    .from("lfg_discord_reveals")
                    .upsert(
                        { viewer_user_id: viewerUserId, target_post_id: targetPostId, revealed_on: today },
                        { onConflict: "viewer_user_id,target_post_id,revealed_on", ignoreDuplicates: true }
                    )
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
