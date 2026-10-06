# 無歷史 MVP 執行與交接

## 2026-10-06 本機設定與 CI 更新

現有 runtime 設定檔已依使用者核准移至 `/Users/al03034136/.config/aidd-line-bot/runtime-20261006-H5MJFp/.env`，不再位於 application source tree。請保留原檔及權限，不在專案根目錄重建 `.env`；以下提到根目錄 `.env` 的操作是當時驗證紀錄，不能直接用於現在的 live 重啟。後續已取得新授權的 live 啟動需顯式指定該外部 env-file；目前一次 Places 額度已耗盡，CI 或 demo 不會重啟受控 live runner。

新增 `npm run ci` 可重現本機 MVP 品質檢查；它不載入 runtime 檔，使用合成 transport，也不代表 hosted CI／安全掃描／合併或正式上線已放行。詳 [本機 CI](ci.md)。既有本機展示仍使用 `npm run demo`。

## 設定與啟停

已安裝 Node 24.18.0／npm 11.16.0 的 workspace 可直接 `npm run demo` 或 `npm run dev`。兩者明確 synthetic，無 DB 相依、無真實憑證需求。`npm run dev` 先建置再啟動，不含檔案 watch；修改後重新啟動。`npm run build` 後用 `APP_MODE=demo npm start` 啟動同一產物。SIGINT／SIGTERM 關閉 HTTP 服務並清除控制狀態與清理計時器。

`npm run demo` 的注入入口走真實 Fastify 路由與 HMAC，來源及 reply 為合成。測試 E2E 另以 mock HTTP 取代 Google／LINE 外部服務，檢查實際 outgoing URL、headers、body 及 HTTP 回傳狀態。以上都不是已批准的真實 Construction Verification Command。

| 環境變數                                 | 用途                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| `APP_MODE`                               | 必填 `demo` 或 `live`；live 設定不合法就退出                |
| `HOST`、`PORT`                           | live 預設 localhost:3000；demo 固定 localhost，port 可設定  |
| `LINE_CHANNEL_SECRET`                    | 專用 channel 的 webhook HMAC secret                         |
| `LINE_CHANNEL_ACCESS_TOKEN`              | reply Bearer token，不放 URL 或 log                         |
| `LINE_DESTINATION`                       | 對應 channel 的 bot user ID（`U` 加 32 個小寫十六進位字元） |
| `GOOGLE_PLACES_API_KEY`                  | Places API (New) 專用受限 key；只放 `X-Goog-Api-Key`        |
| `LIVE_AUTHORIZED`                        | 真實資料／受控測試已授權時才設 `yes`                        |
| `SOURCE_RIGHTS_CONFIRMED`                | 來源、顯示、政策等實際查核完成時才設 `yes`                  |
| `GOOGLE_FEES_AUTHORIZED`                 | Enterprise SKU／配額／費用獲明確授權時才設 `yes`            |
| `PUBLIC_TERMS_URL`、`PUBLIC_PRIVACY_URL` | 已公開且內容審核完成的 HTTPS 網址，在 live 告知中顯示       |

在安全的本機編輯器複製 `.env.example` 為 `.env`，輸入專用憑證；不得覆寫已存在的 `.env`，不貼到聊天、測試 fixture 或報告。確認 `.env` 被 Git 忽略後才保存。既有環境憑證不由程式探查。`npm start` 透過 Node 的 env-file 支援讀取 `.env`。公開條款及隱私內容需納入 Google 對應政策，URL 有效格式不代表外部內容已合法或可用。

## 臨時 HTTPS 測試入口

使用者已同意Cloudflare測試入口，並另行核准一次指定公共測試點的Places查詢。2026-10-06已完成LINE官方Webhook驗證及真實推薦，使用者確認Client收到餐廳與地圖。入口為臨時HTTP/2 tunnel，不是正式持續部署；最新網址及狀態記於Unit的`line-live-verification.md`。

本機`.env`權限600、被Git忽略，使用`APP_MODE=live`、`HOST=127.0.0.1`、`PORT=38124`。專用憑證、destination及實際政策URL已設定，Webhook驗簽與一次推薦成功。**一次查詢額度1/1已用完**：`.env`的`GOOGLE_FEES_AUTHORIZED`已改回`no`，`LIVE_AUTHORIZED`保持`no`，執行中的受控來源也會拒絕追加查詢。不得為重跑而直接把旗標設yes；先取得新授權。缺少必要設定時服務拒絕啟動，不公開demo或關閉驗簽。

