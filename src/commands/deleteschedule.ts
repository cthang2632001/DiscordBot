import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags
} from "discord.js";

import fs from "fs";
import { Schedule } from "../types";
import { schedulerManager } from "../scheduler";
import { getSchedulePath } from "../utils";

export const deleteScheduleCommand = {

    data: new SlashCommandBuilder()
        .setName("deleteschedule")
        .setDescription("Xóa lịch gửi tin nhắn")
        .addIntegerOption(option =>
            option
                .setName("id")
                .setDescription("ID của lịch cần xóa")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {

        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const filePath = getSchedulePath(interaction.guildId);
        const id = interaction.options.getInteger("id", true);

        const schedules: Schedule[] =
            JSON.parse(fs.readFileSync(filePath, "utf8"));

        const scheduleIndex = schedules.findIndex(s => s.id === id);

        if (scheduleIndex === -1) {
            await interaction.reply({
                content: `❌ Không tìm thấy lịch có ID: ${id}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const deletedSchedule = schedules.splice(scheduleIndex, 1)[0];

        fs.writeFileSync(
            filePath,
            JSON.stringify(schedules, null, 4)
        );

        // ✅ Reload lịch sau khi xóa
        const scheduler = schedulerManager.schedulers.get(interaction.guildId);
        scheduler?.reload();

        await interaction.reply(
            `✅ Đã xóa lịch

            ID: ${deletedSchedule.id}
            Time: ${deletedSchedule.time}
            Message: ${deletedSchedule.message}`
        );

    }

};
