import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifySignature(body: Buffer, signature: unknown, secret: string): boolean {
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{43}=$/u.test(signature)) return false;
  const supplied = Buffer.from(signature, 'base64');
  const expected = createHmac('sha256', secret).update(body).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
