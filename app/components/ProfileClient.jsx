"use client"

import AvatarUpload from "./AvatarUpload"
import BannerUpload from "./BannerUpload"
import BioEditor from "./BioEditor"
import DiscordTagEditor from "./DiscordTagEditor"
import AccountMenu from "./AccountMenu"
import Footer from "./Footer"
import { useState, useEffect } from "react"
import { Eye, Share2, UserPlus, UserCheck, ArrowLeftRight, Check, X } from "lucide-react"
import { platformConfig } from "@/lib/platforms"
import { extractGameStats, average } from "@/lib/gameStats"
import { supabase } from "@/lib/supabase"
import RankBadge from "./RankBadge"
import RankHero from "./RankHero"
import ValorantHero from "./ValorantHero"
import Cs2Hero from "./Cs2Hero"
import TftHero from "./TftHero"
import AddGameModal from "./AddGameModal"
import UpgradeModal from "./UpgradeModal"
import ConfirmDialog from "./ConfirmDialog"
import RankInfoModal from "./RankInfoModal"
import ThemeModal from "./ThemeModal"
import RankHistoryChart from "./RankHistoryChart"
import FollowListModal from "./FollowListModal"
import LfgPostModal from "./LfgPostModal"
import { getRankTier } from "@/lib/rankScore"
import { ChevronRight, Users } from "lucide-react"

const gameTabs = [
    { key: "league", platform: "League of Legends" },
    { key: "tft", platform: "TFT" },
    { key: "valorant", platform: "Valorant" },
    { key: "cs2", platform: "CSGO" },
]

