"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pingCommand = void 0;
const discord_js_1 = require("discord.js");
exports.pingCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("ping")
        .setDescription("Kiểm tra bot"),
    async execute(interaction) {
        await interaction.reply("🏓 Pong!");
    }
};
