"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const interactionCreate_1 = require("./interactionCreate");
const scheduler_1 = require("./scheduler");
const voteScheduler_1 = require("./voteScheduler");
const utils_1 = require("./utils");
const deploy_commands_1 = require("./deploy-commands");
dotenv_1.default.config();
const client = new discord_js_1.Client({
    intents: [discord_js_1.GatewayIntentBits.Guilds, discord_js_1.GatewayIntentBits.GuildMessages, discord_js_1.GatewayIntentBits.GuildVoiceStates, discord_js_1.GatewayIntentBits.GuildMembers]
});
(0, interactionCreate_1.registerInteractions)(client);
client.once("clientReady", async (client) => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);
    const allGuildIds = [...client.guilds.cache.keys()];
    try {
        await (0, deploy_commands_1.deployCommands)(allGuildIds);
    }
    catch (error) {
        console.error("❌ Không thể đăng ký slash commands:", error);
    }
    for (const guildId of allGuildIds) {
        await initializeScheduler(guildId);
        await initializeVoteScheduler(guildId);
    }
});
client.on("guildCreate", async (guild) => {
    console.log(`➕ Bot tham gia server: ${guild.name} (${guild.id})`);
    try {
        await (0, deploy_commands_1.deployCommands)([guild.id]);
    }
    catch (error) {
        console.error(`❌ Không thể đăng ký slash commands cho ${guild.id}:`, error);
    }
    await initializeScheduler(guild.id);
    await initializeVoteScheduler(guild.id);
});
client.on("guildDelete", async (guild) => {
    console.log(`➖ Bot rời server: ${guild.name} (${guild.id})`);
    // Dọn dẹp scheduler
    scheduler_1.schedulerManager.schedulers.delete(guild.id);
    voteScheduler_1.voteSchedulerManager.schedulers.get(guild.id)?.stop();
    voteScheduler_1.voteSchedulerManager.schedulers.delete(guild.id);
    // Xóa data của server
    const dataDir = path_1.default.resolve(__dirname, "../data", guild.id);
    if (fs_1.default.existsSync(dataDir)) {
        fs_1.default.rmSync(dataDir, { recursive: true, force: true });
        console.log(`🗑 Đã xóa data của server ${guild.id}`);
    }
});
async function initializeScheduler(guildId) {
    // Kiểm tra nếu Scheduler đã tồn tại cho guild này
    if (scheduler_1.schedulerManager.schedulers.has(guildId)) {
        return;
    }
    try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await findDefaultTextChannel(guild);
        if (!channel) {
            console.log(`❌ [${guildId}] Không tìm thấy text channel phù hợp`);
            return;
        }
        const scheduler = new scheduler_1.Scheduler(channel, guildId);
        scheduler_1.schedulerManager.schedulers.set(guildId, scheduler);
        scheduler.reload();
        console.log(`✅ [${guildId}] Scheduler khởi tạo tại channel #${channel.name}`);
    }
    catch (error) {
        console.error(`❌ [${guildId}] Lỗi khởi tạo scheduler:`, error);
    }
}
async function findDefaultTextChannel(guild) {
    const channels = await guild.channels.fetch();
    return channels.find((channel) => Boolean(channel &&
        channel.isTextBased() &&
        channel.type === discord_js_1.ChannelType.GuildText)) ?? null;
}
async function initializeVoteScheduler(guildId) {
    if (voteScheduler_1.voteSchedulerManager.schedulers.has(guildId)) {
        return;
    }
    try {
        const guild = await client.guilds.fetch(guildId);
        // Thử lấy channel từ config trước
        let channel = null;
        try {
            const config = JSON.parse(fs_1.default.readFileSync((0, utils_1.getVoteScheduleConfigPath)(guildId), "utf8"));
            const target = await (0, utils_1.getVoteTargetChannel)(guild, config);
            if (target) {
                channel = target instanceof discord_js_1.TextChannel ? target : target.parent;
            }
        }
        catch { /* fallback */ }
        if (!channel) {
            channel = await findDefaultTextChannel(guild);
        }
        if (!channel) {
            console.log(`❌ [${guildId}] Không tìm thấy text channel cho vote scheduler`);
            return;
        }
        const voteScheduler = new voteScheduler_1.VoteScheduler(channel, guildId);
        voteScheduler_1.voteSchedulerManager.schedulers.set(guildId, voteScheduler);
        voteScheduler.start();
    }
    catch (error) {
        console.error(`❌ [${guildId}] Lỗi khởi tạo vote scheduler:`, error);
    }
}
client.login(process.env.TOKEN);
