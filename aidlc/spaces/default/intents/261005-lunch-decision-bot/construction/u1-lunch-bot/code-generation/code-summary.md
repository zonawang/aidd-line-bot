# U1 無歷史推薦 MVP：程式與驗證摘要

## Sources

- 使用者以「是」確認先交付無歷史 MVP，並以 `Approve Plan` 核准本輪精確計畫；詳 `mvp-scope-adjustment.md`、`code-generation-plan.md` 與其核准問答。
- 2026-10-06 開發交接及本執行緒獨立重跑的實際命令結果；以下不是由設計文件推算的通過紀錄。
- 官方 API 查核見 `external-api-notes.md`；真實推薦、LINE接受及使用者確認Client呈現的證據見 `line-live-verification.md`。
- 原完整需求、設計、原計畫 `history/pre-mvp/` 及資料均保留，未改寫成完成。

## Delivery Status

**本機合成與一次受控真實LINE推薦MVP均已完成；使用者確認收到餐廳與地圖。原完整歷史版本未完成。**

修訂計畫Steps 1–12已完成：政策、HTTPS入口、LINE官方Webhook驗證、一次Places查詢與推薦reply均成功；使用者對是否收到餐廳和地圖回覆「有」。Places額度已用完1/1，本機費用旗標已改回no，不會自動增加查詢。摘要、manifest與追溯保留本機MVP、真實推薦切片及原完整版本的差異；後續獨立審查與AIDLC檢查依既有流程續接，未合併或正式部署。

2026-10-06 最新設定狀態：使用者在本機 `.env` 填入LINE憑證，Bot資訊HTTP200且destination已修正；LINE官方Verify與真正Client事件通過本機原始bytes HMAC，證明目前secret能驗證此channel事件，但不是舊憑證已撤銷的證據。未輸出秘密，`.env`權限600且被Git忽略。

使用者已分別授權Cloudflare入口、Places專用受限金鑰、一次指定公共測試點的合成位置查詢，並確認政策及切換既有LINE頻道且不還原。上述動作已執行；沒有刪改原Bot服務／資料。執行中的受控程序已耗盡唯一查詢額度，`.env`的LIVE與費用旗標均no，防止意外重啟為可查詢狀態。再次真實展示需新的明確次數／費用授權；本機合成展示不受此額度限制。

## Files Created or Modified

完整清單為 `source-manifest.json`，共 100 個工作區檔案，包含本 Unit 先前的設定／DB／infra 成果，而不只此次 MVP。清單不含框架、memory、產生的 dist／coverage 或真實環境檔。

| 檔案群 | 此次成果 |
| --- | --- |
| `src/app.ts`、`src/config.ts`、`src/main.ts`、`src/demo.ts` | Fastify 路由、設定檢查、安全啟停與可重現合成展示 |
| `src/line-interaction/` | raw bytes 驗簽、私訊及時效驗證、告知／確認／重傳、繁中訊息、LINE reply、短期控制 |
| `src/lunch-recommendation/`、`src/restaurant-source-adapter/`、`src/shared/` | WGS84 距離、去重排序、合成／Google 來源、有限 HTTP／取消及安全結果 |
| 四個新 unit、三個新 integration、一個新 e2e 測試及 `fixtures/mvp.ts` | 核心正常、失敗、隱私及串接邊界 |
| `package.json`、`tsconfig.build.json` | demo／dev／start 指令；ESM .js imports 與可 emit 建置設定，不改型別嚴格度 |
| `.env.example`、`.gitignore` | 無秘密設定範本；忽略真實環境檔與產生的 coverage，範本仍可版控 |
| `README.md`、`docs/app/mvp.md` | 最短展示、live 前提、相同驗證命令與 CI／安全交接 |
| `docs/app/terms.html`、`docs/app/privacy.html` | 使用者已確認採用的繁中政策，營運者及聯絡資訊已補齊，固定 GET 路徑提供 |
| `scripts/u1-lunch-bot/live-demo.mjs`、`live-demo-source.ts` | 正式app的受控驗證啟動器，限制指定公共測試點與一次Places嘗試；不是無上限正式部署 |
| 既有 `db/`、`infra/`、`compose.yaml`、infra scripts／tests | 保留舊成果和原失敗證據，非本 MVP 啟動相依；本次未修復或重啟底層環境 |

