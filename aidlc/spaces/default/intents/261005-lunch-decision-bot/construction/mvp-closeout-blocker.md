# MVP 收尾狀態

記錄日期：2026-10-06。Development priority changed to MVP-first / Time-to-MVP optimization.

## 最新狀態：本次 RFC #662 阻塞已解除

使用者明確同意將兩個非應用原始碼檔案原檔搬到專案外，並核准外部目錄存取後，已以同一檔案系統的 rename 搬至 `/Users/al03034136/.config/aidd-line-bot/runtime-20261006-H5MJFp/`。沒有讀取、複製或輸出 `.env` 內容；前後 device、inode、size、mode 相同，`.env` 仍為 600，新私密目錄為 700。`.DS_Store` 也完整保留。

`.gitignore` 原有的 `.env` 與 `.DS_Store` 規則保持有效，兩者原先均未受 Git 追蹤。沒有變更產品程式碼、source manifest、既有審查證明、基準快照或安全設定，也沒有修改安裝中的 AIDLC。

搬移後 `aidlc engine orchestrate report --stage code-generation --result awaiting-approval` 成功。AIDLC 接受既有原始碼審查，無需新增 bounded recovery review；接續的 `next` 明示 `gate_only: true`，要求呈現既有審查而非重新執行階段。目前等待 Code Generation 核准，Build and Test／CI 尚未完成。

這是本案經授權的檔案配置 workaround，並非框架 bug 已修復。先前「必須先外部修復框架才可繼續」的結論已被這次成功結果取代。若 Finder 重建專案根目錄 `.DS_Store`，或重新建立根目錄 `.env`，同一檢查仍可能再出現，不得宣稱已有永久性的 framework exclusion 修正。

本機設定檔新位置及啟動界線見 `local-runtime-location.md`。下方保留先前問題調查歷史，不代表最新狀態。

## 已驗證成果

- 真實 LINE Client 推薦成功的既有證據：`u1-lunch-bot/code-generation/line-live-verification.md`。本次沒有新增真實外呼。
- 2026-10-06T07:50:25Z 的 Unit 檢查證明：離線 `npm run demo` 與指定 E2E 測試正常結束，4/4 測試通過，exit 0；Unit checkpoint 已核准。
- 上述離線測試使用合成來源，不能視為新增真實 LINE／Google 驗證。
- Google 試用查詢額度 1/1 已用盡；不得重啟受控 runner 以重設額度。再次真實查詢須取得新的明確費用授權。

## Known Limitation：AIDLC 收尾檢查互相衝突

Code Generation 的階段完成檢查把 Git 已忽略的 `.DS_Store`、`.env` 列為未登記的應用原始碼變更，要求加入 Unit source manifest 後補審查。

依該提示嘗試只加入路徑時，審查請求卻拒絕 `.DS_Store`，理由是 Git 忽略檔不能當作 source-review evidence。請求未成功，未派出 reviewer，也未形成新的審查結論。已撤回本次新增的兩個 manifest 路徑，回復原有清單；没有變更兩個本機檔案本身。

`aidlc doctor` 顯示 0 problems、2 advisory warnings，沒有提供此衝突的可行修復。問題尚未解決；不推測底層根因，不進行框架原始碼深入診斷。重複報告完成不會修復此問題，因此停止重試。

## 安全邊界與後續

- `.env` 保持 Git ignored、未追蹤及 mode 600；沒有輸出憑證或把內容加入 artifacts。`.DS_Store` 也仍是未追蹤忽略檔。
- 不刪除或搬移本機資料，不取消忽略規則，不降低 guards，不手改審查證明或 workflow state，不虛報完成。
- 既有程式、設計、測試與真實 Demo 證據均保留。原一年歷史功能仍為 Deferred，非已交付。
- 待框架提供能區分 Git 忽略的本機設定與受審原始碼的受支援修復方式，再從現有 checkpoint 繼續；不重啟 intent。
- Build and Test 與 CI Pipeline 尚未完成。安全掃描、託管 CI、外洩憑證撤銷狀態仍不得記為通過；沒有合併、push 或正式部署授權。

## 2026-10-06 使用者要求修復後的確認

- 使用者在外部終端機執行 `aidlc engine state unpark` 成功；依原 checkpoint 恢復，沒有重新建立 intent 或重做 stages。
- `.codex/tools/aidlc-state.ts` 的 `baselineUnclaimed` 以階段起始檔案清單與目前清單的差異計算未歸屬變更；`aidlc-lib.ts` 的 `filesystemSourceIdentity` 會把本機一般檔案納入指紋，包括這兩個檔案。
- 同一個 library 的 `ignoredSourceClaimReason` 會拒絕未追蹤、未明確登記的 Git 忽略檔。兩條路徑使用不同的歸屬範圍，造成目前的衝突。
- 修復不應全面忽略 `.gitignore` 涵蓋的原始碼，也不能刪除檔案、降低 guards 或重寫既有證據。應在框架維護環境統一歸屬範圍，並保留變更指紋、受追蹤檔、符號連結、明確登記來源及 Git 查核失敗時拒絕放行的控制。
- 目前 `aidlc` 是 2.10.0 的 native 編譯版，核心命令使用編譯進執行檔的 delegates；只改專案的 TypeScript 副本不能宣稱 native 問題已解決。
- `aidlc update --check` 回報 `update refresh unavailable; cached version 2.10.0 is stale or unverifiable`，exit 3。沒有安裝新版本，沒有略過下載驗證。
- 嘗試新增本機檔案歸屬判定 helper 時，在任何寫入前被 PreToolUse 拒絕：installed enforcement files 必須透過官方 updater 或執行中代理以外的 external terminal 維護。此次候選修補未落地、未測試、未生效；不能宣稱修復完成。
- 後續需要在獨立的 AIDLC 框架維護環境完成修補、回歸測試與 native build，再以支援的方式更新。本專案保留全部現有成果，不繼續反覆試寫受保護的檔案。
