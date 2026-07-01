"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import DeleteAccountDialog from "./DeleteAccountDialog"

export default function AccountMenu({ isPro, stripeCustomerId, username, onUpgradeClick, onThemeClick }) {
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
            const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                className="border border-hairline rounded-lg px-3 py-2 text-sm text-text-secondary hover:border-accent/40 hover:text-text-primary active:border-accent/40 active:text-text-primary active:scale-95 transition-all"
            >
                ⋯
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-48 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
                        {!isPro && (
                            <button
                                onClick={() => { setOpen(false); onUpgradeClick() }}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-accent-soft font-semibold hover:bg-accent-tint active:bg-accent-tint transition-colors"
                            >
                                ★ Upgrade to Pro
                            </button>
                        )}
                        {isPro && (
                            <button
                                onClick={() => { setOpen(false); onThemeClick?.() }}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-background active:bg-background transition-colors"
                            >
                                🎨 Choose theme
                            </button>
                        )}
                        {isPro && stripeCustomerId && (
                            <button
                                onClick={handleManageSubscription}
                                disabled={portalLoading}
                                className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-background active:bg-background transition-colors disabled:opacity-50"
                            >
                                {portalLoading ? "Loading..." : "Manage subscription"}
                            </button>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-background active:bg-background transition-colors"
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
