import { pathToFileURL } from 'node:url';
import { createApp } from '../../dist/app.js';
import { loadConfig } from '../../dist/config.js';
import { createGoogleSource } from '../../dist/restaurant-source-adapter/google.js';
import { createReplyTransport } from '../../dist/line-interaction/reply.js';
import { distanceMeters } from '../../dist/shared/location.js';
import { createBoundedSource } from './live-demo-source.ts';

export { createBoundedSource };

const emit = (diagnostic) => process.stdout.write(`${JSON.stringify(diagnostic)}\n`);

export async function main(environment = process.env) {
  const config = loadConfig(environment);
  if (config.mode !== 'live' || config.host !== '127.0.0.1' || config.port !== 38124)
    throw new Error('controlled_demo_config_required');
  const source = createBoundedSource(createGoogleSource(config), distanceMeters, emit);
  const transport = createReplyTransport(config);
  const app = createApp(config, {
    source,
    reply: async (token, messages, signal) => {
      const purpose = messages[0]?.text.startsWith('Google Maps\n') ? 'recommendation' : 'guidance';
      let outcome;
      try {
        outcome = await transport(token, messages, signal);
      } catch {
        outcome = 'unknown';
      }
      if (!['accepted', 'rejected', 'unknown', 'not_sent'].includes(outcome)) outcome = 'unknown';
      emit({ event: 'line_reply', outcome, purpose, messageCount: messages.length });
      return outcome;
    },
  });
  const stop = () => {
    void app.close().catch(() => {
      process.stderr.write('受控測試停止失敗。\n');
      process.exitCode = 1;
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  app.addHook('onClose', () => {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  });
  try {
    await app.listen({ host: config.host, port: config.port });
  } catch {
    await app.close();
    throw new Error('controlled_demo_start_failed');
  }
  emit({ status: 'controlled-demo', maximum: 1, restart: 'recheck_remaining_external_budget' });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch {
    process.stderr.write('受控測試啟動失敗：請核對必要授權、設定與本機入口。\n');
    process.exitCode = 1;
  }
}
