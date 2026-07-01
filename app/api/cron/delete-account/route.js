import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Called daily by Vercel Cron (see vercel.json). Permanently deletes any
// account that requested deletion (via app/api/account/delete) at least
// 14 days ago and hasn't logged back in since to cancel it (login flow
// resets deletion_requested_at to null — see app/auth/page.jsx).
export async function GET(request) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 })
    }

    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { data: profiles, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username")
        .not("deletion_requested_at", "is", null)
        .lte("deletion_requested_at", cutoff)

    if (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }

    const results = await Promise.all(
        (profiles ?? []).map(profile => deleteProfile(profile))
    )

    return Response.json({
        deleted: results.filter(r => r.ok).length,
        results,
    })
}

async function deleteProfile(profile) {
    try {
        await supabaseAdmin.from("connected_accounts").delete().eq("user_id", profile.user_id)
        await supabaseAdmin.from("profiles").delete().eq("user_id", profile.user_id)

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id)
        if (deleteError) return { ok: false, userId: profile.user_id, username: profile.username, reason: deleteError.message }

        return { ok: true, userId: profile.user_id, username: profile.username }
    } catch (err) {
        return { ok: false, userId: profile.user_id, username: profile.username, reason: err.message }
    }
}
