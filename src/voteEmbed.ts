import fs from "fs";
import {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle
} from "discord.js";
import { VoteScheduleConfig } from "./types";
import { getVoteScheduleConfigPath } from "./utils";

const DAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function buildVoteEmbedFromGuild(guildId: string): EmbedBuilder {
    try {
        const config: VoteScheduleConfig = JSON.parse(fs.readFileSync(getVoteScheduleConfigPath(guildId), "utf8"));
        return buildVoteEmbed(config.startDay, config.startTime, config.endDay, config.endTime);
    } catch {
        return buildVoteEmbed();
    }
}

export function buildVoteEmbed(
    startDay?: number,
    startTime?: string,
    endDay?: number,
    endTime?: string
): EmbedBuilder {
    const start = startDay !== undefined ? `${DAY_NAMES[startDay]} ${startTime}` : "Thứ Hai";
    const end = endDay !== undefined ? `${DAY_NAMES[endDay]} ${endTime}` : "Thứ Sáu 23:59";

    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🏆 VOTE BANG CHIẾN TUẦN")
        .setDescription(
`📢 Hãy tham gia Vote Bang Chiến.

📅 Thời gian:
• Bắt đầu: ${start}
• Kết thúc: ${end}

⚠ Mỗi người chỉ được Vote một lần.
Bạn có thể thay đổi lựa chọn trước khi bấm nút Vote.`
        )
        .setFooter({
            text: `💡 Lưu ý: Vote sẽ được reset vào ${DAY_NAMES[startDay ?? 1]} hàng tuần.`
        });
}

export { DAY_NAMES };

export function buildVoteComponents() {
    const teamMenu =
        new StringSelectMenuBuilder()
            .setCustomId("vote_team")
            .setPlaceholder("Chọn Team")
            .addOptions(
                { label: "Team Công", value: "Team Công", emoji: "⚔️" },
                { label: "Team Thủ", value: "Team Thủ", emoji: "🛡️" },
                { label: "Team Vật tư", value: "Team Vật tư", emoji: "📦" },
                { label: "Team Trụ", value: "Team Trụ", emoji: "🏯" }
            );

    const classMenu =
        new StringSelectMenuBuilder()
            .setCustomId("vote_class")
            .setPlaceholder("Chọn Class")
            .addOptions(
                { label: "Cửu Linh", value: "Cửu Linh" },
                { label: "Toái Mộng", value: "Toái Mộng" },
                { label: "Thiết Y", value: "Thiết Y" },
                { label: "Tố Vấn", value: "Tố Vấn" },
                { label: "Long Ngâm", value: "Long Ngâm" },
                { label: "Huyết Hà", value: "Huyết Hà" }
            );

    const voteButton =
        new ButtonBuilder()
            .setCustomId("vote_submit")
            .setLabel("✔ Vote")
            .setStyle(ButtonStyle.Success);

    return [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamMenu),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(classMenu),
        new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton)
    ];
}