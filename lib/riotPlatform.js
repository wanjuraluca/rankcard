// Riot's account-v1 (by-riot-id) is scoped to a continent (europe/americas/asia),
// not a platform shard — so it resolves fine for EUW, EUNE, TR and RU accounts
// alike. But league-v4/tft-v4's by-puuid endpoints need the exact platform
// (euw1/eun1/tr1/ru), and hardcoding euw1 silently returns [] (looks like "no
// rank") for anyone actually playing on EUNE/TR/RU — even though their match
// history still loads fine since match-v5 is continent-routed. Match IDs are
// prefixed with the platform (e.g. "EUN1_12345..."), so derive it from a
// cheap single-match-id lookup instead of assuming euw1.
export async function detectPlatform(puuid) {
    const response = await fetch(
        `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1`,
        { headers: { 'X-Riot-Token': process.env.RIOT_API_KEY } }
    )
    let ids = null
    try {
        ids = await response.json()
    } catch {
        ids = null
    }
    const prefix = Array.isArray(ids) && ids[0]?.split('_')[0]
    return prefix ? prefix.toLowerCase() : 'euw1'
}
