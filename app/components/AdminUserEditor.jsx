"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { X, Check, Trash2 } from "lucide-react"

// Admin-only inline editor for a single profile. Writes go through
// /api/admin/user (service-role, field-whitelisted) — never straight to the
// DB from the client, so the same auth + validation guards every change.
export default function AdminUserEditor({ user, onClose, onSaved, onDeleted }) {
    const [isPro, setIsPro] = useState(!!user.is_pro)
    const [viewCount, setViewCount] = useState(String(user.view_count ?? 0))
    const [seasonHigh, setSeasonHigh] = useState(user.season_high == null ? "" : String(user.season_high))
    const [bio, setBio] = useState(user.bio ?? "")
    const [discordTag, setDiscordTag] = useState(user.discord_tag ?? "")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [showDelete, setShowDelete] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState("")
    const [deleting, setDeleting] = useState(false)

    async function handleDelete() {
        setDeleting(true)
        setError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) {
            setError("Session expired. Reload and sign in again.")
            setDeleting(false)
            return
        }

        try {
            const res = await fetch("/api/admin/user", {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username: user.username }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Could not delete.")
                setDeleting(false)
                return
            }
            onDeleted(user.username)
        } catch {
            setError("Network error. Try again.")
            setDeleting(false)
        }
    }

    async function handleSave() {
        setSaving(true)
        setError("")

        const updates = {
            is_pro: isPro,
            view_count: viewCount,
            season_high: seasonHigh,
            bio,
            discord_tag: discordTag,
        }

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) {
            setError("Session expired. Reload and sign in again.")
            setSaving(false)
            return
        }

        try {
            const res = await fetch("/api/admin/user", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username: user.username, updates }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || "Could not save.")
                setSaving(false)
                return
            }
            onSaved(data.profile)
        } catch {
            setError("Network error. Try again.")
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-hairline rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                            {user.avatar_url && <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />}
                        </div>
                        <p className="text-text-primary font-bold truncate">{user.username}</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-primary active:scale-90 transition-transform flex-shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Pro toggle */}
                    <button
                        type="button"
                        onClick={() => setIsPro(v => !v)}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${isPro ? "border-accent bg-accent-tint" : "border-hairline bg-background"}`}
                    >
                        <div className="text-left">
                            <p className="text-sm font-semibold text-text-primary">Pro status</p>
                            <p className="text-xs text-text-secondary">Unlocks all Pro perks for this user.</p>
                        </div>
                        <span className={`grid h-6 w-6 place-items-center rounded-full border flex-shrink-0 ${isPro ? "border-accent bg-accent text-black" : "border-hairline text-transparent"}`}>
                            <Check size={14} />
                        </span>
                    </button>

                    <Field label="View count">
                        <input
                            type="number"
                            min="0"
                            value={viewCount}
                            onChange={(e) => setViewCount(e.target.value)}
                            className="w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        />
                    </Field>

                    <Field label="Season high (Rank Score)" hint="Drives leaderboard position. Leave blank to clear.">
                        <input
                            type="number"
                            min="0"
                            value={seasonHigh}
                            onChange={(e) => setSeasonHigh(e.target.value)}
                            placeholder="—"
                            className="w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        />
                    </Field>

                    <Field label="Discord tag">
                        <input
                            value={discordTag}
                            onChange={(e) => setDiscordTag(e.target.value)}
                            placeholder="username"
                            className="w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                        />
                    </Field>

                    <Field label="Bio">
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                            className="w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent resize-none"
                        />
                    </Field>
                </div>

                {/* Danger zone */}
                <div className="mt-5 pt-4 border-t border-hairline">
                    {!showDelete ? (
                        <button
                            onClick={() => setShowDelete(true)}
                            className="flex items-center gap-2 text-negative text-xs font-semibold hover:underline"
                        >
                            <Trash2 size={13} />
                            Delete this user permanently
                        </button>
                    ) : (
                        <div className="rounded-xl border border-negative/40 bg-negative/5 p-3">
                            <p className="text-xs text-text-secondary">
                                This permanently removes <span className="font-semibold text-text-primary">{user.username}</span>, their connected games and login. This can't be undone. Type the username to confirm.
                            </p>
                            <input
                                value={deleteConfirm}
                                onChange={(e) => setDeleteConfirm(e.target.value)}
                                placeholder={user.username}
                                className="mt-2 w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-negative"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => { setShowDelete(false); setDeleteConfirm("") }}
                                    className="flex-1 rounded-lg border border-hairline py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting || deleteConfirm !== user.username}
                                    className="flex-1 rounded-lg bg-negative py-2 text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {deleting ? "Deleting..." : "Delete forever"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {error && <p className="text-negative text-sm mt-4">{error}</p>}

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-hairline py-2.5 text-sm font-semibold text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-bold text-black transition-all hover:text-white active:scale-95 disabled:opacity-60"
                    >
                        {saving ? "Saving..." : "Save changes"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function Field({ label, hint, children }) {
    return (
        <div>
            <p className="text-xs font-semibold text-text-secondary mb-1.5">{label}</p>
            {children}
            {hint && <p className="text-[11px] text-text-muted mt-1">{hint}</p>}
        </div>
    )
}
