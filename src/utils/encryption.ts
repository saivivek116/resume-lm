import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getSecret(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length !== 64) {
    throw new Error('API_KEY_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(secret, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getSecret(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decrypt(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted key format')
  const [ivHex, authTagHex, ciphertextHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, getSecret(), iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
