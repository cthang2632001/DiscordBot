import dotenv from "dotenv";
dotenv.config();

import {
    REST,
    Routes
} from "discord.js";

import { pingCommand } from "./commands/ping";
import { addScheduleCommand } from "./commands/addschedule";
import { deleteScheduleCommand } from "./commands/deleteschedule";
import { listScheduleCommand } from "./commands/listschedule";
import { editScheduleCommand } from "./commands/editschedule";
import { playCommand } from "./commands/play";
import { stopCommand } from "./commands/stop";
import { nextCommand } from "./commands/next";
import { voteBCCommand } from "./commands/voteBC";
import { voteResultCommand } from "./commands/voteResult";
import { voteResetCommand } from "./commands/voteReset";
import { voteSchedulerCommand } from "./commands/voteScheduler";
const commands = [
    pingCommand.data.toJSON(),
    addScheduleCommand.data.toJSON(),
    deleteScheduleCommand.data.toJSON(),
    listScheduleCommand.data.toJSON(),
    editScheduleCommand.data.toJSON(),
    playCommand.data.toJSON(),
    stopCommand.data.toJSON(),
    nextCommand.data.toJSON(),
    voteBCCommand.data.toJSON(),
    voteResultCommand.data.toJSON(),
    voteResetCommand.data.toJSON(),
    voteSchedulerCommand.data.toJSON(),
];

export async function deployCommands(guildIds?: string[]) {
    const token = process.env.TOKEN;
    const appId = process.env.APP_ID;

    if (!token || !appId) {
        throw new Error("Missing TOKEN or APP_ID in environment variables.");
    }

    const rest = new REST({ version: "10" }).setToken(token);
    const targets = guildIds && guildIds.length > 0 ? guildIds : [];

    if (targets.length > 0) {
        // Xóa global commands để tránh bị trùng lặp
        await rest.put(Routes.applicationCommands(appId), { body: [] });
        console.log("Đã xóa Slash Commands toàn cục.");

        for (const guildId of targets) {
            await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
            console.log(`Đã đăng ký Slash Commands cho guild ${guildId}.`);
        }
    } else {
        await rest.put(Routes.applicationCommands(appId), { body: commands });
        console.log("Đã đăng ký Slash Commands toàn cục.");
    }
}
