import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

export async function start(environment: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(environment);
  const app = createApp(config, {
    report: (code) => {
      process.stdout.write(`${JSON.stringify({ component: 'interaction', code })}\n`);
    },
  });
  const stop = () => {
    void app.close().catch(() => {
      process.stderr.write('停止服務失敗\n');
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
    await app.listen({ port: config.port, host: config.host });
  } catch (error) {
    await app.close();
    throw error;
  }
  process.stdout.write(
    `${JSON.stringify({ status: 'listening', mode: config.mode, port: config.port, history: 'disabled' })}\n`,
  );
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await start();
  } catch {
    process.stderr.write(
      '啟動失敗：請核對 APP_MODE、必要授權、憑證、政策網址及連接埠設定。未啟動真實出口。\n',
    );
    process.exitCode = 1;
  }
}
