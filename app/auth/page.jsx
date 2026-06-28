"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Particles from "@tsparticles/react"
import Footer from "../components/Footer"

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

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
  const router = useRouter()

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

async function handleSubmit(e) {
  e.preventDefault()
  setError("")
  if (isLogin) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(friendlyError(error.message))
    else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", data.user.id)
        .single()
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
        <div className="relative rounded-3xl border border-line bg-surface p-8 shadow-2xl">
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
              {error && (
                <div className="mt-4 rounded-lg border border-negative/40 bg-negative/10 px-3.5 py-2.5 text-sm text-negative">
                  {error}
                </div>
              )}
              <button
                onClick={handleCheckConfirmation}
                disabled={checkingConfirmation}
                className="mt-6 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-shadow hover:text-white duration-350 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)] disabled:opacity-60"
              >
                {checkingConfirmation ? "Checking..." : "I've confirmed my email"}
              </button>
              <button
                onClick={() => { setSignupDone(false); setIsLogin(true); setError("") }}
                className="mt-3 w-full cursor-pointer rounded-lg border border-line bg-background py-3 text-[15px] font-semibold text-white transition-colors hover:border-accent"
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <>
          {/* toggle */}
          <div className="flex rounded-xl border border-line bg-background p-1">
            <button
              onClick={() => { setIsLogin(true); setError(""); setResetSent(false) }}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors ${
                isLogin ? "border border-line bg-surface text-white" : "text-text-secondary"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(""); setResetSent(false) }}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors ${
                !isLogin ? "border border-line bg-surface text-white" : "text-text-secondary"
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

          {/* form */}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
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
                        : "border-line focus:border-accent"
                    }`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm">
                    {usernameStatus === "checking" && (
                      <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
                    )}
                    {usernameStatus === "available" && <span className="text-positive">✓</span>}
                    {(usernameStatus === "taken" || usernameStatus === "invalid") && <span className="text-negative">✕</span>}
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
                className="w-full rounded-lg border border-line bg-background px-3.5 py-3 text-[15px] text-white placeholder:text-[#56565f] focus:border-accent focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none"
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
                  className="w-full rounded-lg border border-line bg-background px-3.5 py-3 text-[15px] text-white placeholder:text-[#56565f] focus:border-accent focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none"
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
              className="mt-1 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-shadow hover:text-white duration-350 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isLogin ? "Sign in" : "Create profile"}
            </button>
          </form>

          {!isLogin && (
            <div className="mt-4 rounded-lg border border-line bg-background p-3 text-xs leading-relaxed text-text-secondary">
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

        {/* ===== profile preview (secondary) ===== */}
        <div className="text-center font-mono text-[11px] tracking-wide text-text-secondary">
          a preview of your public profile
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-full border border-accent/30 bg-gradient-to-br from-[#2a2440] to-[#161320] text-[17px] font-bold text-accent">
              L
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">user</div>
              <div className="font-mono text-[11.5px] text-text-secondary">rankcard.gg/user</div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {[
              { game: "League of Legends", tier: "Diamond II", color: "#c89b3c" },
              { game: "Valorant", tier: "Immortal 1", color: "#ff4655" },
              { game: "CS2", tier: "15.2k Elo", color: "#5b8def" },
            ].map(r => (
              <div key={r.game} className="flex items-center gap-2.5 rounded-lg border border-line bg-background px-3 py-2 text-[13px]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                <span className="text-text-secondary">{r.game}</span>
                <span className="ml-auto font-mono text-xs font-semibold" style={{ color: r.color }}>{r.tier}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}