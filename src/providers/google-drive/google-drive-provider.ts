import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { BaseProvider } from '../base-provider';
import { GoogleDriveCredentials, ProviderMetadata, SyncMetadata } from '../../types';
import { Logger } from '../../utils/logger';
import { Readable } from 'stream';

export class GoogleDriveProvider extends BaseProvider {
  private drive: drive_v3.Drive;
  private oauth2Client: OAuth2Client;
  private rootFolderId: string | null = null;
  private logger: Logger;
  private dbName: string;

  constructor(credentials: GoogleDriveCredentials, dbName: string, logger: Logger) {
    super();
    this.logger = logger;
    this.dbName = dbName;

    this.oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      credentials.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Initialize folder structure
   */
  private async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) return this.rootFolderId;

    // Check if .sqlite-cloud-backup folder exists
    const response = await this.drive.files.list({
      q: "name='.sqlite-cloud-backup' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files && response.data.files.length > 0) {
      this.rootFolderId = response.data.files[0].id!;
    } else {
      // Create root folder
      const folder = await this.drive.files.create({
        requestBody: {
          name: '.sqlite-cloud-backup',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      this.rootFolderId = folder.data.id!;
    }

    // Ensure db-specific subfolder
    const dbFolderId = await this.ensureDbFolder();

    return dbFolderId;
  }

  private async ensureDbFolder(): Promise<string> {
    const response = await this.drive.files.list({
      q: `name='${this.dbName}' and mimeType='application/vnd.google-apps.folder' and '${this.rootFolderId}' in parents and trashed=false`,
      fields: 'files(id, name)'
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    const folder = await this.drive.files.create({
      requestBody: {
        name: this.dbName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [this.rootFolderId!]
      },
      fields: 'id'
    });

    return folder.data.id!;
  }

  async uploadFile(fileName: string, buffer: Buffer): Promise<void> {
    const folderId = await this.ensureRootFolder();

    // Check if file exists
    const existing = await this.findFile(fileName);

    const media = {
      mimeType: 'application/x-sqlite3',
      body: Readable.from(buffer)
    };

    if (existing) {
      // Update existing file
      await this.drive.files.update({
        fileId: existing.id!,
        media,
        fields: 'id'
      });
      this.logger.info(`Updated file in Google Drive: ${fileName}`);
    } else {
      // Create new file
      await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId]
        },
        media,
        fields: 'id'
      });
      this.logger.info(`Uploaded file to Google Drive: ${fileName}`);
    }
  }

  async downloadFile(fileName: string): Promise<Buffer> {
    const file = await this.findFile(fileName);
    if (!file) {
      throw new Error(`File not found: ${fileName}`);
    }

    const response = await this.drive.files.get(
      { fileId: file.id!, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    this.logger.info(`Downloaded file from Google Drive: ${fileName}`);
    return Buffer.from(response.data as ArrayBuffer);
  }

  async fileExists(fileName: string): Promise<boolean> {
    const file = await this.findFile(fileName);
    return file !== null;
  }

  async getMetadata(_fileName: string): Promise<ProviderMetadata | null> {
    const metadataFile = await this.findFile('metadata.json');
    if (!metadataFile) return null;

    const buffer = await this.downloadFile('metadata.json');
    const metadata: SyncMetadata = JSON.parse(buffer.toString('utf-8'));

    return {
      checksum: metadata.checksum,
      modifiedAt: metadata.lastSyncTimestamp,
      size: 0 // Not tracked in metadata
    };
  }

  async updateMetadata(metadata: SyncMetadata): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(metadata, null, 2));
    await this.uploadFile('metadata.json', buffer);
  }

  async deleteFile(fileName: string): Promise<void> {
    const file = await this.findFile(fileName);
    if (file) {
      await this.drive.files.delete({ fileId: file.id! });
      this.logger.info(`Deleted file from Google Drive: ${fileName}`);
    }
  }

  private async findFile(fileName: string): Promise<drive_v3.Schema$File | null> {
    const folderId = await this.ensureRootFolder();

    const response = await this.drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, modifiedTime)'
    });

    return response.data.files?.[0] || null;
  }
}
