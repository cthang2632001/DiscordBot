import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags
} from "discord.js";
import fs from "fs";
import { getVotePath } from "../utils";

export const voteResetCommand = {

    data: new SlashCommandBuilder()
        .setName("votereset")
        .setDescription("Reset toàn bộ Vote Bang Chiến")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction) {

        if (!interaction.guildId) {
            await interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const filePath = getVotePath(interaction.guildId);
        fs.writeFileSync(filePath, JSON.stringify([], null, 4));

        await interaction.reply("✅ Đã reset toàn bộ vote!");
    }

};
