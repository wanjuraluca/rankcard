"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Users, ArrowLeftRight, Bell, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import AccountMenu from "./AccountMenu"

export default function TopNav({ accountMenu }) {
    const [viewerUsername, setViewerUsername] = useState(null)
    const [viewerAvatarUrl, setViewerAvatarUrl] = useState(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [suggestionsOpen, setSuggestionsOpen] = useState(false)
    const searchRef = useRef(null)

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            const username = data?.user?.user_metadata?.username ?? null
            setViewerUsername(username)
            if (username && !accountMenu) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("avatar_url")
                    .eq("username", username)
                    .maybeSingle()
                setViewerAvatarUrl(profile?.avatar_url ?? null)
            }
            setAuthChecked(true)
        })
    }, [accountMenu])

    useEffect(() => {
        function handleClickOutside(e) {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSuggestionsOpen(false)
            }
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
        <nav className="flex items-center gap-4 px-4 sm:px-8 py-3 border-hairline border-b">
            <a href="/" className="flex items-center gap-2 flex-shrink-0" title="RankCard home">
                <img src="/Icons/LogoSmall.png" alt="RankCard" className="h-7 w-auto" />
            </a>

            <div className="relative flex-1 max-w-xs" ref={searchRef}>
                <div className="flex items-center gap-2 bg-surface border border-hairline rounded-lg px-3 py-2">
                    <Search size={14} className="text-text-secondary flex-shrink-0" />
                    <input
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSuggestionsOpen(true) }}
                        onFocus={() => setSuggestionsOpen(true)}
                        placeholder="Search a profile..."
                        className="bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none flex-1 min-w-0"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="text-text-secondary hover:text-text-primary flex-shrink-0">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {suggestionsOpen && query.trim().length >= 2 && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 bg-surface border border-hairline rounded-2xl shadow-lg p-2 z-50 max-h-72 overflow-y-auto">
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
                                onClick={() => setSuggestionsOpen(false)}
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

            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <a
                    href="/find"
                    className="flex items-center gap-1.5 text-accent-soft bg-accent-tint border border-accent/30 text-xs font-semibold px-3 py-2 rounded-lg hover:text-accent transition-colors"
                >
                    <Users size={14} /> Find a Duo
                </a>
                <a
                    href="/compare"
                    className="flex items-center gap-1.5 text-text-secondary bg-surface border border-hairline text-xs font-semibold px-3 py-2 rounded-lg hover:text-text-primary transition-colors"
                >
                    <ArrowLeftRight size={14} /> Compare
                </a>
                <Bell size={18} className="text-text-secondary" title="Notifications coming soon" aria-hidden="true" />
                {authChecked && (
                    accountMenu ? (
                        <AccountMenu
                            isPro={accountMenu.isPro}
                            stripeCustomerId={accountMenu.stripeCustomerId}
                            username={accountMenu.username}
                            avatarUrl={accountMenu.avatarUrl}
                            onUpgradeClick={accountMenu.onUpgradeClick}
                            onThemeClick={accountMenu.onThemeClick}
                            onEmbedBadgeClick={accountMenu.onEmbedBadgeClick}
                        />
                    ) : (
                        <a
                            href={viewerUsername ? `/${viewerUsername}` : "/auth"}
                            title={viewerUsername ? "Your profile" : "Sign up"}
                            className="w-7 h-7 rounded-full bg-background border border-hairline flex-shrink-0 flex items-center justify-center text-text-secondary hover:border-accent/40 transition-colors overflow-hidden"
                        >
                            {viewerAvatarUrl ? (
                                <img src={viewerAvatarUrl} alt={viewerUsername} className="w-full h-full object-cover" />
                            ) : !viewerUsername ? (
                                <span className="text-xs font-bold">+</span>
                            ) : null}
                        </a>
                    )
                )}
            </div>
        </nav>
    )
}
