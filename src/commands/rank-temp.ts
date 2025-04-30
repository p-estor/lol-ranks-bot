import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction
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
    const riotToken = process.env.RIOT_TOKEN
    if (!riotToken) return interaction.reply('Error interno: Riot API token no configurado.')

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)')
    }

    const [rawName, tagLine] = userInput.split('/')
    const gameName = `${rawName.trim()}/${tagLine.trim()}`
    const accountUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`

    try {
      const puuidRes = await fetch(accountUrl, { headers: { 'X-Riot-Token': riotToken } })
      if (!puuidRes.ok) return interaction.reply('No se pudo encontrar el invocador.')

      const puuidData = await puuidRes.json()
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      if (!summonerRes.ok) return interaction.reply('No se pudo obtener el ID del invocador.')

      const summonerData = await summonerRes.json()

      // Generar un icono aleatorio entre 0 y 29
      const randomIconId = Math.floor(Math.random() * 30)
      await interaction.reply({
        content: `Cambia tu icono de invocador al número **${randomIconId}** y presiona el botón para continuar.`,
        components: [
          new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId('confirm_icon')
              .setLabel('He cambiado el icono')
              .setStyle('PRIMARY')
          )
        ]
      })

      const collector = interaction.channel?.createMessageComponentCollector({
        filter: (i: MessageComponentInteraction) =>
          i.customId === 'confirm_icon' && i.user.id === interaction.user.id,
        time: 60000
      })

      collector?.on('collect', async (buttonInteraction) => {
        const updatedRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
          headers: { 'X-Riot-Token': riotToken }
        })
        const updatedData = await updatedRes.json()
        if (updatedData.profileIconId !== randomIconId) {
          return buttonInteraction.reply('El icono aún no coincide. Intenta de nuevo.')
        }

        // Obtener datos ranked
        const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
          headers: { 'X-Riot-Token': riotToken }
        })
        const rankedData = await rankedRes.json()
        const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5')

        if (!soloQueue) return buttonInteraction.reply(`${gameName} no tiene partidas clasificadas.`)

        const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`
        const riotTier = soloQueue.tier.toLowerCase()
        const tierMap: Record<string, string> = {
          iron: 'iron',
          bronze: 'bronze',
          silver: 'silver',
          gold: 'gold',
          platinum: 'platinum',
          emerald: 'emerald',
          diamond: 'diamond',
          master: 'master',
          grandmaster: 'Gran Maestro',
          challenger: 'Retador'
        }

        const roleName = tierMap[riotTier]
        const guild = interaction.guild
        const member = await guild?.members.fetch(interaction.user.id)
        if (!guild || !member) return buttonInteraction.reply('No se pudo asignar el rol.')

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
        if (!role) return buttonInteraction.reply(`Rol "${roleName}" no existe en el servidor.`)

        // Limpiar roles anteriores
        const allRankRoles = Object.values(tierMap)
        await member.roles.remove(member.roles.cache.filter(r => allRankRoles.includes(r.name)))

        await member.roles.add(role)
        await buttonInteraction.reply(`${gameName} está en ${rankText}. Rol "${role.name}" asignado.`)
      })

      collector?.on('end', (_, reason) => {
        if (reason === 'time') {
          interaction.followUp('⏰ Verificación expirada. Ejecuta el comando de nuevo.')
        }
      })

    } catch (error) {
      console.error('Error:', error)
      interaction.reply('Error procesando la verificación de rango.')
    }
  }

  getSlashCommandData() {
    return {
      name: 'rank-temp',
      description: 'Consulta el rango de un invocador (con verificación de icono)',
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
