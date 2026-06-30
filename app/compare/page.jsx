import { supabase } from "@/lib/supabase"
import CompareClient from "../components/CompareClient"
import Link from "next/link"

export default async function ComparePage({ searchParams }) {
    const { a, b } = await searchParams

    if (!a || !b) {
        return (
            <div className="bg-background min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-text-primary text-lg font-bold mb-2">Missing usernames</p>
                    <p className="text-text-secondary text-sm">Use <code className="text-accent">/compare?a=Username1&b=Username2</code></p>
                </div>
            </div>
        )
    }

    const [{ data: profileA }, { data: profileB }] = await Promise.all([
        supabase.from("profiles").select("*").eq("username", a).maybeSingle(),
        supabase.from("profiles").select("*").eq("username", b).maybeSingle(),
    ])

    if (!profileA || !profileB) {
        const missing = !profileA ? a : b
        return (
            <div className="bg-background min-h-screen flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-text-primary text-lg font-bold mb-2">Profile not found</p>
                    <p className="text-text-secondary text-sm mb-4">No RankCard profile for <span className="text-accent font-semibold">{missing}</span></p>
                    <Link href="/" className="text-accent text-sm hover:underline">← Back to home</Link>
                </div>
            </div>
        )
    }

    const [{ data: accountsA }, { data: accountsB }] = await Promise.all([
        supabase.from("connected_accounts").select("*").eq("user_id", profileA.user_id),
        supabase.from("connected_accounts").select("*").eq("user_id", profileB.user_id),
    ])

    return (
        <CompareClient
            profileA={profileA}
            accountsA={accountsA ?? []}
            profileB={profileB}
            accountsB={accountsB ?? []}
        />
    )
}
