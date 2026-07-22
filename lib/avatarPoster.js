import sharp from "sharp"

// Satori (the renderer behind next/og) can't decode animated GIFs, so a GIF
// avatar comes out blank in the shared link preview (og:image) and the card
// exports. This decodes the GIF's first frame server-side (via sharp, which
// ships with Next) into a small square PNG data URI that Satori *can* render.
//
//   - non-GIF  → the URL unchanged (Satori loads it directly)
//   - GIF      → a data:image/png first-frame poster, center-cropped square
//   - GIF that can't be fetched/decoded → null, so the caller falls back to
//     the placeholder ring instead of feeding Satori something it chokes on
//
// Runs on the Node runtime (sharp is a native module) — both callers already
// run there. Results are effectively cached by the og route's revalidate.
export async function resolveStaticAvatar(avatarUrl) {
    if (!avatarUrl) return null
    if (!/\.gif(\?|$)/i.test(avatarUrl)) return avatarUrl

    // Discord CDN animated avatars (a_… .gif, from Discord login for Nitro
    // users) serve a static first-frame from the exact same URL with a .png
    // extension — no fetch/decode needed, and it also blocks a server-side
    // fetch of the .gif (415), so handle it before the sharp path.
    if (/(^|\.)discordapp\.(com|net)\//i.test(avatarUrl)) {
        return avatarUrl.replace(/\.gif(\?|$)/i, ".png$1")
    }

    try {
        const res = await fetch(avatarUrl)
        if (!res.ok) return null
        const input = Buffer.from(await res.arrayBuffer())
        // No { animated: true } → sharp reads just the first frame.
        const png = await sharp(input)
            .resize(200, 200, { fit: "cover", position: "centre" })
            .png()
            .toBuffer()
        return `data:image/png;base64,${png.toString("base64")}`
    } catch {
        return null
    }
}

// Animated GIF avatars are a Pro perk (like Discord Nitro). A user who was Pro,
// uploaded a GIF, then downgraded keeps the GIF in the DB but it must stop
// animating for non-Pro — same "cosmetic reverts, data kept" rule the custom
// banner uses. This returns what to actually render: the animated GIF for Pro
// owners, a static first-frame for non-Pro owners, and the URL untouched for
// non-GIF avatars. Checked at render time, so it self-corrects on up/downgrade
// with no re-encoding or destructive rewrite of avatar_url.
export async function resolveDisplayAvatar(avatarUrl, isPro) {
    if (isPro || !avatarUrl || !/\.gif(\?|$)/i.test(avatarUrl)) return avatarUrl
    return (await resolveStaticAvatar(avatarUrl)) ?? avatarUrl
}
