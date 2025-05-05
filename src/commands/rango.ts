import { CommandInteraction, MessageActionRow, MessageButton } from 'discord.js';

export default {
  name: 'rango',
  description: 'Comando de prueba para verificar botones',
  async execute(interaction: CommandInteraction) {
    const botonVerificar = new MessageButton()
      .setCustomId('rango_boton')
      .setLabel('Verificar icono')
      .setStyle('PRIMARY');

    const row = new MessageActionRow().addComponents(botonVerificar); // Esto solo funciona a partir de v13.3.0

    await interaction.reply({
      content: 'Haz clic en el botón para comenzar la verificación:',
      components: [row],
      ephemeral: true,
    });
  },
};
