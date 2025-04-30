// utils/verifyIcon.ts
import fetch from 'node-fetch'

export async function getCurrentIcon(puuid: string, riotToken: string): Promise<number | null> {
  const res = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
    headers: { 'X-Riot-Token': riotToken }
  })

  if (!res.ok) return null

  const data = await res.json()
  return data.profileIconId
}
