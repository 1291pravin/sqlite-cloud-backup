import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TokenStorage, StoredTokens } from '../../src/providers/google-drive/token-storage';
import fs from 'fs';
import path from 'path';

describe('TokenStorage', () => {
  const testDir = path.join(__dirname, 'test-token-storage');
  const testDbPath = path.join(testDir, 'test.db');
  let tokenStorage: TokenStorage;

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a dummy db file (path is used for storage location)
    fs.writeFileSync(testDbPath, '');

    tokenStorage = new TokenStorage(testDbPath, 'error');
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('hasTokens', () => {
    it('should return false when no tokens exist', async () => {
      const result = await tokenStorage.hasTokens();
      expect(result).toBe(false);
    });

    it('should return true when tokens exist', async () => {
      await tokenStorage.saveTokens({
        refreshToken: 'test-refresh-token'
      });

      const result = await tokenStorage.hasTokens();
      expect(result).toBe(true);
    });
  });

  describe('saveTokens', () => {
    it('should save tokens to file', async () => {
      const tokens: StoredTokens = {
        refreshToken: 'test-refresh-token',
        accessToken: 'test-access-token',
        expiryDate: Date.now() + 3600000
      };

      await tokenStorage.saveTokens(tokens);

      const hasTokens = await tokenStorage.hasTokens();
      expect(hasTokens).toBe(true);
    });

    it('should create storage directory if not exists', async () => {
      const tokens: StoredTokens = {
        refreshToken: 'test-token'
      };

      await tokenStorage.saveTokens(tokens);

      const tokenDir = path.join(testDir, '.sqlite-cloud-backup');
      expect(fs.existsSync(tokenDir)).toBe(true);
    });
  });

  describe('getTokens', () => {
    it('should return null when no tokens exist', async () => {
      const tokens = await tokenStorage.getTokens();
      expect(tokens).toBeNull();
    });

    it('should retrieve saved tokens', async () => {
      const savedTokens: StoredTokens = {
        refreshToken: 'test-refresh-token',
        accessToken: 'test-access-token',
        expiryDate: 1234567890
      };

      await tokenStorage.saveTokens(savedTokens);
      const retrieved = await tokenStorage.getTokens();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.refreshToken).toBe(savedTokens.refreshToken);
      expect(retrieved?.accessToken).toBe(savedTokens.accessToken);
      expect(retrieved?.expiryDate).toBe(savedTokens.expiryDate);
    });

    it('should handle tokens without optional fields', async () => {
      const minimalTokens: StoredTokens = {
        refreshToken: 'only-refresh-token'
      };

      await tokenStorage.saveTokens(minimalTokens);
      const retrieved = await tokenStorage.getTokens();

      expect(retrieved).not.toBeNull();
      expect(retrieved?.refreshToken).toBe(minimalTokens.refreshToken);
      expect(retrieved?.accessToken).toBeUndefined();
      expect(retrieved?.expiryDate).toBeUndefined();
    });
  });

  describe('clearTokens', () => {
    it('should remove stored tokens', async () => {
      await tokenStorage.saveTokens({
        refreshToken: 'token-to-clear'
      });

      expect(await tokenStorage.hasTokens()).toBe(true);

      await tokenStorage.clearTokens();

      expect(await tokenStorage.hasTokens()).toBe(false);
    });

    it('should not throw when no tokens exist', async () => {
      await expect(tokenStorage.clearTokens()).resolves.not.toThrow();
    });
  });

  describe('token persistence', () => {
    it('should persist tokens across instances', async () => {
      const tokens: StoredTokens = {
        refreshToken: 'persistent-token'
      };

      await tokenStorage.saveTokens(tokens);

      // Create new instance with same path
      const newStorage = new TokenStorage(testDbPath, 'error');
      const retrieved = await newStorage.getTokens();

      expect(retrieved?.refreshToken).toBe(tokens.refreshToken);
    });
  });
});
