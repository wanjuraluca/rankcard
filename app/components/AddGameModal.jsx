"use client"
import { useState } from "react"
import { platformConfig } from "@/lib/platforms"
import { supabase } from "@/lib/supabase"

export default function AddGameModal({ onClose, onConnected }) {

    // Welches Spiel ist ausgewählt? (Key aus platformConfig, z.B. "League of Legends")
    const [selectedGame, setSelectedGame] = useState(null)
    const [username, setUsername] = useState("")
    const [tag, setTag] = useState("")
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")

    // Die Config des gewählten Spiels (oder null, wenn noch keins gewählt)
    const selectedConfig = selectedGame ? platformConfig[selectedGame] : null

    // Braucht das gewählte Spiel ein Tag-Feld? (riot/battlenet = ja, steam = nein)
    const needsTag = selectedConfig?.inputType === "riot" || selectedConfig?.inputType === "battlenet"

    async function handleConnect() {
        setErrorMsg("")
        setLoading(true)

        try {
            // 1. Eingeloggten User holen
            const { data: userData, error: userError } = await supabase.auth.getUser()
            if (userError || !userData?.user) {
                setErrorMsg("Du bist nicht eingeloggt.")
                setLoading(false)
                return
            }
            const userId = userData.user.id

            // 2. puuid Standard: null (fuer Steam o.ae. ohne Riot-Validierung)
            let puuid = null

            // 3. Bei Riot-Spielen: Account ueber die API validieren + puuid holen
            if (selectedConfig.inputType === "riot") {
                const res = await fetch(`/api/summoner?platform=${selectedGame}&name=${username}&tag=${tag}`)
                const data = await res.json()

                // Wenn kein puuid zurueckkommt, existiert der Account nicht
                if (!data.puuid) {
                    setErrorMsg("Account nicht gefunden. Pruefe Name und Tag.")
                    setLoading(false)
                    return
                }
                puuid = data.puuid
            }

            // 4. In die Datenbank schreiben
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

            // 5. Erfolg: neuen Account nach oben melden + Modal schliessen
            onConnected(inserted)
            onClose()

        } catch (err) {
            setErrorMsg("Etwas ist schiefgelaufen. Versuche es erneut.")
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50" onClick={onClose}>

            {/* Modal Box - stopPropagation, damit Klick INS Modal es nicht schliesst */}
            <div className="bg-surface border border-line rounded-2xl p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-text-primary text-lg font-medium">Spiel verbinden</p>
                        <p className="text-text-secondary text-sm mt-1">Waehle ein Spiel und gib deinen Account an.</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary text-xl leading-none">✕</button>
                </div>

                {/* Spiel-Auswahl */}
                <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Spiel</p>
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

                    {/* "bald" Platzhalter-Karte fuer zukuenftige Spiele */}
                    <div className="border border-dashed border-line rounded-lg py-3 flex flex-col items-center justify-center gap-1.5">
                        <span className="text-text-secondary text-lg leading-none">+</span>
                        <span className="text-text-secondary text-[10px]">bald</span>
                    </div>
                </div>

                {/* Account-Eingabe - nur sichtbar wenn ein Spiel gewaehlt ist */}
                {selectedGame && (
                    <>
                        <p className="text-text-secondary text-xs uppercase tracking-widest mb-2.5">Account</p>
                        <div className="flex gap-2.5 mb-2">
                            {/* Spielername - immer da */}
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Spielername"
                                className="flex-[2] bg-background border border-line rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent outline-none"
                            />
                            {/* Tag - nur bei riot/battlenet */}
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
                            {needsTag ? "z.B. DinDjarin#1007" : "z.B. dein Steam-Profilname"}
                        </p>
                    </>
                )}

                {/* Fehlermeldung */}
                {errorMsg && (
                    <p className="text-red-400 text-sm mb-4">{errorMsg}</p>
                )}

                {/* Buttons */}
                <div className="flex gap-2.5">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-line rounded-lg py-2.5 text-sm text-text-secondary"
                    >
                        Abbrechen
                    </button>
                    <button
                        onClick={handleConnect}
                        disabled={!selectedGame || !username || (needsTag && !tag) || loading}
                        className="flex-1 bg-accent rounded-lg py-2.5 text-sm text-white font-medium disabled:opacity-40"
                    >
                        {loading ? "Verbinde..." : "Verbinden"}
                    </button>
                </div>

            </div>
        </div>
    )
}
