**Collaborator:** aidlc-quality-agent

## Contribution

本次僅為 Step 3 文件獨立審查；四份主筆草稿均已讀取。以下是可供整合的品質建議，沒有新增人類同意、應用測試結果或工具選型。Greenfield 狀態與空白實務模板支持「尚未確認」；框架知識及主筆的工作區盤點不能當成 Bot 已有測試或 CI 的證據。[D][W][M]

1. **區分策略、scope 底線與自願加嚴。** 保留 `Standard`：每元件約 5–8 個測試為軟性指引，單元與關鍵邊界整合測試為基本範圍；數量與金字塔比例都不能排除 SCP-01–SCP-09 的必要驗證。org 的 80% 行覆蓋率及隨附測試 CI 底線列舉特定 scope，不能因本案也是 Standard 就套用到自訂 `line-lunch-decision-bot`。可向訪談提出「應用可測原始碼行覆蓋率至少 80%」作為自願加嚴候選，並列出同意、授權、刪除、重複事件等關鍵分支的行為案例；未確認前不是門檻，確認後不得為通過而降低。量測須包含未執行的應用原始碼，明訂生成碼／依賴／框架檔案等排除項，不能只量已載入檔案或以整體百分比掩蓋權限缺口。工具隨應用語言選定。[M][W][S][F][K]

2. **讓 test-after 逐段閉環。** 建議將 `Ordering` 明確化為：「每個可測層實作後立即撰寫並執行該層測試；相依邊界一旦可連接，即完成其整合測試，再擴充下一段功能，最後執行完整流程驗證。」避免將「逐層完成後」解讀為全部功能寫完才整合。先用合成身分／位置、固定資料與可控制時間驗證推薦和歷史狀態；持久化邊界可用後，補真實選定儲存機制的隔離、刪除與併發測試。外部資源就緒後才補授權下的真實串接。預先寫可觀察驗收情境並不等於採用 TDD；若訪談選擇混合測試先後節奏，依階段契約記為 `custom`，另明示順序。完整歷史保護通過前不開放真人保存。[D][M][P][F]

3. **把 CI 判定寫清楚。** org 的適用 lint 合併前執行、失敗阻擋 PR 已是現行規則，不應與未選定的新檢查一併寫成完全待決。建議的應用合併檢查為可重現安裝／建置、格式／lint、確定性單元與關鍵整合測試，以及採納後的覆蓋率門檻；平台、命令、報告位置與負責人仍待定。關鍵案例失敗或未執行不能以重試後偶然成功、略過或整體覆蓋率抵銷。日常 CI 可使用受控供應方回應；SCP-09 的真實完整流程另保留版本、環境、步驟及去識別結果，未執行即標為待驗證，不能用模擬成功替代。掃描種類與阻擋嚴重度由訪談補定，知識範例不代表工具已啟用。[M][P][K]

4. **按產品風險補齊案例。** 建議將下表追溯至後續需求與驗收條件；目前 `user-stories` 階段略過，仍可直接建立需求 → 案例 → 結果對照。表列是待實作驗證，不是已發現的程式缺陷。[W][P][B]

| 對應範圍 | 建議補充的可觀察驗證 | 適當層級 |
| --- | --- | --- |
| SCP-01–SCP-03 | 私訊／群組與無效位置邊界；一公里內、界線上、界線外；0／1／2／至少 3 家與重複候選；明確休息、停業、未知狀態；理由與地圖對應同一餐廳，供應方逾時／限流／畸形回應不冒充零結果或成功，不暗中擴大半徑 | 規則單元＋入口／供應方介接整合 |
| SCP-04–SCP-05、SCP-08 | 拒絕保存仍可推薦且不新增歷史；同意後本人能看到精確位置與查詢時間；撤回後停止新增；含錯誤路徑的一般日誌與診斷不形成替代歷史，不完整封存未授權供應方回應 | 狀態轉移單元＋持久化／診斷整合 |
| SCP-06、SCP-08 | 使用者 B 對 A 的查閱、單筆刪除、全部刪除均被拒絕；偽造身分／事件來源與群組請求不能洩露歷史；確認刪除的範圍不可遭替換，取消不刪除，重複或過期確認不得擴大刪除範圍 | 授權單元＋入口至資料層整合 |
| SCP-04、SCP-06–SCP-08 | 同一事件重送與併發處理最多建立一筆歷史；撤回／刪除與在途查詢、延遲重送交錯，不得繞過生效規則重新保存或復活已刪紀錄；精確生效切點待需求定義 | 狀態單元＋持久化併發／重試整合 |
| SCP-07 | 每筆各自起算；以受控時間驗證到期前／當下／之後及閏日、時區；新查詢不延長舊紀錄；清除失敗後重試；若有快取／備份等副本，復原後已刪或到期資料不重新可見。讀取不可見與實體清除完成須分別驗證 | 時間規則單元＋清除／必要復原整合 |
| SCP-09 | 授權下的真實 LINE → 資料來源 → 回覆，以及本人歷史查閱／刪除流程；保留拒絕、撤回、跨人拒絕與到期清除證據。長期限與故障以受控時間／注入測試驗證，避免等待一年或要求真實供應方出錯 | 少量完整流程驗證＋自動化證據 |

