# GitHub + Cloudflare 獨立部署

> GitHub Pages 僅用於獨立的假資料唯讀展示版，設定方式見 README.md「GitHub Pages 展示版」。本文描述需要登入及 Google 串接的正式版本，不能改用靜態 Pages 取代後端。

## 已準備完成與尚未接上的部分

程式已支援：管理人/檢視者、逐項 API 權限、登入前資料閘門、唯讀介面、Cloudflare Access JWT 驗證、登入/登出入口、跨平台建置與部署前檢查。

目前正式網址仍在 Sites，使用原有 ChatGPT 登入和 owner-only 門禁。外部 Google 登入尚未啟用，也尚未建立 GitHub 倉庫、Cloudflare 應用程式或搬移 Google 資料。這份流程是在個人 Cloudflare 帳號啟用獨立版本時使用。

## 1. 程式碼放入 GitHub 私有倉庫

建立私有 repository，放入本專案原始碼。不要上傳 node_modules、dist、.env、.dev.vars、deploy/cloudflare.local.json 或任何 Google/Cloudflare 金鑰。GitHub Actions 的 ci.yml 只執行檢查，沒有自動公開網站或寫入 Google。

本系統包含驗證和 HMAC API，只有 public/ 靜態頁無法完整運作。Pages workflow 僅部署 `dist/pages-demo/` 的虛構唯讀版本，不能部署正式資料與設定。

## 2. 準備 Cloudflare 網址與 Access 應用程式

1. 在自己的 Cloudflare 帳號準備一個可使用的自訂網域，例如 rental.<自己的網域>。需要該網域可在 Cloudflare 綁定 Worker custom domain；此階段請勿為了測試任意改動既有主站 DNS。
2. 在 Zero Trust 建立 team，記下完整 team domain，例如 my-team.cloudflareaccess.com。
3. 建立 Self-hosted Access application，涵蓋租務網站整個 hostname 和所有路徑，包含 /api/*、/auth/*、通知頁與照片請求。
4. Access policy 只允許明確指定的管理人與檢視者 email。不要設定 Everyone 或 Bypass；VIEWER_EMAILS 不會自動替你新增 Access policy。
5. 記下該 application 的 AUD tag；不是帳戶 ID、Worker ID 或 Google client ID。
6. 建議 session 8 小時。移除人員時，同時移除應用程式角色清單與 Access allow policy，並撤銷該人的 Access session。

## 3. 接上 Google 登入

依 Cloudflare 官方 Google IdP 步驟，在 Google Cloud 建立 Web OAuth client。

- Authorized JavaScript origin：https://<team>.cloudflareaccess.com
- Authorized redirect URI：https://<team>.cloudflareaccess.com/cdn-cgi/access/callback
- Client ID 和 Client Secret 填到 Cloudflare Zero Trust 的 Google identity provider；不要貼到聊天、前端或本 repo。
- Access application 選用 Google 作為登入方式，先用官方 Test connection 測試。
- Google 登入用來確認「使用網站的人」；Apps Script 執行帳號仍負責存取試算表/雲端。兩者不需要是同一個 Google 帳號。

## 4. 建立部署設定

複製 deploy/cloudflare.example.json 成 deploy/cloudflare.local.json，填好：

| 欄位 | 用途 |
| --- | --- |
| routes[0].pattern | 正式 hostname，不含 https:// |
| vars.PUBLIC_ORIGIN | 正式 HTTPS origin，不含結尾 / |
| vars.ACCESS_TEAM_DOMAIN | Access team domain，不含 https:// |
| vars.ACCESS_AUD | 這個 Access application 的 AUD |
| vars.MANAGER_EMAILS | 管理人 email，逗號分隔 |
| vars.VIEWER_EMAILS | 檢視者 email，逗號分隔，可留空 |

AUTH_MODE 必須維持 cloudflare-access。workers_dev 和 preview_urls 維持 false，避免產生其他未納入門禁的網址。manager 清單優先，但部署檢查會拒絕兩個清單重複的帳號，請明確分類。

```sh
npm ci
npm test
npm run build:cloudflare
npm run check:deploy
```

## 5. Cloudflare Secrets 與發布

在自己的終端機登入 Cloudflare，勿將 token 貼到聊天。

```sh
npx wrangler@4 login
```

在 Cloudflare Worker 設定兩個 server secret：RENTAL_APPS_SCRIPT_URL、RENTAL_BRIDGE_SECRET。使用目前已授權的 API URL/金鑰，不要產生新的金鑰覆蓋舊連線。可在 Worker 後台設定，或使用：

```sh
npx wrangler@4 secret put RENTAL_APPS_SCRIPT_URL --config deploy/cloudflare.local.json
npx wrangler@4 secret put RENTAL_BRIDGE_SECRET --config deploy/cloudflare.local.json
npm run deploy:cloudflare
```

若首次 secret put 要求先建立 Worker，先建立同名 Worker，再設定 secrets；在 secrets 和 Access 未就緒前，不以可用的正式環境交付。缺少 secrets 時資料 API 會拒絕連線，不會改用公開試算表。

Cloudflare 執行登入/權限及 HMAC gateway，靜態資源透過 ASSETS 傳遞。Google 試算表與照片維持原本位置，不必重建。

## 6. 上線驗收

- 管理人可操作既有寫入功能；檢視者可查詢、切月、看照片/圖表，但寫入 API 必須回 403，Google 不收到該寫入。
- 未登入或未授權帳號不能讀取任何房客/帳務資料。
- 偽造 oai-authenticated-user-id/email 不會通過外部部署；只有有效 Access JWT 才能進入 API。
- 確認憑證的 issuer/AUD/到期時間與簽章都驗證；更換角色後重新登入/讀取確認。
- 確認 /auth/logout 經 POST 同源驗證後導向應用程式的 /cdn-cgi/access/logout。Access 的登出可能影響同一 team 的其他 Access 應用程式，不會登出整個 Google 帳號。
- 原 Sites 仍保留，等新網址驗收完成再切換日常使用。

## 官方參考

- Google IdP：https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/google/
- JWT 驗證：https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- Session/logout/AJAX：https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/
- Workers static assets：https://developers.cloudflare.com/workers/static-assets/
