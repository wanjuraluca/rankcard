import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { peaksBySeasonExcludingCurrent } from "@/lib/seasons"

const LEAGUE_TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    if (!username) {
        return NextResponse.json({ error: "Missing username" }, { status: 400 })
    }

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("username", username)
        .maybeSingle()
    if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: accounts } = await supabaseAdmin
        .from("connected_accounts")
        .select("id, platform")
        .eq("user_id", profile.user_id)
        .in("platform", ["League of Legends", "TFT"])

    const badges = []

    for (const account of accounts ?? []) {
        if (account.platform === "League of Legends") {
            const { data: snapshots } = await supabaseAdmin
                .from("lp_history")
                .select("recorded_on, tier, rank")
                .eq("connected_account_id", account.id)
            const peaks = peaksBySeasonExcludingCurrent(snapshots ?? [], LEAGUE_TIER_ORDER)
            for (const peak of peaks) badges.push({ game: "League of Legends", ...peak })
        }

        if (account.platform === "TFT") {
            const { data: snapshots } = await supabaseAdmin
                .from("tft_lp_history")
                .select("recorded_on, tier, rank")
                .eq("connected_account_id", account.id)
                .eq("queue_type", "RANKED_TFT")
            const peaks = peaksBySeasonExcludingCurrent(snapshots ?? [], LEAGUE_TIER_ORDER)
            for (const peak of peaks) badges.push({ game: "TFT", ...peak })
        }
    }

    badges.sort((a, b) => b.season.localeCompare(a.season))

    return NextResponse.json({ badges })
}
