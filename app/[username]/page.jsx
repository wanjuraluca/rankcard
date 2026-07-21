import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import ProfileClient from "../components/ProfileClient"
import ClaimUsername from "../components/ClaimUsername"

// Same rule as signup (complete-profile) — anything else can never be a
// real profile, so it gets a plain 404 instead of the claim pitch.
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export async function generateMetadata({ params }) {
  const { username } = await params
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, bio, user_id")
    .eq("username", username)
    .maybeSingle()

  if (!profile) {
    if (USERNAME_PATTERN.test(username)) {
      // Claim pitch page — useful for the visitor, but a soft 404 for
      // crawlers, so keep it out of the index.
      return {
        title: `${username} is still available`,
        description: `rankcard.app/${username} hasn't been claimed yet. Connect your games and make it yours.`,
        robots: { index: false, follow: false },
      }
    }
    return { title: "Profile not found" }
  }

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("platform")
    .eq("user_id", profile.user_id)

  const games = (accounts ?? [])
    .map(a => platformConfig[a.platform]?.shortName)
    .filter(Boolean)

  const description = profile.bio
    || (games.length > 0
      ? `${profile.username}'s real ranks on ${games.join(", ")}, connected via RankCard.`
      : `${profile.username}'s shareable rank profile on RankCard.`)

  return {
    title: profile.username,
    description,
    openGraph: {
      title: `${profile.username} on RankCard`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${profile.username} on RankCard`,
      description,
    },
  }
}

export default async function Profile({ params }) {
  const { username } = await params
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle()

  // Unknown but valid username → "claim this name" pitch instead of a dead
  // 404 (noindex via generateMetadata, so crawlers don't index the soft 404).
  // Invalid names can never become profiles → clean 404, not a 500 crash
  // on profile.user_id.
  if (!profile) {
    if (USERNAME_PATTERN.test(username)) return <ClaimUsername username={username} />
    notFound()
  }

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", profile.user_id)

  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.user_id)

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", profile.user_id)

  return (
    <ProfileClient
      data={profile}
      accounts={accounts}
      followerCount={followerCount ?? 0}
      followingCount={followingCount ?? 0}
    />
  )
}
