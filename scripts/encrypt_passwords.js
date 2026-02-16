
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 chars
const IV_LENGTH = 16;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL and Key must be provided in environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function encrypt(text) {
    if (!text) return text;
    // Check if already encrypted (heuristic: looks like iv:content)
    if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length === 2 && parts[0].length === 32) {
            // Likely already encrypted. 
            // IMPORTANT: This heuristic might fail if password naturally has this format, 
            // but it's the best we can do without a flag. 
            // Given the user wants to encrypt existing ones, we assume those without : are plain.
            return text;
        }
    }

    // Encrypt
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

async function migrate() {
    console.log('Starting password encryption migration...');

    const { data: users, error } = await supabase.from('users').select('*');

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log(`Found ${users.length} users.`);

    let updatedCount = 0;

    for (const user of users) {
        const originalPassword = user.password;
        if (!originalPassword) continue;

        const newPassword = encrypt(originalPassword);

        if (newPassword !== originalPassword) {
            console.log(`Encrypting password for user: ${user.username}`);

            const { error: updateError } = await supabase
                .from('users')
                .update({ password: newPassword })
                .eq('id', user.id);

            if (updateError) {
                console.error(`Failed to update user ${user.username}:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            console.log(`User ${user.username} already encrypted (or empty).`);
        }
    }

    console.log(`Migration complete. Updated ${updatedCount} users.`);
}

migrate();
