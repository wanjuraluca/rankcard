import { supabase } from "@/lib/supabase"
import ProfileClient from "../components/ProfileClient"

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
