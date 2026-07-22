// Satori (the renderer behind next/og) can't decode animated GIFs, so a GIF
// avatar comes out blank in the shared link preview (og:image) and the card
// exports. When a GIF avatar is uploaded we also store a static first-frame
// "poster" JPEG next to it, at the same storage path with a .jpg extension
// (see AvatarUpload.jsx). This resolves the URL a Satori renderer should
// actually load:
//   - non-GIF  → the URL unchanged
//   - GIF with a poster → the poster (verified to exist via a HEAD request)
//   - GIF without a poster (uploaded before this feature) → null, so the
//     caller falls back to the placeholder ring instead of feeding Satori a
//     GIF it can't decode (which blanks the avatar, or worse the whole image).
export async function resolveStaticAvatar(avatarUrl) {
    if (!avatarUrl) return null
    if (!/\.gif(\?|$)/i.test(avatarUrl)) return avatarUrl

    const poster = avatarUrl.replace(/\.gif(\?|$)/i, ".jpg$1")
    try {
        const res = await fetch(poster, { method: "HEAD" })
        if (res.ok) return poster
    } catch {}
    return null
}
