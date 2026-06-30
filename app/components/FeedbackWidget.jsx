"use client"

import { useState, useRef, useEffect } from "react"
import { MessageSquare, X, Bug, Lightbulb } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function FeedbackWidget() {
    const [open, setOpen] = useState(false)
    const [type, setType] = useState("feedback")
    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState("")
    const textareaRef = useRef(null)

    useEffect(() => {
        if (open && textareaRef.current) textareaRef.current.focus()
    }, [open])

    function handleOpen() {
        setSent(false)
        setError("")
        setMessage("")
        setType("feedback")
        setOpen(true)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!message.trim()) return
        setSending(true)
        setError("")

        const { data: sessionData } = await supabase.auth.getSession()
        const username = sessionData?.session?.user?.user_metadata?.username ?? null

        const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, message, username }),
        })

        if (!res.ok) {
            const { error: e } = await res.json().catch(() => ({}))
            setError(e || "Something went wrong. Try again.")
            setSending(false)
            return
        }

        setSent(true)
        setSending(false)
        setTimeout(() => setOpen(false), 2000)
    }

    return (
        <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
            {/* Popover */}
            {open && (
                <div className="bg-surface border border-line rounded-2xl shadow-2xl w-80 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                        <p className="text-text-primary text-sm font-semibold">Send feedback</p>
                        <button onClick={() => setOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    {sent ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-2xl mb-2">🙏</p>
                            <p className="text-text-primary text-sm font-semibold">Thanks for the feedback!</p>
                            <p className="text-text-secondary text-xs mt-1">We read every single one.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
                            {/* Type toggle */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setType("feedback")}
                                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-all ${
                                        type === "feedback"
                                            ? "border-accent/50 bg-accent-tint text-text-primary"
                                            : "border-hairline text-text-secondary hover:text-text-primary"
                                    }`}
                                >
                                    <Lightbulb size={13} />
                                    Feedback
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType("bug")}
                                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold border transition-all ${
                                        type === "bug"
                                            ? "border-negative/50 bg-negative/10 text-text-primary"
                                            : "border-hairline text-text-secondary hover:text-text-primary"
                                    }`}
                                >
                                    <Bug size={13} />
                                    Bug report
                                </button>
                            </div>

                            <textarea
                                ref={textareaRef}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder={type === "bug" ? "What happened? What did you expect?" : "What's on your mind?"}
                                rows={4}
                                maxLength={2000}
                                className="w-full bg-background border border-hairline rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-secondary resize-none focus:outline-none focus:border-accent/50 transition-colors"
                            />

                            {error && <p className="text-negative text-xs">{error}</p>}

                            <button
                                type="submit"
                                disabled={sending || !message.trim()}
                                className="w-full bg-accent rounded-xl py-2.5 text-sm font-semibold text-black active:scale-95 transition-all disabled:opacity-40"
                            >
                                {sending ? "Sending..." : "Send"}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Bubble button */}
            <button
                onClick={open ? () => setOpen(false) : handleOpen}
                className="w-12 h-12 rounded-full bg-surface border border-line shadow-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent/40 active:scale-95 transition-all"
                title="Send feedback"
            >
                {open ? <X size={18} /> : <MessageSquare size={18} />}
            </button>
        </div>
    )
}
