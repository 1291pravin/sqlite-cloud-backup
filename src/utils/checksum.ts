import crypto from 'crypto';
import fs from 'fs';

export class ChecksumUtil {
  /**
   * Calculate SHA-256 checksum of a file
   */
  static async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Calculate SHA-256 checksum of a buffer
   */
  static calculateBufferChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Verify file integrity
   */
  static async verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
    const actualChecksum = await this.calculateFileChecksum(filePath);
    return actualChecksum === expectedChecksum;
  }
}
