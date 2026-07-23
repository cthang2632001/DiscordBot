"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = exports.schedulerManager = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const fs_1 = __importDefault(require("fs"));
const utils_1 = require("./utils");
exports.schedulerManager = {
    schedulers: new Map()
};
class Scheduler {
    channel;
    guildId;
    jobs = [];
    constructor(channel, guildId) {
        this.channel = channel;
        this.guildId = guildId;
    }
    clearJobs() {
        this.jobs.forEach(job => job.stop());
        this.jobs = [];
    }
    getCronExpression(schedule) {
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
    reload() {
        this.clearJobs();
        const filePath = (0, utils_1.getSchedulePath)(this.guildId);
        try {
            const schedules = JSON.parse(fs_1.default.readFileSync(filePath, "utf8"));
            if (!Array.isArray(schedules)) {
                console.error(`[${this.guildId}] schedule.json không phải mảng`);
                return;
            }
            schedules.forEach(schedule => {
                const [hour, minute] = schedule.time.split(":");
                if (!hour || !minute) {
                    console.error(`[${this.guildId}] Format time sai: ${schedule.time}`);
                    return;
                }
                const cronExpression = this.getCronExpression(schedule);
                const job = node_cron_1.default.schedule(cronExpression, async () => {
                    console.log(`[${this.guildId}] Gửi (${schedule.frequency}): ${schedule.message}`);
                    try {
                        await this.channel.send(schedule.message);
                    }
                    catch (error) {
                        if (error instanceof Error) {
                            console.error(`[${this.guildId}] Lỗi gửi pesan: ${error.message}`);
                        }
                        else {
                            console.error(`[${this.guildId}] Lỗi gửi pesan:`, error);
                        }
                    }
                });
                this.jobs.push(job);
            });
            console.log(`[${this.guildId}] ✅ Đã tải ${this.jobs.length} lịch.`);
        }
        catch (error) {
            console.error(`[${this.guildId}] Lỗi khi load schedule:`, error);
        }
    }
}
exports.Scheduler = Scheduler;
