"use client"
import { useState, useRef, useEffect } from "react"
import { Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function DiscordTagEditor({ username, discordTag, isOwnProfile }) {
    const [value, setValue] = useState(discordTag ?? "")
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState("")
    const inputRef = useRef(null)

    useEffect(() => {
        if (editing) inputRef.current?.focus()
    }, [editing])

    async function handleSave() {
        setEditing(false)
        const trimmed = value.trim()
        if (trimmed === (discordTag ?? "")) return

        const { error } = await supabase
            .from("profiles")
            .update({ discord_tag: trimmed || null })
            .eq("username", username)

        if (error) {
            setError("Couldn't save. Try again.")
            setValue(discordTag ?? "")
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault()
            inputRef.current?.blur()
        }
        if (e.key === "Escape") {
            setValue(discordTag ?? "")
            setEditing(false)
        }
    }

    if (editing && isOwnProfile) {
        return (
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="YourName#0000"
                maxLength={37}
                className="text-[#7289da] text-xs mt-1 bg-surface-deep border border-[#7289da]/40 rounded-md px-2 py-1 w-44 outline-none font-mono"
            />
        )
    }

    if (!value && !isOwnProfile) return null

    return (
        <div className="mt-1">
            <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 127.14 96.36" fill="#7289da" xmlns="http://www.w3.org/2000/svg">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
                <span className="text-[#7289da] text-xs font-mono">
                    {value || (isOwnProfile ? "Add Discord tag" : "")}
                </span>
                {isOwnProfile && (
                    <button
                        onClick={() => setEditing(true)}
                        className="text-text-secondary hover:text-[#7289da] active:text-[#7289da] transition-colors"
                        aria-label="Edit Discord tag"
                    >
                        <Pencil size={12} />
                    </button>
                )}
            </div>
            {error && <p className="text-negative text-[11px] mt-1">{error}</p>}
        </div>
    )
}
