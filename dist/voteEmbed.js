"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_NAMES = void 0;
exports.buildVoteEmbedFromGuild = buildVoteEmbedFromGuild;
exports.buildVoteEmbed = buildVoteEmbed;
exports.buildVoteComponents = buildVoteComponents;
const fs_1 = __importDefault(require("fs"));
const discord_js_1 = require("discord.js");
const utils_1 = require("./utils");
const DAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
exports.DAY_NAMES = DAY_NAMES;
function buildVoteEmbedFromGuild(guildId) {
    try {
        const config = JSON.parse(fs_1.default.readFileSync((0, utils_1.getVoteScheduleConfigPath)(guildId), "utf8"));
        return buildVoteEmbed(config.startDay, config.startTime, config.endDay, config.endTime);
    }
    catch {
        return buildVoteEmbed();
    }
}
function buildVoteEmbed(startDay, startTime, endDay, endTime) {
    const start = startDay !== undefined ? `${DAY_NAMES[startDay]} ${startTime}` : "Thứ Hai";
    const end = endDay !== undefined ? `${DAY_NAMES[endDay]} ${endTime}` : "Thứ Sáu 23:59";
    return new discord_js_1.EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏆 VOTE BANG CHIẾN TUẦN")
        .setDescription(`📢 Hãy tham gia Vote Bang Chiến.

📅 Thời gian:
• Bắt đầu: ${start}
• Kết thúc: ${end}

⚠ Mỗi người chỉ được Vote một lần.
Bạn có thể thay đổi lựa chọn trước khi bấm nút Vote.`)
        .setFooter({
        text: `💡 Lưu ý: Vote sẽ được reset vào ${DAY_NAMES[startDay ?? 1]} hàng tuần.`
    });
}
function buildVoteComponents() {
    const teamMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("vote_team")
        .setPlaceholder("Chọn Team")
        .addOptions({ label: "Team Công", value: "Team Công", emoji: "⚔️" }, { label: "Team Thủ", value: "Team Thủ", emoji: "🛡️" }, { label: "Team Vật tư", value: "Team Vật tư", emoji: "📦" }, { label: "Team Trụ", value: "Team Trụ", emoji: "🏯" });
    const classMenu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("vote_class")
        .setPlaceholder("Chọn Class")
        .addOptions({ label: "Cửu Linh", value: "Cửu Linh" }, { label: "Toái Mộng", value: "Toái Mộng" }, { label: "Thiết Y", value: "Thiết Y" }, { label: "Tố Vấn", value: "Tố Vấn" }, { label: "Long Ngâm", value: "Long Ngâm" }, { label: "Huyết Hà", value: "Huyết Hà" });
    const voteButton = new discord_js_1.ButtonBuilder()
        .setCustomId("vote_submit")
        .setLabel("✔ Vote")
        .setStyle(discord_js_1.ButtonStyle.Success);
    return [
        new discord_js_1.ActionRowBuilder().addComponents(teamMenu),
        new discord_js_1.ActionRowBuilder().addComponents(classMenu),
        new discord_js_1.ActionRowBuilder().addComponents(voteButton)
    ];
}
