import path from "path";
import fs from "fs";
import { Guild, TextChannel, ThreadChannel, ChannelType } from "discord.js";
import { VoteScheduleConfig } from "./types";

const projectRoot = path.resolve(__dirname, "../");

export function getVoteScheduleConfigPath(guildId: string): string {
    const dataDir = path.join(projectRoot, "data", guildId);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, "vote-schedule-config.json");

    if (!fs.existsSync(filePath)) {
        const defaultConfig = {
            enabled: true,
            startDay: 1,     // Monday
            startTime: "00:00",
            endDay: 5,       // Friday
            endTime: "23:59",
            channelId: "",
            threadId: ""
        };
        fs.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4));
    }

    return filePath;
}

export function getVoteStatePath(guildId: string): string {
    const dataDir = path.join(projectRoot, "data", guildId);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, "vote-state.json");

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({ isOpen: false }, null, 4));
    }

    return filePath;
}

export function getVotePath(guildId: string): string {
    const dataDir = path.join(projectRoot, "data", guildId);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, "votes.json");

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 4));
    }

    return filePath;
}

export function getSchedulePath(guildId: string): string {
    const dataDir = path.join(projectRoot, "data", guildId);

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const filePath = path.join(dataDir, "schedule.json");

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([], null, 4));
    }

    return filePath;
}

export async function getVoteTargetChannel(guild: Guild, config: VoteScheduleConfig): Promise<TextChannel | ThreadChannel | null> {
    if (!config.channelId && !config.threadId) return null;

    if (config.threadId) {
        try {
            const thread = await guild.channels.fetch(config.threadId);
            if (thread?.isThread()) return thread as ThreadChannel;
        } catch { /* ignore */ }
    }

    if (config.channelId) {
        try {
            const channel = await guild.channels.fetch(config.channelId);
            if (channel?.isTextBased()) return channel as TextChannel | ThreadChannel;
        } catch { /* ignore */ }
    }

    return null;
}
