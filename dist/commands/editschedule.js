"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.editScheduleCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const scheduler_1 = require("../scheduler");
const utils_1 = require("../utils");
exports.editScheduleCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("editschedule")
        .setDescription("Chỉnh sửa lịch gửi tin nhắn")
        .addIntegerOption(option => option
        .setName("id")
        .setDescription("ID của lịch cần chỉnh sửa")
        .setRequired(true))
        .addStringOption(option => option
        .setName("time")
        .setDescription("Thời gian mới (HH:mm)")
        .setRequired(false))
        .addStringOption(option => option
        .setName("message")
        .setDescription("Nội dung mới")
        .setRequired(false))
        .addStringOption(option => option
        .setName("frequency")
        .setDescription("Tần suất mới")
        .setChoices({ name: "Hàng ngày", value: "daily" }, { name: "Mỗi tuần", value: "weekly" }, { name: "Mỗi tháng", value: "monthly" })
        .setRequired(false))
        .addIntegerOption(option => option
        .setName("dayofweek")
        .setDescription("Chọn thứ trong tuần")
        .addChoices({ name: "Chủ nhật", value: 0 }, { name: "Thứ 2", value: 1 }, { name: "Thứ 3", value: 2 }, { name: "Thứ 4", value: 3 }, { name: "Thứ 5", value: 4 }, { name: "Thứ 6", value: 5 }, { name: "Thứ 7", value: 6 })
        .setRequired(false))
        .addIntegerOption(option => option
        .setName("dayofmonth")
        .setDescription("Chọn ngày trong tháng")
        .addChoices({ name: "1", value: 1 }, { name: "2", value: 2 }, { name: "3", value: 3 }, { name: "4", value: 4 }, { name: "5", value: 5 }, { name: "6", value: 6 }, { name: "7", value: 7 }, { name: "8", value: 8 }, { name: "9", value: 9 }, { name: "10", value: 10 }, { name: "11", value: 11 }, { name: "12", value: 12 }, { name: "13", value: 13 }, { name: "14", value: 14 }, { name: "15", value: 15 }, { name: "16", value: 16 }, { name: "17", value: 17 }, { name: "18", value: 18 }, { name: "19", value: 19 }, { name: "20", value: 20 }, { name: "21", value: 21 }, { name: "22", value: 22 }, { name: "23", value: 23 }, { name: "24", value: 24 }, { name: "25", value: 25 })
        .setRequired(false)),
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
        const newTime = interaction.options.getString("time");
        const newMessage = interaction.options.getString("message");
        const newFrequency = interaction.options.getString("frequency");
        const newDayOfWeek = interaction.options.getInteger("dayofweek");
        const newDayOfMonth = interaction.options.getInteger("dayofmonth");
        // Kiểm tra ít nhất một tham số được cung cấp
        if (!newTime && !newMessage && !newFrequency && newDayOfWeek === null && newDayOfMonth === null) {
            await interaction.reply({
                content: "❌ Bạn phải cung cấp ít nhất một tham số để chỉnh sửa",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const schedules = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            await interaction.reply({
                content: `❌ Không tìm thấy lịch có ID: ${id}`,
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const oldSchedule = { ...schedules[scheduleIndex] };
        if (newTime) {
            schedules[scheduleIndex].time = newTime;
        }
        if (newMessage) {
            schedules[scheduleIndex].message = newMessage;
        }
        if (newFrequency) {
            schedules[scheduleIndex].frequency = newFrequency;
        }
        if (newDayOfWeek !== null) {
            schedules[scheduleIndex].dayOfWeek = newDayOfWeek;
        }
        if (newDayOfMonth !== null) {
            schedules[scheduleIndex].dayOfMonth = newDayOfMonth;
        }
        fs_1.default.writeFileSync(filePath, JSON.stringify(schedules, null, 4));
        // ✅ Reload lịch sau khi chỉnh sửa
        const scheduler = scheduler_1.schedulerManager.schedulers.get(interaction.guildId);
        scheduler?.reload();
        await interaction.reply(`✅ Đã chỉnh sửa lịch

            ID: ${id}
            Time cũ: ${oldSchedule.time} → Time mới: ${schedules[scheduleIndex].time}
            Message cũ: ${oldSchedule.message}
            Message mới: ${schedules[scheduleIndex].message}`);
    }
};
