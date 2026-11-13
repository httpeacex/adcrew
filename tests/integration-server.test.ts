import assert from 'node:assert/strict';
import { test } from 'node:test';
import { archiveDriveFile, deliverTaskUpdate, integrationStatus } from '../src/lib/integration-server.ts';

const env = {
  KADR_PUBLIC_URL: 'https://workspace.example.test/',
  KADR_TELEGRAM_BOT_TOKEN: '123456:placeholder_token',
  KADR_TELEGRAM_CHAT_ID: '-10012345',
  KADR_SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/T000/B000/placeholder',
  KADR_DRIVE_FOLDER_ID: 'shared-folder',
  KADR_GOOGLE_CLIENT_ID: 'fake-client',
  KADR_GOOGLE_CLIENT_SECRET: 'fake-secret',
  KADR_GOOGLE_REFRESH_TOKEN: 'fake-refresh-token',
};
const file = { taskId: 42, round: 2, fileId: 50, name: 'sample.png', type: 'image/png', data: Uint8Array.of(7, 8, 9) };

test('configuration disables incomplete or invalid destinations without exposing credentials', () => {
  assert.deepEqual(integrationStatus(env), { telegram: true, slack: true, drive: true });
  assert.deepEqual(integrationStatus({ KADR_SLACK_WEBHOOK_URL: 'https://hooks.slack.com.example.test/services/T/B/C' }), { telegram: false, slack: false, drive: false });
});

test('notification contains an authenticated task link and isolates provider failure', async () => {
  const requests = new Map<string, Record<string, unknown>>();
  const request: typeof fetch = async (input, init) => {
    const host = new URL(String(input)).hostname;
    assert.equal(init?.redirect, 'error');
    requests.set(host, JSON.parse(String(init?.body)));
    if (host === 'api.telegram.org') return Response.json({ ok: false }, { status: 401 });
    return new Response('ok');
  };
  assert.deepEqual(await deliverTaskUpdate({ taskId: 42, action: 'revise' }, env, request), { telegram: 'failed', slack: 'sent' });
  assert.equal(requests.get('api.telegram.org')?.chat_id, '-10012345');
  for (const body of requests.values()) assert.match(String(body.text), /КР-042[\s\S]*https:\/\/workspace\.example\.test\/tasks\/42/);
  assert.equal(requests.get('hooks.slack.com')?.unfurl_links, false);
});

test('Drive sends accepted bytes to the configured folder over a provider-issued session', async () => {
  const requests: string[] = [];
  const request: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push(`${init?.method} ${url.hostname}`);
    if (url.hostname === 'oauth2.googleapis.com') {
      assert.equal(new URLSearchParams(String(init?.body)).get('grant_type'), 'refresh_token');
      return Response.json({ access_token: 'fake-access-token' });
    }
    if (init?.method === 'POST') {
      assert.deepEqual(JSON.parse(String(init.body)).parents, ['shared-folder']);
      assert.equal(url.searchParams.get('uploadType'), 'resumable');
      assert.equal(url.searchParams.get('ignoreDefaultVisibility'), 'true');
      return new Response(null, { headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=fake' } });
    }
    assert.deepEqual(Array.from(new Uint8Array(init?.body as ArrayBuffer)), [7, 8, 9]);
    return Response.json({ id: 'drive-file' });
  };
  assert.deepEqual(await archiveDriveFile(file, env, request), { status: 'sent', id: 'drive-file' });
  assert.deepEqual(requests, ['POST oauth2.googleapis.com', 'POST www.googleapis.com', 'PUT www.googleapis.com']);
});

test('Drive never forwards file bytes or credentials to a different upload host', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({ access_token: 'fake-access-token' });
    return new Response(null, { headers: { Location: 'https://example.test/upload' } });
  };
  assert.deepEqual(await archiveDriveFile(file, env, request), { status: 'failed' });
  assert.equal(calls, 2);
});
