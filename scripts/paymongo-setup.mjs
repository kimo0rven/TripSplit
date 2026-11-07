#!/usr/bin/env node
/**
 * One-time setup for PayMongo payments that record themselves.
 *
 *   PAYMONGO_SECRET_KEY=sk_test_... npm run pay:setup -- path/to/service-account.json
 *
 * It:
 *   1. registers (or reuses) a PayMongo webhook pointing at the payment function,
 *   2. stores every secret the function needs in Supabase,
 * and never prints a secret. Run `npm run pay:deploy` afterwards.
 *
 * The service account JSON comes from Firebase console → Project settings →
 * Service accounts → Generate new private key. Keep that file out of git.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

/** Reads KEY=value lines from .env, without touching process.env. */
const readEnvFile = () => {
  try {
    return Object.fromEntries(
      readFileSync(resolve('.env'), 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const at = line.indexOf('=');
          return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
        }),
    );
  } catch {
    return {};
  }
};

const dotenv = readEnvFile();
const secretKey = process.env.PAYMONGO_SECRET_KEY || dotenv.PAYMONGO_SECRET_KEY || '';
const functionUrl = (dotenv.EXPO_PUBLIC_PAYMONGO_SERVER_URL || '').replace(/\/$/, '');
const databaseUrl = dotenv.EXPO_PUBLIC_FIREBASE_DATABASE_URL || '';
const apiKey = dotenv.EXPO_PUBLIC_FIREBASE_API_KEY || '';
const accountPath = process.argv[2];

if (!/^sk_(test|live)_/.test(secretKey)) {
  fail('Set PAYMONGO_SECRET_KEY to your sk_test_... or sk_live_... key.');
}
if (!functionUrl) fail('EXPO_PUBLIC_PAYMONGO_SERVER_URL is missing from .env.');
if (!databaseUrl || !apiKey) fail('The Firebase settings are missing from .env.');
if (!accountPath) fail('Pass the Firebase service account file: npm run pay:setup -- file.json');

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(resolve(accountPath), 'utf8'));
} catch {
  fail(`Could not read ${accountPath} as JSON.`);
}
if (!serviceAccount.client_email || !serviceAccount.private_key) {
  fail(`${accountPath} is not a Firebase service account key.`);
}

const auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
const webhookUrl = `${functionUrl}/webhook`;

const paymongo = async (path, init = {}) => {
  const response = await fetch(`https://api.paymongo.com/v1${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: auth },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    fail(`PayMongo said: ${body?.errors?.[0]?.detail || response.status}`);
  }
  return body;
};

console.log('→ Looking for a PayMongo webhook at', webhookUrl);
const listed = await paymongo('/webhooks');
const existing = (listed?.data || []).find((hook) => hook?.attributes?.url === webhookUrl);

let webhookSecret = existing?.attributes?.secret_key || '';
if (existing && existing.attributes?.status !== 'enabled') {
  await paymongo(`/webhooks/${existing.id}/enable`, { method: 'POST' });
  console.log('  Re-enabled the existing webhook.');
}
if (!existing) {
  const created = await paymongo('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      data: { attributes: { url: webhookUrl, events: ['checkout_session.payment.paid'] } },
    }),
  });
  webhookSecret = created?.data?.attributes?.secret_key || '';
  console.log('  Created a new webhook.');
} else {
  console.log('  Reusing the webhook that is already there.');
}
if (!webhookSecret) {
  fail('PayMongo did not hand back the webhook secret. Delete the webhook in PayMongo and run again.');
}

console.log('→ Saving the secrets in Supabase');
const result = spawnSync(
  'npx',
  [
    'supabase',
    'secrets',
    'set',
    `PAYMONGO_SECRET_KEY=${secretKey}`,
    `PAYMONGO_WEBHOOK_SECRET=${webhookSecret}`,
    `FIREBASE_DATABASE_URL=${databaseUrl}`,
    `FIREBASE_API_KEY=${apiKey}`,
    `FIREBASE_SERVICE_ACCOUNT=${JSON.stringify(serviceAccount)}`,
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) fail('supabase secrets set did not finish.');

console.log('\n✔ Done. Now run: npm run pay:deploy\n');
