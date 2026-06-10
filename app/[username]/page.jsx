import { supabase } from "@/lib/supabase"
import ConnectAccount from "../components/ConnectAccount"
import Image from "next/image"
import AvatarUpload from "../components/AvatarUpload"


export default async function Profile({ params }) {
  const { username } = await params
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single()

  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", data.id)

return (
  <div className="p-2"> {/* Outer Container */}
    <div className="h-[150px] bg-surface rounded-t-lg border-b-1< border-b border-b-[#b16cff] border-[#b16cff]/30 bg-gradient-to-r from-[#b16cff]/30 to-transparent"> {/* Banner */}
    </div> 
    <div className= "flex flex-col">
      <div className="border-[#b16cff]">
      <div className="-mt-12 ms-8"> {/* Avatar Container */}
        <AvatarUpload username={data.username} avatarUrl={data.avatar_url} />
    </div>
    </div>
      <p className= "text-text-primary text-lg font-bold">{data.username}</p>
      <p className= "text-text-secondary" >{data.bio}</p>
    </div>
    <div className= "flex p-4 gap-4"> {/* Stats Container */}
      <div className= "bg-surface rounded-lg p-4 text-text-secondary text-xs w-full">Rank Score
        <p className= "text-text-primary text-lg">270</p>
      </div>
      <div className= "bg-surface rounded-lg p-4 text-text-secondary text-xs w-full">Games Connected
        <p className= "text-text-primary text-lg">3</p>
      </div>
      <div className= "bg-surface rounded-lg p-4 text-text-secondary text-xs w-full"> Highest Rank
        <p className= "text-text-primary text-lg">Immortal</p>
      </div>
      </div>
      <div className= "flex flex-col"> {/* Connected Accounts Container */}
        <div className= "text-text-primary text-lg font-bold">Connected Accounts</div>

       {accounts.map((account) => (

        <div className= "flex bg-surface rounded-lg p-4 gap-4 mt-2 justify-between  ">
          <div className= "flex gap-4">
          <div>Icon</div>
          <div>
            <p>{account.platform_username}</p>
            <p>{account.platform}</p>
          </div>
          </div>
          <div>Rank</div>
        </div>
    ))}
      </div>
  </div>
)

}
