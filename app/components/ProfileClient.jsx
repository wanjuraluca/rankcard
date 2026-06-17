"use client"

import AvatarUpload from "./AvatarUpload"

export default function ProfileClient({ data, accounts }) {

    return(
        <div className="bg-background min-h-screen p-3">
            <div className="h-[100px] rounded-t-xl border border-line border-b-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(177,108,255,0.4)_0%,transparent_60%)]">
            </div>

            <div className="bg-surface border border-line rounded-b-xl p-4 flex gap-4 items-center">
                <div className="-mt-15">
                    <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
                </div>
                <div>
                <p className="text-text-primary text-lg font-bold">{data.username}</p>
                <p className="text-text-secondary">{data.bio}</p>
                <div className="flex gap-2 flex-wrap"> {/* Tags für Später m erken */}
                    <span className="test-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                    <span className="test-xs px-2 py-1 rounded-full bg-accent/10 text-accent border border-line">Member</span>
                </div>
                </div>
            </div>
        </div>
    )
}