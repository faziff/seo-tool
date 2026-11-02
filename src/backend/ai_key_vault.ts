import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

export interface EncryptedSecret {
  encrypted_key: string;
  iv: string;
  auth_tag: string;
}

function encryptionSecret(): string {
  // In production, JWT_SECRET is already required to be a strong stable secret.
  // A dedicated AI_KEYS_ENCRYPTION_SECRET is recommended for independent rotation.
  const secret = String(process.env.AI_KEYS_ENCRYPTION_SECRET || process.env.JWT_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('Set AI_KEYS_ENCRYPTION_SECRET (32+ characters) or a stable JWT_SECRET before saving provider keys.');
  }
  return secret;
}

function encryptionKey(): Buffer {
  return scryptSync(encryptionSecret(), 'crox-user-ai-credentials-v1', 32);
}

export function encryptProviderKey(apiKey: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  return {
    encrypted_key: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64')
  };
}

export function decryptProviderKey(value: { encrypted_key: string; iv: string; auth_tag: string }): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.encrypted_key, 'base64')),
    decipher.final()
  ]).toString('utf8');
}
