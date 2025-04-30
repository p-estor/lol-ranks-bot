import { CommandInteraction, MessageActionRow, MessageButton } from 'discord.js'
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
    const gameName = `${rawName.trim()}/${tagLine.trim()}`

    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`

    try {
      // 1. Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken }
      })
      if (!puuidRes.ok) {
        console.error(`Error al obtener PUUID: ${puuidRes.status} ${puuidRes.statusText}`)
        return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?')
      }

      const puuidData = await puuidRes.json()
      if (!puuidData.puuid) {
        console.error('Error: PUUID not found', puuidData)
        return interaction.reply('No se pudo encontrar el PUUID para el invocador proporcionado.')
      }

      // 2. Obtener Summoner ID
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      if (!summonerRes.ok) {
        console.error(`Error al obtener Summoner ID: ${summonerRes.status}`)
        return interaction.reply('No se pudo obtener el ID del invocador.')
      }

      const summonerData = await summonerRes.json()
      if (!summonerData.id) {
        return interaction.reply('No se pudo obtener el ID del invocador.')
      }

      // 3. Obtener datos del icono de perfil
      const summonerIconId = summonerData.profileIconId
      console.log(`Icono del invocador: ${summonerIconId}`)

      // Aquí es donde generas el icono que el usuario debe tener
      const expectedIconId = 1234  // Aquí pon el ID del icono que el bot ha generado o el que deseas que el usuario use

      // Enviar instrucciones con un botón de confirmación
      const iconUrl = `http://ddragon.leagueoflegends.com/cdn/11.15.1/img/profileicon/${expectedIconId}.png`
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId('confirm-icon')
          .setLabel('Confirmar que cambié mi icono')
          .setStyle('PRIMARY')
      )

      await interaction.reply({
        content: `Por favor, cambia tu icono al siguiente: ${iconUrl}`,
        components: [row]
      })

      // Esperar la interacción con el botón de confirmación
      const filter = (buttonInteraction: any) => buttonInteraction.user.id === interaction.user.id && buttonInteraction.customId === 'confirm-icon'
      const collector = interaction.channel?.createMessageComponentCollector({ filter, time: 60000 }) // 60 segundos de espera

      collector?.on('collect', async (buttonInteraction: any) => {
        // Verificar el icono después de la confirmación
        const newSummonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
          headers: { 'X-Riot-Token': riotToken }
        })
        const newSummonerData = await newSummonerRes.json()
        const newSummonerIconId = newSummonerData.profileIconId

        if (newSummonerIconId !== expectedIconId) {
          return buttonInteraction.reply('Tu icono sigue sin coincidir. Asegúrate de haberlo cambiado.')
        }

        // Si el icono es correcto, continuar con la asignación del rol
        const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
          headers: { 'X-Riot-Token': riotToken }
        })
        if (!rankedRes.ok) {
          console.error(`Error al obtener datos de ranked: ${rankedRes.status}`)
          return buttonInteraction.reply('No se pudieron obtener los datos de ranked.')
        }

        const rankedData = await rankedRes.json()
        const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5')

        if (soloQueue) {
          const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`

          // Asignar rol según el tier
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
          if (!guild || !member) {
            return buttonInteraction.reply(`${gameName} está en ${rankText}, pero no se pudo asignar el rol.`)
          }

          const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
          if (!role) {
            return buttonInteraction.reply(`${gameName} está en ${rankText}, pero el rol "${roleName}" no existe en este servidor.`)
          }

          // Eliminar roles de tiers anteriores
          const allRankRoles = Object.values(tierMap)
          await member.roles.remove(member.roles.cache.filter(r => allRankRoles.includes(r.name)))

          // Asignar el nuevo rol
          await member.roles.add(role)

          await buttonInteraction.reply(`${gameName} está en ${rankText}. Rol "${role.name}" asignado.`)
        } else {
          await buttonInteraction.reply(`${gameName} no tiene partidas clasificadas.`)
        }
      })
      
      collector?.on('end', () => {
        interaction.followUp('Tiempo de confirmación expirado. Intenta de nuevo si no has cambiado el icono.')
      })
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
