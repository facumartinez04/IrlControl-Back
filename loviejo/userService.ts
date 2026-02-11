import { User } from '../types';
import { supabase } from './supabaseClient';

const SESSION_KEY = 'irl_remoto_session_v5';
const LAST_VERIFY_KEY = 'irl_remoto_last_verify_v5';
const VERIFICATION_INTERVAL = 60 * 60 * 1000;

/**
 * Generador de ID compatible con todos los navegadores (incluso sin crypto.randomUUID)
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

const isValidUuid = (id: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const checkSubscriptionStatus = async (user: User): Promise<User> => {
    if (user.isAdmin) return user;
    if (user.subscription && user.subscription.type === 'fixed' && user.subscription.endDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        const endDateStr = user.subscription.endDate;
        if (todayStr > endDateStr) {
            if (!user.isSuspended) {
                user.isSuspended = true;
                if (supabase && isValidUuid(user.id)) {
                    await supabase.from('users').update({ isSuspended: true }).eq('id', user.id);
                }
            }
        }
    }
    return user;
};

export const userService = {
    authenticate: async (username: string, pass: string) => {
        if (supabase) {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .ilike('username', username) 
                .maybeSingle();

            if (data) {
                if (data.password !== pass) return { success: false, error: 'Contraseña incorrecta' };
                const fullUser = { ...data, subscription: data.subscription || { type: 'unlimited' } } as User;
                const checkedUser = await checkSubscriptionStatus(fullUser);
                if (checkedUser.isSuspended) return { success: false, error: 'Cuenta suspendida o plan vencido' };

                localStorage.setItem(SESSION_KEY, JSON.stringify(checkedUser));
                localStorage.setItem(LAST_VERIFY_KEY, Date.now().toString());
                return { success: true, user: checkedUser };
            }
        }
        return { success: false, error: 'Usuario no encontrado' };
    },

    getSession: async (): Promise<User | null> => {
        try {
            const sess = localStorage.getItem(SESSION_KEY);
            if (!sess) return null;
            const sessionUser = JSON.parse(sess);
            if (!sessionUser || !sessionUser.id) return null;

            const lastVerifyStr = localStorage.getItem(LAST_VERIFY_KEY);
            const lastVerify = lastVerifyStr ? parseInt(lastVerifyStr) : 0;
            if (Date.now() - lastVerify < VERIFICATION_INTERVAL) {
                return sessionUser as User;
            }

            if (supabase && isValidUuid(sessionUser.id)) {
                const { data } = await supabase.from('users').select('*').eq('id', sessionUser.id).maybeSingle();
                if (!data) {
                    localStorage.removeItem(SESSION_KEY);
                    return null;
                }
                const fullUser = { ...data, subscription: data.subscription || { type: 'unlimited' } } as User;
                const checkedUser = await checkSubscriptionStatus(fullUser);
                if (checkedUser.isSuspended) {
                    localStorage.removeItem(SESSION_KEY);
                    return null;
                }
                localStorage.setItem(SESSION_KEY, JSON.stringify(checkedUser));
                localStorage.setItem(LAST_VERIFY_KEY, Date.now().toString());
                return checkedUser;
            }
            return sessionUser as User;
        } catch (e) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
    },

    logout: async () => {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(LAST_VERIFY_KEY);
    },

    getAllUsers: async (): Promise<User[]> => {
        if (!supabase) return [];
        const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true });
        if (error || !data) return [];
        return data as User[];
    },

    createUser: async (userData: any) => {
        const newUser: User = {
            id: generateId(),
            username: userData.username,
            password: userData.password,
            isAdmin: userData.isAdmin || false,
            isSuspended: false,
            obsConfig: userData.obsConfig || {},
            ingestConfigs: userData.ingestConfigs || [],
            rdpConfig: userData.rdpConfig || {},
            subscription: userData.subscription || { type: 'unlimited' }
        };

        if (supabase) {
            const { error } = await supabase.from('users').insert(newUser);
            if (error) throw new Error(error.message);
            return newUser;
        }
        throw new Error("Supabase no configurado");
    },

    updateUser: async (id: string, data: Partial<User>) => {
        if (supabase && isValidUuid(id)) {
            const { error } = await supabase.from('users').update(data).eq('id', id);
            if (error) throw new Error(error.message);
        }
        const sess = localStorage.getItem(SESSION_KEY);
        if (sess) {
            const current = JSON.parse(sess);
            if (current.id === id) {
                localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...data }));
            }
        }
    },

    deleteUser: async (id: string) => {
        if (supabase && isValidUuid(id)) {
             const { error } = await supabase.from('users').delete().eq('id', id);
             if (error) throw new Error(error.message);
        }
    },

    toggleUserSuspension: async (id: string) => {
        if (supabase && isValidUuid(id)) {
            const { data } = await supabase.from('users').select('isSuspended').eq('id', id).single();
            if (data) {
                await supabase.from('users').update({ isSuspended: !data.isSuspended }).eq('id', id);
            }
        }
    }
};