"use client"
<link rel="icon" href="/Icons/Logo.png" />

import AvatarUpload from "./AvatarUpload"
import { useState, useRef } from "react"

export default function ProfileClient({ data, accounts }) {

    const [activeTab, setActiveTab] = useState("overall")

    return(
        <div className="bg-background min-h-screen p-3">
            <div className="h-[100px] rounded-t-xl border border-line border-b-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(177,108,255,0.4)_0%,transparent_60%)]">
            </div>

            <div className="bg-surface border border-line rounded-b-xl p-4 flex gap-4 items-center">
                <div className="-mt-15">
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
            <div className="flex gap-2 mt-2 text-lg">
                    <button onClick={() => setActiveTab("overall")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "overall" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>Overall Performance</button>
                    <button onClick={() => setActiveTab("league")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "league" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>LoL</button>
                    <button onClick={() => setActiveTab("valorant")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "valorant" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>Valorant</button>
                    <button onClick={() => setActiveTab("addGame")} className={`border rounded-lg bg-surface border-xl px-4 py-2 ${activeTab === "addGame" ? "border-accent bg-accent/10 text-accent" : "border-line"}`}>+ Add Game</button>
                </div>
        </div>
    )
}