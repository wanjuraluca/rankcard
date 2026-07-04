"use client"

import { useState, useEffect, useRef } from "react"
import { Search, ArrowLeftRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import TopNav from "./TopNav"

function ProfilePicker({ label, value, onSelect }) {
    const [query, setQuery] = useState(value ?? "")
    const [results, setResults] = useState([])
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        function handleClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        const trimmed = query.trim()
        if (trimmed.length < 2) {
            setResults([])
            return
        }
        const timeout = setTimeout(async () => {
            const { data } = await supabase
                .from("profiles")
                .select("username, avatar_url")
                .ilike("username", `%${trimmed}%`)
                .limit(6)
            setResults(data ?? [])
        }, 250)
        return () => clearTimeout(timeout)
    }, [query])

    return (
        <div className="relative flex-1" ref={ref}>
            <p className="text-text-muted text-xs uppercase tracking-widest mb-2">{label}</p>
            <div className="flex items-center gap-2 bg-surface border border-hairline rounded-lg px-3 py-2.5">
                <Search size={14} className="text-text-secondary flex-shrink-0" />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); onSelect(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    placeholder="Search a profile..."
                    className="bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none flex-1 min-w-0"
                />
            </div>
            {open && results.length > 0 && (
                <div className="absolute top-full mt-1.5 left-0 right-0 bg-surface border border-hairline rounded-2xl shadow-lg p-2 z-50">
                    {results.map(r => (
                        <button
                            key={r.username}
                            onClick={() => { onSelect(r.username); setQuery(r.username); setOpen(false) }}
                            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                        >
                            <div className="w-6 h-6 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                                {r.avatar_url && <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />}
                            </div>
                            <span className="text-sm text-text-primary truncate">{r.username}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function ComparePicker({ error }) {
    const [a, setA] = useState("")
    const [b, setB] = useState("")

    return (
        <div className="bg-background min-h-screen">
            <TopNav />
            <div className="flex items-center justify-center p-4" style={{ minHeight: "calc(100vh - 65px)" }}>
                <div className="w-full max-w-lg">
                    <p className="text-text-primary text-lg font-bold mb-1">Compare two profiles</p>
                    <p className="text-text-secondary text-sm mb-6">Pick two RankCard profiles to compare side by side.</p>

                    {error && (
                        <p className="text-negative text-sm mb-4">{error}</p>
                    )}

                    <div className="flex items-end gap-3">
                        <ProfilePicker label="Player A" value={a} onSelect={setA} />
                        <ArrowLeftRight size={18} className="text-text-secondary mb-3 flex-shrink-0" />
                        <ProfilePicker label="Player B" value={b} onSelect={setB} />
                    </div>

                    <a
                        href={a.trim() && b.trim() ? `/compare?a=${encodeURIComponent(a.trim())}&b=${encodeURIComponent(b.trim())}` : undefined}
                        className={`mt-5 block text-center border rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${a.trim() && b.trim() ? "border-accent bg-accent text-black hover:text-white" : "border-hairline text-text-secondary pointer-events-none opacity-50"}`}
                    >
                        Compare
                    </a>
                </div>
            </div>
        </div>
    )
}
