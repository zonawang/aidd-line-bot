# MVP 外部 API 查核

## Evidence and Scope

2026-10-06 以公開唯讀 HTTP 取得下列官方文件，回應均為 200。這是 API 實作依據，不是帳號權利、費用核准、真實串接成功或法律合規證明。沒有傳送位置、憑證或呼叫真實搜尋／訊息 API。

- LINE 驗簽：<https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/>
- LINE 官方 OpenAPI：<https://raw.githubusercontent.com/line/line-openapi/main/messaging-api.yml>
- Places Nearby Search：<https://developers.google.com/maps/documentation/places/web-service/nearby-search>
- Places 顯示與使用政策：<https://developers.google.com/maps/documentation/places/web-service/policies?hl=en>

LINE reference 頁面本次取得的 HTML 未包含所需欄位正文，改以官方 OpenAPI 核對，沒有把空結果當作 API 不支援。文件網址不是執行依賴，不以浮動網址下載可執行程式。

## Implementation Findings

- LINE 以 channel secret 為 key，對未經解析或修改的 webhook 原始 bytes 計算 HMAC-SHA256，與 `x-line-signature` 比對；缺少或不符即不可處理事件。
- LINE `POST /v2/bot/message/reply` 使用 `replyToken` 與 1–5 個 messages；quick reply 最多 13 項，支援 location action。200、400、429 等結果需區分，不以本機送出請求就宣稱已接受。
- Google Nearby Search (New) 使用 `POST https://places.googleapis.com/v1/places:searchNearby`；以 `X-Goog-Api-Key` 與必要 `X-Goog-FieldMask` 指定身份和欄位。餐廳類型、中心點及 radius 放 JSON body。
- `maxResultCount` 是 1–20；`rankPreference: DISTANCE` 才按距離，預設是 POPULARITY。一次返回的有限候選不是一公里內所有餐廳，不宣稱全區最近三家。
- `displayName`、`id`、`location`、`businessStatus`、`googleMapsUri`、類型及 `attributions` 可作必要投影；`currentOpeningHours` 會觸發 Enterprise SKU。實際價格與費用上限需使用者確認，不能為測試自動啟用。

## Live Prerequisites

- 需合法可用的 LINE／Google 帳號、憑證與必要費用授權；禁止沿用其他 Bot 的秘密或將秘密貼入對話／文件。
- Places 要求公開可存取的使用條款及隱私政策，納入相應 Google 條款。實際網址／內容及當次位置第三方傳輸告知需確認；環境變數 `true` 本身不是查核證據。
- 顯示資料時保留 Google Maps attribution。政策正文允許空間受限時使用 `Google Maps` 文字；如有第三方 attribution，須一併呈現，不能只顯示 Google Maps，也不能因長度限制靜默截斷。
- 不建立餐廳內容快取／持久儲存，不展示照片／評論以免引入不需要的資料與額外 attribution 範圍。無法合法完整顯示的結果應明確失敗或排除，不能假稱空清單。
- 真實入口的 HTTPS／webhook 設定尚需使用者提供或另行授權。核心程式與本機合成展示不因此停工，不新增網站或 VM 作為前置。

## Verification Status

目前只完成官方介面與政策的有限查核；帳號、公開政策頁、費用、真實 LINE 接受及實際 Google 結果均未驗證。缺項保持明示，不以模擬成功取代，也不恢復底層儲存診斷。

## Policy Draft Reference Check

2026-10-06 補查下列官方頁面，HTTP 200；只讀公開文件，未呼叫推薦 API。Places 政策再次確認應用程式須提供公開可存取的條款／隱私政策，分別納入相應 Google 條款與隱私資訊。這些文件可作草稿依據，不等於營運者已確認權利、法律適用性或政策已發布。

- Google Maps 使用者條款：<https://cloud.google.com/maps-platform/terms/maps-end-user-terms>
- Google 隱私權政策：<https://policies.google.com/privacy>
- LINE 官方連結指向的 LY Corporation 繁中隱私政策：<https://www.lycorp.co.jp/en/company/privacypolicy_zh-TW/>
- Cloudflare 隱私政策：<https://www.cloudflare.com/privacypolicy/>

舊 `https://terms.line.me/line_privacy/` 及其語言參數版本於本次 HTTP 檢查回傳400，未把該結果視為政策不存在；改用LINE官方頁面引用且實測200的LY Corporation網址。政策草稿不添加追蹤、外部腳本、照片或評論，避免新增資料處理與attribution範圍。

設定進度以 `temporary-https-setup.md` 的最新更新為準：LINE Bot資訊查詢HTTP200，Google一次合成計費查詢另獲授權但尚未執行；上述舊查核段落不作為最新未授權狀態。真實推薦、reply及公開政策仍未驗證。
