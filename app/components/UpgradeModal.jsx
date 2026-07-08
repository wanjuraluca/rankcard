"use client"
import { useState } from "react"
import { Palette, ImageIcon, LayoutGrid, Swords, Zap, Users, Infinity, TrendingUp, Radio, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

const features = [
    {
        icon: Infinity,
        title: "Unlimited duo requests",
        description: "View and copy unlimited Discord tags on the Find a Duo board. Free users get 3 per day.",
    },
    {
        icon: TrendingUp,
        title: "Boosted on the board",
        description: "Your LFG post appears at the top of the Find a Duo board and stays active for 72h instead of 24h.",
    },
    {
        icon: Radio,
        title: "Live \"In Game\" status",
        description: "Show visitors what you're currently playing in real time on your profile.",
    },
    {
        icon: Users,
        title: "Friends list on your profile",
        description: "Display your RankCard friends publicly so visitors can see who you play with.",
    },
    {
        icon: Swords,
        title: "Profile comparison",
        description: "Challenge anyone to a head-to-head rank comparison with a shareable link.",
    },
    {
        icon: Palette,
        title: "Custom profile themes",
        description: "Choose from preset colour themes or pick any colour to match your style.",
    },
    {
        icon: ImageIcon,
        title: "Custom profile banner",
        description: "Upload your own banner image instead of the default gradient.",
    },
    {
        icon: LayoutGrid,
        title: "Per-game export cards",
        description: "Download a shareable rank card for each connected game individually.",
    },
    {
        icon: Zap,
        title: "More on the way",
        description: "New Pro perks ship regularly. You'll get them automatically.",
    },
]

export default function UpgradeModal({ onClose, onUpgraded }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleUpgrade() {
        setLoading(true)
        setError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const username = sessionData?.session?.user?.user_metadata?.username

        if (!username) {
            setError("You must be logged in to upgrade.")
            setLoading(false)
            return
        }

        const res = await fetch("/api/stripe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
        })

        const data = await res.json()
        if (!res.ok || !data.url) {
            setError(data.error || "Something went wrong. Please try again.")
            setLoading(false)
            return
        }

        window.location.href = data.url
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-accent/40 rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                    <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary active:scale-90 transition-transform"><X size={18} /></button>
                </div>
                <p className="text-text-primary text-lg font-bold mt-2">Upgrade to RankCard Pro</p>
                <p className="text-text-secondary text-sm mt-1">Everything on your profile, taken further:</p>

                <div className="flex flex-col gap-3.5 mt-5 max-h-[55vh] overflow-y-auto pr-1">
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
                    2,99 € / month · Cancel anytime · Secured by Stripe
                </p>
            </div>
        </div>
    )
}
