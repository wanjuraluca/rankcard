"use client"
import { useState, useRef } from "react"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import ImageCropModal from "./ImageCropModal"

// Banner is a Pro feature. `editable` gates uploading (owner + Pro); `isPro`
// gates DISPLAY (the profile owner's Pro status) — a downgraded user keeps
// their banner_url in the DB but it stops showing until they resubscribe,
// same "cosmetic reverts, data kept" behaviour as Discord Nitro. Without this
// the custom banner stayed visible forever after Pro lapsed.
export default function BannerUpload({ username, bannerUrl, editable, isPro = false }) {
    const [banner, setBanner] = useState(bannerUrl)
    const [error, setError] = useState("")
    const [pendingFile, setPendingFile] = useState(null)
    const fileInput = useRef(null)

    function handleClickInput() {
        if (editable) fileInput.current.click()
    }

    async function uploadFile(fileOrBlob, ext) {
        const fileName = `${username}/banner-${Date.now()}.${ext}`
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
            .update({ banner_url: data.publicUrl })
            .eq("username", username)

        setBanner(data.publicUrl)
    }

    function handleFileChange(e) {
        const file = e.target.files[0]
        e.target.value = ""
        if (!file) return

        // Animated GIF banners bypass cropping entirely (Pro-only editor,
        // no non-Pro gate needed here) — same reasoning as AvatarUpload.
        if (file.type === "image/gif") {
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

    // Only the owner's Pro status unlocks showing the custom image; otherwise
    // fall back to the default gradient strip every profile has.
    const showBanner = isPro && banner

    return (
        <div
            onClick={handleClickInput}
            className={`relative aspect-[4/1] rounded-t-2xl border border-hairline border-b-0 overflow-hidden group ${editable ? "cursor-pointer" : ""}`}
            style={!showBanner ? { background: "radial-gradient(ellipse 55% 130% at 20% 60%, rgba(177,108,255,0.45), transparent 60%)" } : undefined}
        >
            {editable && (
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            )}
            {showBanner && (
                <img src={banner} className="absolute inset-0 w-full h-full object-cover" />
            )}
            {editable && (
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50">
                    <Camera size={24} className="text-white" />
                    <span className="text-white text-xs font-semibold ml-2">{banner ? "Change banner" : "Add banner"}</span>
                </div>
            )}
            {error && (
                <div className="absolute bottom-2 left-2 rounded-lg border border-negative/40 bg-negative/10 px-2.5 py-1.5 text-[11px] text-negative z-20">
                    {error}
                </div>
            )}
            {pendingFile && (
                <ImageCropModal
                    file={pendingFile}
                    shape="rect"
                    aspect={4}
                    onCancel={() => setPendingFile(null)}
                    onCropped={handleCropped}
                />
            )}
        </div>
    )
}
