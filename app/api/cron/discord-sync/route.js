import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { loadGuildConfigs, syncMemberAcrossGuilds } from "@/lib/discordSync"

// Rank-role sync. For every server that configured rank->role mappings, give
// each linked member the role matching their current League tier and strip any
// other managed rank-role. Triggered by Vercel Cron (see vercel.json) or
// manually with the CRON_SECRET bearer token.
//
// This is now a safety-net sweep, not the only path to a role — connecting
// Discord triggers an instant sync for that one user (see
// app/api/discord/callback/route.js). The cron still matters for rank
// changes on days the user doesn't relink, and for catching syncs that
// failed at connect time.

export async function GET(request) {
    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 })
    }

    const guildConfigs = await loadGuildConfigs(supabaseAdmin)
    if (!Object.keys(guildConfigs).length) return Response.json({ assigned: 0, removed: 0, skipped: 0, note: "no configs" })

    const { data: linked } = await supabaseAdmin
        .from("profiles")
        .select("user_id, discord_user_id")
        .not("discord_user_id", "is", null)

    if (!linked?.length) return Response.json({ assigned: 0, removed: 0, skipped: 0, note: "no linked users" })

    const { data: leagueAccounts } = await supabaseAdmin
        .from("connected_accounts")
        .select("user_id, puuid")
        .eq("platform", "League of Legends")
        .in("user_id", linked.map(p => p.user_id))
        .not("puuid", "is", null)

    const puuidByUser = {}
    for (const a of leagueAccounts ?? []) puuidByUser[a.user_id] = a.puuid

    let assigned = 0, removed = 0, skipped = 0
    for (const profile of linked) {
        const r = await syncMemberAcrossGuilds(profile.discord_user_id, puuidByUser[profile.user_id], guildConfigs)
        assigned += r.assigned
        removed += r.removed
        skipped += r.skipped
    }

    return Response.json({ assigned, removed, skipped })
}
