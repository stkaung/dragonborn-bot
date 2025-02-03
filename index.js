import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import noblox from "noblox.js";
import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

// Initialize Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf8")
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Initialize Discord bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register the slash commands
const commands = [
  {
    name: "logs",
    description: "Fetch logs from the specified user or group.",
    options: [
      {
        name: "type",
        description: "Specify user or group.",
        type: 3, // STRING type
        required: true,
        choices: [
          { name: "user", value: "user" },
          { name: "group", value: "group" },
        ],
      },
      {
        name: "username",
        description: "The Roblox username (for user type).",
        type: 3, // STRING type
        required: false,
      },
      {
        name: "group_id",
        description: "The Roblox group ID (for group type).",
        type: 3, // STRING type
        required: false,
      },
    ],
  },
  {
    name: "set-channel",
    description: "Set an announcement ",
    options: [
      {
        name: "type",
        description: "Specify type of channel (announcements).",
        type: 3, // STRING
        required: true,
        choices: [{ name: "announcements", value: "announcements" }],
      },
      {
        name: "channel",
        description: "Select the announcement channel.",
        type: 7, // CHANNEL
        required: true,
      },
    ],
  },
  {
    name: "announce",
    description:
      "Announce an action from the Firestore database by its Action ID.",
    options: [
      {
        name: "action_id",
        description: "The Action ID to announce.",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });
    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Error registering slash commands:", error);
  }
})();

// Start Roblox session with noblox.js
async function startNoblox() {
  try {
    await noblox.setCookie(process.env.ROBLOX_COOKIE); // Make sure the cookie is correct in your environment
    console.log("Successfully logged into Roblox!");
  } catch (error) {
    console.error("Failed to login to Roblox:", error);
  }
}

let announcementChannelId;

async function fetchAnnouncementChannel() {
  try {
    const doc = await db
      .collection("channels")
      .doc("announcement_channel")
      .get();
    if (doc.exists) {
      announcementChannelId = doc.data().id;
      console.log(`✅ Announcement channel set to: ${announcementChannelId}`);
    } else {
      console.log("⚠️ No announcement channel found in Firestore.");
    }
  } catch (error) {
    console.error(
      "❌ Error fetching announcement channel from Firestore:",
      error
    );
  }
}

async function announceAction(interaction) {
  const action_id = interaction.options.getString("action_id");

  // Ensure the announcement channel is set
  if (!announcementChannelId) {
    return interaction.reply({
      content:
        "⚠️ The announcement channel is not set. Please set it using /set-channel.",
      ephemeral: true,
    });
  }

  try {
    // Extract action type from action_id
    const actionType = action_id.split("-")[0];
    const validActionTypes = ["ban", "suspension", "blacklist"];

    // Check if the actionType is valid
    if (!validActionTypes.includes(actionType)) {
      return interaction.reply({
        content: `❌ Invalid Action ID format. Action type should be one of: ${validActionTypes.join(
          ", "
        )}`,
        ephemeral: true,
      });
    }

    // Set collection based on action type
    const collection = actionType + "s";

    // Query the corresponding collection
    const snapshot = await db
      .collection(collection)
      .where("action_id", "==", action_id)
      .get();

    if (!snapshot.empty) {
      // Action found, process the result
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Fetch Roblox username or group name
        let robloxData;
        if (collection === "blacklists") {
          robloxData = await noblox.getGroup(data.roblox_id);
        } else {
          robloxData = await noblox.getUsernameFromId(data.roblox_id);
        }

        // Create an embed based on the collection type
        let embed;
        if (collection === "bans") {
          embed = new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle("Ban Announcement")
            .setDescription(
              `User **${robloxData}** has been banned as ${
                data.category === "degenerate" ? "a" : "an"
              } **${data.category}** for "**${
                data.reason
              }**" on **${data.issued_date
                .toDate()
                .toLocaleString()}** by the **${data.issued_by}**.`
            )
            .addFields({ name: "Action ID", value: action_id });
        } else if (collection === "suspensions") {
          embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setTitle("Suspension Announcement")
            .setDescription(
              `User **${robloxData}** has been suspended for **${
                data.duration
              } days** on **${data.issued_date
                .toDate()
                .toLocaleString()}** as ${
                data.category === "degenerate" ? "a" : "an"
              } **${data.category}** for "**${data.reason}**" by the **${
                data.issued_by
              }**.`
            )
            .addFields({ name: "Action ID", value: action_id });
        } else if (collection === "blacklists") {
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle("Blacklist Announcement")
            .setDescription(
              `The group **${
                robloxData.name
              }** has been blacklisted on **${data.issued_date
                .toDate()
                .toLocaleString()}** as ${
                data.category === "degenerate" ? "a" : "an"
              } **${data.category}** for "**${data.reason}**" by the **${
                data.issued_by
              }**.`
            )
            .addFields({ name: "Action ID", value: action_id });
        }

        // Send the embed to the announcement channel
        const channel = await client.channels.fetch(announcementChannelId);
        await channel.send({ embeds: [embed] });
      }
    } else {
      return interaction.reply({
        content: `❌ No document found with Action ID: ${action_id}`,
        ephemeral: true,
      });
    }

    interaction.reply({
      content: `✅ Announcement for Action ID: ${action_id} has been posted.`,
      flags: 64,
    });
  } catch (error) {
    console.error("Error announcing action:", error);
    interaction.reply({
      content: "❌ An error occurred while processing the announcement.",
      ephemeral: true,
    });
  }
}

