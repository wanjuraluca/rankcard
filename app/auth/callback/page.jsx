"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getStoredReferral, clearStoredReferral } from "@/lib/referral"

export default function AuthCallback() {
  const [error, setError] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function redirectToProfile() {
      const { data, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !data?.session) {
        setError(true)
        return
      }

      // Logging back in cancels a pending account deletion. OAuth users came
      // through here and never had it reset, so a Discord/Google user who
      // changed their mind still got deleted by the 14-day cron. Goes through
      // the server route (admin client), same as the password login path.
      await fetch("/api/account/cancel-deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      })

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, referred_by")
        .eq("user_id", data.session.user.id)
        .maybeSingle()

      if (!profile || !profile.username) {
        // No profile row, or a row with no username yet — a DB trigger creates
        // the profiles row immediately on signup (before the OAuth user has
        // picked a username), so checking `!profile` alone let this fall
        // through to router.replace("/null") and 404 instead of ever reaching
        // complete-profile. This is why every Discord/Google signup was
        // silently dying here.
        router.replace("/auth/complete-profile")
        return
      }

      const ref = getStoredReferral()
      if (ref && !profile.referred_by) {
        await supabase.from("profiles").update({ referred_by: ref }).eq("user_id", data.session.user.id)
      }
      clearStoredReferral()

      router.replace("/" + profile.username)
    }
    redirectToProfile()
  }, [router])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-8">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(680px 520px at 50% -8%, rgba(177,108,255,0.20), transparent 60%), radial-gradient(600px 600px at 88% 110%, rgba(177,108,255,0.10), transparent 55%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        {error ? (
          <>
            <h2 className="text-xl font-bold text-white">Confirmation link expired or invalid</h2>
            <p className="max-w-xs text-sm text-text-secondary">
              Try signing in directly, or request a new confirmation email.
            </p>
            <a href="/auth" className="mt-2 rounded-lg border border-hairline bg-surface px-5 py-2.5 text-sm font-semibold text-white hover:border-accent">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-accent" />
            <p className="text-sm text-text-secondary">Confirming your email...</p>
          </>
        )}
      </div>
    </div>
  )
}
