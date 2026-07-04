import { supabaseAdmin } from "@/lib/supabaseAdmin"

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export async function POST(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) {
        return Response.json({ error: "Not authenticated." }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) {
        return Response.json({ error: "Not authenticated." }, { status: 401 })
    }

    const { username, referredBy } = await request.json()
    if (!username || !USERNAME_PATTERN.test(username)) {
        return Response.json({ error: "Invalid username." }, { status: 400 })
    }

    const user = userData.user

    const { data: existingForUser } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle()
    if (existingForUser) {
        return Response.json({ error: "You already have a profile." }, { status: 409 })
    }

    const { data: existingUsername } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .ilike("username", username)
        .maybeSingle()
    if (existingUsername) {
        return Response.json({ error: "This username is already taken." }, { status: 409 })
    }

    const meta = user.user_metadata ?? {}
    const avatarUrl = meta.avatar_url ?? meta.picture ?? null

    const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({ user_id: user.id, username, avatar_url: avatarUrl, referred_by: referredBy || null })

    if (insertError) {
        return Response.json({ error: "Could not create your profile." }, { status: 500 })
    }

    return Response.json({ success: true, username })
}
