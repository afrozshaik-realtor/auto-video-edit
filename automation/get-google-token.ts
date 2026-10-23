// One-time helper for the owner: makes the Google refresh token the AI editor
// job uses to act as your account. Run on your own computer:
//
//   npm run ai:google-token
//
// It needs a "Desktop app" OAuth client (Google Cloud → APIs & Services →
// Credentials). Nothing is saved to disk; copy the printed token straight
// into the GOOGLE_REFRESH_TOKEN GitHub secret.

import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { SCOPES } from '../src/services/google/auth';

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || (await ask('Desktop OAuth client ID: '));
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || (await ask('Desktop OAuth client secret: '));

  const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const c = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(c ? 'Signed in. You can close this tab and go back to the terminal.' : `Sign-in failed: ${error}`);
      server.close();
      if (c) resolve({ code: c, redirectUri });
      else reject(new Error(`Google sign-in failed: ${error}`));
    });
    let redirectUri = '';
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      redirectUri = `http://127.0.0.1:${port}`;
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
      }).toString();
      console.log('\nOpen this link, sign in as the Reels folder owner and allow access:\n');
      console.log(auth.toString(), '\n');
    });
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code.code,
      redirect_uri: code.redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = (await res.json()) as { refresh_token?: string; error_description?: string };
  if (!data.refresh_token) throw new Error(data.error_description ?? 'Google didn’t return a refresh token.');
  console.log('Refresh token (save it as the GOOGLE_REFRESH_TOKEN secret, then clear your terminal):\n');
  console.log(data.refresh_token);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
