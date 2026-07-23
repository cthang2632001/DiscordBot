"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listScheduleCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
exports.listScheduleCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("listschedule")
        .setDescription("Xem danh sách tất cả các lịch"),
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const filePath = (0, utils_1.getSchedulePath)(interaction.guildId);
        const schedules = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
        if (schedules.length === 0) {
            await interaction.reply({
                content: "❌ Không có lịch nào.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📅 Danh sách lịch gửi tin nhắn")
            .setDescription(`Tổng cộng: ${schedules.length} lịch`);
        schedules.forEach(schedule => {
            embed.addFields({
                name: `ID: ${schedule.id} | ${schedule.time} (${schedule.frequency})`,
                value: `${schedule.message}${schedule.dayOfWeek !== undefined ? `\nThứ: ${schedule.dayOfWeek}` : ""}${schedule.dayOfMonth !== undefined ? `\nNgày: ${schedule.dayOfMonth}` : ""}`,
                inline: false
            });
        });
        await interaction.reply({ embeds: [embed] });
    }
};
