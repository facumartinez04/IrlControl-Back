import { supabase } from '../config/supabase.js';

class CommandRepository {
    async getLatestCommandByUserId(userId) {
        const { data, error } = await supabase
            .from('command_queue')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            throw new Error(`Repository Error: ${error.message}`);
        }

        return data;
    }

    async create(commandData) {
        const { data, error } = await supabase
            .from('command_queue')
            .insert(commandData)
            .select()
            .single();

        if (error) {
            throw new Error(`Repository Error: ${error.message}`);
        }

        return data;
    }
}

export default new CommandRepository();