完成實際權利、公開條款／隱私政策及必要費用確認後，才可依核准範圍設定授權旗標並啟動 `npm start`。公開隱私政策須如實說明 Cloudflare 轉送 Webhook 的角色；測試先用合成搜尋點，不邀請真人試用或宣稱平台隱私查核已完成。

以下是入口操作方式，不是已成功建立 tunnel 的證據。將 `CLOUDFLARED_BIN` 指向已核對的 cloudflared 執行檔；只使用該執行檔，不讀取其他 Bot 的憑證或設定。建立入口前必須確認 localhost:38124 是本專案且未被其他服務占用：正常情況為 live 服務；首次尚無政策網址時，只能先使用下述不具 Bot 功能的政策預覽程序，不能公開 demo。

```sh
env -i HOME="$HOME" PATH="$PATH" "$CLOUDFLARED_BIN" tunnel \
  --config /dev/null \
  --no-autoupdate \
  --protocol http2 \
  --url http://127.0.0.1:38124 \
  --metrics 127.0.0.1:0 \
  --loglevel info
```

此命令不繼承既有 `TUNNEL_*` 設定，不修改家目錄的 Cloudflare 設定，不新增 logfile／trace，也不使用 debug 日誌或 `--no-tls-verify`。若明確的空設定在實際版本不被接受，停止並回報，不刪改既有設定以繞過。

首次網址準備：為避免「live必須先有公開政策，但政策尚無入口」的循環，使用不載入`.env`的短期本機政策預覽程序，只提供兩個固定HTML與安全health，其餘路徑（含Webhook）一律404，不掛載目錄、沒有LINE／Google adapter或任何外呼能力。核對來源後才用同一個已授權tunnel公開草稿供營運者確認；這不是live或demo。取得實際網址、確認政策內容後，停止預覽程序，再由正式live程序接替同一個本機連接埠，核對health與兩頁仍可讀，最後才設定／驗證LINE Webhook。所有正式live授權、設定、原始驗簽檢查保持不變，不用虛構網址啟動。

成功產生網址後，LINE Developers 的 Webhook URL 填入該 HTTPS 網址加 `/webhook`。先做不呼叫餐廳來源的 LINE Verify，再依另行核准的次數進行推薦測試。程式保持原始 bytes HMAC、destination 與私訊檢查；Verify 成功不等於推薦成功。服務與 tunnel 均須保持執行，Ctrl-C 停止；重開 tunnel 後可能需要更新 Webhook URL。這不是固定域名或持續可用的部署。

## 必要行為與限制

### 政策頁準備

服務條款與隱私政策使用 `docs/app/terms.html`、`docs/app/privacy.html`，由同一個 Bot 服務的固定 `/terms`、`/privacy` 路徑提供，不新增託管平台、依賴或檔案瀏覽器。營運者已提供公開名稱 Zona 與聯絡 Email，並在2026-10-06確認採用內容。兩頁公開HTTPS已核對與本機一致；來源回應設定`no-store, no-transform`，避免代理改寫聯絡信箱、注入被CSP禁止的script。這不代表外部法律審查完成。

頁面說明 LINE／Cloudflare 接收與轉送、確認後的位置查詢送往 Google、應用程式不建立位置／查詢歷史，以及短期記憶體控制資料；不承諾刪除第三方或作業系統副本。原一年歷史保存、查閱及刪除功能尚未提供。政策頁不設分析追蹤或第三方資源，但託管及網路供應方仍可能依其政策處理存取資料。

公開前須補實際營運資訊、由營運者確認內容，並核對兩頁能不登入直接以 HTTPS 讀取。屆時 `.env` 的 `PUBLIC_TERMS_URL`、`PUBLIC_PRIVACY_URL` 應分別指向真正的兩頁；暫時入口失效時政策與 Webhook 也可能同時失效，不承諾固定網址或持續可用。產生文件不代表已完成法律審查或來源權利確認。

### Bot 執行邊界

API 固定可信 endpoint，不接受使用者提供來源 URL，redirect 拒絕。Google 限 3500ms／256KiB response；LINE reply 限 2500ms，只送一次；整個 webhook batch 最長 10 秒，最多 20 events。關閉 logging 預設本文與 request 日誌，診斷僅有限分類值，不包含位置、user ID、token 或第三方錯誤本文。

