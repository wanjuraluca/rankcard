// One-off script: registers RankCard's slash commands globally, so they show
// up in any server the bot is invited to — not just a single test guild.
// Uses a bulk PUT, so it's idempotent — running it again just overwrites the
// application's global command set with exactly the commands below. Global
// commands can take up to an hour to propagate (guild-scoped ones are
// instant, which is why this used to target DISCORD_TEST_GUILD_ID during
// early development — now that the bot needs to work in servers we don't
// control, global is the only option).
//
// Run from the project root:
//   node --env-file=.env.local scripts/register-discord-command.mjs
//
// Needs these in .env.local:
//   DISCORD_APP_ID, DISCORD_BOT_TOKEN

const APP_ID = process.env.DISCORD_APP_ID
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN

if (!APP_ID || !BOT_TOKEN) {
    console.error("Missing DISCORD_APP_ID or DISCORD_BOT_TOKEN in your env.")
    process.exit(1)
}

// Riot's League tiers, stored uppercase to match the rank API's tier strings.
const LOL_TIER_CHOICES = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Emerald", "Diamond", "Master", "Grandmaster", "Challenger"]
    .map(t => ({ name: t, value: t.toUpperCase() }))

const commands = [
    {
        name: "rankcard",
        description: "Show a player's RankCard",
        options: [
            { name: "username", description: "The RankCard username, e.g. Luca", type: 3, required: true },
        ],
    },
    {
        name: "rankcard-setup",
        description: "Map a League rank to a Discord role for this server",
        default_member_permissions: "268435456", // Manage Roles — only admins see it
        dm_permission: false,
        options: [
            { name: "tier", description: "League rank tier", type: 3, required: true, choices: LOL_TIER_CHOICES },
            { name: "role", description: "Role to assign to members at this rank", type: 8, required: true },
        ],
    },
]

const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`

const res = await fetch(url, {
    method: "PUT",
    headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
})

if (res.ok) {
    console.log(`✅ Registered ${commands.length} commands globally: ${commands.map(c => "/" + c.name).join(", ")}`)
    console.log("Global commands can take up to an hour to appear in servers.")
} else {
    console.error(`❌ Failed (${res.status}):`, await res.text())
    process.exit(1)
}
