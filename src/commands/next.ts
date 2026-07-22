import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, GuildMember } from "discord.js";
import { musicManager } from "../music";

export const nextCommand = {
    data: new SlashCommandBuilder()
        .setName("next")
        .setDescription("Bỏ qua bài đang phát và phát bài tiếp theo"),

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

        subscription.skip();
        await interaction.reply("⏭️ Bài hiện tại đã bị bỏ qua.");
    }
};
