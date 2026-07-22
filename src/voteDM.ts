import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    User,
    Guild,
    TextChannel
} from "discord.js";
import fs from "fs";
import { Vote } from "./types";
import { getVotePath } from "./utils";
import { buildVoteComponents } from "./voteEmbed";

export const pendingVoteDMs = new Map<string, { guildId: string }>();

export function buildAskEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏆 BANG CHIẾN TUẦN NÀY")
        .setDescription(
`Tuần này có Bang Chiến! Bạn có muốn tham gia không?

• Nếu **Có** → Chọn Team và Class, sau đó Vote.
• Nếu **Không** → Chỉ cần nhập tên nhân vật để điểm danh.`
        );
}

export function buildAskComponents() {
    const yesButton = new ButtonBuilder()
        .setCustomId("vote_dm_yes")
        .setLabel("✅ Có — Tôi muốn Vote")
        .setStyle(ButtonStyle.Primary);

    const noButton = new ButtonBuilder()
        .setCustomId("vote_dm_no")
        .setLabel("❌ Không — Chỉ điểm danh")
        .setStyle(ButtonStyle.Secondary);

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(yesButton, noButton)
    ];
}

export async function sendVoteDM(user: User, guildId: string, channel: TextChannel) {
    try {
        await user.send({
            embeds: [buildAskEmbed()],
            components: buildAskComponents()
        });
        pendingVoteDMs.set(user.id, { guildId });
    } catch (error) {
        console.warn(`[${guildId}] Không thể gửi DM cho ${user.tag}:`, (error as Error).message);
        // Fallback: tag user in channel
        try {
            await channel.send(`📢 ${user}, Bang Chiến tuần này đã bắt đầu! Dùng \`/votebc\` để vote.`);
        } catch { /* ignore */ }
    }
}

export function recordVote(userId: string, guildId: string, name: string, team: string | null, classVal: string | null, participating: boolean) {
    const filePath = getVotePath(guildId);
    const votes: Vote[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

    const existing = votes.findIndex(v => v.userId === userId);
    const vote: Vote = {
        userId,
        name,
        team,
        class: classVal,
        participating,
        timestamp: new Date().toISOString()
    };

    if (existing !== -1) {
        votes[existing] = vote;
    } else {
        votes.push(vote);
    }

    fs.writeFileSync(filePath, JSON.stringify(votes, null, 4));
}