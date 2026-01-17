import { google } from 'googleapis';
import http from 'http';
import open from 'open';
import { URL } from 'url';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing required environment variables.');
  console.error('Copy .env.example to .env and fill in your Google OAuth credentials.');
  console.error('');
  console.error('Required variables:');
  console.error('  GOOGLE_CLIENT_ID');
  console.error('  GOOGLE_CLIENT_SECRET');
  process.exit(1);
}
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';
const PORT = 3000;

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Force to get refresh token
});

console.log('================================================================================');
console.log('Get Google Drive Refresh Token');
console.log('================================================================================\n');

// Start local server to receive the OAuth callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);

  if (url.pathname === '/oauth/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Authentication Failed</h1><p>You can close this window.</p>');
      console.error('\nError:', error);
      server.close();
      process.exit(1);
    }

    if (code) {
      try {
        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authentication Successful!</h1><p>You can close this window and check your terminal.</p>');

        console.log('\n================================================================================');
        console.log('Success! Your credentials:');
        console.log('================================================================================\n');
        console.log('CLIENT_ID=' + CLIENT_ID);
        console.log('CLIENT_SECRET=' + CLIENT_SECRET);
        console.log('REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n================================================================================');
        console.log('Save these to your .env file!');
        console.log('IMPORTANT: The refresh token is only shown once. Save it securely.');
        console.log('================================================================================\n');

        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Token Exchange Failed</h1><p>Check terminal for details.</p>');
        console.error('\nError getting tokens:', err.message);
        server.close();
        process.exit(1);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Invalid Request</h1><p>No authorization code received.</p>');
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Local server started on http://localhost:${PORT}`);
  console.log('\nOpening browser for authentication...\n');
  console.log('If the browser does not open, visit this URL manually:');
  console.log('\n' + authUrl + '\n');
  console.log('================================================================================\n');

  open(authUrl).catch(() => {
    console.log('Could not open browser automatically. Please open the URL above manually.');
  });
});

// Timeout after 5 minutes
setTimeout(() => {
  console.error('\nTimeout: OAuth flow did not complete within 5 minutes.');
  server.close();
  process.exit(1);
}, 5 * 60 * 1000);
