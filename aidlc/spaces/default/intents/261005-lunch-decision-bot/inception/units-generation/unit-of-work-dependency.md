# 午餐決定器 LINE Bot：單元依賴

## Sources

- `unit-of-work.md`：唯一單元 U1／u1-lunch-bot、kind service、責任及部署邊界。
- `units-generation-questions.md`、`decomposition-plan.md`：統一問答中的單一應用選擇、既有計畫核准及保留的計畫附錄。
- 整理後的完整摘要以「Looks correct」確認，紀錄 `4c7e04f0919e74ca90ea0f0dc58216ee60cd2a25e96eba5b30c042d72cdd706f`；依同一份統一摘要及不變的計畫重新保存本文件。
- `../domain-design/components.md`、`../domain-design/decisions.md`：內部元件呼叫、資料歸屬及失敗語意。
- `../requirements-analysis/requirements.md`：全部功能／非功能要求及待驗證外部條件。

## Dependency DAG

此 YAML 是單元直接依賴的機器可讀來源；箭頭語意若有邊即為「A depends on B」，不是資料流或施工順序。唯一單元列一次；沒有其他 Unit、未宣告目標、自相依或循環。

```yaml
units:
  - name: u1-lunch-bot
    kind: service
    depends_on: []
```

| Unit ID | Directory / YAML name | Kind | Depends On |
| --- | --- | --- | --- |
| U1 | u1-lunch-bot | service | 無 |

文字圖及等價說明：

```text
[ U1 : u1-lunch-bot : service ]
```

圖中一個節點、零條跨 Unit 邊；所有本專案程式責任在此單元內。沒有 Unit 相依不代表沒有外部服務、儲存或觸發依賴，也不代表功能已完成。

## Integration Points

### 跨單元整合

不適用：沒有第二個 Unit，因此不設跨 Unit API、共享資料庫存取或持久事件通道。不額外產生 spec／library／packaging 單元；契約、測試與 CI 隨 U1 交付。這不免除內部介面及 LINE／來源整合契約。

### U1 內部元件介面

| Caller | Callee | 當次互動／契約責任 | 必須保留的限制 |
| --- | --- | --- | --- |
| LineInteraction | DataPrivacy | 許可判定、設定、本人歷史保存／查閱／確認刪除及清除狀態 | 每次核對本人；保存最後授權與寫入需一致；確認已存／確定未存／不明分開；不可直接操作其儲存 |
| LineInteraction | LunchRecommendation | 已允許處理位置的推薦或真實故障結果 | 接收／回覆期限、取消與部分成功由互動元件協調，不讀個人歷史、不推播 |
| LunchRecommendation | RestaurantSourceAdapter | 當次候選、來源失敗、未知狀態及必要標示 | 有效空結果不同於整份回應不可判讀；不擴圈、不將完整來源回應存成歷史 |

這三條邊全部是元件層級而非 Unit 層級，仍無循環。共同部署不消除清楚介面、輸入驗證、錯誤分類及邊界測試；完整型別、訊息及一致性契約交由 Contract Design。

### 外部與執行環境依賴

| 依賴能力 | U1 內負責元件 | 整合與驗證界線 |
| --- | --- | --- |
| LINE Messaging API | LineInteraction | 驗證事件來源、私訊與可靠本人，分開處理接收、LINE 接受回覆及裝置送達；回覆憑證有效性、故障及重送待驗證 |
| 合法餐廳來源（待選型） | RestaurantSourceAdapter | 只傳當次必要搜尋點，不傳本人識別或歷史；核對類型、穩定店家識別、營業／地圖資料、條款及標示 |
| 事件中繼資料儲存（待選型） | LineInteraction | 不保存位置或原始訊息；有限期限去重／回覆狀態，期限到後仍不接受失效重送 |
| 權利／歷史儲存（待選型） | DataPrivacy | 最小欄位、本人隔離、最終保存一致性與刪除界線；全部可控複本／自動備份須符合不可見及清除要求 |
| 可信清除觸發（待選型） | DataPrivacy | 不含位置的觸發驅動清除，不能延後到期即不可見；不是本輪另建的應用 worker，也不新增持久位置佇列 |
| 受限診斷與維護告警（待選型） | LineInteraction、DataPrivacy | 限必要狀態與量測、授權人員存取；最長 30 天且不得洩漏位置、完整訊息、原始使用者 ID 或秘密；不向使用者推播 |

表列的是能力需求，不是已選產品、已開通資源或新增應用 Unit。LunchRecommendation 沒有直接外部依賴；推薦資料只由 RestaurantSourceAdapter 取得。若後續要以新獨立應用部署某能力，須明確修訂單元拓撲，不能只改這張表而繞過確認。

## Data Ownership and Failure Boundaries

- 所有實體擁有者與引用沿用 `unit-of-work.md` 的九實體表；HistoryWriteControl 引用 LineEventReceipt 的代碼不產生反向呼叫或授權旁路。
- 當次位置與來源候選不因共同部署而變成共享持久資料；未保存位置只在當次記憶體存在，完成或十秒到達即釋放，尚未告知的位置不得暫存等選擇。
- 查詢前設定完全不可確認即停止；已知不保存仍可推薦。查詢後保存不明仍如實回覆、不盲目重試；撤回、刪除、到期及延遲提交不得復活歷史。
- 即時不可見不等待清除排程；實體清除在生效後 24 小時內完成全部可控內容，並保留真實清除失敗狀態。元件同處一個應用不自動保證此性質，須在後續設計及故障測試證明。

## Parallel Development Opportunities

只有一個 Unit，沒有跨 Unit 獨立集合可供多單元平行施工，亦沒有多種跨單元排序需要選擇。元件內測試或工作拆分不是新增 Unit，不能據此切換已記錄的 unit-major／serial 工作方式。

本文件只定義拓撲，不指定跨 Unit 推薦實作順序或關鍵路徑；單元內增量安排見 `unit-of-work-story-map.md`。既定合成資料薄切片慣例不等於啟用 skeleton 儀式；有效 scope 未宣告該開關，本階段不補寫或重組流程。

## Assumptions & Open Questions

具體 runtime／執行個體數、來源、儲存、清除觸發、安全與取消／重試機制尚未選定。後續契約及設計須維持所有要求與這一個 Unit 的邊界；若不可行，回報需修訂之處，不增設隱藏依賴或虛構資源已就緒。本文件沒有外部整合、性能或隱私測試已通過的主張。
