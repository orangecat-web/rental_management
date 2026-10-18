# 租務管理 / Rent_Demo

Vue 房客、收租、電表與照片工作區。現有測試站：https://orange-rental-desk.orangecat1120.chatgpt.site/

## 開始開發

```sh
npm ci
npm test
npm run dev
```

本機預覽使用假資料；不讀取真實 Google 帳務、不執行真實寫入。

房型可選「套房／雅房」，舊資料保留未設定；Google 後端更新方式見 [房型設定](docs/ROOM_TYPES.md)。

簽約日與初始電表的第一期帶入規則見 [初始電表](docs/INITIAL_METER.md)。

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
