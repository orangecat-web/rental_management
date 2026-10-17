# Rent_Demo — Codex 接手文件

## 先讀

AGENTS.md → README.md → docs/DEPLOYMENT.md。

這份文件取代對整串聊天歷史的依賴。此專案目前的原始碼倉庫是 Sites 內部來源倉庫，尚不是使用者 GitHub repository。要在 Codex Cloud 接手，先把原始碼放入使用者的 GitHub 私有倉庫並選取該 repository/environment；本機 Codex 則可以直接開啟下載後的專案資料夾。

正式測試網站：https://orange-rental-desk.orangecat1120.chatgpt.site/

## 已有功能

Vue 原生房間總覽、房客資料、學生標記、合約資料夾連結、年度/月帳務、收款 checkbox/人工差額、多收抵扣/未收累計、整月抄表/照片、匯款截圖多張配對、奇數月電費通知 JPG/ZIP、租金月季年圓餅圖、全房用電及各房年度小圖。

每房年度小圖固定 1/3/5/7/9/11 六期，同一單位共用縱軸。桌機 2 間/列、寬螢幕 3 間/列、手機 1 間/列；字體至少 16px。原用電區展開比較與單房區獨立單期比較都保留。

房租與用電報表分開。租金統計截止至目前月份，不提前混入未來月份；年度用電按已建立的各期顯示，缺值不算 0。

## 本次新增的權限與登入

- worker/permissions.mjs：每項 RPC 的 read/write 宣告，未宣告預設拒絕。
- worker/auth.mjs：原 Sites 驗證身分、Cloudflare Access RS256 JWT 驗證；角色由 server email allowlist 決定。
- public/access-session.js：取得 session 才開始私有資料讀取；共用唯讀 Vue directives。
- 檢視者不能新增、修改、初始化、新建月份或改照片配對，但可讀照片、篩選、看報表/通知。
- 外部登入由 Cloudflare Access + Google 管理，程式不保存密碼、不實作第二套 OAuth session。
- 認證設定或外部帳號尚未接上時 fail closed。外部 Google 登入尚未做真實帳號端到端驗收；目前只能驗證簽章、角色、請求與 UI 的自動化測試。

## Google 資料與程式

- 房客試算表 tenant_data，分頁「房客資料」。
- 年度帳務 rental_accounts_2026，月份 tab 用數字，例如 9/10/11/12。年 ID 放 Apps Script Properties，前端動態讀取。
- 照片分匯款和電表主資料夾，各自再分兩位數月份。支援 jpg/jpeg/png/webp；電表 ROOM.ext 或舊 ROOM_MMDD.ext；匯款支援 ROOM-1.ext、ROOM-2.ext，多張由人工確認。
- 目前包含使用者授權的 Demo 假資料。不要把所有數字視為真實租務情況，不要以寫入真實資料作測試。
- 完整 live Apps Script 在 Google 的 Rent_Demo，不完整存在本 repo。已知 live source 延伸包含 TenantData、RentalAccounts、MonthlySetup、BillingYears、NoticeData、PaymentPhotos 等。此 repo 的 SiteBridge/CashSettlement/StudentStatus/MeterPhotos 是已採用延伸；Code.gs/Config.gs/Index.html 是舊 starter。
- 原 HMAC secret 只在兩邊 runtime，維持原值。本文件不保存 secret 或真實個資。

## 驗證

執行環境：Node.js 24、npm；通知 ZIP 的獨立驗證使用 Python 3（python 指令需可用）。

```sh
npm ci
npm test
npm run build:cloudflare
```

測試含真實 RSA 簽章、過期/錯 issuer/AUD/偽造 header、檢視者寫入在到 Google 前被擋、登入前不讀資料、所有編輯區唯讀、照片正常讀取，以及既有帳務/通知/匯款/用電報表回歸。

npm run dev 是本機假資料預覽，不能代替外部 Google 登入驗收。Sites hosted build 是 npm run build（需 bash），外部/Windows 建置使用 npm run build:cloudflare。

## 下一步

1. 確認使用者的 GitHub 私有倉庫名稱/帳號並推入原始碼。
2. 確認 Cloudflare 帳號、正式網址、team domain、Access app AUD 和主要管理人的 Google email。
3. 按 DEPLOYMENT.md 配置 Google IdP/Access allow policy 和本機部署設定，再接上原 Google server secrets。
4. 用真實管理人與檢視者各驗收一次，再切換正式使用網址。
5. 第三階段才做日常支出。尚未實作支出、不做 LINE 自動通知、不做照片旋轉；更細的逐房權限/人員管理頁留待需要時擴充。

## 可貼給 Codex 的起始任務

「這是租務管理專案，請先讀 AGENTS.md、README.md、docs/CODEX_HANDOFF.md 和 docs/DEPLOYMENT.md，執行 npm ci、npm test、npm run build:cloudflare。保留既有 Google 資料和 HMAC 連線、16px 字體、default-deny 權限。先回報目前缺少哪些正式部署設定，完成後再接 Cloudflare Access + Google 的真實登入驗收。不要重新建立整個系統，也不要用舊 Apps Script starter 覆蓋 Rent_Demo。」
