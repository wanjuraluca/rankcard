import { stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function POST(request) {
    const { username } = await request.json()
    if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("username", username)
        .maybeSingle()

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    if (!profile.stripe_customer_id) return NextResponse.json({ error: "No subscription found" }, { status: 400 })

    const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${username}`,
    })

    return NextResponse.json({ url: session.url })
}
