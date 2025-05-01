import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageAttachment,
  Interaction,
  ButtonInteraction
} from 'discord.js'
import { CommandInterface } from '../interfaces/command.interface.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'
import fetch from 'node-fetch'

// ... imports

const ICON_RANGE = { min: 1, max: 28 }
const REGION = 'europe'
const RIOT_API = 'https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid'
const ACCOUNT_API = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id`

export default class VerifyImageCommand extends CommandInterface<CommandInteraction> {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    super('verify-image')
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner')
    if (!userInput || !userInput.includes('/')) {
      return interaction.reply({ content: 'Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)', ephemeral: true })
    }

    const [rawName, tagLine] = userInput.split('/')
    const iconId = Math.floor(Math.random() * (ICON_RANGE.max - ICON_RANGE.min + 1)) + ICON_RANGE.min
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/profileicon/${iconId}.png`

    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(`verify_icon_${iconId}_${interaction.user.id}`)
        .setLabel('Confirmar')
        .setStyle('PRIMARY')
    )

    await interaction.reply({
      content: `Pon este icono en tu cliente de LoL y pulsa "Confirmar" cuando esté listo:`,
      files: [iconUrl],
      components: [row],
      ephemeral: true
    })
  }

  async handleComponent(interaction: Interaction) {
    if (!interaction.isButton()) return

    const buttonInteraction = interaction as ButtonInteraction
    if (!buttonInteraction.customId.startsWith('verify_icon_')) return

    const [, iconIdStr, userId] = buttonInteraction.customId.split('_')
    const expectedIcon = parseInt(iconIdStr, 10)

    const userInput = buttonInteraction.message.interaction?.options.getString('summoner')
    if (!userInput || !userInput.includes('/')) {
      return buttonInteraction.reply({ content: 'Error: Formato inválido. Vuelve a ejecutar el comando.', ephemeral: true })
    }

    const [rawName, tagLine] = userInput.split('/')
    const gameName = `${rawName.trim()}/${tagLine.trim()}`
    const riotToken = process.env.RIOT_TOKEN

    if (!riotToken) {
      return buttonInteraction.reply({ content: 'Error: Riot Token no configurado.', ephemeral: true })
    }

    try {
      const puuidRes = await fetch(`${ACCOUNT_API}/${gameName}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      const puuidData = await puuidRes.json()

      const summonerRes = await fetch(`${RIOT_API}/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      const summonerData = await summonerRes.json()

      const currentIcon = summonerData.profileIconId

      if (currentIcon === expectedIcon) {
        await buttonInteraction.reply({ content: '✅ Verificación completada con éxito.', ephemeral: true })
      } else {
        await buttonInteraction.reply({ content: '❌ El icono no coincide. Inténtalo de nuevo.', ephemeral: true })
      }
    } catch (error) {
      console.error('Error al verificar icono:', error)
      await buttonInteraction.reply({ content: 'Error al verificar el icono. Intenta más tarde.', ephemeral: true })
    }
  }

  getSlashCommandData() {
    return {
      name: 'verify-image',
      description: 'Verifica si el jugador ha cambiado su icono al que el bot sugiere.',
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
