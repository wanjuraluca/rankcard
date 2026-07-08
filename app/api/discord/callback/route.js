import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { verifyState } from "@/lib/discordAuth"
import { loadGuildConfigs, syncMemberAcrossGuilds } from "@/lib/discordSync"

const SITE_URL = "https://rankcard.app"
const REDIRECT_URI = `${SITE_URL}/api/discord/callback`

function redirectTo(path) {
    return NextResponse.redirect(`${SITE_URL}${path}`)
}

// Step 2 of "Connect Discord": Discord redirects the user's browser back here
// with a one-time code. We verify our signed state, trade the code for the
// user's Discord identity, and store the verified id on their profile.
export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")

    const userId = state ? verifyState(state) : null
    if (!code || !userId) return redirectTo("/?discord=error")

    // 1. Exchange the one-time code for an access token.
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_APP_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
        }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) return redirectTo("/?discord=error")

    // 2. Look up who just authorized.
    const userRes = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const discordUser = await userRes.json()
    if (!discordUser.id) return redirectTo("/?discord=error")

    // New Discord usernames have no discriminator; keep the legacy name#0000
    // form only if one is still present.
    const discordTag = discordUser.discriminator && discordUser.discriminator !== "0"
        ? `${discordUser.username}#${discordUser.discriminator}`
        : discordUser.username

    // Guard: one Discord account can only be linked to one RankCard profile.
    const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("discord_user_id", discordUser.id)
        .maybeSingle()
    if (existing && existing.user_id !== userId) return redirectTo("/?discord=taken")

    // 3. Store the verified id (drives the role sync) + refresh the tag.
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .update({ discord_user_id: discordUser.id, discord_tag: discordTag })
        .eq("user_id", userId)
        .select("username")
        .single()

    // 4. Instant sync: give this one user their role right away instead of
    // making them wait for the next daily cron run (see lib/discordSync.js).
    // Best-effort — a sync hiccup here must never block the "connected"
    // redirect; the cron sweep still catches it later.
    try {
        const guildConfigs = await loadGuildConfigs(supabaseAdmin)
        if (Object.keys(guildConfigs).length) {
            const { data: leagueAccount } = await supabaseAdmin
                .from("connected_accounts")
                .select("puuid")
                .eq("user_id", userId)
                .eq("platform", "League of Legends")
                .maybeSingle()
            await syncMemberAcrossGuilds(discordUser.id, leagueAccount?.puuid ?? null, guildConfigs)
        }
    } catch {
        // Swallowed — the daily cron is the safety net.
    }

    return redirectTo(profile?.username ? `/${profile.username}?discord=connected` : "/?discord=connected")
}
