import { supabaseAdmin } from "@/lib/supabaseAdmin"

// Public, unauthenticated — powers the site-wide red banner. Cheap read,
// short cache since an outage should clear from the banner quickly once fixed.
export async function GET() {
  const { data } = await supabaseAdmin
    .from("service_status")
    .select("service, last_error")
    .eq("status", "down")

  return Response.json(
    { down: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=30" } }
  )
}
