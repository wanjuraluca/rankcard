import { supabase } from "@/lib/supabase"
import ConnectAccount from "../components/ConnectAccount"
import Image from "next/image"
import AvatarUpload from "../components/AvatarUpload"
import { platformConfig } from "@/lib/platforms"
import RankBadge from "../components/RankBadge"
import ProfileClient from "../components/ProfileClient"
import { Analytics } from "@vercel/analytics/next"


export default async function Profile({ params }) {
 <Analytics/>

  const { username } = await params
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", profile.id)

  return (
    <ProfileClient data={profile} accounts={accounts} />
    
)

}
