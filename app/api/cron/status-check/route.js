import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Traffic-based detection (see /api/summoner) only re-checks a service when a
// real user happens to look up that specific game — on a quiet day a banner
// can stay stuck long after the underlying API recovered. This cron re-pings
// only the services currently marked "down" with a known-good test account,
// so recovery gets caught even with zero real traffic in between.
//
// NOTE: Vercel Hobby plan only guarantees cron jobs run once/day regardless
// of the schedule string — this is configured for every 10 minutes in
// vercel.json, but will silently run less often on Hobby. Harmless either
// way; traffic-based detection still covers the gap.
const TEST_ACCOUNTS = {
  overwatch: { platform: "Overwatch", name: "TeKrop", tag: "2217" },
  riot: { platform: "League of Legends", name: "DinDjarin", tag: "1007" },
}

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { data: downServices } = await supabaseAdmin
    .from("service_status")
    .select("service")
    .eq("status", "down")

  const results = {}
  for (const { service } of downServices ?? []) {
    const account = TEST_ACCOUNTS[service]
    if (!account) {
      results[service] = "skipped (no test account configured)"
      continue
    }
    const url = new URL("/api/summoner", request.url)
    url.searchParams.set("platform", account.platform)
    url.searchParams.set("name", account.name)
    url.searchParams.set("tag", account.tag)
    try {
      await fetch(url)
      results[service] = "checked"
    } catch (err) {
      results[service] = `check failed: ${err.message}`
    }
  }

  return Response.json({ rechecked: results })
}
