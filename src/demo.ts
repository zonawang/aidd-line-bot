import { createHmac, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { CONFIRM_TEXT } from './line-interaction/messages.js';
import { createDemoSource } from './restaurant-source-adapter/demo.js';

export async function runSyntheticDemo() {
  const config = loadConfig({ APP_MODE: 'demo' });
  const source = createDemoSource();
  let sourceCalls = 0;
  let replyCalls = 0;
  let recommendations: string[] = [];
  const app = createApp(config, {
    source: {
      provider: 'synthetic',
      search: (location, signal) => {
        sourceCalls += 1;
        return source.search(location, signal);
      },
    },
    reply: (_token, messages) => {
      replyCalls += 1;
      if (messages.length === 4) recommendations = messages.map((message) => message.text);
      return Promise.resolve('synthetic');
    },
  });
  try {
    const inputs = [
      { type: 'text', text: '午餐' },
      { type: 'location', latitude: 0, longitude: 0 },
      { type: 'text', text: CONFIRM_TEXT },
      { type: 'location', latitude: 0, longitude: 0 },
    ];
    for (const [index, message] of inputs.entries()) {
      const body = JSON.stringify({
        destination: config.destination,
        events: [
          {
            type: 'message',
            mode: 'active',
            timestamp: Date.now(),
            webhookEventId: randomUUID(),
            deliveryContext: { isRedelivery: false },
            source: { type: 'user', userId: 'U44444444444444444444444444444444' },
            replyToken: `synthetic-demo-${index.toString()}`,
            message: { id: index.toString(), ...message },
          },
        ],
      });
      const signature = createHmac('sha256', config.channelSecret).update(body).digest('base64');
      const response = await app.inject({
        method: 'POST',
        url: '/webhook',
        headers: { 'Content-Type': 'application/json', 'x-line-signature': signature },
        payload: body,
      });
      if (response.statusCode !== 200 || (index < 3 && sourceCalls !== 0))
        throw new Error('合成流程驗證失敗');
    }
    if (sourceCalls !== 1 || replyCalls !== 4 || recommendations.length !== 4)
      throw new Error('合成推薦未完成');
    return { mode: 'synthetic', realLineAccepted: false, sourceCalls, replyCalls, recommendations };
  } finally {
    await app.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${JSON.stringify(await runSyntheticDemo(), null, 2)}\n`);
  } catch {
    process.stderr.write('synthetic 展示失敗\n');
    process.exitCode = 1;
  }
}
