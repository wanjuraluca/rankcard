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

    // A DB trigger creates a blank profiles row (no username) immediately on
    // signup, before this step ever runs — so a row existing isn't enough to
    // mean "already has a profile", only a row with a username set does.
    // Checking mere existence here used to reject every OAuth user's first
    // (and only) attempt to actually finish signing up.
    const { data: existingForUser } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle()
    if (existingForUser?.username) {
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

    // upsert, not insert: the trigger-created blank row for this user_id
    // already exists, so a plain insert would hit that row's unique
    // constraint and fail every time.
    const { error: insertError } = await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: user.id, username, avatar_url: avatarUrl, referred_by: referredBy || null }, { onConflict: "user_id" })

    if (insertError) {
        return Response.json({ error: "Could not create your profile." }, { status: 500 })
    }

    return Response.json({ success: true, username })
}
