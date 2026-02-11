
import { supabase } from './supabaseClient';
import { LogEntry } from '../types';

/**
 * Generador de ID compatible con todos los navegadores
 */
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export const logService = {
    addLog: async (userId: string, username: string, action: string, details?: string) => {
        if (!userId || !username) return;

        const newLog: LogEntry = {
            id: generateId(),
            userId,
            username,
            action,
            details: details || '',
            timestamp: new Date().toISOString()
        };

        if (supabase) {
            try {
                const { error } = await supabase.from('logs').insert(newLog);
                if (error) {
                    console.error("[LOG SERVICE] Error inserting log:", error.message, error.details);
                } else {
                    console.log(`[LOG SERVICE] Action logged: ${action}`);
                }
            } catch (e) {
                console.error("[LOG SERVICE] Critical failure:", e);
            }
        } else {
            console.warn("[LOG SERVICE] Supabase client not initialized. Log skipped.");
        }
    },

    getLogs: async (requesterId: string): Promise<LogEntry[]> => {
        if (!supabase || !requesterId) return [];
        
        try {
            const { data: userData } = await supabase.from('users').select('isAdmin').eq('id', requesterId).maybeSingle();
            if (!userData?.isAdmin) return [];

            const { data, error } = await supabase
                .from('logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(200);
            
            if (error) {
                console.error("[LOG SERVICE] Error fetching logs:", error.message);
                return [];
            }
            return data as LogEntry[] || [];
        } catch (e) {
            console.error("[LOG SERVICE] Fetching failed:", e);
            return [];
        }
    }
};
