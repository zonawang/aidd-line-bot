# 本機 Runtime 設定檔位置

2026-10-06，依使用者明確核准，原檔搬移如下；本文件不含設定值或 secret。

- 設定檔：`/Users/al03034136/.config/aidd-line-bot/runtime-20261006-H5MJFp/.env`，權限 600。
- macOS metadata 保留檔：`/Users/al03034136/.config/aidd-line-bot/runtime-20261006-H5MJFp/.DS_Store`。
- 包含兩個檔案的私密目錄權限為 700；搬移使用同檔案系統 rename，不是複製後刪除。
- 專案根目錄不再有 `.env`。不要把上述檔案複製回來，也不要把 secret 加入 Git 或 source manifest。

## 無外呼的本機驗證

`npm run demo` 不依賴該設定檔，仍使用合成來源；未修改 Bot 程式或 npm scripts。

## 後續啟動設定

既有文件中的根目錄 `--env-file=.env` 已不適用這台機器。未來經授權啟動時，改為明確指定 `--env-file=/Users/al03034136/.config/aidd-line-bot/runtime-20261006-H5MJFp/.env`，其餘應用參數不變；不要修改設定值以繞過安全或費用授權檢查。原本的 `npm start` 不會自動載入這個專案外設定檔。

此次沒有重啟任何服務，也沒有新增真實 LINE／Google 呼叫。受控 Google 查詢額度 1/1 已用盡，不能透過重啟受控 runner 重新取得額度；再次真人 Demo 需要新的費用／查詢次數授權。普通 app entrypoint 不取代受控 runner 的單次及地點限制。

## 已知限制

`.gitignore` 仍排除 `.env`、`.DS_Store`；目前 framework 的 source baseline 檢查不是單純依 `.gitignore` 決定，所以這是配置 workaround，不是永久修復 framework。macOS 若重建根目錄 `.DS_Store`，應先確認狀態並保存檔案，不得無限重試、刪資料或降低 guards。
