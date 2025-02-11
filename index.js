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
import axios from "axios";
import * as cheerio from "cheerio";

const dragonbornGroupId = 4760223;

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
    description: "Set channels.",
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
  {
    name: "suspend",
    description: "Suspend a user from the group.",
    options: [
      {
        name: "username",
        description: "Roblox username to suspend.",
        type: 3, // STRING type
        required: true,
      },
      {
        name: "tier",
        description:
          "Suspension tier (1: 1mo, 2: 3mo, 3: 6mo, 4: 9mo, 5: 12mo)",
        type: 4, // INTEGER type
        required: true,
        choices: [
          { name: "Tier 1 - 1 Month", value: 1 },
          { name: "Tier 2 - 3 Months", value: 2 },
          { name: "Tier 3 - 6 Months", value: 3 },
          { name: "Tier 4 - 9 Months", value: 4 },
          { name: "Tier 5 - 12 Months", value: 5 },
        ],
      },
      {
        name: "category",
        description: "Reason category for the suspension.",
        type: 3,
        required: true,
        choices: [
          { name: "Degenerate", value: "degenerate" },
          { name: "Exploiter", value: "exploiter" },
        ],
      },
      {
        name: "reason",
        description: "Provide a reason for the suspension.",
        type: 3,
        required: true,
      },
      {
        name: "evidence",
        description: "Provide evidence (optional).",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "unsuspend",
    description: "Unsuspend a user from the Roblox group.",
    options: [
      {
        name: "username",
        description: "The Roblox username of the user to unsuspend.",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "ban",
    description: "Permanently bans a user from the group.",
    options: [
      {
        name: "username",
        description: "Roblox username to ban.",
        type: 3, // STRING type
        required: true,
      },
      {
        name: "category",
        description: "Reason category for the ban.",
        type: 3, // STRING type
        required: true,
        choices: [
          { name: "Degenerate", value: "degenerate" },
          { name: "Exploiter", value: "exploiter" },
        ],
      },
      {
        name: "reason",
        description: "Provide a reason for the ban.",
        type: 3, // STRING type
        required: true,
      },
      {
        name: "evidence",
        description: "Provide evidence (optional).",
        type: 3, // STRING type
        required: false,
      },
    ],
  },
  {
    name: "unban",
    description: "Unbans a user from the Roblox group.",
    options: [
      {
        name: "username",
        description: "The Roblox username of the user to unbanned.",
        type: 3, // STRING type
        required: true,
      },
    ],
  },
  {
    name: "blacklist",
    description: "Blacklist a group from the community.",
    options: [
      {
        name: "group_id",
        description: "The Roblox group ID to blacklist.",
        type: 4, // INTEGER type for group ID
        required: true,
      },
      {
        name: "category",
        description:
          "The category for the blacklist (e.g., 'Degenerate', 'Exploiter').",
        type: 3, // STRING type for category
        required: true,
        choices: [
          { name: "Degenerate", value: "degenerate" },
          { name: "Exploiter", value: "exploiter" },
        ],
      },
      {
        name: "reason",
        description: "The reason for blacklisting the group.",
        type: 3, // STRING type for reason
        required: true,
      },
      {
        name: "deep_blacklist",
        description: "Whether to apply a deep blacklist (true/false).",
        type: 5, // BOOLEAN type for deep_blacklist
        required: true,
      },
      {
        name: "additional_info",
        description: "Provide additional information for the blacklist.",
        type: 3, // STRING type for additional_info
        required: false,
      },
      {
        name: "evidence",
        description: "Provide evidence (optional).",
        type: 3, // STRING type for evidence
        required: false,
      },
    ],
  },
  {
    name: "unblacklist",
    description: "Remove a group from the blacklist.",
    options: [
      {
        name: "group_id",
        description: "The Roblox group ID to unblacklist.",
        type: 4, // INTEGER type for group ID
        required: true,
      },
    ],
  },
  {
    name: "blacklist-overview",
    description: "Get an overview of Dragonborn members in blacklisted groups.",
    options: [],
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

async function fetchGroupIconUrl(groupId) {
  const url = `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (
      data &&
      data.data &&
      data.data.length > 0 &&
      data.data[0].state === "Completed"
    ) {
      return data.data[0].imageUrl;
    } else {
      throw new Error("Group icon not found or still processing.");
    }
  } catch (error) {
    console.error("Error fetching group icon:", error);
    return null;
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
            .addFields({ name: "Action ID", value: action_id })
            .setFooter({
              text: `Announced by ${interaction.user.username}`,
              iconURL: interaction.user.avatarURL(),
            });
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
            .addFields({ name: "Action ID", value: action_id })
            .setFooter({
              text: `Announced by ${interaction.user.username}`,
              iconURL: interaction.user.avatarURL(),
            });
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
            .addFields({ name: "Action ID", value: action_id })
            .setFooter({
              text: `Announced by ${interaction.user.username}`,
              iconURL: interaction.user.avatarURL(),
            });
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
          {
            name: "Roblox Username",
            value: robloxData.username,
            inline: true,
          },
          { name: "Roblox ID", value: String(log.roblox_id), inline: true },
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
          text: `Brought to you by DB | Justice Panel`,
        });
    } else {
      embed = new EmbedBuilder()
        .setColor(0xff0000) // Red color
        .setTitle("Suspension Information")
        .setThumbnail(robloxData.thumbnail) // Set user thumbnail
        .addFields(
          { name: "Action ID", value: log.action_id, inline: true },
          { name: "Roblox Username", value: robloxData.username, inline: true },
          { name: "Roblox ID", value: String(log.roblox_id), inline: true },
          {
            name: "Tier",
            value: `Tier ${log.tier} (${log.duration_months} months)`,
            inline: true,
          },
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
          text: "Brought to you by DB | Justice Panel",
        });
    }
  } else if (type === "group") {
    const groupIcon = await fetchGroupIconUrl(
      log.roblox_id,
      robloxData.groupName
    );
    embed = new EmbedBuilder()
      .setColor(0xff0000) // Red color
      .setTitle("Blacklist Information")
      .setThumbnail(groupIcon)
      .addFields(
        { name: "Action ID", value: log.action_id, inline: true },
        { name: "Group Name", value: robloxData.groupName, inline: true },
        { name: "Group ID", value: String(log.roblox_id), inline: true },
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
        text: "Brought to you by DB | Justice Panel",
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

  if (!interaction.isCommand()) return;

  if (interaction.commandName === "suspend") {
    const options = interaction.options.data.reduce((acc, option) => {
      acc[option.name] = option.value;
      return acc;
    }, {});

    const { username, tier, category, reason, evidence } = options;

    // Check for required roles
    const modRoleId = "1335829172131594251";
    const execRoleId = "1335829226003366009";
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (
      !member.roles.cache.has(modRoleId) &&
      !member.roles.cache.has(execRoleId)
    ) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    // Convert tier to months
    const tierToMonths = {
      1: 1, // Tier 1: 1 month
      2: 3, // Tier 2: 3 months
      3: 6, // Tier 3: 6 months
      4: 9, // Tier 4: 9 months
      5: 12, // Tier 5: 12 months
    };

    const durationInMonths = tierToMonths[tier];

    if (!durationInMonths) {
      return interaction.reply({
        content: "❌ Invalid tier. Please select a tier between 1 and 5.",
        ephemeral: true,
      });
    }

    const issuedBy = member.roles.cache.has(modRoleId)
      ? "Moderation Department"
      : "Executive Department";

    try {
      await interaction.deferReply();

      const robloxId = await noblox
        .getIdFromUsername(username)
        .catch(() => null);
      if (!robloxId) {
        return interaction.followUp(
          "❌ The provided username does not exist on Roblox."
        );
      }

      const activeSuspensions = await db
        .collection("suspensions")
        .where("roblox_id", "==", robloxId)
        .get();
      const isCurrentlySuspended = activeSuspensions.docs.some(
        (doc) => doc.data().end_date.toDate() > new Date()
      );

      if (isCurrentlySuspended) {
        return interaction.followUp("❌ This user is already suspended.");
      }

      const thumbnails = await noblox.getPlayerThumbnail(
        [robloxId],
        420,
        "png",
        true
      );
      const avatarUrl =
        thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";

      const newActionId = await db.runTransaction(async (transaction) => {
        const suspensionsSnapshot = await transaction.get(
          db.collection("suspensions")
        );
        let maxNumber = 0;

        suspensionsSnapshot.forEach((doc) => {
          const match = doc.id.match(/^suspension-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });

        return `suspension-${maxNumber + 1}`;
      });

      const issuedDate = new Date();
      const endDate = new Date(issuedDate);
      endDate.setMonth(endDate.getMonth() + durationInMonths);

      const suspensionData = {
        action_id: newActionId,
        roblox_id: robloxId,
        tier: tier,
        duration_months: durationInMonths,
        category,
        reason,
        issued_by: issuedBy,
        issued_date: issuedDate,
        end_date: endDate,
        link: evidence || "No evidence provided",
      };

      await db.collection("suspensions").doc(newActionId).set(suspensionData);

      const successEmbed = new EmbedBuilder()
        .setTitle("Suspension Issued")
        .setColor(0xff0000)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: "Action ID", value: newActionId, inline: true },
          { name: "Roblox Username", value: username, inline: true },
          { name: "Roblox ID", value: robloxId.toString(), inline: true },
          {
            name: "Tier",
            value: `Tier ${tier} (${durationInMonths} months)`,
            inline: true,
          },
          { name: "End Date", value: endDate.toLocaleString(), inline: true },
          { name: "Category", value: category, inline: true },
          { name: "Reason", value: reason, inline: false },
          {
            name: "Evidence",
            value: evidence || "No evidence provided",
            inline: false,
          },
          { name: "Issued By", value: issuedBy, inline: true },
          {
            name: "Issued Date",
            value: issuedDate.toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Suspension issued by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error processing suspend command:", error);
      await interaction.followUp(
        "❌ There was an error processing the suspension."
      );
    }
  }

  if (interaction.commandName === "unsuspend") {
    const username = interaction.options.getString("username");

    try {
      // Check if the user has permission
      const member = interaction.guild.members.cache.get(interaction.user.id);
      const hasPermission =
        member.roles.cache.has("1335829172131594251") ||
        member.roles.cache.has("1335829226003366009");

      if (!hasPermission) {
        await interaction.reply({
          content: "❌ You do not have permission to run that command!",
          ephemeral: true,
        });
        return;
      }

      // Get Roblox ID from the username
      const userId = await noblox.getIdFromUsername(username);
      if (!userId) {
        await interaction.reply({
          content: `❌ The Roblox username ${username} does not exist.`,
          ephemeral: true,
        });
        return;
      }

      // Check if user is suspended in Firestore
      const suspensionsRef = db.collection("suspensions");
      const querySnapshot = await suspensionsRef
        .where("roblox_id", "==", userId)
        .where("end_date", ">", new Date())
        .get();

      if (querySnapshot.empty) {
        await interaction.reply({
          content: "❌ The user is not currently suspended.",
          ephemeral: true,
        });
        return;
      }

      // Remove suspension from Firestore
      const suspendedDoc = querySnapshot.docs[0];
      await suspendedDoc.ref.delete();

      // Send success message
      const userPFP = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ User Unsuspended")
        .setColor(0x00ff00)
        .setDescription(
          `User **${username}** has been successfully unsuspended.`
        )
        .setThumbnail(userPFP)
        .setFooter({
          text: `Unsuspended by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /unsuspend command:", error);

      const errorEmbed = new EmbedBuilder();
      await interaction.reply({
        content:
          "❌ An error occurred while processing the unsuspend command. Please try again later.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "ban") {
    const options = interaction.options.data.reduce((acc, option) => {
      acc[option.name] = option.value;
      return acc;
    }, {});

    const { username, category, reason, evidence } = options;
    const modRoleId = "1335829172131594251";
    const execRoleId = "1335829226003366009";
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (
      !member.roles.cache.has(modRoleId) &&
      !member.roles.cache.has(execRoleId)
    ) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const issuedBy = member.roles.cache.has(modRoleId)
      ? "Moderation Department"
      : "Executive Department";

    try {
      await interaction.deferReply();
      const robloxId = await noblox
        .getIdFromUsername(username)
        .catch(() => null);
      if (!robloxId) {
        return interaction.followUp(
          "❌ The provided username does not exist on Roblox."
        );
      }

      const activeBans = await db
        .collection("bans")
        .where("roblox_id", "==", robloxId)
        .get();
      if (!activeBans.empty) {
        return interaction.followUp("❌ This user is already banned.");
      }

      const thumbnails = await noblox.getPlayerThumbnail(
        [robloxId],
        420,
        "png",
        true
      );
      const avatarUrl =
        thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";
      const actionId = await db.runTransaction(async (transaction) => {
        const bansSnapshot = await transaction.get(db.collection("bans"));
        let maxNumber = 0;

        bansSnapshot.forEach((doc) => {
          const match = doc.id.match(/^ban-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });

        return `ban-${maxNumber + 1}`;
      });

      const banData = {
        action_id: actionId,
        roblox_id: robloxId,
        category,
        reason,
        issued_by: issuedBy,
        issued_date: new Date(),
        link: evidence || "No evidence provided",
      };

      await db.collection("bans").doc(actionId).set(banData);

      const successEmbed = new EmbedBuilder()
        .setTitle("User Banned")
        .setColor(0xff0000)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: "Action ID", value: actionId, inline: true },
          { name: "Roblox Username", value: username, inline: true },
          { name: "Roblox ID", value: robloxId.toString(), inline: true },
          { name: "Category", value: category, inline: true },
          { name: "Reason", value: reason, inline: false },
          {
            name: "Evidence",
            value: evidence || "No evidence provided",
            inline: false,
          },
          { name: "Issued By", value: issuedBy, inline: true },
          {
            name: "Issued Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Banned by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error processing ban command:", error);
      await interaction.followUp("❌ There was an error processing the ban.");
    }
  }

  if (interaction.commandName === "unban") {
    const username = interaction.options.getString("username");

    try {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasPermission =
        member.roles.cache.has("1335829172131594251") ||
        member.roles.cache.has("1335829226003366009");

      if (!hasPermission) {
        return interaction.reply({
          content: "❌ You do not have permission to run this command!",
          ephemeral: true,
        });
      }

      const userId = await noblox.getIdFromUsername(username);
      if (!userId) {
        return interaction.reply({
          content: `❌ The Roblox username ${username} does not exist.`,
          ephemeral: true,
        });
      }

      const bansRef = db.collection("bans");
      const querySnapshot = await bansRef
        .where("roblox_id", "==", userId)
        .get();

      if (querySnapshot.empty) {
        return interaction.reply({
          content: "❌ The user is not currently banned.",
          ephemeral: true,
        });
      }

      const batch = db.batch();
      querySnapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      const successEmbed = new EmbedBuilder()
        .setTitle("✅ User Unbanned")
        .setColor(0x00ff00)
        .setDescription(`User **${username}** has been successfully unbanned.`)
        .setFooter({
          text: `Unbanned by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.reply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /unban command:", error);
      await interaction.reply({
        content:
          "❌ An error occurred while processing the unban command. Please try again later.",
        ephemeral: true,
      });
    }
  }

  // /blacklist Command
  if (interaction.commandName === "blacklist") {
    const options = interaction.options.data.reduce((acc, option) => {
      acc[option.name] = option.value;
      return acc;
    }, {});

    const {
      group_id,
      category,
      reason,
      deep_blacklist,
      additional_info,
      evidence,
    } = options;

    const modRoleId = "1335829172131594251";
    const execRoleId = "1335829226003366009";
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (
      !member.roles.cache.has(modRoleId) &&
      !member.roles.cache.has(execRoleId)
    ) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    const issuedBy = member.roles.cache.has(modRoleId)
      ? "Moderation Department"
      : "Executive Department";

    try {
      await interaction.deferReply();

      // Check if the group exists on Roblox using the group_id
      const groupInfo = await noblox.getGroup(group_id).catch(() => null);
      if (!groupInfo) {
        return interaction.followUp(
          "❌ The provided group ID does not exist on Roblox."
        );
      }

      const existingBlacklist = await db
        .collection("blacklists")
        .where("roblox_id", "==", group_id)
        .get();
      if (!existingBlacklist.empty) {
        return interaction.followUp("❌ This group is already blacklisted.");
      }

      const actionId = await db.runTransaction(async (transaction) => {
        const blacklistSnapshot = await transaction.get(
          db.collection("blacklists")
        );
        let maxNumber = 0;

        blacklistSnapshot.forEach((doc) => {
          const match = doc.id.match(/^blacklist-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) {
              maxNumber = num;
            }
          }
        });

        return `blacklist-${maxNumber + 1}`;
      });

      const icon = await fetchGroupIconUrl(group_id, groupInfo.name);

      const blacklistData = {
        action_id: actionId,
        roblox_id: group_id,
        category,
        reason,
        deep_blacklist,
        additional_info:
          additional_info || "No additional information provided",
        evidence: evidence || "No evidence provided",
        issued_by: issuedBy,
        issued_date: new Date(),
      };

      await db.collection("blacklists").doc(actionId).set(blacklistData);

      const successEmbed = new EmbedBuilder()
        .setTitle("Group Blacklisted")
        .setThumbnail(icon)
        .setColor(0xff0000)
        .addFields(
          { name: "Action ID", value: actionId, inline: true },
          { name: "Group Name", value: groupInfo.name, inline: true },
          { name: "Group ID", value: group_id.toString(), inline: true },
          { name: "Category", value: category, inline: true },
          { name: "Reason", value: reason, inline: true },
          {
            name: "Deep Blacklist",
            value: deep_blacklist.toString(),
            inline: true,
          },
          {
            name: "Additional Info",
            value: additional_info || "No additional information",
            inline: true,
          },
          {
            name: "Evidence",
            value: evidence || "No evidence provided",
            inline: true,
          },
          { name: "Issued By", value: issuedBy, inline: true },
          {
            name: "Issued Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Blacklisted by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error processing blacklist command:", error);
      await interaction.followUp(
        "❌ There was an error processing the blacklist."
      );
    }
  }

  // /unblacklist Command
  if (interaction.commandName === "unblacklist") {
    const group_id = interaction.options.getInteger("group_id");

    const modRoleId = "1335829172131594251";
    const execRoleId = "1335829226003366009";
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (
      !member.roles.cache.has(modRoleId) &&
      !member.roles.cache.has(execRoleId)
    ) {
      return interaction.reply({
        content: "❌ You do not have permission to run this command.",
        ephemeral: true,
      });
    }

    const groupInfo = await noblox.getGroup(group_id).catch(() => null);
    if (!groupInfo) {
      return interaction.followUp(
        "❌ The provided group ID does not exist on Roblox."
      );
    }

    try {
      await interaction.deferReply();

      const existingBlacklist = await db
        .collection("blacklists")
        .where("roblox_id", "==", group_id)
        .get();
      if (existingBlacklist.empty) {
        return interaction.followUp(
          "❌ This group is not currently blacklisted."
        );
      }

      const batch = db.batch();
      existingBlacklist.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      const successEmbed = new EmbedBuilder()
        .setTitle("✅ Group Unblacklisted")
        .setColor(0x00ff00)
        .setDescription(
          `${groupInfo.name} has been successfully unblacklisted.`
        )
        .setFooter({
          text: `Unblacklisted by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /unblacklist command:", error);
      await interaction.reply({
        content:
          "❌ An error occurred while processing the unblacklist command. Please try again later.",
        ephemeral: true,
      });
    }
  }
  if (interaction.commandName === "blacklist-overview") {
    const modRoleId = "1335829172131594251";
    const execRoleId = "1335829226003366009";
    const member = await interaction.guild.members.fetch(interaction.user.id);

    if (
      !member.roles.cache.has(modRoleId) &&
      !member.roles.cache.has(execRoleId)
    ) {
      return interaction.reply({
        content: "❌ You do not have permission to use this command.",
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply();

      // Fetch members of the Dragonborn PMC group (4760223)
      const dragonbornMembers = [];
      const dragonbornRoles = await noblox.getRoles(dragonbornGroupId);
      for (const role of dragonbornRoles) {
        const members = await noblox.getPlayers(dragonbornGroupId, role.id);
        for (const member of members) {
          dragonbornMembers.push(member.username);
        }
      }

      // Fetch all blacklisted groups from Firestore
      const blacklistedGroupsSnapshot = await db.collection("blacklists").get();
      const blacklistedGroups = blacklistedGroupsSnapshot.docs.map((doc) =>
        doc.data()
      );

      const blacklistedGroupNames = [];
      const blacklistedGroupMembers = [];
      // Loop through each blacklisted group and check for members in Dragonborn PMC
      for (const blacklistedGroup of blacklistedGroups) {
        const groupId = blacklistedGroup.roblox_id;
        const groupName = await noblox
          .getGroup(groupId)
          .then((group) => group.name);
        blacklistedGroupNames.push(groupName);

        // Fetch members of the blacklisted group
        const blacklistedGroupRoles = await noblox.getRoles(groupId);
        for (const role of blacklistedGroupRoles) {
          const members = await noblox.getPlayers(groupId, role.id);
          for (const member of members) {
            blacklistedGroupMembers.push(member.username);
          }
        }
      }

      // Sort groups and members alphabetically
      blacklistedGroupNames.sort();
      dragonbornMembers.sort();
      blacklistedGroupMembers.sort();

      // Check how many Dragonborn members are in these blacklisted groups
      const commonMembers = dragonbornMembers.filter((username) =>
        blacklistedGroupMembers.includes(username)
      );

      // Calculate the percentage of Dragonborn members in blacklisted groups
      const totalMembersChecked = dragonbornMembers.length;
      const membersInBlacklistedGroups = commonMembers.length;
      const percentageInBlacklistedGroups =
        totalMembersChecked > 0
          ? ((membersInBlacklistedGroups / totalMembersChecked) * 100).toFixed(
              2
            )
          : 0;

      // Helper function to create embed chunks
      const createEmbed = (title, fields) => {
        return new EmbedBuilder()
          .setTitle(title)
          .setColor(0x00ff00)
          .addFields(...fields)
          .setFooter({
            text: `Overview generated by ${interaction.user.username}`,
            iconURL: interaction.user.avatarURL(),
          })
          .setTimestamp();
      };

      // Function to split the data into chunks that fit Discord's character limits
      const chunkData = (data, chunkSize, withComma) => {
        const chunks = [];
        let currentChunk = "";
        data.forEach((item, index) => {
          const separator =
            withComma && index !== data.length - 1 ? ", " : "\n"; // Comma for members, new line for groups
          if ((currentChunk + item + separator).length <= chunkSize) {
            currentChunk += item + separator;
          } else {
            chunks.push(currentChunk.trim());
            currentChunk = item + separator;
          }
        });
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
      };

      // Chunking both the blacklisted group names and the common members
      const blacklistedGroupChunks = chunkData(
        blacklistedGroupNames,
        1024,
        false
      ); // Blacklisted groups use new line
      const commonMemberChunks = chunkData(commonMembers, 1024, true); // Common members use comma

      // Send embeds for blacklisted groups
      for (let i = 0; i < blacklistedGroupChunks.length; i++) {
        const overviewEmbed = createEmbed(
          `Blacklist Overview (Groups - Part ${i + 1})`,
          [
            {
              name: "Blacklisted Groups",
              value: blacklistedGroupChunks[i] || "No Blacklisted Groups",
            },
          ]
        );

        await interaction.followUp({ embeds: [overviewEmbed] });
      }

      // Send embeds for common members
      for (let i = 0; i < commonMemberChunks.length; i++) {
        const overviewEmbed = createEmbed(
          `Blacklist Overview (Members - Part ${i + 1})`,
          [
            {
              name: `Members in Blacklisted Groups (${membersInBlacklistedGroups} members)`,
              value: commonMemberChunks[i] || "No Members",
            },
          ]
        );

        await interaction.followUp({ embeds: [overviewEmbed] });
      }

      // Send a separate message for the total members and percentage
      const percentageEmbed = createEmbed("Blacklist Overview (Summary)", [
        {
          name: "Total Dragonborn Members",
          value: totalMembersChecked.toString(),
          inline: true,
        },
        {
          name: "Percentage of Members in Blacklisted Groups",
          value: `${percentageInBlacklistedGroups}%`,
          inline: true,
        },
      ]);

      await interaction.followUp({ embeds: [percentageEmbed] });
    } catch (error) {
      console.error("Error in /blacklist-overview command:", error);
      await interaction.followUp({
        content:
          "❌ An error occurred while processing the blacklist overview. Please try again later.",
        ephemeral: true,
      });
    }
  }
});

client
  .login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log("Bot successfully logged into Discord!");
    startNoblox();
    fetchAnnouncementChannel();
  })
  .catch((error) => {
    console.error("Error logging into Discord:", error);
  });
