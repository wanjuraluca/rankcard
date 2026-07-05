"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

const SERVICE_LABELS = {
  overwatch: "Overwatch",
}

// Only worth surfacing on profile pages (the dynamic `/[username]` route) —
// showing it on the landing page scares off first-time visitors before
// they've even seen what the product does.
const NON_PROFILE_ROUTES = new Set(["", "auth", "admin", "agb", "compare", "datenschutz", "find", "impressum", "reset-password"])

export default function StatusBanner() {
  const [down, setDown] = useState([])
  const pathname = usePathname()
  const isProfilePage = !NON_PROFILE_ROUTES.has(pathname.split("/")[1] ?? "")

  useEffect(() => {
    if (!isProfilePage) return
    let cancelled = false
    async function check() {
      try {
        const res = await fetch("/api/status")
        const data = await res.json()
        if (!cancelled) setDown(data.down ?? [])
      } catch {
        // If the status check itself fails, don't show a false banner.
      }
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [isProfilePage])

  if (!isProfilePage || down.length === 0) return null

  const names = down.map(d => SERVICE_LABELS[d.service] ?? d.service).join(", ")

  return (
    <div className="sticky top-0 z-50 bg-negative px-4 py-2 text-center text-sm font-semibold text-black">
      {names} data is temporarily unavailable — we're aware and monitoring. Other games are unaffected.
    </div>
  )
}
