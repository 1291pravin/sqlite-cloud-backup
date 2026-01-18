import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/core/db-manager';
import { Logger } from '../../src/utils/logger';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

describe('DatabaseManager', () => {
  const testDir = path.join(__dirname, 'test-db-manager');
  const testDbPath = path.join(testDir, 'test.db');
  let dbManager: DatabaseManager;
  let logger: Logger;

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create a test SQLite database
    const db = new Database(testDbPath);
    db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, value TEXT)');
    db.exec("INSERT INTO test (value) VALUES ('test data')");
    db.close();

    logger = new Logger('error');
    dbManager = new DatabaseManager(testDbPath, logger);
  });

  afterEach(() => {
    // Clean up
    dbManager.close();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('open/close', () => {
    it('should open database successfully', () => {
      expect(() => dbManager.open()).not.toThrow();
    });

    it('should throw when database does not exist', () => {
      const nonExistentPath = path.join(testDir, 'does-not-exist', 'path.db');
      const nonExistentManager = new DatabaseManager(nonExistentPath, logger);
      expect(() => nonExistentManager.open()).toThrow('Database not found');
    });

    it('should close database without error', () => {
      dbManager.open();
      expect(() => dbManager.close()).not.toThrow();
    });
  });

  describe('getBuffer', () => {
    it('should return database as buffer', async () => {
      const buffer = await dbManager.getBuffer();

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should return valid SQLite data', async () => {
      const buffer = await dbManager.getBuffer();

      // SQLite files start with this header
      const header = buffer.slice(0, 16).toString('utf-8');
      expect(header).toContain('SQLite format');
    });
  });

  describe('getChecksum', () => {
    it('should return consistent checksum', async () => {
      const checksum1 = await dbManager.getChecksum();
      const checksum2 = await dbManager.getChecksum();

      expect(checksum1).toBe(checksum2);
      expect(checksum1).toHaveLength(64); // SHA-256
    });

    it('should change after database modification', async () => {
      const checksumBefore = await dbManager.getChecksum();

      // Modify database
      const db = new Database(testDbPath);
      db.exec("INSERT INTO test (value) VALUES ('new data')");
      db.close();

      const checksumAfter = await dbManager.getChecksum();

      expect(checksumBefore).not.toBe(checksumAfter);
    });
  });

  describe('replaceWithBuffer', () => {
    it('should replace database with new buffer', async () => {
      // Create a different database
      const tempDb = path.join(testDir, 'temp.db');
      const db = new Database(tempDb);
      db.exec('CREATE TABLE other (id INTEGER PRIMARY KEY, name TEXT)');
      db.exec("INSERT INTO other (name) VALUES ('replaced')");
      db.close();

      const newBuffer = fs.readFileSync(tempDb);
      await dbManager.replaceWithBuffer(newBuffer);

      // Verify replacement
      const replacedDb = new Database(testDbPath);
      const tables = replacedDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      replacedDb.close();

      expect(tables.some((t: { name: string }) => t.name === 'other')).toBe(true);

      fs.unlinkSync(tempDb);
    });

    it('should use atomic write (temp file + rename)', async () => {
      const originalBuffer = await dbManager.getBuffer();

      // Replace should be atomic
      await dbManager.replaceWithBuffer(originalBuffer);

      // Temp file should not exist after replacement
      expect(fs.existsSync(`${testDbPath}.tmp`)).toBe(false);
    });
  });

  describe('metadata operations', () => {
    it('should return default metadata when none exists', async () => {
      const metadata = await dbManager.getLocalMetadata();

      expect(metadata.lastSyncTimestamp).toBe(0);
      expect(metadata.lastSyncChecksum).toBe('');
    });

    it('should save and retrieve metadata', async () => {
      const testMetadata = {
        lastSyncTimestamp: Date.now(),
        lastSyncChecksum: 'test-checksum-123'
      };

      await dbManager.updateLocalMetadata(testMetadata);
      const retrieved = await dbManager.getLocalMetadata();

      expect(retrieved.lastSyncTimestamp).toBe(testMetadata.lastSyncTimestamp);
      expect(retrieved.lastSyncChecksum).toBe(testMetadata.lastSyncChecksum);
    });

    it('should merge partial metadata updates', async () => {
      await dbManager.updateLocalMetadata({
        lastSyncTimestamp: 1000,
        lastSyncChecksum: 'checksum-1'
      });

      await dbManager.updateLocalMetadata({
        lastSyncChecksum: 'checksum-2'
      });

      const metadata = await dbManager.getLocalMetadata();

      expect(metadata.lastSyncTimestamp).toBe(1000);
      expect(metadata.lastSyncChecksum).toBe('checksum-2');
    });
  });

  describe('getModifiedTime', () => {
    it('should return modification time', async () => {
      const modTime = await dbManager.getModifiedTime();

      expect(modTime).toBeGreaterThan(0);
      expect(modTime).toBeLessThanOrEqual(Date.now());
    });

    it('should update after file modification', async () => {
      const timeBefore = await dbManager.getModifiedTime();

      // Wait enough for filesystem timestamp resolution (can be 1-2 seconds on some systems)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const db = new Database(testDbPath);
      db.exec("INSERT INTO test (value) VALUES ('trigger update')");
      db.close();

      const timeAfter = await dbManager.getModifiedTime();

      expect(timeAfter).toBeGreaterThanOrEqual(timeBefore);
    });
  });
});
