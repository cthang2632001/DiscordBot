import {
    Client,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags
} from "discord.js";
import fs from "fs";
import { pingCommand } from "./commands/ping";
import { addScheduleCommand } from "./commands/addschedule";
import { deleteScheduleCommand } from "./commands/deleteschedule";
import { listScheduleCommand } from "./commands/listschedule";
import { editScheduleCommand } from "./commands/editschedule";
import { playCommand } from "./commands/play";
import { stopCommand } from "./commands/stop";
import { nextCommand } from "./commands/next";
import { voteBCCommand } from "./commands/voteBC";
import { voteResultCommand } from "./commands/voteResult";
import { voteResetCommand } from "./commands/voteReset";
import { voteSchedulerCommand } from "./commands/voteScheduler";
import { Vote, VoteState } from "./types";
import { getVotePath, getVoteStatePath } from "./utils";
import { pendingVoteDMs, recordVote } from "./voteDM";
import { buildVoteEmbedFromGuild, buildVoteComponents } from "./voteEmbed";

const voteSelections = new Map<string, { team: string; class: string }>();

function getGuildId(interaction: any): string | null {
    return interaction.guildId || pendingVoteDMs.get(interaction.user.id)?.guildId || null;
}

export function registerInteractions(client: Client) {

    client.on("interactionCreate", async interaction => {
        // ================= Button =================
        if (interaction.isButton()) {

            switch (interaction.customId) {

                case "vote_dm_yes": {
                    const gId = getGuildId(interaction);
                    await interaction.update({
                        embeds: [gId ? buildVoteEmbedFromGuild(gId) : buildVoteEmbedFromGuild("")],
                        components: buildVoteComponents()
                    });
                    break;
                }

                case "vote_dm_no": {
                    // User không vote — modal nhập tên
                    const modal = new ModalBuilder()
                        .setCustomId("vote_dm_name_modal")
                        .setTitle("Điểm danh Bang Chiến");

                    const nameInput = new TextInputBuilder()
                        .setCustomId("vote_name")
                        .setLabel("Tên nhân vật của bạn")
                        .setPlaceholder("Nhập tên trong game...")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(30);

                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));

                    await interaction.showModal(modal);
                    break;
                }

                case "vote_submit": {
                    const modal = new ModalBuilder()
                        .setCustomId("vote_modal")
                        .setTitle("Nhập thông tin Vote");

                    const nameInput = new TextInputBuilder()
                        .setCustomId("vote_name")
                        .setLabel("Tên nhân vật của bạn")
                        .setPlaceholder("Nhập tên trong game...")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(30);

                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput));

                    await interaction.showModal(modal);
                    break;
                }
            }

            return;
        }

        // ================= Modal Submit =================
        if (interaction.isModalSubmit()) {

            const guildId = getGuildId(interaction);
            if (!guildId) {
                await interaction.reply({
                    content: "❌ Không thể xác định server. Vui lòng thử lại.",
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            switch (interaction.customId) {

                case "vote_dm_name_modal": {
                    // Không vote — chỉ điểm danh
                    const name = interaction.fields.getTextInputValue("vote_name");
                    recordVote(interaction.user.id, guildId, name, null, null, false);
                    await interaction.reply({
                        content: `✅ Đã điểm danh **${name}**!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case "vote_modal": {
                    const state: VoteState = JSON.parse(fs.readFileSync(getVoteStatePath(guildId), "utf8"));
                    if (!state.isOpen) {
                        await interaction.reply({
                            content: "🔒 **Vote Bang Chiến tuần này đã kết thúc!**",
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }

                    const key = `${guildId}:${interaction.user.id}`;
                    const name = interaction.fields.getTextInputValue("vote_name");
                    const sel = voteSelections.get(key);

                    if (!sel || !sel.team || !sel.class) {
                        await interaction.reply({
                            content: "❌ Bạn chưa chọn Team hoặc Class!",
                            flags: MessageFlags.Ephemeral
                        });
                        break;
                    }

                    recordVote(interaction.user.id, guildId, name, sel.team, sel.class, true);

                    await interaction.reply({
                        content: `✅ Đã nhận Vote của **${name}** (${sel.team} - ${sel.class})!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
            }

            return;
        }

        // ================= Select Menu =================
        if (interaction.isStringSelectMenu()) {

            const guildId = getGuildId(interaction);
            if (!guildId) {
                await interaction.deferUpdate();
                return;
            }

            switch (interaction.customId) {

                case "vote_team": {
                    await interaction.deferUpdate();
                    const key = `${guildId}:${interaction.user.id}`;
                    const prev = voteSelections.get(key) || { team: "", class: "" };
                    prev.team = interaction.values[0];
                    voteSelections.set(key, prev);
                    break;
                }
                case "vote_class": {
                    await interaction.deferUpdate();
                    const key = `${guildId}:${interaction.user.id}`;
                    const prev = voteSelections.get(key) || { team: "", class: "" };
                    prev.class = interaction.values[0];
                    voteSelections.set(key, prev);
                    break;
                }
            }

            return;
        }

        if (!interaction.isChatInputCommand()) return;

        switch (interaction.commandName) {

            case "ping":
                await pingCommand.execute(interaction);
                break;

            case "addschedule":
                await addScheduleCommand.execute(interaction);
                break;

            case "deleteschedule":
                await deleteScheduleCommand.execute(interaction);
                break;

            case "listschedule":
                await listScheduleCommand.execute(interaction);
                break;

            case "editschedule":
                await editScheduleCommand.execute(interaction);
                break;

            case "play":
                await playCommand.execute(interaction);
                break;

            case "stop":
                await stopCommand.execute(interaction);
                break;

            case "next":
                await nextCommand.execute(interaction);
                break;
            case "votebc":
                await voteBCCommand.execute(interaction);
                break;
            case "voteresult":
                await voteResultCommand.execute(interaction);
                break;
            case "votereset":
                await voteResetCommand.execute(interaction);
                break;
            case "votescheduler":
                await voteSchedulerCommand.execute(interaction);
                break;
        }

    });

}