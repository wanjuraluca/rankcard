import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function POST(request) {
    const { type, message, username } = await request.json().catch(() => ({}))

    if (!message?.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 })
    if (!["feedback", "bug"].includes(type)) return NextResponse.json({ error: "Invalid type" }, { status: 400 })

    const { error } = await supabaseAdmin.from("feedback").insert({
        type,
        message: message.trim().slice(0, 2000),
        username: username ?? null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
