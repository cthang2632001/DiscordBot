import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from "discord.js";
import fs from "fs";
import { VoteScheduleConfig } from "../types";
import { getVoteScheduleConfigPath, getVoteTargetChannel } from "../utils";
import { buildVoteEmbedFromGuild, buildVoteComponents } from "../voteEmbed";
import { sendVoteDM } from "../voteDM";

export const voteBCCommand = {

    data: new SlashCommandBuilder()
        .setName("votebc")
        .setDescription("Tạo Vote Bang Chiến")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild;
        const guildId = interaction.guildId;
        if (!guild || !guildId) {
            await interaction.editReply("❌ Lệnh này chỉ hoạt động trong server.");
            return;
        }

        // Đọc config để lấy kênh/thread đã cấu hình
        const config: VoteScheduleConfig = JSON.parse(
            fs.readFileSync(getVoteScheduleConfigPath(guildId), "utf8")
        );
        const target = await getVoteTargetChannel(guild, config);

        if (!target) {
            await interaction.editReply("❌ Chưa cấu hình kênh gửi vote. Dùng `/votescheduler config` trước.");
            return;
        }

        await target.send({
            content: "@everyone",
            allowedMentions: {
                parse: ["everyone"]
            },
            embeds: [buildVoteEmbedFromGuild(guildId)],
            components: buildVoteComponents()
        });

        await interaction.editReply(`✅ Đã gửi vote đến ${target}.`);

        // Gửi DM đến các thành viên
        try {
            let members;
            try {
                members = await guild.members.fetch();
            } catch {
                members = guild.members.cache;
            }
            let sent = 0;
            for (const [, member] of members) {
                if (member.user.bot) continue;
                await sendVoteDM(member.user, guildId, target);
                sent++;
                if (sent % 5 === 0) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            console.log(`[${guildId}] Đã gửi DM vote cho ${sent} thành viên.`);
        } catch (error) {
            console.error(`[${guildId}] Lỗi gửi DM:`, error);
        }
    }

};