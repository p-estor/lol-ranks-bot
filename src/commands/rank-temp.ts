import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageAttachment
} from 'discord.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'
import fetch from 'node-fetch'
import { CommandInterface } from '../interfaces/command.interface.js'

export default class RankTempCommand extends CommandInterface<CommandInteraction> {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    super('rank-temp')
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner')
    console.log('User input:', userInput)

    const riotToken = process.env.RIOT_TOKEN
    if (!riotToken) {
      return interaction.reply('Error interno: Riot API token no configurado.')
    }

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)')
    }

    const [rawName, tagLine] = userInput.split('/')
    const gameName = `${rawName.trim()}/${tagLine.trim()}`

    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`

    try {
      // Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken }
      })

      if (!puuidRes.ok) {
        return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?')
      }

      const puuidData = await puuidRes.json()
      if (!puuidData.puuid) {
        return interaction.reply('No se pudo encontrar el PUUID para el invocador proporcionado.')
      }

      const iconId = Math.floor(Math.random() * 28) + 1 // 1 al 28
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${iconId}.png`

      // Después:
const row = new MessageActionRow().addComponents(
  new MessageButton()
    .setCustomId(...)
    .setLabel(...)
    .setStyle('PRIMARY') // En v13 los estilos son strings
)

const attachment = new MessageAttachment(iconUrl, 'icon.png')

await interaction.reply({
  content: `Cambia tu icono al siguiente y pulsa "Confirmar":`,
  files: [attachment],
  components: [row]
})


    } catch (error) {
      console.error('Error:', error)
      await interaction.reply('Error obteniendo información del invocador.')
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
