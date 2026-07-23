"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextCommand = void 0;
const discord_js_1 = require("discord.js");
const music_1 = require("../music");
exports.nextCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("next")
        .setDescription("Bỏ qua bài đang phát và phát bài tiếp theo"),
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
        subscription.skip();
        await interaction.reply("⏭️ Bài hiện tại đã bị bỏ qua.");
    }
};
