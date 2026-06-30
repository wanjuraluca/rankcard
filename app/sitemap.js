import { supabase } from "@/lib/supabase"

const SITE_URL = "https://rankcard.app"

export default async function sitemap() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, created_at")

  const profileEntries = (profiles ?? []).map((profile) => ({
    url: `${SITE_URL}/${profile.username}`,
    lastModified: profile.created_at ?? undefined,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  const staticEntries = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/find`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/impressum`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/datenschutz`, changeFrequency: "yearly", priority: 0.2 },
  ]

  return [...staticEntries, ...profileEntries]
}
