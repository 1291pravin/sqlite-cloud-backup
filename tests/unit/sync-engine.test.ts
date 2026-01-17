import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncEngine } from '../../src/core/sync-engine';
import { DatabaseManager } from '../../src/core/db-manager';
import { BaseProvider } from '../../src/providers/base-provider';
import { Logger } from '../../src/utils/logger';
import { ChecksumUtil } from '../../src/utils/checksum';
import { ProviderMetadata, SyncMetadata } from '../../src/types';

// Mock provider implementation
class MockProvider extends BaseProvider {
  public files: Map<string, Buffer> = new Map();
  public metadata: SyncMetadata | null = null;

  async uploadFile(fileName: string, buffer: Buffer): Promise<void> {
    this.files.set(fileName, buffer);
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    const file = this.files.get(fileName);
    if (!file) throw new Error(`File not found: ${fileName}`);
    return file;
  }

  async fileExists(fileName: string): Promise<boolean> {
    return this.files.has(fileName);
  }

  async getMetadata(_fileName: string): Promise<ProviderMetadata | null> {
    if (!this.metadata) return null;
    return {
      checksum: this.metadata.checksum,
      modifiedAt: this.metadata.lastSyncTimestamp,
      size: 0
    };
  }

  async updateMetadata(metadata: SyncMetadata): Promise<void> {
    this.metadata = metadata;
  }

  async deleteFile(fileName: string): Promise<void> {
    this.files.delete(fileName);
  }
}

describe('SyncEngine', () => {
  let syncEngine: SyncEngine;
  let mockDbManager: DatabaseManager;
  let mockProvider: MockProvider;
  let logger: Logger;

  const testDbBuffer = Buffer.from('test database content');
  const testChecksum = 'abc123def456'; // Simplified for testing

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    mockProvider = new MockProvider();

    // Mock DatabaseManager
    mockDbManager = {
      getBuffer: vi.fn().mockResolvedValue(testDbBuffer),
      getChecksum: vi.fn().mockResolvedValue(testChecksum),
      replaceWithBuffer: vi.fn().mockResolvedValue(undefined),
      updateLocalMetadata: vi.fn().mockResolvedValue(undefined),
      getModifiedTime: vi.fn().mockResolvedValue(Date.now()),
      close: vi.fn()
    } as unknown as DatabaseManager;

    syncEngine = new SyncEngine(mockDbManager, mockProvider, logger);
  });

  describe('pushToCloud', () => {
    it('should upload database and update metadata', async () => {
      const result = await syncEngine.pushToCloud();

      expect(result.success).toBe(true);
      expect(result.type).toBe('push');
      expect(result.bytesTransferred).toBe(testDbBuffer.length);
      expect(mockProvider.files.has('current.db')).toBe(true);
      expect(mockProvider.metadata).not.toBeNull();
      expect(mockDbManager.updateLocalMetadata).toHaveBeenCalled();
    });

    it('should include duration in result', async () => {
      const result = await syncEngine.pushToCloud();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('pullFromCloud', () => {
    it('should throw error when no cloud version exists', async () => {
      await expect(syncEngine.pullFromCloud()).rejects.toThrow('No cloud version found');
    });

    it('should download and replace local database', async () => {
      // Setup cloud version
      const cloudBuffer = Buffer.from('cloud database content');
      mockProvider.files.set('current.db', cloudBuffer);

      const result = await syncEngine.pullFromCloud();

      expect(result.success).toBe(true);
      expect(result.type).toBe('pull');
      expect(result.bytesTransferred).toBe(cloudBuffer.length);
      expect(mockDbManager.replaceWithBuffer).toHaveBeenCalledWith(cloudBuffer);
      expect(mockDbManager.updateLocalMetadata).toHaveBeenCalled();
    });

    it('should detect checksum mismatch', async () => {
      const cloudBuffer = Buffer.from('cloud database content');
      mockProvider.files.set('current.db', cloudBuffer);
      mockProvider.metadata = {
        dbName: 'current',
        lastSyncTimestamp: Date.now(),
        lastSyncType: 'push',
        checksum: 'different-checksum',
        version: 1
      };

      await expect(syncEngine.pullFromCloud()).rejects.toThrow('Checksum mismatch');
    });
  });

  describe('sync (bidirectional)', () => {
    it('should push when no cloud version exists', async () => {
      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.type).toBe('push');
      expect(mockProvider.files.has('current.db')).toBe(true);
    });

    it('should push when no cloud metadata exists', async () => {
      mockProvider.files.set('current.db', Buffer.from('some data'));

      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.type).toBe('push');
    });

    it('should skip when checksums match', async () => {
      // Setup matching checksums
      mockProvider.files.set('current.db', testDbBuffer);
      mockProvider.metadata = {
        dbName: 'current',
        lastSyncTimestamp: Date.now(),
        lastSyncType: 'push',
        checksum: testChecksum,
        version: 1
      };

      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.type).toBe('bidirectional');
      expect(result.bytesTransferred).toBe(0);
    });

    it('should push when local is newer', async () => {
      const oldTimestamp = Date.now() - 10000;
      mockProvider.files.set('current.db', Buffer.from('old data'));
      mockProvider.metadata = {
        dbName: 'current',
        lastSyncTimestamp: oldTimestamp,
        lastSyncType: 'push',
        checksum: 'old-checksum',
        version: 1
      };

      // Local is newer
      vi.mocked(mockDbManager.getModifiedTime).mockResolvedValue(Date.now());

      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.type).toBe('push');
    });

    it('should pull when cloud is newer', async () => {
      const futureTimestamp = Date.now() + 10000;
      const cloudBuffer = Buffer.from('newer cloud data');
      // Use real checksum so verification passes
      const cloudChecksum = ChecksumUtil.calculateBufferChecksum(cloudBuffer);
      mockProvider.files.set('current.db', cloudBuffer);
      mockProvider.metadata = {
        dbName: 'current',
        lastSyncTimestamp: futureTimestamp,
        lastSyncType: 'push',
        checksum: cloudChecksum,
        version: 1
      };

      // Local is older
      vi.mocked(mockDbManager.getModifiedTime).mockResolvedValue(Date.now() - 10000);

      const result = await syncEngine.sync();

      expect(result.success).toBe(true);
      expect(result.type).toBe('pull');
      expect(mockDbManager.replaceWithBuffer).toHaveBeenCalledWith(cloudBuffer);
    });
  });
});
