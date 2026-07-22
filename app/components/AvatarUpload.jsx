"use client"
import { useState, useRef } from "react"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import ImageCropModal from "./ImageCropModal"

export default function AvatarUpload( {username, avatarUrl, editable, isPro} ) {
    const [avatar, setAvatar] = useState(avatarUrl)
    const [error, setError] = useState("")
    const [pendingFile, setPendingFile] = useState(null)
    const fileInput = useRef(null)

    function handleClickInput() {
        if (editable) fileInput.current.click()
    }

    async function uploadFile(fileOrBlob, ext) {
        const fileName = `${username}/${Date.now()}.${ext}`
        setError("")

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, fileOrBlob, { upsert: true })

        if (uploadError) {
            setError("Couldn't upload image. Try a smaller file.")
            return
        }

        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName)

        await supabase
            .from("profiles")
            .update({ avatar_url: data.publicUrl })
            .eq("username", username)

        setAvatar(data.publicUrl)
    }

    function handleFileChange(e) {
        const file = e.target.files[0]
        e.target.value = "" // allow re-selecting the same file next time
        if (!file) return

        // Animated GIF avatars are a Pro perk (like Discord Nitro) — a non-Pro
        // user picking a GIF still just gets it cropped/flattened like any
        // other image rather than blocked outright, so this never bricks the
        // upload flow, it just quietly drops the animation for free accounts.
        if (file.type === "image/gif" && isPro) {
            // GIFs skip the crop/re-encode step, so cap the raw size here —
            // the storage bucket itself has no limit configured.
            if (file.size > 10 * 1024 * 1024) {
                setError("GIF is too large. Max 10 MB.")
                return
            }
            uploadFile(file, "gif")
            return
        }

        setPendingFile(file)
    }

    function handleCropped(blob) {
        setPendingFile(null)
        uploadFile(blob, "jpg")
    }

    return (
    <div className={`relative w-24 h-24 rounded-lg border-4 border-accent flex items-center justify-center font-bold group ${editable ? "cursor-pointer" : ""}`}>
        <div className="relative w-full h-full bg-[#0a0a0f] rounded-lg flex items-center justify-center text-accent" onClick={handleClickInput}>
            {editable && (
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            )}
            {avatar
                ? <img src={avatar} className="w-full h-full object-cover rounded-lg" />
                : <span className={editable ? "group-hover:hidden" : ""}>{username[0]}</span>
            }
            {editable && avatar && <div className="absolute inset-0 rounded-lg hidden group-hover:block bg-[#2d2d3f]" />}
            {editable && <Camera size={28} className="text-[#5a5a6a] hidden group-hover:block absolute z-10" />}
        </div>
        {error && (
            <div className="absolute top-full left-0 mt-1.5 w-48 rounded-lg border border-negative/40 bg-negative/10 px-2.5 py-1.5 text-[11px] text-negative z-20">
                {error}
            </div>
        )}
        {pendingFile && (
            <ImageCropModal
                file={pendingFile}
                shape="round"
                aspect={1}
                onCancel={() => setPendingFile(null)}
                onCropped={handleCropped}
            />
        )}
    </div>
)
}
