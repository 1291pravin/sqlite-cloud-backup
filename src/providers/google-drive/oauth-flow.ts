import http from 'http';
import { URL } from 'url';
import { Logger } from '../../utils/logger';
import open from 'open';

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

export class OAuthFlow {
  private logger: Logger;
  private server: http.Server | null = null;
  private readonly redirectUri = 'http://localhost:3000/oauth/callback';
  private readonly scopes = ['https://www.googleapis.com/auth/drive.file'];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Start OAuth flow - opens browser and waits for callback
   */
  async authenticate(clientId: string, clientSecret: string): Promise<OAuthTokens> {
    this.logger.info('Starting OAuth flow...');

    // Start local server to receive callback
    const authCode = await this.startLocalServerAndWaitForCode(clientId);

    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(authCode, clientId, clientSecret);

    this.logger.info('OAuth authentication successful');
    return tokens;
  }

  /**
   * Start local HTTP server and wait for OAuth callback
   */
  private async startLocalServerAndWaitForCode(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://localhost:3000`);

        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Failed</h1><p>You can close this window.</p>');
            this.stopServer();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Successful!</h1><p>You can close this window and return to the app.</p>');
            this.stopServer();
            resolve(code);
            return;
          }

          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Invalid Request</h1><p>No authorization code received.</p>');
          this.stopServer();
          reject(new Error('No authorization code received'));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.server.listen(3000, () => {
        this.logger.info('Local OAuth server started on http://localhost:3000');

        // Build OAuth URL
        const authUrl = this.buildAuthUrl(clientId);

        // Open browser
        this.logger.info('Opening browser for authentication...');
        open(authUrl).catch(err => {
          this.logger.error('Failed to open browser', err);
          this.logger.info(`Please open this URL manually: ${authUrl}`);
        });
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        this.stopServer();
        reject(new Error('OAuth flow timed out after 5 minutes'));
      }, 5 * 60 * 1000);
    });
  }

  /**
   * Build Google OAuth authorization URL
   */
  private buildAuthUrl(clientId: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent' // Force to get refresh token
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    clientId: string,
    clientSecret: string
  ): Promise<OAuthTokens> {
    this.logger.info('Exchanging authorization code for tokens...');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
    };

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined
    };
  }

  /**
   * Stop the local server
   */
  private stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.logger.info('Local OAuth server stopped');
    }
  }
}
