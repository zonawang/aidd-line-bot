# 構想至細部規劃：文件一致性檢查

## Verification Scope

日期：2026-10-05。檢查範圍是已核准意圖、可行性與範圍，以及本輪交接草案的文件一致性；不包含應用程式測試、帳號登入、費用驗證或法律審查。

方法：逐項比對意圖 → 範圍 → 優先工作，核對可行性及風險依據，並以結構檢查確認檔案、來源引用、表格及 ID 關係。未執行的能力驗證不得因文件檢查通過而標記完成。

## Sources

- [I] `../ideation/intent-capture/intent-statement.md`、`../ideation/intent-capture/stakeholder-map.md`。
- [IQ] `../ideation/intent-capture/intent-capture-questions.md`。
- [F] `../ideation/feasibility/feasibility-assessment.md`、`../ideation/feasibility/constraint-register.md`、`../ideation/feasibility/raid-log.md`。
- [FQ] `../ideation/feasibility/feasibility-questions.md`。
- [S] `../ideation/scope-definition/scope-document.md`、`../ideation/scope-definition/intent-backlog.md`。
- [SQ] `../ideation/scope-definition/scope-definition-questions.md`。
- [H] `../ideation/approval-handoff/initiative-brief.md`、`../ideation/approval-handoff/decision-log.md`、`../ideation/approval-handoff/approval-handoff-questions.md`。
- [A] `../audit/al03034136-329e63002373.md`：上游核准及本輪摘要確認。
- [W] `../aidlc-state.md`：實際執行及略過階段。

## Result

**文件層級結果：PASS WITH WARNINGS（有待辦事項的通過）。** 九項範圍均有上游決策及可行性／限制依據，且都落入優先工作；未發現未經確認擴大範圍或因排程漏掉必做項目的文件矛盾。

這只支持提交立項交接核准及繼續細部規劃。**本階段最終核准待使用者決定；真實技術驗證與試用條件尚未完成。**

## Intent to Scope Coverage

| 意圖或後續明確確認 | 範圍落點 | 檢查結果 |
| --- | --- | --- |
| I：減少同事、親友的午餐選擇障礙 | SCP-01–SCP-03 的位置至餐廳流程；保留試用後定性回饋 | OK |
| I：目標三家、名稱／理由／地圖連結 | SCP-02；一公里及營業例外由 FQ Q2–Q3 補足，不捏造原始意圖的數字 | OK |
| FQ：一年精確位置歷史與本人查閱 | SCP-04–SCP-08；保護、刪除及期限未被降成可選配套 | OK |
| SQ：私訊、可不保存、撤回、單筆及全部刪除 | SCP-01、SCP-04–SCP-06，來源是已確認的後續範圍，不冒稱最初就有 | OK |
| I、FQ：可測試版本，不正式上線或擅自付費 | SCP-09、OUT-05 與 H 的有條件建議 | OK |
| SQ：這版不做的功能及風險優先排序 | OUT-01–OUT-05、LATER-01–LATER-05、INT-01–INT-06 | OK |

## Scope to Feasibility and Backlog

表中可行性依據是規劃層級支持，不是功能已通過真實驗證。

| 範圍 ID | 來源／確認 | 可行性或限制依據 | 工作歸屬 | 結果 |
| --- | --- | --- | --- | --- |
| SCP-01 | I 的 LINE 流程、SQ Q1 | F 的位置訊息能力、C-06–C-09；私訊是縮小互動範圍 | INT-02、INT-03、INT-06 | OK |
| SCP-02 | I Q3、FQ Q2–Q3 | F-02、C-02、V-01–V-02；資料資源仍待驗證 | INT-03、INT-06 | OK |
| SCP-03 | FQ Q3、SQ Q4 | F-03、C-03、C-09、V-02–V-04 | INT-03、INT-06 | OK |
| SCP-04 | FQ Q4、SQ Q3 | C-06 的告知同意與資料保護；未保存／撤回分支由 SQ 明確確認，後續仍須整合驗證 | INT-02、INT-03、INT-04、INT-06 | OK |
| SCP-05 | FQ Q4、Q9–Q10、SQ Q2 | F-04、C-04–C-07、V-05、V-07 | INT-04、INT-06 | OK |
| SCP-06 | FQ Q10、SQ Q2–Q3 | F-05、C-05–C-06、V-05；單筆／全部操作是刪除權利的範圍細化 | INT-05、INT-06 | OK |
| SCP-07 | FQ Q10、SQ 已確認摘要 | C-05、V-06；清除時限與復原規則仍待需求定義 | INT-05、INT-06 | OK |
| SCP-08 | FQ Q4、SQ Q2–Q3、Q5 | C-06–C-09、V-04–V-07；授權、隔離及處理可靠性支援全流程 | INT-01–INT-06 | OK |
| SCP-09 | FQ Q8、SQ Q5 | V-01–V-08、C-08–C-13；不以模擬測試聲稱真實串接通過 | INT-06，彙整 INT-01–INT-05 | OK |

