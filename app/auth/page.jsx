"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Particles from "@tsparticles/react"
import Footer from "../components/Footer"
import { Check, X } from "lucide-react"
import { platformConfig } from "@/lib/platforms"
import { extractGameStats } from "@/lib/gameStats"

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/
const SHOWCASE_USERNAME = "DinDjarin"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [usernameStatus, setUsernameStatus] = useState("idle") // idle | checking | available | taken | invalid
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [signupDone, setSignupDone] = useState(false)
  const [checkingConfirmation, setCheckingConfirmation] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [showcase, setShowcase] = useState(null)
  const router = useRouter()

  useEffect(() => {
    async function loadShowcase() {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .eq("username", SHOWCASE_USERNAME)
        .maybeSingle()
      if (!profile) return

      const { data: accounts } = await supabase
        .from("connected_accounts")
        .select("id, platform")
        .eq("user_id", profile.user_id)

      const games = await Promise.all(
        (accounts ?? []).map(async (account) => {
          const { data: cache } = await supabase
            .from("account_cache")
            .select("data")
            .eq("account_id", account.id)
            .maybeSingle()
          const stats = extractGameStats(account.platform, cache?.data ?? {})
          return { platform: account.platform, stats }
        })
      )

      setShowcase({ profile, games: games.filter(g => g.stats) })
    }
    loadShowcase()
  }, [])

  function friendlyError(message) {
    if (message === "Invalid login credentials") return "Incorrect email or password."
    if (message === "User already registered") return "An account with this email already exists."
    if (message.toLowerCase().includes("password")) return "Password must be at least 6 characters."
    if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) return "This username is already taken."
    return message
  }

  useEffect(() => {
    if (isLogin || !username) {
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
  }, [username, isLogin])

 async function handleForgotPassword() {
  setError("")
  if (!email) {
    setError("Enter your email address first, then click \"Forgot password\".")
    return
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) setError(friendlyError(error.message))
  else setResetSent(true)
}

async function handleResendConfirmation() {
  setResending(true)
  setError("")
  setResendSent(false)
  const { error } = await supabase.auth.resend({ type: "signup", email })
  setResending(false)
  if (error) setError(friendlyError(error.message))
  else setResendSent(true)
}

async function handleCheckConfirmation() {
  setCheckingConfirmation(true)
  setError("")
  const { data } = await supabase.auth.getSession()
  if (data?.session) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", data.session.user.id)
      .single()
    if (profile) {
      router.push("/" + profile.username)
      return
    }
  }
  setCheckingConfirmation(false)
  setError("Not confirmed yet. Click the link in the email first.")
}

async function handleOAuth(provider) {
  setError("")
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) setError(friendlyError(error.message))
}

