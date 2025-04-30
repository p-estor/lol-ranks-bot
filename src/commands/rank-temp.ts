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

      // Verificar que el icono sea el correcto
      // (Puedes agregar un icono específico para la verificación, como un código de icono generado por el bot)
      const expectedIconId = 1234  // Aquí pon el ID del icono esperado (el icono que el bot generó)

      if (summonerIconId !== expectedIconId) {
        return interaction.reply('❌ Tu icono no coincide con el esperado. Cambia tu icono al proporcionado por el bot.')
      }

      // 4. Obtener Ranked Data
      const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
        headers: { 'X-Riot-Token': riotToken }
      })
      if (!rankedRes.ok) {
        console.error(`Error al obtener datos de ranked: ${rankedRes.status}`)
        return interaction.reply('No se pudieron obtener los datos de ranked.')
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
          return interaction.reply(`${gameName} está en ${rankText}, pero no se pudo asignar el rol.`)
        }

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
        if (!role) {
          return interaction.reply(`${gameName} está en ${rankText}, pero el rol "${roleName}" no existe en este servidor.`)
        }

        // Eliminar roles de tiers anteriores
        const allRankRoles = Object.values(tierMap)
        await member.roles.remove(member.roles.cache.filter(r => allRankRoles.includes(r.name)))

        // Asignar el nuevo rol
        await member.roles.add(role)

        await interaction.reply(`${gameName} está en ${rankText}. Rol "${role.name}" asignado.`)
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
