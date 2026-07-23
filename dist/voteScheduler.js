"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteScheduler = exports.voteSchedulerManager = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
const voteEmbed_1 = require("./voteEmbed");
const voteDM_1 = require("./voteDM");
const voteResult_1 = require("./commands/voteResult");
exports.voteSchedulerManager = {
    schedulers: new Map()
};
class VoteScheduler {
    defaultChannel;
    guildId;
    jobs = [];
    guild;
    channel = null;
    constructor(defaultChannel, guildId) {
        this.defaultChannel = defaultChannel;
        this.guildId = guildId;
        this.guild = defaultChannel.guild;
    }
    clearJobs() {
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
    }
    readConfig() {
        const filePath = (0, utils_1.getVoteScheduleConfigPath)(this.guildId);
        return JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
    }
    async resolveChannel() {
        if (this.channel)
            return this.channel;
        const config = this.readConfig();
        const target = await (0, utils_1.getVoteTargetChannel)(this.guild, config);
        if (target) {
            this.channel = target;
            return target;
        }
        return this.defaultChannel;
    }
    start() {
        this.clearJobs();
        this.channel = null; // reset cached channel
        const config = this.readConfig();
        if (!config.enabled) {
            console.log(`[${this.guildId}] ⏸ Vote scheduler đã tắt.`);
            return;
        }
        const [startHour, startMinute] = config.startTime.split(":");
        const [endHour, endMinute] = config.endTime.split(":");
        const openCron = `0 ${startMinute} ${startHour} * * ${config.startDay}`;
        const closeCron = `0 ${endMinute} ${endHour} * * ${config.endDay}`;
        const openJob = node_cron_1.default.schedule(openCron, async () => {
            console.log(`[${this.guildId}] Mở vote tuần mới`);
            fs_1.default.writeFileSync((0, utils_1.getVotePath)(this.guildId), JSON.stringify([], null, 4));
            const statePath = (0, utils_1.getVoteStatePath)(this.guildId);
            fs_1.default.writeFileSync(statePath, JSON.stringify({ isOpen: true }, null, 4));
            const target = await this.resolveChannel();
            // Gửi vote embed trong channel server
            try {
                await target.send({
                    content: "@everyone",
                    allowedMentions: { parse: ["everyone"] },
                    embeds: [(0, voteEmbed_1.buildVoteEmbedFromGuild)(this.guildId)],
                    components: (0, voteEmbed_1.buildVoteComponents)()
                });
            }
            catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi vote embed:`, error);
            }
            // Gửi DM đến tất cả members
            if (this.guild) {
                try {
                    let members;
                    try {
                        members = await this.guild.members.fetch();
                    }
                    catch {
                        members = this.guild.members.cache;
                    }
                    let sent = 0;
                    for (const [, member] of members) {
                        if (member.user.bot)
                            continue;
                        await (0, voteDM_1.sendVoteDM)(member.user, this.guildId, this.defaultChannel);
                        sent++;
                        if (sent % 5 === 0) {
                            await new Promise(r => setTimeout(r, 1000)); // rate limit
                        }
                    }
                    console.log(`[${this.guildId}] Đã gửi DM vote cho ${sent} thành viên.`);
                }
                catch (error) {
                    console.error(`[${this.guildId}] Lỗi gửi DM:`, error);
                }
            }
        });
        const closeJob = node_cron_1.default.schedule(closeCron, async () => {
            console.log(`[${this.guildId}] Khóa vote`);
            const statePath = (0, utils_1.getVoteStatePath)(this.guildId);
            fs_1.default.writeFileSync(statePath, JSON.stringify({ isOpen: false }, null, 4));
            const target = await this.resolveChannel();
            try {
                const embeds = (0, voteResult_1.buildVoteResultEmbeds)(this.guildId);
                if (embeds.length) {
                    await target.send({ embeds });
                }
                else {
                    await target.send("🔒 **Vote Bang Chiến tuần này đã kết thúc!**");
                }
            }
            catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi kết quả vote:`, error);
            }
        });
        // Chủ Nhật 00:00 — reset vote (dọn dẹp cuối tuần)
        const resetJob = node_cron_1.default.schedule("0 0 * * 0", async () => {
            console.log(`[${this.guildId}] Reset vote cuối tuần`);
            fs_1.default.writeFileSync((0, utils_1.getVotePath)(this.guildId), JSON.stringify([], null, 4));
            const statePath = (0, utils_1.getVoteStatePath)(this.guildId);
            fs_1.default.writeFileSync(statePath, JSON.stringify({ isOpen: false }, null, 4));
            const target = await this.resolveChannel();
            try {
                await target.send("🧹 **Đã reset vote để chuẩn bị cho tuần mới!**");
            }
            catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi thông báo reset:`, error);
            }
        });
        this.jobs.push(openJob, closeJob, resetJob);
        console.log(`[${this.guildId}] ✅ Vote scheduler đã khởi tạo.`);
    }
    restart() {
        console.log(`[${this.guildId}] 🔄 Vote scheduler restart...`);
        this.start();
    }
    stop() {
        this.clearJobs();
    }
    getConfig() {
        return this.readConfig();
    }
}
exports.VoteScheduler = VoteScheduler;
