"use client"

import { Check } from "lucide-react"

export default function EmbedBadgeModal({ username, badgeCopiedType, onCopy, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-hairline rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <p className="text-text-primary font-bold mb-1">Embed badge</p>
                <p className="text-text-muted text-xs mb-3">Always shows your current rank.</p>
                <img
                    src={`/api/badge?username=${username}`}
                    alt={`${username}'s RankCard badge`}
                    className="rounded-lg border border-hairline max-w-full"
                    style={{ width: 300, height: 70 }}
                />
                <div className="flex flex-wrap gap-2 mt-3">
                    <button
                        onClick={() => onCopy("url")}
                        className="border border-accent/40 rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-accent-tint active:bg-accent-tint active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        {badgeCopiedType === "url" ? <><Check size={14} /> Copied</> : "Copy image URL (Discord / Slack)"}
                    </button>
                    <button
                        onClick={() => onCopy("markdown")}
                        className="border border-hairline rounded-lg px-4 py-2 text-sm text-text-primary hover:bg-surface-hover active:bg-surface-hover active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        {badgeCopiedType === "markdown" ? <><Check size={14} /> Copied</> : "Copy Markdown (GitHub)"}
                    </button>
                </div>
                <p className="text-text-muted text-[11px] mt-2">
                    Discord/Slack: paste the image URL alone in a message — it auto-embeds. GitHub: use the Markdown snippet in your README.
                </p>
                <button
                    onClick={onClose}
                    className="w-full border border-hairline rounded-lg py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/30 active:scale-[0.98] transition-all mt-4"
                >
                    Close
                </button>
            </div>
        </div>
    )
}
