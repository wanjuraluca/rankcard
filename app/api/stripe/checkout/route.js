import { stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function POST(request) {
    const authHeader = request.headers.get("authorization") || ""
    const accessToken = authHeader.replace("Bearer ", "")
    if (!accessToken) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 })

    const { username } = await request.json()
    if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 })

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, stripe_customer_id")
        .eq("username", username)
        .maybeSingle()

    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    if (profile.user_id !== userData.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Reuse existing Stripe customer or create a new one
    let customerId = profile.stripe_customer_id
    if (!customerId) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
        const customer = await stripe.customers.create({
            email: authUser?.user?.email,
            metadata: { username, supabase_user_id: profile.user_id },
        })
        customerId = customer.id
        await supabaseAdmin
            .from("profiles")
            .update({ stripe_customer_id: customerId })
            .eq("user_id", profile.user_id)
    }

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${username}?upgraded=1`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/${username}`,
        metadata: { username, supabase_user_id: profile.user_id },
    })

    return NextResponse.json({ url: session.url })
}
