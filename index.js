const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');

require('dotenv').config();
const { TOKEN } = process.env;

const fs = require('node:fs');
const path = require('node:path');
const commandsPath = path.join(__dirname, 'commands');
const commandsFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const replies = require('./assets/json/locale.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();

for (const file of commandsFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
    else {
        console.log(`Esse comando em ${filePath} está com "data" ou "execute ausentes"`);
    }
}

// Login
client.once(Events.ClientReady, c => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});
client.login(TOKEN);

// Listener de interações com o bot
client.on(Events.InteractionCreate, async interaction => {
    try {
        const commandName = interaction.commandName || interaction.component.label.toLowerCase();
        const command = interaction.client.commands.get(commandName);
        if (!command) {
            console.error('Comando não encontrado');
            await interaction.reply(replies.commandNotFound[interaction.locale] ?? 'Command not found');
            return;
        }

        if (interaction.isAutocomplete()) await command.autocomplete(interaction);
        if (interaction.isChatInputCommand()) await command.execute(interaction);
        if (interaction.isButton()) await command.execute(interaction);
    }
    catch (error) {
        console.error(error);
        await interaction.reply(replies.commandGenericError[interaction.locale] ?? 'Error trying executing this command');
    }
});