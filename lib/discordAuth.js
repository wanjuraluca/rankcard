import { createHmac, timingSafeEqual } from "crypto"

// The Discord OAuth callback arrives as a plain browser redirect straight from
// Discord's servers — it can't carry our Authorization header. So we tie the
// callback back to the RankCard user by signing their id into the OAuth `state`
// parameter (HMAC) and verifying it on the way back. Keeps the flow stateless
// (no DB nonce round-trip) while still tamper-proof and CSRF-safe.

const STATE_TTL_MS = 10 * 60 * 1000 // a connect attempt must finish within 10 min

function sign(payload) {
    return createHmac("sha256", process.env.DISCORD_CLIENT_SECRET).update(payload).digest("hex")
}

export function signState(userId) {
    const payload = `${userId}.${Date.now() + STATE_TTL_MS}`
    const state = `${payload}.${sign(payload)}`
    return Buffer.from(state).toString("base64url")
}

// Returns the RankCard user id if the state is authentic and unexpired, else null.
export function verifyState(state) {
    try {
        const decoded = Buffer.from(state, "base64url").toString()
        const lastDot = decoded.lastIndexOf(".")
        const payload = decoded.slice(0, lastDot)
        const signature = decoded.slice(lastDot + 1)

        const sigBuf = Buffer.from(signature)
        const expBuf = Buffer.from(sign(payload))
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

        const [userId, expiresAt] = payload.split(".")
        if (Date.now() > Number(expiresAt)) return null
        return userId
    } catch {
        return null
    }
}
