function Block({ className = "" }) {
    return <div className={`animate-pulse bg-surface-hover rounded-lg ${className}`} />
}

// Reserves the same shape as RankHero/ValorantHero/TftHero/Cs2Hero once loaded
// (emblem + LP bar, 4 stat tiles, 2 panels, match rows) so nothing shifts
// layout when the real data arrives.
export function HeroSkeleton({ accentColor = "#b16cff" }) {
    return (
        <div
            className="bg-surface border border-hairline rounded-2xl p-4 sm:p-5 relative overflow-hidden"
            style={{ borderTopWidth: 3, borderTopColor: `${accentColor}55` }}
        >
            <div className="flex gap-3 sm:gap-5 items-center flex-wrap">
                <Block className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 !rounded-lg" />
                <div className="flex-1 min-w-[180px] flex flex-col gap-2.5">
                    <Block className="h-7 w-40" />
                    <Block className="h-4 w-28" />
                    <Block className="h-2 w-full mt-1 !rounded-full" />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Block key={i} className="h-[60px]" />
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                <Block className="h-[168px]" />
                <Block className="h-[168px]" />
            </div>

            <div className="mt-5 flex flex-col gap-1.5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Block key={i} className="h-[52px]" />
                ))}
            </div>
        </div>
    )
}

// Reserves the same inline shape RankBadge renders into (used inside the
// "Connected Games" cards on the profile) — emblem + two text lines + right-aligned stat.
export function RankBadgeSkeleton() {
    return (
        <div className="flex items-center gap-3">
            <Block className="w-[46px] h-[46px] flex-shrink-0" />
            <div className="flex flex-col gap-1.5">
                <Block className="h-4 w-24" />
                <Block className="h-3 w-16" />
            </div>
        </div>
    )
}
