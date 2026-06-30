"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"

const PRESETS = [
    { id: "default", name: "Default",  accent: "#b16cff" },
    { id: "gold",    name: "Gold",     accent: "#e8c468" },
    { id: "teal",    name: "Teal",     accent: "#5fd9c3" },
    { id: "rose",    name: "Rose",     accent: "#ff6b9d" },
]

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `${r},${g},${b}`
}

function accentFor(selected, customColor) {
    if (selected === "custom") return customColor
    return PRESETS.find(p => p.id === selected)?.accent ?? "#b16cff"
}

export default function ThemeModal({ currentTheme, onClose, onSaved }) {
    const isCurrentCustom = currentTheme?.startsWith("custom:")
    const [selected, setSelected] = useState(isCurrentCustom ? "custom" : (currentTheme ?? "default"))
    const [customColor, setCustomColor] = useState(isCurrentCustom ? currentTheme.slice(7) : "#ffffff")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const resolvedAccent = accentFor(selected, customColor)
    const rgb = hexToRgb(resolvedAccent.startsWith("#") && resolvedAccent.length === 7 ? resolvedAccent : "#b16cff")

    async function handleSave() {
        const themeValue = selected === "custom" ? `custom:${customColor}` : selected
        if (themeValue === currentTheme) { onClose(); return }

        setSaving(true)
        setError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token

        const res = await fetch("/api/profile/theme", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ theme: themeValue }),
        })

        if (!res.ok) {
            const { error: e } = await res.json().catch(() => ({}))
            setError(e || "Could not save theme.")
            setSaving(false)
            return
        }

        onSaved(themeValue)
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-line rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-4 border-b border-line">
                    <p className="text-text-primary font-bold text-lg">Choose theme</p>
                    <p className="text-text-secondary text-sm mt-1">Personalise your profile accent colour.</p>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3">
                    {PRESETS.map(theme => {
                        const isSelected = selected === theme.id
                        const tint = `rgba(${hexToRgb(theme.accent)},0.12)`
                        const border = `rgba(${hexToRgb(theme.accent)},0.28)`
                        return (
                            <button
                                key={theme.id}
                                onClick={() => setSelected(theme.id)}
                                className="rounded-xl border p-4 text-left transition-all active:scale-95"
                                style={{
                                    borderColor: isSelected ? theme.accent : "rgba(255,255,255,0.08)",
                                    backgroundColor: isSelected ? tint : "transparent",
                                }}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-black" style={{ backgroundColor: theme.accent }}>Y</div>
                                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: tint }} />
                                </div>
                                <div className="h-1 rounded-full mb-1.5" style={{ backgroundColor: theme.accent, width: "60%" }} />
                                <div className="h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", width: "80%" }} />
                                <p className="text-text-primary text-xs font-semibold mt-3">{theme.name}</p>
                            </button>
                        )
                    })}

                    {/* Custom color card */}
                    <button
                        onClick={() => setSelected("custom")}
                        className="rounded-xl border p-4 text-left transition-all active:scale-95"
                        style={{
                            borderColor: selected === "custom" ? resolvedAccent : "rgba(255,255,255,0.08)",
                            backgroundColor: selected === "custom" ? `rgba(${rgb},0.12)` : "transparent",
                        }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-black" style={{ backgroundColor: resolvedAccent }}>Y</div>
                            <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: `rgba(${rgb},0.12)` }} />
                        </div>
                        <div className="h-1 rounded-full mb-1.5" style={{ backgroundColor: resolvedAccent, width: "60%" }} />
                        <div className="h-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", width: "80%" }} />
                        <p className="text-text-primary text-xs font-semibold mt-3">Custom</p>
                    </button>
                </div>

                {/* Color picker — only visible when custom is selected */}
                {selected === "custom" && (
                    <div className="px-4 pb-4 flex items-center gap-3">
                        <input
                            type="color"
                            value={customColor}
                            onChange={e => setCustomColor(e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer border border-line bg-transparent"
                        />
                        <div>
                            <p className="text-text-primary text-sm font-semibold">{customColor.toUpperCase()}</p>
                            <p className="text-text-secondary text-xs">Click to pick any colour</p>
                        </div>
                    </div>
                )}

                {error && <p className="text-negative text-sm px-4 pb-2">{error}</p>}

                <div className="flex gap-2.5 p-4 pt-0">
                    <button
                        onClick={onClose}
                        className="flex-1 border border-line rounded-xl py-2.5 text-sm text-text-secondary active:bg-background active:scale-95 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-black active:scale-95 transition-all disabled:opacity-50"
                        style={{ backgroundColor: resolvedAccent }}
                    >
                        {saving ? "Saving..." : "Apply theme"}
                    </button>
                </div>
            </div>
        </div>
    )
}
