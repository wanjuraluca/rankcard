import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

// This endpoint has no auth (anonymous visitors need to register a view too),
// so anything hitting it can otherwise inflate any profile's view count in a
// loop. The client already dedupes per-tab via sessionStorage, but that's
// trivially bypassed by a script — this per-IP+username cooldown blunts that
// without needing a DB migration for real per-viewer tracking.
const VIEW_COOLDOWN_MS = 60 * 1000
const recentViews = new Map()

export async function POST(request) {
    const { username } = await request.json().catch(() => ({}))
    if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const key = `${ip}:${username}`
    const now = Date.now()
    const last = recentViews.get(key)
    if (last && now - last < VIEW_COOLDOWN_MS) {
        return NextResponse.json({ ok: true, skipped: true })
    }
    recentViews.set(key, now)

    await supabaseAdmin.rpc("increment_profile_views", { p_username: username })

    return NextResponse.json({ ok: true })
}
