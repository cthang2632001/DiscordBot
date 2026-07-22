import cron, { ScheduledTask } from "node-cron";
import fs from "fs";
import { TextChannel, Guild, ThreadChannel } from "discord.js";
import { VoteScheduleConfig } from "./types";
import { getVotePath, getVoteStatePath, getVoteScheduleConfigPath, getVoteTargetChannel } from "./utils";
import { buildVoteEmbedFromGuild, buildVoteComponents } from "./voteEmbed";
import { sendVoteDM, pendingVoteDMs } from "./voteDM";
import { buildVoteResultEmbeds } from "./commands/voteResult";

export const voteSchedulerManager = {
    schedulers: new Map<string, VoteScheduler>()
};

export class VoteScheduler {

    private jobs: ScheduledTask[] = [];
    private guild?: Guild;
    private channel: TextChannel | ThreadChannel | null = null;

    constructor(
        private defaultChannel: TextChannel,
        private guildId: string
    ) {
        this.guild = defaultChannel.guild;
    }

    private clearJobs() {
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
    }

    private readConfig(): VoteScheduleConfig {
        const filePath = getVoteScheduleConfigPath(this.guildId);
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    private async resolveChannel(): Promise<TextChannel | ThreadChannel> {
        if (this.channel) return this.channel;
        const config = this.readConfig();
        const target = await getVoteTargetChannel(this.guild!, config);
        if (target) {
            this.channel = target;
            return target;
        }
        return this.defaultChannel;
    }

    public start() {
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

        const openJob = cron.schedule(openCron, async () => {
            console.log(`[${this.guildId}] Mở vote tuần mới`);

            fs.writeFileSync(getVotePath(this.guildId), JSON.stringify([], null, 4));

            const statePath = getVoteStatePath(this.guildId);
            fs.writeFileSync(statePath, JSON.stringify({ isOpen: true }, null, 4));

            const target = await this.resolveChannel();

            // Gửi vote embed trong channel server
            try {
                await target.send({
                    content: "@everyone",
                    allowedMentions: { parse: ["everyone"] },
                    embeds: [buildVoteEmbedFromGuild(this.guildId)],
                    components: buildVoteComponents()
                });
            } catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi vote embed:`, error);
            }

            // Gửi DM đến tất cả members
            if (this.guild) {
                try {
                    let members;
                    try {
                        members = await this.guild.members.fetch();
                    } catch {
                        members = this.guild.members.cache;
                    }
                    let sent = 0;
                    for (const [, member] of members) {
                        if (member.user.bot) continue;
                        await sendVoteDM(member.user, this.guildId, this.defaultChannel);
                        sent++;
                        if (sent % 5 === 0) {
                            await new Promise(r => setTimeout(r, 1000)); // rate limit
                        }
                    }
                    console.log(`[${this.guildId}] Đã gửi DM vote cho ${sent} thành viên.`);
                } catch (error) {
                    console.error(`[${this.guildId}] Lỗi gửi DM:`, error);
                }
            }
        });

        const closeJob = cron.schedule(closeCron, async () => {
            console.log(`[${this.guildId}] Khóa vote`);

            const statePath = getVoteStatePath(this.guildId);
            fs.writeFileSync(statePath, JSON.stringify({ isOpen: false }, null, 4));

            const target = await this.resolveChannel();

            try {
                const embeds = buildVoteResultEmbeds(this.guildId);
                if (embeds.length) {
                    await target.send({ embeds });
                } else {
                    await target.send("🔒 **Vote Bang Chiến tuần này đã kết thúc!**");
                }
            } catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi kết quả vote:`, error);
            }
        });

        // Chủ Nhật 00:00 — reset vote (dọn dẹp cuối tuần)
        const resetJob = cron.schedule("0 0 * * 0", async () => {
            console.log(`[${this.guildId}] Reset vote cuối tuần`);

            fs.writeFileSync(getVotePath(this.guildId), JSON.stringify([], null, 4));

            const statePath = getVoteStatePath(this.guildId);
            fs.writeFileSync(statePath, JSON.stringify({ isOpen: false }, null, 4));

            const target = await this.resolveChannel();

            try {
                await target.send("🧹 **Đã reset vote để chuẩn bị cho tuần mới!**");
            } catch (error) {
                console.error(`[${this.guildId}] Lỗi gửi thông báo reset:`, error);
            }
        });

        this.jobs.push(openJob, closeJob, resetJob);
        console.log(`[${this.guildId}] ✅ Vote scheduler đã khởi tạo.`);
    }

    public restart() {
        console.log(`[${this.guildId}] 🔄 Vote scheduler restart...`);
        this.start();
    }

    public stop() {
        this.clearJobs();
    }

    public getConfig(): VoteScheduleConfig {
        return this.readConfig();
    }
}