const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex'); // Génère une clé hexadécimale de 32 bytes (256 bits)
console.log(`ENCRYPTION_KEY=${key}`);
