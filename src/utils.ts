import path from "path";
import fs from "fs";

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
            endTime: "23:59"
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
