// Discord "Interactions" endpoint.
// Discord sends every slash command here as a signed POST request. We verify
// the signature (Discord requires it), answer its health-check PING, and reply
// to /rankcard with an embed that shows the user's shareable card image.

const SITE_URL = "https://rankcard.app"

// Discord interaction + response type numbers (from Discord's API docs).
const INTERACTION_PING = 1
const INTERACTION_COMMAND = 2
const RESPONSE_PONG = 1
const RESPONSE_MESSAGE = 4

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

// Discord signs "timestamp + body" with its Ed25519 key. We verify it with the
// app's public key so nobody can spoof requests to this endpoint.
async function isValidSignature(rawBody, signature, timestamp) {
    if (!signature || !timestamp) return false
    try {
        const key = await crypto.subtle.importKey(
            "raw",
            hexToBytes(process.env.DISCORD_PUBLIC_KEY),
            { name: "Ed25519" },
            false,
            ["verify"]
        )
        return await crypto.subtle.verify(
            "Ed25519",
            key,
            hexToBytes(signature),
            new TextEncoder().encode(timestamp + rawBody)
        )
    } catch {
        return false
    }
}

export async function POST(request) {
    const signature = request.headers.get("x-signature-ed25519")
    const timestamp = request.headers.get("x-signature-timestamp")
    const rawBody = await request.text()

    if (!(await isValidSignature(rawBody, signature, timestamp))) {
        return new Response("Invalid request signature", { status: 401 })
    }

    const interaction = JSON.parse(rawBody)

    // Health check Discord fires when you save the endpoint URL.
    if (interaction.type === INTERACTION_PING) {
        return Response.json({ type: RESPONSE_PONG })
    }

    if (interaction.type === INTERACTION_COMMAND && interaction.data.name === "rankcard") {
        const username = interaction.data.options?.find(o => o.name === "username")?.value

        return Response.json({
            type: RESPONSE_MESSAGE,
            data: {
                embeds: [{
                    title: `${username} on RankCard`,
                    url: `${SITE_URL}/${username}`,
                    image: { url: `${SITE_URL}/api/card?username=${encodeURIComponent(username)}` },
                    color: 0xb16cff,
                }],
            },
        })
    }

    return new Response("Unknown interaction", { status: 400 })
}
