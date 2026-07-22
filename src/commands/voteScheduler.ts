import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from "discord.js";
import fs from "fs";
import { VoteScheduleConfig } from "../types";
import { getVoteScheduleConfigPath } from "../utils";
import { voteSchedulerManager } from "../voteScheduler";

const dayNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export const voteSchedulerCommand = {

    data: new SlashCommandBuilder()
        .setName("votescheduler")
        .setDescription("Thiết lập lịch tự động Vote Bang Chiến")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub
                .setName("config")
                .setDescription("Đặt lịch mở/khoá vote tự động")
                .addIntegerOption(opt =>
                    opt.setName("startday")
                        .setDescription("Ngày mở vote")
                        .setRequired(true)
                        .addChoices(
                            { name: "Thứ Hai", value: 1 },
                            { name: "Thứ Ba", value: 2 },
                            { name: "Thứ Tư", value: 3 },
                            { name: "Thứ Năm", value: 4 },
                            { name: "Thứ Sáu", value: 5 },
                            { name: "Thứ Bảy", value: 6 },
                            { name: "Chủ Nhật", value: 0 }
                        )
                )
                .addStringOption(opt =>
                    opt.setName("starttime")
                        .setDescription("Giờ mở vote (HH:mm)")
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName("endday")
                        .setDescription("Ngày khoá vote")
                        .setRequired(true)
                        .addChoices(
                            { name: "Thứ Hai", value: 1 },
                            { name: "Thứ Ba", value: 2 },
                            { name: "Thứ Tư", value: 3 },
                            { name: "Thứ Năm", value: 4 },
                            { name: "Thứ Sáu", value: 5 },
                            { name: "Thứ Bảy", value: 6 },
                            { name: "Chủ Nhật", value: 0 }
                        )
                )
                .addStringOption(opt =>
                    opt.setName("endtime")
                        .setDescription("Giờ khoá vote (HH:mm)")
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName("enable")
                .setDescription("Bật tự động vote")
        )
        .addSubcommand(sub =>
            sub
                .setName("disable")
                .setDescription("Tắt tự động vote")
        )
        .addSubcommand(sub =>
            sub
                .setName("status")
                .setDescription("Xem cấu hình hiện tại")
        ),

    async execute(interaction: ChatInputCommandInteraction) {

        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "config") {
            const startDay = interaction.options.getInteger("startday", true);
            const startTime = interaction.options.getString("starttime", true);
            const endDay = interaction.options.getInteger("endday", true);
            const endTime = interaction.options.getString("endtime", true);

            if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
                await interaction.reply({
                    content: "❌ Định dạng thời gian không hợp lệ. Dùng HH:mm (vd: 08:00).",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            const channel = interaction.channel;
            const isThread = channel?.isThread() ?? false;
            const channelId = isThread ? (channel as any).parentId as string : interaction.channelId!;
            const threadId = isThread ? channel!.id : undefined;

            const config: VoteScheduleConfig = {
                enabled: true,
                startDay,
                startTime,
                endDay,
                endTime,
                channelId,
                ...(threadId ? { threadId } : {})
            };

            const filePath = getVoteScheduleConfigPath(interaction.guildId);
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4));

            const scheduler = voteSchedulerManager.schedulers.get(interaction.guildId);
            if (scheduler) {
                scheduler.restart();
            }

            const location = threadId ? `<#${threadId}>` : `<#${channelId}>`;
            await interaction.reply({
                content: `✅ Đã cập nhật lịch vote:
• Mở: ${dayNames[startDay]} ${startTime}
• Khoá: ${dayNames[endDay]} ${endTime}
• Kênh gửi: ${location}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (sub === "enable" || sub === "disable") {
            const enabled = sub === "enable";
            const filePath = getVoteScheduleConfigPath(interaction.guildId);
            const config: VoteScheduleConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));
            config.enabled = enabled;
            fs.writeFileSync(filePath, JSON.stringify(config, null, 4));

            const scheduler = voteSchedulerManager.schedulers.get(interaction.guildId);
            if (scheduler) {
                scheduler.restart();
            }

            await interaction.reply({
                content: enabled ? "✅ Đã bật tự động vote." : "⏸ Đã tắt tự động vote.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        if (sub === "status") {
            const filePath = getVoteScheduleConfigPath(interaction.guildId);
            const config: VoteScheduleConfig = JSON.parse(fs.readFileSync(filePath, "utf8"));

            const target = config.threadId ? `<#${config.threadId}>` : config.channelId ? `<#${config.channelId}>` : "Chưa cấu hình";

            await interaction.reply({
                content: `📋 **Thời gian Vote Bang Chiến**
• Trạng thái: ${config.enabled ? "✅ Bật" : "⏸ Tắt"}
• Mở vote: ${dayNames[config.startDay]} ${config.startTime}
• Khoá vote: ${dayNames[config.endDay]} ${config.endTime}
• Kênh gửi: ${target}`,
                flags: MessageFlags.Ephemeral
            });
            return;
        }
    }

};