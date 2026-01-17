import { DatabaseManager } from './db-manager';
import { BaseProvider } from '../providers/base-provider';
import { ChecksumUtil } from '../utils/checksum';
import { Logger } from '../utils/logger';
import { SyncResult, SyncMetadata } from '../types';

export class SyncEngine {
  private dbManager: DatabaseManager;
  private provider: BaseProvider;
  private logger: Logger;

  constructor(
    dbManager: DatabaseManager,
    provider: BaseProvider,
    logger: Logger
  ) {
    this.dbManager = dbManager;
    this.provider = provider;
    this.logger = logger;
  }

  /**
   * Push local database to cloud
   */
  async pushToCloud(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Get database buffer
      const buffer = await this.dbManager.getBuffer();
      const originalSize = buffer.length;

      // Calculate checksum
      const checksum = ChecksumUtil.calculateBufferChecksum(buffer);

      // Upload
      await this.provider.uploadFile('current.db', buffer);

      // Update metadata
      const metadata: SyncMetadata = {
        dbName: 'current',
        lastSyncTimestamp: Date.now(),
        lastSyncType: 'push',
        checksum,
        version: 1
      };
      await this.provider.updateMetadata(metadata);

      // Update local metadata
      await this.dbManager.updateLocalMetadata({
        lastSyncTimestamp: metadata.lastSyncTimestamp,
        lastSyncChecksum: checksum
      });

      const result: SyncResult = {
        success: true,
        type: 'push',
        timestamp: Date.now(),
        localChecksum: checksum,
        cloudChecksum: checksum,
        bytesTransferred: buffer.length,
        duration: Date.now() - startTime
      };

      this.logger.info(`Push successful: ${originalSize} bytes`);
      return result;

    } catch (error) {
      this.logger.error('Push failed', error as Error);
      throw error;
    }
  }

  /**
   * Pull database from cloud to local
   */
  async pullFromCloud(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Check if cloud version exists
      const exists = await this.provider.fileExists('current.db');
      if (!exists) {
        throw new Error('No cloud version found');
      }

      // Download
      const buffer = await this.provider.downloadFile('current.db');

      // Verify checksum
      const checksum = ChecksumUtil.calculateBufferChecksum(buffer);
      const cloudMetadata = await this.provider.getMetadata('current.db');

      if (cloudMetadata && cloudMetadata.checksum !== checksum) {
        throw new Error('Checksum mismatch - data corruption detected');
      }

      // Replace local database
      await this.dbManager.replaceWithBuffer(buffer);

      // Update local metadata
      await this.dbManager.updateLocalMetadata({
        lastSyncTimestamp: Date.now(),
        lastSyncChecksum: checksum
      });

      const result: SyncResult = {
        success: true,
        type: 'pull',
        timestamp: Date.now(),
        localChecksum: checksum,
        cloudChecksum: checksum,
        bytesTransferred: buffer.length,
        duration: Date.now() - startTime
      };

      this.logger.info(`Pull successful: ${buffer.length} bytes`);
      return result;

    } catch (error) {
      this.logger.error('Pull failed', error as Error);
      throw error;
    }
  }

  /**
   * Bidirectional sync - simple version for v0.1
   */
  async sync(): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      const cloudExists = await this.provider.fileExists('current.db');

      if (!cloudExists) {
        // No cloud version - push
        this.logger.info('No cloud version found, pushing local database');
        return await this.pushToCloud();
      }

      // Compare checksums and timestamps
      const localChecksum = await this.dbManager.getChecksum();
      const cloudMetadata = await this.provider.getMetadata('current.db');

      if (!cloudMetadata) {
        this.logger.info('No cloud metadata, pushing local database');
        return await this.pushToCloud();
      }

      if (localChecksum === cloudMetadata.checksum) {
        // Already in sync
        const result: SyncResult = {
          success: true,
          type: 'bidirectional',
          timestamp: Date.now(),
          localChecksum,
          cloudChecksum: cloudMetadata.checksum,
          bytesTransferred: 0,
          duration: Date.now() - startTime
        };

        this.logger.info('Already in sync');
        return result;
      }

      // Determine which is newer
      const localModified = await this.dbManager.getModifiedTime();

      // Simple strategy: if local was modified more recently, push; otherwise pull
      if (localModified > cloudMetadata.modifiedAt) {
        this.logger.info('Local is newer, pushing');
        return await this.pushToCloud();
      } else {
        this.logger.info('Cloud is newer, pulling');
        return await this.pullFromCloud();
      }

    } catch (error) {
      this.logger.error('Sync failed', error as Error);
      throw error;
    }
  }
}
