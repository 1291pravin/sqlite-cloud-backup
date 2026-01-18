# sqlite-cloud-backup

> Lightweight SQLite database synchronization to Google Drive with zero vendor lock-in

[![NPM Version](https://img.shields.io/npm/v/sqlite-cloud-backup.svg)](https://www.npmjs.com/package/sqlite-cloud-backup)
[![License](https://img.shields.io/npm/l/sqlite-cloud-backup.svg)](https://github.com/1291pravin/sqlite-cloud-backup/blob/main/LICENSE)

## Features

- ✅ **Simple API** - Push, pull, or sync with 3 lines of code
- ✅ **Google Drive** - Use your personal or organization Drive for storage
- ✅ **Lightweight** - Minimal dependencies, <20KB minified
- ✅ **TypeScript** - Full type definitions included
- ✅ **Data Integrity** - SHA-256 checksums for verification
- ✅ **Zero Lock-in** - Your database, your cloud, your control

## Installation

```bash
npm install sqlite-cloud-backup
```

## Quick Start

```typescript
import SqliteCloudBackup from 'sqlite-cloud-backup';

const sync = new SqliteCloudBackup({
  dbPath: './my-app.db',
  provider: 'google-drive',
  credentials: {
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET'
    // No need to provide refreshToken!
    // OAuth flow opens browser automatically on first sync
  }
});

// Smart sync - automatically handles OAuth if not authenticated
await sync.sync();

// That's it! Subsequent syncs use stored tokens
await sync.sync();
```

## Getting Google Drive Credentials

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services** > **Library**
4. Search for "Google Drive API"
5. Click on it and press **Enable**

### Step 2: Create OAuth Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Configure consent screen if prompted
4. Choose **Desktop app**
5. Download credentials JSON

### Step 3: Store Credentials

Create `.env` file:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

**Never commit credentials to version control!**

### Step 4: First Sync (OAuth Flow)

When you call `sync()` for the first time:
1. Package detects no authentication
2. Opens your default browser automatically
3. Google OAuth consent screen appears
4. User approves access
5. Package receives and stores tokens locally
6. Sync proceeds automatically

All subsequent syncs use the stored tokens - no browser needed!

## API Reference

### Constructor

```typescript
new SqliteCloudBackup(config: SyncConfig)
```

**Config Options:**

```typescript
{
  dbPath: string;              // Path to SQLite database
  provider: 'google-drive';    // Cloud provider
  credentials: {
    clientId: string;
    clientSecret: string;
    refreshToken?: string;     // Optional - OAuth flow if not provided
  };
  options?: {
    logLevel?: 'debug' | 'info' | 'warn' | 'error';  // Default: 'info'
  };
}
```

### Methods

#### `pushToCloud(): Promise<SyncResult>`

Upload local database to cloud.

```typescript
const result = await sync.pushToCloud();
console.log(`Uploaded ${result.bytesTransferred} bytes in ${result.duration}ms`);
```

#### `pullFromCloud(): Promise<SyncResult>`

Download database from cloud to local.

```typescript
const result = await sync.pullFromCloud();
console.log(`Downloaded ${result.bytesTransferred} bytes`);
```

#### `sync(): Promise<SyncResult>`

Smart bidirectional sync. Automatically determines if push or pull is needed based on modification times.

```typescript
const result = await sync.sync();
// result.type will be 'push', 'pull', or 'bidirectional'
```

#### `authenticate(): Promise<void>`

Manually trigger OAuth authentication flow.

```typescript
await sync.authenticate();
```

#### `isAuthenticated(): Promise<boolean>`

Check if user is authenticated.

```typescript
const isAuth = await sync.isAuthenticated();
```

#### `needsAuthentication(): Promise<boolean>`

Check if authentication is needed.

```typescript
const needsAuth = await sync.needsAuthentication();
```

#### `logout(): Promise<void>`

Logout and clear stored tokens.

```typescript
await sync.logout();
```

#### `shutdown(): Promise<void>`

Clean up and close connections.

```typescript
await sync.shutdown();
```

## Use Cases

### Electron Apps

```typescript
import SqliteCloudBackup from 'sqlite-cloud-backup';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'app.db');
const sync = new SqliteCloudBackup({
  dbPath,
  provider: 'google-drive',
  credentials: {
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET'
    // No refreshToken needed - OAuth flow opens browser automatically
  }
});

// Sync on app start - OAuth flow triggers automatically if needed
app.on('ready', async () => {
  await sync.sync();
});
```

### CLI Tools

```typescript
import SqliteCloudBackup from 'sqlite-cloud-backup';

const sync = new SqliteCloudBackup({
  dbPath: './data.db',
  provider: 'google-drive',
  credentials: { /* ... */ }
});

// Backup on schedule (e.g., cron job)
await sync.pushToCloud();
```

## Current Status (v0.1)

**v0.1 includes:**
- ✅ Push/pull/sync operations
- ✅ Google Drive integration
- ✅ SHA-256 checksums
- ✅ Automatic conflict detection
- ✅ TypeScript support

**Coming in v0.2+:**
- ⏳ Additional providers (Dropbox, S3)

## Important Limitations

### Single-Device Use Only

This library is designed for **single-device backup scenarios**. The sync logic uses timestamps to determine whether to push or pull, which works reliably when only one device accesses the cloud backup.

**Not supported:**
- Multiple devices syncing to the same cloud folder simultaneously
- Real-time collaboration or multi-user scenarios
- Conflict resolution between concurrent modifications

If you need multi-device sync, consider a full database sync solution like [PowerSync](https://www.powersync.com/), [ElectricSQL](https://electric-sql.com/), or a traditional backend database.

### Security Note for Distributed Apps

If you're distributing an Electron app or CLI tool, be aware that OAuth client secrets embedded in your application can be extracted by users. For desktop applications, Google recommends:

1. **Use a public OAuth client** (no secret required) with PKCE flow
2. **Or** accept that the secret is not truly secret in distributed apps

The client secret primarily protects against other developers impersonating your app, not end-users. Your users' data remains protected by their own OAuth consent.

For server-side applications where the secret stays on your server, this is not a concern.

## Requirements

- Node.js 18+
- SQLite database file
- Google Drive account

## Examples

See [examples/](./examples/) directory for more use cases:

- `basic-usage.ts` - Simple push/pull/sync example

## Contributing

Contributions are welcome! Please open an issue or PR.

## License

MIT © 1291pravin

## Support

- [GitHub Issues](https://github.com/1291pravin/sqlite-cloud-backup/issues)
- [Documentation](./docs/)

---

Made with ❤️ for developers who need simple, reliable database backups.