覆蓋：**9／9 範圍項目有決策與可行性／限制依據；9／9 有工作歸屬；6／6 必做工作均可回溯到範圍。** 五組暫緩項目都有 SQ 及 OUT 邊界來源，沒有把它們當作當期必做或下一版承諾。

## Consistency Checks

| 檢核 | 結果與界線 |
| --- | --- |
| 必要上游文件 | 意圖、相關人員、範圍及工作清單存在；可行性、限制與風險紀錄已納入 |
| 有效版本 | I、F、S 均有 A 的正式核准；本輪 H 只有摘要確認，未捏造階段核准 |
| 後續修正 | 一年保存取代的是先前未核准的不留存草案；沒有把舊草案當成現行要求 |
| 數量與例外 | 三家是候選充足時目標，不足／無結果如實回覆；一公里不等於步行距離，營業資訊不等於即時保證 |
| 隱私目的 | 只限本人回顧主動查詢，不背景追蹤；未同意不新增，撤回不冒稱已刪除全部舊資料 |
| 第三方資料 | 一年私人查詢歷史與供應方內容保存權分開，沒有擴大授權 |
| 排程與保護 | INT-04 排在 INT-05 前不等於可先對真人啟用保存；完整保護及必要驗證仍是真人試用前置條件 |
| 未執行階段 | W 略過市場研究、組隊及草圖；H 明示缺乏相關證據，沒有漏報成已完成 |
| 工程與投資承諾 | 無捏造技術棧、帳號、費用、交期、團隊投入、測試成績或上線授權 |

## Warnings and Required Follow-up

| ID | 保留事項 | 後續工作與停止條件 |
| --- | --- | --- |
| WARN-01 | 帳號與資料資源可用性、涵蓋率尚未驗證 | INT-01；真實整合前確認，不能用模擬成功替代 |
| WARN-02 | 個人位置留存、供應方保存權、地區與政策仍須查核 | INT-01–INT-02；歷史內容實作前確認權利，真人試用前完成必要政策處理 |
| WARN-03 | 用量、費用上限、日期與反應時間未知 | 後續需求與工作安排；涉及付費先取得明確金額及啟用授權 |
| WARN-04 | 歷史欄位、失敗查詢、撤回後清除義務、清除時限與備份處置未定 | 需求及設計需先定義可測試條件；未定義不能宣稱完整驗收通過 |
| WARN-05 | 原意圖審查 R-01 仍需落成正式驗收條件 | FQ 已提供一公里／營業狀態答案，需求階段完成條件；不改寫原審查狀態 |
| WARN-06 | 無商業市場、畫面測試或正式團隊排程證據 | 維持日常工具、小規模可測試版本的判斷；若要擴大投資或上線，另行評估 |

上述待辦不阻擋文件層級交接，但各自的行動前置條件不能略過。原 RAID 風險及依賴不因本報告而自動關閉。

## Human Approval

- [ ] Approval & Handoff 的最終核准待使用者決定；本報告不代替核准。
- 後續核准與階段進度以正式決策紀錄為準。本報告是交接提交時點的檢查快照，不自行標記流程完成。

## Assumptions & Open Questions

本次僅核對文件可追溯性與相互一致性；不推定未知資源已存在，亦不宣稱實作、測試、法律查核或正式上線完成。其餘未定事項依 WARN-01–WARN-06 帶入下一階段。
