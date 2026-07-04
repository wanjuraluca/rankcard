// Real rank badge images (user-provided, from the game's own wiki) — one
// per tier, division-agnostic (e.g. Gold I/II/III all use the same badge,
// same as the game's own UI which only varies the small division pips, not
// the badge art). No separate "One Above All" badge; per
// estimateMarvelRivalsRankFromScore, that tier is never distinguished from
// Eternity by score alone, so it reuses the Eternity badge.
const TIER_ICONS = {
    Bronze: "/Icons/mrRanks/bronze.webp",
    Silver: "/Icons/mrRanks/silver.webp",
    Gold: "/Icons/mrRanks/gold.webp",
    Platinum: "/Icons/mrRanks/platinum.webp",
    Diamond: "/Icons/mrRanks/diamond.webp",
    Grandmaster: "/Icons/mrRanks/grandmaster.webp",
    Celestial: "/Icons/mrRanks/celestial.webp",
    Eternity: "/Icons/mrRanks/eternity.webp",
    "One Above All": "/Icons/mrRanks/eternity.webp",
}

// `rank` is a label like "Gold II" or "Eternity" (see
// estimateMarvelRivalsRankFromScore / the account-level mrRank.rank).
export default function MarvelRankIcon({ rank, size = 24 }) {
    if (!rank) return <div style={{ width: size, height: size }} className="rounded-md bg-surface flex-shrink-0" />

    const [tierName] = rank.split(' ')
    const icon = TIER_ICONS[tierName] ?? TIER_ICONS[rank]
    if (!icon) return <div style={{ width: size, height: size }} className="rounded-md bg-surface flex-shrink-0" />

    return <img src={icon} alt={rank} style={{ width: size, height: size }} className="object-contain flex-shrink-0" />
}
