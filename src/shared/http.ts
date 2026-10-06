import { failure, success } from './result.js';
import type { Result } from './result.js';
import { isCancelled } from './cancellation.js';

export type HttpFetch = typeof fetch;

export async function boundedRequest(
  transport: HttpFetch,
  request: { url: string; headers: Record<string, string>; body: string },
  options: { signal: AbortSignal; timeoutMs: number; maxBytes: number; readJson: boolean },
): Promise<Result<{ status: number; body: unknown }>> {
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal]);
  const timer = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs);
  let onAbort = () => {};
  const cancelled = new Promise<Result<never>>((resolve) => {
    onAbort = () => {
      resolve(failure(options.signal.aborted ? 'cancelled' : 'source_timeout'));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
  const execute = async (): Promise<Result<{ status: number; body: unknown }>> => {
    try {
      if (isCancelled(signal)) return failure('cancelled');
      const response = await transport(request.url, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
        redirect: 'error',
        signal,
      });
      if (!options.readJson || !response.ok) {
        await response.body?.cancel();
        return success({ status: response.status, body: null });
      }
      if (!response.headers.get('content-type')?.includes('application/json')) {
        await response.body?.cancel();
        return failure('source_invalid');
      }
      const reader = response.body?.getReader();
      if (!reader) return failure('source_invalid');
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        let chunk = await reader.read();
        while (!chunk.done) {
          const value: unknown = chunk.value;
          if (!(value instanceof Uint8Array)) {
            await reader.cancel();
            return failure('source_invalid');
          }
          bytes += value.byteLength;
          if (bytes > options.maxBytes || isCancelled(signal)) {
            await reader.cancel();
            return failure(isCancelled(signal) ? 'cancelled' : 'source_invalid');
          }
          chunks.push(value);
          chunk = await reader.read();
        }
        try {
          const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          return success({ status: response.status, body: decoded });
        } catch {
          return failure('source_invalid');
        }
      } finally {
        reader.releaseLock();
      }
    } catch {
      return failure(
        signal.aborted
          ? options.signal.aborted
            ? 'cancelled'
            : 'source_timeout'
          : 'source_unavailable',
      );
    }
  };
  try {
    return await Promise.race([execute(), cancelled]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
    controller.abort();
  }
}
