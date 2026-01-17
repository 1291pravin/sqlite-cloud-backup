import SqliteCloudBackup from 'sqlite-cloud-backup';

// Example: Basic usage of sqlite-cloud-backup with seamless OAuth

async function main() {
  // Initialize with your Google Drive credentials
  // No need to provide refreshToken - OAuth flow will be triggered automatically
  const sync = new SqliteCloudBackup({
    dbPath: './my-app.db',
    provider: 'google-drive',
    credentials: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
      // refreshToken is optional - will trigger OAuth flow if not provided
    },
    options: {
      logLevel: 'info'
    }
  });

  try {
    // Check if authentication is needed
    const needsAuth = await sync.needsAuthentication();
    if (needsAuth) {
      console.log('No authentication found.');
      console.log('OAuth flow will open in your browser automatically...');
    }

    // Smart bidirectional sync
    // Automatically triggers OAuth flow if not authenticated
    // Then determines if push or pull is needed
    console.log('\nSyncing...');
    const syncResult = await sync.sync();
    console.log('Sync successful:', {
      type: syncResult.type,
      bytes: syncResult.bytesTransferred,
      duration: `${syncResult.duration}ms`
    });

    // After first authentication, subsequent calls use stored tokens
    console.log('\nSyncing again (using stored tokens)...');
    const syncResult2 = await sync.sync();
    console.log('Second sync successful:', {
      type: syncResult2.type,
      bytes: syncResult2.bytesTransferred,
      duration: `${syncResult2.duration}ms`
    });

    // Optional: You can also manually trigger authentication
    // await sync.authenticate();

    // Optional: Check if authenticated
    const isAuth = await sync.isAuthenticated();
    console.log('\nIs authenticated:', isAuth);

    // Optional: Logout and clear stored tokens
    // await sync.logout();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Clean shutdown
    await sync.shutdown();
  }
}

main().catch(console.error);
