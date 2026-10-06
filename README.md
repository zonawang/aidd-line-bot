# 午餐決定器 LINE Bot — 無歷史 MVP

Node.js 24.18.0／npm 11.16.0、TypeScript、Fastify 單程序。沿用現有 lock 與已安裝依賴，不需 Docker、PostgreSQL 或 VM。這個切片尚未提供歷史保存、查閱、刪除或撤回功能；既有歷史需求及原資料資源仍保留待辦。

## 成果與交接

2026-10-06，本次 MVP 的 AIDLC workflow 已完成 19/19 階段；真實 LINE 核心推薦流程已完成一次受控驗證。本機 CI 七項檢查通過，應用原始碼行覆蓋率 90.75%。原完整歷史版本、必要安全掃描與正式上線仍未就緒，workflow 完成不代表合併或 production 放行。

- [MVP 最終成果報告](aidlc/spaces/default/intents/261005-lunch-decision-bot/mvp-final-report.md)：交付內容、驗證結果、限制及各階段證據入口。
- [執行與 Demo 指引](docs/app/mvp.md)：離線展示、runtime 設定與真實 LINE 測試授權界線。
- [本機 CI 指引](docs/app/ci.md)：執行 `npm run ci`，不載入秘密、不外呼 LINE／Google。

## 最快展示

```sh
npm run demo
```

命令建置後透過 Fastify 的 HTTP 注入入口，執行真實 raw bytes HMAC 驗簽的「文字告知 → 尚未確認的位置 → 確認 → 重傳合成位置 → 三家合成推薦」。只輸出 synthetic 摘要與虛構推薦，不連 LINE／Google，不代表真實 API 接受或装置顯示。展示中未確認的位置不查詢來源。

啟動可接 HTTP 的本機服務：

```sh
npm run dev
```

強制 `APP_MODE=demo`，監聽 `127.0.0.1:3000`，以 Ctrl-C 停止。`GET /health` 顯示模式及停用歷史；`POST /webhook` 仍必須驗簽。demo secret 是公開合成值，demo 不可當作對外入口。

使用建置產物與明確設定：

```sh
npm run build
APP_MODE=demo npm start
```

目前的本機 live runtime 設定已移到專案外，請勿在專案根目錄重建 `.env`，也不要將秘密貼到聊天或放進 Git。再次 live 啟動需要新的明確費用／次數授權，並顯式指定外部 env-file；未設模式、缺必要 live 設定即失敗。完整設定與檢查見 [MVP 執行與交接](docs/app/mvp.md)。

## 推薦與資料界線

- 只處理有效、active 的 LINE 私訊；原始 bytes HMAC-SHA256、256 KiB 本文限制、事件前 24 小時至後 5 分鐘、當次最長 10 秒。
- 初次告知不保存歷史；確認前的位置立即放棄，確認後重傳才查詢。控制狀態只留短期 HMAC 代碼與時間／階段，不保存位置、本文或回覆 token，重啟失效。
- 在來源此次回傳的候選中，依未四捨五入的 WGS84 距離 ≤1000m 篩選、排除休息／停業、營業中優先、距離及穩定 ID 排序，最多三家。同 ID 衝突全數排除。
- Google Nearby Search (New) 一次最多 20 筆，並非全區所有餐廳或全區最近三家保證。未知營業狀態明示；不足／零結果與授權、格式、故障、逾時分開。
- 顯示 Google Maps 及回傳的第三方 attribution，不快取供應方內容。LINE 接受僅指 HTTP 200，不保證使用者裝置顯示；拒絕／結果不明不重送或 push。

## Live 前提與費用

2026-10-06 已完成一次真實 LINE → Google Places → LINE 推薦流程，使用者確認收到餐廳與地圖連結；公開政策與臨時HTTPS入口已建立。這是指定公共測試點的受控驗證，不是永久部署或一年歷史版本完成。**唯一一次計費查詢授權已用完，不能直接重啟或繼續查詢**；再次真實Demo需新的明確費用／次數授權，依 [受控Demo指引](docs/app/mvp.md) 操作。本機 `npm run demo` 不外呼、不消耗此額度。

真實執行仍須合法憑證、來源／顯示權利、政策、HTTPS入口及相應資料／費用授權；`yes`旗標不是法律或費用核准證據。現有臨時網址隨程序停止而可能失效，不承諾持續可用。

**`currentOpeningHours.openNow` 會使用 Google Places Enterprise SKU，可能產生費用。** 先確認帳號、配額及費用授權，再啟用 live；本機 demo 與測試不會呼叫付費 API。來源失敗不擴圈、不換來源、不降回 demo。

## 驗證狀態

精確測試命令、合併前檢查及未驗證項目見 [MVP 執行與交接](docs/app/mvp.md)。全 `src/**/*.ts` 行覆蓋率門檻維持 80%，未載入檔案仍計入。既有 PG integration 未修復、未改成通過；本機 MVP selectors 不啟動它。

原環境文件 `docs/app/database-layer.md`、`local-storage-assessment.md`、`setup-status.md` 保留供歷史切片使用，並非目前 MVP 前置。歷史生命週期、重型負載／production SLO、主機全媒體抹除、秘密／依賴／SAST 掃描及 hosted CI 未由本機展示證明。
