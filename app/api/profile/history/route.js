import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

    // Get profile + all connected account IDs
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("username", username)
        .maybeSingle()

    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: accounts } = await supabaseAdmin
        .from("connected_accounts")
        .select("id")
        .eq("user_id", profile.user_id)

    if (!accounts?.length) return NextResponse.json([])

    const accountIds = accounts.map(a => a.id)

    // Fetch last 60 days of history across all accounts
    const since = new Date()
    since.setDate(since.getDate() - 60)

    const { data: rows } = await supabaseAdmin
        .from("rank_history")
        .select("score, recorded_date")
        .in("account_id", accountIds)
        .gte("recorded_date", since.toISOString().slice(0, 10))
        .order("recorded_date", { ascending: true })

    if (!rows?.length) return NextResponse.json([])

    // Group by date, average scores across accounts
    const byDate = {}
    for (const row of rows) {
        if (!byDate[row.recorded_date]) byDate[row.recorded_date] = []
        byDate[row.recorded_date].push(row.score)
    }

    const points = Object.entries(byDate).map(([date, scores]) => ({
        date,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))

    return NextResponse.json(points)
}
