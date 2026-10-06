import { isText } from './shared/result.js';

export interface AppConfig {
  mode: 'demo' | 'live';
  host: string;
  port: number;
  channelSecret: string;
  channelAccessToken: string;
  destination: string;
  googleApiKey: string;
  termsUrl: string;
  privacyUrl: string;
}

export const DEMO_SECRET = 'synthetic-local-demo-channel-secret';
export const DEMO_DESTINATION = 'U00000000000000000000000000000000';

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (!isText(value, 4096)) throw new Error(`設定缺少或不合法：${name}`);
  return value;
}

function publicUrl(environment: NodeJS.ProcessEnv, name: string): string {
  const value = required(environment, name);
  const parsed = new URL(value);
  if (
    value.length > 2048 ||
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error(`需要公開 HTTPS 網址：${name}`);
  }
  return value;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const mode = environment['APP_MODE'];
  if (mode !== 'demo' && mode !== 'live') throw new Error('APP_MODE 必須明確為 demo 或 live');
  const port = Number(environment['PORT'] ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 不合法');
  if (mode === 'demo') {
    return {
      mode,
      host: '127.0.0.1',
      port,
      channelSecret: DEMO_SECRET,
      channelAccessToken: '',
      destination: DEMO_DESTINATION,
      googleApiKey: '',
      termsUrl: '',
      privacyUrl: '',
    };
  }
  for (const name of ['LIVE_AUTHORIZED', 'SOURCE_RIGHTS_CONFIRMED', 'GOOGLE_FEES_AUTHORIZED']) {
    if (environment[name] !== 'yes') throw new Error(`真實出口尚未授權：${name}`);
  }
  const channelSecret = required(environment, 'LINE_CHANNEL_SECRET');
  if (channelSecret === DEMO_SECRET || channelSecret.length < 16) {
    throw new Error('LINE_CHANNEL_SECRET 不可使用展示值或過短值');
  }
  const destination = required(environment, 'LINE_DESTINATION');
  if (!/^U[0-9a-f]{32}$/u.test(destination)) throw new Error('LINE_DESTINATION 不合法');
  return {
    mode,
    host: environment['HOST'] ?? '127.0.0.1',
    port,
    channelSecret,
    channelAccessToken: required(environment, 'LINE_CHANNEL_ACCESS_TOKEN'),
    destination,
    googleApiKey: required(environment, 'GOOGLE_PLACES_API_KEY'),
    termsUrl: publicUrl(environment, 'PUBLIC_TERMS_URL'),
    privacyUrl: publicUrl(environment, 'PUBLIC_PRIVACY_URL'),
  };
}
