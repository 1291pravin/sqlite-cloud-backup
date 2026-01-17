// Core type definitions for sqlite-cloud-backup v0.1

// Provider types
export type CloudProvider = 'google-drive';

export interface GoogleDriveCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken?: string; // Optional - will trigger OAuth flow if not provided
  redirectUri?: string;
}

export type ProviderCredentials = GoogleDriveCredentials;

// Sync types
export type SyncType = 'push' | 'pull' | 'bidirectional';

export interface SyncConfig {
  dbPath: string;
  provider: CloudProvider;
  credentials: ProviderCredentials;
  options?: SyncOptions;
}

export interface SyncOptions {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface SyncResult {
  success: boolean;
  type: SyncType;
  timestamp: number;
  localChecksum: string;
  cloudChecksum: string;
  bytesTransferred: number;
  duration: number;
  error?: Error;
}

// Metadata types
export interface SyncMetadata {
  dbName: string;
  lastSyncTimestamp: number;
  lastSyncType: SyncType;
  checksum: string;
  version: number;
}

export interface LocalMetadata {
  lastSyncTimestamp: number;
  lastSyncChecksum: string;
}

export interface ProviderMetadata {
  checksum: string;
  modifiedAt: number;
  size: number;
}
