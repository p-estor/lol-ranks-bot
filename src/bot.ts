import { Client, Collection, Intents, Message } from 'discord.js'
import 'dotenv/config'
import low from 'lowdb'
import Bottleneck from 'bottleneck'
import FileSync from 'lowdb/adapters/FileSync.js'
import i18n from 'i18n'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Events } from './events.js'
import { DbUpgrader } from './db-upgrader.js'
import ConfigValidator from './config-validator.js'
import VerifyImageCommand from './commands/verify-image.js'



const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Configurar i18n
i18n.configure({
  defaultLocale: process.env.LANGUAGE || 'en',
  locales: ['en', 'de', 'pt', 'es', 'ru'],
  directory: path.join(__dirname, '../locales'),
  register: global
})

// Límite de peticiones a la API de Riot
const limiter = new Bottleneck({
  maxConcurrent: parseInt(process.env.CONCURRENT_REQUESTS || '5'),
  minTime: parseInt(process.env.REQUEST_TIME || '1000')
})

// Configurar cliente de Discord
const client: Client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MEMBERS
  ]
})

client.commands = new Collection()

// Registrar el comando verify-image
client.commands.set(
  'verify-image',
  new VerifyImageCommand(
    /* aquí tu Config y tu instancia de I18n, por ejemplo: */ 
    /* config */ {} as Config,
    /* i18n */ i18n
  )
)

client.login(process.env.DISCORD_TOKEN)

// Agregar manejador de interacciones
client.on('interactionCreate', async (interaction) => {

  if (interaction.isCommand()) {
    const cmd = client.commands.get(interaction.commandName)
    if (cmd) {
      return cmd.execute(interaction)
    }
  }
  

  if (!interaction.isButton()) return; // Asegurarse de que es una interacción de botón

  // Manejo para botones de verificación de icono
  if (interaction.customId.startsWith('verify_icon_')) {
    const [, iconId, puuid] = interaction.customId.split('_')

    try {
      const riotToken = process.env.RIOT_TOKEN
      const response = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
        headers: { 'X-Riot-Token': riotToken! }
      })

      if (!response.ok) {
        console.error(`Error al verificar icono: ${response.status}`)
        return interaction.reply({ content: 'No se pudo verificar tu icono.', ephemeral: true })
      }

      const summonerData = await response.json()
      if (summonerData.profileIconId?.toString() === iconId) {
        return interaction.reply({ content: '✅ ¡Icono verificado correctamente!', ephemeral: true })
      } else {
        return interaction.reply({
          content: `❌ Tu icono actual es el ${summonerData.profileIconId}, no el ${iconId}.`,
          ephemeral: true
        })
      }

    } catch (err) {
      console.error('Error al verificar el icono:', err)
      return interaction.reply({ content: 'Ocurrió un error al verificar tu icono.', ephemeral: true })
    }
    return
  }

  switch (interaction.customId) {
    case 'button1':
      await interaction.reply({
        content: 'Por favor, escribe el nombre de usuario al cual le quieres añadir el rol.',
        ephemeral: true // Respuesta solo visible para el usuario que presionó el botón
      });

      // Esperar la respuesta del usuario
      const filter = (message: Message) => message.author.id === interaction.user.id;
      const collected = await interaction.channel?.awaitMessages({
        filter,
        max: 1,
        time: 15000, // Esperar 15 segundos por la respuesta
        errors: ['time'],
      });

      if (!collected) {
        await interaction.followUp({ content: 'No se recibió ningún nombre de usuario a tiempo.' });
        return;
      }

      const username = collected.first()?.content;
      const member = interaction.guild?.members.cache.find(m => m.user.username === username);
      if (member) {
        const role = interaction.guild?.roles.cache.get('1357361465966858372'); // Reemplazar por la ID real del rol
        if (role) {
          await member.roles.add(role);
          await interaction.followUp({ content: `Rol añadido a ${username}!` });
        } else {
          await interaction.followUp({ content: 'No se encontró el rol.' });
        }
      } else {
        await interaction.followUp({ content: 'No se encontró el usuario.' });
      }
      break;
    case 'button2':
      await interaction.reply({ content: 'Botón 2 presionado' });
      break;
    case 'button3':
      await interaction.reply({ content: 'Botón 3 presionado' });
      break;
    default:
      await interaction.reply({ content: 'Acción desconocida' });
  }
});


