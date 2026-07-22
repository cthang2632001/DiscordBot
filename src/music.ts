import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, VoiceConnectionStatus, entersState, VoiceConnection, AudioPlayer, CreateAudioResourceOptions, StreamType } from "@discordjs/voice";
import playdl from "play-dl";
import ytdl from "ytdl-core";
import ffmpegPath from "ffmpeg-static";
import { spawn, spawnSync, ChildProcessByStdio } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { VoiceBasedChannel, TextChannel } from "discord.js";

const resolveYtDlpBinary = (): string => {
    const configuredPath = process.env.YT_DLP_PATH || process.env.YOUTUBE_DL_PATH;
    if (configuredPath) {
        return configuredPath;
    }

    const localBinary = process.platform === "win32"
        ? path.resolve(__dirname, "..", "node_modules", "yt-dlp-exec", "bin", "yt-dlp.exe")
        : path.resolve(__dirname, "..", "node_modules", "yt-dlp-exec", "bin", "yt-dlp");

    return existsSync(localBinary) ? localBinary : "yt-dlp";
};

const resolveFfmpegBinary = (): string | undefined => {
    if (ffmpegPath) {
        return ffmpegPath;
    }

    const envPath = process.env.FFMPEG_PATH;
    if (envPath) {
        return envPath;
    }

    return undefined;
};

export interface Track {
    url: string;
    title: string;
    requestedBy: string;
}

const isYouTubeUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(parsed.hostname) || parsed.hostname.endsWith(".youtube.com");
    } catch {
        return false;
    }
};

const normalizeYouTubeUrl = (url: string): string => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "youtu.be") {
            const videoId = parsed.pathname.slice(1);
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return url;
    } catch {
        return url;
    }
};

