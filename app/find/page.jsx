"use client"
import { useState, useEffect, useMemo } from "react"
import { platformConfig } from "@/lib/platforms"
import { supabase } from "@/lib/supabase"
import { extractGameStats } from "@/lib/gameStats"
import UpgradeModal from "@/app/components/UpgradeModal"
import Footer from "@/app/components/Footer"
import { Check } from "lucide-react"

const gameOptions = ["League of Legends", "TFT", "Valorant", "CSGO"]
const regionOptions = ["EUW", "EUNE", "NA", "KR"]
const modeOptions = ["Duo Queue", "Flex", "Clash", "Chill", "Smurf welcome"]

// Role chips are only meaningful for the two games that actually have lane /
// agent-class roles — mirrors roleOptionsByGame in LfgPostModal.jsx. TFT and
// CS2 have no role concept, so the role filter row just doesn't render for them.
const roleOptionsByGame = {
    "League of Legends": ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"],
    Valorant: ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"],
}

// Heuristic tolerance for "close enough" rank matching, both for the My ELO
// filter and the Good match badge. Not meant to be precise — just rules out
// wildly mismatched skill levels (e.g. Iron vs. Diamond) while staying loose
// enough that it doesn't feel useless. Picked by eye against the 0-3000 scale.
const ELO_MATCH_TOLERANCE = 400

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
    const [roleFilter, setRoleFilter] = useState(null)
    const [regionFilter, setRegionFilter] = useState(null)
    const [modeFilter, setModeFilter] = useState(null)
    const [eloFilter, setEloFilter] = useState(false)
    const [viewerUserId, setViewerUserId] = useState(null)
    const [viewerUsername, setViewerUsername] = useState(null)
    const [, setViewerIsPro] = useState(false)
    const [viewerAccounts, setViewerAccounts] = useState([])
    const [viewerRankScores, setViewerRankScores] = useState({}) // platform -> rankScore
    const [authChecked, setAuthChecked] = useState(false)
    const [revealedTags, setRevealedTags] = useState({}) // postId -> discordTag
    const [copiedPostId, setCopiedPostId] = useState(null)
    const [revealLoadingId, setRevealLoadingId] = useState(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [onlinePostIds, setOnlinePostIds] = useState({}) // postId -> true

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

            const { data: accounts } = await supabase.from("connected_accounts").select("*").eq("user_id", user.id)
            setViewerAccounts(accounts ?? [])
        })
    }, [])

    // Fetch the viewer's own rank score per game — same call pattern as
    // ProfileClient's gameStats effect and LfgPostModal's submit handler.
    // Needed for both the "My ELO ±1" filter and the "Good match" badge.
    useEffect(() => {
        const scoredAccounts = viewerAccounts.filter(a => ["League of Legends", "Valorant", "CSGO", "TFT"].includes(a.platform))
        scoredAccounts.forEach(async (account) => {
            try {
                const res = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`)
                const apiData = await res.json()
                const stats = extractGameStats(account.platform, apiData)
                if (stats?.rankScore != null) {
                    setViewerRankScores(prev => ({ ...prev, [account.platform]: stats.rankScore }))
                }
            } catch {
                // ignore — filter/badge just stays unavailable for this game
            }
        })
    }, [viewerAccounts])

    // Live-status check per post — only League/TFT posts carry a puuid (see
    // app/api/lfg/posts/route.js), same /api/live-game pattern as friends
    // online dots in ProfileClient.jsx.
    useEffect(() => {
        const livePosts = posts.filter(p => p.puuid && (p.game === "League of Legends" || p.game === "TFT"))
        livePosts.forEach(post => {
            const gameParam = post.game === "TFT" ? "tft" : "lol"
            fetch(`/api/live-game?puuid=${post.puuid}&platform=euw1&game=${gameParam}`)
                .then(r => r.json())
                .then(d => {
                    if (d.inGame) setOnlinePostIds(prev => ({ ...prev, [post.id]: true }))
                })
                .catch(() => {})
        })
    }, [posts])

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
            const { data: sessionData } = await supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            const res = await fetch("/api/lfg/reveal", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ targetPostId: post.id }),
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

    // The ELO filter only makes sense once a specific game is selected (a
    // single rank_score isn't comparable across games), and only if the
    // viewer has a connected + scored account for that game.
    const eloFilterApplicableScore = gameFilter ? viewerRankScores[gameFilter] : null
    const eloFilterAvailable = eloFilterApplicableScore != null

    const showRoleRow = gameFilter && roleOptionsByGame[gameFilter]

    const filteredPosts = useMemo(() => {
        const query = search.trim().toLowerCase()
        return posts.filter(post => {
            if (gameFilter && post.game !== gameFilter) return false
            if (roleFilter && !post.roles?.includes(roleFilter)) return false
            if (regionFilter && post.region !== regionFilter) return false
            if (modeFilter && !post.looking_for?.includes(modeFilter)) return false
            if (eloFilter && eloFilterAvailable) {
                if (post.rank_score == null) return false
                if (Math.abs(post.rank_score - eloFilterApplicableScore) > ELO_MATCH_TOLERANCE) return false
            }
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
    }, [posts, search, gameFilter, roleFilter, regionFilter, modeFilter, eloFilter, eloFilterAvailable, eloFilterApplicableScore])

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
                <div className="bg-surface border border-accent rounded-2xl p-4 mb-4">
                    <PostCard post={ownPost} isOwn isOnline={!!onlinePostIds[ownPost.id]} />
                </div>
            )}

            {/* Search */}
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by game, role, region, or message…"
                className="w-full bg-surface border border-hairline rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none mb-3"
            />

            {/* Filter row 1 — games */}
            <div className="flex flex-wrap gap-2 mb-2">
                {gameOptions.map((key) => {
                    const config = platformConfig[key]
                    const isSelected = gameFilter === key
                    return (
                        <button
                            key={key}
                            onClick={() => { setGameFilter(isSelected ? null : key); setRoleFilter(null) }}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                        >
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: config?.color }} />
                            {config?.shortName ?? key}
                        </button>
                    )
                })}
            </div>

            {/* Filter row 2 — roles, only when a role-capable game is selected */}
            {showRoleRow && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {roleOptionsByGame[gameFilter].map((option) => {
                        const isSelected = roleFilter === option
                        return (
                            <button
                                key={option}
                                onClick={() => setRoleFilter(isSelected ? null : option)}
                                className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                            >
                                {option}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Filter row 3 — region */}
            <div className="flex flex-wrap gap-2 mb-2">
                {regionOptions.map((option) => {
                    const isSelected = regionFilter === option
                    return (
                        <button
                            key={option}
                            onClick={() => setRegionFilter(isSelected ? null : option)}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                        >
                            {option}
                        </button>
                    )
                })}
                <button
                    onClick={() => eloFilterAvailable && setEloFilter(f => !f)}
                    disabled={!eloFilterAvailable}
                    title={!gameFilter ? "Select a game first" : !eloFilterAvailable ? "Connect this game first" : undefined}
                    className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${eloFilter && eloFilterAvailable ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"} ${!eloFilterAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                    My ELO ±1
                </button>
            </div>

            {/* Filter row 4 — mode */}
            <div className="flex flex-wrap gap-2 mb-5">
                {modeOptions.map((option) => {
                    const isSelected = modeFilter === option
                    return (
                        <button
                            key={option}
                            onClick={() => setModeFilter(isSelected ? null : option)}
                            className={`border rounded-lg px-3 py-1.5 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
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
                {!loading && otherPosts.map((post) => {
                    const viewerScoreForPost = viewerRankScores[post.game]
                    const isGoodMatch = viewerScoreForPost != null && post.rank_score != null
                        && Math.abs(viewerScoreForPost - post.rank_score) <= ELO_MATCH_TOLERANCE

                    return (
                        <div key={post.id} className="bg-surface border border-hairline rounded-2xl p-4">
                            <PostCard
                                post={post}
                                authChecked={authChecked}
                                revealedTag={revealedTags[post.id]}
                                copied={copiedPostId === post.id}
                                revealLoading={revealLoadingId === post.id}
                                onRevealDiscord={() => handleRevealDiscord(post)}
                                isOnline={!!onlinePostIds[post.id]}
                                isGoodMatch={isGoodMatch}
                            />
                        </div>
                    )
                })}
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

function PostCard({ post, isOwn = false, authChecked, revealedTag, copied, revealLoading, onRevealDiscord, isOnline = false, isGoodMatch = false }) {
    const config = platformConfig[post.game]
    const role = post.roles?.[0] ?? null

    return (
        <div className="flex items-start gap-3">
            <a href={`/${post.username}`} className="flex-shrink-0 relative">
                <div className="w-11 h-11 rounded-lg border border-accent/40 flex items-center justify-center font-bold text-accent-soft bg-background overflow-hidden">
                    {post.avatar_url
                        ? <img src={post.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <span>{post.username?.[0]?.toUpperCase()}</span>
                    }
                </div>
                {isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-positive border-2 border-surface" title="In game" />
                )}
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
                    {isGoodMatch && (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border border-positive/40 text-positive bg-positive/10">
                            Good match
                        </span>
                    )}
                    <span className="text-text-secondary text-[11px]">
                        {isOwn ? `expires in ${formatTimeLeft(post.expires_at)}` : formatTimeAgo(post.created_at)}
                    </span>
                </div>

                {/* Rank · Region · Role summary line */}
                {(post.rank_label || post.region || role) && (
                    <p className="text-text-secondary text-xs mt-1">
                        {[post.rank_label, post.region, role].filter(Boolean).join(" · ")}
                    </p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-2">
                    {config && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border" style={{ borderColor: `${config.color}66`, color: config.color }}>
                            {config.shortName}
                        </span>
                    )}
                    {role && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint">
                            {role}
                        </span>
                    )}
                    {post.region && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-positive/40 text-positive bg-positive/10">
                            {post.region}
                        </span>
                    )}
                    {(post.looking_for ?? []).map(tag => (
                        <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-hairline text-text-secondary">
                            {tag}
                        </span>
                    ))}
                </div>

                {post.message && (
                    <p className="text-text-secondary text-xs italic mt-2">&quot;{post.message}&quot;</p>
                )}
            </div>

            <div className="flex flex-col gap-2 flex-shrink-0 w-24">
                {isOwn ? (
                    <span className="text-text-secondary text-xs px-3 py-2 text-center">Your post</span>
                ) : !authChecked ? null : (
                    <button
                        onClick={onRevealDiscord}
                        disabled={revealLoading}
                        className="w-full rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: revealedTag ? "#5865f2" : "transparent", border: "1px solid #5865f2", color: revealedTag ? "white" : "#7289da" }}
                    >
                        {revealLoading ? "Loading…" : copied ? <><Check size={13} /> Copied</> : revealedTag ? revealedTag : "Discord"}
                    </button>
                )}
                <a
                    href={`/${post.username}`}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-xs text-text-secondary hover:text-text-primary hover:border-accent/40 active:scale-95 transition-all text-center"
                >
                    Profile
                </a>
            </div>
        </div>
    )
}
