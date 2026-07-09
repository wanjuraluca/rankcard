"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ResetPassword() {
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const router = useRouter()

  function friendlyError(message) {
    if (message.toLowerCase().includes("password")) return "Password must be at least 6 characters."
    // A stale/reused/expired recovery link lands here with a session-related
    // error (e.g. "Auth session missing!", "Email link is invalid or has
    // expired") that used to show as-is with no way forward — point them
    // back to requesting a fresh link instead of a dead end.
    if (message.toLowerCase().includes("session") || message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid")) {
      return "This reset link has expired or already been used. Request a new one from the sign-in page."
    }
    return message
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setError(friendlyError(error.message))
    else setDone(true)
  }

  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-background p-8 pt-24">
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(680px 520px at 50% -8%, rgba(177,108,255,0.20), transparent 60%), radial-gradient(600px 600px at 88% 110%, rgba(177,108,255,0.10), transparent 55%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[392px]">
        <div className="relative rounded-2xl border border-hairline bg-surface p-8 shadow-2xl">
          <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

          <div className="mb-6 flex items-center justify-center">
            <a href="/" className="flex items-center gap-2">
              <img src="/Icons/LogoSmall.png" className="h-8" />
              <span className="text-lg font-bold text-white">RankCard</span>
            </a>
          </div>

          {done ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Password updated</h2>
              <p className="mt-1.5 text-sm text-text-secondary">
                Your password has been changed successfully.
              </p>
              <button
                onClick={() => router.push("/auth")}
                className="mt-6 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-shadow hover:text-white duration-350 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)]"
              >
                Go to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Set a new password</h2>
                <p className="mt-1.5 text-sm text-text-secondary">
                  Choose a new password for your RankCard account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-hairline bg-background px-3.5 py-3 text-[15px] text-white placeholder:text-[#56565f] focus:border-accent focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer px-1.5 py-1 font-mono text-xs text-text-secondary hover:text-white"
                    >
                      {showPassword ? "hide" : "show"}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-negative/40 bg-negative/10 px-3.5 py-2.5 text-sm text-negative">
                    {error}
                    {error.startsWith("This reset link has expired") && (
                      <>
                        {" "}
                        <button
                          type="button"
                          onClick={() => router.push("/auth")}
                          className="cursor-pointer font-semibold underline hover:text-white"
                        >
                          Go to sign in
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-1 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-shadow hover:text-white duration-350 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)]"
                >
                  Update password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
