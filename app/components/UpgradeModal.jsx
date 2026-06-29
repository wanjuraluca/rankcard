"use client"
import { useState } from "react"
import { Check, ImageIcon, LayoutGrid } from "lucide-react"
import { supabase } from "@/lib/supabase"

const features = [
    {
        icon: LayoutGrid,
        title: "Per-game export cards",
        description: "Download a shareable card for each connected game, not just the overall one.",
    },
    {
        icon: ImageIcon,
        title: "Custom profile banner",
        description: "Upload your own banner image instead of the default gradient.",
    },
    {
        icon: Check,
        title: "More on the way",
        description: "New Pro perks ship regularly — you'll get them automatically.",
    },
]

export default function UpgradeModal({ onClose, onUpgraded }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleUpgrade() {
        setLoading(true)
        setError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const accessToken = sessionData?.session?.access_token

        const res = await fetch("/api/account/upgrade", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!res.ok) {
            const { error: msg } = await res.json().catch(() => ({}))
            setError(msg || "Something went wrong. Please try again.")
            setLoading(false)
            return
        }

        onUpgraded()
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-accent/40 rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-[0_0_60px_rgba(177,108,255,0.25)]" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                    <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary active:scale-90 transition-transform text-xl leading-none">✕</button>
                </div>
                <p className="text-text-primary text-lg font-bold mt-2">Upgrade to RankCard Pro</p>
                <p className="text-text-secondary text-sm mt-1">Unlock these features on your profile:</p>

                <div className="flex flex-col gap-3.5 mt-5">
                    {features.map((feature) => (
                        <div key={feature.title} className="flex items-start gap-3">
                            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-accent-tint border border-accent/40">
                                <feature.icon size={16} className="text-accent-soft" />
                            </div>
                            <div>
                                <p className="text-text-primary text-sm font-semibold">{feature.title}</p>
                                <p className="text-text-secondary text-xs mt-0.5">{feature.description}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <p className="text-negative text-sm mt-4">{error}</p>
                )}

                <button
                    onClick={handleUpgrade}
                    disabled={loading}
                    className="mt-6 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all hover:text-white active:scale-95 disabled:opacity-60"
                >
                    {loading ? "Upgrading..." : "Upgrade to Pro"}
                </button>
                <p className="text-text-secondary text-[11px] mt-3 text-center">
                    Free during early access — no payment required yet.
                </p>
            </div>
        </div>
    )
}
