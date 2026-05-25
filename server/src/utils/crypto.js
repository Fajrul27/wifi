const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // Harus 32 bytes
const IV = Buffer.from(process.env.ENCRYPTION_IV, 'hex'); // Harus 16 bytes

const encrypt = (text) => {
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const decrypt = (encrypted) => {
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = { encrypt, decrypt };