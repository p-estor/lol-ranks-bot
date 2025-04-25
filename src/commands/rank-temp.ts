import { CommandInteraction } from 'discord.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'
import fetch from 'node-fetch'
import { CommandInterface } from '../interfaces/command.interface.js'

export default class RankTempCommand extends CommandInterface<CommandInteraction> {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    super('rank-temp') // nombre del comando
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner')
    console.log('User input:', userInput)

     const riotToken = process.env.RIOT_TOKEN
      if (!riotToken) {
        console.error('Falta el token de Riot. Asegúrate de que RIOT_TOKEN esté definido.')
        return interaction.reply('Error interno: Riot API token no configurado.')
      }
    
    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)')
    }

    const [rawName, tagLine] = userInput.split('/')
    console.log('Raw name:', rawName)
    console.log('Tag line:', tagLine)

    // Construimos la URL correctamente sin sobrecodificar
    const gameName = `${rawName.trim()}/${tagLine.trim()}`
    console.log('Game name:', gameName)

    // Log de la URL antes de la solicitud
    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`
    console.log('Request URL:', url)

    try {
      // 1. Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken }
      })
      const puuidData = await puuidRes.json()

      // Verificar si la API responde con el PUUID
      if (!puuidData.puuid) {
        console.error('Error: PUUID not found', puuidData)
        //console.error(this.config.riotApiKey)
        return interaction.reply('No se pudo encontrar el PUUID para el invocador proporcionado.')
      }

      // 2. Obtener Summoner ID
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      const summonerData = await summonerRes.json()
      console.log('Summoner response:', summonerData)

      if (!summonerData.id) {
        console.error('Error: Summoner ID not found', summonerData)
        return interaction.reply('No se pudo obtener el ID del invocador.')
      }

      // 3. Obtener Ranked Data
      const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      const rankedData = await rankedRes.json()

      const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5')

      if (soloQueue) {
        const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`
        await interaction.reply(`${gameName} está en ${rankText}`)
      } else {
        await interaction.reply(`${gameName} no tiene partidas clasificadas.`)
      }

    } catch (error) {
      console.error('Error:', error)
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
