import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
} from 'discord.js';

export default class RangoCommand {
  name = 'rango';
  description = 'Comando de prueba para verificar botones';

  getSlashCommandData() {
    return {
      name: this.name,
      description: this.description,
    };
  }

  async execute(interaction: CommandInteraction) {
    const botonVerificar = new MessageButton()
      .setCustomId('rango_boton')
      .setLabel('Verificar icono')
      .setStyle('PRIMARY');

    const row = new MessageActionRow().addComponents(botonVerificar);

    await interaction.reply({
      content: 'Haz clic en el botón para comenzar la verificación:',
      components: [row],
      ephemeral: true,
    });
  }
}
