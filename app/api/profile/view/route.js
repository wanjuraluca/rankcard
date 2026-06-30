import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function POST(request) {
    const { username } = await request.json().catch(() => ({}))
    if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

    await supabaseAdmin.rpc("increment_profile_views", { p_username: username })

    return NextResponse.json({ ok: true })
}
