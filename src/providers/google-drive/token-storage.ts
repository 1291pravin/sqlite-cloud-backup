import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../../utils/logger.js';

export interface StoredTokens {
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
}

export class TokenStorage {
  private logger: Logger;
  private tokenDir: string;
  private tokenFile: string;

  constructor(dbPath: string, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.logger = new Logger(logLevel);

    // Store tokens next to the database
    const dbDir = path.dirname(dbPath);
    this.tokenDir = path.join(dbDir, '.sqlite-cloud-backup');
    this.tokenFile = path.join(this.tokenDir, 'tokens.json');
  }

  async hasTokens(): Promise<boolean> {
    try {
      await fs.access(this.tokenFile);
      return true;
    } catch {
      return false;
    }
  }

  async getTokens(): Promise<StoredTokens | null> {
    try {
      const data = await fs.readFile(this.tokenFile, 'utf-8');
      const tokens = JSON.parse(data) as StoredTokens;
      this.logger.debug('Retrieved stored tokens');
      return tokens;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to read tokens', error);
      }
      return null;
    }
  }

  async saveTokens(tokens: StoredTokens): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(this.tokenDir, { recursive: true });

      // Write tokens to file
      await fs.writeFile(
        this.tokenFile,
        JSON.stringify(tokens, null, 2),
        'utf-8'
      );

      this.logger.debug('Saved tokens to storage');
    } catch (error) {
      this.logger.error('Failed to save tokens', error as Error);
      throw new Error('Failed to save authentication tokens');
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenFile);
      this.logger.debug('Cleared stored tokens');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn('Failed to clear tokens', error);
      }
    }
  }
}
