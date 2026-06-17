import { supabase } from "@/lib/supabase"
import ConnectAccount from "../components/ConnectAccount"
import Image from "next/image"
import AvatarUpload from "../components/AvatarUpload"
import { platformConfig } from "@/lib/platforms"
import RankBadge from "../components/RankBadge"
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
    .eq("user_id", profile.id)

  return (
    <div className="h-[100] rounded-t-xl borber border-line border-b-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(177,108,255,0.4)_0%,transparent_60%)]">
    <ProfileClient data={profile} accounts={accounts} />
    </div>
)

}
