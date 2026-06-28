"use client"
import { useState, useRef, useEffect } from "react"
import { Pencil } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function BioEditor({ username, bio }) {
    const [value, setValue] = useState(bio ?? "")
    const [editing, setEditing] = useState(false)
    const [error, setError] = useState("")
    const inputRef = useRef(null)

    useEffect(() => {
        if (editing) inputRef.current?.focus()
    }, [editing])

    async function handleSave() {
        setEditing(false)
        if (value === bio) return

        const { error } = await supabase
            .from("profiles")
            .update({ bio: value })
            .eq("username", username)

        if (error) {
            setError("Couldn't save bio. Try again.")
            setValue(bio ?? "")
        }
    }

    function handleKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault()
            inputRef.current?.blur()
        }
        if (e.key === "Escape") {
            setValue(bio ?? "")
            setEditing(false)
        }
    }

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder="Add a bio..."
                maxLength={120}
                className="text-text-secondary font-mono text-sm mt-1 bg-surface-deep border border-accent/40 rounded-md px-2 py-1 w-full max-w-sm outline-none"
            />
        )
    }

    return (
        <div className="mt-1">
            <div className="group flex items-center gap-1.5">
                <p className="text-text-secondary font-mono text-sm">
                    {value || "Add a bio..."}
                </p>
                <button
                    onClick={() => setEditing(true)}
                    className="text-text-secondary hover:text-accent-soft opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Edit bio"
                >
                    <Pencil size={13} />
                </button>
            </div>
            {error && <p className="text-negative text-[11px] mt-1">{error}</p>}
        </div>
    )
}