## Implementation Decisions

- 單一Node 24.18.0／TypeScript／Fastify程序；無新依賴、DB或VM。真實受控測試使用已授權的Places API與既有cloudflared工具臨時入口，不新增production平台。
- `APP_MODE=demo` 明確合成、只綁 localhost；live 缺必要設定即退出，不默默退回 demo。三個授權旗標只是技術檢查，不能替代真人決策／權利證據。
- 只處理 active 私訊，原 bytes HMAC、destination、結構、前24h至後5min事件窗口。本文上限256KiB、最多20 events；從首次 onRequest 時間扣除本文處理，再共用10秒當次預算。
- 首次位置在未確認時不查來源、不暫存等待；告知實際第三方、只提供當次不保存，確認後必須重傳。歷史相關要求明說本版未提供，不假稱查無或舊資料已刪除。
- 告知15分鐘、事件去重24h加5min；各最多4096筆，只存 HMAC 控制鍵與必要時間／狀態。每秒清理、同步讀取過期拒絕，關閉清空；不承諾跨程序或重啟防重送。
- 固定 Google Nearby endpoint／field mask、最多20候選、DISTANCE、1000m、restaurant。依未四捨五入 WGS84 距離篩選；衝突店家全組排除，營業中優先、未知標示、距離及穩定ID排序，最多三家。
- 只承諾來源此次返回候選的排序，不宣稱全區全量或最近三家。保留 Google Maps／第三方 attribution；不可可靠解析或必要標示無法呈現就失敗，不以錯誤／null回應冒充零結果。
- Google timeout3500ms、LINE reply2500ms，受總期限限制；固定HTTPS、拒絕redirect、來源回應≤256KiB、不重試或push。LINE 200才標accepted，4xx為rejected，無可靠回覆為unknown。
- 關閉 request/body 日誌，診斷只有有限狀態類別；不將位置、原始user ID、本文、token、供應方錯誤本文或秘密寫成歷史／診斷。這不是底層 OS 或第三方資料抹除保證。
- 政策頁僅讀取兩個固定 HTML 資產，沒有目錄掛載或使用者指定檔案路徑；設定 no-store、nosniff、限制性 CSP、no-referrer，不載入第三方資源、不設Cookie。讀取失敗只回503安全分類，不洩漏檔案路徑。Webhook及live設定保護保持不變。

## Validation Results

以下為政策路由新增前，本執行緒在開發交接前後獨立重跑的來源結果；所有測試使用合成資料及受控外部HTTP替身。新增政策路由後的針對性結果另列於下節；未重跑的全量測試與coverage不是最新來源的通過證據。

| 檢查 | 結果 |
| --- | --- |
| `npm run test:unit -- --project u1-lunch-bot-unit tests/u1-lunch-bot/unit/` | 390/390，exit0；包含既有 mock-only 單元回歸，未啟動 PG／Lima |
| 下列八檔完整 MVP coverage 命令 | 72/72，exit0；與上述單元有重疊，不將兩個數字相加宣稱獨立案例總數 |
| 全應用行覆蓋率 | 373/414＝90.09%；18/18個src檔在報告，未遺漏；`src/**/*.ts`、空exclude、80%門檻未變 |
| `npm run build` | exit0 |
| `npm run typecheck` | exit0 |
| `npm run lint` | exit0，零warning |
| `npm run format:check` | exit0 |
| `git diff --check` | exit0 |
| `npm run demo` | exit0；sourceCalls1、replyCalls4、三家合成餐廳；realLineAccepted=false |
| `PORT=38124 npm run dev` + 本機HTTP | health200、mode=demo；四筆正確HMAC的告知→未確認位置→確認→重傳請求均200，診斷均synthetic；已Ctrl-C停止，未留服務 |
| 開發者另驗證 `APP_MODE=demo PORT=32188 npm start` | health及四筆signed HTTP均200，已停止；此列為開發交接證據 |

