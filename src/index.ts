import { DatabaseManager } from './core/db-manager';
import { SyncEngine } from './core/sync-engine';
import { GoogleDriveProvider, OAuthFlow, TokenStorage } from './providers/google-drive';
import { BaseProvider } from './providers/base-provider';
import { Logger } from './utils/logger';
import {
  SyncConfig,
  SyncResult,
  GoogleDriveCredentials
} from './types';
import path from 'path';

export class SqliteCloudBackup {
  private dbManager: DatabaseManager;
  private provider: BaseProvider;
  private syncEngine: SyncEngine;
  private logger: Logger;
  private oauthFlow: OAuthFlow;
  private tokenStorage: TokenStorage;
  private credentials: GoogleDriveCredentials;
  private dbPath: string;

  constructor(config: SyncConfig) {
    // Initialize logger
    this.logger = new Logger(config.options?.logLevel ?? 'info');

    // Store config for OAuth flow
    this.dbPath = config.dbPath;
    this.credentials = config.credentials as GoogleDriveCredentials;

    // Initialize OAuth flow and token storage
    this.oauthFlow = new OAuthFlow(this.logger);
    this.tokenStorage = new TokenStorage(config.dbPath, config.options?.logLevel ?? 'info');

    // Initialize components
    this.dbManager = new DatabaseManager(config.dbPath, this.logger);

    // Initialize provider based on config
    this.provider = this.createProvider(config);

    // Initialize sync engine
    this.syncEngine = new SyncEngine(
      this.dbManager,
      this.provider,
      this.logger
    );
  }

  private createProvider(config: SyncConfig): BaseProvider {
    const dbName = path.basename(config.dbPath, path.extname(config.dbPath));

    switch (config.provider) {
      case 'google-drive':
        return new GoogleDriveProvider(
          config.credentials as GoogleDriveCredentials,
          dbName,
          this.logger
        );
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Check if user needs authentication
   */
  async needsAuthentication(): Promise<boolean> {
    // If refreshToken provided in credentials, no need for OAuth
    if (this.credentials.refreshToken) {
      return false;
    }

    // Check if we have stored tokens
    return !(await this.tokenStorage.hasTokens());
  }

  /**
   * Ensure user is authenticated, trigger OAuth flow if needed
   */
  private async ensureAuthenticated(): Promise<void> {
    // If refreshToken already provided, use it
    if (this.credentials.refreshToken) {
      this.logger.debug('Using provided refresh token');
      return;
    }

    // Check if we have stored tokens
    const storedTokens = await this.tokenStorage.getTokens();
    if (storedTokens) {
      this.logger.debug('Using stored refresh token');
      // Update credentials with stored token
      this.credentials.refreshToken = storedTokens.refreshToken;

      // Recreate provider with updated credentials
      const dbName = path.basename(this.dbPath, path.extname(this.dbPath));
      this.provider = new GoogleDriveProvider(
        this.credentials,
        dbName,
        this.logger
      );

      // Recreate sync engine with new provider
      this.syncEngine = new SyncEngine(
        this.dbManager,
        this.provider,
        this.logger
      );
      return;
    }

    // No tokens available, trigger OAuth flow
    this.logger.info('No authentication found, starting OAuth flow...');
    await this.authenticate();
  }

  /**
   * Trigger OAuth authentication flow
   */
  async authenticate(): Promise<void> {
    this.logger.info('Starting OAuth authentication flow...');

    const tokens = await this.oauthFlow.authenticate(
      this.credentials.clientId,
      this.credentials.clientSecret
    );

    // Save tokens to storage
    await this.tokenStorage.saveTokens({
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiryDate: tokens.expiry_date
    });

    // Update credentials
    this.credentials.refreshToken = tokens.refresh_token;

    // Recreate provider with updated credentials
    const dbName = path.basename(this.dbPath, path.extname(this.dbPath));
    this.provider = new GoogleDriveProvider(
      this.credentials,
      dbName,
      this.logger
    );

    // Recreate sync engine with new provider
    this.syncEngine = new SyncEngine(
      this.dbManager,
      this.provider,
      this.logger
    );

    this.logger.info('Authentication successful');
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return !(await this.needsAuthentication());
  }

  /**
   * Logout and clear stored tokens
   */
  async logout(): Promise<void> {
    await this.tokenStorage.clearTokens();
    this.credentials.refreshToken = undefined;
    this.logger.info('Logged out successfully');
  }

  /**
   * Push local database to cloud
   */
  async pushToCloud(): Promise<SyncResult> {
    await this.ensureAuthenticated();
    return this.syncEngine.pushToCloud();
  }

  /**
   * Pull database from cloud to local
   */
  async pullFromCloud(): Promise<SyncResult> {
    await this.ensureAuthenticated();
    return this.syncEngine.pullFromCloud();
  }

  /**
   * Bidirectional sync
   */
  async sync(): Promise<SyncResult> {
    await this.ensureAuthenticated();
    return this.syncEngine.sync();
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.dbManager.close();
    this.logger.info('SqliteCloudBackup shutdown complete');
  }
}

// Re-export types
export * from './types';
export default SqliteCloudBackup;
