"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pendingVoteDMs = void 0;
exports.buildAskEmbed = buildAskEmbed;
exports.buildAskComponents = buildAskComponents;
exports.sendVoteDM = sendVoteDM;
exports.recordVote = recordVote;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
exports.pendingVoteDMs = new Map();
function buildAskEmbed() {
    return new discord_js_1.EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏆 BANG CHIẾN TUẦN NÀY")
        .setDescription(`Tuần này có Bang Chiến! Bạn có muốn tham gia không?

• Nếu **Có** → Chọn Team và Class, sau đó Vote.
• Nếu **Không** → Chỉ cần nhập tên nhân vật để điểm danh.`);
}
function buildAskComponents() {
    const yesButton = new discord_js_1.ButtonBuilder()
        .setCustomId("vote_dm_yes")
        .setLabel("✅ Có — Tôi muốn Vote")
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const noButton = new discord_js_1.ButtonBuilder()
        .setCustomId("vote_dm_no")
        .setLabel("❌ Không — Chỉ điểm danh")
        .setStyle(discord_js_1.ButtonStyle.Secondary);
    return [
        new discord_js_1.ActionRowBuilder().addComponents(yesButton, noButton)
    ];
}
async function sendVoteDM(user, guildId, channel) {
    try {
        await user.send({
            embeds: [buildAskEmbed()],
            components: buildAskComponents()
        });
        exports.pendingVoteDMs.set(user.id, { guildId });
    }
    catch (error) {
        console.warn(`[${guildId}] Không thể gửi DM cho ${user.tag}:`, error.message);
        // Fallback: tag user in channel
        try {
            await channel.send(`📢 ${user}, Bang Chiến tuần này đã bắt đầu! Dùng \`/votebc\` để vote.`);
        }
        catch { /* ignore */ }
    }
}
function recordVote(userId, guildId, name, team, classVal, participating) {
    const filePath = (0, utils_1.getVotePath)(guildId);
    const votes = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
    const existing = votes.findIndex(v => v.userId === userId);
    const vote = {
        userId,
        name,
        team,
        class: classVal,
        participating,
        timestamp: new Date().toISOString()
    };
    if (existing !== -1) {
        votes[existing] = vote;
    }
    else {
        votes.push(vote);
    }
    fs_1.default.writeFileSync(filePath, JSON.stringify(votes, null, 4));
}
