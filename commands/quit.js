const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const replies = require('../assets/json/locale.json');

function getCommand() {
    const command = new SlashCommandBuilder();
    command.setName('quit');
    command.setDescription('Bot disconnect from channel');
    return command;
}

async function execute(interaction) {
    if (!interaction.member.voice.channelId) {
        return interaction.reply(replies.userNotInChannel[interaction.locale] ?? 'You need to be in a voice channel to use this command');
    }

    const connection = getVoiceConnection(interaction.member.voice.channel.guildId);
    if (!connection || (connection.joinConfig.channelId != interaction.member.voice.channelId)) {
        return interaction.reply(replies.botNotInChannel[interaction.locale] ?? 'Bot is not in this voice channel');
    }

    connection.destroy();
    interaction.reply(replies.quit[interaction.locale] ?? 'Bye!');
}

module.exports = {
    data: getCommand(),
    execute,
};
