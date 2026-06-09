"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"

export default function ConnectAccount() {

    const [platform, setPlatform] = useState("")
    const [gameUsername, setGameUsername] = useState("")
    const [gameTag, setGameTag] = useState("")


    async function handleConnect() {
        const { data: { user } } = await supabase.auth.getUser()
        console.log(user)

        }

    

    return (
    <div>
        <select value={platform} onChange={e => setPlatform(e.target.value)}>
        <option value="">Choose Game</option>
        <option value="riot">Riot (League / Valorant / TFT)</option>
        <option value="steam">Steam</option>
        </select>
        <input value={gameUsername} onChange={e => setGameUsername(e.target.value)} placeholder="Game Username" />
        <input value={gameTag} onChange={e => setGameTag(e.target.value)} placeholder="Game Tag" />
        <button onClick={handleConnect}>Connect Account</button>
    </div>
    )
}