const getYouTubeMetadata = (url: string, guildId: string): { canonicalUrl: string; title: string } => {
    const ytDlpBinary = resolveYtDlpBinary();
    const args = ['--no-warnings', '--no-playlist', '--skip-download', '--print', '%(title)s', '--print', '%(webpage_url)s'];

    const cookiesPath = process.env.YT_DLP_COOKIES || process.env.YT_DLP_COOKIES_PATH;
    if (cookiesPath) {
        args.push('--cookies', cookiesPath);
    }

    args.push(url);

    const result = spawnSync(ytDlpBinary, args, {
        encoding: 'utf8',
        timeout: 15000  // 15 second timeout
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

export class MusicSubscription {
    public queue: Track[] = [];
    public connection?: VoiceConnection;
    public player: AudioPlayer;
    public playing = false;
    private activeProcess?: ChildProcessByStdio<null, Readable, Readable>;
    private retryCount = 0;
    private maxRetries = 3;
    private currentTrack?: Track;
    private lastErrorTime = 0;
    private lastRequestTime = 0;
    private minRequestInterval = 5000; // 5 segundos entre requests (aumentado para evitar bloqueio YouTube)

    constructor(
        public voiceChannel: VoiceBasedChannel,
        public textChannel: TextChannel,
        public guildId: string
    ) {
        this.player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause
            }
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.clearActiveProcess();
            void this.playNext().catch(error => {
                console.error(`[${this.guildId}] Error in playNext after idle:`, error);
                this.notifyError(`Lỗi khi phát nhạc: ${error instanceof Error ? error.message : 'Không xác định'}`);
            });
        });

        this.player.on("error", (error: Error) => {
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
            } else {
                this.retryCount = 0;
                this.notifyError("Không thể phát track này, chuyển sang track tiếp theo");
                void this.playNext().catch(err => {
                    console.error(`[${this.guildId}] Error skipping failed track:`, err);
                });
            }
        });
    }

    private async connect(): Promise<void> {
        if (this.connection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            return;
        }

        this.connection = joinVoiceChannel({
            channelId: this.voiceChannel.id,
            guildId: this.guildId,
            adapterCreator: this.voiceChannel.guild.voiceAdapterCreator as any
        });

        this.connection.subscribe(this.player);

        try {
            await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
        } catch (error) {
            console.error(`[${this.guildId}] Voice connection failed:`, error);
            this.connection.destroy();
            throw error;
        }
    }

    public async enqueue(url: string, requestedBy: string): Promise<Track> {
        // Suporta YouTube, Spotify, ou qualquer URL direto
        const isYT = isYouTubeUrl(url);
        const isSP = playdl.sp_validate(url);
        const isDirectUrl = url.match(/^https?:\/\/.+\.(m3u8|mp3|wav|aac|ogg|flac)$/i);
        
        if (!isYT && !isSP && !isDirectUrl && !playdl.yt_validate(url)) {
            throw new Error("URL inválida. Suporta: YouTube, Spotify, ou stream direto (m3u8, mp3, etc)");
        }

        let canonicalUrl = url;
        let title = "Unknown title";

        // Tenta obter metadata, mas não bloqueia se falhar (use URL diretamente)
        if (isYT) {
            canonicalUrl = normalizeYouTubeUrl(url);
            title = "YouTube video";
        } else if (isSP) {
            try {
                const info = await this.withRateLimit(() => playdl.video_basic_info(url), 2);
                canonicalUrl = info.video_details?.url ?? normalizeYouTubeUrl(url);
                title = info.video_details?.title || "Spotify track";
            } catch (error) {
                console.warn(`[${this.guildId}] Spotify metadata failed, using fallback:`, error);
                canonicalUrl = normalizeYouTubeUrl(url);
                title = "Spotify track";
            }
        } else {
            // URL direto - não precisa de metadata
            console.log(`[${this.guildId}] Direct stream URL - usando sem metadata`);
            canonicalUrl = url;
            title = url.split('/').pop() || "Stream direto";
        }

        const track: Track = {
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

    private async createYtDlpResource(url: string): Promise<unknown> {
        const ffmpegBinary = resolveFfmpegBinary();
        if (!ffmpegBinary) {
            console.error(`[${this.guildId}] No WebM/Opus format and FFmpeg not found; cannot fallback.`);
            throw new Error('FFmpeg não foi encontrado no sistema');
        }

        const ytDlpBinary = resolveYtDlpBinary();
        const ytDlpVersion = spawnSync(ytDlpBinary, ['--version'], { encoding: 'utf8' });
        if (ytDlpVersion.error || ytDlpVersion.status !== 0) {
            console.error(`[${this.guildId}] yt-dlp fallback is unavailable:`, ytDlpVersion.error ?? ytDlpVersion.stderr);
            const detail = ytDlpVersion.error?.message ?? (ytDlpVersion.stderr || 'binary not found');
            throw new Error(`yt-dlp não disponível: ${detail}`);
        }

        const infoArgs = ['--no-warnings', '--skip-download', '-j', url];
        const infoResult = spawnSync(ytDlpBinary, infoArgs, { encoding: 'utf8', timeout: 10000 });
        
        if (infoResult.stdout) {
            try {
                const info = JSON.parse(infoResult.stdout);
                const formats = info.formats || [];
                
                // Verifica se tem algum formato com audio
                const hasAudioFormat = formats.some((f: any) => f.acodec && f.acodec !== 'none');
                
                // Se não tem NENHUM formato com audio (muito raro)
                if (formats.length > 0 && !hasAudioFormat) {
                    console.warn(`[${this.guildId}] ⚠️ Aviso: Nenhum formato com áudio detectado, pode ser Shorts`);
                    // Continua mesmo assim - stderr monitoring detectará se for Shorts real
                }
            } catch (parseError) {
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
                
                const ytDlpProcess = spawn(ytDlpBinary, args, {
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

                return createAudioResource(ytDlpProcess.stdout, {
                    inputType: StreamType.Arbitrary,
                    inlineVolume: true
                } as CreateAudioResourceOptions<unknown>);
            } catch (error) {
                console.warn(`[${this.guildId}] yt-dlp format "${format}" failed, trying next...`, String(error).slice(0, 100));
            }
        }

        throw new Error('Nenhum formato funcionou - talvez o vídeo esteja restrito ou indisponível');
    }

    public async playNext(): Promise<void> {
        const nextTrack = this.queue.shift();
        if (!nextTrack) {
            this.playing = false;
            return;
        }

        this.currentTrack = nextTrack;
        this.retryCount = 0;

        await this.connect();

        let resource: any;
        let lastError: Error | null = null;

        try {
            const isDirectUrl = nextTrack.url.match(/^https?:\/\/.+\.(m3u8|mp3|wav|aac|ogg|flac)$/i);
            
            if (isDirectUrl) {
                // URL direto - usar ffmpeg para stream
                console.log(`[${this.guildId}] Streaming direto: ${nextTrack.url}`);
                const ffmpegBinary = resolveFfmpegBinary();
                if (!ffmpegBinary) {
                    throw new Error('FFmpeg necessário para stream direto');
                }
                
                const ffmpegProcess = spawn(ffmpegBinary, [
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

                resource = createAudioResource(ffmpegProcess.stdout, {
                    inputType: StreamType.Raw,
                    inlineVolume: true
                } as CreateAudioResourceOptions<unknown>);
            } else if (isYouTubeUrl(nextTrack.url)) {
                if (process.env.DEBUG_MUSIC === '1') {
                    console.log(`[${this.guildId}] Using play-dl for YouTube URL (yt-dlp bypassed due to bot detection).`);
                }
                try {
                    const stream = await this.withRateLimit(() => playdl.stream(nextTrack.url, { quality: 2 }));
                    
                    // Validar se stream é válido
                    if (!stream || !stream.stream) {
                        console.warn(`[${this.guildId}] play-dl retornou stream inválido, tentando yt-dlp...`);
                        resource = await this.createYtDlpResource(nextTrack.url);
                    } else {
                        resource = createAudioResource(stream.stream, {
                            inputType: stream.type as StreamType,
                            inlineVolume: true
                        } as CreateAudioResourceOptions<unknown>);
                    }
                } catch (playDlError) {
                    // Se play-dl falhar, trata especialmente casos de URL inválida MAS deixa yt-dlp tentar
                    const errorMsg = String(playDlError).toLowerCase();
                    const error = playDlError as any;
                    
                    console.warn(`[${this.guildId}] play-dl failed, falling back to yt-dlp:`, playDlError);
                    resource = await this.createYtDlpResource(nextTrack.url);
                }
            } else {
                // Spotify ou outro streaming
                const stream = await this.withRateLimit(() => playdl.stream(nextTrack.url, { quality: 2 }));
                resource = createAudioResource(stream.stream, {
                    inputType: stream.type as StreamType,
                    inlineVolume: true
                } as CreateAudioResourceOptions<unknown>);
            }
        } catch (error) {
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
                } else {
                    const compat = await this.withRateLimit(() => playdl.stream(nextTrack.url, { quality: 2, discordPlayerCompatibility: true as any }));
                    resource = createAudioResource(compat.stream, {
                        inputType: compat.type as StreamType,
                        inlineVolume: true
                    } as CreateAudioResourceOptions<unknown>);
                }
            } catch (compatError) {
                lastError = compatError instanceof Error ? compatError : new Error(String(compatError));
                console.warn(`[${this.guildId}] Compatibility stream failed, attempting direct WebM Opus selection:`, compatError);

                try {
                    if (isYouTubeUrl(nextTrack.url)) {
                        resource = await this.createYtDlpResource(nextTrack.url);
                    } else {
                        const info = await this.withRateLimit(() => playdl.video_info(nextTrack.url));
                        const formats: any[] = Array.isArray(info.format) ? info.format : Object.values(info.format as Record<string, unknown>);
                        const opusFormat = formats
                            .filter((f: any) => typeof f.mimeType === 'string' && f.mimeType.includes('audio/webm') && /opus/.test(f.mimeType))
                            .find((f: any) => typeof f.url === 'string' && f.url.length > 0);

                        if (opusFormat && typeof opusFormat.url === 'string') {
                            const ytdlStream = ytdl(opusFormat.url, { highWaterMark: 1 << 25 });
                            resource = createAudioResource(ytdlStream, {
                                inputType: StreamType.WebmOpus,
                                inlineVolume: true
                            } as CreateAudioResourceOptions<unknown>);
                        } else {
                            resource = await this.createYtDlpResource(nextTrack.url);
                        }
                    }
                } catch (fallbackError) {
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
                        const info = await this.withRateLimit(() => playdl.video_basic_info(nextTrack.url), 1);
                        actualTitle = info.video_details?.title || nextTrack.title;
                        nextTrack.title = actualTitle;
                    } catch (error) {
                        console.warn(`[${this.guildId}] Could not fetch title during playback:`, error);
                    }
                }, 1000); // Aguarda 1s para não bloquear playback
            } catch (error) {
                console.warn(`[${this.guildId}] Title fetch failed:`, error);
            }
        }

        try {
            await this.textChannel.send(`▶️ **Đang phát:** ${actualTitle}\n👤 Yêu cầu bởi: ${nextTrack.requestedBy}\n📍 Vị trí hàng đợi: ${this.queue.length}`);
        } catch (sendError) {
            console.warn(`[${this.guildId}] Failed to send playback notification:`, sendError);
        }
    }

    private async notifyError(message: string): Promise<void> {
        try {
            await this.textChannel.send(`⚠️ ${message}`);
        } catch (error) {
            console.warn(`[${this.guildId}] Failed to send error notification:`, error);
        }
    }

    private getErrorMessage(error: Error): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('shorts') || message.includes('sem áudio') || message.includes('only images')) {
            return 'YouTube Shorts não tem áudio - não pode ser reproduzido';
        } else if (message.includes('missing access') || message.includes('no access')) {
            return 'Bot không có quyền truy cập kênh này';
        } else if (message.includes('bot detection') || message.includes('sign in')) {
            return 'YouTube chặn yêu cầu - hãy thêm cookies hoặc thử video khác';
        } else if (message.includes('429') || message.includes('too many') || message.includes('rate limit')) {
            return 'YouTube rate limit quá cao - chờ vài phút rồi thử lại';
        } else if (message.includes('requested format') || message.includes('format')) {
            return 'Định dạng video không được hỗ trợ - thử video khác';
        } else if (message.includes('not available')) {
            return 'Video này không có audio hoặc đã bị xóa';
        } else if (message.includes('ffmpeg')) {
            return 'Lỗi FFmpeg - kiểm tra cài đặt';
        } else if (message.includes('timeout')) {
            return 'Quá lâu khi tải video - thử video khác';
        } else if (message.includes('age restricted')) {
            return 'Video bị giới hạn tuổi - thử video khác';
        } else if (message.includes('invalid url')) {
            return 'URL inválida ou vídeo restrito';
        }
        
        return 'Lỗi não xác định - thử lại sau';
    }

    private async withRateLimit<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
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
            } catch (error) {
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

    private clearActiveProcess(): void {
        if (!this.activeProcess) {
            return;
        }

        const processToStop = this.activeProcess;
        this.activeProcess = undefined;

        try {
            processToStop.kill('SIGTERM');
        } catch (error) {
            console.warn(`[${this.guildId}] Failed to stop active playback process:`, error);
        }
    }

    public stop(): void {
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
        } catch (error) {
            console.warn(`[${this.guildId}] Failed to send stop notification:`, error);
        }
    }

    public skip(): void {
        this.clearActiveProcess();
        this.player.stop();
        
        const skippedTrack = this.currentTrack?.title || 'Track';
        try {
            void this.textChannel.send(`⏭️ **Đã bỏ qua:** ${skippedTrack}`);
        } catch (error) {
            console.warn(`[${this.guildId}] Failed to send skip notification:`, error);
        }
    }

    public getQueueInfo(): string {
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

export const musicManager = new Map<string, MusicSubscription>();
