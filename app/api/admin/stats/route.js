import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { isAdminUsername } from "@/lib/admin"

function dateKey(d) {
    return d.toISOString().slice(0, 10)
}

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

    const now = new Date()
    const todayKey = dateKey(now)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Starting email/OAuth signup creates an auth.users row (and, via a DB
    // trigger, a matching profiles row) before the user ever picks a
    // username — abandoning that step (never confirming email, closing the
    // OAuth username prompt) leaves a permanent username=null profiles row
    // behind. These aren't real accounts, so every count/list here excludes
    // them rather than showing junk "Recent signups" with no username.
    const [
        { data: allProfiles },
        { data: accountsByPlatform },
        { count: activeLfgPosts },
        { count: totalLfgPosts },
        { count: totalFollows },
        { count: totalNotifications },
        { data: guildConfigs },
        { data: activityRows },
    ] = await Promise.all([
        supabaseAdmin.from("profiles").select("username, avatar_url, is_pro, created_at, stripe_customer_id, discord_user_id, discord_tag, view_count, season_high, bio, theme, user_id").not("username", "is", null).order("created_at", { ascending: false }),
        supabaseAdmin.from("connected_accounts").select("user_id, platform"),
        supabaseAdmin.from("lfg_posts").select("*", { count: "exact", head: true }).gt("expires_at", new Date().toISOString()),
        supabaseAdmin.from("lfg_posts").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("follows").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("notifications").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("guild_role_configs").select("guild_id"),
        supabaseAdmin.from("activity_days").select("user_id, day").gte("day", dateKey(thirtyDaysAgo)),
    ])

    const profiles = allProfiles ?? []
    const totalUsers = profiles.length
    const totalPro = profiles.filter(p => p.is_pro).length
    const signupsLast7d = profiles.filter(p => new Date(p.created_at) >= sevenDaysAgo).length
    const signupsLast30d = profiles.filter(p => new Date(p.created_at) >= thirtyDaysAgo).length
    const discordLinked = profiles.filter(p => p.discord_user_id).length
    // Reached Stripe checkout (customer created) but never converted to Pro —
    // the actual drop-off point in the funnel, not just "0 conversions".
    const abandonedCheckout = profiles.filter(p => p.stripe_customer_id && !p.is_pro).length
    const totalViews = profiles.reduce((sum, p) => sum + (p.view_count ?? 0), 0)
    const topViewed = [...profiles]
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, 5)
        .map(p => ({ username: p.username, avatar_url: p.avatar_url, view_count: p.view_count ?? 0 }))

    const platformCounts = {}
    const accountedUserIds = new Set()
    for (const row of accountsByPlatform ?? []) {
        platformCounts[row.platform] = (platformCounts[row.platform] ?? 0) + 1
        accountedUserIds.add(row.user_id)
    }
    const zeroAccountUsers = profiles.filter(p => !accountedUserIds.has(p.user_id)).length
    const avgAccountsPerUser = totalUsers ? (accountsByPlatform ?? []).length / totalUsers : 0

    const discordServers = new Set((guildConfigs ?? []).map(g => g.guild_id)).size

    // Signups per day, last 30 days — for the growth chart.
    const signupsByDay = {}
    for (const p of profiles) {
        const key = dateKey(new Date(p.created_at))
        if (new Date(p.created_at) >= thirtyDaysAgo) signupsByDay[key] = (signupsByDay[key] ?? 0) + 1
    }

    // DAU/WAU/MAU from activity_days (one row per user per calendar day,
    // written by a client-side ping in TopNav.jsx once per browser per day).
    const activeUserIdsByDay = {}
    const activeSetLast7 = new Set()
    const activeSetLast30 = new Set()
    for (const row of activityRows ?? []) {
        activeUserIdsByDay[row.day] ??= new Set()
        activeUserIdsByDay[row.day].add(row.user_id)
        if (new Date(row.day) >= sevenDaysAgo) activeSetLast7.add(row.user_id)
        activeSetLast30.add(row.user_id)
    }
    const dau = activeUserIdsByDay[todayKey]?.size ?? 0
    const wau = activeSetLast7.size
    const mau = activeSetLast30.size

    const activityByDay = []
    for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = dateKey(d)
        activityByDay.push({ date: key, count: activeUserIdsByDay[key]?.size ?? 0 })
    }

    const signupsByDayArr = []
    for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const key = dateKey(d)
        signupsByDayArr.push({ date: key, count: signupsByDay[key] ?? 0 })
    }

    return Response.json({
        totalUsers,
        totalPro,
        conversionRate: totalUsers ? totalPro / totalUsers : 0,
        signupsLast7d,
        signupsLast30d,
        activeLfgPosts: activeLfgPosts ?? 0,
        totalLfgPosts: totalLfgPosts ?? 0,
        discordLinked,
        platformCounts,
        recentSignups: profiles.slice(0, 200),
        abandonedCheckout,
        totalViews,
        topViewed,
        zeroAccountUsers,
        avgAccountsPerUser,
        totalFollows: totalFollows ?? 0,
        totalNotifications: totalNotifications ?? 0,
        discordServers,
        dau,
        wau,
        mau,
        stickiness: mau ? dau / mau : 0,
        activityByDay,
        signupsByDay: signupsByDayArr,
    })
}
