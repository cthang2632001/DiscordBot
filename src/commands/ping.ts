import { SlashCommandBuilder } from "discord.js";

export const pingCommand = {

    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Kiểm tra bot"),

    async execute(interaction: any) {

        await interaction.reply("🏓 Pong!");

    }

}