# Rental workspace development guide

Read README.md, docs/CODEX_HANDOFF.md and docs/DEPLOYMENT.md before changing this project.

## Product rules
- Traditional Chinese UI; every visible font is at least 16px. Preserve the original green/white design.
- Room IDs and available years/months come from Google data. Keep 0 distinct from missing values; preserve leading zeros in phones and bank suffixes.
- Electricity is billed in odd months: (current reading - previous reading) × 5. Previous readings/dates come from the preceding electricity cycle; do not copy previous photos. These existing business rules should move into validated configuration when adding pricing options.
- 504 and 505 are independent rooms/notices. 506 has rent 0 and still pays electricity.
- Receipt confirmation is explicit. Screenshots/dates do not auto-confirm new receipts. Partial receipts are human-entered. Credits/debt recompute without duplicate carry.
- Rent reporting allocates FIFO: old claims, current rent, then current electricity. Later payments settle original rent cohorts. Never sum recurring cumulative debt across months.
- Annual room charts show six billing periods with one shared scale; desktop 2–3 cards per row, phone 1. Missing readings remain unknown.
- No private records, photos or login tokens in localStorage, source, exports, logs or URLs. Do not auto-retry uncertain writes.

## Architecture
- Shared interface features must be synchronized between the production UI and the fictitious Demo, including fixture data and read-only checks. Follow docs/DEMO_SYNC.md; keep production records, connection settings, secrets and access lists out of the public Demo. Preserve each repository's newer independent changes.
- public/ contains the Vue workspace. Edit google-tenants.html and google-accounts.html for native editor source; scripts/build-native-workspace.cjs generates native-*.js and native-editors.css. Do not hand-edit generated files.
- worker/permissions.mjs is default-deny RPC policy. New actions must declare read/write there and pass worker/api.mjs argument validation. Every write requires server-side manager authorization.
- worker/auth.mjs provides Sites identity and independently verified Cloudflare Access JWT identity. External workers never accept Sites identity headers. Missing settings/unknown accounts fail closed.
- public/access-session.js checks session before any private read. Reuse v-write/v-write-field for write UI; retaining server checks is mandatory. Read-only photo viewing must remain available.
- Cloudflare Access + Google owns external login/cookies/logout. Do not add passwords or a second OAuth/session implementation. Verify issuer, AUD, signature and expiry server-side.
- The active Apps Script project is Rent_Demo. apps-script/Code.gs, Config.gs and Index.html are historical starter files, NOT the complete live project. Do not reinstall them or replace the real live project.
- Google HMAC secret stays on the server and in Apps Script Properties. Never copy it into this repo or a frontend .env variable.

## Builds and release
- npm ci; npm test; npm run build:cloudflare is the cross-platform external/Codex workflow.
- Current hosted Sites uses npm run build and dist/server/index.js; preserve .openai/hosting.json and its project identity. It remains owner-private. Do not create a replacement Site.
- External entry is worker/cloudflare.mjs with deploy/cloudflare.local.json (ignored); run npm run check:deploy before npm run deploy:cloudflare.
- GitHub Pages is permitted only for the separate fictitious, read-only demo built by npm run build:pages and verified by npm run test:pages. Never publish real tenant records, Google configuration or credentials to Pages. The production application requires its authenticated backend; never deploy it as static-only Pages.
- Never change sharing, add viewers, configure real cloud resources or migrate production data without the user's concrete instruction. User-authorized development/deployment within the current existing scope can continue autonomously.
- Test the changed behavior and relevant regressions, build, and check mobile layout. Use fake fixtures for writes. Do not "test" by changing real tenants/payments.
