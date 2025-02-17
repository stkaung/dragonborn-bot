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
        description: "Specify user, group, or appeal.",
        type: 3, // STRING type
        required: true,
        choices: [
          { name: "user", value: "user" },
          { name: "group", value: "group" },
          { name: "appeal", value: "appeal" },
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
        description: "Specify type of channel (announcements/appeals/reports).",
        type: 3, // STRING
        required: true,
        choices: [
          { name: "announcements", value: "announcements" },
          { name: "appeals", value: "appeals" },
          { name: "reports", value: "reports" }, // Add reports channel option
        ],
      },
      {
        name: "channel",
        description: "Select the channel.",
        type: 7, // CHANNEL
        required: true,
      },
    ],
  },
  {
    name: "announce",
    description: "Announces all moderation actions from the past week",
    options: [], // Remove options since we'll fetch automatically
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
  {
    name: "appeal",
    description: "Submit an appeal for a moderation action",
    options: [
      {
        name: "type",
        description: "Type of appeal (user/group)",
        type: 3,
        required: true,
        choices: [
          { name: "User", value: "user" },
          { name: "Group", value: "group" },
        ],
      },
      {
        name: "reason",
        description: "Reason for your appeal",
        type: 3,
        required: true,
      },
      {
        name: "evidence",
        description: "Evidence to support your appeal",
        type: 3,
        required: true,
      },
      {
        name: "username",
        description: "Your Roblox username",
        type: 3,
        required: false,
      },
      {
        name: "group_id",
        description: "Your group ID",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "accept_appeal",
    description: "Accept a pending appeal",
    default_member_permissions: "0", // No default permissions
    options: [
      {
        name: "type",
        description: "Type of appeal (user/group)",
        type: 3,
        required: true,
        choices: [
          { name: "User", value: "user" },
          { name: "Group", value: "group" },
        ],
      },
      {
        name: "username",
        description: "Roblox username (for user appeals)",
        type: 3,
        required: false,
      },
      {
        name: "group_id",
        description: "Group ID (for group appeals)",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "reject_appeal",
    description: "Reject a pending appeal",
    default_member_permissions: "0", // No default permissions
    options: [
      {
        name: "type",
        description: "Type of appeal (user/group)",
        type: 3,
        required: true,
        choices: [
          { name: "User", value: "user" },
          { name: "Group", value: "group" },
        ],
      },
      {
        name: "reason",
        description: "Reason for rejecting the appeal",
        type: 3,
        required: true,
      },
      {
        name: "username",
        description: "Roblox username (for user appeals)",
        type: 3,
        required: false,
      },
      {
        name: "group_id",
        description: "Group ID (for group appeals)",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "report",
    description: "Submit a report against a user or group",
    options: [
      {
        name: "type",
        description: "Type of report (user/group)",
        type: 3,
        required: true,
        choices: [
          { name: "User", value: "user" },
          { name: "Group", value: "group" },
        ],
      },
      {
        name: "reason",
        description: "Reason for the report",
        type: 3,
        required: true,
      },
      {
        name: "evidence",
        description: "Evidence link(s)",
        type: 3,
        required: true,
      },
      {
        name: "username",
        description: "Roblox username of the user (for user reports)",
        type: 3,
        required: false,
      },
      {
        name: "group_id",
        description: "Roblox group ID (for group reports)",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "accept_report",
    description: "Accept and action a pending report",
    options: [
      {
        name: "report_id",
        description: "The ID of the report to accept (e.g. report-1)",
        type: 3,
        required: true,
      },
      {
        name: "action",
        description: "Action to take",
        type: 3,
        required: true,
        choices: [
          { name: "Ban", value: "ban" },
          { name: "Suspend", value: "suspend" },
          { name: "Blacklist", value: "blacklist" },
        ],
      },
      {
        name: "reason",
        description: "Reason for taking action",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "reject_report",
    description: "Reject a pending report",
    options: [
      {
        name: "report_id",
        description: "The ID of the report to reject (e.g. report-1)",
        type: 3,
        required: true,
      },
      {
        name: "reason",
        description: "Reason for rejecting the report",
        type: 3,
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
let appealChannelId;
let reportsChannelId; // Add this line

async function fetchChannels() {
  try {
    const [announcementDoc, appealDoc, reportsDoc] = await Promise.all([
      db.collection("channels").doc("announcement_channel").get(),
      db.collection("channels").doc("appeal_channel").get(),
      db.collection("channels").doc("reports_channel").get(), // Add this line
    ]);

    if (announcementDoc.exists) {
      announcementChannelId = announcementDoc.data().id;
      console.log(`✅ Announcement channel set to: ${announcementChannelId}`);
    }

    if (appealDoc.exists) {
      appealChannelId = appealDoc.data().id;
      console.log(`✅ Appeal channel set to: ${appealChannelId}`);
    }

    if (reportsDoc.exists) {
      // Add this block
      reportsChannelId = reportsDoc.data().id;
      console.log(`✅ Reports channel set to: ${reportsChannelId}`);
    }
  } catch (error) {
    console.error("❌ Error fetching channels from Firestore:", error);
  }
}

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

async function announceWeekly(interaction) {
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

  try {
    await interaction.deferReply();

    // Calculate date range
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch all actions from the past week
    const [
      bansSnapshot,
      suspensionsSnapshot,
      blacklistsSnapshot,
      appealsSnapshot,
      reportsSnapshot,
    ] = await Promise.all([
      db
        .collection("bans")
        .where("issued_date", ">=", lastWeek)
        .where("issued_date", "<=", today)
        .get(),
      db
        .collection("suspensions")
        .where("issued_date", ">=", lastWeek)
        .where("issued_date", "<=", today)
        .get(),
      db
        .collection("blacklists")
        .where("issued_date", ">=", lastWeek)
        .where("issued_date", "<=", today)
        .get(),
      db
        .collection("appeals")
        .where("issued_date", ">=", lastWeek)
        .where("issued_date", "<=", today)
        .get(),
      db
        .collection("reports")
        .where("issued_date", ">=", lastWeek)
        .where("issued_date", "<=", today)
        .get(),
    ]);

    // Calculate number of verdict types with logs
    const verdictCount = [
      !bansSnapshot.empty,
      !suspensionsSnapshot.empty,
      !blacklistsSnapshot.empty,
    ].filter(Boolean).length;

    const embed = new EmbedBuilder()
      .setTitle(`Weekly Moderation Report`)
      .setDescription(
        `**__Week of ${
          today.getMonth() + 1
        }/${today.getDate()} - ${verdictCount}/3 Verdicts__**`
      )
      .setColor(0x0099ff)
      .setTimestamp()
      .setFooter({
        text: "DB | Justice Panel",
        iconURL: client.user.avatarURL(),
      });

    // Bans section
    if (!bansSnapshot.empty) {
      let bansText = "";
      for (const doc of bansSnapshot.docs) {
        const ban = doc.data();
        const username = await noblox.getUsernameFromId(ban.roblox_id);
        const line =
          `**User:** [${username}](https://roblox.com/users/${ban.roblox_id})\n` +
          `**Category:** ${ban.category || "N/A"}\n` +
          `**Reason:** ${ban.reason}\n` +
          (ban.link && ban.link !== "No evidence provided"
            ? `**Evidence:** [Click Here](${ban.link})\n`
            : "") +
          `**Date:** ${ban.issued_date.toDate().toLocaleString()}\n` +
          `\u200B`;
        bansText += line;
      }
      embed.addFields({ name: "🔨 Bans", value: bansText });
    }

    // Suspensions section
    if (!suspensionsSnapshot.empty) {
      let suspensionsText = "";
      for (const doc of suspensionsSnapshot.docs) {
        const suspension = doc.data();
        const username = await noblox.getUsernameFromId(suspension.roblox_id);

        // Format duration to include months
        let duration = suspension.duration;

        if (duration === 1) {
          duration = "1 month";
        } else {
          duration = `${duration} months`;
        }

        const line =
          `**User:** [${username}](https://roblox.com/users/${suspension.roblox_id})\n` +
          `**Category:** ${suspension.category || "N/A"}\n` +
          `**Tier:** ${suspension.tier}\n` +
          `**Reason:** ${suspension.reason}\n` +
          `**Duration:** ${duration}\n` +
          `**End Date:** ${suspension.end_date.toDate().toLocaleString()}\n` +
          (suspension.link && suspension.link !== "No evidence provided"
            ? `**Evidence:** [Click Here](${suspension.link})\n`
            : "") +
          `**Date:** ${suspension.issued_date.toDate().toLocaleString()}\n` +
          `\u200B`;
        suspensionsText += line;
      }
      embed.addFields({ name: "⚠️ Suspensions", value: suspensionsText });
    }

    // Blacklists section
    if (!blacklistsSnapshot.empty) {
      let blacklistsText = "";
      for (const doc of blacklistsSnapshot.docs) {
        const blacklist = doc.data();
        const groupInfo = await noblox.getGroup(blacklist.roblox_id);
        const line =
          `**Group:** [${groupInfo.name}](https://roblox.com/groups/${blacklist.roblox_id})\n` +
          `**Category:** ${blacklist.category || "N/A"}\n` +
          `**Reason:** ${blacklist.reason}\n` +
          (blacklist.evidence && blacklist.evidence !== "No evidence provided"
            ? `**Evidence:** [Click Here](${blacklist.evidence})\n`
            : "") +
          `**Date:** ${blacklist.issued_date.toDate().toLocaleString()}\n` +
          `\u200B`;
        blacklistsText += line;
      }
      embed.addFields({ name: "🚫 Blacklists", value: blacklistsText });
    }

    // Appeals section
    if (!appealsSnapshot.empty) {
      let appealsText = "";
      for (const doc of appealsSnapshot.docs) {
        const appeal = doc.data();
        let name;
        if (appeal.type === "user") {
          name = await noblox.getUsernameFromId(appeal.roblox_id);
        } else {
          const groupInfo = await noblox.getGroup(appeal.roblox_id);
          name = groupInfo.name;
        }

        const line =
          `**${
            appeal.type === "user" ? "User" : "Group"
          }:** [${name}](https://roblox.com/${
            appeal.type === "user" ? "users" : "groups"
          }/${appeal.roblox_id})\n` +
          `**Reason:** ${appeal.reason}\n` +
          (appeal.evidence && appeal.evidence !== "No evidence provided"
            ? `**Evidence:** [Click Here](${appeal.evidence})\n`
            : "") +
          `**Status:** ${
            appeal.status.charAt(0).toUpperCase() + appeal.status.slice(1)
          }` +
          (appeal.status === "rejected" && appeal.rejection_reason
            ? `\n**Rejection Reason:** ${appeal.rejection_reason}`
            : "") +
          `\n**Date:** ${appeal.issued_date.toDate().toLocaleString()}\n` +
          `\u200B`;
        appealsText += line;
      }
      embed.addFields({ name: "📝 Appeals", value: appealsText });
    }

    // Reports section
    if (!reportsSnapshot.empty) {
      let reportsText = "";
      for (const doc of reportsSnapshot.docs) {
        const report = doc.data();
        let name;
        if (report.type === "user") {
          name = await noblox.getUsernameFromId(report.roblox_id);
        } else {
          const groupInfo = await noblox.getGroup(report.roblox_id);
          name = groupInfo.name;
        }

        const line =
          `**${
            report.type === "user" ? "User" : "Group"
          }:** [${name}](https://roblox.com/${
            report.type === "user" ? "users" : "groups"
          }/${report.roblox_id})\n` +
          `**Reason:** ${report.reason}\n` +
          (report.evidence && report.evidence !== "No evidence provided"
            ? `**Evidence:** [Click Here](${report.evidence})\n`
            : "") +
          `**Status:** ${
            report.status.charAt(0).toUpperCase() + report.status.slice(1)
          }` +
          (report.status === "accepted"
            ? `\n**Action Taken:** ${report.action_taken}\n**Action Reason:** ${report.action_reason}`
            : "") +
          (report.status === "rejected"
            ? `\n**Rejection Reason:** ${report.rejection_reason}`
            : "") +
          `\n**Reported By:** ${report.reporter}\n` +
          `**Date:** ${report.issued_date.toDate().toLocaleString()}\n` +
          `\u200B`;
        reportsText += line;
      }
      embed.addFields({ name: "📢 Reports", value: reportsText });
    }

    // Check if there are any actions to announce
    if (embed.data.fields?.length > 0) {
      const channel = client.channels.cache.get(announcementChannelId);
      if (!channel) {
        console.error("Announcement channel not found!");
        return interaction.followUp({
          content: "❌ Announcement channel not found.",
          ephemeral: true,
        });
      }
      await channel.send({ embeds: [embed] });
      await interaction.followUp({
        content: "✅ Weekly moderation announcement posted.",
        ephemeral: true,
      });
    } else {
      console.log("No actions to announce this week.");
      await interaction.followUp({
        content: "❌ No moderation actions to announce for this week.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error in announceWeekly:", error);
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
            value: `Tier ${log.tier} (${log.duration} ${
              log.duration === 1 ? "month" : "months"
            })`,
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

// Add this near the top with other global variables
const AUDIT_TYPES = {
  COMMAND_USED: "command_used",
  SUSPENSION_EXPIRED: "suspension_expired",
  MODERATION_ACTION: "moderation_action",
};

// Update the createAuditLog function
async function createAuditLog(action, targetName, targetId, description) {
  try {
    const logData = {
      action: action, // e.g. "+ban", "-unban", "+suspend", "-appeal"
      name: targetName, // Roblox username or group name
      roblox_id: targetId, // Roblox user ID or group ID
      date: new Date(), // Timestamp
      description: description, // Description of what happened
    };

    await db.collection("logs").add(logData);
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
}

// Update the interaction handler to log commands
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
      } else if (type === "appeal") {
        if (!username) {
          await interaction.reply(
            "The username parameter is required for appeal logs."
          );
          return;
        }
        logsData = await getAppealLogs(username);
      }

      if (logsData.length === 0) {
        await interaction.followUp(
          "No logs found for the specified user/group/appeal."
        );
        return;
      }

      const embeds = [];
      for (const log of logsData) {
        let embed;
        if (log.action_type === "Appeal") {
          embed = await createEmbedForAppealLog(log);
        } else {
          embed = await createEmbedForLog(log, type);
        }
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
      if (type === "announcements") {
        await db
          .collection("channels")
          .doc("announcement_channel")
          .set({ id: channel.id });
        announcementChannelId = channel.id;
      } else if (type === "appeals") {
        await db
          .collection("channels")
          .doc("appeal_channel")
          .set({ id: channel.id });
        appealChannelId = channel.id;
      } else if (type === "reports") {
        // Add this block
        await db
          .collection("channels")
          .doc("reports_channel")
          .set({ id: channel.id });
        reportsChannelId = channel.id;
      }

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
    await announceWeekly(interaction);
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
        duration: durationInMonths,
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
            value: `Tier ${tier} (${durationInMonths} ${
              durationInMonths === 1 ? "month" : "months"
            })`,
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

      // After successfully suspending:
      await createAuditLog(
        "+",
        username,
        robloxId,
        `${username} was suspended for ${durationInMonths} months (Tier ${tier}) | Reason: ${reason}`
      );
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

      // In the unsuspend command, after removing suspension:
      await createAuditLog(
        "-",
        username,
        userId,
        `${username}'s suspension was manually removed`
      );
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

      // In the ban command, after banning the user:
      await createAuditLog(
        "+",
        username,
        robloxId,
        `${username} was permanently banned | Reason: ${reason}`
      );
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

      // In the unban command, after unbanning the user:
      await createAuditLog(
        "-",
        username,
        userId,
        `${username}'s ban was removed`
      );
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

      // In the blacklist command, after blacklisting the group:
      await createAuditLog(
        "+",
        groupInfo.name,
        group_id,
        `Group "${groupInfo.name}" was blacklisted | Reason: ${reason}`
      );
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

      // In the unblacklist command, after unblacklisting the group:
      await createAuditLog(
        "-",
        groupInfo.name,
        group_id,
        `Group "${groupInfo.name}" was removed from blacklist`
      );
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

  // Add URL validation function at the top of the file
  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  // Update the appeal command handler
  if (interaction.commandName === "appeal") {
    const type = interaction.options.getString("type");
    const username = interaction.options.getString("username");
    const groupId = interaction.options.getString("group_id");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");

    try {
      await interaction.deferReply();

      // Validate evidence URL
      if (!isValidUrl(evidence)) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Error")
          .setColor(0xff0000)
          .setDescription("Please provide a valid URL for evidence.")
          .setTimestamp()
          .setFooter({
            text: "DB | Justice Panel",
            iconURL: client.user.avatarURL(),
          });
        return interaction.followUp({ embeds: [errorEmbed] });
      }

      // Validate input based on type
      if (type === "user" && !username) {
        return interaction.followUp(
          "❌ Username is required for user appeals."
        );
      }
      if (type === "group" && !groupId) {
        return interaction.followUp(
          "❌ Group ID is required for group appeals."
        );
      }

      let robloxId, name, link;

      // Get Roblox info based on type
      if (type === "user") {
        robloxId = await noblox.getIdFromUsername(username).catch(() => null);
        if (!robloxId) {
          return interaction.followUp(
            "❌ The provided username does not exist on Roblox."
          );
        }
        name = username;
        link = `https://roblox.com/users/${robloxId}`;
      } else {
        try {
          const groupInfo = await noblox.getGroup(groupId);
          robloxId = groupId;
          name = groupInfo.name;
          link = `https://roblox.com/groups/${groupId}`;
        } catch (error) {
          return interaction.followUp(
            "❌ The provided group ID does not exist on Roblox."
          );
        }
      }

      // Check for existing moderation actions
      let hasModAction = false;
      if (type === "user") {
        // Check bans
        const bansSnapshot = await db
          .collection("bans")
          .where("roblox_id", "==", robloxId)
          .get();

        // Check suspensions
        const suspensionsSnapshot = await db
          .collection("suspensions")
          .where("roblox_id", "==", robloxId)
          .where("end_date", ">", new Date()) // Only active suspensions
          .get();

        hasModAction = !bansSnapshot.empty || !suspensionsSnapshot.empty;
      } else {
        // Check blacklists for groups
        const blacklistsSnapshot = await db
          .collection("blacklists")
          .where("roblox_id", "==", groupId)
          .get();

        hasModAction = !blacklistsSnapshot.empty;
      }

      if (!hasModAction) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Error")
          .setColor(0xff0000)
          .setDescription(
            `This ${type} does not have any active moderation actions to appeal.`
          )
          .setTimestamp()
          .setFooter({
            text: "DB | Justice Panel",
            iconURL: client.user.avatarURL(),
          });
        return interaction.followUp({ embeds: [errorEmbed] });
      }

      // Also check if they already have a pending appeal
      const existingAppealSnapshot = await db
        .collection("appeals")
        .where("roblox_id", "==", type === "user" ? robloxId : groupId)
        .where("status", "==", "pending")
        .get();

      if (!existingAppealSnapshot.empty) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Error")
          .setColor(0xff0000)
          .setDescription(`This ${type} already has a pending appeal.`)
          .setTimestamp()
          .setFooter({
            text: "DB | Justice Panel",
            iconURL: client.user.avatarURL(),
          });
        return interaction.followUp({ embeds: [errorEmbed] });
      }

      // Continue with the rest of the appeal creation if all validations pass

      // Generate new appeal ID
      const appealId = await db.runTransaction(async (transaction) => {
        const appealsSnapshot = await transaction.get(db.collection("appeals"));
        let maxNumber = 0;

        appealsSnapshot.forEach((doc) => {
          const match = doc.id.match(/^appeal-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });

        return `appeal-${maxNumber + 1}`;
      });

      const appealData = {
        action_id: appealId,
        type: type,
        roblox_id: robloxId,
        reason: reason,
        evidence: evidence,
        issued_date: new Date(),
        status: "pending",
        discord_id: interaction.user.id, // Add this line
      };

      await db.collection("appeals").doc(appealId).set(appealData);

      // Get user thumbnail for embed
      const thumbnails = await noblox.getPlayerThumbnail(
        [robloxId],
        420,
        "png",
        true
      );
      const playerThumbnail =
        thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";

      // Create new response embed
      const successEmbed = new EmbedBuilder()
        .setTitle("Successfully submitted appeal request.")
        .setColor(0x00ff00)
        .setThumbnail(playerThumbnail) // Add thumbnail
        .addFields(
          {
            name: "Appeal",
            value: appealId,
            inline: false,
          },
          {
            name: "Status",
            value: "Pending Approval",
            inline: false,
          },
          {
            name: "Target",
            value: `[${name}](${link})`,
            inline: false,
          },
          {
            name: "Reason",
            value: reason,
            inline: false,
          },
          {
            name: "Evidence",
            value: `[Click Here](${evidence})`,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: "DB | Justice Panel",
          iconURL: client.user.avatarURL(),
        });

      // Send notification to mods channel
      if (appealChannelId) {
        const modChannel = client.channels.cache.get(appealChannelId);
        if (modChannel) {
          const modEmbed = new EmbedBuilder()
            .setTitle("New Appeal Submitted")
            .setColor(0x0099ff)
            .setThumbnail(playerThumbnail) // Add thumbnail
            .addFields(
              {
                name: "Appeal ID",
                value: appealId,
                inline: true,
              },
              {
                name: "Type",
                value: type.charAt(0).toUpperCase() + type.slice(1),
                inline: true,
              },
              {
                name: "Target",
                value: `[${name}](${link})`,
                inline: true,
              },
              {
                name: "Reason",
                value: reason,
                inline: false,
              },
              {
                name: "Evidence",
                value: `[Click Here](${evidence})`,
                inline: false,
              },
              {
                name: "Submitted By",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Submitted At",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await modChannel.send({ embeds: [modEmbed] });
        }
      }

      await interaction.followUp({ embeds: [successEmbed] });

      // In the appeal command, after submitting the appeal:
      await createAuditLog(
        "+",
        username,
        robloxId,
        `${username} submitted an appeal | Reason: ${reason}`
      );
    } catch (error) {
      console.error("Error processing appeal command:", error);
      await interaction.followUp(
        "❌ There was an error processing the appeal."
      );
    }
  }

  if (interaction.commandName === "accept_appeal") {
    const type = interaction.options.getString("type");
    const username = interaction.options.getString("username");
    const groupId = interaction.options.getString("group_id");

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

    try {
      await interaction.deferReply();

      // Get Roblox ID from username
      const robloxId = await noblox
        .getIdFromUsername(username)
        .catch(() => null);
      if (!robloxId) {
        return interaction.followUp(
          "❌ The provided username does not exist on Roblox."
        );
      }

      // Get the pending appeal
      const appealsSnapshot = await db
        .collection("appeals")
        .where("roblox_id", "==", robloxId)
        .where("status", "==", "pending")
        .get();

      if (appealsSnapshot.empty) {
        return interaction.followUp(
          "❌ No pending appeal found for this user."
        );
      }

      const appealDoc = appealsSnapshot.docs[0];
      const appealData = appealDoc.data();

      // Update the appeal status
      await appealDoc.ref.update({
        status: "accepted",
        processed_by: interaction.user.username,
        processed_date: new Date(),
      });

      // Get user thumbnail for embed
      const thumbnails = await noblox.getPlayerThumbnail(
        [robloxId],
        420,
        "png",
        true
      );
      const avatarUrl =
        thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";

      const successEmbed = new EmbedBuilder()
        .setTitle("Appeal Accepted")
        .setColor(0x00ff00)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: "Action ID", value: appealData.action_id, inline: true },
          { name: "Roblox Username", value: username, inline: true },
          {
            name: "Processed By",
            value: interaction.user.username,
            inline: true,
          },
          {
            name: "Processed Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Appeal accepted by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });

      // In the accept_appeal command, after updating the appeal status
      // Get the appeal submitter's Discord ID
      if (appealData.discord_id) {
        try {
          const user = await client.users.fetch(appealData.discord_id);
          const dmEmbed = new EmbedBuilder()
            .setTitle("Appeal Status Update")
            .setColor(0x00ff00)
            .setThumbnail(avatarUrl)
            .addFields(
              {
                name: "Appeal",
                value: appealData.action_id, // Changed from appealId
                inline: false,
              },
              {
                name: "Status",
                value: "Accepted ✅",
                inline: false,
              },
              {
                name: "Target",
                value: `[${username}](https://roblox.com/users/${robloxId})`, // Changed from name/link
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error("Failed to send DM to appeal submitter:", error);
        }
      }

      // In the accept_appeal command, after updating the appeal status:
      await createAuditLog(
        "-",
        username,
        robloxId,
        `${username}'s appeal was ${accepted ? "accepted" : "rejected"}${
          reason ? ` | Reason: ${reason}` : ""
        }`
      );
    } catch (error) {
      console.error("Error processing accept_appeal command:", error);
      await interaction.followUp(
        "❌ There was an error processing the appeal acceptance."
      );
    }
  }

  if (interaction.commandName === "reject_appeal") {
    const type = interaction.options.getString("type");
    const username = interaction.options.getString("username");
    const groupId = interaction.options.getString("group_id");
    const reason = interaction.options.getString("reason");

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

    try {
      await interaction.deferReply();

      // Get Roblox ID from username
      const robloxId = await noblox
        .getIdFromUsername(username)
        .catch(() => null);
      if (!robloxId) {
        return interaction.followUp(
          "❌ The provided username does not exist on Roblox."
        );
      }

      // Get the pending appeal
      const appealsSnapshot = await db
        .collection("appeals")
        .where("roblox_id", "==", robloxId)
        .where("status", "==", "pending")
        .get();

      if (appealsSnapshot.empty) {
        return interaction.followUp(
          "❌ No pending appeal found for this user."
        );
      }

      const appealDoc = appealsSnapshot.docs[0];
      const appealData = appealDoc.data();

      // Update the appeal status
      await appealDoc.ref.update({
        status: "rejected",
        rejection_reason: reason,
        processed_by: interaction.user.username,
        processed_date: new Date(),
      });

      // Get user thumbnail for embed
      const thumbnails = await noblox.getPlayerThumbnail(
        [robloxId],
        420,
        "png",
        true
      );
      const avatarUrl =
        thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";

      const rejectEmbed = new EmbedBuilder()
        .setTitle("Appeal Rejected")
        .setColor(0xff0000)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: "Action ID", value: appealData.action_id, inline: true },
          { name: "Roblox Username", value: username, inline: true },
          {
            name: "Processed By",
            value: interaction.user.username,
            inline: true,
          },
          { name: "Rejection Reason", value: reason, inline: false },
          {
            name: "Processed Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Appeal rejected by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [rejectEmbed] });

      // In the reject_appeal command, after updating the appeal status
      // Get the appeal submitter's Discord ID
      if (appealData.discord_id) {
        try {
          const user = await client.users.fetch(appealData.discord_id);
          const dmEmbed = new EmbedBuilder()
            .setTitle("Appeal Status Update")
            .setColor(0xff0000)
            .setThumbnail(avatarUrl)
            .addFields(
              {
                name: "Appeal",
                value: appealData.action_id, // Changed from appealId
                inline: false,
              },
              {
                name: "Status",
                value: "Rejected ❌",
                inline: false,
              },
              {
                name: "Target",
                value: `[${username}](https://roblox.com/users/${robloxId})`, // Changed from name/link
                inline: false,
              },
              {
                name: "Reason",
                value: reason,
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error("Failed to send DM to appeal submitter:", error);
        }
      }

      // In the reject_appeal command, after updating the appeal status:
      await createAuditLog(
        "-",
        username,
        robloxId,
        `${username}'s appeal was ${accepted ? "accepted" : "rejected"}${
          reason ? ` | Reason: ${reason}` : ""
        }`
      );
    } catch (error) {
      console.error("Error processing reject_appeal command:", error);
      await interaction.followUp(
        "❌ There was an error processing the appeal rejection."
      );
    }
  }

  if (interaction.commandName === "report") {
    const type = interaction.options.getString("type");
    const username = interaction.options.getString("username");
    const groupId = interaction.options.getString("group_id");
    const reason = interaction.options.getString("reason");
    const evidence = interaction.options.getString("evidence");

    try {
      await interaction.deferReply({ ephemeral: true });

      // Validate input based on type
      if (type === "user" && !username) {
        return interaction.followUp(
          "❌ Username is required for user reports."
        );
      }
      if (type === "group" && !groupId) {
        return interaction.followUp(
          "❌ Group ID is required for group reports."
        );
      }

      let robloxId, name, thumbnailUrl;

      // Get Roblox info based on type
      if (type === "user") {
        robloxId = await noblox.getIdFromUsername(username).catch(() => null);
        if (!robloxId) {
          return interaction.followUp(
            "❌ The provided username does not exist on Roblox."
          );
        }
        name = username;
        const thumbnails = await noblox.getPlayerThumbnail(
          [robloxId],
          420,
          "png",
          true
        );
        thumbnailUrl =
          thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";
      } else {
        try {
          const groupInfo = await noblox.getGroup(groupId);
          robloxId = groupId;
          name = groupInfo.name;
          thumbnailUrl = await fetchGroupIconUrl(groupId);
        } catch (error) {
          return interaction.followUp(
            "❌ The provided group ID does not exist on Roblox."
          );
        }
      }

      // Generate new report ID
      const reportId = await db.runTransaction(async (transaction) => {
        const reportsSnapshot = await transaction.get(db.collection("reports"));
        let maxNumber = 0;

        reportsSnapshot.forEach((doc) => {
          const match = doc.id.match(/^report-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNumber) maxNumber = num;
          }
        });

        return `report-${maxNumber + 1}`;
      });

      // Create report data - only declare once
      const reportData = {
        action_id: reportId,
        type: type,
        roblox_id: robloxId,
        reason: reason,
        evidence: evidence,
        reporter: interaction.user.tag,
        issued_date: new Date(),
        status: "pending",
        discord_id: interaction.user.id,
      };

      // Save to Firestore
      await db.collection("reports").doc(reportId).set(reportData);

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle("Report Submitted")
        .setColor(0x00ff00)
        .setThumbnail(thumbnailUrl)
        .addFields(
          { name: "Report ID", value: reportId, inline: true },
          {
            name: type === "user" ? "Username" : "Group Name",
            value: name,
            inline: true,
          },
          {
            name: type === "user" ? "User ID" : "Group ID",
            value: String(robloxId),
            inline: true,
          },
          { name: "Reason", value: reason, inline: false },
          { name: "Evidence", value: evidence, inline: false },
          { name: "Status", value: "Pending", inline: true },
          { name: "Submitted By", value: interaction.user.tag, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: `Report submitted by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({
        content:
          "✅ Your report has been submitted successfully. A moderator will review it shortly.",
        embeds: [successEmbed],
        ephemeral: true,
      });

      // Add reports channel notification
      if (reportsChannelId) {
        const reportsChannel = client.channels.cache.get(reportsChannelId);
        if (reportsChannel) {
          const modEmbed = new EmbedBuilder()
            .setTitle("New Report Submitted")
            .setColor(0x0099ff)
            .setThumbnail(thumbnailUrl)
            .addFields(
              { name: "Report ID", value: reportId, inline: true },
              {
                name: "Type",
                value: type.charAt(0).toUpperCase() + type.slice(1),
                inline: true,
              },
              {
                name: type === "user" ? "Username" : "Group Name",
                value: name,
                inline: true,
              },
              { name: "Reason", value: reason, inline: false },
              { name: "Evidence", value: evidence, inline: false },
              {
                name: "Submitted By",
                value: interaction.user.tag,
                inline: true,
              },
              {
                name: "Submitted At",
                value: new Date().toLocaleString(),
                inline: true,
              }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await reportsChannel.send({ embeds: [modEmbed] });
        }
      }

      // In the report command, after submitting the report:
      await createAuditLog(
        "+",
        name,
        robloxId,
        `${
          type === "user" ? username : `Group "${name}"`
        } was reported | Reason: ${reason}`
      );
    } catch (error) {
      console.error("Error processing report command:", error);
      await interaction.followUp({
        content:
          "❌ There was an error processing your report. Please try again later.",
        ephemeral: true,
      });
    }
  }

  if (interaction.commandName === "accept_report") {
    const reportId = interaction.options.getString("report_id");
    const action = interaction.options.getString("action");
    const reason = interaction.options.getString("reason");

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

    try {
      await interaction.deferReply();

      // Get the report
      const reportDoc = await db.collection("reports").doc(reportId).get();
      if (!reportDoc.exists) {
        return interaction.followUp("❌ Report not found.");
      }

      const reportData = reportDoc.data();
      if (reportData.status !== "pending") {
        return interaction.followUp(
          "❌ This report has already been processed."
        );
      }

      // Get name and thumbnail
      let name, thumbnailUrl;
      if (reportData.type === "user") {
        name = await noblox.getUsernameFromId(reportData.roblox_id);
        const thumbnails = await noblox.getPlayerThumbnail(
          [reportData.roblox_id],
          420,
          "png",
          true
        );
        thumbnailUrl =
          thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";
      } else {
        const groupInfo = await noblox.getGroup(reportData.roblox_id);
        name = groupInfo.name;
        thumbnailUrl = await fetchGroupIconUrl(reportData.roblox_id);
      }

      // Update report status
      await reportDoc.ref.update({
        status: "accepted",
        action_taken: action,
        processed_by: interaction.user.username,
        processed_date: new Date(),
        action_reason: reason,
      });

      const successEmbed = new EmbedBuilder()
        .setTitle("Report Accepted")
        .setColor(0x00ff00)
        .setThumbnail(thumbnailUrl)
        .addFields(
          { name: "Report ID", value: reportId, inline: true },
          {
            name: reportData.type === "user" ? "Username" : "Group Name",
            value: name,
            inline: true,
          },
          { name: "Action Taken", value: action, inline: true },
          {
            name: "Original Report Reason",
            value: reportData.reason,
            inline: false,
          },
          { name: "Action Reason", value: reason, inline: false },
          {
            name: "Original Evidence",
            value: reportData.evidence,
            inline: false,
          },
          {
            name: "Processed By",
            value: interaction.user.username,
            inline: true,
          },
          {
            name: "Processed Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Report processed by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [successEmbed] });

      // In the accept_report command handler, after updating report status:
      if (reportData.discord_id) {
        try {
          const user = await client.users.fetch(reportData.discord_id);
          const dmEmbed = new EmbedBuilder()
            .setTitle("Report Status Update")
            .setColor(0x00ff00)
            .setThumbnail(thumbnailUrl)
            .addFields(
              { name: "Report ID", value: reportId, inline: true },
              { name: "Status", value: "Accepted ✅", inline: true },
              { name: "Action Taken", value: action, inline: true },
              { name: "Action Reason", value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error("Failed to send DM to report submitter:", error);
        }
      }

      // In the accept_report command handler, after updating report status:
      await createAuditLog(
        "-",
        name,
        robloxId,
        `Report against ${type === "user" ? username : `Group "${name}"`} was ${
          accepted ? "accepted" : "rejected"
        } by ${interaction.user.tag}${action ? ` | Action: ${action}` : ""}${
          reason ? ` | Reason: ${reason}` : ""
        }`
      );
    } catch (error) {
      console.error("Error processing accept_report command:", error);
      await interaction.followUp(
        "❌ There was an error processing the report acceptance."
      );
    }
  }

  if (interaction.commandName === "reject_report") {
    const reportId = interaction.options.getString("report_id");
    const reason = interaction.options.getString("reason");

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

    try {
      await interaction.deferReply();

      // Get the report
      const reportDoc = await db.collection("reports").doc(reportId).get();
      if (!reportDoc.exists) {
        return interaction.followUp("❌ Report not found.");
      }

      const reportData = reportDoc.data();
      if (reportData.status !== "pending") {
        return interaction.followUp(
          "❌ This report has already been processed."
        );
      }

      // Get name and thumbnail
      let name, thumbnailUrl;
      if (reportData.type === "user") {
        name = await noblox.getUsernameFromId(reportData.roblox_id);
        const thumbnails = await noblox.getPlayerThumbnail(
          [reportData.roblox_id],
          420,
          "png",
          true
        );
        thumbnailUrl =
          thumbnails[0]?.imageUrl || "https://tr.rbxcdn.com/default-avatar.png";
      } else {
        const groupInfo = await noblox.getGroup(reportData.roblox_id);
        name = groupInfo.name;
        thumbnailUrl = await fetchGroupIconUrl(reportData.roblox_id);
      }

      // Update report status
      await reportDoc.ref.update({
        status: "rejected",
        rejection_reason: reason,
        processed_by: interaction.user.username,
        processed_date: new Date(),
      });

      const rejectEmbed = new EmbedBuilder()
        .setTitle("Report Rejected")
        .setColor(0xff0000)
        .setThumbnail(thumbnailUrl)
        .addFields(
          { name: "Report ID", value: reportId, inline: true },
          {
            name: reportData.type === "user" ? "Username" : "Group Name",
            value: name,
            inline: true,
          },
          {
            name: "Original Report Reason",
            value: reportData.reason,
            inline: false,
          },
          {
            name: "Original Evidence",
            value: reportData.evidence,
            inline: false,
          },
          { name: "Rejection Reason", value: reason, inline: false },
          {
            name: "Processed By",
            value: interaction.user.username,
            inline: true,
          },
          {
            name: "Processed Date",
            value: new Date().toLocaleString(),
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({
          text: `Report rejected by ${interaction.user.username}`,
          iconURL: interaction.user.avatarURL(),
        });

      await interaction.followUp({ embeds: [rejectEmbed] });

      // In the reject_report command handler, after updating report status:
      if (reportData.discord_id) {
        try {
          const user = await client.users.fetch(reportData.discord_id);
          const dmEmbed = new EmbedBuilder()
            .setTitle("Report Status Update")
            .setColor(0xff0000)
            .setThumbnail(thumbnailUrl)
            .addFields(
              { name: "Report ID", value: reportId, inline: true },
              { name: "Status", value: "Rejected ❌", inline: true },
              { name: "Rejection Reason", value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({
              text: "DB | Justice Panel",
              iconURL: client.user.avatarURL(),
            });

          await user.send({ embeds: [dmEmbed] });
        } catch (error) {
          console.error("Failed to send DM to report submitter:", error);
        }
      }

      // In the reject_report command handler, after updating report status:
      await createAuditLog(
        "-",
        name,
        robloxId,
        `Report against ${
          type === "user" ? username : `Group "${name}"`
        } was rejected by ${interaction.user.tag} | Reason: ${reason}`
      );
    } catch (error) {
      console.error("Error processing reject_report command:", error);
      await interaction.followUp(
        "❌ There was an error processing the report rejection."
      );
    }
  }
});

// Add suspension expiry checker
async function checkExpiredSuspensions() {
  try {
    const now = new Date();
    const suspensionsRef = db.collection("suspensions");
    const expiredSuspensions = await suspensionsRef
      .where("end_date", "<=", now)
      .where("logged", "!=", true)
      .get();

    for (const doc of expiredSuspensions.docs) {
      const suspensionData = doc.data();
      const username = await noblox.getUsernameFromId(suspensionData.roblox_id);

      // Create audit log for expired suspension
      await createAuditLog(
        "-",
        username,
        suspensionData.roblox_id,
        `${username}'s Tier ${suspensionData.tier} suspension has expired`
      );

      // Mark as logged
      await doc.ref.update({ logged: true });
    }
  } catch (error) {
    console.error("Error checking expired suspensions:", error);
  }
}

client
  .login(process.env.DISCORD_TOKEN)
  .then(() => {
    console.log("Bot successfully logged into Discord!");
    startNoblox();
    fetchChannels();

    // Check for expired suspensions every hour
    setInterval(checkExpiredSuspensions, 60 * 60 * 1000);
  })
  .catch((error) => {
    console.error("Error logging into Discord:", error);
  });

// Add new function to fetch appeal logs
async function getAppealLogs(username) {
  const id = await noblox.getIdFromUsername(username);
  if (!id) {
    console.error("Could not find Roblox ID for username:", username);
    return [];
  }

  const logsData = [];
  try {
    const appealsSnapshot = await db
      .collection("appeals")
      .where("roblox_id", "==", id)
      .get();
    appealsSnapshot.forEach((doc) => {
      const appealData = doc.data();
      logsData.push({
        ...appealData,
        action_type: "Appeal",
        action_id: appealData.action_id,
        issued_date: appealData.issued_date,
        status: appealData.status,
      });
    });

    logsData.sort((a, b) => b.issued_date.toDate() - a.issued_date.toDate());
    return logsData;
  } catch (error) {
    console.error("Error fetching appeal logs:", error);
    return [];
  }
}

// Add new function to create embed for appeal logs
async function createEmbedForAppealLog(log) {
  const robloxData = await getRobloxData(log.roblox_id, "user");

  const fields = [
    { name: "Action ID", value: log.action_id, inline: true },
    { name: "Roblox Username", value: robloxData.username, inline: true },
    { name: "Roblox ID", value: String(log.roblox_id), inline: true },
    {
      name: "Status",
      value: log.status.charAt(0).toUpperCase() + log.status.slice(1),
      inline: true,
    },
    {
      name: "Issued Date",
      value: log.issued_date.toDate().toLocaleString(),
      inline: true,
    },
  ];

  // Add processed information if appeal was handled
  if (log.status !== "pending") {
    fields.push(
      { name: "Processed By", value: log.processed_by, inline: true },
      {
        name: "Processed Date",
        value: log.processed_date.toDate().toLocaleString(),
        inline: true,
      }
    );

    // Add rejection reason if appeal was rejected
    if (log.status === "rejected" && log.rejection_reason) {
      fields.push({
        name: "Rejection Reason",
        value: log.rejection_reason,
        inline: false,
      });
    }
  }

  const embed = new EmbedBuilder()
    .setColor(
      log.status === "accepted"
        ? 0x00ff00
        : log.status === "rejected"
        ? 0xff0000
        : 0x0099ff
    )
    .setTitle("Appeal Information")
    .setThumbnail(robloxData.thumbnail)
    .addFields(fields)
    .setFooter({
      text: "Brought to you by DB | Justice Panel",
    });

  return embed;
}
