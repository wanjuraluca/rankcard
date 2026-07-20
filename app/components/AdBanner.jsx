"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"

/* Shows an AdSense unit, but never an empty box: while AdSense hasn't
   delivered anything (account under review, no fill, or an ad blocker —
   very common among gamers), the reserved space becomes a house ad
   pitching Pro instead. AdSense marks the outcome on the <ins> via
   data-ad-status ("filled" / "unfilled"); if that never appears the
   script itself was blocked. Collapsing unfilled units and showing own
   content in their place is explicitly allowed by AdSense policy. */
/* houseAd: only one slot per page should pitch Pro when ads don't fill —
   the others collapse to nothing instead of repeating the same card. */
export default function AdBanner({ slot, onUpgrade, houseAd = true, className = "" }) {
    const insRef = useRef(null)
    const pushed = useRef(false)
    // "pending" → keep the slot invisible (no gap), then either "filled" or "house"
    const [adState, setAdState] = useState("pending")

    useEffect(() => {
        // Guard only the push (AdSense errors on a second push into the same
        // <ins>) — the observer below must be re-attached on every effect run,
        // or StrictMode's mount/unmount/mount cycle leaves it disconnected.
        if (!pushed.current) {
            pushed.current = true
            try {
                ;(window.adsbygoogle = window.adsbygoogle || []).push({})
            } catch {
                // AdSense script not ready yet or blocked — the timeout below decides
            }
        }

        const el = insRef.current
        if (!el) return

        const check = () => {
            const status = el.getAttribute("data-ad-status")
            if (status === "filled") { setAdState("filled"); return true }
            if (status === "unfilled") { setAdState("house"); return true }
            return false
        }
        if (check()) return

        const observer = new MutationObserver(() => { if (check()) observer.disconnect() })
        observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] })
        // No verdict after 5s means the script never ran (ad blocker) — take the space back
        const timer = setTimeout(() => { if (!check()) setAdState("house") }, 5000)
        return () => { observer.disconnect(); clearTimeout(timer) }
    }, [])

    // No fill and no house ad wanted → give the space back entirely
    if (adState === "house" && !houseAd) return null

    return (
        <div className={className}>
            <ins
                ref={insRef}
                className="adsbygoogle"
                style={{ display: adState === "house" ? "none" : "block" }}
                data-ad-client="ca-pub-6448981035028851"
                data-ad-slot={slot}
                data-ad-format="auto"
                data-full-width-responsive="true"
            />
            {adState === "house" && (
                <button
                    onClick={onUpgrade}
                    className="w-full text-left bg-surface border border-accent/40 rounded-2xl p-4 hover:bg-accent-tint hover:-translate-y-0.5 active:scale-[0.97] transition-all group"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                        <Sparkles size={13} className="text-accent-soft" />
                    </div>
                    <p className="text-text-primary text-sm font-semibold mt-2">Browse RankCard ad-free</p>
                    <p className="text-text-secondary text-xs mt-1">
                        No ads anywhere, custom themes, live in-game status and more — 2,99 €/month.
                    </p>
                    <p className="text-accent-soft text-xs font-semibold mt-2 group-hover:translate-x-0.5 transition-transform">
                        Upgrade to Pro →
                    </p>
                </button>
            )}
        </div>
    )
}
