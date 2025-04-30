import { Client, Collection, Intents, Message, MessageActionRow, MessageButton } from 'discord.js'
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
import { Command } from './commands/rank-temp.js'


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

// Registrar comando rank-temp
client.commands.set('rank-temp', new Command(client.config, i18n))

client.login(process.env.DISCORD_TOKEN)

// Agregar manejador de interacciones
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return; // Asegurarse de que es una interacción de botón

  switch (interaction.customId) {
    case 'verify_icon': // Este es el customId del botón
      await interaction.reply({
        content: '¡Gracias por presionar el botón para cambiar el icono!',
        ephemeral: true
      });
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
