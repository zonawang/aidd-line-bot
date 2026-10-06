import { isRecord, isText } from '../shared/result.js';
import { isLocation } from '../shared/location.js';
import type { Location } from '../shared/location.js';

export interface PrivateEvent {
  id: string;
  userId: string;
  replyToken: string;
  timestamp: number;
  message:
    | { type: 'text'; text: string }
    | { type: 'location'; location: Location }
    | { type: 'unsupported' };
}

export function parsePrivateEvent(value: unknown, now: number): PrivateEvent | null {
  if (
    !isRecord(value) ||
    value['type'] !== 'message' ||
    value['mode'] !== 'active' ||
    !isText(value['webhookEventId'], 128) ||
    !isText(value['replyToken'], 256) ||
    typeof value['timestamp'] !== 'number' ||
    !Number.isSafeInteger(value['timestamp']) ||
    value['timestamp'] < now - 24 * 60 * 60 * 1000 ||
    value['timestamp'] > now + 5 * 60 * 1000 ||
    !isRecord(value['source']) ||
    value['source']['type'] !== 'user' ||
    typeof value['source']['userId'] !== 'string' ||
    !/^U[0-9a-f]{32}$/u.test(value['source']['userId']) ||
    !isRecord(value['deliveryContext']) ||
    typeof value['deliveryContext']['isRedelivery'] !== 'boolean' ||
    !isRecord(value['message']) ||
    !isText(value['message']['id'], 128)
  )
    return null;
  const message = value['message'];
  let parsed: PrivateEvent['message'] = { type: 'unsupported' };
  if (
    message['type'] === 'text' &&
    typeof message['text'] === 'string' &&
    message['text'].length <= 5000
  ) {
    parsed = { type: 'text', text: message['text'] };
  } else if (message['type'] === 'location') {
    if (typeof message['latitude'] !== 'number' || typeof message['longitude'] !== 'number')
      return null;
    const location = { latitude: message['latitude'], longitude: message['longitude'] };
    if (!isLocation(location)) return null;
    parsed = { type: 'location', location };
  }
  return {
    id: value['webhookEventId'],
    userId: value['source']['userId'],
    replyToken: value['replyToken'],
    timestamp: value['timestamp'],
    message: parsed,
  };
}
