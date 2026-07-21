import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// ProfileClient used to write season_high straight to the profiles table with
// the client-side supabase instance — that update dies silently against RLS
// (no UPDATE policy → PostgREST "succeeds" with 0 rows), so season_high was
// never actually persisted for anyone. Same fix pattern as view_count: go
// through a server route with the admin client, scoped to the caller's own row.
export async function POST(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const { data: userData } = await supabaseAdmin.auth.getUser(accessToken)
    const user = userData?.user
    if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const { score } = await request.json().catch(() => ({}))
    // Rank Score lives on a 0–3000 scale (lib/rankScore.js MAX_SCORE)
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 3000) {
        return NextResponse.json({ error: "Invalid score" }, { status: 400 })
    }
    const rounded = Math.round(score)

    // Only ever raise the stored high — a lower current score keeps the peak
    const { error } = await supabaseAdmin
        .from("profiles")
        .update({ season_high: rounded })
        .eq("user_id", user.id)
        .or(`season_high.is.null,season_high.lt.${rounded}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