告知狀態 15 分鐘、單程序去重 24 小時加 5 分鐘，兩張記憶體表各最多 4096 筆；timer 每秒清理（最多多留一秒），請求讀取時同步過期，關閉／重啟即失效。容量已滿拒絕新控制資料，不承諾跨重啟或跨程序 exactly-once；事件已領取後失敗也不自動重試。HTTP webhook `processed` 只表示入口已處理，不是 LINE 接受或裝置顯示證據。demo 不應對外暴露。

數量不足包含同 ID 衝突排除，理由只根據距離及來源營業狀態。空清單與錯誤分開；必要欄位／attribution 不完整拒絕整份回應，避免半份壞資料冒充完整結果。不建立檔案、DB、持久 queue 或內容 cache。記憶體處理不等於 OS swap、core dump 或供應方副本已抹除。既有資源未被刪除，歷史相關 FR5–FR9 仍為延後。

## 本機命令

### 一次受控 LINE Demo

受控入口`live-demo.mjs`沿用正式Bot與live設定檢查，只限制本次驗證的來源呼叫：測試地點為臺北車站（中心300公尺內），最多一次Places嘗試，失敗／逾時也消耗額度，併發不多呼叫。請在LINE位置選擇器搜尋公共測試地點，不傳自己的即時所在位置。

必須先核對`line-live-verification.md`的外部剩餘額度；已使用或狀態不明時不得以重啟取得第二次查詢。以下命令只供已核准且尚有一次額度的驗證，不是一般無限制啟動方式：

```sh
npm run build
LIVE_AUTHORIZED=yes node --env-file=.env scripts/u1-lunch-bot/live-demo.mjs
```

本機`.env`的`LIVE_AUTHORIZED`維持`no`，命令只授權當次受控程序；其他來源、費用、憑證與公開政策檢查仍須通過。診斷只顯示嘗試次數、來源結果分類、LINE接受與回覆用途，不記錄使用者、位置、token或訊息內容。`accepted`仍須使用者在LINE Client確認實際呈現，才算完成主要Journey。

### 已核准測試命令

```sh
npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/
npm run test:integration -- --project u1-lunch-bot-integration tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts
npm run test:e2e -- --project u1-lunch-bot-e2e tests/u1-lunch-bot/e2e/lunch-bot.test.ts
npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration --project u1-lunch-bot-e2e tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts tests/u1-lunch-bot/unit/line-interaction.test.ts tests/u1-lunch-bot/unit/messages.test.ts tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts tests/u1-lunch-bot/e2e/lunch-bot.test.ts
npm run build
npm run typecheck
npm run lint
npm run format:check
```

各自檢查 exit code，非零即失敗；safe reporter 不輸出 assertion diff。Coverage 位置 `coverage/u1-lunch-bot/coverage-summary.json`，分母全部 src，空 exclude、門檻 80%，不可縮減。不要執行未帶 selectors 的 integration 來啟動舊 PG 前置。

## CI 與安全交接

CI Pipeline 階段以相同鎖版、`npm ci` 及上述命令建立最小 pipeline；測試 job 不載入真實秘密、不允許付費出口，最小只讀 checkout 權限，未信任 PR 與 secrets 隔離，失敗阻擋合併。這是交接規格，尚未建立 hosted CI 或 push，亦不授權此時安裝工具。

秘密掃描、依賴掃描與適用SAST工具／版本／命令由後續階段明確選定，狀態 **NOT VERIFIED**；不得以無工具／零涵蓋算通過。確認外洩憑證或Critical／High未處理即阻擋合併。指定公共測試點的一次真實LINE／Google推薦及使用者裝置呈現已驗證，該次費用授權已用完；hosted CI、外部法律審查、舊憑證撤銷及負載SLO仍 **NOT VERIFIED**。本機合成MVP、受控真實推薦MVP、原完整歷史版本分別記錄。

## 官方依據

2026-10-06 主工作執行緒以唯讀 HTTP 200 查核：

- [LINE webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)：未修改 raw bytes HMAC-SHA256，缺少或不符簽章先拒絕。
- [LINE OpenAPI](https://raw.githubusercontent.com/line/line-openapi/main/messaging-api.yml)：`/v2/bot/message/reply`、replyToken、1–5 messages、quickReply 及 location action。
- [Google Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search)：POST、field mask、restaurant、1000m circle、DISTANCE、1–20 筆。`currentOpeningHours` 使用 Enterprise SKU，可能計費。
- [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies?hl=en)：有限空間可用 Google Maps 文字標示，並保留所有第三方 attribution；要求公開服務條款與隱私政策。此處引用不等同實際權利核准。
