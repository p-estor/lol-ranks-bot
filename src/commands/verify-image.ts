import { CommandInteraction } from 'discord.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'
import fetch from 'node-fetch'
import { CommandInterface } from '../interfaces/command.interface.js'

export default class VerifyImageCommand extends CommandInterface<CommandInteraction> {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    super('verify-image') // nombre del comando
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner')
    const iconId = interaction.options.getInteger('icon_id')
    console.log('VerifyImage input:', userInput, 'Expected icon:', iconId)

    const riotToken = process.env.RIOT_TOKEN
    if (!riotToken) {
      console.error('Falta el token de Riot')
      return interaction.reply('Error interno: Riot API token no configurado.')
    }

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)')
    }
    if (iconId === null) {
      return interaction.reply('Debes especificar el ID del icono que deseas verificar.')
    }

    const [rawName, tagLine] = userInput.split('/')
    const gameName = `${rawName.trim()}/${tagLine.trim()}`
    const acctUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`

    try {
      // 1. Obtener PUUID
      const puuidRes = await fetch(acctUrl, { headers: { 'X-Riot-Token': riotToken } })
      if (!puuidRes.ok) {
        console.error(`PUUID fetch error: ${puuidRes.status}`)
        return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?')
      }
      const puuidData = await puuidRes.json()
      if (!puuidData.puuid) {
        return interaction.reply('No se obtuvo el PUUID del invocador.')
      }

      // 2. Obtener datos de Summoner para icono
      const summonerRes = await fetch(
        `https://${this.config.region || 'euw1'}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`,
        { headers: { 'X-Riot-Token': riotToken } }
      )
      if (!summonerRes.ok) {
        console.error(`Summoner fetch error: ${summonerRes.status}`)
        return interaction.reply('Error al obtener datos del invocador.')
      }
      const summonerData = await summonerRes.json()

      // 3. Comparar icono
      if (summonerData.profileIconId === iconId) {
        await interaction.reply(`✅ Correcto: tu icono es **${iconId}**.`)
      } else {
        await interaction.reply(`❌ Incorrecto: tu icono actual es **${summonerData.profileIconId}**, no **${iconId}**.`)
      }
    } catch (error) {
      console.error('Error en verify-image:', error)
      await interaction.reply('Error inesperado durante la verificación del icono.')
    }
  }

  getSlashCommandData() {
    return {
      name: 'verify-image',
      description: 'Verifica si has cambiado tu icono al sugerido por el bot.',
      options: [
        {
          name: 'summoner',
          type: 3,
          description: 'Formato: Nombre/Tag (ej. Kai/WEEBx)',
          required: true
        },
        {
          name: 'icon_id',
          type: 4, // Integer
          description: 'ID del icono sugerido por el bot',
          required: true
        }
      ]
    }
  }
}
