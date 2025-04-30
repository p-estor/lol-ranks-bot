import { CommandInteraction, MessageActionRow, MessageButton } from 'discord.js';
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

  // El método execute debe ir aquí sin problemas.
  async execute(interaction: CommandInteraction) {
    // Lógica del comando
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
      // Código de procesamiento y respuesta aquí
    } catch (error) {
      console.error('Error:', error);
      await interaction.reply('Error obteniendo los datos del invocador.');
    }
  }

  // Aquí no falta ningún punto y coma, y el código está estructurado correctamente.

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
    };
  }
}
