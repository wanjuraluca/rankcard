import { stripe } from "@/lib/stripe"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { NextResponse } from "next/server"

export async function POST(request) {
    const body = await request.text()
    const sig = request.headers.get("stripe-signature")

    let event
    try {
        event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const session = event.data.object

    if (event.type === "checkout.session.completed") {
        const userId = session.metadata?.supabase_user_id
        const subscriptionId = session.subscription
        if (userId) {
            await supabaseAdmin
                .from("profiles")
                .update({ is_pro: true, stripe_subscription_id: subscriptionId })
                .eq("user_id", userId)
        }
    }

    if (event.type === "customer.subscription.deleted") {
        const customerId = session.customer
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle()
        if (profile) {
            await supabaseAdmin
                .from("profiles")
                .update({ is_pro: false, stripe_subscription_id: null })
                .eq("user_id", profile.user_id)
        }
    }

    return NextResponse.json({ received: true })
}