5. **NFR 驗證採明確需求驅動。** 目前沒有反應時間、查詢量或清除時限數值；Standard 不自動要求完整壓測、長時間 soak 或自動擴縮測試。先在需求階段區分 webhook 接收回應時間與使用者收到推薦的時間，再定義百分位、負載、失敗率及清除時限與量測環境。即使 `performance-validation` 階段略過，後續確立的 NFR 仍須有驗證歸屬，不能視為免驗；也不把角色知識中的雲端、監控產品或範例 SLA 當成選定方案。[W][P][F][K]

## Positions

- AGREE: 草稿明確區分組織預設、產品限制與未確認提案，timestamp 維持 Draft；符合目前證據狀態。
- AGREE: 自訂 scope 不自動承接列舉 scope 的 80% 底線；Standard 與必要隱私／真實流程驗證仍適用。
- AGREE: 合成資料與受控時間先行、真人保存前完成完整保護，是合理且符合範圍的驗證安排。
- OBJECT: `Ordering` 的「逐層完成後」仍可能造成整合延後；應明確規定可連接邊界即測，不等全功能完成。
- OBJECT: CI 阻擋條件不能全數視為可選；既有 lint 規則須保留，新測試及覆蓋率門檻才是待確認提案。
- OBJECT: 現有高階測試清單不足以驗證生命週期交錯；須補入重送／併發、撤回與刪除切點、刪除確認及必要副本復原案例。

## Sources

- [D] 主筆四稿：`aidlc/spaces/default/intents/261005-lunch-decision-bot/inception/practices-discovery/team-practices.md`、`aidlc/spaces/default/intents/261005-lunch-decision-bot/inception/practices-discovery/discovered-rules.md`、`aidlc/spaces/default/intents/261005-lunch-decision-bot/inception/practices-discovery/evidence.md`、`aidlc/spaces/default/intents/261005-lunch-decision-bot/inception/practices-discovery/practices-discovery-timestamp.md`。
- [W] `aidlc/spaces/default/intents/261005-lunch-decision-bot/aidlc-state.md`。
- [M] `aidlc/spaces/default/memory/org.md`（派工逐字規則）、`aidlc/spaces/default/memory/team.md`、`aidlc/spaces/default/memory/project.md`。
- [S] `.codex/scopes/aidlc-line-lunch-decision-bot.md`。
- [P] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/approval-handoff/initiative-brief.md`、`aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/scope-document.md`。
- [B] `aidlc/spaces/default/intents/261005-lunch-decision-bot/ideation/scope-definition/intent-backlog.md`。
- [F] `.codex/aidlc-common/stages/inception/practices-discovery.md`、`.codex/aidlc-common/protocols/stage-protocol-ensemble.md`、`.codex/aidlc-common/protocols/stage-protocol.md` §8 Test Strategy。
- [K] `.codex/agents/aidlc-quality-agent.md`；已載入 `.codex/knowledge/aidlc-shared/` 九份與 `.codex/knowledge/aidlc-quality-agent/` 四份 Markdown，採用其中規則讀取、測試策略、測試資料與 NFR 驗證指引。active-space 對應兩個知識目錄不存在；上述均為方法資料，不是應用實證。

## Assumptions & Open Questions

- **實務訪談**：確認 `Methodology`／`Ordering`、是否採納自願 80% 行覆蓋率、量測分母／排除項與關鍵案例清單；不重新詢問是否需要既定隱私保護或把它降為選配。
- **CI 與測試責任**：補定必跑檢查、失敗處置、偶發失敗的修復責任與期限、報告留存；確認誰提供受控資料／環境及完成真實整合證據，缺資源時維持待驗證。
- **生命週期需求**：定義一年曆年／時區／閏日、到期不可見與實體清除時限、撤回對在途事件的生效切點、既有資料義務、失敗查詢保存規則、刪除確認有效範圍及必要副本處理。這些未定值會直接決定斷言，不代填數字或設計。
- **NFR 訪談**：確認受邀試用量、尖峰查詢量、可接受回覆時間與失敗率、清除時限，以及可用的測試費用／配額；不從角色知識推導任何已承諾 SLA。
- 本次沒有執行應用測試、CI 或外部服務查核；建議不構成新增硬規則，也不修改主筆草稿、記憶或流程狀態。
