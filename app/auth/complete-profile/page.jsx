"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getStoredReferral, clearStoredReferral } from "@/lib/referral"
import { Check, X } from "lucide-react"

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

function suggestUsername(user) {
  const meta = user?.user_metadata ?? {}
  const raw = meta.user_name || meta.preferred_username || meta.full_name || meta.name || ""
  return raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20)
}

export default function CompleteProfile() {
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState("")
  const [usernameStatus, setUsernameStatus] = useState("idle")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        router.replace("/auth")
        return
      }
      setUsername(suggestUsername(data.user))
      setChecking(false)
    })
  }, [router])

  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle")
      return
    }
    if (!USERNAME_PATTERN.test(username)) {
      setUsernameStatus("invalid")
      return
    }
    setUsernameStatus("checking")
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", username)
        .maybeSingle()
      setUsernameStatus(data ? "taken" : "available")
    }, 400)
    return () => clearTimeout(timeout)
  }, [username])

  async function handleSubmit(e) {
    e.preventDefault()
    if (usernameStatus !== "available") return
    setSubmitting(true)
    setError("")
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const res = await fetch("/api/auth/complete-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username, referredBy: getStoredReferral() }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error || "Could not create your profile.")
      return
    }
    clearStoredReferral()
    router.replace("/" + username)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-accent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-8">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(680px 520px at 50% -8%, rgba(177,108,255,0.20), transparent 60%), radial-gradient(600px 600px at 88% 110%, rgba(177,108,255,0.10), transparent 55%)",
        }}
      />
      <div className="relative z-10 w-full max-w-[392px] rounded-2xl border border-hairline bg-surface p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-white text-center">One last step</h2>
        <p className="mt-1.5 text-sm text-text-secondary text-center">Pick a username to finish setting up your profile.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary">Username</label>
            <div className="relative">
              <input
                value={username}
                onChange={e => setUsername(e.target.value.trim())}
                placeholder="user"
                autoFocus
                className={`w-full rounded-lg border bg-background px-3.5 py-3 pr-9 text-[15px] text-white placeholder:text-[#56565f] focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none ${
                  usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "border-negative/50 focus:border-negative"
                    : usernameStatus === "available"
                    ? "border-positive/50 focus:border-positive"
                    : "border-hairline focus:border-accent"
                }`}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">
                {usernameStatus === "checking" && (
                  <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-hairline border-t-accent" />
                )}
                {usernameStatus === "available" && <Check size={15} className="text-positive" />}
                {(usernameStatus === "taken" || usernameStatus === "invalid") && <X size={15} className="text-negative" />}
              </span>
            </div>
            {usernameStatus === "taken" && <span className="text-[11.5px] text-negative">This username is already taken.</span>}
            {usernameStatus === "invalid" && <span className="text-[11.5px] text-negative">3-20 characters, letters/numbers/underscore only.</span>}
            {usernameStatus === "available" && <span className="text-[11.5px] text-positive">Username available.</span>}
            <span className="font-mono text-[11.5px] text-text-secondary">
              Your profile link: <b className="font-medium text-accent">rankcard.gg/{username || "user"}</b>
            </span>
          </div>

          {error && (
            <div className="rounded-lg border border-negative/40 bg-negative/10 px-3.5 py-2.5 text-sm text-negative">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || usernameStatus !== "available"}
            className="mt-1 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all hover:text-white active:scale-95 duration-150 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {submitting ? "Creating..." : "Create profile"}
          </button>
        </form>
      </div>
    </div>
  )
}
