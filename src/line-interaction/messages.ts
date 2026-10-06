import type { AppConfig } from '../config.js';
import type { LunchRecommendation } from '../lunch-recommendation/recommend.js';
import { failure, success } from '../shared/result.js';
import type { FailureCode, Result } from '../shared/result.js';

export interface TextMessage {
  type: 'text';
  text: string;
  quickReply?: {
    items: {
      type: 'action';
      action:
        { type: 'location'; label: string } | { type: 'message'; label: string; text: string };
    }[];
  };
}

export const CONFIRM_TEXT = '了解，僅當次推薦';
export const HISTORY_TEXT =
  '此 MVP 尚未提供歷史保存、查閱、刪除或撤回保存功能；不建立新查詢歷史，也不代表舊資源已刪除。';

export function textMessage(text: string): TextMessage {
  return { type: 'text', text };
}
export function locationGuide(
  text = '請用 LINE「傳送位置」主動分享位置，以取得一公里內的午餐推薦。',
): TextMessage {
  return {
    type: 'text',
    text,
    quickReply: { items: [{ type: 'action', action: { type: 'location', label: '傳送位置' } }] },
  };
}

export function noticeMessage(config: AppConfig): TextMessage {
  const processing =
    config.mode === 'demo'
      ? '【synthetic 本機展示】使用虛構餐廳及模擬 LINE 回覆，不傳送至 Google 或 LINE；請只用合成位置。'
      : `你傳送的位置經 LINE 送到本服務，確認後重傳的位置會送至 Google Maps（Google Places API）查詢餐廳，推薦透過 LINE 回覆。第三方依各自政策處理資料。\n服務條款：${config.termsUrl}\n隱私政策：${config.privacyUrl}`;
  return {
    type: 'text',
    text: `${processing}\n本 MVP 僅處理當次查詢，不保存位置或推薦歷史，尚未提供保存一年及歷史管理。告知狀態僅在記憶體短暫保留，重啟或到期需再次確認。\n這次尚未確認的位置已放棄，確認後請重新傳送位置。`,
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'message', label: '了解，僅當次推薦', text: CONFIRM_TEXT },
        },
      ],
    },
  };
}

export function sourceFailureMessage(error: FailureCode): TextMessage {
  const messages: Record<FailureCode, string> = {
    invalid_input: '位置格式不正確，請重新傳送 LINE 位置。',
    source_auth: '餐廳來源授權遭拒，暫時無法查詢。',
    source_unavailable: '餐廳來源暫時故障，這不代表附近沒有餐廳。',
    source_timeout: '餐廳來源查詢逾時，這不代表附近沒有餐廳。',
    source_invalid: '餐廳來源資料或必要來源標示不完整，無法可靠顯示推薦。',
    display_limit: '必要來源標示超過 LINE 顯示限制，目前無法完整顯示推薦。',
    cancelled: '本次處理已停止，請稍後重新傳送位置。',
  };
  return textMessage(messages[error]);
}

export function recommendationMessages(result: LunchRecommendation): Result<TextMessage[]> {
  const count = result.restaurants.length;
  const prefix = result.provider === 'synthetic' ? '【synthetic 虛構展示】' : 'Google Maps';
  const summary = `${prefix}\n${count === 0 ? '此次回傳候選中，沒有符合一公里及營業条件的餐廳。' : `此次找到 ${count.toString()} 家符合條件的餐廳${count < 3 ? '（不足三家）' : ''}。`}\n僅從來源此次回傳候選篩選；不代表全區所有餐廳，也不保證是全區最近三家。`;
  const messages = [
    textMessage(summary),
    ...result.restaurants.map((restaurant) =>
      textMessage(
        `${restaurant.name}\n理由：直線距離約 ${Math.round(restaurant.distanceMeters).toString()} 公尺；${restaurant.opening === 'open' ? '來源目前標示營業中' : '營業時間未知，請先確認'}。\n地圖：${restaurant.mapUrl}\n來源：${prefix}${restaurant.attributions.length > 0 ? `\n${restaurant.attributions.join('\n')}` : ''}`,
      ),
    ),
  ];
  if (messages.length > 5 || messages.some((message) => message.text.length > 5000))
    return failure('display_limit');
  return success(messages);
}
