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
client.verifyStore = new Map<string, { puuid: string; iconId: number }>();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('confirm-')) {
    const verifyId = interaction.customId.split('-')[1];
    const entry = (client.verifyStore as Map<string, { puuid: string; iconId: number }>).get(verifyId);
    if (!entry) {
      await interaction.reply({ content: 'Verificación inválida o caducada.', ephemeral: true });
      return;
    }

    const { puuid, iconId } = entry;
    const riotToken = process.env.RIOT_TOKEN;
    const guild = interaction.guild;
    const member = guild?.members.cache.get(interaction.user.id);

    if (!riotToken || !guild || !member) {
      await interaction.reply({ content: 'Error de configuración o permisos.', ephemeral: true });
      return;
    }

    try {
      const summonerRes = await fetch(`https://${process.env.REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      });
      if (!summonerRes.ok) throw new Error('No se pudo obtener datos del invocador');
      const summonerData = await summonerRes.json();

      if (summonerData.profileIconId !== iconId) {
        await interaction.reply({ content: '❌ Tu icono actual no coincide.', ephemeral: true });
        return;
      }

      // Obtener datos de clasificatoria
      const rankedRes = await fetch(`https://${process.env.REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
        headers: { 'X-Riot-Token': riotToken }
      });
      const rankedData = await rankedRes.json();
      const soloQueue = rankedData.find((q: any) => q.queueType === 'RANKED_SOLO_5x5');

      if (!soloQueue) {
        await interaction.reply({ content: 'No se encontró información de clasificatoria soloQ.', ephemeral: true });
        return;
      }

      const tier = soloQueue.tier;
      const validEloRoles = process.env.RANKS ? JSON.parse(process.env.RANKS) : [
        'Iron','Bronze','Silver','Gold','Platinum','Emerald','Diamond','Master','Grandmaster','Challenger'
      ];

      // Eliminar roles anteriores de elo
      const rolesToRemove = member.roles.cache.filter(role => validEloRoles.includes(role.name));
      await member.roles.remove(rolesToRemove);

      // Asignar el nuevo rol
      const newRole = guild.roles.cache.find(r => r.name.toLowerCase() === tier.toLowerCase());
      if (newRole) {
        await member.roles.add(newRole);
        await interaction.reply({ content: `✅ Rol de **${tier}** asignado.`, ephemeral: true });
      } else {
        await interaction.reply({ content: `✅ Verificado. No se encontró rol para **${tier}**.`, ephemeral: true });
      }
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: 'Ocurrió un error durante la verificación.', ephemeral: true });
    }

    (client.verifyStore as Map<string, { puuid: string; iconId: number }>).delete(verifyId);
    return;
  }

  // ...otros botones existentes...
});

// Crear archivo players.json si no existe
if (!fs.existsSync('./players.json')) {
  fs.writeFileSync('./players.json', '{}')
}

const adapter = new FileSync('players.json')
const db = low(adapter)
db.defaults({ players: [] }).write()

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
