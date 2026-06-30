"use client"
import { useState, useEffect, useMemo } from "react"
import { platformConfig } from "@/lib/platforms"
import { supabase } from "@/lib/supabase"
import UpgradeModal from "@/app/components/UpgradeModal"
import Footer from "@/app/components/Footer"

const gameOptions = ["League of Legends", "TFT", "Valorant", "CSGO"]
const regionOptions = ["EUW", "EUNE", "NA", "KR", "LAN"]
const modeOptions = ["Duo Queue", "Flex", "Clash", "Chill", "Smurf welcome"]

function formatTimeAgo(isoString) {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffMin = Math.floor(diffMs / (1000 * 60))
    if (diffMin < 1) return "just now"
    if (diffMin < 60) return `${diffMin} min ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
}

function formatTimeLeft(isoString) {
    const diffMs = new Date(isoString).getTime() - Date.now()
    if (diffMs <= 0) return "expired"
    const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
    return `${hours}h`
}

export default function FindDuoPage() {
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [gameFilter, setGameFilter] = useState(null)
    const [regionFilter, setRegionFilter] = useState(null)
    const [modeFilter, setModeFilter] = useState(null)
    const [viewerUserId, setViewerUserId] = useState(null)
    const [viewerUsername, setViewerUsername] = useState(null)
    const [, setViewerIsPro] = useState(false)
    const [authChecked, setAuthChecked] = useState(false)
    const [revealedTags, setRevealedTags] = useState({}) // postId -> discordTag
    const [copiedPostId, setCopiedPostId] = useState(null)
    const [revealLoadingId, setRevealLoadingId] = useState(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)

    useEffect(() => {
        fetch("/api/lfg/posts")
            .then(r => r.json())
            .then(d => setPosts(d.posts ?? []))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: authData }) => {
            const user = authData?.user
            setAuthChecked(true)
            if (!user) return
            setViewerUserId(user.id)
            setViewerUsername(user.user_metadata?.username ?? null)
            const { data: profile } = await supabase.from("profiles").select("is_pro").eq("user_id", user.id).maybeSingle()
            setViewerIsPro(profile?.is_pro ?? false)
        })
    }, [])

    async function handleRevealDiscord(post) {
        if (!viewerUserId) {
            window.location.assign("/auth")
            return
        }
        if (revealedTags[post.id]) {
            handleCopy(post.id, revealedTags[post.id])
            return
        }

        setRevealLoadingId(post.id)
        try {
            const res = await fetch("/api/lfg/reveal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ viewerUserId, targetPostId: post.id }),
            })
            const data = await res.json()
            setRevealLoadingId(null)

            if (!data.allowed) {
                setShowUpgradeModal(true)
                return
            }

            setRevealedTags(prev => ({ ...prev, [post.id]: data.discordTag ?? "No Discord tag set" }))
        } catch {
            setRevealLoadingId(null)
        }
    }

    async function handleCopy(postId, tag) {
        try {
            await navigator.clipboard.writeText(tag)
            setCopiedPostId(postId)
            setTimeout(() => setCopiedPostId(null), 2000)
        } catch {
            window.prompt("Copy Discord tag:", tag)
        }
    }

    const filteredPosts = useMemo(() => {
        const query = search.trim().toLowerCase()
        return posts.filter(post => {
            if (gameFilter && post.game !== gameFilter) return false
            if (regionFilter && post.region !== regionFilter) return false
            if (modeFilter && !post.looking_for?.includes(modeFilter)) return false
            if (query) {
                const haystack = [
                    post.game,
                    post.region,
                    post.message,
                    ...(post.looking_for ?? []),
                    ...(post.roles ?? []),
                    post.username,
                ].filter(Boolean).join(" ").toLowerCase()
                if (!haystack.includes(query)) return false
            }
            return true
        })
    }, [posts, search, gameFilter, regionFilter, modeFilter])

    const ownPost = viewerUsername ? posts.find(p => p.username === viewerUsername) : null
    const otherPosts = filteredPosts.filter(p => p.username !== viewerUsername)

    return (
        <div className="bg-background min-h-screen p-3 max-w-[1000px] mx-auto">
            <div className="mt-4 mb-5">
                <p className="text-text-primary text-2xl font-extrabold">Find a Duo</p>
                <p className="text-text-secondary text-sm mt-1">
                    {loading ? "Loading…" : `${posts.length.toLocaleString()} player${posts.length === 1 ? "" : "s"} looking right now`}
                </p>
            </div>

            {/* Own post — highlighted */}
            {ownPost && (
                <div className="bg-surface border border-accent rounded-2xl p-4 mb-4 shadow-[0_0_30px_rgba(177,108,255,0.15)]">
                    <PostCard post={ownPost} isOwn />
                </div>
            )}

            {/* Search */}
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by game, role, region, or message…"
                className="w-full bg-surface border border-line rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none mb-3"
            />

            {/* Filter rows */}
            <div className="flex flex-wrap gap-2 mb-2">
                {gameOptions.map((key) => {
                    const config = platformConfig[key]
                    const isSelected = gameFilter === key
                    return (
                        <button
                            key={key}
                            onClick={() => setGameFilter(isSelected ? null : key)}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-surface text-text-secondary"}`}
                        >
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: config?.color }} />
                            {config?.shortName ?? key}
                        </button>
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
                {regionOptions.map((option) => {
                    const isSelected = regionFilter === option
                    return (
                        <button
                            key={option}
                            onClick={() => setRegionFilter(isSelected ? null : option)}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-surface text-text-secondary"}`}
                        >
                            {option}
                        </button>
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
                {modeOptions.map((option) => {
                    const isSelected = modeFilter === option
                    return (
                        <button
                            key={option}
                            onClick={() => setModeFilter(isSelected ? null : option)}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-surface text-text-secondary"}`}
                        >
                            {option}
                        </button>
                    )
                })}
            </div>

            {/* Posts list */}
            <div className="flex flex-col gap-3">
                {loading && (
                    <p className="text-text-secondary text-sm py-6 text-center">Loading…</p>
                )}
                {!loading && otherPosts.length === 0 && (
                    <p className="text-text-secondary text-sm py-6 text-center">No players found. Try different filters.</p>
                )}
                {!loading && otherPosts.map((post) => (
                    <div key={post.id} className="bg-surface border border-hairline rounded-2xl p-4">
                        <PostCard
                            post={post}
                            authChecked={authChecked}
                            revealedTag={revealedTags[post.id]}
                            copied={copiedPostId === post.id}
                            revealLoading={revealLoadingId === post.id}
                            onRevealDiscord={() => handleRevealDiscord(post)}
                        />
                    </div>
                ))}
            </div>

            {showUpgradeModal && (
                <UpgradeModal
                    onClose={() => setShowUpgradeModal(false)}
                    onUpgraded={() => { setViewerIsPro(true); setShowUpgradeModal(false) }}
                />
            )}

            <div className="mt-8">
                <Footer />
            </div>
        </div>
    )
}

function PostCard({ post, isOwn = false, authChecked, revealedTag, copied, revealLoading, onRevealDiscord }) {
    const config = platformConfig[post.game]

    return (
        <div className="flex items-start gap-3">
            <a href={`/${post.username}`} className="flex-shrink-0">
                <div className="w-11 h-11 rounded-lg border border-accent/40 flex items-center justify-center font-bold text-accent-soft bg-background overflow-hidden">
                    {post.avatar_url
                        ? <img src={post.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <span>{post.username?.[0]?.toUpperCase()}</span>
                    }
                </div>
            </a>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/${post.username}`} className="text-text-primary text-sm font-semibold hover:text-accent-soft transition-colors">
                        {post.username}
                    </a>
                    {post.is_boosted && (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint">
                            Boosted
                        </span>
                    )}
                    <span className="text-text-secondary text-[11px]">
                        {isOwn ? `expires in ${formatTimeLeft(post.expires_at)}` : formatTimeAgo(post.created_at)}
                    </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2">
                    {config && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-hairline text-text-secondary" style={{ borderColor: `${config.color}66`, color: config.color }}>
                            {config.shortName}
                        </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-hairline text-text-secondary">
                        {post.region}
                    </span>
                    {(post.looking_for ?? []).map(tag => (
                        <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-hairline text-text-secondary">
                            {tag}
                        </span>
                    ))}
                    {(post.roles ?? []).map(role => (
                        <span key={role} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-hairline text-text-secondary">
                            {role}
                        </span>
                    ))}
                </div>

                {post.message && (
                    <p className="text-text-secondary text-xs italic mt-2">&quot;{post.message}&quot;</p>
                )}
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0">
                {isOwn ? (
                    <span className="text-text-secondary text-xs px-3 py-2 text-center">Your post</span>
                ) : !authChecked ? null : (
                    <button
                        onClick={onRevealDiscord}
                        disabled={revealLoading}
                        className="rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all disabled:opacity-60"
                        style={{ backgroundColor: revealedTag ? "#5865f2" : "transparent", border: "1px solid #5865f2", color: revealedTag ? "white" : "#7289da" }}
                    >
                        {revealLoading ? "Loading…" : copied ? "Copied ✓" : revealedTag ? revealedTag : "Discord"}
                    </button>
                )}
                <a
                    href={`/${post.username}`}
                    className="border border-line rounded-lg px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-accent/40 active:scale-95 transition-all text-center"
                >
                    Profile
                </a>
            </div>
        </div>
    )
}
