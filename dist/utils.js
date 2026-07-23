"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVoteScheduleConfigPath = getVoteScheduleConfigPath;
exports.getVoteStatePath = getVoteStatePath;
exports.getVotePath = getVotePath;
exports.getSchedulePath = getSchedulePath;
exports.getVoteTargetChannel = getVoteTargetChannel;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const projectRoot = path_1.default.resolve(__dirname, "../");
function getVoteScheduleConfigPath(guildId) {
    const dataDir = path_1.default.join(projectRoot, "data", guildId);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path_1.default.join(dataDir, "vote-schedule-config.json");
    if (!fs_1.default.existsSync(filePath)) {
        const defaultConfig = {
            enabled: true,
            startDay: 1, // Monday
            startTime: "00:00",
            endDay: 5, // Friday
            endTime: "23:59",
            channelId: "",
            threadId: ""
        };
        fs_1.default.writeFileSync(filePath, JSON.stringify(defaultConfig, null, 4));
    }
    return filePath;
}
function getVoteStatePath(guildId) {
    const dataDir = path_1.default.join(projectRoot, "data", guildId);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path_1.default.join(dataDir, "vote-state.json");
    if (!fs_1.default.existsSync(filePath)) {
        fs_1.default.writeFileSync(filePath, JSON.stringify({ isOpen: false }, null, 4));
    }
    return filePath;
}
function getVotePath(guildId) {
    const dataDir = path_1.default.join(projectRoot, "data", guildId);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path_1.default.join(dataDir, "votes.json");
    if (!fs_1.default.existsSync(filePath)) {
        fs_1.default.writeFileSync(filePath, JSON.stringify([], null, 4));
    }
    return filePath;
}
function getSchedulePath(guildId) {
    const dataDir = path_1.default.join(projectRoot, "data", guildId);
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path_1.default.join(dataDir, "schedule.json");
    if (!fs_1.default.existsSync(filePath)) {
        fs_1.default.writeFileSync(filePath, JSON.stringify([], null, 4));
    }
    return filePath;
}
async function getVoteTargetChannel(guild, config) {
    if (!config.channelId && !config.threadId)
        return null;
    if (config.threadId) {
        try {
            const thread = await guild.channels.fetch(config.threadId);
            if (thread?.isThread())
                return thread;
        }
        catch { /* ignore */ }
    }
    if (config.channelId) {
        try {
            const channel = await guild.channels.fetch(config.channelId);
            if (channel?.isTextBased())
                return channel;
        }
        catch { /* ignore */ }
    }
    return null;
}
