"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteResetCommand = void 0;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
exports.voteResetCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("votereset")
        .setDescription("Reset toàn bộ Vote Bang Chiến")
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
            return;
        }
        const filePath = (0, utils_1.getVotePath)(interaction.guildId);
        fs_1.default.writeFileSync(filePath, JSON.stringify([], null, 4));
        await interaction.reply("✅ Đã reset toàn bộ vote!");
    }
};
