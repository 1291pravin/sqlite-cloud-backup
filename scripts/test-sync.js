import SqliteCloudBackup from '../dist/index.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// If you have a refresh token from get-refresh-token.js, add it here (optional)
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables.');
  console.error('Copy .env.example to .env and fill in your Google OAuth credentials.');
  console.error('');
  console.error('Required variables:');
  console.error('  GOOGLE_CLIENT_ID');
  console.error('  GOOGLE_CLIENT_SECRET');
  console.error('  GOOGLE_REFRESH_TOKEN (optional - will trigger OAuth flow if not set)');
  process.exit(1);
}

const TEST_DB_PATH = './test-data.db';

async function createTestDatabase() {
  console.log('Creating test database...');

  // Remove old test db if exists
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  const db = new Database(TEST_DB_PATH);

  // Create a simple table
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert some test data
  const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
  insert.run('John Doe', 'john@example.com');
  insert.run('Jane Smith', 'jane@example.com');
  insert.run('Bob Wilson', 'bob@example.com');

  console.log('Test database created with 3 users.');
  db.close();
}

async function testSync() {
  console.log('================================================================================');
  console.log('SQLite Cloud Backup - Test Sync');
  console.log('================================================================================\n');

  // Step 1: Create test database
  await createTestDatabase();

  // Step 2: Initialize SqliteCloudBackup
  console.log('\nInitializing SqliteCloudBackup...');
  const credentials = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  };

  if (REFRESH_TOKEN) {
    credentials.refreshToken = REFRESH_TOKEN;
  }

  const sync = new SqliteCloudBackup({
    dbPath: TEST_DB_PATH,
    provider: 'google-drive',
    credentials,
    options: {
      logLevel: 'debug' // Use 'debug' to see detailed logs
    }
  });

  try {
    // Step 3: Check authentication status
    const needsAuth = await sync.needsAuthentication();
    console.log('\nNeeds authentication:', needsAuth);

    if (needsAuth) {
      console.log('\nNo stored tokens found. OAuth flow will open in browser...');
    }

    // Step 4: Push to cloud
    console.log('\n--- PUSH TO CLOUD ---');
    const pushResult = await sync.pushToCloud();
    console.log('Push result:', {
      success: pushResult.success,
      type: pushResult.type,
      bytesTransferred: pushResult.bytesTransferred,
      duration: `${pushResult.duration}ms`,
      checksum: pushResult.localChecksum.substring(0, 16) + '...'
    });

    // Step 5: Modify local database
    console.log('\n--- MODIFYING LOCAL DATABASE ---');
    const db = new Database(TEST_DB_PATH);
    db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('New User', 'new@example.com');
    console.log('Added new user to local database');
    db.close();

    // Step 6: Sync (should detect local is newer and push)
    console.log('\n--- SYNC (should push) ---');
    const syncResult = await sync.sync();
    console.log('Sync result:', {
      success: syncResult.success,
      type: syncResult.type,
      bytesTransferred: syncResult.bytesTransferred,
      duration: `${syncResult.duration}ms`
    });

    // Step 7: Sync again (should skip - no changes)
    console.log('\n--- SYNC AGAIN (should skip) ---');
    const syncResult2 = await sync.sync();
    console.log('Sync result:', {
      success: syncResult2.success,
      type: syncResult2.type,
      bytesTransferred: syncResult2.bytesTransferred,
      duration: `${syncResult2.duration}ms`
    });

    // Step 8: Pull from cloud
    console.log('\n--- PULL FROM CLOUD ---');
    const pullResult = await sync.pullFromCloud();
    console.log('Pull result:', {
      success: pullResult.success,
      type: pullResult.type,
      bytesTransferred: pullResult.bytesTransferred,
      duration: `${pullResult.duration}ms`
    });

    // Verify data
    console.log('\n--- VERIFY DATA ---');
    const dbVerify = new Database(TEST_DB_PATH);
    const users = dbVerify.prepare('SELECT * FROM users').all();
    console.log('Users in database:', users.length);
    users.forEach(u => console.log(`  - ${u.name} (${u.email})`));
    dbVerify.close();

    console.log('\n================================================================================');
    console.log('All tests completed successfully!');
    console.log('================================================================================\n');

  } catch (error) {
    console.error('\nError during sync:', error);
  } finally {
    await sync.shutdown();

    // Cleanup test database (but keep tokens for future runs)
    console.log('\nCleaning up test database...');
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Note: NOT deleting .sqlite-cloud-backup folder - it contains stored tokens
    console.log('Tokens preserved in .sqlite-cloud-backup/ for future runs.');
  }
}

testSync().catch(console.error);
