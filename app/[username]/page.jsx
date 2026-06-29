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

  return (
    <ProfileClient data={profile} accounts={accounts} />
    
)

}
