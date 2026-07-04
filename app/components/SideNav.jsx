"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Users, ArrowLeftRight, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SideNav() {
    const [viewerUsername, setViewerUsername] = useState(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const searchRef = useRef(null)
    const inputRef = useRef(null)

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setViewerUsername(data?.user?.user_metadata?.username ?? null)
            setAuthChecked(true)
        })
    }, [])

    useEffect(() => {
        function handleClickOutside(e) {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    useEffect(() => {
        if (searchOpen) inputRef.current?.focus()
    }, [searchOpen])

    useEffect(() => {
        const trimmed = query.trim()
        if (trimmed.length < 2) {
            setResults([])
            return
        }
        setSearching(true)
        const timeout = setTimeout(async () => {
            const { data } = await supabase
                .from("profiles")
                .select("username, avatar_url, is_pro")
                .ilike("username", `%${trimmed}%`)
                .limit(6)
            setResults(data ?? [])
            setSearching(false)
        }, 250)
        return () => clearTimeout(timeout)
    }, [query])

    return (
        <nav className="hidden md:flex fixed left-0 top-0 h-screen w-16 flex-col items-center gap-5 py-4 bg-surface border-r border-hairline z-30">
            <a href="/" className="w-8 h-8 overflow-hidden flex-shrink-0" title="RankCard home">
                <img src="/Icons/LogoSmall.png" alt="RankCard" className="h-8 w-[87px] max-w-none object-cover object-left" />
            </a>

            <div className="w-full flex flex-col items-center gap-3 mt-2">
                <div className="relative" ref={searchRef}>
                    <button
                        onClick={() => setSearchOpen(v => !v)}
                        title="Search a profile"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                    >
                        <Search size={18} />
                    </button>

                    {searchOpen && (
                        <div className="absolute left-14 top-0 w-72 bg-surface border border-hairline rounded-2xl shadow-lg p-2 z-50">
                            <div className="flex items-center gap-2 bg-background border border-hairline rounded-lg px-2.5 py-2 mb-1">
                                <Search size={14} className="text-text-secondary flex-shrink-0" />
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search a profile..."
                                    className="bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none flex-1 min-w-0"
                                />
                                {query && (
                                    <button onClick={() => setQuery("")} className="text-text-secondary hover:text-text-primary flex-shrink-0">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {query.trim().length >= 2 && (
                                <div className="max-h-72 overflow-y-auto">
                                    {searching && (
                                        <p className="text-text-secondary text-xs px-2 py-2">Searching...</p>
                                    )}
                                    {!searching && results.length === 0 && (
                                        <p className="text-text-secondary text-xs px-2 py-2">No profiles found.</p>
                                    )}
                                    {results.map(r => (
                                        <a
                                            key={r.username}
                                            href={`/${r.username}`}
                                            onClick={() => setSearchOpen(false)}
                                            className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-background border border-hairline flex-shrink-0 overflow-hidden">
                                                {r.avatar_url && <img src={r.avatar_url} alt={r.username} className="w-full h-full object-cover" />}
                                            </div>
                                            <span className="text-sm text-text-primary truncate">{r.username}</span>
                                            {r.is_pro && (
                                                <span className="ml-auto text-[10px] font-bold text-accent-soft flex-shrink-0">PRO</span>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <a
                    href="/find"
                    title="Find a Duo"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                    <Users size={18} />
                </a>

                <a
                    href="/compare"
                    title="Compare profiles"
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                    <ArrowLeftRight size={18} />
                </a>
            </div>

            {authChecked && (
                <a
                    href={viewerUsername ? `/${viewerUsername}` : "/auth"}
                    title={viewerUsername ? "Your profile" : "Sign up"}
                    className="mt-auto w-8 h-8 rounded-full bg-background border border-hairline flex-shrink-0 flex items-center justify-center text-text-secondary hover:border-accent/40 transition-colors overflow-hidden"
                >
                    {!viewerUsername && <span className="text-xs font-bold">+</span>}
                </a>
            )}
        </nav>
    )
}
