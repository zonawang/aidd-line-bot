# CI 執行證據

## Sources

2026-10-06 在目前工作區實際執行 `npm run ci`、`node --check scripts/u1-lunch-bot/ci.mjs`、`git diff --check`，以及缺少npm／合成secret canary的負向驗證。不是由設計文件推估或由舊Build and Test結果複製的本次成功。

## Final Pipeline Run

命令 `npm run ci`，exit0。七項job全部passed：

| Job | Actual |
| --- | --- |
| format | exit0 |
| lint | exit0 |
| typecheck | exit0 |
| build | exit0 |
| unit | 390/390；failed0、incomplete0、errors0 |
| mvp-coverage | 81/81；failed0、incomplete0、errors0 |
| demo | exit0，synthetic |

最後一行安全聚合：

```json
{"event":"pipeline_complete","pipeline":"local-mvp","status":"passed","checks":7,"coveredLines":383,"totalLines":422,"lineCoverage":90.75,"sourceFiles":18,"minimumLineCoverage":80,"mergeReady":false,"securityScans":"unverified","hostedCI":"unverified","productionReady":false}
```

Vitest原設定include全部src/**/*.ts、exclude=[]、lines80。runner另驗18/18個src TypeScript檔案在實際coverage report，使用未四捨五入比例判斷80%，顯示截尾兩位與Vitest一致。原始coverage可由此命令重建，保持Git-ignored；重疊suite不相加計算unique tests。

## Failure and Output Check

用Node child process啟動同一個runner，給不存在的PATH及合成LINE/Google秘密環境canary。預期與實際皆是runner exit1、pipeline status failed、固定npm-unavailable/version-mismatch分類、mergeReady=false，stdout/stderr未包含canary。驗證腳本exit0。僅保存此結果，不保存canary原值或環境快照。

node語法檢查及git diff --check皆exit0。首次pipeline執行同樣全過，但顯示90.76（四捨五入）；為與Vitest的90.75顯示一致做了一行顯示修正，再跑上述最終pipeline通過。沒有改門檻、分母、產品原始碼、測試或任何權利保護。

## External and Promotion State

本次完全local/synthetic：沒有讀取外部.env、LINE/Places外呼、PG/Lima、dependency install、scanner download/scan、hosted CI、artifact upload、push/merge或deployment。必要scanner／hosted CI仍Unverified，原完整版本phase check仍NOT-READY；本機配置成功不放行合併或上線。
