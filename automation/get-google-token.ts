// One-time helper for the owner: makes the Google refresh token the AI editor
// job uses to act as your account. Run on your own computer:
//
//   npm run ai:google-token
//
// It needs a "Desktop app" OAuth client (Google Cloud → APIs & Services →
// Credentials). Nothing is saved to disk. At the end it offers to save the
// client ID, client secret and refresh token to GitHub secrets with `gh`.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { appConfig } from '../src/config/app.config';
import { SCOPES } from '../src/services/google/auth';

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || (await ask('Desktop OAuth client ID: '));
  if (clientId === appConfig.googleClientId) {
    // The website's Web client only allows registered redirect URIs, so Google
    // would answer "Error 400: redirect_uri_mismatch".
    throw new Error(
      'That is the website’s Web application client. Create a separate “Desktop app” client in Google Cloud (Google Auth Platform → Clients → Create client → Desktop app) and use its ID and secret.',
    );
  }
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

  // Save all three secrets from this one run, so the token always matches its client.
  const save = (await ask('\nSave the client ID, client secret and refresh token to this repo’s GitHub secrets now? (y/n) '))
    .toLowerCase()
    .startsWith('y');
  if (save) {
    const secrets: [string, string][] = [
      ['GOOGLE_OAUTH_CLIENT_ID', clientId],
      ['GOOGLE_OAUTH_CLIENT_SECRET', clientSecret],
      ['GOOGLE_REFRESH_TOKEN', data.refresh_token],
    ];
    for (const [name, value] of secrets) {
      const r = spawnSync('gh', ['secret', 'set', name], { input: value, encoding: 'utf8', shell: process.platform === 'win32' });
      if (r.status !== 0) throw new Error(`Couldn’t save ${name} with the GitHub CLI. Is "gh" installed and signed in?`);
      console.log(`Saved ${name}.`);
    }
    console.log('\nDone. Start the AI editor with: gh workflow run ai-edit.yml');
    return;
  }
  console.log('\nSave these three as GitHub secrets, all from this run, then clear your terminal:\n');
  console.log(`GOOGLE_OAUTH_CLIENT_ID      ${clientId}`);
  console.log('GOOGLE_OAUTH_CLIENT_SECRET  (the secret you entered above)');
  console.log(`GOOGLE_REFRESH_TOKEN        ${data.refresh_token}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
