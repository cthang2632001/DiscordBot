import {
    ChannelType,
    Client,
    GatewayIntentBits,
    Guild,
    TextChannel
} from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { registerInteractions } from "./interactionCreate";
import { Scheduler, schedulerManager } from "./scheduler";
import { VoteScheduler, voteSchedulerManager } from "./voteScheduler";
import { VoteScheduleConfig } from "./types";
import { getVoteScheduleConfigPath, getVoteTargetChannel } from "./utils";
import { deployCommands } from "./deploy-commands";

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

registerInteractions(client);

client.once("clientReady", async (client) => {
    console.log(`✅ Bot đã đăng nhập: ${client.user.tag}`);

    const allGuildIds = [...client.guilds.cache.keys()];

    try {
        await deployCommands(allGuildIds);
    } catch (error) {
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
        await deployCommands([guild.id]);
    } catch (error) {
        console.error(`❌ Không thể đăng ký slash commands cho ${guild.id}:`, error);
    }

    await initializeScheduler(guild.id);
    await initializeVoteScheduler(guild.id);
});

client.on("guildDelete", async (guild) => {
    console.log(`➖ Bot rời server: ${guild.name} (${guild.id})`);

    // Dọn dẹp scheduler
    schedulerManager.schedulers.delete(guild.id);
    voteSchedulerManager.schedulers.get(guild.id)?.stop();
    voteSchedulerManager.schedulers.delete(guild.id);

    // Xóa data của server
    const dataDir = path.resolve(__dirname, "../data", guild.id);
    if (fs.existsSync(dataDir)) {
        fs.rmSync(dataDir, { recursive: true, force: true });
        console.log(`🗑 Đã xóa data của server ${guild.id}`);
    }
});

async function initializeScheduler(guildId: string) {
    // Kiểm tra nếu Scheduler đã tồn tại cho guild này
    if (schedulerManager.schedulers.has(guildId)) {
        return;
    }

    try {
        const guild = await client.guilds.fetch(guildId);
        const channel = await findDefaultTextChannel(guild);

        if (!channel) {
            console.log(`❌ [${guildId}] Không tìm thấy text channel phù hợp`);
            return;
        }

        const scheduler = new Scheduler(channel, guildId);
        schedulerManager.schedulers.set(guildId, scheduler);
        scheduler.reload();

        console.log(`✅ [${guildId}] Scheduler khởi tạo tại channel #${channel.name}`);
    } catch (error) {
        console.error(`❌ [${guildId}] Lỗi khởi tạo scheduler:`, error);
    }
}

async function findDefaultTextChannel(guild: Guild): Promise<TextChannel | null> {
    const channels = await guild.channels.fetch();

    return channels.find((channel): channel is TextChannel => Boolean(
        channel &&
        channel.isTextBased() &&
        channel.type === ChannelType.GuildText
    )) ?? null;
}

async function initializeVoteScheduler(guildId: string) {
    if (voteSchedulerManager.schedulers.has(guildId)) {
        return;
    }

    try {
        const guild = await client.guilds.fetch(guildId);

        // Thử lấy channel từ config trước
        let channel: TextChannel | null = null;
        try {
            const config: VoteScheduleConfig = JSON.parse(
                fs.readFileSync(getVoteScheduleConfigPath(guildId), "utf8")
            );
            const target = await getVoteTargetChannel(guild, config);
            if (target) {
                channel = target instanceof TextChannel ? target : (target.parent as TextChannel);
            }
        } catch { /* fallback */ }

        if (!channel) {
            channel = await findDefaultTextChannel(guild);
        }

        if (!channel) {
            console.log(`❌ [${guildId}] Không tìm thấy text channel cho vote scheduler`);
            return;
        }

        const voteScheduler = new VoteScheduler(channel, guildId);
        voteSchedulerManager.schedulers.set(guildId, voteScheduler);
        voteScheduler.start();
    } catch (error) {
        console.error(`❌ [${guildId}] Lỗi khởi tạo vote scheduler:`, error);
    }
}

client.login(process.env.TOKEN);