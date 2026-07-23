"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopCommand = void 0;
const discord_js_1 = require("discord.js");
const music_1 = require("../music");
exports.stopCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("stop")
        .setDescription("Dừng phát nhạc và xóa queue"),
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: "❌ Lệnh này chỉ dùng trong server.", flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        const subscription = music_1.musicManager.get(interaction.guildId);
        if (!subscription) {
            await interaction.reply({ content: "❌ Không có nhạc đang phát.", flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        if (!interaction.channel || interaction.channel.id !== subscription.voiceChannel.id) {
            await interaction.reply({ content: `❌ Lệnh này chỉ dùng trong chat của kênh thoại <#${subscription.voiceChannel.id}>.`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        subscription.stop();
        music_1.musicManager.delete(interaction.guildId);
        await interaction.reply("⏹️ Đã dừng và xóa queue.");
    }
};
