"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Particles from "@tsparticles/react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

 async function handleSubmit() {
  if (isLogin) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", data.user.id)
        .single()
      router.push("/" + profile.username)
    }
  } else {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username } },
    })
    if (error) alert(error.message)
    else {
      router.push("/")
    }
  }
}

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-8">

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

          {/* toggle */}
          <div className="flex rounded-xl border border-line bg-background p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 cursor-pointer rounded-lg py-2 text-sm font-semibold transition-colors ${
                isLogin ? "border border-line bg-surface text-white" : "text-text-secondary"
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setIsLogin(false)}
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
          <div className="mt-6 flex flex-col gap-4">
            {!isLogin && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="user"
                  className="w-full rounded-lg border border-line bg-background px-3.5 py-3 text-[15px] text-white placeholder:text-[#56565f] focus:border-accent focus:shadow-[0_0_0_3px_rgba(177,108,255,0.16)] focus:outline-none"
                />
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
            </div>

            <button
              onClick={handleSubmit}
              className="mt-1 w-full cursor-pointer rounded-lg bg-accent py-3 text-[15px] font-bold text-black shadow-[0_0_30px_rgba(177,108,255,0.5)] transition-shadow hover:text-white duration-350 hover:shadow-[0_0_40px_rgba(177,108,255,0.5)]"
            >
              {isLogin ? "Sign in" : "Create profile"}
            </button>
          </div>

          {!isLogin && (
            <div className="mt-4 rounded-lg border border-line bg-background p-3 text-xs leading-relaxed text-text-secondary">
              We'll send a confirmation link to verify your email before your profile goes live.
            </div>
          )}

          <p className="mt-6 text-center text-sm text-text-secondary">
            {isLogin ? "New to RankCard? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="cursor-pointer font-semibold text-accent hover:underline"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
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
    </div>
  )
}