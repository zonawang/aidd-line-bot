import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import type { AppConfig } from './config.js';
import { ControlState } from './line-interaction/control-state.js';
import { createInteraction } from './line-interaction/handler.js';
import type { Diagnostic } from './line-interaction/handler.js';
import { createReplyTransport } from './line-interaction/reply.js';
import type { ReplyTransport } from './line-interaction/reply.js';
import { verifySignature } from './line-interaction/signature.js';
import { createDemoSource } from './restaurant-source-adapter/demo.js';
import { createGoogleSource } from './restaurant-source-adapter/google.js';
import type { RestaurantSourceAdapter } from './restaurant-source-adapter/types.js';
import { isRecord } from './shared/result.js';

export function createApp(
  config: AppConfig,
  dependencies: {
    source?: RestaurantSourceAdapter;
    reply?: ReplyTransport;
    state?: ControlState;
    now?: () => number;
    report?: (code: Diagnostic) => void;
  } = {},
) {
  const app = Fastify({
    logger: false,
    bodyLimit: 256 * 1024,
    requestTimeout: 10_000,
    connectionTimeout: 10_000,
  });
  const receivedAt = new WeakMap<object, number>();
  app.addHook('onRequest', (request, _reply, done) => {
    receivedAt.set(request, performance.now());
    done();
  });
  const state = dependencies.state ?? new ControlState();
  const handle = createInteraction({
    config,
    source:
      dependencies.source ??
      (config.mode === 'demo' ? createDemoSource() : createGoogleSource(config)),
    reply: dependencies.reply ?? createReplyTransport(config),
    state,
    ...(dependencies.now ? { now: dependencies.now } : {}),
    ...(dependencies.report ? { report: dependencies.report } : {}),
  });
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });
  app.setErrorHandler((error, _request, reply) => {
    const status = isRecord(error) && error['code'] === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 413 : 400;
    void reply.code(status).send({ error: status === 413 ? 'body_too_large' : 'invalid_request' });
  });
  app.setNotFoundHandler((_request, reply) => {
    void reply.code(404).send({ error: 'not_found' });
  });
  app.get('/health', () => ({ status: 'ok', mode: config.mode, history: 'disabled' }));
  for (const page of ['terms', 'privacy'] as const) {
    const asset = new URL(`../docs/app/${page}.html`, import.meta.url);
    app.get(`/${page}`, { exposeHeadRoute: false }, async (_request, reply) => {
      reply.headers({
        'Cache-Control': 'no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        'Referrer-Policy': 'no-referrer',
      });
      try {
        const html = await readFile(asset, 'utf8');
        return await reply.type('text/html; charset=utf-8').send(html);
      } catch {
        return reply.code(503).send({ error: 'policy_unavailable' });
      }
    });
  }
  app.post('/webhook', async (request, reply) => {
    if (
      !Buffer.isBuffer(request.body) ||
      !verifySignature(request.body, request.headers['x-line-signature'], config.channelSecret)
    )
      return reply.code(401).send({ error: 'invalid_signature' });
    let payload: unknown;
    try {
      payload = JSON.parse(request.body.toString('utf8')) as unknown;
    } catch {
      return reply.code(400).send({ error: 'invalid_json' });
    }
    if (
      !isRecord(payload) ||
      payload['destination'] !== config.destination ||
      !Array.isArray(payload['events']) ||
      payload['events'].length > 20
    )
      return reply.code(400).send({ error: 'invalid_envelope' });
    const remaining = 10_000 - (performance.now() - (receivedAt.get(request) ?? 0));
    if (remaining <= 0) return reply.code(408).send({ error: 'processing_deadline' });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, remaining);
    let abortListener = () => {};
    const stop = new Promise<void>((resolve) => {
      abortListener = () => {
        resolve();
      };
      controller.signal.addEventListener('abort', abortListener, { once: true });
    });
    const processing = async () => {
      for (const event of payload['events'] as unknown[]) {
        if (controller.signal.aborted) break;
        await handle(event, controller.signal);
      }
    };
    try {
      await Promise.race([processing(), stop]);
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', abortListener);
      controller.abort();
    }
    return { status: 'processed' };
  });
  app.addHook('onClose', () => {
    state.clear();
  });
  return app;
}
