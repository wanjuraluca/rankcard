import { supabase } from "@/lib/supabase"
import CompareClient from "../components/CompareClient"
import ComparePicker from "../components/ComparePicker"

export default async function ComparePage({ searchParams }) {
    const { a, b } = await searchParams

    if (!a || !b) {
        return <ComparePicker />
    }

    const [{ data: profileA }, { data: profileB }] = await Promise.all([
        supabase.from("profiles").select("*").eq("username", a).maybeSingle(),
        supabase.from("profiles").select("*").eq("username", b).maybeSingle(),
    ])

    if (!profileA || !profileB) {
        const missing = !profileA ? a : b
        return <ComparePicker error={`No RankCard profile for "${missing}". Try another username.`} />
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
