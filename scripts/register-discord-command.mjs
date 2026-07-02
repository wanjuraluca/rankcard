// One-off script: tells Discord that the /rankcard command exists.
// Registering it to a single guild (your test server) makes it appear instantly;
// global commands can take up to an hour to show up.
//
// Run from the project root:
//   node --env-file=.env.local scripts/register-discord-command.mjs
//
// Needs these in .env.local:
//   DISCORD_APP_ID, DISCORD_BOT_TOKEN, DISCORD_TEST_GUILD_ID

const APP_ID = process.env.DISCORD_APP_ID
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_TEST_GUILD_ID

if (!APP_ID || !BOT_TOKEN || !GUILD_ID) {
    console.error("Missing DISCORD_APP_ID, DISCORD_BOT_TOKEN or DISCORD_TEST_GUILD_ID in your env.")
    process.exit(1)
}

const command = {
    name: "rankcard",
    description: "Show a player's RankCard",
    options: [
        {
            name: "username",
            description: "The RankCard username, e.g. Luca",
            type: 3, // STRING
            required: true,
        },
    ],
}

const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`

const res = await fetch(url, {
    method: "POST",
    headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
})

if (res.ok) {
    console.log("✅ /rankcard registered on the test server.")
} else {
    console.error(`❌ Failed (${res.status}):`, await res.text())
    process.exit(1)
}
