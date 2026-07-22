import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags, GuildMember } from "discord.js";
import { musicManager, MusicSubscription } from "../music";

export const playCommand = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Phát nhạc từ YouTube, Spotify, hoặc URL trực tiếp")
        .addStringOption(option =>
            option
                .setName("url")
                .setDescription("Link YouTube, Spotify, hoặc URL stream (m3u8, mp3, etc)")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const url = interaction.options.getString("url", true).trim();

        // Validar URL
        let isValidUrl = false;
        try {
            new URL(url);
            isValidUrl = true;
        } catch {
            await interaction.reply({ content: `❌ URL inválida: ${url}`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.guildId) {
            await interaction.reply({ content: "❌ Lệnh này chỉ dùng trong server.", flags: MessageFlags.Ephemeral });
            return;
        }

        const member = interaction.member instanceof GuildMember
            ? interaction.member
            : await interaction.guild?.members.fetch(interaction.user.id);

        const memberVoice = member?.voice?.channel;
        if (!memberVoice) {
            await interaction.reply({ content: "❌ Bạn phải đang ở trong voice channel.", flags: MessageFlags.Ephemeral });
            return;
        }

        if (!interaction.channel || interaction.channel.id !== memberVoice.id) {
            await interaction.reply({ content: `❌ Lệnh này chỉ dùng trong chat của kênh thoại <#${memberVoice.id}>.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        try {
            let subscription = musicManager.get(interaction.guildId);
            if (!subscription) {
                subscription = new MusicSubscription(memberVoice, interaction.channel as any, interaction.guildId);
                musicManager.set(interaction.guildId, subscription);
            }

            const wasPlaying = subscription.playing;
            const track = await subscription.enqueue(url, member.displayName);
            const status = wasPlaying ? "Đã thêm vào hàng đợi" : "▶️ Đang phát";
            await interaction.editReply(`${status}: **${track.title}**\n🔗 ${url}`);
        } catch (error) {
            console.error(`[${interaction.guildId}] Play error:`, error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            await interaction.editReply(`❌ Lỗi phát nhạc: ${errorMsg}`);
        }
    }
};
