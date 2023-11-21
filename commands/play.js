const axios = require('axios');
const util = require('util');
const stream = require('stream');
const pipeline = util.promisify(stream.pipeline);
const { join } = require('node:path');
const { createWriteStream } = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, AudioPlayerStatus, createAudioResource } = require('@discordjs/voice');
const replies = require('../assets/json/locale.json');

function getCommand() {
    const command = new SlashCommandBuilder();
    command.setName('play');
    command.setDescription('Plays a sound from myinstant.com');
    command.setDescriptionLocalizations({
        'pt-BR': 'Toca um audio do myinstant.com',
    });
    command.addStringOption(option =>
        option.setName('sound')
        .setAutocomplete(true)
        .setRequired(true)
        .setDescription('Type to find the audio you want to play')
        .setDescriptionLocalizations({
            'pt-BR': 'Digite para encontrar o audio que deseja tocar',
        }),
    );
    return command;
}

async function autocomplete(interaction) {
    let focusedValue = interaction.options.getFocused().toLowerCase();
    if (!focusedValue) focusedValue = '';

    const searchResult = await searchSound(focusedValue);
    if (!searchResult) return;

    const choices = getChoices(searchResult);
    if (!choices) return;

    await interaction.respond(choices);
}

async function execute(interaction) {
    const connection = enterMemberChannel(interaction);
    if (!connection) return interaction.reply(replies.userNotInChannel[interaction.locale] ?? 'You need to be in a voice channel to use this command.');

    const slug = interaction.options.getString('sound');
    if (!slug) return interaction.reply(replies.soundNotSelected[interaction.locale] ?? 'The sound was not selected from the list');

    const searchResult = await searchDetailSound(slug);
    if (!searchResult) return interaction.reply(replies.soundNotFound[interaction.locale] ?? 'Sound not found');

    const filePath = await downloadSound(searchResult);
    if (!filePath) return interaction.reply(replies.downloadSoundError[interaction.locale] ?? 'Unable to download the sound');

    const isPlayed = playSound(connection, filePath);
    if (!isPlayed) return interaction.reply(replies.playSoundError[interaction.locale] ?? 'Unable to play the sound');

    sendSuccessReply(interaction, searchResult);
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

async function searchSound(searchText) {
    try {
        const result = await axios({
            method: 'get',
            url: `https://www.myinstants.com/api/v1/instants/?format=json&page=1&name=${searchText}`,
        });

        return result.data;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}

function getChoices(soundData) {
    let choices = soundData.results;

    choices = choices.map(choice =>
        ({ name: choice.name, value: choice.slug }),
    );

    return choices;
}

async function searchDetailSound(searchText) {
    try {
        const result = await axios({
            method: 'get',
            url: `https://www.myinstants.com/api/v1/instants/${searchText}/?format=json`,
        });

        return result.data;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}

async function downloadSound(searchResult) {
    const url = searchResult.sound;
    const pathToSave = join(__dirname, '..', 'assets', 'sounds');
    const fileName = searchResult.sound.replace('http://www.myinstants.com/media/sounds/', '');

    try {
        const result = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
        });

        await pipeline(result.data, createWriteStream(join(pathToSave, fileName)));
        return join(pathToSave, fileName);
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

async function sendSuccessReply(interaction, soundInfo) {
    const play = new ButtonBuilder()
			.setCustomId(soundInfo.sound)
            .setLabel('Replay')
			.setEmoji('🔄')
            .setStyle(ButtonStyle.Secondary);

    const stop = new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('Stop')
            .setEmoji('⏹️')
            .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder()
        .addComponents(play, stop);

    await interaction.reply({
        content: `${replies.playing[interaction.locale] ?? 'Playing'} ${soundInfo.name}`,
        components: [row],
    });
}

module.exports = {
    data: getCommand(),
    autocomplete,
    execute,
};
