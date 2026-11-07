#!/usr/bin/env node
/**
 * Lets accounts made before email verification arrived keep using the app.
 *
 *   npm run auth:legacy -- path/to/service-account.json
 *
 * The database rules only let in people whose email is verified, or whose
 * account is listed under `legacyUsers`. Nobody can write that list from the
 * app; this script fills it, using the Firebase service account, with every
 * account created before verification became required. Run it once, before
 * publishing the rules. Running it again is harmless.
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Keep in step with VERIFICATION_REQUIRED_FROM in src/utils/verification.ts. */
const REQUIRED_FROM = Date.parse('2026-11-05T05:00:00Z');

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const readEnvFile = () => {
  try {
    return Object.fromEntries(
      readFileSync(resolve('.env'), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const at = line.indexOf('=');
          return [
            line.slice(0, at).trim(),
            line
              .slice(at + 1)
              .trim()
              .replace(/^['"]|['"]$/g, ''),
          ];
        }),
    );
  } catch {
    return {};
  }
};

const databaseUrl = (readEnvFile().EXPO_PUBLIC_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
const accountPath = process.argv[2];
if (!databaseUrl) fail('EXPO_PUBLIC_FIREBASE_DATABASE_URL is missing from .env.');
if (!accountPath) fail('Pass the Firebase service account file: npm run auth:legacy -- file.json');

let account;
try {
  account = JSON.parse(readFileSync(resolve(accountPath), 'utf8'));
} catch {
  fail(`Could not read ${accountPath} as JSON.`);
}
if (!account.client_email || !account.private_key || !account.project_id) {
  fail(`${accountPath} is not a Firebase service account key.`);
}

const base64url = (value) => Buffer.from(value).toString('base64url');

/** A Google access token for the service account. */
const accessToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(account.private_key, 'base64url')}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token)
    fail(`Google refused the service account: ${body.error_description || response.status}`);
  return body.access_token;
};

const token = await accessToken();
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

// Every account, a page at a time.
const legacy = {};
let total = 0;
let pageToken = '';
do {
  const url = new URL(
    `https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}/accounts:batchGet`,
  );
  url.searchParams.set('maxResults', '1000');
  if (pageToken) url.searchParams.set('nextPageToken', pageToken);
  const response = await fetch(url, { headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) fail(`Could not list accounts: ${body?.error?.message || response.status}`);
  for (const user of body.users || []) {
    total += 1;
    if (Number(user.createdAt) < REQUIRED_FROM) legacy[user.localId] = true;
  }
  pageToken = body.nextPageToken || '';
} while (pageToken);

const count = Object.keys(legacy).length;
if (count > 0) {
  const response = await fetch(`${databaseUrl}/legacyUsers.json`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(legacy),
  });
  if (!response.ok) fail(`Could not save the list: ${response.status} ${await response.text()}`);
}

console.log(
  `\n✔ ${count} of ${total} accounts were made before verification and can keep using the app.\n`,
);
