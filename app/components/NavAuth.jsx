"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function NavAuth() {
    const [username, setUsername] = useState(undefined) // undefined = checking, null = logged out

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            if (!data?.user) {
                setUsername(null)
                return
            }
            const { data: profile } = await supabase
                .from("profiles")
                .select("username")
                .eq("user_id", data.user.id)
                .single()
            setUsername(profile?.username ?? null)
        })
    }, [])

    if (username === undefined) {
        return <div className="h-9 w-32" />
    }

    if (username) {
        return (
            <a
                href={`/${username}`}
                className="bg-accent text-black font-bold px-3 sm:px-4 py-2 rounded-lg hover:text-white active:scale-95 transition-all duration-150 text-sm sm:text-base"
            >
                My profile
            </a>
        )
    }

    return (
        <>
            <a className="text-text-secondary hover:text-white active:text-white transition-colors duration-150 px-2" href="/auth">Sign In</a>
            <a className="bg-accent text-black font-bold px-3 sm:px-4 py-2 rounded-lg hover:text-white active:scale-95 transition-all duration-150 text-sm sm:text-base" href="/auth">Get started</a>
        </>
    )
}
