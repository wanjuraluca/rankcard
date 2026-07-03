"use client"
import { useState, useRef } from "react"
import { Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function AvatarUpload( {username, avatarUrl, editable} ) {
    const [avatar, setAvatar] = useState(avatarUrl)
    const [error, setError] = useState("")
    const fileInput = useRef(null)

    function handleClickInput() {
        if (editable) fileInput.current.click()
    }

    async function handleFileChange(e) {
    const file = e.target.files[0]
    const fileExt = file.name.split('.').pop()
    const fileName = `${username}/${Date.now()}.${fileExt}`
    if (!file) return

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
        .update({ avatar_url: data.publicUrl })
        .eq("username", username)

    setAvatar(data.publicUrl)
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
    </div>
)
}
