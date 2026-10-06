# LINE 受控實測

## Authorization and Boundaries

2026-10-06 使用者對公開服務條款／隱私政策是否可採用回答「可」。營運者為Zona，公開聯絡信箱依使用者提供；政策內容核可不代表外部法律審查已完成。

唯讀LINE設定檢查發現頻道Bot ID為`@920ksdcl`，原啟用中的Webhook為`https://devrel-visit-bot-3sv3zqjszq-de.a.run.app/webhook`。詢問是否會影響原Bot後，使用者明確回答「<直接切換，測試後也不用還原」。此回答授權將該頻道切換為午餐Bot，不自動還原；不刪除原服務、程式或資料。

Google費用授權仍僅最多一次指定合成地點查詢；不因頻道切換或政策核可而擴大。指定臺北車站作測試地點，使用者在LINE位置選擇器搜尋並選取該公共地點，不傳自己的即時所在位置。受控入口限制搜尋點在測試中心300公尺內、最多一次Places嘗試（失敗亦消耗），先完成LINE真正Webhook Verify再由Client執行。

## Preconditions and Runtime

- 已有可讀HTTPS政策，使用Cloudflare HTTP/2臨時入口；網址及程序資訊見`temporary-https-setup.md`。
- 本機`.env`已填真正政策URL並確認來源前提；永久`LIVE_AUTHORIZED`維持`no`，只在受控程序啟動命令為該次已授權測試設`yes`，避免一般`npm start`默默開放無上限真實查詢。
- 受控程序沿用正式app、原始bytes驗簽、destination、私訊、告知確認／重傳與正式reply。只對來源加測試地點與一次額度限制，不改正式推薦演算法，不放寬安全檢查。
- 程序只保存記憶體計數及必要控制狀態，不保存位置、身分、reply token或Google回應。重啟不是新授權；啟動前必須核對下列計數，已用或不明時不得重啟為可查詢狀態。

## Evidence Status

- LINE `/v2/bot/info`：HTTP200，destination符合設定。
- LINE 原Webhook設定：HTTP200，`active=true`；上述URL為變更前實測值（2026-10-06T07:21:32Z）。
- LINE 新Webhook Verify：官方`POST /v2/bot/channel/webhook/test`指定新endpoint，HTTP200、`success=true`、`statusCode=200`。首次使用禁止Places與reply的驗證程序；換為真正受控Demo後再次由LINE測試，結果同樣成功。均為真正簽章空事件，不是完整推薦成功。
- LINE 新Webhook設定／啟用：`PUT /v2/bot/channel/webhook/endpoint`回傳HTTP200；唯讀回查HTTP200、`endpointMatches=true`、`active=true`。新URL為`https://scholars-teenage-finite-stamps.trycloudflare.com/webhook`，依使用者授權取代原devrel-visit-bot，不自動還原。
- Google Places實際查詢：**1/1次，已用完**；程序回報`source_attempt: attempts=1`、`source_complete: outcome=success`。
- 推薦LINE reply接受：兩次guidance回覆均accepted，接著recommendation回覆accepted、messageCount=4（推薦摘要與三家餐廳訊息）；沒有保存回覆本文。
- Client呈現：使用者對「有沒有收到餐廳推薦和地圖連結？」回覆「有」。結合上述程序證據，指定公共測試點的核心真實LINE Journey通過。

後續只記錄狀態、次數及非敏感摘要；不保存真實Webhook本文、位置、使用者ID、回覆token或秘密。未知／失敗不得當作成功，也不自動重試計費查詢。

## Completed LINE Client Verification

受控程序工具session為43996、HTTP/2 tunnel為84301，兩者持續執行；僅政策程序及驗簽專用程序均已停止。入口與政策共用目前臨時網域，電腦／程序停止時無持續可用保證。

最小增量驗證：來源邊界13案、Webhook12案，主執行緒合併執行上述兩個精確selectors，25/25通過；開發者另通過build、typecheck及限定ESLint／Prettier，無真實API測試呼叫。沒有重跑PG／Lima或新增依賴，原coverage門檻不變。

使用者已完成告知確認、傳送指定公共測試地點並確認推薦與地圖呈現。2026-10-06T07:32Z核對程序安全診斷及使用者回答，達成此次MVP「真正LINE Client完成主要推薦流程」的產品完成標準；不代表一年歷史版本、正式部署或AIDLC所有後續檢查已完成。

唯一一次Places授權已消耗，執行中的source wrapper拒絕追加呼叫；本機`.env`的`GOOGLE_FEES_AUTHORIZED`已改回`no`，`LIVE_AUTHORIZED`仍為`no`，避免重啟誤用舊授權。沒有停止或還原使用者指定保留的新Webhook；若需要再次真實Demo，先取得新的明確費用／次數授權，不能自行重啟重設額度。`npm run demo`仍可不限次進行不外呼的本機合成展示。

最後MVP精確coverage selectors重跑81/81通過，全18個src檔共422行、383行covered（90.75%），空exclude及80%門檻不變；不啟動PG／Lima，也不以此取代尚未完成的安全掃描或hosted CI。
