# 臨時 HTTPS 入口準備

## Authorization

2026-10-06 使用者先答「尚未準備公開網址」，再對下列詢問回覆「同意」：

> 你同意使用 Cloudflare Tunnel 建立測試入口嗎？Webhook 流量會經 Cloudflare 轉送；Google API 費用仍另行確認。

此回答授權準備 Cloudflare 測試入口，不授權 Google 付費查詢、正式上線、沿用其他 Bot 的秘密或取消既有安全限制。沿用已核准計畫 Step 11 的入口準備，不重開 workflow、不改計畫／Testing Contract 或原功能範圍。

## Completed Preparation

- 以工具恢復原 u1-lunch-bot／code-generation 檢查點，未宣告階段完成。
- 找到機器既有 cloudflared 執行檔，`--version` 回傳 `2026.7.3`；只執行版本及 help 查詢，未安裝、升級或讀取其他 Bot 的憑證。
- 確認本專案原先沒有 `.env` 後，建立空白 live 設定範本並設為 `600`；`git check-ignore` 確認不進版控。檔案不納入 source-manifest，也不保存任何真實秘密至成果文件。
- 設定 localhost:38124，三個授權旗標仍為 `no`。沒有啟動 app／tunnel、沒有取得公開網址、沒有呼叫 LINE 或 Google API。
- 操作與安全界線已加入 `docs/app/mvp.md`。該檔已在既有 source-manifest 清單，沒有新增應用程式依賴或修改核心程式。

## Pending Inputs and Next Action

1. 使用者在本機編輯 `.env`，填入專用 LINE channel secret、access token、bot destination 及 Google Places key；不可貼至對話。
2. 確認公開服務條款／隱私網址及其內容，反映 LINE、Google 與 Cloudflare 的實際角色；若尚無網址，明列未具備，不填假網址過啟動檢查。
3. 另取得 Google 必要費用及受控推薦測試範圍的明確授權。Cloudflare 同意不能代替此項；設定 yes 亦非授權證據。
4. 前提齊備後，只啟動本專案 live 服務並核對安全 health，再建立指向該服務的臨時 HTTPS 入口，提供真正的 `/webhook` URL；不公開 demo。
5. 執行 LINE Verify，接著僅做已授權的合成搜尋點流程。保存無敏感值結果後再完成 Step 11 與最終審查。

目前的等待原因是使用者安全設定與外部前提，不是 PostgreSQL／Lima／磁碟問題；不恢復相關診斷，不刪除或搬移舊資料。

## Google Places Setup Update

2026-10-06 使用者明確同意沿用既有 Google Cloud 專案 `line-zona`、啟用 Places API、建立僅限該 API 的專用金鑰，並在其他設定完成後執行最多一次可能計費的合成地點查詢。

- 唯讀查核既有專案記錄及 gcloud 目前專案後，確認專案 ID 為 `line-zona`；當時只有 Vertex AI 在本次查核清單中已啟用。
- 已啟用 `places.googleapis.com` 與建立金鑰所需的 `apikeys.googleapis.com`，沒有變更帳單綁定或執行餐廳查詢。
- 第一把新金鑰因 gcloud 完成輸出包含 `keyString`，立即視為暴露並刪除；沒有寫入 `.env` 或用於 API 呼叫。刪除結果由 Google API Keys operation 成功回報。
- 重新建立 `aidlc-lunch-bot-mvp-20261006-v2`；資源為 `projects/844707654468/locations/global/keys/27952a33-0e1d-48bc-afa6-731a675b3ae8`。唯讀 describe 證明其唯一 API target 為 `places.googleapis.com`。
- 新金鑰值直接寫入權限 `600`、Git 忽略的 `.env`，沒有輸出到對話或成果文件；`GOOGLE_FEES_AUTHORIZED=yes` 只代表上述最多一次的受控合成查詢授權。
- 尚未執行該查詢：LINE secret／token 已在對話中暴露，必須先於 LINE Developers 輪替；原 `LINE_DESTINATION=2010088861` 是數字，不符合 `U` 加 32 個小寫十六進位字元的 Bot user ID。公開條款／隱私網址亦尚未提供。

下一步仍是安全輪替並在本機 `.env` 填入新 LINE secret／token。不可再貼到對話；Bot user ID 可在新 token 可用後，以不顯示 token 的受控 `/v2/bot/info` 查詢取得，或由 LINE Developers Console 填入。

## LINE Setup and Policy Preparation Update

2026-10-06 使用者回覆「已填入」後，進行不輸出憑證的本機檢查及 `GET https://api.line.me/v2/bot/info`：HTTP 200，回傳的 Bot user ID 格式有效。原本設定與該 Bot 不符，已只修正 `.env` 的 `LINE_DESTINATION`。檔案權限600、Git忽略；未將 token、secret 或 key 複製到成果文件。Token 可用不是舊憑證已撤銷或 Webhook 驗簽已通過的證據。

