/**
 * Encryption Module for Accountability Watch
 * 
 * Implements AES-256-GCM encryption for sensitive data:
 * - Contact information (email, phone, address)
 * - Reporter details
 * - Witness information
 * 
 * SECURITY PROPERTIES:
 * - Algorithm: AES-256-GCM (provides authenticated encryption)
 * - Key derivation: PBKDF2 with SHA-256
 * - IV: 96-bit cryptographically random (per-message)
 * - Authentication tag: 128-bit (prevents tampering)
 * 
 * COMPLIANCE:
 * - NIST recommended: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38D.pdf
 * - Uses Web Crypto API (standard in modern browsers and Node.js)
 * - No third-party crypto libraries (reduce attack surface)
 */

/**
 * Encryption configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keySize: 256,      // 256-bit key
  ivSize: 96,        // 96-bit IV (12 bytes) - recommended for GCM
  tagLength: 128,    // 128-bit authentication tag
  pbkdfIterations: 100000,  // OWASP recommendation
  pbkdfHashAlgorithm: 'SHA-256',
};

/**
 * Represents an encrypted message with metadata
 */
export interface EncryptedData {
  ciphertext: string;      // Base64 encoded
  iv: string;              // Base64 encoded
  salt: string;            // Base64 encoded (for key derivation)
  version: number;         // For future algorithm updates
}

/**
 * Generate a cryptographically secure random key
 * Used for one-time keys or master key generation
 */
async function generateRandomKey(bits: number = 256): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: bits },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive a key from a password using PBKDF2
 * 
 * SECURITY:
 * - Stretches password with 100k iterations
 * - Uses random salt (prevents rainbow table attacks)
 * - Output is suitable for AES-256-GCM
 */
async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive key bits
  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ENCRYPTION_CONFIG.pbkdfIterations,
      hash: ENCRYPTION_CONFIG.pbkdfHashAlgorithm,
    },
    keyMaterial,
    ENCRYPTION_CONFIG.keySize
  );

  // Convert bits to CryptoKey
  return crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-256-GCM
 * 
 * PROCESS:
 * 1. Generate random IV and salt
 * 2. Derive key from password + salt
 * 3. Encrypt plaintext with AES-256-GCM
 * 4. Return ciphertext + IV + salt (all base64 encoded)
 * 
 * INPUTS:
 * - plaintext: string to encrypt
 * - password: encryption password (can be master key or user-specific)
 * 
 * OUTPUT:
 * - EncryptedData object containing ciphertext, IV, salt, version
 */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedData> {
  try {
    // Generate random IV (96 bits for GCM is optimal)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Generate random salt for PBKDF2
    const salt = crypto.getRandomValues(new Uint8Array(32));

    // Derive key from password
    const key = await deriveKeyFromPassword(password, salt);

    // Encrypt plaintext
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv, tagLength: ENCRYPTION_CONFIG.tagLength },
      key,
      new TextEncoder().encode(plaintext)
    );

    // Return encrypted data as base64
    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      version: 1,
    };
  } catch (error: any) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt AES-256-GCM encrypted data
 * 
 * PROCESS:
 * 1. Decode base64 values (ciphertext, IV, salt)
 * 2. Derive key from password + salt
 * 3. Decrypt using AES-256-GCM
 * 4. Return plaintext
 * 
 * SECURITY:
 * - Authentication tag is automatically verified by Web Crypto API
 * - If decryption fails, throws error (prevents silent failures)
 * - Constant-time comparison protects against timing attacks (built-in)
 */
export async function decrypt(encrypted: EncryptedData, password: string): Promise<string> {
  try {
    // Decode base64 values
    const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
    const iv = base64ToArrayBuffer(encrypted.iv);
    const salt = base64ToArrayBuffer(encrypted.salt);

    // Derive key from password + salt
    const key = await deriveKeyFromPassword(password, salt);

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv, tagLength: ENCRYPTION_CONFIG.tagLength },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch (error: any) {
    throw new Error(`Decryption failed: ${error.message} (likely wrong password or corrupted data)`);
  }
}

/**
 * Hash a value using SHA-256
 * Used for creating searchable encrypted fields (hash-based indexing)
 * 
 * SECURITY:
 * - One-way function (cannot reverse)
 * - Same input always produces same hash
 * - Enables searching without decrypting
 * 
 * USE CASE:
 * - Create index on email_hash for fast lookups
 * - Store email_hash as additional column
 * - Query: WHERE email_hash = hash(search_value)
 */
export async function hashField(value: string): Promise<string> {
  try {
    const buffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value)
    );
    return arrayBufferToBase64(buffer);
  } catch (error: any) {
    throw new Error(`Hashing failed: ${error.message}`);
  }
}

/**
 * Encrypt sensitive fields in a report object
 * 
 * FIELDS ENCRYPTED:
 * - witness_contact (phone/email)
 * - reporter_contact (phone/email)
 * - witness_name (PII)
 * - reporter_name (PII)
 * - injury_details (sensitive medical info)
 */
export async function encryptReportSensitiveFields(
  report: Record<string, any>,
  masterPassword: string
): Promise<Record<string, any>> {
  const encrypted = { ...report };
  const sensitiveFields = [
    'witness_contact',
    'reporter_contact',
    'witness_name',
    'reporter_name',
    'injury_details',
  ];

  for (const field of sensitiveFields) {
    if (encrypted[field]) {
      encrypted[`${field}_encrypted`] = await encrypt(
        encrypted[field],
        masterPassword
      );
      encrypted[field] = null; // Clear plaintext
    }
  }

  return encrypted;
}

/**
 * Decrypt sensitive fields in a report object
 */
export async function decryptReportSensitiveFields(
  report: Record<string, any>,
  masterPassword: string
): Promise<Record<string, any>> {
  const decrypted = { ...report };
  const sensitiveFields = [
    'witness_contact',
    'reporter_contact',
    'witness_name',
    'reporter_name',
    'injury_details',
  ];

  for (const field of sensitiveFields) {
    const encryptedField = `${field}_encrypted`;
    if (decrypted[encryptedField]) {
      try {
        decrypted[field] = await decrypt(
          decrypted[encryptedField],
          masterPassword
        );
      } catch (error) {
        console.error(`Failed to decrypt ${field}:`, error);
        decrypted[field] = '[DECRYPTION_ERROR]';
      }
    }
  }

  return decrypted;
}

/**
 * Test encryption/decryption cycle
 * Use in unit tests or startup verification
 */
export async function testEncryption(): Promise<boolean> {
  try {
    const testMessage = 'Test message for encryption';
    const testPassword = 'test-password-123';

    const encrypted = await encrypt(testMessage, testPassword);
    const decrypted = await decrypt(encrypted, testPassword);

    return decrypted === testMessage;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}

/**
 * Get encryption algorithm info for logging/debugging
 */
export function getEncryptionInfo(): {
  algorithm: string;
  keySize: number;
  ivSize: number;
  tagLength: number;
  pbkdfIterations: number;
} {
  return {
    algorithm: ENCRYPTION_CONFIG.algorithm,
    keySize: ENCRYPTION_CONFIG.keySize,
    ivSize: ENCRYPTION_CONFIG.ivSize,
    tagLength: ENCRYPTION_CONFIG.tagLength,
    pbkdfIterations: ENCRYPTION_CONFIG.pbkdfIterations,
  };
}

/**
 * Helper: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
