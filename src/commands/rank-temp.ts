import { CommandInteraction, MessageActionRow, MessageButton, MessageEmbed, Interaction } from 'discord.js';
import { Config } from '../interfaces/config.interface.js';
import { I18n } from 'i18n';
import fetch from 'node-fetch';
import { CommandInterface } from '../interfaces/command.interface.js';

export default class RankTempCommand extends CommandInterface<CommandInteraction> {
  config: Config;
  i18n: I18n;

  constructor(config: Config, i18n: I18n) {
    super('rank-temp');
    this.config = config;
    this.i18n = i18n;
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner');
    console.log('User input:', userInput);

    const riotToken = process.env.RIOT_TOKEN;
    if (!riotToken) {
      console.error('Falta el token de Riot.');
      return interaction.reply('Error interno: Riot API token no configurado.');
    }

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)');
    }

    const [rawName, tagLine] = userInput.split('/');
    const gameName = `${rawName.trim()}/${tagLine.trim()}`;
    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`;

    try {
      const puuidRes = await fetch(url, { headers: { 'X-Riot-Token': riotToken } });
      if (!puuidRes.ok) {
        console.error(`Error al obtener PUUID: ${puuidRes.status}`);
        return interaction.reply('No se pudo encontrar el invocador.');
      }

      const puuidData = await puuidRes.json();
      const summonerRes = await fetch(
        `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`,
        { headers: { 'X-Riot-Token': riotToken } }
      );
      const summonerData = await summonerRes.json();

      const rankedRes = await fetch(
        `https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`,
        { headers: { 'X-Riot-Token': riotToken } }
      );
      const rankedData = await rankedRes.json();
      const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5');

      if (soloQueue) {
        const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`;

        const riotTier = soloQueue.tier.toLowerCase();
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
          challenger: 'Retador',
        };

        const roleName = tierMap[riotTier];
        const guild = interaction.guild;
        const member = await guild?.members.fetch(interaction.user.id);
        if (!guild || !member) {
          return interaction.reply(`${gameName} está en ${rankText}, pero no se pudo asignar el rol.`);
        }

        const iconId = summonerData.profileIconId;
        const basicIcons = Array.from({ length: 29 }, (_, i) => i + 1);
        let randomIcon: number;
        do {
          randomIcon = basicIcons[Math.floor(Math.random() * basicIcons.length)];
        } while (parseInt(iconId) === randomIcon);

        const iconUrl = `http://ddragon.leagueoflegends.com/cdn/13.6.1/img/profileicon/${randomIcon}.png`;

        const embed = new MessageEmbed()
          .setTitle('Verificación de icono de invocador')
          .setDescription('Cambia tu icono al que se muestra arriba y pulsa el botón.')
          .setImage(iconUrl);

        const row = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`confirm-icon-${puuidData.puuid}-${randomIcon}-${roleName}`)
            .setLabel('✅ Ya lo he cambiado')
            .setStyle('PRIMARY')
        );

        await interaction.reply({
          content: `${gameName} está en ${rankText}. Se requiere que cambies tu icono.`,
          embeds: [embed],
          components: [row]
        });
      } else {
        await interaction.reply(`${gameName} no tiene partidas clasificadas.`);
      }
    } catch (error) {
      console.error('Error:', error);
      await interaction.reply('Error obteniendo el rango del jugador.');
    }
  }

  async handleButtonInteraction(interaction: Interaction) {
    if (!interaction.isButton()) return;

    const [_, puuid, iconId, roleName] = interaction.customId.split('-');
    const riotToken = process.env.RIOT_TOKEN;
    if (!riotToken) {
      return interaction.reply('Error interno: Riot API token no configurado.');
    }

    try {
      const summonerRes = await fetch(
        `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        { headers: { 'X-Riot-Token': riotToken } }
      );
      const summonerData = await summonerRes.json();

      if (summonerData.profileIconId === parseInt(iconId)) {
        const guild = interaction.guild;
        const member = await guild?.members.fetch(interaction.user.id);
        if (!guild || !member) {
          return interaction.reply(`No se pudo asignar el rol.`);
        }

        const allTiers = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'gran maestro', 'retador'];
        const rolesToRemove = member.roles.cache.filter(role =>
          allTiers.includes(role.name.toLowerCase())
        );

        await member.roles.remove(rolesToRemove);

        const role = guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
        if (role) {
          await member.roles.add(role);
          return interaction.reply(`Rol "${role.name}" asignado correctamente.`);
        } else {
          return interaction.reply(`Rol correspondiente a "${roleName}" no encontrado.`);
        }
      } else {
        await interaction.reply('El icono no coincide. Asegúrate de que lo hayas cambiado.');
      }
    } catch (error) {
      console.error('Error al verificar el icono:', error);
      await interaction.reply('Hubo un error al verificar el icono.');
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
          required: true,
        },
      ],
    };
  }
}
