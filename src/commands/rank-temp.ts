import { CommandInteraction, MessageActionRow, MessageButton, MessageEmbed, Interaction } from 'discord.js';
import { Config } from '../interfaces/config.interface.js';
import { I18n } from 'i18n';
import fetch from 'node-fetch';
import { CommandInterface } from '../interfaces/command.interface.js';

export default class RankTempCommand extends CommandInterface<CommandInteraction> {
  config: Config;
  i18n: I18n;

  constructor(config: Config, i18n: I18n) {
    super('rank-temp'); // nombre del comando
    this.config = config;
    this.i18n = i18n;
  }

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner');
    console.log('User input:', userInput);

    const riotToken = process.env.RIOT_TOKEN;
    if (!riotToken) {
      console.error('Falta el token de Riot. Asegúrate de que RIOT_TOKEN esté definido.');
      return interaction.reply('Error interno: Riot API token no configurado.');
    }

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)');
    }

    const [rawName, tagLine] = userInput.split('/');
    const gameName = `${rawName.trim()}/${tagLine.trim()}`;

    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`;

    try {
      // 1. Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken }
      });
      if (!puuidRes.ok) {
        console.error(`Error al obtener PUUID: ${puuidRes.status} ${puuidRes.statusText}`);
        return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?');
      }

      const puuidData = await puuidRes.json();
      if (!puuidData.puuid) {
        console.error('Error: PUUID not found', puuidData);
        return interaction.reply('No se pudo encontrar el PUUID para el invocador proporcionado.');
      }

      // 2. Obtener Summoner ID
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      });
      if (!summonerRes.ok) {
        console.error(`Error al obtener Summoner ID: ${summonerRes.status}`);
        return interaction.reply('No se pudo obtener el ID del invocador.');
      }

      const summonerData = await summonerRes.json();
      if (!summonerData.id) {
        return interaction.reply('No se pudo obtener el ID del invocador.');
      }

      // 3. Obtener Ranked Data
      const rankedRes = await fetch(`https://euw1.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerData.id}`, {
        headers: { 'X-Riot-Token': riotToken }
      });
      if (!rankedRes.ok) {
        console.error(`Error al obtener datos de ranked: ${rankedRes.status}`);
        return interaction.reply('No se pudieron obtener los datos de ranked.');
      }

      const rankedData = await rankedRes.json();
      const soloQueue = rankedData.find((entry: any) => entry.queueType === 'RANKED_SOLO_5x5');

      if (soloQueue) {
        const rankText = `${soloQueue.tier} ${soloQueue.rank} - ${soloQueue.leaguePoints} LP`;

        // Generar un icono aleatorio dentro del rango de iconos básicos (1 a 29)
        const basicIcons = Array.from({ length: 29 }, (_, i) => i + 1);
        let randomIcon: number;
        do {
          randomIcon = basicIcons[Math.floor(Math.random() * basicIcons.length)];
        } while (parseInt(summonerData.profileIconId) === randomIcon);

        // URL de la imagen
        const iconUrl = `http://ddragon.leagueoflegends.com/cdn/13.6.1/img/profileicon/${randomIcon}.png`;

        // Verificar que la URL es válida
        try {
          const imageRes = await fetch(iconUrl);
          if (!imageRes.ok) {
            throw new Error('Imagen no válida o no accesible');
          }
        } catch (err) {
          console.error('Error al verificar la imagen:', err);
          return interaction.reply('Hubo un problema al verificar la imagen del icono. Intenta de nuevo más tarde.');
        }

        // Crear el embed con la URL del icono verificado
        const embed = new MessageEmbed()
          .setTitle('Verificación de icono de invocador')
          .setDescription('Cambia tu icono al que se muestra arriba y pulsa el botón.')
          .setImage(iconUrl);

        const row = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId(`confirm-icon-${puuidData.puuid}-${randomIcon}`)
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

    const customId = interaction.customId.split('-');
    if (customId[0] !== 'confirm-icon') return;

    const puuid = customId[1];
    const iconId = customId[2];

    const riotToken = process.env.RIOT_TOKEN;
    if (!riotToken) {
      return interaction.reply('Error interno: Riot API token no configurado.');
    }

    try {
      const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, {
        headers: { 'X-Riot-Token': riotToken }
      });
      if (!summonerRes.ok) {
        console.error(`Error al obtener datos del invocador: ${summonerRes.status}`);
        return interaction.reply('Error al obtener datos del invocador.');
      }

      const summonerData = await summonerRes.json();
      if (summonerData.profileIconId === parseInt(iconId)) {
        await interaction.reply('¡Icono confirmado correctamente!');
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
          required: true
        }
      ]
    };
  }
}
