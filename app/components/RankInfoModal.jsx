"use client"

import { RANK_TIERS, getRankTier, MAX_SCORE } from "@/lib/rankScore"

export default function RankInfoModal({ score, onClose }) {
    const info = score != null ? getRankTier(score) : null
    const displayScore = score != null ? Math.round(score) : null

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-surface border border-hairline rounded-2xl w-full max-w-md overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 pb-4 border-b border-hairline">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Your RankCard Tier</p>
                            {info ? (
                                <>
                                    <p className="text-3xl font-extrabold" style={{ color: info.tier.color }}>
                                        {info.tier.name}
                                    </p>
                                    <p className="text-text-secondary text-sm mt-1">
                                        Top <span className="text-text-primary font-semibold">{info.topPercent.toFixed(1)}%</span> of all players
                                    </p>
                                </>
                            ) : (
                                <p className="text-text-secondary text-sm mt-1">Connect games to get your tier</p>
                            )}
                        </div>
                        {displayScore != null && (
                            <div className="text-right flex-shrink-0">
                                <p className="text-accent text-3xl font-extrabold">{displayScore.toLocaleString()}</p>
                                <p className="text-text-secondary text-xs">/ {MAX_SCORE.toLocaleString()}</p>
                            </div>
                        )}
                    </div>

                    {/* Progress bar within current tier */}
                    {info && info.next && (
                        <div className="mt-4">
                            <div className="flex justify-between text-[11px] text-text-secondary mb-1.5">
                                <span>{info.tier.name}</span>
                                <span>{info.next.name}</span>
                            </div>
                            <div className="h-2 rounded-full bg-background overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${Math.round(info.progress * 100)}%`, backgroundColor: info.tier.color }}
                                />
                            </div>
                            <p className="text-text-secondary text-[11px] mt-1.5">
                                {Math.round(info.next.min - score)} points to {info.next.name}
                            </p>
                        </div>
                    )}
                    {info && !info.next && (
                        <div className="mt-4">
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${info.tier.color}30` }}>
                                <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: info.tier.color }} />
                            </div>
                            <p className="text-[11px] mt-1.5" style={{ color: info.tier.color }}>Maximum tier reached</p>
                        </div>
                    )}
                </div>

                {/* Tier Ladder */}
                <div className="p-4">
                    <p className="text-text-muted text-xs uppercase tracking-widest mb-3">Tier Ladder</p>
                    <div className="space-y-1.5">
                        {[...RANK_TIERS].reverse().map((tier, i) => {
                            const isCurrent = info?.tier.name === tier.name
                            const isReached = score != null && score >= tier.min
                            return (
                                <div
                                    key={tier.name}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${isCurrent ? "border" : ""}`}
                                    style={isCurrent ? { backgroundColor: `${tier.color}15`, borderColor: `${tier.color}60` } : {}}
                                >
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: isReached ? tier.color : "#ffffff20" }}
                                    />
                                    <span
                                        className={`text-sm font-semibold flex-1 ${isCurrent ? "" : isReached ? "text-text-primary" : "text-text-secondary"}`}
                                        style={isCurrent ? { color: tier.color } : {}}
                                    >
                                        {tier.name}
                                        {isCurrent && <span className="ml-2 text-[11px] font-normal opacity-70">← you are here</span>}
                                    </span>
                                    <span className="text-text-secondary text-[11px] font-mono">{tier.min.toLocaleString()}+</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer explanation */}
                <div className="px-4 pb-5">
                    <p className="text-text-secondary text-[11px] leading-relaxed border-t border-hairline pt-4">
                        Your <span className="text-text-primary">Rank Score</span> is a cross-game percentile: each connected game's rank is converted into "top X% of players worldwide", then mapped to a 0–{MAX_SCORE.toLocaleString()} scale. The overall score is the average across all your games, so a Challenger in League and a Radiant in Valorant land near each other, even though the tier names are different.
                    </p>
                </div>

                <div className="px-4 pb-4">
                    <button
                        onClick={onClose}
                        className="w-full border border-hairline rounded-lg py-2.5 text-sm text-text-secondary hover:text-text-primary hover:border-accent/30 active:scale-[0.98] transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
