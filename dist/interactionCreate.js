"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInteractions = registerInteractions;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const ping_1 = require("./commands/ping");
const addschedule_1 = require("./commands/addschedule");
const deleteschedule_1 = require("./commands/deleteschedule");
const listschedule_1 = require("./commands/listschedule");
const editschedule_1 = require("./commands/editschedule");
const play_1 = require("./commands/play");
const stop_1 = require("./commands/stop");
const next_1 = require("./commands/next");
const voteBC_1 = require("./commands/voteBC");
const voteResult_1 = require("./commands/voteResult");
const voteReset_1 = require("./commands/voteReset");
const voteScheduler_1 = require("./commands/voteScheduler");
const utils_1 = require("./utils");
const voteDM_1 = require("./voteDM");
const voteEmbed_1 = require("./voteEmbed");
const voteSelections = new Map();
function getGuildId(interaction) {
    return interaction.guildId || voteDM_1.pendingVoteDMs.get(interaction.user.id)?.guildId || null;
}
function registerInteractions(client) {
    client.on("interactionCreate", async (interaction) => {
        // ================= Button =================
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case "vote_dm_yes": {
                    const gId = getGuildId(interaction);
                    await interaction.update({
                        embeds: [gId ? (0, voteEmbed_1.buildVoteEmbedFromGuild)(gId) : (0, voteEmbed_1.buildVoteEmbedFromGuild)("")],
                        components: (0, voteEmbed_1.buildVoteComponents)()
                    });
                    break;
                }
                case "vote_dm_no": {
                    // User không vote — modal nhập tên
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId("vote_dm_name_modal")
                        .setTitle("Điểm danh Bang Chiến");
                    const nameInput = new discord_js_1.TextInputBuilder()
                        .setCustomId("vote_name")
                        .setLabel("Tên nhân vật của bạn")
                        .setPlaceholder("Nhập tên trong game...")
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(30);
                    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput));
                    await interaction.showModal(modal);
                    break;
                }
                case "vote_submit": {
                    const modal = new discord_js_1.ModalBuilder()
                        .setCustomId("vote_modal")
                        .setTitle("Nhập thông tin Vote");
                    const nameInput = new discord_js_1.TextInputBuilder()
                        .setCustomId("vote_name")
                        .setLabel("Tên nhân vật của bạn")
                        .setPlaceholder("Nhập tên trong game...")
                        .setStyle(discord_js_1.TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(2)
                        .setMaxLength(30);
                    modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput));
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
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
                return;
            }
            switch (interaction.customId) {
                case "vote_dm_name_modal": {
                    // Không vote — chỉ điểm danh
                    const name = interaction.fields.getTextInputValue("vote_name");
                    (0, voteDM_1.recordVote)(interaction.user.id, guildId, name, null, null, false);
                    await interaction.reply({
                        content: `✅ Đã điểm danh **${name}**!`,
                        flags: discord_js_1.MessageFlags.Ephemeral
                    });
                    break;
                }
                case "vote_modal": {
                    const state = JSON.parse(fs_1.default.readFileSync((0, utils_1.getVoteStatePath)(guildId), "utf8"));
                    if (!state.isOpen) {
                        await interaction.reply({
                            content: "🔒 **Vote Bang Chiến tuần này đã kết thúc!**",
                            flags: discord_js_1.MessageFlags.Ephemeral
                        });
                        break;
                    }
                    const key = `${guildId}:${interaction.user.id}`;
                    const name = interaction.fields.getTextInputValue("vote_name");
                    const sel = voteSelections.get(key);
                    if (!sel || !sel.team || !sel.class) {
                        await interaction.reply({
                            content: "❌ Bạn chưa chọn Team hoặc Class!",
                            flags: discord_js_1.MessageFlags.Ephemeral
                        });
                        break;
                    }
                    (0, voteDM_1.recordVote)(interaction.user.id, guildId, name, sel.team, sel.class, true);
                    await interaction.reply({
                        content: `✅ Đã nhận Vote của **${name}** (${sel.team} - ${sel.class})!`,
                        flags: discord_js_1.MessageFlags.Ephemeral
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
        if (!interaction.isChatInputCommand())
            return;
        switch (interaction.commandName) {
            case "ping":
                await ping_1.pingCommand.execute(interaction);
                break;
            case "addschedule":
                await addschedule_1.addScheduleCommand.execute(interaction);
                break;
            case "deleteschedule":
                await deleteschedule_1.deleteScheduleCommand.execute(interaction);
                break;
            case "listschedule":
                await listschedule_1.listScheduleCommand.execute(interaction);
                break;
            case "editschedule":
                await editschedule_1.editScheduleCommand.execute(interaction);
                break;
            case "play":
                await play_1.playCommand.execute(interaction);
                break;
            case "stop":
                await stop_1.stopCommand.execute(interaction);
                break;
            case "next":
                await next_1.nextCommand.execute(interaction);
                break;
            case "votebc":
                await voteBC_1.voteBCCommand.execute(interaction);
                break;
            case "voteresult":
                await voteResult_1.voteResultCommand.execute(interaction);
                break;
            case "votereset":
                await voteReset_1.voteResetCommand.execute(interaction);
                break;
            case "votescheduler":
                await voteScheduler_1.voteSchedulerCommand.execute(interaction);
                break;
        }
    });
}