async function handleSubmit(e) {
  e.preventDefault()
  setError("")
  if (isLogin) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(friendlyError(error.message))
    else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, deletion_requested_at")
        .eq("user_id", data.user.id)
        .single()

      if (profile.deletion_requested_at) {
        await supabase
          .from("profiles")
          .update({ deletion_requested_at: null })
          .eq("user_id", data.user.id)
      }

      router.push("/" + profile.username)
    }
  } else {
    if (usernameStatus !== "available") {
      setError("Choose an available username first.")
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setError(friendlyError(error.message))
    else {
      setSignupDone(true)
    }
  }
}

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-background p-8 pt-16">

      {/* ---- background deco ---- */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(680px 520px at 50% -8%, rgba(177,108,255,0.20), transparent 60%), radial-gradient(600px 600px at 88% 110%, rgba(177,108,255,0.10), transparent 55%)",
        }}
      />

      {/* ---- card + preview stack ---- */}
      <div className="relative z-10 flex w-full max-w-[392px] flex-col gap-4">

        {/* ===== auth card ===== */}
        <div className="relative rounded-2xl border border-hairline bg-surface p-8 shadow-2xl">
          {/* glowing top hairline */}
          <div className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-70" />

          {/* lockup */}
          <div className="mb-6 flex items-center justify-center">
            <a href="/" className="flex items-center gap-2">
              <img src="/Icons/LogoSmall.png" className="h-8" />
              <span className="text-lg font-bold text-white">RankCard</span>
            </a>
          </div>

          {signupDone ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Check your email</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
                We sent a confirmation link to <b className="font-semibold text-white">{email}</b>. Click it to activate your account and your profile will go live.
              </p>
              {resendSent && (
                <div className="mt-4 rounded-lg border border-positive/40 bg-positive/10 px-3.5 py-2.5 text-sm text-positive">
                  Confirmation email resent. Check your inbox (and spam folder).
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-lg border border-negative/40 bg-negative/10 px-3.5 py-2.5 text-sm text-negative">
                  {error}
                </div>
              )}
              <button
                onClick={handleCheckConfirmation}
                disabled={checkingConfirmation}
                className="mt-6 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all hover:text-white active:scale-95 duration-150 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)] disabled:opacity-60"
              >
                {checkingConfirmation ? "Checking..." : "I've confirmed my email"}
              </button>
              <button
                onClick={handleResendConfirmation}
                disabled={resending}
                className="mt-3 w-full cursor-pointer rounded-lg border border-hairline bg-background py-3 text-[15px] font-semibold text-white transition-colors hover:border-accent disabled:opacity-60"
              >
                {resending ? "Resending..." : "Resend confirmation email"}
              </button>
              <button
                onClick={() => { setSignupDone(false); setIsLogin(true); setError("") }}
                className="mt-3 w-full cursor-pointer text-sm text-text-secondary hover:text-white transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <>
          {/* toggle */}
          <div className="flex rounded-lg border border-hairline bg-background p-1">
            <button
              onClick={() => { setIsLogin(true); setError(""); setResetSent(false) }}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors ${
                isLogin ? "border border-hairline bg-surface text-white" : "text-text-secondary"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); setResetSent(false) }}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors ${
                !isLogin ? "border border-hairline bg-surface text-white" : "text-text-secondary"
              }`}
            >
              Create account
            </button>
          </div>

          {/* heading */}
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-white">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              {isLogin ? "Sign in to your RankCard profile." : "Claim your profile and connect your ranks."}
            </p>
          </div>

          {/* OAuth */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => handleOAuth("discord")}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-hairline bg-background py-3 text-[15px] font-semibold text-white transition-colors hover:border-[#5865f2]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865f2"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028Zm-12.36 10.96c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z"/></svg>
              Continue with Discord
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-hairline bg-background py-3 text-[15px] font-semibold text-white transition-colors hover:border-accent"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.08.72-2.45 1.15-4.05 1.15-3.12 0-5.76-2.1-6.7-4.93H1.29v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.31A7.2 7.2 0 0 1 4.93 12c0-.8.14-1.58.37-2.31v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.41l4.01-3.1Z"/><path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.59l4.01 3.1C6.24 6.85 8.88 4.75 12 4.75Z"/></svg>
              Continue with Google
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="text-xs text-text-secondary">or</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>

          {/* form */}
          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Username</label>
                <div className="relative">
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.trim())}
                    placeholder="user"
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
                {usernameStatus === "taken" && (
                  <span className="text-[11.5px] text-negative">This username is already taken.</span>
                )}
                {usernameStatus === "invalid" && (
                  <span className="text-[11.5px] text-negative">3-20 characters, letters/numbers/underscore only.</span>
                )}
                {usernameStatus === "available" && (
                  <span className="text-[11.5px] text-positive">Username available.</span>
                )}
                <span className="font-mono text-[11.5px] text-text-secondary">
                  Your profile link: <b className="font-medium text-accent">rankcard.gg/{username || "user"}</b>
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-hairline bg-background px-3.5 py-3 text-[15px] text-white placeholder:text-[#56565f] focus:border-accent focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-text-secondary">Password</label>
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
              {isLogin && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="self-end cursor-pointer text-xs font-semibold text-accent hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {resetSent && (
              <div className="rounded-lg border border-positive/40 bg-positive/10 px-3.5 py-2.5 text-sm text-positive">
                Password reset link sent. Check your inbox.
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-negative/40 bg-negative/10 px-3.5 py-2.5 text-sm text-negative">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isLogin && usernameStatus !== "available"}
              className="mt-1 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-all hover:text-white active:scale-95 duration-150 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
            >
              {isLogin ? "Sign in" : "Create profile"}
            </button>
          </form>

          {!isLogin && (
            <div className="mt-4 rounded-lg border border-hairline bg-background p-3 text-xs leading-relaxed text-text-secondary">
              We'll send a confirmation link to verify your email before your profile goes live.
            </div>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            {isLogin ? "New to RankCard? " : "Already have an account? "}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(""); setResetSent(false) }}
              className="cursor-pointer font-semibold text-accent hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
          </>
          )}
        </div>

        {/* ===== real example profile (secondary) — honestly framed as someone else's live card, not "your" preview ===== */}
        <div className="text-center font-mono text-[11px] tracking-wide text-text-secondary">
          this is a real, live RankCard profile
        </div>
        <a
          href={`/${showcase?.profile.username ?? "DinDjarin"}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-hairline bg-surface p-4 hover:border-accent/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            {showcase?.profile.avatar_url ? (
              <img src={showcase.profile.avatar_url} alt={showcase.profile.username} className="h-[42px] w-[42px] rounded-full border border-accent/30 object-cover" />
            ) : (
              <div className="grid h-[42px] w-[42px] place-items-center rounded-full border border-accent/30 bg-gradient-to-br from-[#2a2440] to-[#161320] text-[17px] font-bold text-accent">
                {(showcase?.profile.username ?? "D")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[15px] font-semibold text-white">{showcase?.profile.username ?? "DinDjarin"}</div>
              <div className="font-mono text-[11.5px] text-text-secondary">rankcard.gg/{showcase?.profile.username ?? "DinDjarin"}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {(showcase?.games ?? []).map(({ platform, stats }) => {
              const config = platformConfig[platform]
              if (!config) return null
              return (
                <div key={platform} className="flex items-center gap-2.5 rounded-lg border border-hairline bg-background px-3 py-2 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: config.color }} />
                  <span className="text-text-secondary">{config.name}</span>
                  <span className="ml-auto font-mono text-xs font-semibold" style={{ color: config.color }}>{stats.tierLabel ?? "Unranked"}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-3 text-center text-xs font-semibold text-accent-soft">
            View this live profile →
          </div>
        </a>
      </div>

      <Footer />
    </div>
  )
}