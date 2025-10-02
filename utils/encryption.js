const crypto = require('crypto');

class EncryptionService {
    constructor() {
        // Përpiqu të marrësh nga .env, ose gjenero një të ri
        this.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || this.generateRandomKey();
        
        this.ALGORITHM = 'aes-256-cbc';
        this.IV_LENGTH = 16;
        
        // Sigurohu që çelësi është 32 karaktere
        this.validateKey();
        
        // Nëse u gjenerua çelës i ri, trego paralajmërim
        if (!process.env.ENCRYPTION_KEY) {
            console.warn('⚠️  PARALAJMËRIM SIGURIE:');
            console.warn('⚠️  ENCRYPTION_KEY nuk u gjet në .env file');
            console.warn('⚠️  U gjenerua automatikisht një çelës i rastësishëm:');
            console.warn('⚠️  ' + this.ENCRYPTION_KEY);
            console.warn('⚠️  KY ÇELËS DO TË NDRYSHOJE NË ÇDO RESTART TË SERVERIT!');
            console.warn('⚠️  VENDOSNI NJË ÇELËS TË FIKSUAR NË .env PËR SIGURI TË PLOTË!');
        }
    }

    generateRandomKey() {
        // Gjenero një çelës të rastësishëm 32 karakteresh (256 bit)
        return crypto.randomBytes(32).toString('hex').slice(0, 32);
    }

    validateKey() {
        if (this.ENCRYPTION_KEY.length !== 32) {
            console.warn('⚠️  ENCRYPTION_KEY nuk është 32 karaktere. Duke e rregulluar...');
            
            if (this.ENCRYPTION_KEY.length < 32) {
                this.ENCRYPTION_KEY = this.ENCRYPTION_KEY.padEnd(32, '0');
            } else {
                this.ENCRYPTION_KEY = this.ENCRYPTION_KEY.slice(0, 32);
            }
        }
    }

    encrypt(text) {
        try {
            const iv = crypto.randomBytes(this.IV_LENGTH);
            const key = Buffer.from(this.ENCRYPTION_KEY, 'utf8');
            const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('❌ Gabim gjatë enkriptimit:', error);
            throw new Error('Gabim enkriptimi: ' + error.message);
        }
    }

    decrypt(text) {
        try {
            const parts = text.split(':');
            if (parts.length !== 2) {
                throw new Error('Teksti i enkriptuar ka format të pavlefshëm');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encryptedText = parts[1];
            const key = Buffer.from(this.ENCRYPTION_KEY, 'utf8');
            
            const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
            
            let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ Gabim gjatë dekriptimit:', error);
            throw new Error('Gabim dekriptimi: ' + error.message);
        }
    }

    testEncryption() {
        try {
            const testText = "test123";
            const encrypted = this.encrypt(testText);
            const decrypted = this.decrypt(encrypted);
            
            console.log('🔐 Test i enkriptimit AES-256-CBC:');
            console.log('📝 Original:', testText);
            console.log('🔒 Encrypted:', encrypted);
            console.log('🔓 Decrypted:', decrypted);
            console.log('✅ Success:', testText === decrypted);
            
            return testText === decrypted;
        } catch (error) {
            console.error('❌ Testi dështoi:', error);
            return false;
        }
    }
}

// ==================== SELF-TEST AUTOMATIK ====================
console.log('🔄 Duke testuar enkriptimin AES-256-CBC...');
try {
    const encryptionService = new EncryptionService();
    const testResult = encryptionService.testEncryption();
    console.log(testResult ? '✅ Enkriptimi funksionon perfektisht!' : '❌ Enkriptimi dështoi!');
} catch (error) {
    console.error('❌ Testi i enkriptimit dështoi:', error.message);
}

module.exports = new EncryptionService();
