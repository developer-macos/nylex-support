/**
 * Super Full Discord Support Bot
 * Features:
 *  - Slash commands (setup, ticket, close)
 *  - Select menu for ticket category (pings correct staff)
 *  - Auto ticket channel creation in category
 *  - Custom status
 *  - Logging system
 *  - Simple ping & latency command
 *  - SQLite persistence ready (optional)
 */

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  Routes,
  REST,
  ChannelType,
} = require("discord.js");
const dotenv = require("dotenv");
dotenv.config();

// ====== CONFIGURATION ======
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional for dev mode
const SUPPORT_LOG_CHANNEL_ID = "1424062122060546229"; // logs tickets
const TICKET_CATEGORY_ID = "1424061970860216420"; // where tickets are created
const STAFF_ROLES = {
  billing: "1424058334709026866",
  technical: "1424057786899238922",
  general: "1424057979392757952",
};
const STATUS_TEXT = "Helping Users • /ticket";
const STATUS_TYPE = "Watching"; // Playing, Watching, Listening

// ====== CLIENT ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ====== COMMANDS ======
const commands = [
  new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Creates a ticket panel."),
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with bot latency."),
  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Closes the current ticket."),
].map((cmd) => cmd.toJSON());

// ====== REGISTER COMMANDS ======
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(
      GUILD_ID
        ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
        : Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Commands registered!");
  } catch (err) {
    console.error(err);
  }
})();

// ====== BOT READY ======
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: STATUS_TEXT, type: STATUS_TYPE }],
    status: "online",
  });
});

// ====== INTERACTIONS ======
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "ping") {
      const sent = await interaction.reply({
        content: "Pinging...",
        fetchReply: true,
      });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      await interaction.editReply(
        `🏓 Pong! Latency: ${latency}ms | API: ${client.ws.ping}ms`
      );
    }

   // /setup-tickets command
if (commandName === "setup-tickets") {
  const channel = interaction.options.getChannel("channel");

  const menu = new StringSelectMenuBuilder()
    .setCustomId("ticket-menu")
    .setPlaceholder("Select a ticket category...");

  for (const key in categories) {
    const cat = categories[key];
    menu.addOptions({
      label: cat.label,
      description: cat.description,
      value: key
    });
  }

  const row = new ActionRowBuilder().addComponents(menu);

  const embed = new EmbedBuilder()
    .setTitle("🎫 Welcome to Nylex Tech Support Center")
    .setDescription(
      "Welcome to Nylex Tech! Our team is here to help with any issues related to our products and services. " +
      "Whether you are experiencing problems with a purchased system, looking for a custom request, need assistance with payments, " +
      "or want to report a bug, we are committed to providing you the best support as quickly as possible.\n\n" +
      "Choose the type of ticket you need from the dropdown menu below. Each ticket will create a private channel for you " +
      "where our support team can communicate with you directly. Please be as detailed as possible when describing your issue to help us assist you efficiently.\n\n" +
      "Thank you for trusting Nylex Tech. Your satisfaction is our priority."
    )
    .setColor("Blue");

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Ticket panel sent in ${channel}`, ephemeral: true });
}


    if (interaction.commandName === "close") {
      if (!interaction.channel.name.startsWith("ticket-"))
        return interaction.reply({
          content: "❌ This is not a ticket channel!",
          ephemeral: true,
        });

      await interaction.reply("🗑 Closing this ticket in 5 seconds...");
      setTimeout(async () => {
        await interaction.channel.delete().catch(() => null);
      }, 5000);
    }
  }

  // ====== TICKET MENU ======
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === "ticket_select"
  ) {
    const category = interaction.values[0];
    const roleToPing = STAFF_ROLES[category];
    const user = interaction.user;

    const channelName = `ticket-${user.username.toLowerCase()}`;
    const existing = interaction.guild.channels.cache.find(
      (ch) => ch.name === channelName
    );
    if (existing)
      return interaction.reply({
        content: `❌ You already have an open ticket: ${existing}`,
        ephemeral: true,
      });

    const channel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
        {
          id: roleToPing,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle("🎫 New Ticket")
      .setDescription(
        `Hi ${user}, please describe your issue below. Our <@&${roleToPing}> team will assist you soon!`
      )
      .setColor("Green");

    await channel.send({
      content: `<@${user.id}> <@&${roleToPing}>`,
      embeds: [embed],
    });
    await interaction.reply({
      content: `✅ Ticket created: ${channel}`,
      ephemeral: true,
    });

    const logChannel = interaction.guild.channels.cache.get(
      SUPPORT_LOG_CHANNEL_ID
    );
    if (logChannel) {
      logChannel.send(
        `🆕 **Ticket Created:** ${channel} by ${user.tag} (${category})`
      );
    }
  }
});

client.login(TOKEN);
