import crypto from 'crypto';

const ENCRYPTION_KEY = '12345678901234567890123456789012'; // 32 chars
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    const textParts = text.split(':');
    if (textParts.length < 2) return text;

    try {
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (error) {
        console.error("Decryption failed:", error);
        return text;
    }
}

const original = "mySecretPassword123";
const encrypted = encrypt(original);
const decrypted = decrypt(encrypted);

console.log("Original:", original);
console.log("Encrypted:", encrypted);
console.log("Decrypted:", decrypted);

if (original === decrypted) {
    console.log("SUCCESS: Encryption/Decryption works.");
} else {
    console.error("FAILURE: Decrypted text does not match original.");
    process.exit(1);
}