// Fetch user-related logs (bans, suspensions)
async function getUserLogs(username) {
  const id = await noblox.getIdFromUsername(username);
  if (!id) {
    console.error("Could not find Roblox ID for username:", username);
    return []; // exit if ID can't be fetched
  }

  const logsData = [];
  try {
    // Fetch bans
    const bansSnapshot = await db.collection("bans").get();
    bansSnapshot.forEach((doc) => {
      const banData = doc.data();
      if (banData.roblox_id == id) {
        logsData.push({
          ...banData,
          action_type: "Ban",
          action_id: banData.action_id,
          issued_date: banData.issued_date,
        });
      }
    });

    // Fetch suspensions
    const suspensionsSnapshot = await db.collection("suspensions").get();
    suspensionsSnapshot.forEach((doc) => {
      const suspensionData = doc.data();
      if (suspensionData.roblox_id == id) {
        logsData.push({
          ...suspensionData,
          action_type: "Suspension",
          action_id: suspensionData.action_id,
          issued_date: suspensionData.issued_date,
          duration: suspensionData.duration,
          end_date: suspensionData.end_date,
        });
      }
    });

    // Sort logs by issued_date (most recent first)
    logsData.sort((a, b) => b.issued_date.toDate() - a.issued_date.toDate());

    return logsData;
  } catch (error) {
    console.error("Error fetching user logs:", error);
    return [];
  }
}

// Fetch group-related logs (blacklists)
async function getGroupLogs(group_id) {
  const logsData = [];
  try {
    // Fetch blacklists
    const blacklistsSnapshot = await db.collection("blacklists").get();
    blacklistsSnapshot.forEach((doc) => {
      const blacklistData = doc.data();
      if (blacklistData.roblox_id == group_id) {
        logsData.push({
          ...blacklistData,
          action_type: "Blacklist",
          action_id: blacklistData.action_id,
          issued_date: blacklistData.issued_date,
        });
      }
    });

    // Sort logs by issued_date (most recent first)
    logsData.sort((a, b) => b.issued_date.toDate() - a.issued_date.toDate());
  } catch (error) {
    console.error("Error fetching group logs:", error);
  }
  return logsData;
}

// Create an embed for a log entry (ban, suspension, or blacklist)
async function createEmbedForLog(log, type) {
  let embed;
  const robloxData = await getRobloxData(log.roblox_id, type);

  if (type === "user") {
    if (log.action_type === "Ban") {
      embed = new EmbedBuilder()
        .setColor(0xff0000) // Red color
        .setTitle("Ban Information")
        .setThumbnail(robloxData.thumbnail) // Set user thumbnail
        .addFields(
          { name: "Action ID", value: log.action_id, inline: true },
          { name: "Roblox Username", value: robloxData.username, inline: true },
          { name: "Roblox ID", value: log.roblox_id, inline: true },
          { name: "Category", value: log.category, inline: true },
          { name: "Reason", value: log.reason, inline: false },
          { name: "Evidence", value: log.link || "N/A", inline: false },
          { name: "Issued By", value: log.issued_by, inline: true },
          {
            name: "Issued Date",
            value: log.issued_date.toDate().toLocaleString(),
            inline: true,
          }
        )
        .setFooter({
          text: `Ban details provided by Dragonborn Moderation`,
        });
    } else {
      embed = new EmbedBuilder()
        .setColor(0xff0000) // Red color
        .setTitle("Suspension Information")
        .setThumbnail(robloxData.thumbnail) // Set user thumbnail
        .addFields(
          { name: "Action ID", value: log.action_id, inline: true },
          { name: "Roblox Username", value: robloxData.username, inline: true },
          { name: "Roblox ID", value: log.roblox_id, inline: true },
          { name: "Duration", value: `${log.duration} days`, inline: true },
          {
            name: "End Date",
            value: log.end_date.toDate().toLocaleString(),
            inline: true,
          },
          { name: "Category", value: log.category, inline: true },
          { name: "Reason", value: log.reason, inline: false },
          { name: "Evidence", value: log.link || "N/A", inline: false },
          { name: "Issued By", value: log.issued_by, inline: true },
          {
            name: "Issued Date",
            value: log.issued_date.toDate().toLocaleString(),
            inline: true,
          }
        )
        .setFooter({
          text: `Suspension details provided by Dragonborn Moderation`,
        });
    }
  } else if (type === "group") {
    embed = new EmbedBuilder()
      .setColor(0xff0000) // Red color
      .setTitle("Blacklist Information")
      .addFields(
        { name: "Action ID", value: log.action_id, inline: true },
        { name: "Group Name", value: robloxData.groupName, inline: true },
        { name: "Group ID", value: log.roblox_id, inline: true },
        { name: "Category", value: log.category, inline: true },
        { name: "Reason", value: log.reason, inline: false },
        { name: "Evidence", value: log.link || "N/A", inline: false },
        { name: "Issued By", value: log.issued_by, inline: true },
        {
          name: "Issued Date",
          value: log.issued_date.toDate().toLocaleString(),
          inline: true,
        },
        {
          name: "Deep Blacklist",
          value: log.deep_blacklist ? "Yes" : "No",
          inline: true,
        },
        {
          name: "Additional Info",
          value: log.additional_info || "N/A",
          inline: false,
        }
      )
      .setFooter({
        text: "Blacklist details provided by Dragonborn Moderation",
      });
  }

  return embed;
}

