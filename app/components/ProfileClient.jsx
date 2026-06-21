"use client"

import AvatarUpload from "./AvatarUpload"
import { useState } from "react"
import { platformConfig } from "@/lib/platforms"
import RankBadge from "./RankBadge"
import RankHero from "./RankHero"
import AddGameModal from "./AddGameModal"

export default function ProfileClient({ data, accounts }) {

    const [activeTab, setActiveTab] = useState("overall")
    const [showModal, setShowModal] = useState(false)
    const [accountList, setAccountList] = useState(accounts)

    return(
        <div className="bg-background min-h-screen p-3">

            {/* Banner */}
            <div className="h-[100px] rounded-t-xl border border-line border-b-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(177,108,255,0.4)_0%,transparent_60%)]" />

            {/* Profile Strip */}
            <div className="bg-surface border border-line rounded-b-xl p-4 flex gap-4 items-center">
                <div className="-mt-25">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
                </div>
                <div>
                    <p className="text-text-primary text-lg font-bold">{data.username}</p>
                    <p className="text-text-secondary">{data.bio}</p>
                    <div className="flex gap-2 flex-wrap mt-1">
                        <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-2 mt-2">
                <button onClick={() => setActiveTab("overall")} className={`border rounded-lg bg-surface px-4 py-2 text-sm ${activeTab === "overall" ? "border-accent bg-accent/10 text-accent" : "border-line text-text-secondary"}`}>Overall Performance</button>
                <button onClick={() => setActiveTab("league")} className={`border rounded-lg bg-surface px-4 py-2 text-sm ${activeTab === "league" ? "border-accent bg-accent/10 text-accent" : "border-line text-text-secondary"}`}>LoL</button>
                <button onClick={() => setActiveTab("valorant")} className={`border rounded-lg bg-surface px-4 py-2 text-sm ${activeTab === "valorant" ? "border-accent bg-accent/10 text-accent" : "border-line text-text-secondary"}`}>Valorant</button>
                <button onClick={() => setShowModal(true)} className="border rounded-lg bg-surface px-4 py-2 text-sm border-line text-text-secondary">+ Add Game</button>
            </div>

            {/* Overall Tab */}
            {activeTab === "overall" && (
                <div>
                    {/* Section Header */}
                    <div className="flex items-center gap-2 mt-4 mb-2">
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Overall Performance</p>
                        <div className="flex-1 h-px bg-line" />
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-accent text-xl font-bold">2000</p>
                            <p className="text-text-secondary text-xs">Rank Score</p>
                        </div>
                        <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-text-primary text-xl font-bold">55%</p>
                            <p className="text-text-secondary text-xs">Avg. Win Rate</p>
                        </div>
                        <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-text-primary text-xl font-bold">2.47</p>
                            <p className="text-text-secondary text-xs">Avg. KDA</p>
                        </div>
                        <div className="bg-surface border border-line rounded-xl p-3">
                            <p className="text-text-primary text-xl font-bold">{accountList.length}</p>
                            <p className="text-text-secondary text-xs">Games Connected</p>
                        </div>
                    </div>

                    {/* Connected Games Header */}
                    <div className="flex items-center gap-2 mt-4 mb-2">
                        <p className="text-text-secondary text-xs uppercase tracking-widest">Connected Games</p>
                        <div className="flex-1 h-px bg-line" />
                    </div>

                    {/* Connected Games Cards */}
                    <div className="grid grid-cols-3 gap-2">
                        {accountList.map((account) => (
                            <div key={account.id} className="bg-surface border border-line rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-accent/10">
                                        <svg role="img" viewBox="0 0 24 24" width="14" height="14" fill={platformConfig[account.platform]?.color}>
                                            <path d={platformConfig[account.platform]?.icon.path} />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-text-primary text-xs font-medium">{account.platform}</p>
                                        <p className="text-text-secondary text-[10px]">{account.platform_username}#{account.platform_tag}</p>
                                    </div>
                                </div>
                                <RankBadge account={account} />
                            </div>
                        ))}
                        {/* Add Game Card */}
                        <div onClick={() => setShowModal(true)} className="bg-surface border border-dashed border-line rounded-xl p-4 flex flex-col items-center justify-center gap-2 opacity-50 cursor-pointer hover:opacity-75">
                            <p className="text-text-secondary text-xl">+</p>
                            <p className="text-text-secondary text-xs">Add Game</p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "league" && (
            <>
                <div className="flex items-center gap-2 mt-4 mb-2">
                 <p className="text-text-secondary text-xs uppercase tracking-widest">League of Legends</p>
                <div className="flex-1 h-px bg-line" />
                </div>

                <RankHero account={accountList.find(a => a.platform === "League of Legends")} />
            </>
            )}

            {/* Valorant Tab */}
            {activeTab === "valorant" && <div className="mt-4 text-text-secondary">Valorant Inhalt</div>}

            {/* Add Game Modal */}
            {showModal && (
                <AddGameModal
                    onClose={() => setShowModal(false)}
                    onConnected={(newAccount) => setAccountList([...accountList, newAccount])}
                />
            )}

        </div>
    )
}
