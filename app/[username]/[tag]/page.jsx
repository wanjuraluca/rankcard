import Link from 'next/link';
import { queueNames, tftRanks } from '@/lib/constants';


export default async function Profile({ params }) {
  const { username, tag } = await params
  const response = await fetch(`http://localhost:3000/api/summoner?name=${username}&tag=${tag}`)
  const { rankData, tftData, valorantData } = await response.json()
  return ( 
    <div className="text-white">
      {rankData.map(g => (
        <p key={g.queueType}>{queueNames[g.queueType]}: {g.tier} {g.rank} {g.leaguePoints}</p>
      ))}
      {tftData.map(g => (
        <p key={g.queueType}>{tftRanks[g.queueType]}: {g.tier} {g.rank} {g.leaguePoints}</p>
      ))}
      <p>Valorant: {valorantData.data.current.tier.name} - {valorantData.data.current.rr} RR</p>
      <Link href="/faker"> NikoDuPic</Link>
      <h1>{decodeURIComponent(username)}</h1>
    </div>
  )
}