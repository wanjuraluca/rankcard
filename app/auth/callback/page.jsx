"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

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

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", data.session.user.id)
        .single()

      if (profileError || !profile) {
        setError(true)
        return
      }

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
            <a href="/auth" className="mt-2 rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-white hover:border-accent">
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            <p className="text-sm text-text-secondary">Confirming your email...</p>
          </>
        )}
      </div>
    </div>
  )
}