// Fetch Roblox data (either user or group based on type)
async function getRobloxData(robloxId, type) {
  try {
    if (type === "user") {
      const username = await noblox.getUsernameFromId(robloxId);
      const userPFP = await noblox.getPlayerThumbnail(
        [robloxId],
        "720x720",
        "png",
        false,
        "body"
      );
      return { username, thumbnail: userPFP[0].imageUrl };
    } else if (type === "group") {
      const group = await noblox.getGroup(robloxId);
      const groupName = group.name;
      return { groupName }; // No thumbnail for groups
    }
  } catch (error) {
    console.error(`Error fetching Roblox data for ${type}:`, error);
    return { username: "N/A", thumbnail: "https://via.placeholder.com/720" }; // Fallback image
  }
}

// Handle interaction events
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "logs") {
    const { type, username, group_id } = interaction.options.data.reduce(
      (acc, option) => {
        acc[option.name] = option.value;
        return acc;
      },
      {}
    );

    try {
      if (type === "user") {
        if (!username) {
          await interaction.reply(
            'The username parameter is required when the type is "user".'
          );
          return;
        }
        if (group_id) {
          await interaction.reply(
            'You cannot enter a group ID when the type is "user".'
          );
          return;
        }
      }

      if (type === "group") {
        if (!group_id) {
          await interaction.reply(
            'The group ID parameter is required when the type is "group".'
          );
          return;
        }
        if (username) {
          await interaction.reply(
            'You cannot enter a username when the type is "group".'
          );
          return;
        }
      }

      await interaction.deferReply();

      let logsData = [];
      if (type === "user") {
        logsData = await getUserLogs(username);
      } else if (type === "group") {
        logsData = await getGroupLogs(group_id);
      }

      if (logsData.length === 0) {
        await interaction.followUp(
          "No logs found for the specified user/group."
        );
        return;
      }

      const embeds = [];
      for (const log of logsData) {
        const embed = await createEmbedForLog(log, type);
        embeds.push(embed);
      }

      await interaction.followUp({ embeds });
    } catch (error) {
      console.error("Error processing logs command:", error);
      await interaction.followUp("There was an error processing your request.");
    }
  }

  if (interaction.commandName === "set-channel") {
    const type = interaction.options.getString("type");
    const channel = interaction.options.getChannel("channel");

    if (channel.type !== ChannelType.GuildText) {
      return interaction.reply({
        content: "❌ Please select a text channel.",
        ephemeral: true,
      });
    }

    // Check bot permissions
    const botMember = await interaction.guild.members.fetch(client.user.id);
    const botPermissions = channel.permissionsFor(botMember);

    if (!botPermissions.has(PermissionFlagsBits.SendMessages)) {
      return interaction.reply({
        content: "I don't have permission to send messages in that channel.",
        ephemeral: true,
      });
    }

    if (!botPermissions.has(PermissionFlagsBits.ViewChannel)) {
      return interaction.reply({
        content: "I can't access that channel.",
        ephemeral: true,
      });
    }

    // Write to Firestore & update variable
    try {
      await db
        .collection("channels")
        .doc("announcement_channel")
        .set({ id: channel.id });
      announcementChannelId = channel.id; // Update variable
      await interaction.reply({
        content: `✅ The ${type} channel has been set to <#${channel.id}>.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Firestore error:", error);
      await interaction.reply({
        content: "❌ Failed to save to Firestore.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "announce") {
    await announceAction(interaction);
  }
});

client
  .login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log("Bot successfully logged into Discord!");
    startNoblox(); // Ensure noblox.js login happens after bot login
    fetchAnnouncementChannel();
  })
  .catch((error) => {
    console.error("Error logging into Discord:", error);
  });
