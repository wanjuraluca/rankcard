"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const router = useRouter()
  const [username, setUsername] = useState("")

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

          console.log("User ID:", data.user.id)
          console.log("Profile:", profile)

        router.push("/" + profile.username)
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) alert(error.message)
      else {
        await supabase.from("profiles").insert({ user_id: data.user.id, username: username })
        router.push("/")
      }
      
    }
  }

  return (
    <div className="flex items-center justify-center relative overflow-hidden bg-[#0c0c10] min-h-screen p-8">
      <div className="w-full max-w-[392px] bg-surface border border-line rounded 3xl p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-6">
          <a href= "/" className="flex items-center gap-8">
          <img src="/Icons/LogoSmall.png" className="h-8"/>
          <span className="font-bold text-lg">RankCard</span> 
          </a>
        </div>
      <h1 style={{fontFamily: "'Courier New', monospace"}} className="text-white border-t-2 border-t-[#6c63ff] rounded-2xl border">
        {isLogin ? "Login" : "Register"}
      </h1>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" />
      {!isLogin && <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />}
      <button onClick={handleSubmit}>
        {isLogin ? "Login" : "Register"}
      </button>
      <p onClick={() => setIsLogin(!isLogin)} style={{cursor: "pointer", color: "gray"}}>
        {isLogin ? "Noch kein Konto? Registrieren" : "Schon ein Konto? Login"}
      </p>
    </div>
    </div>
  )
}