export default function ProfileClient({ data, accounts, followerCount: initialFollowerCount = 0, followingCount = 0 }) {

    const [activeTab, setActiveTab] = useState("overall")
    const [showModal, setShowModal] = useState(false)
    const [accountList, setAccountList] = useState(accounts)
    const [gameStats, setGameStats] = useState({})
    const [removingId, setRemovingId] = useState(null)
    const [isOwnProfile, setIsOwnProfile] = useState(false)
    const [shareCopied, setShareCopied] = useState(false)
    const [isPro, setIsPro] = useState(data.is_pro)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [badgeCopiedType, setBadgeCopiedType] = useState(null)
    const [removeTarget, setRemoveTarget] = useState(null)
    const [removeError, setRemoveError] = useState("")
    const [showRankInfo, setShowRankInfo] = useState(false)
    const [viewerUsername, setViewerUsername] = useState(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [viewCount, setViewCount] = useState(data.view_count ?? 0)
    const [theme, setTheme] = useState(data.theme ?? "default")
    const [showThemeModal, setShowThemeModal] = useState(false)
    const [showCompareInput, setShowCompareInput] = useState(false)
    const [compareUsername, setCompareUsername] = useState("")
    const [viewerIsPro, setViewerIsPro] = useState(false)
    const [seasonHigh, setSeasonHigh] = useState(data.season_high ?? null)
    const [liveGame, setLiveGame] = useState(null)
    const [isFollowing, setIsFollowing] = useState(false)
    const [followerCount, setFollowerCount] = useState(initialFollowerCount)
    const [followLoading, setFollowLoading] = useState(false)
    const [viewerUserId, setViewerUserId] = useState(null)
    const [showFollowList, setShowFollowList] = useState(null) // "followers" | "following" | null
    const [friends, setFriends] = useState([])
    const [onlineFriends, setOnlineFriends] = useState({})
    const [lfgPost, setLfgPost] = useState(null)
    const [showLfgModal, setShowLfgModal] = useState(false)
    const [lfgTimeLeft, setLfgTimeLeft] = useState("")

    async function handleFollow() {
        if (!viewerUserId || followLoading) return
        setFollowLoading(true)
        if (isFollowing) {
            await supabase.from("follows").delete().eq("follower_id", viewerUserId).eq("following_id", data.user_id)
            setIsFollowing(false)
            setFollowerCount(c => c - 1)
        } else {
            await supabase.from("follows").insert({ follower_id: viewerUserId, following_id: data.user_id })
            setIsFollowing(true)
            setFollowerCount(c => c + 1)
        }
        setFollowLoading(false)
    }

    async function handleCopyBadge(type) {
        const profileUrl = `${window.location.origin}/${data.username}`
        const badgeUrl = `${window.location.origin}/api/badge?username=${data.username}`
        const text = type === "markdown" ? `[![RankCard](${badgeUrl})](${profileUrl})` : badgeUrl
        try {
            await navigator.clipboard.writeText(text)
            setBadgeCopiedType(type)
            setTimeout(() => setBadgeCopiedType(null), 2000)
        } catch {
            window.prompt("Copy your embed snippet:", text)
        }
    }

    async function handleShareProfile() {
        const profileUrl = `${window.location.origin}/${data.username}`

        if (navigator.share) {
            try {
                await navigator.share({ title: `${data.username} on RankCard`, url: profileUrl })
                return
            } catch (err) {
                // AbortError when the user just closes the share sheet — not a real error, do nothing
                if (err.name === "AbortError") return
            }
        }

        try {
            await navigator.clipboard.writeText(profileUrl)
            setShareCopied(true)
            setTimeout(() => setShareCopied(false), 2000)
        } catch {
            // Clipboard API blocked (old browser, missing permission, etc.) — fall back to a manual copy prompt
            window.prompt("Copy your profile link:", profileUrl)
        }
    }

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data: authData }) => {
            const user = authData?.user
            const ownProfile = user?.id === data.user_id
            setIsOwnProfile(ownProfile)
            const username = user?.user_metadata?.username ?? null
            setViewerUsername(username)
            if (user && username) {
                const { data: vp } = await supabase.from("profiles").select("is_pro").eq("user_id", user.id).maybeSingle()
                setViewerIsPro(vp?.is_pro ?? false)
                setViewerUserId(user.id)
                if (user.id !== data.user_id) {
                    const { data: followRow } = await supabase
                        .from("follows")
                        .select("id")
                        .eq("follower_id", user.id)
                        .eq("following_id", data.user_id)
                        .maybeSingle()
                    setIsFollowing(!!followRow)
                }
            }
            setAuthChecked(true)
        })
    }, [])

    useEffect(() => {
        // Only count once per browser session per profile, never count own profile
        const storageKey = `rc_viewed_${data.username}`
        if (sessionStorage.getItem(storageKey)) return

        // Wait for auth check so we know if this is the owner
        if (!authChecked) return
        if (isOwnProfile) return

        sessionStorage.setItem(storageKey, "1")
        fetch("/api/profile/view", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: data.username }),
        }).then(() => setViewCount(c => c + 1))
    }, [authChecked, isOwnProfile])

    function removeAccount(account) {
        setRemoveTarget(account)
        setRemoveError("")
    }

    async function confirmRemoveAccount() {
        const account = removeTarget
        setRemovingId(account.id)
        const { error } = await supabase.from("connected_accounts").delete().eq("id", account.id)
        setRemovingId(null)

        if (error) {
            setRemoveError(error.message)
            return
        }

        setAccountList(prev => prev.filter(a => a.id !== account.id))
        setGameStats(prev => {
            const { [account.id]: _removed, ...rest } = prev
            return rest
        })
        const tabForAccount = gameTabs.find(t => t.platform === account.platform)
        if (tabForAccount && activeTab === tabForAccount.key) {
            setActiveTab("overall")
        }
        setRemoveTarget(null)
    }

    useEffect(() => {
        const scoredAccounts = accountList.filter(a => a.platform === "League of Legends" || a.platform === "Valorant" || a.platform === "CSGO" || a.platform === "TFT")

        scoredAccounts.forEach(async (account) => {
            const response = await fetch(`/api/summoner?platform=${account.platform}&name=${account.platform_username}&tag=${account.platform_tag}&accountId=${account.id}`)
            const apiData = await response.json()
            const stats = extractGameStats(account.platform, apiData)
            setGameStats(prev => ({ ...prev, [account.id]: stats }))
        })
    }, [accountList])

    const statsList = Object.values(gameStats)
    const avgWinRate = average(statsList.map(s => s?.winRate))
    const avgRankScore = average(statsList.map(s => s?.rankScore))
    const avgKda = average(statsList.map(s => s?.kda))

    useEffect(() => {
        if (!isPro) return
        const lolAccount = accountList.find(a => a.platform === "League of Legends")
        if (!lolAccount?.puuid) return

        fetch(`/api/live-game?puuid=${lolAccount.puuid}&platform=euw1`)
            .then(r => r.json())
            .then(d => setLiveGame(d.inGame ? d : null))
    }, [accountList, isPro])

    useEffect(() => {
        if (!isOwnProfile || avgRankScore == null) return
        const rounded = Math.round(avgRankScore)
        if (seasonHigh != null && rounded <= seasonHigh) return
        setSeasonHigh(rounded)
        supabase.from("profiles").update({ season_high: rounded }).eq("username", data.username)
    }, [avgRankScore, isOwnProfile])

    useEffect(() => {
        // Owner sees their own friends preview regardless of Pro; visitors only when the owner is Pro
        if (!authChecked) return
        if (!isOwnProfile && !isPro) return

        fetch(`/api/profile/connections?username=${data.username}&type=friends`)
            .then(r => r.json())
            .then(d => {
                const users = d.users ?? []
                setFriends(users)

                // Check live-game status for any friend with a connected League or TFT account
                users.forEach(f => {
                    if (f.lolPuuid) {
                        fetch(`/api/live-game?puuid=${f.lolPuuid}&platform=euw1&game=lol`)
                            .then(r => r.json())
                            .then(live => {
                                if (live.inGame) setOnlineFriends(prev => ({ ...prev, [f.username]: "League of Legends" }))
                            })
                    }
                    if (f.tftPuuid) {
                        fetch(`/api/live-game?puuid=${f.tftPuuid}&platform=euw1&game=tft`)
                            .then(r => r.json())
                            .then(live => {
                                if (live.inGame) setOnlineFriends(prev => ({ ...prev, [f.username]: "TFT" }))
                            })
                    }
                })
            })
    }, [authChecked, isOwnProfile, isPro])

    useEffect(() => {
        if (!isOwnProfile || !viewerUserId) return
        supabase
            .from("lfg_posts")
            .select("*")
            .eq("user_id", viewerUserId)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle()
            .then(({ data: post }) => setLfgPost(post ?? null))
    }, [isOwnProfile, viewerUserId])

    useEffect(() => {
        if (!lfgPost?.expires_at) {
            setLfgTimeLeft("")
            return
        }
        function updateTimeLeft() {
            const diffMs = new Date(lfgPost.expires_at).getTime() - Date.now()
            if (diffMs <= 0) {
                setLfgTimeLeft("expired")
                return
            }
            const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)))
            setLfgTimeLeft(`${hours}h`)
        }
        updateTimeLeft()
        const interval = setInterval(updateTimeLeft, 60000)
        return () => clearInterval(interval)
    }, [lfgPost])

    const activeGameTab = gameTabs.find(tab => tab.key === activeTab)

    return (
        <div
            className="bg-background min-h-screen p-3 max-w-[1000px] mx-auto"
            data-theme={!theme.startsWith("custom:") && theme !== "default" ? theme : undefined}
            style={theme.startsWith("custom:") ? (() => {
                const hex = theme.slice(7)
                const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
                return { "--accent": hex, "--accent-soft": hex, "--accent-tint": `rgba(${r},${g},${b},0.12)` }
            })() : undefined}
        >

            {/* Viewer context strip — only shown once auth check resolves */}
            {authChecked && !isOwnProfile && (
                <div className="mb-3 rounded-2xl border border-hairline bg-surface px-4 py-2.5 flex items-center justify-between gap-4 text-sm">
                    {viewerUsername ? (
                        <>
                            <span className="text-text-secondary">
                                Signed in as <span className="text-text-primary font-semibold">{viewerUsername}</span>
                            </span>
                            <a
                                href={`/${viewerUsername}`}
                                className="text-accent-soft font-semibold hover:text-accent active:text-accent transition-colors flex-shrink-0"
                            >
                                ← Your profile
                            </a>
                        </>
                    ) : (
                        <>
                            <span className="text-text-secondary">Get your own RankCard profile — free.</span>
                            <a
                                href="/auth"
                                className="text-accent font-semibold hover:underline flex-shrink-0"
                            >
                                Sign up →
                            </a>
                        </>
                    )}
                </div>
            )}

            {/* Banner */}
            <BannerUpload username={data.username} bannerUrl={data.banner_url} editable={isOwnProfile && isPro} />

            {/* Profile Strip */}
            <div className="bg-surface border border-hairline rounded-b-2xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="-mt-16 self-start relative">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} editable={isOwnProfile} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-text-primary text-2xl font-extrabold relative -top-[3px]" style={{ lineHeight: 1 }}>{data.username}</p>
                        {isPro && (
                            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint">
                                PRO
                            </span>
                        )}
                        {authChecked && isOwnProfile && (
                            <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border border-accent/40 text-accent-soft bg-accent-tint opacity-60">
                                Your profile
                            </span>
                        )}
                    </div>
                    <BioEditor username={data.username} bio={data.bio} isOwnProfile={isOwnProfile} />
                    <DiscordTagEditor username={data.username} discordTag={data.discord_tag} discordUserId={data.discord_user_id} isOwnProfile={isOwnProfile} />
                    <div className="flex items-center gap-3 mt-1.5">
                        <button
                            type="button"
                            onClick={() => setShowFollowList("followers")}
                            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <span className="text-text-primary font-semibold">{followerCount.toLocaleString()}</span> followers
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowFollowList("following")}
                            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                        >
                            <span className="text-text-primary font-semibold">{followingCount.toLocaleString()}</span> following
                        </button>
                    </div>
                    {liveGame && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-positive animate-pulse" />
                            <span className="text-positive text-xs font-semibold">In Game</span>
                            <span className="text-text-secondary text-xs">· League of Legends · {liveGame.queue}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:flex-shrink-0 flex-wrap sm:flex-nowrap relative">
                    <span className="flex items-center gap-1 text-xs text-text-secondary" title="Total profile views">
                        <Eye size={13} className="opacity-70" />
                        {viewCount.toLocaleString()}
                    </span>
                    {authChecked && (showCompareInput ? (
                        <form
                            className="flex items-center gap-1"
                            onSubmit={e => {
                                e.preventDefault()
                                const other = compareUsername.trim()
                                if (other) window.location.href = `/compare?a=${data.username}&b=${other}`
                            }}
                        >
                            <input
                                autoFocus
                                value={compareUsername}
                                onChange={e => setCompareUsername(e.target.value)}
                                placeholder="Enter username…"
                                className="bg-surface border border-accent/40 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none w-36"
                            />
                            <button type="submit" className="border border-accent/40 rounded-lg px-3 py-2 text-sm text-accent hover:bg-accent-tint transition-colors">Go</button>
                            <button type="button" onClick={() => { setShowCompareInput(false); setCompareUsername("") }} className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg">
                                <X size={14} />
                            </button>
                        </form>
                    ) : (
                        <button
                            onClick={() => viewerIsPro ? setShowCompareInput(true) : setShowUpgradeModal(true)}
                            title="Compare profiles"
                            className="border border-hairline rounded-lg p-2 text-text-secondary hover:text-text-primary hover:border-accent/40 hover:bg-accent-tint active:scale-95 transition-all"
                        >
                            <ArrowLeftRight size={15} />
                        </button>
                    ))}
                    {authChecked && !isOwnProfile && viewerUserId && (
                        <button
                            onClick={handleFollow}
                            disabled={followLoading}
                            className={`border rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-all disabled:opacity-60 ${isFollowing ? "border-hairline text-text-secondary hover:border-negative hover:text-negative" : "border-accent text-accent-soft hover:bg-accent-tint"}`}
                        >
                            {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
                            {isFollowing ? "Following" : "Follow"}
                        </button>
                    )}
                    <button
                        onClick={handleShareProfile}
                        className="flex-1 sm:flex-none border border-accent bg-accent rounded-lg px-4 py-2 text-sm font-semibold text-black hover:text-white active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                        {shareCopied ? <Check size={15} /> : <Share2 size={15} />}
                        {shareCopied ? "Link copied" : "Share profile"}
                    </button>
                    {isOwnProfile && <AccountMenu isPro={isPro} stripeCustomerId={data.stripe_customer_id} username={data.username} onUpgradeClick={() => setShowUpgradeModal(true)} onThemeClick={() => setShowThemeModal(true)} />}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 mt-3 flex-wrap">
                <button
                    onClick={() => setActiveTab("overall")}
                    className={`border rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${activeTab === "overall" ? "border-accent/50 bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                >
                    Overall
                </button>
                {gameTabs.map(tab => {
                    const config = platformConfig[tab.platform]
                    const isActive = activeTab === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`border rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 transition-colors ${isActive ? "border-accent/50 bg-accent-tint text-text-primary" : "border-hairline bg-surface text-text-secondary"}`}
                        >
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: config.color }} />
                            {config.shortName}
                        </button>
                    )
                })}
                {isOwnProfile && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="border border-dashed border-accent/45 rounded-lg px-4 py-2 text-sm font-semibold text-accent-soft hover:bg-accent-tint active:bg-accent-tint active:scale-95 transition-all"
                    >
                        + Add Game
                    </button>
                )}
            </div>

            {/* Overall Tab */}
            {activeTab === "overall" && (
                <div>
                    {/* Section Header */}
                    <div className="flex items-center gap-2 mt-5 mb-2.5">
                        <p className="text-text-muted text-xs uppercase tracking-widest">Overall Performance</p>
                        <div className="flex-1 h-px bg-hairline" />
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <button
                            onClick={() => setShowRankInfo(true)}
                            className="bg-surface border border-accent/40 rounded-2xl p-4 text-left hover:bg-accent-tint active:bg-accent-tint active:scale-[0.97] transition-all group"
                        >
                            {(() => {
                                const rankInfo = avgRankScore != null ? getRankTier(Math.round(avgRankScore)) : null
                                return (
                                    <>
                                        <p className="text-accent text-2xl font-extrabold">
                                            {avgRankScore != null ? Math.round(avgRankScore).toLocaleString() : "—"}
                                        </p>
                                        <p className="text-text-secondary text-xs">Rank Score</p>
                                        {rankInfo && (
                                            <p className="text-[11px] font-semibold mt-1" style={{ color: rankInfo.tier.color }}>
                                                {rankInfo.tier.name} · Top {rankInfo.topPercent.toFixed(1)}%
                                            </p>
                                        )}
                                        {isPro && seasonHigh != null && (
                                            <p className="text-text-secondary text-[10px] mt-1">
                                                Season high: <span className="text-text-primary font-semibold">{seasonHigh.toLocaleString()}</span>
                                            </p>
                                        )}
                                    </>
                                )
                            })()}
                        </button>
                        <div className="bg-surface border border-hairline rounded-2xl p-4">
                            <p className="text-text-primary text-2xl font-extrabold">
                                {avgWinRate != null ? `${Math.round(avgWinRate)}%` : "—"}
                            </p>
                            <p className="text-text-secondary text-xs">Avg Win Rate</p>
                        </div>
                        <div className="bg-surface border border-hairline rounded-2xl p-4">
                            <p className="text-text-primary text-2xl font-extrabold">
                                {avgKda != null ? avgKda.toFixed(2) : "—"}
                            </p>
                            <p className="text-text-secondary text-xs">Avg KDA</p>
                        </div>
                        <div className="bg-surface border border-hairline rounded-2xl p-4">
                            <p className="text-text-primary text-2xl font-extrabold">{accountList.length}</p>
                            <p className="text-text-secondary text-xs">Games Connected</p>
                        </div>
                    </div>

                    {/* Connected Games Header */}
                    <div className="flex items-center gap-2 mt-5 mb-2.5">
                        <p className="text-text-muted text-xs uppercase tracking-widest">Connected Games</p>
                        <div className="flex-1 h-px bg-hairline" />
                    </div>

                    {/* Connected Games Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {accountList.map((account) => {
                            const config = platformConfig[account.platform]
                            const tabForAccount = gameTabs.find(t => t.platform === account.platform)
                            return (
                                <div
                                    key={account.id}
                                    onClick={() => tabForAccount && setActiveTab(tabForAccount.key)}
                                    className="bg-surface border border-hairline rounded-2xl p-4 cursor-pointer hover:border-accent/40 active:border-accent/40 active:scale-[0.98] transition-all relative"
                                    style={{ borderTopWidth: 3, borderTopColor: config?.color }}
                                >
                                    {isOwnProfile && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeAccount(account) }}
                                            disabled={removingId === account.id}
                                            title="Remove account"
                                            className="absolute top-2.5 right-2.5 text-text-secondary hover:text-negative active:text-negative active:scale-90 transition-transform disabled:opacity-40"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div
                                            className="rounded-lg flex items-center justify-center"
                                            style={{ width: 30, height: 34, backgroundColor: `${config?.color}24`, border: `1px solid ${config?.color}66` }}
                                        >
                                            {config?.imageUrl ? (
                                                <img src={config.imageUrl} width="14" height="14" alt={config.shortName} />
                                            ) : (
                                                <svg role="img" viewBox="0 0 24 24" width="14" height="14" fill={config?.color}>
                                                    <path d={config?.icon.path} fillRule={config?.icon.fillRule ?? "nonzero"} />
                                                </svg>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-text-primary text-xs font-bold">{config?.shortName}</p>
                                            <p className="text-text-secondary text-[10px] font-mono">
                                                {account.platform_username}{account.platform_tag ? `#${account.platform_tag}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <RankBadge account={account} />
                                </div>
                            )
                        })}
                        {/* Add Game Card */}
                        {isOwnProfile && (
                            <div onClick={() => setShowModal(true)} className="bg-surface border border-dashed border-accent/35 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent/60 active:border-accent/60 active:scale-[0.98] transition-all min-h-[110px]">
                                <p className="text-accent-soft text-xl">＋</p>
                                <p className="text-accent-soft text-xs">Add Game</p>
                            </div>
                        )}
                    </div>

                    {/* Find a Duo entry point — post/manage for the owner, browse-only link for visitors */}
                    {isOwnProfile ? (
                        <div
                            onClick={() => setShowLfgModal(true)}
                            className="mt-3 border border-dashed border-hairline rounded-2xl p-3 flex items-center justify-between cursor-pointer hover:border-accent/40 active:scale-[0.99] transition-all"
                        >
                            {lfgPost && lfgTimeLeft !== "expired" ? (
                                <span className="flex items-center gap-2 text-sm">
                                    <span className="w-2 h-2 rounded-full bg-positive flex-shrink-0" />
                                    <span className="text-text-primary font-semibold">Currently looking</span>
                                    <span className="text-text-secondary">· expires in {lfgTimeLeft}</span>
                                </span>
                            ) : (
                                <span className="flex items-center gap-2 text-text-secondary text-sm">
                                    <Users size={15} className="flex-shrink-0" />
                                    Looking for a Duo? · <span className="text-text-primary font-semibold">Post on the board</span> · visible for {isPro ? "72h" : "24h"}
                                </span>
                            )}
                            <ChevronRight size={16} className="text-text-secondary flex-shrink-0" />
                        </div>
                    ) : (
                        <a
                            href="/find"
                            className="mt-3 border border-dashed border-hairline rounded-2xl p-3 flex items-center justify-between hover:border-accent/40 active:scale-[0.99] transition-all"
                        >
                            <span className="flex items-center gap-2 text-text-secondary text-sm">
                                <Users size={15} className="flex-shrink-0" />
                                Browse the <span className="text-text-primary font-semibold">Find a Duo</span> board
                            </span>
                            <ChevronRight size={16} className="text-text-secondary flex-shrink-0" />
                        </a>
                    )}
                    {isOwnProfile && (
                        <a href="/find" className="mt-1.5 inline-block text-text-secondary text-xs hover:text-accent-soft transition-colors">
                            Or browse the board →
                        </a>
                    )}

                    {/* Friends Section — mutual follows, Pro feature for visitors */}
                    {(isPro || isOwnProfile) && (
                        <>
                            <div className="flex items-center gap-2 mt-5 mb-2.5">
                                <p className="text-text-muted text-xs uppercase tracking-widest">Friends</p>
                                <div className="flex-1 h-px bg-hairline" />
                            </div>
                            {isOwnProfile && !isPro ? (
                                <button
                                    onClick={() => setShowUpgradeModal(true)}
                                    className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                                >
                                    Friends list is a <span className="text-accent-soft font-semibold">Pro</span> feature. Upgrade →
                                </button>
                            ) : friends.length === 0 ? (
                                <p className="text-text-secondary text-sm">No mutual friends yet.</p>
                            ) : (
                                <div className="flex gap-3 overflow-x-auto pb-1">
                                    {friends.map((friend) => (
                                        <a
                                            key={friend.username}
                                            href={`/${friend.username}`}
                                            className="bg-surface border border-hairline rounded-2xl p-3 flex flex-col items-center gap-2 hover:border-accent/40 active:scale-[0.97] transition-all flex-shrink-0 w-24"
                                        >
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-lg border border-accent/40 flex items-center justify-center font-bold text-accent-soft bg-background overflow-hidden">
                                                    {friend.avatar_url
                                                        ? <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" />
                                                        : <span>{friend.username[0]}</span>
                                                    }
                                                </div>
                                                {onlineFriends[friend.username] && (
                                                    <span
                                                        className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-positive border-2 border-surface"
                                                        title={`In game · ${onlineFriends[friend.username]}`}
                                                    />
                                                )}
                                            </div>
                                            <p className="text-text-primary text-xs font-semibold truncate w-full text-center">{friend.username}</p>
                                            {onlineFriends[friend.username] && (
                                                <p className="text-positive text-[10px] font-semibold -mt-1.5 truncate w-full text-center">
                                                    {onlineFriends[friend.username] === "TFT" ? "In Game · TFT" : "In Game"}
                                                </p>
                                            )}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Rank History Chart */}
                    <div className="flex items-center gap-2 mt-5 mb-2.5">
                        <p className="text-text-muted text-xs uppercase tracking-widest">Overall LP / Rating History</p>
                        <div className="flex-1 h-px bg-hairline" />
                    </div>
                    <div className="bg-surface border border-hairline rounded-2xl p-4">
                        <RankHistoryChart username={data.username} />
                    </div>

                    {/* Export Card */}
                    {isOwnProfile && (
                        <>
                            <div className="flex items-center gap-2 mt-5 mb-2.5">
                                <p className="text-text-muted text-xs uppercase tracking-widest">Export Card</p>
                                <div className="flex-1 h-px bg-hairline" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <a
                                    href={`/api/card?username=${data.username}`}
                                    download
                                    className="border border-accent/40 rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-accent-tint active:bg-accent-tint active:scale-95 transition-all"
                                >
                                    Download Overall Card
                                </a>
                                {isPro ? (
                                    [...new Set(accountList.map(a => a.platform))].map((platform) => {
                                        const config = platformConfig[platform]
                                        return (
                                            <a
                                                key={platform}
                                                href={`/api/card?username=${data.username}&platform=${platform}`}
                                                download
                                                className="border border-hairline rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover active:scale-95 transition-all"
                                            >
                                                Download {config?.shortName ?? platform} Card
                                            </a>
                                        )
                                    })
                                ) : (
                                    <button
                                        onClick={() => setShowUpgradeModal(true)}
                                        className="self-center text-xs text-text-secondary hover:text-text-primary transition-colors"
                                    >
                                        Per-game cards are a <span className="text-accent-soft font-semibold">Pro</span> feature. Upgrade →
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                    {/* Embed Badge */}
                    {isOwnProfile && (
                        <>
                            <div className="flex items-center gap-2 mt-5 mb-2.5">
                                <p className="text-text-muted text-xs uppercase tracking-widest">Embed Badge</p>
                                <div className="flex-1 h-px bg-hairline" />
                            </div>
                            <div className="bg-surface border border-hairline rounded-2xl p-4">
                                <p className="text-text-muted text-xs mb-3">
                                    Always shows your current rank.
                                </p>
                                <img
                                    src={`/api/badge?username=${data.username}`}
                                    alt={`${data.username}'s RankCard badge`}
                                    className="rounded-lg border border-hairline max-w-full"
                                    style={{ width: 300, height: 70 }}
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <button
                                        onClick={() => handleCopyBadge("url")}
                                        className="border border-accent/40 rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-accent-tint active:bg-accent-tint active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                        {badgeCopiedType === "url" ? <><Check size={14} /> Copied</> : "Copy image URL (Discord / Slack)"}
                                    </button>
                                    <button
                                        onClick={() => handleCopyBadge("markdown")}
                                        className="border border-hairline rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover active:scale-95 transition-all flex items-center gap-1.5"
                                    >
                                        {badgeCopiedType === "markdown" ? <><Check size={14} /> Copied</> : "Copy Markdown (GitHub)"}
                                    </button>
                                </div>
                                <p className="text-text-muted text-[11px] mt-2">
                                    Discord/Slack: paste the image URL alone in a message — it auto-embeds. GitHub: use the Markdown snippet in your README.
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Per-game detail tabs */}
            {activeGameTab && (() => {
                const config = platformConfig[activeGameTab.platform]
                const account = accountList.find(a => a.platform === activeGameTab.platform)

                return (
                    <div>
                        <div className="flex items-center gap-2 mt-5 mb-2.5">
                            <p className="text-text-muted text-xs uppercase tracking-widest">{config.name}</p>
                            <div className="flex-1 h-px bg-hairline" />
                            {account && isOwnProfile && (
                                <button
                                    onClick={() => removeAccount(account)}
                                    disabled={removingId === account.id}
                                    className="text-text-secondary hover:text-negative text-xs disabled:opacity-40"
                                >
                                    Remove account
                                </button>
                            )}
                        </div>

                        {account ? (
                            activeGameTab.platform === "League of Legends" ? (
                                <RankHero account={account} accentColor={config.color} />
                            ) : activeGameTab.platform === "Valorant" ? (
                                <ValorantHero account={account} accentColor={config.color} />
                            ) : activeGameTab.platform === "TFT" ? (
                                <TftHero account={account} accentColor={config.color} />
                            ) : (
                                <Cs2Hero account={account} accentColor={config.color} />
                            )
                        ) : (
                            <div
                                onClick={() => isOwnProfile && setShowModal(true)}
                                className={`bg-surface border border-dashed border-hairline rounded-2xl p-6 text-center ${isOwnProfile ? "cursor-pointer hover:border-accent/50 transition-colors" : ""}`}
                            >
                                <p className="text-text-secondary text-sm">No {config.name} account connected yet.</p>
                                {isOwnProfile && <p className="text-accent-soft text-sm mt-1">+ Add Game</p>}
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* Add Game Modal */}
            {showModal && (
                <AddGameModal
                    onClose={() => setShowModal(false)}
                    onConnected={(newAccount) => setAccountList([...accountList, newAccount])}
                    existingAccounts={accountList}
                />
            )}

            {/* Upgrade to Pro Modal */}
            {showUpgradeModal && (
                <UpgradeModal
                    onClose={() => setShowUpgradeModal(false)}
                    onUpgraded={() => { setIsPro(true); setShowUpgradeModal(false) }}
                />
            )}

            {/* Remove Account Confirmation */}
            {removeTarget && (
                <ConfirmDialog
                    title="Remove this account?"
                    message={`${removeTarget.platform_username}${removeTarget.platform_tag ? `#${removeTarget.platform_tag}` : ""} (${platformConfig[removeTarget.platform]?.shortName}) will be unlinked from your profile.`}
                    confirmLabel="Remove"
                    danger
                    loading={removingId === removeTarget.id}
                    error={removeError}
                    onCancel={() => { setRemoveTarget(null); setRemoveError("") }}
                    onConfirm={confirmRemoveAccount}
                />
            )}

            {/* Followers / Following List Modal */}
            {showFollowList && (
                <FollowListModal
                    username={data.username}
                    type={showFollowList}
                    onClose={() => setShowFollowList(null)}
                />
            )}

            {/* Rank Info Modal */}
            {showRankInfo && (
                <RankInfoModal score={avgRankScore} onClose={() => setShowRankInfo(false)} />
            )}

            {/* Find a Duo Post Modal */}
            {showLfgModal && (
                <LfgPostModal
                    onClose={() => setShowLfgModal(false)}
                    accounts={accountList}
                    discordTag={data.discord_tag}
                    isPro={isPro}
                    existingPost={lfgPost && lfgTimeLeft !== "expired" ? lfgPost : null}
                    onPosted={(post) => setLfgPost(post)}
                    onRemoved={() => setLfgPost(null)}
                />
            )}

            {/* Theme Modal */}
            {showThemeModal && (
                <ThemeModal
                    currentTheme={theme}
                    onClose={() => setShowThemeModal(false)}
                    onSaved={(t) => setTheme(t)}
                />
            )}

            <div className="mt-8">
                <Footer />
            </div>

        </div>
    )
}
