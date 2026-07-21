import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Clears a pending account-deletion request. Runs on every login (password
// and OAuth) so "log back in to cancel" actually persists — via the admin
// client, not a client-side profiles update, since we can't rely on the
// deletion_requested_at column's RLS/GRANT the way account/delete already
// goes server-side for the delete itself. No-ops harmlessly when nothing was
// scheduled.
export async function POST(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) return Response.json({ error: "Not authenticated." }, { status: 401 })

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) return Response.json({ error: "Not authenticated." }, { status: 401 })

    const { error } = await supabaseAdmin
        .from("profiles")
        .update({ deletion_requested_at: null })
        .eq("user_id", userData.user.id)
        .not("deletion_requested_at", "is", null)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
}
