"use client"
import { useState, useEffect } from "react"
import { X } from "lucide-react"

export default function FollowListModal({ username, type, onClose }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        fetch(`/api/profile/connections?username=${username}&type=${type}`)
            .then(r => r.json())
            .then(d => setUsers(d.users ?? []))
            .catch(() => setError("Couldn't load the list."))
            .finally(() => setLoading(false))
    }, [username, type])

    const title = type === "followers" ? "Followers" : "Following"
    const emptyText = type === "followers" ? "No followers yet." : "Not following anyone yet."

    return (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-surface border border-hairline rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <p className="text-text-primary text-lg font-bold">{title}</p>
                    <button type="button" onClick={onClose} className="text-text-secondary hover:text-text-primary active:scale-90 transition-transform"><X size={18} /></button>
                </div>

                <div className="flex flex-col gap-1 max-h-[55vh] overflow-y-auto -mx-2">
                    {loading && (
                        <p className="text-text-secondary text-sm px-2 py-3">Loading…</p>
                    )}
                    {!loading && error && (
                        <p className="text-negative text-sm px-2 py-3">{error}</p>
                    )}
                    {!loading && !error && users.length === 0 && (
                        <p className="text-text-secondary text-sm px-2 py-3">{emptyText}</p>
                    )}
                    {!loading && !error && users.map((user) => (
                        <a
                            key={user.username}
                            href={`/${user.username}`}
                            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-background active:bg-background transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg border border-accent/40 flex items-center justify-center font-bold text-accent-soft bg-background flex-shrink-0 overflow-hidden">
                                {user.avatar_url
                                    ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
                                    : <span>{user.username[0]}</span>
                                }
                            </div>
                            <span className="text-text-primary text-sm font-semibold truncate">{user.username}</span>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    )
}
