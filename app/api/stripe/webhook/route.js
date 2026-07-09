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

    // Stripe can and does redeliver the same event (retries after a timeout,
    // manual resend from the dashboard, etc.) — event.id is stable across
    // redeliveries, so claiming it here via a unique insert is what actually
    // guards against double-processing, not just trusting each event arrives
    // once. A duplicate insert means we've already handled this exact event.
    const { error: dedupeError } = await supabaseAdmin
        .from("processed_webhook_events")
        .insert({ event_id: event.id })
    if (dedupeError) {
        return NextResponse.json({ received: true, duplicate: true })
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

    // Covers renewal-payment failures (status flips to past_due/unpaid) and
    // any other status change Stripe reports outside of the two events above
    // — without this, a failed renewal left is_pro true until Stripe
    // eventually (if ever) sent a separate subscription.deleted.
    if (event.type === "customer.subscription.updated") {
        const customerId = session.customer
        const isActive = ["active", "trialing"].includes(session.status)
        const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle()
        if (profile) {
            await supabaseAdmin
                .from("profiles")
                .update({ is_pro: isActive, stripe_subscription_id: session.id })
                .eq("user_id", profile.user_id)
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
