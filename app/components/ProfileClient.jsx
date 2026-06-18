"use client"

import AvatarUpload from "./AvatarUpload"
import { useState, useRef } from "react"

export default function ProfileClient({ data, accounts }) {

    const [activeTab, setActiveTab] = useState("overall")

    return(
        <div className="bg-background min-h-screen p-3">
            <div className="h-[100px] rounded-t-xl border border-line border-b-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(177,108,255,0.4)_0%,transparent_60%)]">
            </div>

            <div className="bg-surface border border-line rounded-b-xl p-4 flex gap-4 items-center">
                <div className="-mt-25">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
                </div>
                <div>
                <p className="text-text-primary text-lg font-bold">{data.username}</p>
                <p className="text-text-secondary">{data.bio}</p>
                <div className="flex gap-2 flex-wrap"> {/* Tags für Später m erken */}
                    <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                </div>
                </div>
            </div>
            <div className="flex gap-2 mt-2">
                    <button onClick={() => setActiveTab("overall")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "overall" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>Overall Performance</button>
                    <button onClick={() => setActiveTab("league")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "league" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>LoL</button>
                    <button onClick={() => setActiveTab("valorant")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "valorant" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>Valorant</button>
                    <button onClick={() => setActiveTab("addGame")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "addGame" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>+ Add Game</button>
                </div>
                {activeTab === "overall" && (
                    <div>
                    <div className="flex items-center gap-2 mt-4 mb-2">
                            <p className="text-text-secondary text-xs uppercase tracking-widest">Overall Performance</p>
                            <div className="flex-1 h-px bg-line"></div>
                        </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
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
                            <p className="text-text-primary text-xl font-bold">{accounts.length}</p>
                            <p className="text-text-secondary text-xs">Games Connected</p>
                        </div>
                        <div className="flex items-center gap-2 mt-4 mb-">
                            <p className="text-text-secondary text-xs uppercase tracking-widest">connected games</p>
                            <div className="flex-1 h-px bg-line"></div>
                            </div>
                        </div>
                        </div>
                    )}
                {activeTab === "league" && <div> LoL Inhalt</div>}
                {activeTab === "valorant" && <div> Valorant Inhalt</div>}
                {activeTab === "addGame" && <div> Add Game</div>}
                
        </div>
    )
}