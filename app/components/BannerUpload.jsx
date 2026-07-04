"use client"
import { useState, useRef } from "react"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function BannerUpload({ username, bannerUrl, editable }) {
    const [banner, setBanner] = useState(bannerUrl)
    const [error, setError] = useState("")
    const fileInput = useRef(null)

    function handleClickInput() {
        if (editable) fileInput.current.click()
    }

    async function handleFileChange(e) {
        const file = e.target.files[0]
        if (!file) return
        const fileExt = file.name.split('.').pop()
        const fileName = `${username}/banner-${Date.now()}.${fileExt}`

        setError("")

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, file, { upsert: true })

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

    return (
        <div
            onClick={handleClickInput}
            className={`relative h-[140px] rounded-t-2xl border border-hairline border-b-0 overflow-hidden group ${editable ? "cursor-pointer" : ""}`}
            style={!banner ? { background: "radial-gradient(ellipse 55% 130% at 20% 60%, rgba(177,108,255,0.45), transparent 60%)" } : undefined}
        >
            {editable && (
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            )}
            {banner && (
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
        </div>
    )
}
