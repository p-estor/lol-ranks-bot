// Asegúrate de que esto esté arriba con tus imports
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder } from 'discord.js';
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
    const riotToken = process.env.RIOT_TOKEN;
    const region = 'europe';

    if (!riotToken) return interaction.reply('Error interno: Riot API token no configurado.');
    if (!userInput || !userInput.includes('/')) return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)');

    const [rawName, tagLine] = userInput.split('/');
    const gameName = `${rawName.trim()}/${tagLine.trim()}`;

    // Obtener PUUID
    const accountUrl = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${rawName.trim()}/${tagLine.trim()}`;
    const accountRes = await fetch(accountUrl, { headers: { 'X-Riot-Token': riotToken } });

    if (!accountRes.ok) return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?');

    const accountData = await accountRes.json();
    const puuid = accountData.puuid;

    // Obtener datos del invocador (incluido icono)
    const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
      headers: { 'X-Riot-Token': riotToken }
    });
    const summonerData = await summonerRes.json();
    const summonerId = summonerData.id;

    // ICONO ALEATORIO ENTRE LOS BÁSICOS
    const randomIconId = Math.floor(Math.random() * 28) + 0; // del 0 al 27
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${randomIconId}.png`;

    const embed = new EmbedBuilder()
      .setTitle('Verificación de icono')
      .setDescription(`Cambia tu icono en League of Legends por este y presiona el botón para confirmar.`)
      .setImage(iconUrl)
      .setColor('#0099ff');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm-icon-${puuid}-${randomIconId}`)
        .setLabel('✅ Ya lo he cambiado')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
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
    };
  }
}
