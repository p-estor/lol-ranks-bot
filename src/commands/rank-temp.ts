import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
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
    if (!riotToken) return interaction.reply('Riot API token no configurado.')
    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)')
    }

    const [rawName, tagLine] = userInput.split('/')
    const gameName = `${rawName.trim()}/${tagLine.trim()}`

    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`
    try {
      // Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken },
      })
      if (!puuidRes.ok) return interaction.reply('No se pudo encontrar el invocador.')

      const puuidData = await puuidRes.json()
      if (!puuidData.puuid) return interaction.reply('PUUID no encontrado.')

      // Obtener datos del invocador
      const summonerRes = await fetch(
        `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`,
        { headers: { 'X-Riot-Token': riotToken } }
      )
      const summonerData = await summonerRes.json()
      if (!summonerData.id) return interaction.reply('Summoner ID no encontrado.')

      const iconId = summonerData.profileIconId
      const iconUrl = `http://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${iconId}.png`

      // Mostrar icono y pedir verificación
      const embed = new MessageEmbed()
        .setTitle('Verificación de identidad')
        .setDescription('Cambia tu icono al mostrado y presiona "Verificar" cuando lo hayas hecho.')
        .setImage(iconUrl)
        .setColor('BLUE')

      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('verify_icon')
          .setLabel('Verificar')
          .setStyle('PRIMARY')
      )

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true })

      const collector = interaction.channel?.createMessageComponentCollector({
        filter: i => i.customId === 'verify_icon' && i.user.id === interaction.user.id,
        time: 60000,
        max: 1,
      })

      collector?.on('collect', async i => {
        await i.deferUpdate()

        // Verificar si el icono fue cambiado
        const refreshedSummonerRes = await fetch(
          `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`,
          { headers: { 'X-Riot-Token': riotToken } }
        )
        const refreshedData = await refreshedSummonerRes.json()

        if (refreshedData.profileIconId !== iconId) {
          // Obtener ranking
          const rankedRes = await fetch(
            `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`,
            { headers: { 'X-Riot-Token': riotToken } }
          )
          const rankedData = await rankedRes.json()
          const soloQueue = rankedData.find(
            (entry: any) => entry.queueType === 'RANKED_SOLO_5x5'
          )

          if (!soloQueue) {
            return interaction.followUp(`${gameName} no tiene partidas clasificadas.`)
          }

          const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`

          const riotTier = soloQueue.tier.toLowerCase()
          const tierMap: Record<string, string> = {
            iron: 'Iron',
            bronze: 'Bronze',
            silver: 'Silver',
            gold: 'Gold',
            platinum: 'Platinum',
            emerald: 'Emerald',
            diamond: 'Diamond',
            master: 'Master',
            grandmaster: 'Grandmaster',
            challenger: 'Challenger',
          }

          const roleName = tierMap[riotTier]
          const guild = interaction.guild
          const member = await guild?.members.fetch(interaction.user.id)
          if (!guild || !member) {
            return interaction.followUp(
              `${gameName} está en ${rankText}, pero no se pudo asignar el rol.`
            )
          }

          const role = guild.roles.cache.find(
            r => r.name.toLowerCase() === roleName.toLowerCase()
          )
          if (!role) {
            return interaction.followUp(
              `${gameName} está en ${rankText}, pero el rol "${roleName}" no existe.`
            )
          }

          const allRankRoles = Object.values(tierMap)
          await member.roles.remove(
            member.roles.cache.filter(r => allRankRoles.includes(r.name))
          )
          await member.roles.add(role)
          return interaction.followUp(`${gameName} está en ${rankText}. Rol "${role.name}" asignado.`)
        } else {
          return interaction.followUp('El icono no fue cambiado. Verificación fallida.')
        }
      })

      collector?.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp('No se recibió respuesta. Verificación cancelada.')
        }
      })
    } catch (err) {
      console.error('Error:', err)
      return interaction.reply('Error obteniendo el rango del jugador.')
    }
  }

  getSlashCommandData() {
    return {
      name: 'rank-temp',
      description: 'Consulta el rango de un invocador y asigna el rol tras verificar icono',
      options: [
        {
          name: 'summoner',
          type: 3,
          description: 'Formato: Nombre/Tag (ej. Kai/WEEBx)',
          required: true,
        },
      ],
    }
  }
}
