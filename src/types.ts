export interface Schedule {
    id: number;
    time: string;  // HH:mm
    message: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfWeek?: number;
    dayOfMonth?: number;
}

export interface Vote {
    userId: string;
    name: string;
    team: string | null;
    class: string | null;
    participating: boolean;
    timestamp: string;
}

export interface VoteState {
    isOpen: boolean;
}

export interface VoteScheduleConfig {
    enabled: boolean;
    startDay: number;  // 0-6 (Sunday=0)
    startTime: string; // HH:mm
    endDay: number;
    endTime: string;
    channelId?: string;
    threadId?: string;
}