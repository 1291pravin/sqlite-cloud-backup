const { google } = require('googleapis');
const readline = require('readline');

// Replace with your credentials from Google Cloud Console
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent' // Force to get refresh token
});

console.log('================================================================================');
console.log('Get Google Drive Refresh Token');
console.log('================================================================================\n');
console.log('1. Visit this URL in your browser:');
console.log('\n' + authUrl + '\n');
console.log('2. Authorize the application');
console.log('3. Copy the authorization code');
console.log('4. Paste it below\n');
console.log('================================================================================\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the authorization code: ', async (code) => {
  rl.close();

  try {
    const { tokens } = await oauth2Client.getToken(code);

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
  } catch (error) {
    console.error('\nError getting tokens:', error.message);
    console.log('Please try again and make sure the code is correct.\n');
  }
});
