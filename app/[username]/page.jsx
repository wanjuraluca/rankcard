import { supabase } from "@/lib/supabase"
import { platformConfig } from "@/lib/platforms"
import ProfileClient from "../components/ProfileClient"

export async function generateMetadata({ params }) {
  const { username } = await params
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, bio, user_id")
    .eq("username", username)
    .maybeSingle()

  if (!profile) {
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
      ? `${profile.username}'s real ranks on ${games.join(", ")} — connected via RankCard.`
      : `${profile.username}'s shareable rank profile on RankCard.`)

  return {
    title: profile.username,
    description,
    openGraph: {
      title: `${profile.username} on RankCard`,
      description,
    },
    twitter: {
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
    .single()

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
