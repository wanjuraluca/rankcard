"use client"

import AvatarUpload from "./AvatarUpload"
import BioEditor from "./BioEditor"
import { useState } from "react"
import { platformConfig } from "@/lib/platforms"
import RankBadge from "./RankBadge"
import RankHero from "./RankHero"
import AddGameModal from "./AddGameModal"

const gameTabs = [
    { key: "league", platform: "League of Legends" },
    { key: "valorant", platform: "Valorant" },
    { key: "cs2", platform: "CSGO" },
]

export default function ProfileClient({ data, accounts }) {

    const [activeTab, setActiveTab] = useState("overall")
    const [showModal, setShowModal] = useState(false)
    const [accountList, setAccountList] = useState(accounts)

    const activeGameTab = gameTabs.find(tab => tab.key === activeTab)

    return (
        <div className="bg-background min-h-screen p-3 max-w-[1000px] mx-auto">

            {/* Banner */}
            <div className="h-[140px] rounded-t-2xl border border-line border-b-0 bg-[radial-gradient(ellipse_55%_130%_at_20%_60%,rgba(177,108,255,0.45),transparent_60%)]" />

            {/* Profile Strip */}
            <div className="bg-surface border border-line rounded-b-2xl p-4 flex gap-4 items-center flex-wrap">
                <div className="-mt-16">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-text-primary text-2xl font-extrabold">{data.username}</p>
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent-tint text-accent-soft border border-accent/40">PRO</span>
                    </div>
                    <BioEditor username={data.username} bio={data.bio} />
                </div>
                <button className="border border-accent/40 rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-accent-tint transition-colors">
                    Share profile ↗
                </button>
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
                <button
                    onClick={() => setShowModal(true)}
                    className="border border-dashed border-accent/45 rounded-lg px-4 py-2 text-sm font-semibold text-accent-soft"
                >
                    + Add Game
                </button>
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
                            <p className="text-accent text-2xl font-extrabold">2,000</p>
                            <p className="text-text-secondary text-xs">Rank Score</p>
                        </div>
                        <div className="bg-surface border border-hairline rounded-2xl p-4">
                            <p className="text-text-primary text-2xl font-extrabold">55%</p>
                            <p className="text-text-secondary text-xs">Avg Win Rate</p>
                        </div>
                        <div className="bg-surface border border-hairline rounded-2xl p-4">
                            <p className="text-text-primary text-2xl font-extrabold">2.47</p>
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
                                    className="bg-surface border border-hairline rounded-2xl p-4 cursor-pointer hover:border-accent/40 transition-colors"
                                    style={{ borderTopWidth: 3, borderTopColor: config?.color }}
                                >
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
                        <div onClick={() => setShowModal(true)} className="bg-surface border border-dashed border-accent/35 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-accent/60 transition-colors min-h-[110px]">
                            <p className="text-accent-soft text-xl">＋</p>
                            <p className="text-accent-soft text-xs">Add Game</p>
                        </div>
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
                        </div>

                        {account ? (
                            activeGameTab.platform === "League of Legends" ? (
                                <RankHero account={account} accentColor={config.color} />
                            ) : (
                                <div className="bg-surface border border-hairline rounded-2xl p-6 text-center">
                                    <p className="text-text-secondary text-sm">Live rank data for {config.name} is coming soon.</p>
                                </div>
                            )
                        ) : (
                            <div
                                onClick={() => setShowModal(true)}
                                className="bg-surface border border-dashed border-line rounded-2xl p-6 text-center cursor-pointer hover:border-accent/50 transition-colors"
                            >
                                <p className="text-text-secondary text-sm">No {config.name} account connected yet.</p>
                                <p className="text-accent-soft text-sm mt-1">+ Add Game</p>
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

        </div>
    )
}
