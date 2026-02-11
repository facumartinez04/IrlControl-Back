import { supabase } from '../config/supabase.js';

class LogRepository {
    async create(logData) {
        const { data, error } = await supabase
            .from('logs')
            .insert(logData)
            .select()
            .single();

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async findAll(limit = 200) {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }
}

export default new LogRepository();
