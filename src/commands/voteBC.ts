import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits
} from "discord.js";
import { buildVoteEmbedFromGuild, buildVoteComponents } from "../voteEmbed";
import { sendVoteDM } from "../voteDM";

export const voteBCCommand = {

    data: new SlashCommandBuilder()
        .setName("votebc")
        .setDescription("Tạo Vote Bang Chiến")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply();

        await interaction.editReply({
            content: "@everyone",
            allowedMentions: {
                parse: ["everyone"]
            },
            embeds: [buildVoteEmbedFromGuild(interaction.guildId!)],
            components: buildVoteComponents()
        });

        // Gửi DM đến các thành viên
        if (!interaction.guildId || !interaction.guild) return;
        try {
            let members;
            try {
                members = await interaction.guild.members.fetch();
            } catch {
                members = interaction.guild.members.cache;
            }
            let sent = 0;
            for (const [, member] of members) {
                if (member.user.bot) continue;
                await sendVoteDM(member.user, interaction.guildId, interaction.channel as any);
                sent++;
                if (sent % 5 === 0) {
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            console.log(`[${interaction.guildId}] Đã gửi DM vote cho ${sent} thành viên.`);
        } catch (error) {
            console.error(`[${interaction.guildId}] Lỗi gửi DM:`, error);
        }
    }

};