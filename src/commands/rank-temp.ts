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
    // Diferir la respuesta para evitar que la interacción sea considerada ya respondida
    await interaction.deferReply();

    // Obtener PUUID
    const puuidRes = await fetch(url, {
      headers: { 'X-Riot-Token': riotToken }
    });
    if (!puuidRes.ok) {
      console.error(`Error al obtener PUUID: ${puuidRes.status} ${puuidRes.statusText}`);
      return interaction.editReply('No se pudo encontrar el invocador. ¿Nombre/Tag correctos?');
    }

    const puuidData = await puuidRes.json();
    if (!puuidData.puuid) {
      console.error('Error: PUUID not found', puuidData);
      return interaction.editReply('No se pudo encontrar el PUUID para el invocador proporcionado.');
    }

    // Obtener Summoner ID
    const summonerRes = await fetch(`https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuidData.puuid}`, {
      headers: { 'X-Riot-Token': riotToken }
    });
    if (!summonerRes.ok) {
      console.error(`Error al obtener Summoner ID: ${summonerRes.status}`);
      return interaction.editReply('No se pudo obtener el ID del invocador.');
    }

    const summonerData = await summonerRes.json();
    if (!summonerData.id) {
      return interaction.editReply('No se pudo obtener el ID del invocador.');
    }

    // Selección aleatoria de icono básico
    const basicIcons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const randomIconId = basicIcons[Math.floor(Math.random() * basicIcons.length)];
    const iconUrl = `https://ddragon.leagueoflegends.com/cdn/11.21.1/img/profileicon/${randomIconId}.png`;

    // Crear el botón interactivo
    const row = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId('verify_icon')
        .setLabel('He cambiado el icono')
        .setStyle('PRIMARY')
    );

    // Guardar la ID del icono en la memoria temporal del servidor
    const tempData = {
      gameName: gameName,
      randomIconId: randomIconId
    };
    this.storeTempData(interaction.user.id, tempData);

    await interaction.editReply({
      content: `¡Hola! Para verificar tu cuenta, por favor cambia tu icono de invocador al siguiente:\n\n`,
      embeds: [{
        title: 'Cambio de icono necesario',
        description: `Este es el icono que necesitas poner en tu cuenta:\n\n`,
        image: {
          url: iconUrl
        },
        footer: { text: `ID del icono: ${randomIconId}` }
      }],
      components: [row]
    });

  } catch (error) {
    console.error('Error:', error);
    await interaction.editReply('Error obteniendo los datos del invocador.');
  }
}
