export type FailureCode =
  | 'invalid_input'
  | 'source_auth'
  | 'source_unavailable'
  | 'source_timeout'
  | 'source_invalid'
  | 'display_limit'
  | 'cancelled';

export type Result<Value> = { ok: true; value: Value } | { ok: false; error: FailureCode };

export const success = <Value>(value: Value): Result<Value> => ({ ok: true, value });
export const failure = (error: FailureCode): Result<never> => ({ ok: false, error });

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isText(value: unknown, limit: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= limit &&
    Array.from(value).every(
      (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
  );
}
