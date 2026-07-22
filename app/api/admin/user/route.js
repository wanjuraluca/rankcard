import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { isAdminUsername } from "@/lib/admin"

// Only these profile columns can be edited from the admin dashboard. Anything
// not on this list (user_id, username, created_at, stripe_customer_id, ...) is
// silently ignored so a stray/typo'd key can never overwrite identity or
// billing state.
const EDITABLE_FIELDS = {
    is_pro: "boolean",
    view_count: "int",
    season_high: "intOrNull",
    bio: "textOrNull",
    discord_tag: "textOrNull",
    theme: "textOrNull",
}

function coerce(type, value) {
    switch (type) {
        case "boolean":
            return { ok: true, value: !!value }
        case "int": {
            const n = Math.round(Number(value))
            if (!Number.isFinite(n) || n < 0) return { ok: false }
            return { ok: true, value: n }
        }
        case "intOrNull": {
            if (value === null || value === "" || value === undefined) return { ok: true, value: null }
            const n = Math.round(Number(value))
            if (!Number.isFinite(n) || n < 0) return { ok: false }
            return { ok: true, value: n }
        }
        case "textOrNull": {
            if (value === null || value === undefined) return { ok: true, value: null }
            const s = String(value).trim()
            return { ok: true, value: s === "" ? null : s }
        }
        default:
            return { ok: false }
    }
}

async function requireAdmin(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) return { error: Response.json({ error: "Not authenticated." }, { status: 401 }) }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) return { error: Response.json({ error: "Not authenticated." }, { status: 401 }) }

    const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .eq("user_id", userData.user.id)
        .maybeSingle()

    if (!isAdminUsername(callerProfile?.username)) {
        return { error: Response.json({ error: "Not authorized." }, { status: 403 }) }
    }
    return { ok: true }
}

export async function PATCH(request) {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    let body
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON." }, { status: 400 })
    }

    const { username, updates } = body
    if (!username || typeof username !== "string") {
        return Response.json({ error: "username is required." }, { status: 400 })
    }
    if (!updates || typeof updates !== "object") {
        return Response.json({ error: "updates object is required." }, { status: 400 })
    }

    const patch = {}
    for (const [key, rawValue] of Object.entries(updates)) {
        const type = EDITABLE_FIELDS[key]
        if (!type) continue // ignore non-whitelisted keys
        const coerced = coerce(type, rawValue)
        if (!coerced.ok) {
            return Response.json({ error: `Invalid value for "${key}".` }, { status: 400 })
        }
        patch[key] = coerced.value
    }

    if (Object.keys(patch).length === 0) {
        return Response.json({ error: "No editable fields provided." }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .update(patch)
        .eq("username", username)
        .select("username, is_pro, view_count, season_high, bio, discord_tag, theme")
        .maybeSingle()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    if (!data) return Response.json({ error: "Profile not found." }, { status: 404 })

    return Response.json({ profile: data })
}

// Permanently deletes a profile: its connected accounts, the profiles row, and
// the underlying auth user — the same teardown the deletion-grace-period cron
// runs (app/api/cron/delete-account), just triggered immediately by an admin.
export async function DELETE(request) {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    let body
    try {
        body = await request.json()
    } catch {
        return Response.json({ error: "Invalid JSON." }, { status: 400 })
    }

    const { username } = body
    if (!username || typeof username !== "string") {
        return Response.json({ error: "username is required." }, { status: 400 })
    }

    // Guard against wiping an admin account by accident/abuse.
    if (isAdminUsername(username)) {
        return Response.json({ error: "Admin accounts can't be deleted here." }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username")
        .eq("username", username)
        .maybeSingle()

    if (!profile) return Response.json({ error: "Profile not found." }, { status: 404 })

    try {
        await supabaseAdmin.from("connected_accounts").delete().eq("user_id", profile.user_id)
        await supabaseAdmin.from("profiles").delete().eq("user_id", profile.user_id)

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id)
        // A missing auth user (e.g. a seeded/demo profile with no auth row) is
        // fine — the profile is already gone, which is the point.
        if (authError && !/not found|does not exist/i.test(authError.message)) {
            return Response.json({ error: authError.message }, { status: 500 })
        }
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 })
    }

    return Response.json({ success: true, username: profile.username })
}
