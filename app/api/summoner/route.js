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
    `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/eu/pc/${account.puuid}`,
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
  const matchHistory = await fetchMatchHistory(account.puuid)
  const ddragonVersion = await fetchDdragonVersion()

  return Response.json({ puuid: account.puuid, rankData, tftData, valorantData, matchHistory, ddragonVersion })
}

async function fetchDdragonVersion() {
  const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  const versions = await response.json()
  return Array.isArray(versions) ? versions[0] : null
}

async function fetchMatchHistory(puuid) {
  const idsResponse = await fetch(
    `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=8`,
    {
      headers: {
        'X-Riot-Token': process.env.RIOT_API_KEY
      }
    }
  )
  const matchIds = await idsResponse.json()
  if (!Array.isArray(matchIds)) return []

  const matches = await Promise.all(
    matchIds.map(async (matchId) => {
      const matchResponse = await fetch(
        `https://europe.api.riotgames.com/lol/match/v5/matches/${matchId}`,
        {
          headers: {
            'X-Riot-Token': process.env.RIOT_API_KEY
          }
        }
      )
      const match = await matchResponse.json()
      const participant = match.info?.participants?.find(p => p.puuid === puuid)
      if (!participant) return null

      const teamKills = match.info.participants
        .filter(p => p.teamId === participant.teamId)
        .reduce((sum, p) => sum + p.kills, 0)

      const allPlayers = match.info.participants.map(p => ({
        puuid: p.puuid,
        summonerName: p.riotIdGameName || p.summonerName,
        summonerTag: p.riotIdTagline || null,
        champion: p.championName,
        teamId: p.teamId,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        cs: p.totalMinionsKilled + p.neutralMinionsKilled,
        damageDealt: p.totalDamageDealtToChampions,
        items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0)
      }))

      return {
        matchId,
        champion: participant.championName,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        role: participant.teamPosition,
        visionScore: participant.visionScore,
        damageDealt: participant.totalDamageDealtToChampions,
        killParticipationPct: teamKills > 0 ? Math.round(((participant.kills + participant.assists) / teamKills) * 100) : null,
        gameDurationSeconds: match.info.gameDuration,
        gameEndTimestamp: match.info.gameEndTimestamp,
        queueId: match.info.queueId,
        players: allPlayers
      }
    })
  )

  return matches.filter(Boolean)
}