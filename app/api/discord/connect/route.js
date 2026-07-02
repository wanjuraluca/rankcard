import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { signState } from "@/lib/discordAuth"

const SITE_URL = "https://rankcard.app"
const REDIRECT_URI = `${SITE_URL}/api/discord/callback`

// Step 1 of "Connect Discord": the logged-in user calls this, we build the
// Discord authorize URL (with a signed state carrying their id) and hand it
// back. The client then redirects the browser to it.
export async function POST(request) {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const { data: authData } = await supabaseAdmin.auth.getUser(token)
    const userId = authData?.user?.id
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const params = new URLSearchParams({
        client_id: process.env.DISCORD_APP_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: "identify",
        state: signState(userId),
        prompt: "consent",
    })

    return NextResponse.json({ url: `https://discord.com/oauth2/authorize?${params}` })
}
