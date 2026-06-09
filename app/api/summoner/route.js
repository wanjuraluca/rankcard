export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  const tag = searchParams.get('tag')

  const response = await fetch(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const valAccountData = await fetch(
    `https://api.henrikdev.xyz/valorant/v2/account/${name}/${tag}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )

  const account = await response.json()
  const valorantAccountData = await valAccountData.json()

  const respone2 = await fetch(
    `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const respone4 = await fetch(
    `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/eu/pc/${valorantAccountData.data.puuid}`,
    {
      headers: {
        'Authorization': process.env.VAL_API_KEY
      }
    }
  )

  const response3 = await fetch(
    `https://euw1.api.riotgames.com/tft/league/v1/by-puuid/${account.puuid}`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )

  const rankData = await respone2.json()
  const valorantData = await respone4.json()
  const tftData = await response3.json()

  return Response.json({ rankData, tftData, valorantData })
}