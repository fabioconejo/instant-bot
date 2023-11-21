const axios = require('axios');
const util = require('util');
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);
const { join } = require('node:path');
const { createWriteStream, existsSync } = require('fs');
const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const replies = require('../assets/json/locale.json');

function getCommand() {
    const command = new SlashCommandBuilder();
    command.setName('replay');
    command.setDescription('This command only can be executed after call /play and clicking on 🔄');
    command.setDescriptionLocalizations({
        'pt-BR': 'Esse comando só pode ser executado após chamar /play e clicando em 🔄',
    });
    return command;
}

async function execute(interaction) {
    const connection = enterMemberChannel(interaction);
    if (!connection) return interaction.reply(replies.userNotInChannel[interaction.locale] ?? 'You need to be in a voice channel to use this command.');

    const filePath = await downloadSound(interaction.customId);
    if (!filePath) return interaction.reply(replies.downloadSoundError[interaction.locale] ?? 'Unable to download the sound');

    const isPlayed = playSound(connection, filePath);
    if (!isPlayed) return interaction.reply(replies.playSoundError[interaction.locale] ?? 'Unable to play the sound');

    interaction.deferUpdate();
}

function enterMemberChannel(interaction) {
    const channelId = interaction.member.voice.channelId;
    const guildId = interaction.guildId;
    const voiceAdapterCreator = interaction.guild.voiceAdapterCreator;

    if (!channelId) return null;

    return joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: voiceAdapterCreator,
    });
}

async function downloadSound(urlSound) {
    const url = urlSound;
    const pathToSave = join(__dirname, '..', 'assets', 'sounds');
    const fileName = urlSound.replace('http://www.myinstants.com/media/sounds/', '');
    const fileLocation = join(pathToSave, fileName);

    if (existsSync(fileLocation)) return fileLocation;

    try {
        const result = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
        });

        await pipeline(result.data, createWriteStream(fileLocation));
        return fileLocation;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}

function playSound(connection, filePath) {
    let result = false;
    const player = createAudioPlayer();
    const resource = createAudioResource(filePath);

    const subscription = connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Playing, () => {
        console.log(`Playing ${filePath}`);
    });

    player.on('error', (error) => {
        console.error(error);
    });

    if (subscription) {
        setTimeout(() => subscription.unsubscribe(), 120_000);
        result = true;
    }

    return result;
}

module.exports = {
    data: getCommand(),
    execute,
    hidden: true,
};
