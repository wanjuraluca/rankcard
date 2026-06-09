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
        await supabase.from("profiles").insert({ id: data.user.id, username: username })
        router.push("/")
      }
      
    }
  }

  return (
    <div className="bg-[#0c0c10] min-h-screen p-8">
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
  )
}