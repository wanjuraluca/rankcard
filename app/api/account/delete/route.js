import { supabaseAdmin } from "@/lib/supabaseAdmin"

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

    await supabaseAdmin.from("connected_accounts").delete().eq("user_id", userId)
    await supabaseAdmin.from("profiles").delete().eq("id", userId)

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
        return Response.json({ error: deleteError.message }, { status: 500 })
    }

    return Response.json({ success: true })
}
