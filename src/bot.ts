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

client.login(process.env.DISCORD_TOKEN)

// Agregar manejador de interacciones
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  // Manejo de botón de icono personalizado para verificación
  if (interaction.customId.startsWith('confirm-icon-')) {
    const parts = interaction.customId.split('-');
    const iconId = parts.pop();  // Nuevo nombre para el icono
    const puuid = parts.slice(2).join('-');  // El PUUID se reconstruye con los posibles guiones

    const riotToken = process.env.RIOT_TOKEN;

    if (!riotToken) {
      await interaction.reply({ content: 'Error: Riot API no configurada.', ephemeral: true });
      return;
    }

    const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
      headers: { 'X-Riot-Token': riotToken }
    });

    if (!summonerRes.ok) {
      const errorText = await summonerRes.text();
      console.error(`❌ Riot API error: Status ${summonerRes.status}, Message: ${errorText}`);
      await interaction.reply({ content: 'Error al obtener datos del invocador.', ephemeral: true });
      return;
    }
    

    const summonerData = await summonerRes.json();

    if (summonerData.profileIconId?.toString() === expectedIconId) {
      const role = interaction.guild?.roles.cache.get('1357361465966858372'); // Reemplaza con la ID real del rol
      const member = interaction.guild?.members.cache.get(interaction.user.id);

      if (role && member) {
        await member.roles.add(role);
        await interaction.reply({ content: '✅ ¡Icono verificado y rol asignado!', ephemeral: true });
      } else {
        await interaction.reply({ content: 'No se pudo asignar el rol.', ephemeral: true });
      }
    } else {
      await interaction.reply({ content: '❌ Tu icono actual no coincide. Asegúrate de haberlo cambiado correctamente.', ephemeral: true });
    }

    return;
  }

  switch (interaction.customId) {
    case 'button1':
      await interaction.reply({
        content: 'Por favor, escribe el nombre de usuario al cual le quieres añadir el rol.',
        ephemeral: true
      });

      const filter = (message: Message) => message.author.id === interaction.user.id;
      const collected = await interaction.channel?.awaitMessages({
        filter,
        max: 1,
        time: 15000,
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
