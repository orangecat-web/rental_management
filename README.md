# 租務管理 / Rent_Demo

Vue 房客、收租、電表與照片工作區。現有測試站：https://orange-rental-desk.orangecat1120.chatgpt.site/

## 2026-10-24 已驗收介面同步

管理元件完整顯示，修改功能停用；房產設定及預覽可查看，版面與正式站一致。見 [完整 Demo 介面](docs/DEMO_FULL_UI.md)。

本展示站使用正式帳務數值的去個資快照，姓名、電話、地址、租約與照片仍為示範資料；只可瀏覽，不會連線 Google 或修改正式帳務。快照來源與更新方式見 [資料說明](docs/PRODUCTION_NUMBERS_DEMO.md)。

## 開始開發

```sh
npm ci
npm test
npm run dev
```

本機預覽使用假資料；不讀取真實 Google 帳務、不執行真實寫入。

房型可選「套房／雅房」，舊資料保留未設定；Google 後端更新方式見 [房型設定](docs/ROOM_TYPES.md)。

簽約日與初始電表的第一期帶入規則見 [初始電表](docs/INITIAL_METER.md)。

每月應繳日期預設為當月 10 日，僅供參考；實際收款日期可早於或晚於 10 日。既有帳務日期保留，缺漏日期只在讀取／顯示時帶入預設，不回寫歷史資料。

## 部署

### GitHub Pages 展示版

```sh
npm run build:pages
npm run test:pages
```

獨立輸出至 `dist/pages-demo/`，使用 15 間虛構房間與 2026 年範例帳務，僅供瀏覽；不連接 Google、不保存修改、不需要任何金鑰。正式版本不會載入 demo transport。

GitHub repository → Settings → Pages → Source 選 **GitHub Actions**。推送 `main` 後，`Deploy fictitious Pages demo` workflow 會測試、建置並部署展示版，也可由 Actions 手動執行。若尚未啟用 Pages，先完成上述設定，再重新執行 workflow。預設專案路徑為 `/rental_management/`；公開網址以部署結果為準。私有 repository 是否可使用 Pages 取決於 GitHub 方案；請勿為此自行變更 repository 可見性。Pages 網站的存取範圍與 repository 可見性不同，展示內容全部使用假資料。

以下為正式版本的部署方式：

- 現有 Sites：npm run build，保留 .openai/hosting.json 的 project_id，使用原私人站台。
- 外部 GitHub + Cloudflare：npm run build:cloudflare；依 docs/DEPLOYMENT.md 設定 Google/Access 與 server secrets，再執行 npm run check:deploy、npm run deploy:cloudflare。
- GitHub Actions 另提供假資料 Pages demo；單純上傳 public/ 不能取代正式版本的後端 gateway。
- Codex 接手先讀 AGENTS.md 與 docs/CODEX_HANDOFF.md。

## 結構與安全

- public/：原生 Vue 工作區、照片/通知/報表。native-*.js 和 native-editors.css 由 google-*.html 建置產生。
- worker/permissions.mjs：RPC 的 default-deny 角色權限；viewer 只能讀，manager 可使用既有寫入功能。
- worker/auth.mjs：Sites 原門禁，以及外部 Cloudflare Access JWT 驗證。角色清單、AUD、issuer 都由 server 設定，前端不能指定角色。
- worker/api.mjs：授權後驗證參數，再 HMAC 呼叫 Apps Script。金鑰不進前端、不寫 localStorage、不自動重送不確定的寫入。
- worker/cloudflare.mjs：獨立部署入口；Sites 編譯入口是 worker/index.js，兩者認證模式不可混用。
- apps-script/：已使用的延伸檔及歷史 starter；不是完整 live Rent_Demo。請勿直接全部覆蓋 Google 專案。

畫面最小 16px，資料與照片留在 Google，角色與登入憑證由伺服器驗證。現有 Sites 保持 owner-only；尚未新增房東帳號，外部 Google 登入需依部署文件完成帳號/網域設定後驗收。

共用功能同步規則見 [Demo 與正式版同步](docs/DEMO_SYNC.md)。身份選單為「未標記／一般／學生／管理人」，公開 Demo 保持假資料唯讀；房客身份不賦予網站權限。

2026-10-20 第三輪共用介面與多房產展示，見 [docs/ACCEPTANCE_V3_DEMO.md](docs/ACCEPTANCE_V3_DEMO.md)；只使用假資料，全部寫入維持禁止。


2026-10-28：同步[每月支出唯讀展示](docs/MONTHLY_EXPENSES.md)。支出與收據為獨立假資料，原租金／電表快照不變；可檢視明細及 Lightbox，寫入與上傳停用。
