import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Doesn't delete anything immediately — schedules the account for deletion
// in 14 days by stamping deletion_requested_at. The actual removal happens
// in the daily cron job (app/api/cron/delete-account/route.js), which gives
// the user a grace period to cancel by simply logging back in.
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

    const userId = userData.user.id

    const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ deletion_requested_at: new Date().toISOString() })
        .eq("user_id", userId)

    if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ success: true })
}
