import cron, { ScheduledTask } from "node-cron";
import { TextChannel } from "discord.js";
import fs from "fs";
import { Schedule } from "./types";
import { getSchedulePath } from "./utils";

export const schedulerManager = {
    schedulers: new Map<string, Scheduler>()
};

export class Scheduler {

    private jobs: ScheduledTask[] = [];

    constructor(
        private channel: TextChannel,
        private guildId: string
    ) {}

    private clearJobs() {

        this.jobs.forEach(job => job.stop());

        this.jobs = [];

    }

    private getCronExpression(schedule: Schedule): string {
        const [hour, minute] = schedule.time.split(":");

        switch (schedule.frequency) {
            case 'weekly':
                // 0 ${minute} ${hour} * * ${dayOfWeek}
                return `0 ${minute} ${hour} * * ${schedule.dayOfWeek}`;
            
            case 'monthly':
                // 0 ${minute} ${hour} ${dayOfMonth} * *
                return `0 ${minute} ${hour} ${schedule.dayOfMonth} * *`;
            
            case 'daily':
            default:
                // 0 ${minute} ${hour} * * *
                return `0 ${minute} ${hour} * * *`;
        }
    }

    public reload() {

        this.clearJobs();

        const filePath = getSchedulePath(this.guildId);

        try {
            const schedules: Schedule[] =
                JSON.parse(fs.readFileSync(filePath, "utf8"));

            if (!Array.isArray(schedules)) {
                console.error(`[${this.guildId}] schedule.json không phải mảng`);
                return;
            }

            schedules.forEach(schedule => {

                const [hour, minute] =
                    schedule.time.split(":");

                if (!hour || !minute) {
                    console.error(`[${this.guildId}] Format time sai: ${schedule.time}`);
                    return;
                }

                const cronExpression = this.getCronExpression(schedule);

                const job = cron.schedule(

                    cronExpression,

                    async () => {

                        console.log(`[${this.guildId}] Gửi (${schedule.frequency}): ${schedule.message}`);
                        try {
                            await this.channel.send(schedule.message);
                        } catch (error) {
                            if (error instanceof Error) {
                                console.error(`[${this.guildId}] Lỗi gửi pesan: ${error.message}`);
                            } else {
                                console.error(`[${this.guildId}] Lỗi gửi pesan:`, error);
                            }
                        }

                    }

                );

                this.jobs.push(job);

            });

            console.log(`[${this.guildId}] ✅ Đã tải ${this.jobs.length} lịch.`);
        } catch (error) {
            console.error(`[${this.guildId}] Lỗi khi load schedule:`, error);
        }

    }
}