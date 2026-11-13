import type { IntegrationStatus } from './integration-status.ts';
import { actionLabels } from './workflow.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type TaskUpdate = { taskId: number; action: 'submit' | 'revise' | 'accept' };
type DeliveryStatus = 'sent' | 'failed' | 'disabled';
type DriveFile = { taskId: number; round: number; fileId: number; name: string; type: string; data: Uint8Array };
type DriveDelivery = { status: 'sent'; id: string } | { status: 'failed' | 'disabled' };

function httpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash ? url : null;
  } catch {
    return null;
  }
}

function configuration(env: Environment) {
  const workspace = httpsUrl(env.KADR_PUBLIC_URL);
  const publicUrl = workspace && !workspace.search ? workspace : null;
  const token = env.KADR_TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const chat = env.KADR_TELEGRAM_CHAT_ID?.trim() ?? '';
  const telegram = publicUrl && /^\d+:[\w-]+$/.test(token) && /^(?:-?\d+|@[A-Za-z0-9_]+)$/.test(chat) ? { token, chat } : null;
  const webhook = httpsUrl(env.KADR_SLACK_WEBHOOK_URL);
  const slack = publicUrl && webhook && ['hooks.slack.com', 'hooks.slack-gov.com'].includes(webhook.hostname) && !webhook.search && /^\/services\/[\w-]+\/[\w-]+\/[\w-]+$/.test(webhook.pathname) ? webhook : null;
  const folder = env.KADR_DRIVE_FOLDER_ID?.trim() ?? '';
  const clientId = env.KADR_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.KADR_GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = env.KADR_GOOGLE_REFRESH_TOKEN?.trim();
  const drive = /^[\w-]+$/.test(folder) && clientId && clientSecret && refreshToken ? { folder, clientId, clientSecret, refreshToken } : null;
  return { publicUrl, telegram, slack, drive };
}

export function integrationStatus(env: Environment = process.env): IntegrationStatus {
  const { telegram, slack, drive } = configuration(env);
  return { telegram: !!telegram, slack: !!slack, drive: !!drive };
}

function jsonPost(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(8_000) };
}

async function send(enabled: boolean, deliver: () => Promise<boolean>): Promise<DeliveryStatus> {
  if (!enabled) return 'disabled';
  try {
    return await deliver() ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function deliverTaskUpdate(event: TaskUpdate, env: Environment = process.env, request: typeof fetch = fetch) {
  const { publicUrl, telegram, slack } = configuration(env);
  if (!publicUrl || !Number.isSafeInteger(event.taskId) || event.taskId < 1) return { telegram: 'disabled', slack: 'disabled' } as const;
  const taskLink = `${publicUrl.href.replace(/\/$/, '')}/tasks/${event.taskId}`;
  const code = `КР-${String(event.taskId).padStart(3, '0')}`;
  const text = `AdCrew · ${code} · ${actionLabels[event.action]}\n${taskLink}`;
  const [telegramStatus, slackStatus] = await Promise.all([
    send(!!telegram, async () => {
      const response = await request(`https://api.telegram.org/bot${telegram!.token}/sendMessage`, jsonPost({ chat_id: telegram!.chat, text, link_preview_options: { is_disabled: true } }));
      return response.ok && (await response.json() as { ok?: boolean }).ok === true;
    }),
    send(!!slack, async () => {
      const response = await request(slack!, jsonPost({ text, unfurl_links: false, unfurl_media: false }));
      return response.ok && (await response.text()).trim() === 'ok';
    }),
  ]);
  return { telegram: telegramStatus, slack: slackStatus };
}

export async function archiveDriveFile(file: DriveFile, env: Environment = process.env, request: typeof fetch = fetch): Promise<DriveDelivery> {
  const { drive } = configuration(env);
  if (!drive) return { status: 'disabled' };
  try {
    const oauth = await request('https://oauth2.googleapis.com/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
      body: new URLSearchParams({ client_id: drive.clientId, client_secret: drive.clientSecret, refresh_token: drive.refreshToken, grant_type: 'refresh_token' }),
    });
    if (!oauth.ok) return { status: 'failed' };
    const { access_token: token } = await oauth.json() as { access_token?: string };
    if (typeof token !== 'string' || !token) return { status: 'failed' };

    const initial = await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&ignoreDefaultVisibility=true&fields=id', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': file.type, 'X-Upload-Content-Length': String(file.data.byteLength) },
      body: JSON.stringify({
        name: `КР-${String(file.taskId).padStart(3, '0')} v${file.round} ${file.name}`,
        mimeType: file.type,
        parents: [drive.folder],
        appProperties: { adcrewTask: String(file.taskId), adcrewFile: String(file.fileId) },
      }),
    });
    const location = httpsUrl(initial.headers.get('Location'));
    if (!initial.ok || location?.hostname !== 'www.googleapis.com' || location.pathname !== '/upload/drive/v3/files' || !location.searchParams.get('upload_id')) return { status: 'failed' };

    const uploaded = await request(location, {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(60_000),
      headers: { 'Content-Type': file.type, 'Content-Length': String(file.data.byteLength) },
      body: Uint8Array.from(file.data).buffer,
    });
    if (!uploaded.ok) return { status: 'failed' };
    const { id } = await uploaded.json() as { id?: string };
    return typeof id === 'string' && id ? { status: 'sent', id } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
