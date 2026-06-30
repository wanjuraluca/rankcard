"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"

const lookingForOptions = ["Duo Queue", "Flex", "Clash", "Chill", "Smurf welcome"]
const regionOptions = ["EUW", "EUNE", "NA", "KR", "LAN"]

// Role options are game-specific — League has lane roles, Valorant has agent
// classes, TFT/CS2 have no role concept and skip this section entirely.
const roleOptionsByGame = {
    "League of Legends": ["Top", "Jungle", "Mid", "ADC", "Support", "Fill"],
    Valorant: ["Duelist", "Initiator", "Controller", "Sentinel", "Flex"],
}

// Games connected on this profile that LFG posting supports
const lfgGames = ["League of Legends", "TFT", "Valorant", "CSGO"]

export default function LfgPostModal({ onClose, accounts = [], discordTag, isPro, existingPost, onPosted, onRemoved }) {
    const [game, setGame] = useState(existingPost?.game ?? null)
    const [lookingFor, setLookingFor] = useState(existingPost?.looking_for ?? [])
    const [roles, setRoles] = useState(existingPost?.roles ?? [])
    const [region, setRegion] = useState(existingPost?.region ?? null)
    const [message, setMessage] = useState(existingPost?.message ?? "")
    const [loading, setLoading] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")

    const connectedGames = accounts.map(a => a.platform).filter(p => lfgGames.includes(p))
    const roleOptions = roleOptionsByGame[game] ?? null
    const showRoles = roleOptions != null

    function toggle(list, setList, value) {
        setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
    }

    async function handleSubmit(e) {
        e?.preventDefault()
        setErrorMsg("")

        if (!game || !region || lookingFor.length === 0) {
            setErrorMsg("Please fill in game, region, and what you're looking for.")
            return
        }
        if (!discordTag) {
            setErrorMsg("Add a Discord tag on your profile first.")
            return
        }

        setLoading(true)
        try {
            const { data: userData } = await supabase.auth.getUser()
            if (!userData?.user) {
                setErrorMsg("You are not logged in.")
                setLoading(false)
                return
            }

            const durationHours = isPro ? 72 : 24
            const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()

            const { data: upserted, error } = await supabase
                .from("lfg_posts")
                .upsert(
                    {
                        user_id: userData.user.id,
                        game,
                        looking_for: lookingFor,
                        roles: showRoles ? roles : [],
                        region,
                        message: message.trim() || null,
                        is_boosted: isPro,
                        expires_at: expiresAt,
                    },
                    { onConflict: "user_id" }
                )
                .select()
                .single()

            if (error) {
                setErrorMsg(error.message)
                setLoading(false)
                return
            }

            onPosted(upserted)
            onClose()
        } catch {
            setErrorMsg("Something went wrong. Please try again.")
            setLoading(false)
        }
    }

    async function handleRemove() {
        setRemoving(true)
        const { error } = await supabase.from("lfg_posts").delete().eq("id", existingPost.id)
        setRemoving(false)
        if (error) {
            setErrorMsg(error.message)
            return
        }
        onRemoved()
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <form className="bg-surface border border-line rounded-2xl p-5 sm:p-7 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>

                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-text-primary text-lg font-medium">{existingPost ? "Edit your LFG post" : "Post on Find a Duo"}</p>
                        <p className="text-text-secondary text-sm mt-1">Visible to everyone for {isPro ? "72h" : "24h"}.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary active:text-text-primary active:scale-90 transition-transform text-xl leading-none">✕</button>
                </div>

                {/* Game */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Game</p>
                {connectedGames.length === 0 ? (
                    <p className="text-text-secondary text-sm mb-6">Connect a game on your profile first.</p>
                ) : (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {connectedGames.map((key) => {
                            const config = platformConfig[key]
                            const isSelected = game === key
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => { setGame(key); setRoles([]) }}
                                    className={`border rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-background text-text-secondary"}`}
                                >
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: config?.color }} />
                                    {config?.shortName ?? key}
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Looking for */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">What are you looking for</p>
                <div className="flex flex-wrap gap-2 mb-6">
                    {lookingForOptions.map((option) => {
                        const isSelected = lookingFor.includes(option)
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => toggle(lookingFor, setLookingFor, option)}
                                className={`border rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-background text-text-secondary"}`}
                            >
                                {option}
                            </button>
                        )
                    })}
                </div>

                {/* Roles — only for League/TFT */}
                {showRoles && (
                    <>
                        <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Your role</p>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {roleOptions.map((option) => {
                                const isSelected = roles.includes(option)
                                return (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => toggle(roles, setRoles, option)}
                                        className={`border rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-background text-text-secondary"}`}
                                    >
                                        {option}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Region */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Region</p>
                <div className="flex flex-wrap gap-2 mb-6">
                    {regionOptions.map((option) => {
                        const isSelected = region === option
                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setRegion(option)}
                                className={`border rounded-lg px-3 py-2 text-xs font-semibold active:scale-95 transition-all ${isSelected ? "border-accent bg-accent-tint text-text-primary" : "border-line bg-background text-text-secondary"}`}
                            >
                                {option}
                            </button>
                        )
                    })}
                </div>

                {/* Discord tag */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Discord tag</p>
                {discordTag ? (
                    <p className="text-[#7289da] text-sm font-mono mb-6">{discordTag}</p>
                ) : (
                    <p className="text-negative text-xs mb-6">Add a Discord tag on your profile first — it&apos;s how people will reach you.</p>
                )}

                {/* Message */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Message (optional)</p>
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 100))}
                    placeholder="lf serious duo, plat-diamond, any role"
                    maxLength={100}
                    className="w-full bg-background border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none mb-6"
                />

                {errorMsg && (
                    <p className="text-negative text-sm mb-4">{errorMsg}</p>
                )}

                <div className="flex gap-2.5">
                    {existingPost && (
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={removing || loading}
                            className="border border-negative/40 text-negative rounded-lg px-4 py-2.5 text-sm font-medium active:scale-95 transition-all disabled:opacity-50"
                        >
                            {removing ? "Removing..." : "Remove post"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 border border-line rounded-lg py-2.5 text-sm text-text-secondary active:bg-background active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!game || !region || lookingFor.length === 0 || !discordTag || loading || removing}
                        className="flex-1 bg-accent rounded-lg py-2.5 text-sm text-white font-medium disabled:opacity-40 active:scale-95 transition-transform"
                    >
                        {loading ? "Posting..." : existingPost ? "Update post" : "Post"}
                    </button>
                </div>
            </form>
        </div>
    )
}
