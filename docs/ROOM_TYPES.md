# 房型：套房／雅房

「房客資料」的房型下拉選單提供套房、雅房；未分類的舊資料保留「未設定」，也可清空選擇。房間總覽同步顯示房型。房型屬於房間資料，不會改變租金、學生身分、帳務與電費計算。

GitHub Pages 為唯讀假資料展示，包含兩種房型與尚未設定的範例。

## 更新既有 Google 後端

此 repo 不包含完整的 live Rent_Demo，不能整包覆蓋或安裝舊 starter。

1. 備份既有 Rent_Demo 程式。在原 Apps Script 專案新增 `RoomType.gs`，貼上本 repo `apps-script/RoomType.gs`（網站下載版為 `public/downloads/RoomType.gs.txt`）。
2. 本版 `SiteBridge.gs` 同時包含初始電表功能；請一併依 `docs/INITIAL_METER.md` 安裝 `InitialMeter.gs`，再將原 `SiteBridge.gs` 更新為本 repo 同名檔。保留既有 TenantData、StudentStatus、CashSettlement 等程式與所有指令碼屬性。
3. 更新原「Rent_Demo 網站 API」部署至新版本，維持原網址、HMAC secret 與既有存取設定；不要新建金鑰或另一套資料。
4. 正式網站須使用本版前端與 Worker，才能讀寫房型。僅更新 GitHub Pages 不會更新正式 Google／Cloudflare／Sites。

讀取不會新增欄位或填入預設房型。管理人第一次明確儲存房型時，才會在「房客資料」分頁末端新增「房型」欄；若欄位已存在則沿用。僅接受「套房」「雅房」或空白；保留原值比對、鎖定、公式與合併儲存格保護。檢視者無法寫入。

開發測試使用虛構試算表資料，不應為了驗證而修改真實租客或帳務。
