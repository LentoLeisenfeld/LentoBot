import { Client, GatewayIntentBits } from 'discord.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fillTemplate } from './template';

export interface StartBotOptions {
  commandsDir: string;
  envPath?: string; // Optional: anderer Pfad zur .env
}

export async function runLentoBot(options: StartBotOptions) {
  if (options.envPath) {
    require('dotenv').config({ path: options.envPath });
  } else {
    require('dotenv').config();
  }

  const commandFiles = fs.readdirSync(options.commandsDir).filter(f => f.endsWith('.json'));
  const commands = commandFiles.map(f => ({
    ...JSON.parse(fs.readFileSync(path.join(options.commandsDir, f), 'utf8'))
  }));

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('ready', () => {
    console.log(`Bot ready as ${client.user?.tag}`);
    client.user?.setPresence({ status: 'online', activities: [{ name: 'LentoBot online', type: 0 }] });
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const cmd = commands.find(c => c.name === interaction.commandName);
    if (!cmd) return;

    const input: Record<string, any> = {};
    for (const field of (cmd.input || [])) {
      input[field.name] = interaction.options.getString(field.name);
    }

    const apiUrl = fillTemplate(cmd.api, input);
    const apiRes = await axios.get(apiUrl);
    const data = apiRes.data;

    if (cmd.output === 'embed') {
      const tpl = cmd.template;
      const embed: any = {
        title: fillTemplate(tpl.title, data),
        description: fillTemplate(tpl.description, data),
        fields: tpl.fields?.map((f: any) => ({
          name: f.name,
          value: fillTemplate(f.value, data),
          inline: true
        })),
      };
      if (tpl.image) embed.image = { url: fillTemplate(tpl.image, data) };
      await interaction.reply({ embeds: [embed] });
    } else {
      await interaction.reply(fillTemplate(cmd.template?.description || 'Keine Ausgabe', data));
    }
  });

  await client.login(process.env.DISCORD_TOKEN);
}