// Crear archivo players.json si no existe
if (!fs.existsSync('./players.json')) {
  fs.writeFileSync('./players.json', '{}')
}

// Inicializar lowdb
const adapter = new FileSync('players.json')
const db = low(adapter)
db.defaults({ players: [] }).write()

// Lógica principal
async function main() {
  const dbUpgrader = new DbUpgrader()
  await dbUpgrader.upgrade()

  try {
    const validator = new ConfigValidator({
      discordToken: process.env.DISCORD_TOKEN,
      language: process.env.LANGUAGE || 'en',
      concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '5'),
      requestTime: parseInt(process.env.REQUEST_TIME || '1000'),
      guildId: process.env.GUILD_ID,
      setVerifiedRole: process.env.SET_VERIFIED_ROLE === 'true',
      enableVerification: process.env.ENABLE_VERIFICATION === 'true',
      enableTierUpdateMessages: process.env.ENABLE_TIER_UPDATE_MESSAGES === 'true',
      riotToken: process.env.RIOT_TOKEN,
      status: process.env.STATUS || '',
      ranks: JSON.parse(process.env.RANKS || '["Iron","Bronze","Silver","Gold","Platinum","Emerald","Diamond","Master","Grandmaster","Challenger"]'),
      rankIconNames: JSON.parse(process.env.RANK_ICON_NAMES || '{}'),
      region: process.env.REGION || 'euw1',
      timeZone: process.env.TIMEZONE || 'Europe/Madrid',
      eloRoleLanguage: process.env.ELO_ROLE_LANGUAGE || 'en',
      verifiedRoleLanguage: process.env.VERIFIED_ROLE_LANGUAGE || 'en',
      enableCronJob: process.env.ENABLE_CRON_JOB === 'true',
      cronTab: process.env.CRON_TAB || '0 0 * * *',
      embedColor: process.env.EMBED_COLOR || '#0099ff'
    })
    await validator.validateConfig()
    console.log('✅ Configuration is valid!')
  } catch (error) {
    console.trace('❌ Configuration is invalid!', error)
    return
  }

  new Events(client, db, limiter, i18n, {
    discordToken: process.env.DISCORD_TOKEN,
    language: process.env.LANGUAGE || 'en',
    concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '5'),
    requestTime: parseInt(process.env.REQUEST_TIME || '1000'),
    guildId: process.env.GUILD_ID,
    setVerifiedRole: process.env.SET_VERIFIED_ROLE === 'true',
    enableVerification: process.env.ENABLE_VERIFICATION === 'true',
    enableTierUpdateMessages: process.env.ENABLE_TIER_UPDATE_MESSAGES === 'true',
    riotToken: process.env.RIOT_TOKEN,
    status: process.env.STATUS || '',
    ranks: JSON.parse(process.env.RANKS || '["Iron","Bronze","Silver","Gold","Platinum","Emerald","Diamond","Master","Grandmaster","Challenger"]'),
    rankIconNames: JSON.parse(process.env.RANK_ICON_NAMES || '{}'),
    region: process.env.REGION || 'euw1',
    timeZone: process.env.TIMEZONE || 'Europe/Madrid',
    eloRoleLanguage: process.env.ELO_ROLE_LANGUAGE || 'en',
    verifiedRoleLanguage: process.env.VERIFIED_ROLE_LANGUAGE || 'en',
    enableCronJob: process.env.ENABLE_CRON_JOB === 'true',
    cronTab: process.env.CRON_TAB || '0 0 * * *',
    embedColor: process.env.EMBED_COLOR || '#0099ff'
  })
}

await main()
