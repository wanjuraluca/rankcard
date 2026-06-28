"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AccountMenu() {
    const [open, setOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const router = useRouter()

    async function handleSignOut() {
        await supabase.auth.signOut()
        router.push("/auth")
    }

    async function handleDeleteAccount() {
        const step1 = window.confirm(
            "Delete your RankCard account? This removes your profile and all connected games permanently."
        )
        if (!step1) return

        const step2 = window.confirm("Are you sure? This cannot be undone.")
        if (!step2) return

        setDeleting(true)

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        const res = await fetch("/api/account/delete", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!res.ok) {
            const { error } = await res.json().catch(() => ({}))
            window.alert(`Could not delete account: ${error || "Unknown error"}`)
            setDeleting(false)
            return
        }

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
                        <button
                            onClick={handleSignOut}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-text-primary hover:bg-background active:bg-background transition-colors"
                        >
                            Sign out
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                            className="w-full text-left rounded-lg px-3 py-2 text-sm text-negative hover:bg-negative/10 active:bg-negative/10 transition-colors disabled:opacity-50"
                        >
                            {deleting ? "Deleting..." : "Delete account"}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
