// Shared rank->role sync logic, used by both the daily cron
// (app/api/cron/discord-sync/route.js, bulk — every linked member) and the
// instant sync fired right after a user connects Discord
// (app/api/discord/callback/route.js, single member) — extracted so a new
// link doesn't have to wait up to 24h on Hobby's daily-cron limit for its
// first role.

const DISCORD_API = "https://discord.com/api/v10"
const RIOT_PLATFORM = "euw1"

export function discordFetch(path, options = {}) {
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
export async function fetchLeagueTier(puuid) {
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

// guild_role_configs rows, grouped per guild: { [guildId]: { tierToRole, managedRoles } }
export async function loadGuildConfigs(supabaseAdmin) {
    const { data: configs } = await supabaseAdmin
        .from("guild_role_configs")
        .select("guild_id, tier, role_id")
        .eq("game", "League of Legends")

    const guilds = {}
    for (const c of configs ?? []) {
        guilds[c.guild_id] ??= { tierToRole: {}, managedRoles: new Set() }
        guilds[c.guild_id].tierToRole[c.tier] = c.role_id
        guilds[c.guild_id].managedRoles.add(c.role_id)
    }
    return guilds
}

// Syncs one linked Discord member's rank role across every guild that has a
// configured mapping — assigns the role matching their current tier and
// strips any other managed rank-role, so ranks never stack up.
export async function syncMemberAcrossGuilds(discordUserId, puuid, guildConfigs) {
    const guildIds = Object.keys(guildConfigs)
    if (!puuid) return { assigned: 0, removed: 0, skipped: guildIds.length }

    const tier = await fetchLeagueTier(puuid)
    let assigned = 0, removed = 0, skipped = 0

    for (const guildId of guildIds) {
        const cfg = guildConfigs[guildId]

        // Single-member lookup: also tells us if they're in the guild at all
        // (404) and what roles they already have — no privileged intent needed.
        const memberRes = await discordFetch(`/guilds/${guildId}/members/${discordUserId}`)
        if (!memberRes.ok) { skipped++; continue }
        const currentRoles = (await memberRes.json()).roles ?? []

        const targetRole = tier ? cfg.tierToRole[tier] : null

        if (targetRole && !currentRoles.includes(targetRole)) {
            const r = await discordFetch(`/guilds/${guildId}/members/${discordUserId}/roles/${targetRole}`, { method: "PUT" })
            if (r.ok) assigned++
        }

        // Strip any other rank-role we manage so ranks don't stack up.
        for (const roleId of currentRoles) {
            if (cfg.managedRoles.has(roleId) && roleId !== targetRole) {
                const r = await discordFetch(`/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, { method: "DELETE" })
                if (r.ok) removed++
            }
        }
    }

    return { assigned, removed, skipped }
}
