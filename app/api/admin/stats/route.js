import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { isAdminUsername } from "@/lib/admin"

export async function GET(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")

    if (!accessToken) {
        return Response.json({ error: "Not authenticated." }, { status: 401 })
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) {
        return Response.json({ error: "Not authenticated." }, { status: 401 })
    }

    const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .eq("user_id", userData.user.id)
        .maybeSingle()

    if (!isAdminUsername(callerProfile?.username)) {
        return Response.json({ error: "Not authorized." }, { status: 403 })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
        { count: totalUsers },
        { count: totalPro },
        { count: signupsLast7d },
        { count: signupsLast30d },
        { data: recentSignups },
        { data: accountsByPlatform },
        { count: activeLfgPosts },
        { count: discordLinked },
    ] = await Promise.all([
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).eq("is_pro", true),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabaseAdmin.from("profiles").select("username, avatar_url, is_pro, created_at").order("created_at", { ascending: false }).limit(20),
        supabaseAdmin.from("connected_accounts").select("platform"),
        supabaseAdmin.from("lfg_posts").select("*", { count: "exact", head: true }).gt("expires_at", new Date().toISOString()),
        supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }).not("discord_user_id", "is", null),
    ])

    const platformCounts = {}
    for (const row of accountsByPlatform ?? []) {
        platformCounts[row.platform] = (platformCounts[row.platform] ?? 0) + 1
    }

    return Response.json({
        totalUsers: totalUsers ?? 0,
        totalPro: totalPro ?? 0,
        conversionRate: totalUsers ? (totalPro ?? 0) / totalUsers : 0,
        signupsLast7d: signupsLast7d ?? 0,
        signupsLast30d: signupsLast30d ?? 0,
        activeLfgPosts: activeLfgPosts ?? 0,
        discordLinked: discordLinked ?? 0,
        platformCounts,
        recentSignups: recentSignups ?? [],
    })
}
