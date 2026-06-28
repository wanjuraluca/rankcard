"use client"

import AvatarUpload from "./AvatarUpload"
import BioEditor from "./BioEditor"
import AccountMenu from "./AccountMenu"
import Footer from "./Footer"
import { useState, useEffect } from "react"
import { platformConfig } from "@/lib/platforms"
import { getLeagueScore, getValorantScore, getCs2Score } from "@/lib/rankScore"
import { supabase } from "@/lib/supabase"
import RankBadge from "./RankBadge"
import RankHero from "./RankHero"
import ValorantHero from "./ValorantHero"
import Cs2Hero from "./Cs2Hero"
import AddGameModal from "./AddGameModal"

const gameTabs = [
    { key: "league", platform: "League of Legends" },
    { key: "valorant", platform: "Valorant" },
    { key: "cs2", platform: "CSGO" },
]

// Only games with a live rank/match API behind them (lib/rankScore.js) feed
// into the overall averages below — CS2 has no API integration yet, so it's
// simply excluded until that's wired up. Adding a new game means adding a
// branch here and a percentile table in lib/rankScore.js, nothing else.
function extractGameStats(platform, apiData) {
    if (platform === "League of Legends") {
        if (!Array.isArray(apiData.rankData)) return null
        const entry = apiData.rankData.find(q => q.queueType === "RANKED_SOLO_5x5")
        if (!entry) return null
        const totalGames = entry.wins + entry.losses
        const matchHistory = Array.isArray(apiData.matchHistory) ? apiData.matchHistory : []
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        return {
            winRate: totalGames > 0 ? (entry.wins / totalGames) * 100 : null,
            rankScore: getLeagueScore(entry.tier, entry.rank),
            kda: average(kdas),
        }
    }

    if (platform === "Valorant") {
        const tierName = apiData.valorantData?.data?.current?.tier?.name
        const matchHistory = Array.isArray(apiData.valorantMatchHistory) ? apiData.valorantMatchHistory : []
        const wins = matchHistory.filter(m => m.win).length
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        return {
            winRate: matchHistory.length > 0 ? (wins / matchHistory.length) * 100 : null,
            rankScore: getValorantScore(tierName),
            kda: average(kdas),
        }
    }

    if (platform === "CSGO") {
        const matchHistory = Array.isArray(apiData.cs2MatchHistory) ? apiData.cs2MatchHistory : []
        const wins = matchHistory.filter(m => m.win).length
        const kdas = matchHistory.map(m => (m.kills + m.assists) / Math.max(m.deaths, 1))
        return {
            winRate: matchHistory.length > 0 ? (wins / matchHistory.length) * 100 : null,
            rankScore: getCs2Score(apiData.cs2Profile?.ranks?.premier),
            kda: average(kdas),
        }
    }

    return null
}

function average(numbers) {
    const valid = numbers.filter(n => n != null)
    if (valid.length === 0) return null
    return valid.reduce((sum, n) => sum + n, 0) / valid.length
}

export default function ProfileClient({ data, accounts }) {

    const [activeTab, setActiveTab] = useState("overall")
    const [showModal, setShowModal] = useState(false)
    const [accountList, setAccountList] = useState(accounts)
    const [gameStats, setGameStats] = useState({})
    const [removingId, setRemovingId] = useState(null)
    const [isOwnProfile, setIsOwnProfile] = useState(false)
    const [shareCopied, setShareCopied] = useState(false)

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
        supabase.auth.getUser().then(({ data: authData }) => {
            setIsOwnProfile(authData?.user?.id === data.user_id)
        })
    }, [])

    async function removeAccount(account) {
        const confirmed = window.confirm(
            `Remove ${account.platform_username}${account.platform_tag ? `#${account.platform_tag}` : ""} (${platformConfig[account.platform]?.shortName})?`
        )
        if (!confirmed) return

        setRemovingId(account.id)
        const { error } = await supabase.from("connected_accounts").delete().eq("id", account.id)
        setRemovingId(null)

        if (error) {
            window.alert(`Could not remove account: ${error.message}`)
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
    }

    useEffect(() => {
        const scoredAccounts = accountList.filter(a => a.platform === "League of Legends" || a.platform === "Valorant" || a.platform === "CSGO")

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

    const activeGameTab = gameTabs.find(tab => tab.key === activeTab)

    return (
        <div className="bg-background min-h-screen p-3 max-w-[1000px] mx-auto">

            {/* Banner */}
            <div className="h-[140px] rounded-t-2xl border border-line border-b-0 bg-[radial-gradient(ellipse_55%_130%_at_20%_60%,rgba(177,108,255,0.45),transparent_60%)]" />

            {/* Profile Strip */}
            <div className="bg-surface border border-line rounded-b-2xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="-mt-16 self-start">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-text-primary text-2xl font-extrabold">{data.username}</p>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                    </div>
                    <BioEditor username={data.username} bio={data.bio} />
                </div>
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <button
                        onClick={handleShareProfile}
                        className="flex-1 sm:flex-none border border-accent/40 rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-accent-tint active:bg-accent-tint active:scale-95 transition-all"
                    >
                        {shareCopied ? "Link copied ✓" : "Share profile ↗"}
                    </button>
                    {isOwnProfile && <AccountMenu />}
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
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Overall Performance</p>
                        <div className="flex-1 h-px bg-hairline" />
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-surface border border-accent/40 rounded-2xl p-4">
                            <p className="text-accent text-2xl font-extrabold">
                                {avgRankScore != null ? Math.round(avgRankScore).toLocaleString() : "—"}
                            </p>
                            <p className="text-text-secondary text-xs">Rank Score</p>
                        </div>
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
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Connected Games</p>
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
                                            className="absolute top-2.5 right-2.5 text-text-secondary hover:text-negative active:text-negative active:scale-90 transition-transform text-xs leading-none disabled:opacity-40"
                                        >
                                            ✕
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div
                                            className="rounded-[9px] flex items-center justify-center"
                                            style={{ width: 30, height: 34, backgroundColor: `${config?.color}24`, border: `1px solid ${config?.color}66` }}
                                        >
                                            <svg role="img" viewBox="0 0 24 24" width="14" height="14" fill={config?.color}>
                                                <path d={config?.icon.path} />
                                            </svg>
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
                </div>
            )}

            {/* Per-game detail tabs */}
            {activeGameTab && (() => {
                const config = platformConfig[activeGameTab.platform]
                const account = accountList.find(a => a.platform === activeGameTab.platform)

                return (
                    <div>
                        <div className="flex items-center gap-2 mt-5 mb-2.5">
                            <p className="text-text-secondary text-xs uppercase tracking-widest">{config.name}</p>
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
                            ) : (
                                <Cs2Hero account={account} accentColor={config.color} />
                            )
                        ) : (
                            <div
                                onClick={() => isOwnProfile && setShowModal(true)}
                                className={`bg-surface border border-dashed border-line rounded-2xl p-6 text-center ${isOwnProfile ? "cursor-pointer hover:border-accent/50 transition-colors" : ""}`}
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

            <Footer />

        </div>
    )
}
