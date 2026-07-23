"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.voteResultCommand = void 0;
exports.buildVoteResultEmbeds = buildVoteResultEmbeds;
const discord_js_1 = require("discord.js");
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("../utils");
const TEAM_ORDER = [
    "Team Công",
    "Team Thủ",
    "Team Trụ",
    "Team Vật tư"
];
function buildVoteResultEmbeds(guildId) {
    const votes = JSON.parse(fs_1.default.readFileSync((0, utils_1.getVotePath)(guildId), "utf8"));
    if (!votes.length)
        return [];
    const participants = votes.filter(v => v.participating);
    const nonParticipants = votes.filter(v => !v.participating);
    const teams = new Map();
    const teamCount = new Map();
    const classCount = new Map();
    for (const t of TEAM_ORDER) {
        teams.set(t, []);
        teamCount.set(t, 0);
    }
    for (const v of participants) {
        if (v.team && teams.has(v.team)) {
            teams.get(v.team).push(v);
            teamCount.set(v.team, teamCount.get(v.team) + 1);
        }
        if (v.class) {
            classCount.set(v.class, (classCount.get(v.class) ?? 0) + 1);
        }
    }
    const statEmbed = new discord_js_1.EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏆 KẾT QUẢ VOTE BANG CHIẾN");
    statEmbed.addFields({
        name: `📊 Theo Team (${participants.length} người)`,
        value: TEAM_ORDER
            .map(t => `${t}: **${teamCount.get(t)}**`)
            .join("\n"),
        inline: true
    }, {
        name: "📊 Theo Class",
        value: [...classCount.entries()]
            .map(([c, n]) => `${c}: **${n}**`)
            .join("\n") || "Chưa có",
        inline: true
    });
    if (nonParticipants.length) {
        statEmbed.addFields({
            name: `❌ Không tham gia (${nonParticipants.length})`,
            value: nonParticipants
                .map((v, i) => `${i + 1}. ${v.name}`)
                .join("\n"),
            inline: false
        });
    }
    statEmbed.setFooter({
        text: `Tổng số: ${votes.length} | Tham gia: ${participants.length} | Không tham gia: ${nonParticipants.length}`
    });
    const teamEmbed = new discord_js_1.EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("👥 DANH SÁCH TEAM");
    for (let i = 0; i < 3; i++) {
        const team = TEAM_ORDER[i];
        const members = teams.get(team);
        teamEmbed.addFields({
            name: team,
            value: members.length
                ? members.map(m => `• ${m.name} (${m.class})`).join("\n")
                : "• Chưa có",
            inline: true
        });
    }
    teamEmbed.addFields({
        name: "\u200B",
        value: "\u200B",
        inline: false
    });
    const vatTu = teams.get("Team Vật tư");
    teamEmbed.addFields({
        name: "Team Vật tư",
        value: vatTu.length
            ? vatTu.map(m => `• ${m.name} (${m.class})`).join("\n")
            : "• Chưa có",
        inline: false
    });
    return [statEmbed, teamEmbed];
}
exports.voteResultCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("voteresult")
        .setDescription("Xem kết quả Vote Bang Chiến"),
    async execute(interaction) {
        if (!interaction.guildId) {
            return interaction.reply({
                content: "❌ Lệnh này chỉ hoạt động trong server.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
        const embeds = buildVoteResultEmbeds(interaction.guildId);
        if (!embeds.length) {
            return interaction.reply({
                content: "❌ Chưa có vote nào.",
                flags: discord_js_1.MessageFlags.Ephemeral
            });
        }
        await interaction.reply({ embeds });
    }
};
