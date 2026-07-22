import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, GuildMember } from "discord.js";
import { musicManager } from "../music";

export const stopCommand = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Dừng phát nhạc và xóa queue"),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: "❌ Lệnh này chỉ dùng trong server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const subscription = musicManager.get(interaction.guildId);
        if (!subscription) {
            await interaction.reply({ content: "❌ Không có nhạc đang phát.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.channel || interaction.channel.id !== subscription.voiceChannel.id) {
            await interaction.reply({ content: `❌ Lệnh này chỉ dùng trong chat của kênh thoại <#${subscription.voiceChannel.id}>.`, flags: MessageFlags.Ephemeral });
            return;
        }

        subscription.stop();
        musicManager.delete(interaction.guildId);

        await interaction.reply("⏹️ Đã dừng và xóa queue.");
    }
};
