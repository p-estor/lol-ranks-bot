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

      // Mostrar el icono actual del invocador
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/11.21.1/img/profileicon/${summonerData.profileIconId}.png`
      await interaction.reply({
        content: `¡Hola! Para verificar tu cuenta, por favor cambia tu icono de invocador al siguiente:\n\n`,
        embeds: [{
          title: 'Cambio de icono necesario',
          description: `Este es el icono que necesitas:\n\n`,
          image: {
            url: iconUrl
          },
          footer: { text: `ID del icono: ${summonerData.profileIconId}` }
        }]
      })

      // 3. Esperar a que el usuario cambie el icono y vuelva a ejecutar el comando
      const collector = interaction.channel?.createMessageCollector({
        filter: (message) => message.author.id === interaction.user.id,
        time: 60000, // Tiempo de espera de 1 minuto
        max: 1,
      })

      collector?.on('collect', async () => {
        // Verificar si el usuario cambió el icono correctamente
        const summonerDataAfterChange = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-id/${summonerData.id}`, {
          headers: { 'X-Riot-Token': riotToken }
        })
        const updatedSummonerData = await summonerDataAfterChange.json()

        if (updatedSummonerData.profileIconId === summonerData.profileIconId) {
          await interaction.reply('Aún no has cambiado el icono. Intenta de nuevo.')
        } else {
          // El icono ha cambiado, asignamos el rol
          const roleName = 'Tu rol de invocador'  // Ajusta el nombre del rol según tu necesidad
          const guild = interaction.guild
          const member = await guild?.members.fetch(interaction.user.id)
          if (!guild || !member) {
            return interaction.reply('No se pudo asignar el rol.')
          }

          const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
          if (!role) {
            return interaction.reply('El rol no existe en el servidor.')
          }

          // Asignar el rol
          await member.roles.add(role)
          await interaction.reply(`¡Icono cambiado correctamente! El rol "${role.name}" ha sido asignado.`)
        }
      })

    } catch (error) {
      console.error('Error:', error)
      await interaction.reply('Error obteniendo los datos del invocador.')
    }
  }

  getSlashCommandData() {
    return {
      name: 'rank-temp',
      description: 'Consulta el rango de un invocador (API temporal) y verifica el icono',
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
