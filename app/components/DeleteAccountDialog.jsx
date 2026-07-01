"use client"

import { useState } from "react"

// Requires the user to type their username in uppercase before the delete
// button unlocks — a stronger confirmation than ConfirmDialog for a
// destructive, hard-to-reverse action. On success shows an inline message
// instead of redirecting immediately, so the user actually reads it.
export default function DeleteAccountDialog({ username, loading, error, done, onCancel, onConfirm, onSignOut }) {
    const [typed, setTyped] = useState("")
    const expected = (username || "").toUpperCase()
    const canConfirm = typed === expected && expected.length > 0

    if (done) {
        return (
            <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
                <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm">
                    <p className="text-text-primary text-lg font-bold">Account scheduled for deletion</p>
                    <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                        Your account is scheduled for deletion in 14 days. Log back in before then to cancel.
                    </p>
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white bg-accent hover:text-white active:scale-95 transition-all"
                    >
                        OK, sign me out
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-surface border border-line rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <p className="text-text-primary text-lg font-bold">Delete your account?</p>
                <p className="text-text-secondary text-sm mt-2 leading-relaxed">
                    This schedules your profile and all connected games for permanent deletion in 14 days. You can cancel anytime before then by logging back in.
                </p>

                <p className="text-text-secondary text-xs mt-4">
                    Type <b className="font-semibold text-text-primary">{expected}</b> to confirm.
                </p>
                <input
                    value={typed}
                    onChange={e => setTyped(e.target.value)}
                    placeholder="TYPE USERNAME"
                    className="mt-2 w-full rounded-lg border border-line bg-background px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-negative focus:outline-none"
                />

                {error && (
                    <p className="text-negative text-sm mt-3">{error}</p>
                )}

                <div className="flex gap-2.5 mt-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 border border-line rounded-lg py-2.5 text-sm text-text-secondary active:bg-background active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading || !canConfirm}
                        className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white bg-negative hover:bg-negative/90 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? "Please wait..." : "Delete account"}
                    </button>
                </div>
            </div>
        </div>
    )
}
