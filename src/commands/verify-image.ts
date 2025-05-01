import { CommandInteraction, MessageActionRow, MessageButton, MessageAttachment } from 'discord.js';
import fetch from 'node-fetch';
import { Command } from 'commander'; // Si usas algún gestor de comandos

export default {
  data: new Command()
    .setName('verify-image')
    .setDescription('Verifica si el usuario ha cambiado su icono al sugerido por el bot.')
    .addStringOption(option => 
      option.setName('summoner')
        .setDescription('Nombre/Tag del invocador (ej. Kai/WEEBx)')
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    const userInput = interaction.options.getString('summoner');
    console.log('User input:', userInput);

    const riotToken = process.env.RIOT_TOKEN;
    if (!riotToken) {
      return interaction.reply('Error interno: Riot API token no configurado.');
    }

    if (!userInput || !userInput.includes('/')) {
      return interaction.reply('Formato incorrecto. Usa Nombre/Tag (ej. Kai/WEEBx)');
    }

    const [rawName, tagLine] = userInput.split('/');
    const gameName = `${rawName.trim()}/${tagLine.trim()}`;

    const url = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}`;

    try {
      // Obtener PUUID
      const puuidRes = await fetch(url, {
        headers: { 'X-Riot-Token': riotToken }
      });

      if (!puuidRes.ok) {
        return interaction.reply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?');
      }

      const puuidData = await puuidRes.json();
      if (!puuidData.puuid) {
        return interaction.reply('No se pudo encontrar el PUUID para el invocador proporcionado.');
      }

      // Obtener icono sugerido
      const iconId = Math.floor(Math.random() * 28) + 1; // 1 al 28
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/14.8.1/img/profileicon/${iconId}.png`;

      const shortPuuid = puuidData.puuid.slice(0, 8); // usar solo los primeros 8 caracteres
      const customId = `verify-${iconId}-${shortPuuid}`;
      
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(customId)
          .setLabel('✅ Confirmar icono')
          .setStyle('PRIMARY')
      );

      const imageBuffer = await fetch(iconUrl).then(res => res.buffer());
      const attachment = new MessageAttachment(imageBuffer, 'icon.png');

      await interaction.reply({
        content: `Cambia tu icono al siguiente y pulsa "Confirmar":`,
        files: [attachment],
        components: [row]
      });

    } catch (error) {
      console.error('Error:', error);
      await interaction.reply('Error obteniendo información del invocador.');
    }
  }
};
