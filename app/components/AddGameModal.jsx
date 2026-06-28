"use client"
import { useState } from "react"
import { platformConfig } from "@/lib/platforms"
import { supabase } from "@/lib/supabase"

export default function AddGameModal({ onClose, onConnected, existingAccounts = [] }) {

    // Which game is selected? (key from platformConfig, e.g. "League of Legends")
    const [selectedGame, setSelectedGame] = useState(null)
    const [username, setUsername] = useState("")
    const [tag, setTag] = useState("")
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")

    // Config of the selected game (or null if none selected yet)
    const selectedConfig = selectedGame ? platformConfig[selectedGame] : null

    // Does the selected game need a tag field? (riot/battlenet = yes, steam = no)
    const needsTag = selectedConfig?.inputType === "riot" || selectedConfig?.inputType === "battlenet"

    function isDuplicateAccount() {
        return existingAccounts.some((account) => {
            if (account.platform !== selectedGame) return false
            const sameUsername = account.platform_username.toLowerCase() === username.toLowerCase()
            if (!needsTag) return sameUsername
            return sameUsername && (account.platform_tag ?? "").toLowerCase() === tag.toLowerCase()
        })
    }

    async function handleConnect() {
        setErrorMsg("")

        // 0. Block accounts that are already connected
        if (isDuplicateAccount()) {
            setErrorMsg("This account is already connected.")
            return
        }

        setLoading(true)

        try {
            // 1. Get the logged-in user
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData?.user) {
                setErrorMsg("You are not logged in.")
                setLoading(false)
                return
            }
            const userId = userData.user.id

            // 2. puuid default: null (for Steam etc. without Riot validation)
            let puuid = null

            // 3. For Riot games: validate the account via the API + get puuid
            if (selectedConfig.inputType === "riot") {
                const res = await fetch(`/api/summoner?platform=${selectedGame}&name=${username}&tag=${tag}`)
                const data = await res.json()

                // If no puuid comes back, the account doesn't exist
                if (!data.puuid) {
                    setErrorMsg("Account not found. Check the name and tag.")
                    setLoading(false)
                    return
                }
                puuid = data.puuid
            }

            // 3b. For Steam games: validate the account + resolve the SteamID64
            // (vanity names like "winter" aren't usable directly by Leetify/Steam's API)
            if (selectedConfig.inputType === "steam") {
                const res = await fetch(`/api/summoner?platform=${selectedGame}&name=${username}`)
                const data = await res.json()

                if (!data.steam64Id) {
                    setErrorMsg("Steam account not found. Check your profile name or SteamID64.")
                    setLoading(false)
                    return
                }
                puuid = data.steam64Id
            }

            // 4. Write to the database
            const { data: inserted, error: insertError } = await supabase
                .from("connected_accounts")
                .insert({
                    user_id: userId,
                    platform: selectedGame,
                    platform_username: username,
                    platform_tag: needsTag ? tag : null,
                    puuid: puuid
                })
                .select()
                .single()

            if (insertError) {
                setErrorMsg(insertError.message)
                setLoading(false)
                return
            }

            // 5. Success: report the new account upward + close the modal
            onConnected(inserted)
            onClose()

        } catch (err) {
            setErrorMsg("Something went wrong. Please try again.")
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50" onClick={onClose}>

            {/* Modal box - stopPropagation so clicking INSIDE the modal doesn't close it */}
            <div className="bg-surface border border-line rounded-2xl p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-text-primary text-lg font-medium">Connect a game</p>
                        <p className="text-text-secondary text-sm mt-1">Pick a game and enter your account.</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary text-xl leading-none">✕</button>
                </div>

                {/* Game selection */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Game</p>
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {Object.keys(platformConfig).map((key) => {
                        const config = platformConfig[key]
                        const isSelected = selectedGame === key
                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedGame(key)}
                                className={`border rounded-lg py-3 flex flex-col items-center gap-1.5 ${isSelected ? "border-accent bg-accent/10" : "border-line bg-background"}`}
                            >
                                <svg role="img" viewBox="0 0 24 24" width="22" height="22" fill={isSelected ? config.color : "#9a96a8"}>
                                    <path d={config.icon.path} />
                                </svg>
                                <span className={`text-[10px] ${isSelected ? "text-text-primary" : "text-text-secondary"}`}>{config.shortName}</span>
                            </button>
                        )
                    })}

                    {/* "Coming soon" placeholder card for future games */}
                    <div className="border border-dashed border-line rounded-lg py-3 flex flex-col items-center justify-center gap-1.5">
                        <span className="text-text-secondary text-lg leading-none">+</span>
                        <span className="text-text-secondary text-[10px]">soon</span>
                    </div>
                </div>

                {/* Account input - only visible once a game is selected */}
                {selectedGame && (
                    <>
                        <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Account</p>
                        <div className="flex gap-2.5 mb-2">
                            {/* Username - always shown */}
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Username"
                                className="flex-[2] bg-background border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none"
                            />
                            {/* Tag - only for riot/battlenet */}
                            {needsTag && (
                                <input
                                    type="text"
                                    value={tag}
                                    onChange={(e) => setTag(e.target.value)}
                                    placeholder="# Tag"
                                    className="flex-1 bg-background border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none"
                                />
                            )}
                        </div>
                        <p className="text-text-secondary text-xs mb-6">
                            {needsTag ? "e.g. DinDjarin#1007" : "e.g. your Steam profile name"}
                        </p>
                    </>
                )}

                {/* Error message */}
                {errorMsg && (
                    <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                )}

                {/* Buttons */}
                <div className="flex gap-2.5">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-line rounded-lg py-2.5 text-sm text-text-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!selectedGame || !username || (needsTag && !tag) || loading}
                        className="flex-1 bg-accent rounded-lg py-2.5 text-sm text-white font-medium disabled:opacity-40"
                    >
                        {loading ? "Connecting..." : "Connect"}
                    </button>
                </div>

            </div>
        </div>
    )
}
