"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.musicManager = exports.MusicSubscription = void 0;
const voice_1 = require("@discordjs/voice");
const play_dl_1 = __importDefault(require("play-dl"));
const ytdl_core_1 = __importDefault(require("ytdl-core"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const resolveYtDlpBinary = () => {
    const configuredPath = process.env.YT_DLP_PATH || process.env.YOUTUBE_DL_PATH;
    if (configuredPath) {
        return configuredPath;
    }
    const localBinary = process.platform === "win32"
        ? path_1.default.resolve(__dirname, "..", "node_modules", "yt-dlp-exec", "bin", "yt-dlp.exe")
        : path_1.default.resolve(__dirname, "..", "node_modules", "yt-dlp-exec", "bin", "yt-dlp");
    return (0, fs_1.existsSync)(localBinary) ? localBinary : "yt-dlp";
};
const resolveFfmpegBinary = () => {
    if (ffmpeg_static_1.default) {
        return ffmpeg_static_1.default;
    }
    const envPath = process.env.FFMPEG_PATH;
    if (envPath) {
        return envPath;
    }
    return undefined;
};
const isYouTubeUrl = (url) => {
    try {
        const parsed = new URL(url);
        return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(parsed.hostname) || parsed.hostname.endsWith(".youtube.com");
    }
    catch {
        return false;
    }
};
const normalizeYouTubeUrl = (url) => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "youtu.be") {
            const videoId = parsed.pathname.slice(1);
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return url;
    }
    catch {
        return url;
    }
};
const getYouTubeMetadata = (url, guildId) => {
    const ytDlpBinary = resolveYtDlpBinary();
    const args = ['--no-warnings', '--no-playlist', '--skip-download', '--print', '%(title)s', '--print', '%(webpage_url)s'];
    const cookiesPath = process.env.YT_DLP_COOKIES || process.env.YT_DLP_COOKIES_PATH;
    if (cookiesPath) {
        args.push('--cookies', cookiesPath);
    }
    args.push(url);
    const result = (0, child_process_1.spawnSync)(ytDlpBinary, args, {
        encoding: 'utf8',
        timeout: 15000 // 15 second timeout
    });
    if (result.error || result.status !== 0) {
        const stderr = result.stderr || '';
        const detail = result.error?.message ?? (stderr || 'binary not found');
        // Detectar Shorts ou vídeo com apenas imagens
        if (stderr.includes('Only images are available') || stderr.includes('Requested format is not available')) {
            throw new Error(`YouTube Shorts ou vídeo sem áudio - não pode ser reproduzido`);
        }
        // Nếu lỗi format, bot detection, hoặc format unavailable - fallback sang play-dl
        if (stderr.includes('Sign in to confirm') ||
            stderr.includes('bot') ||
            stderr.includes('Requested format') ||
            stderr.includes('No formats found')) {
            throw new Error(`yt-dlp fallback required - thử play-dl`);
        }
        throw new Error(`Não foi possível obter informações do YouTube: ${detail}`);
    }
    const lines = (result.stdout || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    return {
        canonicalUrl: lines[1] || url,
        title: lines[0] || 'Unknown title'
    };
};
class MusicSubscription {
    voiceChannel;
    textChannel;
    guildId;
    queue = [];
    connection;
    player;
    playing = false;
    activeProcess;
    retryCount = 0;
    maxRetries = 3;
    currentTrack;
    lastErrorTime = 0;
    lastRequestTime = 0;
    minRequestInterval = 5000; // 5 segundos entre requests (aumentado para evitar bloqueio YouTube)
    constructor(voiceChannel, textChannel, guildId) {
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;
        this.guildId = guildId;
        this.player = (0, voice_1.createAudioPlayer)({
            behaviors: {
                noSubscriber: voice_1.NoSubscriberBehavior.Pause
            }
        });
        this.player.on(voice_1.AudioPlayerStatus.Idle, () => {
            this.clearActiveProcess();
            void this.playNext().catch(error => {
                console.error(`[${this.guildId}] Error in playNext after idle:`, error);
                this.notifyError(`Lỗi khi phát nhạc: ${error instanceof Error ? error.message : 'Không xác định'}`);
            });
        });
        this.player.on("error", (error) => {
            console.error(`[${this.guildId}] Audio player error:`, error);
            this.clearActiveProcess();
            this.playing = false;
            this.retryCount++;
            if (this.retryCount < this.maxRetries) {
                console.log(`[${this.guildId}] Retry ${this.retryCount}/${this.maxRetries}...`);
                void this.playNext().catch(err => {
                    console.error(`[${this.guildId}] Error resuming after audio player error:`, err);
                    this.notifyError(`Lỗi khi phát nhạc sau ${this.maxRetries} lần thử`);
                });
            }
            else {
                this.retryCount = 0;
                this.notifyError("Không thể phát track này, chuyển sang track tiếp theo");
                void this.playNext().catch(err => {
                    console.error(`[${this.guildId}] Error skipping failed track:`, err);
                });
            }
        });
    }
    async connect() {
        if (this.connection && this.connection.state.status !== voice_1.VoiceConnectionStatus.Destroyed) {
            return;
        }
        this.connection = (0, voice_1.joinVoiceChannel)({
            channelId: this.voiceChannel.id,
            guildId: this.guildId,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator
        });
        this.connection.subscribe(this.player);
        try {
            await (0, voice_1.entersState)(this.connection, voice_1.VoiceConnectionStatus.Ready, 30_000);
        }
        catch (error) {
            console.error(`[${this.guildId}] Voice connection failed:`, error);
            this.connection.destroy();
            throw error;
        }
    }
    async enqueue(url, requestedBy) {
        // Suporta YouTube, Spotify, ou qualquer URL direto
        const isYT = isYouTubeUrl(url);
        const isSP = play_dl_1.default.sp_validate(url);
        const isDirectUrl = url.match(/^https?:\/\/.+\.(m3u8|mp3|wav|aac|ogg|flac)$/i);
        if (!isYT && !isSP && !isDirectUrl && !play_dl_1.default.yt_validate(url)) {
            throw new Error("URL inválida. Suporta: YouTube, Spotify, ou stream direto (m3u8, mp3, etc)");
        }
        let canonicalUrl = url;
        let title = "Unknown title";
        // Tenta obter metadata, mas não bloqueia se falhar (use URL diretamente)
        if (isYT) {
            canonicalUrl = normalizeYouTubeUrl(url);
            title = "YouTube video";
        }
        else if (isSP) {
            try {
                const info = await this.withRateLimit(() => play_dl_1.default.video_basic_info(url), 2);
                canonicalUrl = info.video_details?.url ?? normalizeYouTubeUrl(url);
                title = info.video_details?.title || "Spotify track";
            }
            catch (error) {
                console.warn(`[${this.guildId}] Spotify metadata failed, using fallback:`, error);
                canonicalUrl = normalizeYouTubeUrl(url);
                title = "Spotify track";
            }
        }
        else {
            // URL direto - não precisa de metadata
            console.log(`[${this.guildId}] Direct stream URL - usando sem metadata`);
            canonicalUrl = url;
            title = url.split('/').pop() || "Stream direto";
        }
        const track = {
            url: canonicalUrl,
            title,
            requestedBy
        };
        this.queue.push(track);
        if (!this.playing) {
            await this.playNext();
        }
        return track;
    }
    async createYtDlpResource(url) {
        const ffmpegBinary = resolveFfmpegBinary();
        if (!ffmpegBinary) {
            console.error(`[${this.guildId}] No WebM/Opus format and FFmpeg not found; cannot fallback.`);
            throw new Error('FFmpeg não foi encontrado no sistema');
        }
        const ytDlpBinary = resolveYtDlpBinary();
        const ytDlpVersion = (0, child_process_1.spawnSync)(ytDlpBinary, ['--version'], { encoding: 'utf8' });
        if (ytDlpVersion.error || ytDlpVersion.status !== 0) {
            console.error(`[${this.guildId}] yt-dlp fallback is unavailable:`, ytDlpVersion.error ?? ytDlpVersion.stderr);
            const detail = ytDlpVersion.error?.message ?? (ytDlpVersion.stderr || 'binary not found');
            throw new Error(`yt-dlp não disponível: ${detail}`);
        }
        const infoArgs = ['--no-warnings', '--skip-download', '-j', url];
        const infoResult = (0, child_process_1.spawnSync)(ytDlpBinary, infoArgs, { encoding: 'utf8', timeout: 10000 });
        if (infoResult.stdout) {
            try {
                const info = JSON.parse(infoResult.stdout);
                const formats = info.formats || [];
                // Verifica se tem algum formato com audio
                const hasAudioFormat = formats.some((f) => f.acodec && f.acodec !== 'none');
                // Se não tem NENHUM formato com audio (muito raro)
                if (formats.length > 0 && !hasAudioFormat) {
                    console.warn(`[${this.guildId}] ⚠️ Aviso: Nenhum formato com áudio detectado, pode ser Shorts`);
                    // Continua mesmo assim - stderr monitoring detectará se for Shorts real
                }
            }
            catch (parseError) {
                if (String(parseError).includes('YouTube Shorts') || String(parseError).includes('sem áudio')) {
                    throw parseError; // Re-throw detecção de Shorts
                }
                console.warn(`[${this.guildId}] Info parse failed, continuando com stream direto...`, parseError);
            }
        }
        const formatOptions = [
            'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            'best[height<=480]',
            '140',
            '251',
            '250',
            '249',
        ];
        for (const format of formatOptions) {
            try {
                const args = ['--no-warnings', '-f', format, '-o', '-', url];
                if (process.env.DEBUG_MUSIC === '1') {
                    console.log(`[${this.guildId}] Tentando format: ${format}`);
                }
                const ytDlpProcess = (0, child_process_1.spawn)(ytDlpBinary, args, {
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                this.activeProcess = ytDlpProcess;
                let stderrData = '';
                let timedOut = false;
                const timeoutHandle = setTimeout(() => {
                    timedOut = true;
                    console.warn(`[${this.guildId}] yt-dlp process timeout (30s), killing...`);
                    ytDlpProcess.kill('SIGKILL');
                }, 30000);
                const clearTimeoutOnData = () => {
                    if (!timedOut) {
                        clearTimeout(timeoutHandle);
                    }
                };
                ytDlpProcess.stderr.on('data', chunk => {
                    const text = chunk.toString().trim();
                    stderrData += text + '\n';
                    if (text && !text.includes('ERROR: unable to write data') && !text.includes('[download]')) {
                        process.stderr.write(`[yt-dlp] ${text}\n`);
                    }
                });
                ytDlpProcess.once('error', error => {
                    clearTimeoutOnData();
                    console.error(`[${this.guildId}] yt-dlp process error:`, error);
                });
                ytDlpProcess.stdout.once('readable', () => {
                    clearTimeoutOnData();
                });
                ytDlpProcess.once('exit', (code) => {
                    clearTimeoutOnData();
                    if (this.activeProcess === ytDlpProcess) {
                        this.activeProcess = undefined;
                    }
                });
                return (0, voice_1.createAudioResource)(ytDlpProcess.stdout, {
                    inputType: voice_1.StreamType.Arbitrary,
                    inlineVolume: true
                });
            }
            catch (error) {
                console.warn(`[${this.guildId}] yt-dlp format "${format}" failed, trying next...`, String(error).slice(0, 100));
            }
        }
        throw new Error('Nenhum formato funcionou - talvez o vídeo esteja restrito ou indisponível');
    }
    async playNext() {
        const nextTrack = this.queue.shift();
        if (!nextTrack) {
            this.playing = false;
            return;
        }
        this.currentTrack = nextTrack;
        this.retryCount = 0;
        await this.connect();
        let resource;
        let lastError = null;
        try {
            const isDirectUrl = nextTrack.url.match(/^https?:\/\/.+\.(m3u8|mp3|wav|aac|ogg|flac)$/i);
            if (isDirectUrl) {
                // URL direto - usar ffmpeg para stream
                console.log(`[${this.guildId}] Streaming direto: ${nextTrack.url}`);
                const ffmpegBinary = resolveFfmpegBinary();
                if (!ffmpegBinary) {
                    throw new Error('FFmpeg necessário para stream direto');
                }
                const ffmpegProcess = (0, child_process_1.spawn)(ffmpegBinary, [
                    '-i', nextTrack.url,
                    '-f', 's16le',
                    '-ar', '48000',
                    '-ac', '2',
                    'pipe:1'
                ], {
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                this.activeProcess = ffmpegProcess;
                // Timeout handler
                const timeoutHandle = setTimeout(() => {
                    console.warn(`[${this.guildId}] FFmpeg timeout (30s), killing...`);
                    ffmpegProcess.kill('SIGKILL');
                }, 30000);
                ffmpegProcess.stderr.on('data', (chunk) => {
                    const text = chunk.toString().trim();
                    if (text && !text.includes('frame=')) {
                        console.log(`[${this.guildId}] [FFmpeg] ${text}`);
                    }
                });
                ffmpegProcess.once('error', error => {
                    clearTimeout(timeoutHandle);
                    console.error(`[${this.guildId}] FFmpeg process failed:`, error);
                });
                ffmpegProcess.once('exit', () => {
                    clearTimeout(timeoutHandle);
                    if (this.activeProcess === ffmpegProcess) {
                        this.activeProcess = undefined;
                    }
                });
                resource = (0, voice_1.createAudioResource)(ffmpegProcess.stdout, {
                    inputType: voice_1.StreamType.Raw,
                    inlineVolume: true
                });
            }
            else if (isYouTubeUrl(nextTrack.url)) {
                if (process.env.DEBUG_MUSIC === '1') {
                    console.log(`[${this.guildId}] Using play-dl for YouTube URL (yt-dlp bypassed due to bot detection).`);
                }
                try {
                    const stream = await this.withRateLimit(() => play_dl_1.default.stream(nextTrack.url, { quality: 2 }));
                    // Validar se stream é válido
                    if (!stream || !stream.stream) {
                        console.warn(`[${this.guildId}] play-dl retornou stream inválido, tentando yt-dlp...`);
                        resource = await this.createYtDlpResource(nextTrack.url);
                    }
                    else {
                        resource = (0, voice_1.createAudioResource)(stream.stream, {
                            inputType: stream.type,
                            inlineVolume: true
                        });
                    }
                }
                catch (playDlError) {
                    // Se play-dl falhar, trata especialmente casos de URL inválida MAS deixa yt-dlp tentar
                    const errorMsg = String(playDlError).toLowerCase();
                    const error = playDlError;
                    console.warn(`[${this.guildId}] play-dl failed, falling back to yt-dlp:`, playDlError);
                    resource = await this.createYtDlpResource(nextTrack.url);
                }
            }
            else {
                // Spotify ou outro streaming
                const stream = await this.withRateLimit(() => play_dl_1.default.stream(nextTrack.url, { quality: 2 }));
                resource = (0, voice_1.createAudioResource)(stream.stream, {
                    inputType: stream.type,
                    inlineVolume: true
                });
            }
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const errorMsg = String(error).toLowerCase();
            // Se for Shorts thực sự (detectado bởi pre-check hoặc stderr) - không tenta novamente
            if (errorMsg.includes('shorts') || errorMsg.includes('sem áudio')) {
                console.warn(`[${this.guildId}] ✗ Shorts detectado, pulando retries:`, error);
                this.notifyError(`❌ Không thể phát: **${nextTrack.title}**\n${this.getErrorMessage(lastError)}`);
                void this.playNext();
                return;
            }
            console.warn(`[${this.guildId}] Primary stream failed, trying compatibility mode:`, error);
            try {
                if (isYouTubeUrl(nextTrack.url)) {
                    resource = await this.createYtDlpResource(nextTrack.url);
                }
                else {
                    const compat = await this.withRateLimit(() => play_dl_1.default.stream(nextTrack.url, { quality: 2, discordPlayerCompatibility: true }));
                    resource = (0, voice_1.createAudioResource)(compat.stream, {
                        inputType: compat.type,
                        inlineVolume: true
                    });
                }
            }
            catch (compatError) {
                lastError = compatError instanceof Error ? compatError : new Error(String(compatError));
                console.warn(`[${this.guildId}] Compatibility stream failed, attempting direct WebM Opus selection:`, compatError);
                try {
                    if (isYouTubeUrl(nextTrack.url)) {
                        resource = await this.createYtDlpResource(nextTrack.url);
                    }
                    else {
                        const info = await this.withRateLimit(() => play_dl_1.default.video_info(nextTrack.url));
                        const formats = Array.isArray(info.format) ? info.format : Object.values(info.format);
                        const opusFormat = formats
                            .filter((f) => typeof f.mimeType === 'string' && f.mimeType.includes('audio/webm') && /opus/.test(f.mimeType))
                            .find((f) => typeof f.url === 'string' && f.url.length > 0);
                        if (opusFormat && typeof opusFormat.url === 'string') {
                            const ytdlStream = (0, ytdl_core_1.default)(opusFormat.url, { highWaterMark: 1 << 25 });
                            resource = (0, voice_1.createAudioResource)(ytdlStream, {
                                inputType: voice_1.StreamType.WebmOpus,
                                inlineVolume: true
                            });
                        }
                        else {
                            resource = await this.createYtDlpResource(nextTrack.url);
                        }
                    }
                }
                catch (fallbackError) {
                    lastError = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
                    console.error(`[${this.guildId}] All playback methods failed for:`, nextTrack.url, fallbackError);
                    this.notifyError(`❌ Không thể phát: **${nextTrack.title}**\n${this.getErrorMessage(lastError)}`);
                    void this.playNext();
                    return;
                }
            }
        }
        resource.volume?.setVolume(0.75);
        this.player.play(resource);
        this.playing = true;
        // Tenta obter título de verdade (async) se for YouTube e não temos ainda
        let actualTitle = nextTrack.title;
        if (isYouTubeUrl(nextTrack.url) && nextTrack.title === "YouTube video") {
            try {
                console.log(`[${this.guildId}] Attempting to fetch actual title during playback...`);
                // Tenta de forma não-bloqueante em background
                setTimeout(async () => {
                    try {
                        const info = await this.withRateLimit(() => play_dl_1.default.video_basic_info(nextTrack.url), 1);
                        actualTitle = info.video_details?.title || nextTrack.title;
                        nextTrack.title = actualTitle;
                    }
                    catch (error) {
                        console.warn(`[${this.guildId}] Could not fetch title during playback:`, error);
                    }
                }, 1000); // Aguarda 1s para não bloquear playback
            }
            catch (error) {
                console.warn(`[${this.guildId}] Title fetch failed:`, error);
            }
        }
        try {
            await this.textChannel.send(`▶️ **Đang phát:** ${actualTitle}\n👤 Yêu cầu bởi: ${nextTrack.requestedBy}\n📍 Vị trí hàng đợi: ${this.queue.length}`);
        }
        catch (sendError) {
            console.warn(`[${this.guildId}] Failed to send playback notification:`, sendError);
        }
    }
    async notifyError(message) {
        try {
            await this.textChannel.send(`⚠️ ${message}`);
        }
        catch (error) {
            console.warn(`[${this.guildId}] Failed to send error notification:`, error);
        }
    }
    getErrorMessage(error) {
        const message = error.message.toLowerCase();
        if (message.includes('shorts') || message.includes('sem áudio') || message.includes('only images')) {
            return 'YouTube Shorts não tem áudio - não pode ser reproduzido';
        }
        else if (message.includes('missing access') || message.includes('no access')) {
            return 'Bot không có quyền truy cập kênh này';
        }
        else if (message.includes('bot detection') || message.includes('sign in')) {
            return 'YouTube chặn yêu cầu - hãy thêm cookies hoặc thử video khác';
        }
        else if (message.includes('429') || message.includes('too many') || message.includes('rate limit')) {
            return 'YouTube rate limit quá cao - chờ vài phút rồi thử lại';
        }
        else if (message.includes('requested format') || message.includes('format')) {
            return 'Định dạng video không được hỗ trợ - thử video khác';
        }
        else if (message.includes('not available')) {
            return 'Video này không có audio hoặc đã bị xóa';
        }
        else if (message.includes('ffmpeg')) {
            return 'Lỗi FFmpeg - kiểm tra cài đặt';
        }
        else if (message.includes('timeout')) {
            return 'Quá lâu khi tải video - thử video khác';
        }
        else if (message.includes('age restricted')) {
            return 'Video bị giới hạn tuổi - thử video khác';
        }
        else if (message.includes('invalid url')) {
            return 'URL inválida ou vídeo restrito';
        }
        return 'Lỗi não xác định - thử lại sau';
    }
    async withRateLimit(fn, retries = 3) {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                // Đợi để không vượt quá rate limit
                const timeSinceLastRequest = Date.now() - this.lastRequestTime;
                if (timeSinceLastRequest < this.minRequestInterval) {
                    const waitTime = this.minRequestInterval - timeSinceLastRequest;
                    if (attempt > 0 || Math.random() > 0.5) { // Log giãn điểm để tránh spam
                        console.log(`[${this.guildId}] Waiting ${waitTime}ms before YouTube request (attempt ${attempt + 1}/${retries})...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                this.lastRequestTime = Date.now();
                return await fn();
            }
            catch (error) {
                const errorMsg = String(error).toLowerCase();
                // Nếu là 429, retry com exponential backoff
                if (errorMsg.includes('429') || errorMsg.includes('too many')) {
                    const backoffMs = Math.pow(2, attempt) * 5000; // 5s, 10s, 20s (tăng từ 3s, 6s, 12s)
                    if (attempt < retries - 1) {
                        console.warn(`[${this.guildId}] ⚠️ YouTube rate limited (429), waiting ${backoffMs}ms before retry ${attempt + 1}/${retries}...`);
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                        continue;
                    }
                }
                throw error;
            }
        }
        throw new Error('Rate limit retry exhausted');
    }
    clearActiveProcess() {
        if (!this.activeProcess) {
            return;
        }
        const processToStop = this.activeProcess;
        this.activeProcess = undefined;
        try {
            processToStop.kill('SIGTERM');
        }
        catch (error) {
            console.warn(`[${this.guildId}] Failed to stop active playback process:`, error);
        }
    }
    stop() {
        this.clearActiveProcess();
        this.queue = [];
        this.player.stop(true);
        if (this.connection) {
            this.connection.destroy();
            this.connection = undefined;
        }
        this.playing = false;
        try {
            void this.textChannel.send('⏹️ Đã dừng phát nhạc');
        }
        catch (error) {
            console.warn(`[${this.guildId}] Failed to send stop notification:`, error);
        }
    }
    skip() {
        this.clearActiveProcess();
        this.player.stop();
        const skippedTrack = this.currentTrack?.title || 'Track';
        try {
            void this.textChannel.send(`⏭️ **Đã bỏ qua:** ${skippedTrack}`);
        }
        catch (error) {
            console.warn(`[${this.guildId}] Failed to send skip notification:`, error);
        }
    }
    getQueueInfo() {
        if (this.queue.length === 0) {
            return 'Hàng đợi trống';
        }
        const queueList = this.queue
            .slice(0, 5)
            .map((track, index) => `${index + 1}. ${track.title}`)
            .join('\n');
        const moreCount = this.queue.length > 5 ? this.queue.length - 5 : 0;
        const more = moreCount > 0 ? `\n... và ${moreCount} bài khác` : '';
        return queueList + more;
    }
}
exports.MusicSubscription = MusicSubscription;
exports.musicManager = new Map();
