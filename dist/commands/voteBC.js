"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteBCCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const voteEmbed_1 = require("../voteEmbed");
const voteDM_1 = require("../voteDM");
exports.voteBCCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("votebc")
        .setDescription("Tạo Vote Bang Chiến")
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
        const guild = interaction.guild;
        const guildId = interaction.guildId;
        if (!guild || !guildId) {
            await interaction.editReply("❌ Lệnh này chỉ hoạt động trong server.");
            return;
        }
        // Đọc config để lấy kênh/thread đã cấu hình
        const config = JSON.parse(fs_1.default.readFileSync((0, utils_1.getVoteScheduleConfigPath)(guildId), "utf8"));
        const target = await (0, utils_1.getVoteTargetChannel)(guild, config);
        if (!target) {
            await interaction.editReply("❌ Chưa cấu hình kênh gửi vote. Dùng `/votescheduler config` trước.");
            return;
        }
        await target.send({
            content: "@everyone",
            allowedMentions: {
                parse: ["everyone"]
            },
            embeds: [(0, voteEmbed_1.buildVoteEmbedFromGuild)(guildId)],
            components: (0, voteEmbed_1.buildVoteComponents)()
        });
        await interaction.editReply(`✅ Đã gửi vote đến ${target}.`);
        // Gửi DM đến các thành viên
        try {
            let members;
            try {
                members = await guild.members.fetch();
            }
            catch {
                members = guild.members.cache;
            }
            let sent = 0;
            for (const [, member] of members) {
                if (member.user.bot)
                    continue;
                await (0, voteDM_1.sendVoteDM)(member.user, guildId, target);
                sent++;
                if (sent % 5 === 0) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            console.log(`[${guildId}] Đã gửi DM vote cho ${sent} thành viên.`);
        }
        catch (error) {
            console.error(`[${guildId}] Lỗi gửi DM:`, error);
        }
    }
};
