import { CommandInteraction } from 'discord.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'
import fetch from 'node-fetch'

export default class RankTempCommand {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner') // "Kai/WEEBx"
    const [gameName, tagLine] = userInput.split('/')

    try {
      // 1. Obtener PUUID
      const puuidRes = await fetch(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, {
        headers: { 'X-Riot-Token': this.config.riotApiKey }
      })
      const puuidData = await puuidRes.json()

      if (!puuidData.puuid) throw new Error('PUUID not found')

      // 2. Obtener Summoner ID
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': this.config.riotApiKey }
      })
      const summonerData = await summonerRes.json()

      if (!summonerData.id) throw new Error('Summoner ID not found')

      // 3. Obtener Ranked Data
      const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
        headers: { 'X-Riot-Token': this.config.riotApiKey }
      })
      const rankedData = await rankedRes.json()

      // Procesar y mostrar los datos al usuario
      const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5')

      if (soloQueue) {
        const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`
        await interaction.reply(`${gameName} está en ${rankText}`)
      } else {
        await interaction.reply(`${gameName} no tiene partidas clasificadas.`)
      }

    } catch (error) {
      console.error(error)
      await interaction.reply('Error obteniendo el rango del jugador.')
    }
  }

  getSlashCommandData() {
    return {
      name: 'rank-temp',
      description: 'Consulta el rango de un invocador (API temporal)',
      options: [
        {
          name: 'summoner',
          type: 3,
          description: 'Formato: Nombre/Tag (ej. Kai/WEEBx)',
          required: true
        }
      ]
    }
  }
}
