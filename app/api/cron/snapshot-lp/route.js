import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Called daily by Vercel Cron (see vercel.json). Fetches the current Solo/Duo
// rank for every connected League of Legends account and stores a snapshot,
// so we can chart LP history over time instead of only showing a live value.
export async function GET(request) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 })
    }

    const { data: leagueAccounts, error } = await supabaseAdmin
        .from("connected_accounts")
        .select("id, puuid")
        .eq("platform", "League of Legends")
        .not("puuid", "is", null)

    if (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }

    const results = await Promise.all(
        leagueAccounts.map(account => snapshotAccount(account))
    )

    return Response.json({
        snapshotted: results.filter(r => r.ok).length,
        skipped: results.filter(r => !r.ok).length,
        results
    })
}

async function snapshotAccount(account) {
    try {
        const response = await fetch(
            `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
            { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
        )
        const rankData = await response.json()
        const soloDuo = Array.isArray(rankData)
            ? rankData.find(entry => entry.queueType === "RANKED_SOLO_5x5")
            : null

        if (!soloDuo) return { ok: false, accountId: account.id, reason: "no Solo/Duo rank" }

        const { error: insertError } = await supabaseAdmin
            .from("lp_history")
            .upsert({
                connected_account_id: account.id,
                tier: soloDuo.tier,
                rank: soloDuo.rank,
                league_points: soloDuo.leaguePoints,
                wins: soloDuo.wins,
                losses: soloDuo.losses,
                recorded_on: new Date().toISOString().slice(0, 10)
            }, { onConflict: "connected_account_id,recorded_on" })

        if (insertError) return { ok: false, accountId: account.id, reason: insertError.message }
        return { ok: true, accountId: account.id }
    } catch (err) {
        return { ok: false, accountId: account.id, reason: err.message }
    }
}
