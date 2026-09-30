/**
 * Encryption Module Tests
 * 
 * Validates AES-256-GCM encryption/decryption
 * Tests key derivation, authentication, and sensitive field encryption
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  encrypt,
  decrypt,
  hashField,
  encryptReportSensitiveFields,
  decryptReportSensitiveFields,
  testEncryption,
  getEncryptionInfo,
} from '@/lib/encryption';

describe('Encryption Module', () => {
  const testPassword = 'secure-test-password-123456';
  const plaintext = 'Sensitive user information';

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt successfully', async () => {
      const encrypted = await encrypt(plaintext, testPassword);

      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      expect(encrypted.version).toBe(1);

      const decrypted = await decrypt(encrypted, testPassword);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random IV)', async () => {
      const encrypted1 = await encrypt(plaintext, testPassword);
      const encrypted2 = await encrypt(plaintext, testPassword);

      // Ciphertexts should be different due to random IV
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      // But both should decrypt to same plaintext
      const decrypted1 = await decrypt(encrypted1, testPassword);
      const decrypted2 = await decrypt(encrypted2, testPassword);

      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should fail decryption with wrong password', async () => {
      const encrypted = await encrypt(plaintext, testPassword);

      try {
        await decrypt(encrypted, 'wrong-password');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Decryption failed');
      }
    });

    it('should fail decryption with corrupted ciphertext', async () => {
      const encrypted = await encrypt(plaintext, testPassword);

      // Corrupt the ciphertext
      const corrupted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -10) + 'xxxxxxxxxx',
      };

      try {
        await decrypt(corrupted, testPassword);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Decryption failed');
      }
    });

    it('should fail decryption with wrong IV', async () => {
      const encrypted = await encrypt(plaintext, testPassword);

      // Use wrong IV
      const wrongIv = {
        ...encrypted,
        iv: Buffer.from('wrong_iv_123456789012').toString('base64'),
      };

      try {
        await decrypt(wrongIv, testPassword);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Decryption failed');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string encryption', async () => {
      const encrypted = await encrypt('', testPassword);
      const decrypted = await decrypt(encrypted, testPassword);

      expect(decrypted).toBe('');
    });

    it('should handle very long plaintext', async () => {
      const longText = 'a'.repeat(10000);
      const encrypted = await encrypt(longText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);

      expect(decrypted).toBe(longText);
    });

    it('should handle special characters', async () => {
      const specialText = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
      const encrypted = await encrypt(specialText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);

      expect(decrypted).toBe(specialText);
    });

    it('should handle unicode characters', async () => {
      const unicodeText = '你好世界 مرحبا بالعالم 🔐🔒🔑';
      const encrypted = await encrypt(unicodeText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);

      expect(decrypted).toBe(unicodeText);
    });

    it('should handle multiline text', async () => {
      const multilineText = `Line 1\nLine 2\nLine 3\n\nWith empty line above`;
      const encrypted = await encrypt(multilineText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);

      expect(decrypted).toBe(multilineText);
    });
  });

  describe('Hash Field Function', () => {
    it('should hash field consistently', async () => {
      const email = 'user@example.com';

      const hash1 = await hashField(email);
      const hash2 = await hashField(email);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const email1 = 'user1@example.com';
      const email2 = 'user2@example.com';

      const hash1 = await hashField(email1);
      const hash2 = await hashField(email2);

      expect(hash1).not.toBe(hash2);
    });

    it('should be one-way function (non-reversible)', async () => {
      const email = 'user@example.com';
      const hash = await hashField(email);

      // Cannot derive email from hash
      expect(hash).not.toContain('user');
      expect(hash).not.toContain('example');
    });

    it('should produce base64 output', async () => {
      const email = 'user@example.com';
      const hash = await hashField(email);

      // Should be valid base64
      try {
        const buffer = Buffer.from(hash, 'base64');
        expect(buffer.length).toBeGreaterThan(0);
      } catch {
        expect.fail('Hash should be valid base64');
      }
    });
  });

  describe('Report Sensitive Fields Encryption', () => {
    it('should encrypt report sensitive fields', async () => {
      const report = {
        id: 'report-123',
        description: 'Test report',
        witness_name: 'John Doe',
        witness_contact: 'john@example.com',
        reporter_name: 'Jane Smith',
        reporter_contact: '555-1234',
        injury_details: 'Broken arm and ribs',
        status: 'pending',
      };

      const encrypted = await encryptReportSensitiveFields(report, testPassword);

      // Original fields should be cleared
      expect(encrypted.witness_name).toBeNull();
      expect(encrypted.witness_contact).toBeNull();
      expect(encrypted.reporter_name).toBeNull();
      expect(encrypted.reporter_contact).toBeNull();
      expect(encrypted.injury_details).toBeNull();

      // Non-sensitive fields preserved
      expect(encrypted.description).toBe(report.description);
      expect(encrypted.status).toBe(report.status);

      // Encrypted fields should exist
      expect(encrypted.witness_name_encrypted).toBeDefined();
      expect(encrypted.witness_contact_encrypted).toBeDefined();
      expect(encrypted.reporter_name_encrypted).toBeDefined();
      expect(encrypted.reporter_contact_encrypted).toBeDefined();
      expect(encrypted.injury_details_encrypted).toBeDefined();
    });

    it('should decrypt report sensitive fields', async () => {
      const originalReport = {
        id: 'report-123',
        description: 'Test report',
        witness_name: 'John Doe',
        witness_contact: 'john@example.com',
        reporter_name: 'Jane Smith',
        reporter_contact: '555-1234',
        injury_details: 'Broken arm and ribs',
        status: 'pending',
      };

      // Encrypt
      const encrypted = await encryptReportSensitiveFields(originalReport, testPassword);

      // Decrypt
      const decrypted = await decryptReportSensitiveFields(encrypted, testPassword);

      // Verify sensitive fields are restored
      expect(decrypted.witness_name).toBe(originalReport.witness_name);
      expect(decrypted.witness_contact).toBe(originalReport.witness_contact);
      expect(decrypted.reporter_name).toBe(originalReport.reporter_name);
      expect(decrypted.reporter_contact).toBe(originalReport.reporter_contact);
      expect(decrypted.injury_details).toBe(originalReport.injury_details);

      // Non-sensitive fields unchanged
      expect(decrypted.description).toBe(originalReport.description);
    });

    it('should handle partial sensitive fields', async () => {
      const report = {
        id: 'report-123',
        description: 'Test report',
        witness_name: 'John Doe',
        // witness_contact is missing
        reporter_name: null,
        reporter_contact: '555-1234',
        injury_details: undefined,
        status: 'pending',
      };

      const encrypted = await encryptReportSensitiveFields(report, testPassword);

      // Only present fields should be encrypted
      expect(encrypted.witness_name_encrypted).toBeDefined();
      expect(encrypted.witness_contact_encrypted).toBeUndefined();
      expect(encrypted.reporter_contact_encrypted).toBeDefined();
    });

    it('should fail decryption with wrong password', async () => {
      const report = {
        id: 'report-123',
        witness_name: 'John Doe',
        witness_contact: 'john@example.com',
      };

      const encrypted = await encryptReportSensitiveFields(report, testPassword);

      // Try to decrypt with wrong password
      const decrypted = await decryptReportSensitiveFields(
        encrypted,
        'wrong-password'
      );

      // Fields should be marked as error
      expect(decrypted.witness_name).toBe('[DECRYPTION_ERROR]');
      expect(decrypted.witness_contact).toBe('[DECRYPTION_ERROR]');
    });
  });

  describe('Encryption Info', () => {
    it('should return encryption configuration', () => {
      const info = getEncryptionInfo();

      expect(info.algorithm).toBe('AES-GCM');
      expect(info.keySize).toBe(256);
      expect(info.ivSize).toBe(96);
      expect(info.tagLength).toBe(128);
      expect(info.pbkdfIterations).toBeGreaterThanOrEqual(100000);
    });
  });

  describe('Test Encryption Function', () => {
    it('should pass encryption test', async () => {
      const result = await testEncryption();

      expect(result).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt in reasonable time', async () => {
      const startEncrypt = performance.now();
      const encrypted = await encrypt(plaintext, testPassword);
      const encryptTime = performance.now() - startEncrypt;

      expect(encryptTime).toBeLessThan(1000); // < 1 second

      const startDecrypt = performance.now();
      await decrypt(encrypted, testPassword);
      const decryptTime = performance.now() - startDecrypt;

      expect(decryptTime).toBeLessThan(1000); // < 1 second
    });

    it('should handle rapid encrypt/decrypt cycles', async () => {
      const cycles = 10;
      const startTime = performance.now();

      for (let i = 0; i < cycles; i++) {
        const encrypted = await encrypt(plaintext, testPassword);
        await decrypt(encrypted, testPassword);
      }

      const duration = performance.now() - startTime;
      const avgTimePerCycle = duration / cycles;

      expect(avgTimePerCycle).toBeLessThan(500); // < 500ms per cycle
    });
  });

  describe('Security Validation', () => {
    it('should use PBKDF2 for key derivation (prevents brute force)', async () => {
      const info = getEncryptionInfo();

      // Should use high iteration count
      expect(info.pbkdfIterations).toBeGreaterThanOrEqual(100000);
    });

    it('should use 256-bit keys', () => {
      const info = getEncryptionInfo();

      expect(info.keySize).toBe(256);
    });

    it('should use 96-bit IVs (optimal for GCM)', () => {
      const info = getEncryptionInfo();

      expect(info.ivSize).toBe(96);
    });

    it('should use 128-bit authentication tags', () => {
      const info = getEncryptionInfo();

      expect(info.tagLength).toBe(128);
    });
  });
});
