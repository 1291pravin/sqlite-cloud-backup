import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ChecksumUtil } from '../utils/checksum';
import { FileOperations } from '../utils/file-operations';
import { Logger } from '../utils/logger';
import { LocalMetadata } from '../types';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private metadataPath: string;
  private logger: Logger;

  constructor(dbPath: string, logger: Logger) {
    this.dbPath = dbPath;
    this.logger = logger;

    const dbDir = path.dirname(dbPath);
    const dbName = path.basename(dbPath, path.extname(dbPath));

    this.metadataPath = path.join(dbDir, '.sqlite-cloud-backup', dbName, 'metadata.json');

    FileOperations.ensureDir(path.dirname(this.metadataPath));
  }

  /**
   * Open database connection
   */
  open(): void {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database not found: ${this.dbPath}`);
    }
    this.db = new Database(this.dbPath, { readonly: false });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database file as buffer
   */
  async getBuffer(): Promise<Buffer> {
    this.close(); // Ensure no active connections
    return fs.promises.readFile(this.dbPath);
  }

  /**
   * Calculate current database checksum
   */
  async getChecksum(): Promise<string> {
    this.close(); // Ensure no active connections
    return ChecksumUtil.calculateFileChecksum(this.dbPath);
  }

  /**
   * Replace database with buffer
   */
  async replaceWithBuffer(buffer: Buffer): Promise<void> {
    this.close();

    // Write atomically
    const tempPath = `${this.dbPath}.tmp`;
    await fs.promises.writeFile(tempPath, buffer);
    await fs.promises.rename(tempPath, this.dbPath);

    this.logger.info('Database replaced from cloud');
  }

  /**
   * Get local metadata
   */
  async getLocalMetadata(): Promise<LocalMetadata> {
    if (!fs.existsSync(this.metadataPath)) {
      return {
        lastSyncTimestamp: 0,
        lastSyncChecksum: ''
      };
    }

    const content = await fs.promises.readFile(this.metadataPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Update local metadata
   */
  async updateLocalMetadata(metadata: Partial<LocalMetadata>): Promise<void> {
    const current = await this.getLocalMetadata();
    const updated = { ...current, ...metadata };

    await fs.promises.writeFile(
      this.metadataPath,
      JSON.stringify(updated, null, 2)
    );
  }

  /**
   * Get modification time of database file
   */
  async getModifiedTime(): Promise<number> {
    const stats = await fs.promises.stat(this.dbPath);
    return stats.mtimeMs;
  }
}
