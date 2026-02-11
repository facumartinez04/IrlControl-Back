import { supabase } from '../config/supabase.js';

class UserRepository {
    async findByUsername(username) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username)
            .maybeSingle();

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async create(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async update(id, userData) {
        const { data, error } = await supabase
            .from('users')
            .update(userData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Repository Error: ${error.message}`);
    }

    async findAll() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Repository Error: ${error.message}`);
        return data;
    }

    async updateSuspension(id, isSuspended) {
        const { error } = await supabase
            .from('users')
            .update({ isSuspended })
            .eq('id', id);

        if (error) throw new Error(`Repository Error: ${error.message}`);
    }
}

export default new UserRepository();
