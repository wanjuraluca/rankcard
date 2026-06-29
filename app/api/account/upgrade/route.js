import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Template for the Pro upgrade flow — no payment provider wired up yet.
// Once Stripe is integrated, this route becomes the webhook handler (or this
// logic moves there) that flips is_pro after a successful checkout instead
// of doing it directly on request.
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

    const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update({ is_pro: true })
        .eq("user_id", userData.user.id)

    if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
    }

    return Response.json({ success: true })
}
