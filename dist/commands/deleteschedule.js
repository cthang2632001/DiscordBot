"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteScheduleCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const scheduler_1 = require("../scheduler");
const utils_1 = require("../utils");
exports.deleteScheduleCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("deleteschedule")
        .setDescription("Xóa lịch gửi tin nhắn")
        .addIntegerOption(option => option
        .setName("id")
        .setDescription("ID của lịch cần xóa")
        .setRequired(true)),
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const filePath = (0, utils_1.getSchedulePath)(interaction.guildId);
        const id = interaction.options.getInteger("id", true);
        const schedules = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            await interaction.reply({
                content: `❌ Không tìm thấy lịch có ID: ${id}`,
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const deletedSchedule = schedules.splice(scheduleIndex, 1)[0];
        fs_1.default.writeFileSync(filePath, JSON.stringify(schedules, null, 4));
        // ✅ Reload lịch sau khi xóa
        const scheduler = scheduler_1.schedulerManager.schedulers.get(interaction.guildId);
        scheduler?.reload();
        await interaction.reply(`✅ Đã xóa lịch

            ID: ${deletedSchedule.id}
            Time: ${deletedSchedule.time}
            Message: ${deletedSchedule.message}`);
    }
};
