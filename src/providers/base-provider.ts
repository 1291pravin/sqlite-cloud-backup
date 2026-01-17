import { ProviderMetadata } from '../types';

export abstract class BaseProvider {
  /**
   * Upload database file to cloud
   */
  abstract uploadFile(fileName: string, buffer: Buffer): Promise<void>;

  /**
   * Download database file from cloud
   */
  abstract downloadFile(fileName: string): Promise<Buffer>;

  /**
   * Check if file exists in cloud
   */
  abstract fileExists(fileName: string): Promise<boolean>;

  /**
   * Get file metadata from cloud
   */
  abstract getMetadata(fileName: string): Promise<ProviderMetadata | null>;

  /**
   * Update metadata file
   */
  abstract updateMetadata(metadata: unknown): Promise<void>;

  /**
   * Delete file from cloud
   */
  abstract deleteFile(fileName: string): Promise<void>;
}
