"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Star, Palette } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { isAdminUsername } from "@/lib/admin"
import DeleteAccountDialog from "./DeleteAccountDialog"

export default function AccountMenu({ isPro, stripeCustomerId, username, avatarUrl, onUpgradeClick, onThemeClick, onEmbedBadgeClick }) {
    const [open, setOpen] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteError, setDeleteError] = useState("")
    const [deleteDone, setDeleteDone] = useState(false)
    const [portalLoading, setPortalLoading] = useState(false)
    const router = useRouter()

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push("/auth")
    }

    async function handleManageSubscription() {
        setOpen(false)
        setPortalLoading(true)
        try {
            const { data: sessionData } = await supabase.auth.getSession()
            const accessToken = sessionData?.session?.access_token

            const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
                body: JSON.stringify({ username }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || "Could not open subscription management.")
            window.location.href = data.url
        } catch (err) {
            setPortalLoading(false)
            alert(err.message || "Could not open subscription management.")
        }
    }

    async function handleDeleteAccount() {
        setDeleting(true)
        setDeleteError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        const res = await fetch("/api/account/delete", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!res.ok) {
            const { error } = await res.json().catch(() => ({}))
            setDeleteError(error || "Could not delete account. Please try again.")
            setDeleting(false)
            return
        }

        setDeleting(false)
        setDeleteDone(true)
    }

    async function handleSignOutAfterDelete() {
        await supabase.auth.signOut()
        router.push("/")
    }

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                title="Account menu"
                className="w-8 h-8 rounded-full border border-hairline hover:border-accent/40 active:scale-95 transition-all overflow-hidden flex items-center justify-center bg-background text-text-secondary flex-shrink-0"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                ) : (
                    <MoreHorizontal size={15} />
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-lg border border-hairline bg-surface p-1.5 shadow-2xl">
                        {!isPro && (
                            <button
                                onClick={() => { setOpen(false); onUpgradeClick() }}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-accent-soft font-semibold hover:bg-accent-tint active:bg-accent-tint transition-colors flex items-center gap-2"
                            >
                                <Star size={14} /> Upgrade to Pro
                            </button>
                        )}
                        {isPro && (
                            <button
                                onClick={() => { setOpen(false); onThemeClick?.() }}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover transition-colors flex items-center gap-2"
                            >
                                <Palette size={14} /> Choose theme
                            </button>
                        )}
                        {isPro && stripeCustomerId && (
                            <button
                                onClick={handleManageSubscription}
                                disabled={portalLoading}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover transition-colors disabled:opacity-50"
                            >
                                {portalLoading ? "Loading..." : "Manage subscription"}
                            </button>
                        )}
                        {isAdminUsername(username) && (
                            <a
                                href="/admin"
                                className="block w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover transition-colors"
                            >
                                Admin
                            </a>
                        )}
                        {onEmbedBadgeClick && (
                            <button
                                onClick={() => { setOpen(false); onEmbedBadgeClick() }}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover transition-colors"
                            >
                                Embed badge
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover transition-colors"
                        >
                            Sign out
                        </button>
                        <button
                            onClick={() => { setOpen(false); setConfirmingDelete(true) }}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-negative hover:bg-negative/10 active:bg-negative/10 transition-colors"
                        >
                            Delete account
                        </button>
                    </div>
                </>
            )}

            {confirmingDelete && (
                <DeleteAccountDialog
                    username={username}
                    loading={deleting}
                    error={deleteError}
                    done={deleteDone}
                    onCancel={() => { setConfirmingDelete(false); setDeleteError("") }}
                    onConfirm={handleDeleteAccount}
                    onSignOut={handleSignOutAfterDelete}
                />
            )}
        </div>
    )
}
