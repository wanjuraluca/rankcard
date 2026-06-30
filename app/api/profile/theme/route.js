import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const VALID_PRESETS = ["default", "gold", "teal", "rose"]
const CUSTOM_RE = /^custom:#[0-9a-fA-F]{6}$/

export async function PUT(request) {
    const authHeader = request.headers.get("Authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { theme } = await request.json().catch(() => ({}))
    if (!VALID_PRESETS.includes(theme) && !CUSTOM_RE.test(theme))
        return NextResponse.json({ error: "Invalid theme" }, { status: 400 })

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { error } = await supabaseAdmin
        .from("profiles")
        .update({ theme })
        .eq("user_id", user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
