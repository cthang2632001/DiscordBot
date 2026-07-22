import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags
} from "discord.js";

import fs from "fs";
import { Schedule } from "../types";
import { getSchedulePath } from "../utils";

export const listScheduleCommand = {

    data: new SlashCommandBuilder()
        .setName("listschedule")
        .setDescription("Xem danh sách tất cả các lịch"),

    async execute(interaction: ChatInputCommandInteraction) {

        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const filePath = getSchedulePath(interaction.guildId);
        const schedules: Schedule[] =
            JSON.parse(fs.readFileSync(filePath, "utf8"));

        if (schedules.length === 0) {
            await interaction.reply({
                content: "❌ Không có lịch nào.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("📅 Danh sách lịch gửi tin nhắn")
            .setDescription(`Tổng cộng: ${schedules.length} lịch`)


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
