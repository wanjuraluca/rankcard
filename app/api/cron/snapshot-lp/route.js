import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { detectPlatform } from "@/lib/riotPlatform"

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

    const { data: tftAccounts, error: tftError } = await supabaseAdmin
        .from("connected_accounts")
        .select("id, puuid")
        .eq("platform", "TFT")
        .not("puuid", "is", null)

    if (tftError) {
        return Response.json({ error: tftError.message }, { status: 500 })
    }

    const results = await Promise.all(
        leagueAccounts.map(account => snapshotAccount(account))
    )

    const tftResults = await Promise.all(
        (tftAccounts ?? []).map(account => snapshotTftAccount(account))
    )

    return Response.json({
        snapshotted: results.filter(r => r.ok).length,
        skipped: results.filter(r => !r.ok).length,
        tftSnapshotted: tftResults.flat().filter(r => r.ok).length,
        tftSkipped: tftResults.flat().filter(r => !r.ok).length,
        results,
        tftResults
    })
}

async function snapshotAccount(account) {
    try {
        const platform = await detectPlatform(account.puuid)
        const response = await fetch(
            `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
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

// TFT exposes both ranked queues (RANKED_TFT and RANKED_TFT_DOUBLE_UP) as
// separate entries in the same by-puuid response — snapshot whichever of
// the two are present for this account into tft_lp_history, one row per
// queue per day (see queue_type column / UNIQUE constraint).
async function snapshotTftAccount(account) {
    try {
        const platform = await detectPlatform(account.puuid)
        const response = await fetch(
            `https://${platform}.api.riotgames.com/tft/league/v1/by-puuid/${account.puuid}`,
            { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
        )
        const tftData = await response.json()
        if (!Array.isArray(tftData) || tftData.length === 0) {
            return [{ ok: false, accountId: account.id, reason: "no TFT ranked entries" }]
        }

        const recordedOn = new Date().toISOString().slice(0, 10)
        const results = await Promise.all(
            tftData
                .filter(entry => entry.queueType === "RANKED_TFT" || entry.queueType === "RANKED_TFT_DOUBLE_UP")
                .map(async (entry) => {
                    const { error: insertError } = await supabaseAdmin
                        .from("tft_lp_history")
                        .upsert({
                            connected_account_id: account.id,
                            queue_type: entry.queueType,
                            tier: entry.tier,
                            rank: entry.rank,
                            league_points: entry.leaguePoints,
                            wins: entry.wins,
                            losses: entry.losses,
                            recorded_on: recordedOn
                        }, { onConflict: "connected_account_id,queue_type,recorded_on" })

                    if (insertError) return { ok: false, accountId: account.id, queueType: entry.queueType, reason: insertError.message }
                    return { ok: true, accountId: account.id, queueType: entry.queueType }
                })
        )
        return results
    } catch (err) {
        return [{ ok: false, accountId: account.id, reason: err.message }]
    }
}
