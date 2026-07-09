import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

async function getUserFromRequest(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) return null
    const { data } = await supabaseAdmin.auth.getUser(accessToken)
    return data?.user ?? null
}

// A "follow" row inserted straight into the follows table (see
// ProfileClient.jsx's handleFollow) triggers a DB trigger (on_follow_created,
// see the notifications migration) that writes the notifications row —
// nothing here creates one, this route only ever reads/marks-read.
export async function GET(request) {
    const user = await getUserFromRequest(request)
    if (!user) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    const { data: rows } = await supabaseAdmin
        .from("notifications")
        .select("id, type, actor_id, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)

    const actorIds = [...new Set((rows ?? []).map(r => r.actor_id).filter(Boolean))]
    const actorsById = {}
    if (actorIds.length > 0) {
        const { data: actors } = await supabaseAdmin
            .from("profiles")
            .select("user_id, username, avatar_url")
            .in("user_id", actorIds)
        for (const actor of actors ?? []) {
            actorsById[actor.user_id] = { username: actor.username, avatarUrl: actor.avatar_url }
        }
    }

    const notifications = (rows ?? []).map(r => ({
        id: r.id,
        type: r.type,
        read: !!r.read_at,
        createdAt: r.created_at,
        actor: actorsById[r.actor_id] ?? null,
    }))
    const unreadCount = notifications.filter(n => !n.read).length

    return NextResponse.json({ notifications, unreadCount })
}

// Marks every unread notification for the current user as read — called
// when the bell dropdown is opened, matching how most notification bells
// (Discord, GitHub) clear the badge on open rather than per-item.
export async function PATCH(request) {
    const user = await getUserFromRequest(request)
    if (!user) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    await supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null)

    return NextResponse.json({ ok: true })
}

// "Clear all" button in the bell dropdown — removes every notification for
// the current user outright, not just marking them read.
export async function DELETE(request) {
    const user = await getUserFromRequest(request)
    if (!user) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
    }

    await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("user_id", user.id)

    return NextResponse.json({ ok: true })
}