```sh
npm run test:coverage -- --project u1-lunch-bot-unit --project u1-lunch-bot-integration --project u1-lunch-bot-e2e tests/u1-lunch-bot/unit/lunch-recommendation.test.ts tests/u1-lunch-bot/unit/restaurant-source-adapter.test.ts tests/u1-lunch-bot/unit/line-interaction.test.ts tests/u1-lunch-bot/unit/messages.test.ts tests/u1-lunch-bot/integration/source-boundary.test.ts tests/u1-lunch-bot/integration/webhook.test.ts tests/u1-lunch-bot/integration/line-reply.test.ts tests/u1-lunch-bot/e2e/lunch-bot.test.ts
```

逐層 test-after 順序由開發者交接：推薦／來源先實作並測25案、HTTP邊界9案；再LINE核心及Webhook／reply；最後訊息8案及合成E2E4案。空閒控制清理與首次收件deadline修正後，重新執行相關回歸及上述最終整套測試。

Coverage報告為可重建的 `coverage/u1-lunch-bot/coverage-summary.json`，不進版控。此摘要只保存計數、命令與狀態，不保存真人輸入或秘密。

## Deviations and Remaining Work

### 政策頁增量驗證（2026-10-06）

新增 `GET /terms`、`GET /privacy` 與兩個未生效草稿，沒有新增依賴、外部網站或變更 live 安全條件。開發者回報精確 Webhook 測試12/12、編譯後政策路由2/2、build、typecheck、受影響檔案ESLint／Prettier通過；主執行緒檢查98個manifest路徑均存在且不含`.env`，`git diff --check`通過。涵蓋HTML回傳、安全標頭、讀取失敗不洩漏路徑、目錄／穿越拒絕與原驗簽仍生效。

最終增量包含政策正式採用與一次查詢受控啟動器；25/25入口及來源邊界測試通過。最終八檔MVP coverage重跑81/81通過，383/422行（90.75%），18/18個src檔、空exclude、80%門檻不變。build、typecheck與受影響ESLint／Prettier由開發者通過；未把舊390案單元結果偽稱為本次新增驗證。兩頁HTTPS200且與本機逐字相同，使用`no-store, no-transform`避免代理改寫Email及注入script，CSP不放寬。

真實證據：LINE官方Verify成功、新Webhook已啟用；安全診斷記錄source_attempt=1、source_complete=success、推薦reply=accepted且messageCount=4。使用者確認Client收到餐廳與地圖，Step11完成。沒有保存真實位置、ID、token或餐廳內容，沒有額外計費查詢。

### 保留的未完成義務

- 已授權的交付切片改為無歷史推薦。原FR5–FR9及相關BR／NFR保持Deferred，不使用「停用功能」充當原驗收通過。
- 原全量候選語意改為此次來源返回集合；結果上限明示，不捏造完整性。
- 單程序同步處理的ACK等待推薦／reply，未證明原ACK p95≤1秒或reply p95≤5秒；300筆負載、原完整容量／跨程序保證仍延後，數字未改低。
- 一次指定公共測試點的真實推薦／reply／Client呈現與Webhook驗簽已通過；舊憑證撤銷、對公眾持續營運適用性、法律審查及生產韌性未驗證。費用授權1/1已用完，不開放無上限查詢。
- 必要秘密／依賴／SAST掃描及hosted CI尚未執行；不能視為可合併或正式上線。
- PostgreSQL／Lima問題和旧完整版本測試未解，詳 `known-limitations.md`；不再次以這些工作阻擋已可展示的本機產品。

## Traceability and Next Checkpoint

最新實測狀態詳`line-live-verification.md`：核心真實Journey已通過使用者確認，達成MVP產品完成標準；原始驗簽與live條件未降低。先前驗證表保留為當時快照，最新coverage及增量結果以上節為準；只對此推薦切片收尾，不宣稱原完整歷史Unit需求全部交付。

`traceability.json` 枚舉123個FR／NFR／細項／BR：16個完整本機義務OK，其餘107個Deferred，部分成果另列implemented_targets。Deferred均連到本輪調整與待辦，不刪除原要求；任何本機OK均不構成真實LINE接受、原完整Unit完成或合併授權。

立即重複本機合成展示：`npm run demo`。再次真實LINE展示須依`docs/app/mvp.md`確認臨時入口仍可用並取得新一次額度授權，不能沿用已消耗額度或自動還原旧Webhook。後續AIDLC審查／Build and Test／CI只做適用最小收尾，未做者如實待辦，不重開已完成stage或底層診斷。
