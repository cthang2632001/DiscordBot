"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addScheduleCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const scheduler_1 = require("../scheduler");
const utils_1 = require("../utils");
exports.addScheduleCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("addschedule")
        .setDescription("Thêm lịch gửi tin nhắn")
        .addStringOption(option => option
        .setName("time")
        .setDescription("HH:mm")
        .setRequired(true))
        .addStringOption(option => option
        .setName("message")
        .setDescription("Nội dung")
        .setRequired(true))
        .addStringOption(option => option
        .setName("frequency")
        .setDescription("Tần suất: daily, weekly (need dayOfWeek), monthly (need dayOfMonth)")
        .setChoices({ name: "Hàng ngày", value: "daily" }, { name: "Mỗi tuần (cần chỉ định thứ)", value: "weekly" }, { name: "Mỗi tháng (cần chỉ định ngày)", value: "monthly" })
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
        const time = interaction.options.getString("time", true);
        const message = interaction.options.getString("message", true);
        const frequency = interaction.options.getString("frequency") || "daily";
        const dayOfWeek = interaction.options.getInteger("dayofweek");
        const dayOfMonth = interaction.options.getInteger("dayofmonth");
        // Kiểm tra tham số hợp lệ
        if (frequency === "weekly" && dayOfWeek === null) {
            await interaction.reply({
                content: "❌ Frequency weekly cần chỉ định dayOfWeek (0-6)",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        if (frequency === "monthly" && dayOfMonth === null) {
            await interaction.reply({
                content: "❌ Frequency monthly cần chỉ định dayOfMonth (1-31)",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const schedules = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
        const nextId = schedules.length === 0
            ? 1
            : Math.max(...schedules.map(s => s.id)) + 1;
        schedules.push({
            id: nextId,
            time,
            message,
            frequency: frequency,
            dayOfWeek: dayOfWeek || undefined,
            dayOfMonth: dayOfMonth || undefined
        });
        fs_1.default.writeFileSync(filePath, JSON.stringify(schedules, null, 4));
        // ✅ Reload lịch sau khi lưu
        const scheduler = scheduler_1.schedulerManager.schedulers.get(interaction.guildId);
        scheduler?.reload();
        await interaction.reply(`✅ Đã thêm lịch

            Time: ${time}
            Frequency: ${frequency}
            ${dayOfWeek !== null ? `DayOfWeek: ${dayOfWeek}\n` : ""}${dayOfMonth !== null ? `DayOfMonth: ${dayOfMonth}\n` : ""}Message: ${message}`);
    }
};
