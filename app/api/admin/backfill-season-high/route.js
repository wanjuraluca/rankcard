import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { getLeagueScore, getTftScore } from "@/lib/rankScore"

/* One-off backfill: season_high was silently never persisted before the
   RLS fix (see /api/profile/season-high), so existing users sit at null and
   the leaderboard only fills as owners revisit their profiles. This computes
   a season_high from the daily lp_history / tft_lp_history snapshots we
   already have — no external API calls.

   Only users whose connected accounts are ALL League/TFT get a value: for
   anyone with other games, a League/TFT-only average could exceed their true
   cross-game average, and the only-raise rule would lock that inflated
   number in permanently.

   GET ?dry=1 previews what would be written (read-only). POST applies it.
   Both require the CRON_SECRET bearer, same as the snapshot cron. */

const SNAPSHOT_PLATFORMS = ["League of Legends", "TFT"]

async function computeBackfill() {
    const [{ data: profiles }, { data: accounts }, { data: lpRows }, { data: tftRows }] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id, username, season_high").not("username", "is", null).neq("username", ""),
        supabaseAdmin.from("connected_accounts").select("id, user_id, platform"),
        supabaseAdmin.from("lp_history").select("connected_account_id, tier, rank, recorded_on").order("recorded_on", { ascending: false }),
        supabaseAdmin.from("tft_lp_history").select("connected_account_id, tier, rank, recorded_on").eq("queue_type", "RANKED_TFT").order("recorded_on", { ascending: false }),
    ])

    // Rows are newest-first, so the first row seen per account is its latest snapshot
    const latestLeague = new Map()
    for (const row of lpRows ?? []) {
        if (!latestLeague.has(row.connected_account_id)) latestLeague.set(row.connected_account_id, row)
    }
    const latestTft = new Map()
    for (const row of tftRows ?? []) {
        if (!latestTft.has(row.connected_account_id)) latestTft.set(row.connected_account_id, row)
    }

    const accountsByUser = new Map()
    for (const account of accounts ?? []) {
        if (!accountsByUser.has(account.user_id)) accountsByUser.set(account.user_id, [])
        accountsByUser.get(account.user_id).push(account)
    }

    const updates = []
    const skipped = []
    for (const profile of profiles ?? []) {
        const userAccounts = accountsByUser.get(profile.user_id) ?? []
        if (userAccounts.length === 0) { skipped.push({ username: profile.username, reason: "no accounts" }); continue }
        if (!userAccounts.every(a => SNAPSHOT_PLATFORMS.includes(a.platform))) {
            skipped.push({ username: profile.username, reason: "has non-League/TFT games" })
            continue
        }

        const scores = userAccounts
            .map(a => {
                const snap = a.platform === "TFT" ? latestTft.get(a.id) : latestLeague.get(a.id)
                if (!snap) return null
                return a.platform === "TFT" ? getTftScore(snap.tier, snap.rank) : getLeagueScore(snap.tier, snap.rank)
            })
            .filter(s => s != null)
        if (scores.length === 0) { skipped.push({ username: profile.username, reason: "no snapshots" }); continue }

        const avg = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        if (profile.season_high != null && profile.season_high >= avg) {
            skipped.push({ username: profile.username, reason: `existing season_high ${profile.season_high} >= ${avg}` })
            continue
        }
        updates.push({ username: profile.username, user_id: profile.user_id, from: profile.season_high, to: avg })
    }

    return { updates, skipped }
}

function authorized(request) {
    return request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request) {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 })
    const { updates, skipped } = await computeBackfill()
    return Response.json({ dryRun: true, wouldUpdate: updates.length, updates, skippedCount: skipped.length, skipped })
}

export async function POST(request) {
    if (!authorized(request)) return new Response("Unauthorized", { status: 401 })
    const { updates, skipped } = await computeBackfill()

    const results = await Promise.all(
        updates.map(async (u) => {
            const { error } = await supabaseAdmin
                .from("profiles")
                .update({ season_high: u.to })
                .eq("user_id", u.user_id)
            return { username: u.username, to: u.to, ok: !error, error: error?.message }
        })
    )

    return Response.json({
        updated: results.filter(r => r.ok).length,
        failed: results.filter(r => !r.ok),
        skippedCount: skipped.length,
    })
}
