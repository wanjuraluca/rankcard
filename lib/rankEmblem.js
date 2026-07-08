import { getOverwatchScore } from "@/lib/rankScore"

// Mirrors RankBadge.jsx's PREMIER_BANDS colors — kept duplicated rather than
// shared since it's just a display color, not scoring logic (see rankScore.js).
const PREMIER_BAND_COLORS = [
    { min: 30000, color: "#facc15" },
    { min: 25000, color: "#f87171" },
    { min: 20000, color: "#f472b6" },
    { min: 15000, color: "#c084fc" },
    { min: 10000, color: "#60a5fa" },
    { min: 5000, color: "#7dd3fc" },
    { min: 0, color: "#9a96a8" },
]

const riotEmblem = (tier) => `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${tier.toLowerCase()}.png`

// Riot's real "Unranked" crest (owl-wing shield + gem) — lives directly under
// .../images/, not in the ranked-emblem/ folder with the tier emblems, and on
// a much tighter square canvas (676x676, glyph fills most of the frame) than
// the tier emblems (1280x720, glyph is a small centered fraction) — so unlike
// those, this one must NOT get the scale-450 treatment, or it crops the wings
// off. Shared by League and TFT, which both use Riot's ranked-emblem system.
const RIOT_UNRANKED_EMBLEM = "https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/unranked-emblem.png"

// Resolves the real, game-provided rank icon for a platform from the same
// cached apiData shape lib/gameStats.js reads (account_cache.data) — used
// anywhere a live rank badge needs the actual art rather than a generic game
// logo, so RankBadge, the signature card, and the shareable link preview all
// show the same icon. Returns:
//   { type: "image", url, scale? } — a real icon (scale: true for Riot's
//     ranked-emblem PNGs, which render tiny unless scaled up + cropped, same
//     treatment RankBadge/RankHero/TftHero already apply)
//   { type: "badge", color, label } — CS2 has no rank-icon API, so this is a
//     colored ring with the premier rating instead (matches RankBadge)
//   { type: "unranked" } — connected, but no rank yet, and no real icon asset
//     exists for this platform (Valorant/Overwatch/Marvel Rivals/CS2) — a
//     generic muted dash glyph is rendered wherever emblems show up, instead
//     of leaving the slot empty.
export function getGameEmblem(platform, apiData) {
    if (platform === "League of Legends") {
        const entry = Array.isArray(apiData.rankData) ? apiData.rankData.find(q => q.queueType === "RANKED_SOLO_5x5") : null
        if (!entry) return { type: "image", url: RIOT_UNRANKED_EMBLEM }
        return { type: "image", url: riotEmblem(entry.tier), scale: true }
    }

    if (platform === "TFT") {
        const entry = Array.isArray(apiData.tftData) ? apiData.tftData.find(q => q.queueType === "RANKED_TFT") : null
        if (!entry) return { type: "image", url: RIOT_UNRANKED_EMBLEM }
        return { type: "image", url: riotEmblem(entry.tier), scale: true }
    }

    if (platform === "Valorant") {
        const mmrHistory = apiData.valorantMmrHistory ?? []
        const image = mmrHistory[mmrHistory.length - 1]?.image
        return image ? { type: "image", url: image } : { type: "unranked" }
    }

    if (platform === "Overwatch") {
        const best = getOverwatchScore(apiData.owRanks)
        if (!best) return { type: "unranked" }
        const rankIcon = apiData.owRanks?.[best.role]?.rankIcon
        return rankIcon ? { type: "image", url: rankIcon } : { type: "unranked" }
    }

    if (platform === "Marvel Rivals") {
        const image = apiData.mrRank?.image
        return image ? { type: "image", url: `https://marvelrivalsapi.com/rivals${image}` } : { type: "unranked" }
    }

    if (platform === "CSGO") {
        const premierRating = apiData.cs2Profile?.ranks?.premier
        if (premierRating == null) return { type: "unranked" }
        const band = PREMIER_BAND_COLORS.find(b => premierRating >= b.min) ?? PREMIER_BAND_COLORS[PREMIER_BAND_COLORS.length - 1]
        return { type: "badge", color: band.color, label: `${Math.round(premierRating / 1000)}k` }
    }

    return { type: "unranked" }
}
