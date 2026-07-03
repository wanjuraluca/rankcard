import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Rank-role sync. For every server that configured rank->role mappings, give
// each linked member the role matching their current League tier and strip any
// other managed rank-role. Triggered by Vercel Cron (see vercel.json) or
// manually with the CRON_SECRET bearer token.

const DISCORD_API = "https://discord.com/api/v10"
const RIOT_PLATFORM = "euw1"

function discordFetch(path, options = {}) {
    return fetch(`${DISCORD_API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            "X-Audit-Log-Reason": "RankCard rank sync",
            ...options.headers,
        },
    })
}

// Current Solo/Duo tier for a League puuid (e.g. "DIAMOND"), or null if unranked.
async function fetchLeagueTier(puuid) {
    try {
        const res = await fetch(
            `https://${RIOT_PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
            { headers: { "X-Riot-Token": process.env.RIOT_API_KEY } }
        )
        const data = await res.json()
        const solo = Array.isArray(data) ? data.find(e => e.queueType === "RANKED_SOLO_5x5") : null
        return solo?.tier ?? null
    } catch {
        return null
    }
}

export async function GET(request) {
    if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 })
    }

    // 1. Load rank->role configs, grouped per guild.
    const { data: configs } = await supabaseAdmin
        .from("guild_role_configs")
        .select("guild_id, tier, role_id")
        .eq("game", "League of Legends")

    if (!configs?.length) return Response.json({ assigned: 0, removed: 0, skipped: 0, note: "no configs" })

    const guilds = {}
    for (const c of configs) {
        guilds[c.guild_id] ??= { tierToRole: {}, managedRoles: new Set() }
        guilds[c.guild_id].tierToRole[c.tier] = c.role_id
        guilds[c.guild_id].managedRoles.add(c.role_id)
    }

    // 2. Load linked profiles and map each to their League puuid.
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

    // 3. Sync each linked member in each configured guild.
    let assigned = 0, removed = 0, skipped = 0
    for (const [guildId, cfg] of Object.entries(guilds)) {
        for (const profile of linked) {
            const puuid = puuidByUser[profile.user_id]
            if (!puuid) { skipped++; continue }

            // Single-member lookup: also tells us if they're in the guild at all
            // (404) and what roles they already have — no privileged intent needed.
            const memberRes = await discordFetch(`/guilds/${guildId}/members/${profile.discord_user_id}`)
            if (!memberRes.ok) { skipped++; continue }
            const currentRoles = (await memberRes.json()).roles ?? []

            const tier = await fetchLeagueTier(puuid)
            const targetRole = tier ? cfg.tierToRole[tier] : null

            if (targetRole && !currentRoles.includes(targetRole)) {
                const r = await discordFetch(`/guilds/${guildId}/members/${profile.discord_user_id}/roles/${targetRole}`, { method: "PUT" })
                if (r.ok) assigned++
            }

            // Strip any other rank-role we manage so ranks don't stack up.
            for (const roleId of currentRoles) {
                if (cfg.managedRoles.has(roleId) && roleId !== targetRole) {
                    const r = await discordFetch(`/guilds/${guildId}/members/${profile.discord_user_id}/roles/${roleId}`, { method: "DELETE" })
                    if (r.ok) removed++
                }
            }
        }
    }

    return Response.json({ assigned, removed, skipped })
}