使用者確認沒有公開服務條款／隱私政策，並回覆「沒有 直接幫我做掉」，授權準備政策草稿。採用既有 Bot 服務的兩個固定政策頁，不新增平台或一般檔案瀏覽服務。營運者公開名稱與聯絡 Email 已詢問，尚未取得；草稿不可冒充已核准／已生效政策，也不填虛構網址使 live 啟動通過。

上述歷史段落的「三個旗標no／尚未LINE API呼叫／憑證空白」僅描述當時狀態，最新狀態以上兩節為準。Google 合成查詢額度仍為0/1次；未啟動 live／tunnel、未執行 LINE Verify、未呼叫推薦或 reply。公開政策完成並確認可用後才接續原 Step 11，沒有重啟既有流程或任何 PG／Lima 診斷。

政策草稿與兩個固定路由已完成：`docs/app/terms.html`、`docs/app/privacy.html`，可本機開啟預覽；Webhook增量測試12/12、編譯後路由2/2與build／typecheck通過。仍未發布，不能當成有效公開網址。最短下一步是取得營運者公開名稱／Email及內容確認，再建立真正可存取的HTTPS政策與Webhook入口；不再擴大環境診斷。

## Public Policy Preview — Latest Status

2026-10-06 使用者提供可公開營運者名稱 Zona、聯絡信箱 bear336339@gmail.com，已補入兩頁。這個回答提供營運資訊，尚未明確確認整份政策內容；保留未生效草稿標示。

已建立並驗證兩個真正可讀的臨時HTTPS預覽網址：

- <https://scholars-teenage-finite-stamps.trycloudflare.com/terms>
- <https://scholars-teenage-finite-stamps.trycloudflare.com/privacy>

兩頁均HTTP200，公開回應與本機HTML逐字相同，聯絡信箱可見且沒有注入script，Cache-Control為`no-store, no-transform`。本機來源是臨時policy-preview程序，只提供固定兩頁及安全health，不載入`.env`、不具LINE／Google adapter；`/.env`及`/webhook`實测404，沒有公開demo或停用正式live驗證。正式Bot、LINE Verify、reply及Places查詢仍未啟動，計費查詢仍為0/1次。

入口的QUIC／UDP握手失敗，採cloudflared已驗證可用的HTTP/2替代後成功註冊，未進行網路底層診斷或改防火牆。第一次QUIC入口已停止，不提供其失效網址。Cloudflare預設Email改寫會注入被CSP禁止的解碼script，使用`no-transform`阻止代理改寫，保留原CSP，不放寬安全限制。

目前預覽程序與HTTP/2 tunnel仍執行；工具執行session分別為9521、84301，前一版預覽與QUIC程序已停止。這些是暫時程序，session失效或程序停止後先查health，不把記錄網址當持續可用保證。`/webhook`目前刻意停用，不應填入LINE作正式入口。

下一步：營運者確認兩頁內容後，移除草稿狀態、保留營運資訊，將實際HTTPS網址寫入本機設定並依已有受控授權確認live前提；停止僅政策程序，由正式live接替同一連接埠，核對health／兩頁，先LINE Verify再用一次合成地點完成Client可見推薦。不得把內容確認視為額外計費或真人位置傳輸授權。

## LINE Entrance Enabled — Current Status

使用者已以「可」確認政策內容，並明確要求直接切換既有頻道且不還原。政策已移除草稿狀態，真正HTTPS兩頁200、與本機一致。僅政策程序已停止，正式app的一次查詢受控啟動器接替38124，工具session43996；tunnel仍為84301，不公開demo。

LINE官方Webhook測試成功（API200、success=true、Webhook200），新endpoint設定200且回讀active=true、URL相符。正式新入口：`https://scholars-teenage-finite-stamps.trycloudflare.com/webhook`。原devrel-visit-bot服務／資料未刪改，但這個LINE頻道之後由午餐Bot接收事件。切換前URL與使用者授權保留於`line-live-verification.md`。

現在只等待使用者從LINE Client完成告知確認、傳送一次指定公共測試地點並確認餐廳呈現；Google仍只有一次授權，切換後檢查尚未消耗。若程序曾處理新事件，先讀取安全診斷核對計數，不得把重啟視為追加授權。永久.env保留LIVE_AUTHORIZED=no，當次命令只對受控啟動器設yes。

## Successful Client Journey — Final Verification Status

2026-10-06T07:32Z主執行緒核對source_attempt=1、source_complete=success、recommendation reply=accepted（4則訊息），使用者對收到餐廳與地圖回覆「有」。核心真實Journey成功，不再發送測試查詢。

Google授權已用完1/1，`.env`費用旗標已改回no、LIVE仍no；執行中受控來源也拒絕追加呼叫。Webhook依使用者指示維持午餐Bot、不還原原服務。真正再次Demo必須新授權且核對臨時入口，不能藉重啟刷新額度。詳`line-live-verification.md`；上列待驗證段落只保留當時歷程，不能覆蓋本節最新結果。
