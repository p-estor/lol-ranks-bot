import { MessageActionRow, MessageButton } from 'discord.js'

import { CommandInterface } from '../interfaces/command.interface.js'
import { Config } from '../interfaces/config.interface.js'
import { I18n } from 'i18n'

export default class RangoCommand extends CommandInterface<CommandInteraction> {
  config: Config
  i18n: I18n

  constructor(config: Config, i18n: I18n) {
    super('rango')
    this.config = config
    this.i18n = i18n
  }

  async execute(interaction: CommandInteraction) {
    const button = new ButtonBuilder()
      .setCustomId('rango_boton')
      .setLabel('Haz clic aquí')
      .setStyle(ButtonStyle.Primary)

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button)

    await interaction.reply({
      content: 'Pulsa el botón para continuar:',
      components: [row]
    })
  }

  getSlashCommandData() {
    return {
      name: 'rango',
      description: 'Muestra un botón de prueba',
    }
  }
}
