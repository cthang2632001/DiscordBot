"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployCommands = deployCommands;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const discord_js_1 = require("discord.js");
const ping_1 = require("./commands/ping");
const addschedule_1 = require("./commands/addschedule");
const deleteschedule_1 = require("./commands/deleteschedule");
const listschedule_1 = require("./commands/listschedule");
const editschedule_1 = require("./commands/editschedule");
const play_1 = require("./commands/play");
const stop_1 = require("./commands/stop");
const next_1 = require("./commands/next");
const voteBC_1 = require("./commands/voteBC");
const voteResult_1 = require("./commands/voteResult");
const voteReset_1 = require("./commands/voteReset");
const voteScheduler_1 = require("./commands/voteScheduler");
const commands = [
    ping_1.pingCommand.data.toJSON(),
    addschedule_1.addScheduleCommand.data.toJSON(),
    deleteschedule_1.deleteScheduleCommand.data.toJSON(),
    listschedule_1.listScheduleCommand.data.toJSON(),
    editschedule_1.editScheduleCommand.data.toJSON(),
    play_1.playCommand.data.toJSON(),
    stop_1.stopCommand.data.toJSON(),
    next_1.nextCommand.data.toJSON(),
    voteBC_1.voteBCCommand.data.toJSON(),
    voteResult_1.voteResultCommand.data.toJSON(),
    voteReset_1.voteResetCommand.data.toJSON(),
    voteScheduler_1.voteSchedulerCommand.data.toJSON(),
];
async function deployCommands(guildIds) {
    const token = process.env.TOKEN;
    const appId = process.env.APP_ID;
    if (!token || !appId) {
        throw new Error("Missing TOKEN or APP_ID in environment variables.");
    }
    const rest = new discord_js_1.REST({ version: "10" }).setToken(token);
    const targets = guildIds && guildIds.length > 0 ? guildIds : [];
    if (targets.length > 0) {
        // Xóa global commands để tránh bị trùng lặp
        await rest.put(discord_js_1.Routes.applicationCommands(appId), { body: [] });
        console.log("Đã xóa Slash Commands toàn cục.");
        for (const guildId of targets) {
            await rest.put(discord_js_1.Routes.applicationGuildCommands(appId, guildId), { body: commands });
            console.log(`Đã đăng ký Slash Commands cho guild ${guildId}.`);
        }
    }
    else {
        await rest.put(discord_js_1.Routes.applicationCommands(appId), { body: commands });
        console.log("Đã đăng ký Slash Commands toàn cục.");
    }
}
