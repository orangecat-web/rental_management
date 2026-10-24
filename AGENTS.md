# Rental workspace development guide

Read README.md, docs/CODEX_HANDOFF.md and docs/DEPLOYMENT.md before changing this project.

## Product rules
- Traditional Chinese UI; every visible font is at least 16px. Preserve the original green/white design.
- Room IDs and available years/months come from Google data. Keep 0 distinct from missing values; preserve leading zeros in phones and bank suffixes.
- Electricity is billed in odd months: (current reading - previous reading) × 5. Previous readings/dates come from the preceding electricity cycle; do not copy previous photos. These existing business rules should move into validated configuration when adding pricing options.
- 504 and 505 are independent rooms/notices. 506 has rent 0 and still pays electricity.
- Receipt amounts require explicit human confirmation. A saved room/month screenshot association can exclude unconfirmed rent, but cannot confirm or infer cash. Filename candidates and dates do not count. Partial receipts are human-entered. Credits/debt recompute without duplicate carry.
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

## Third acceptance round authorized 2026-10-20
- Confirmation may propose the selected receipt's due amount into an empty client draft, including odd-month electricity and explicitly identified deposits. Preserve manually entered amounts and 0. Only an explicit save writes cash; no read-time backfill. Deposits remain outside rent income.
- Checkout may adjust one explicitly selected existing billing month after an amount preview. Support free, daily (rental-cycle days anchored to lease start; checkout day inclusive), and a manually entered amount. Preserve electricity, bank cash and all other months; invalidate affected confirmation if due amounts change. Never recreate Xingwu history.
- Property management creates independent private databases, signs and validates the property scope on every RPC, and archives removals. Keep original public statistics fixed to the original property. New-property month creation must not relax the original Xingwu 2026 November/December prohibition.
- Tenant ID, address, birthday and guarantor data are private, not persisted client-side or included in public statistics. Public Demo uses invalid synthetic IDs and keeps all writes denied.

## Same-lease name correction authorized 2026-10-20
- Saving a tenant name updates the tenant record only. Billing names change only after a manager previews the current lease and explicitly checks the individual months; default selection is empty. Unchecked months, explicit vacancies and other lease periods remain unchanged. This supersedes automatic same-lease name propagation.
- Previously changed names use a room/lease/month preview and manager confirmation with tenant and preview version checks. Only the selected names change, with an internal stable identity marker on new accounts to prevent a display-name correction from changing debt calculations; all money, receipt evidence, allocations and checkout history remain intact. No automatic retries or read-time source writes. The fictitious Demo remains read-only.

## Production-number snapshot authorized 2026-10-24
- The owner explicitly approved production financial numbers with synthetic personal information for this readonly Demo. The private production site retains real people; anonymous/Pages/acceptance use fake people.
- Only the allowlisted demo/production-numbers.json may contain production-derived amounts, room IDs, meter values/dates and opaque anonymous cohort keys. Do not copy source names, contacts, notes, suffixes, private configuration, credentials, Drive references or photos.
- Preserve this repository's existing workflows, standalone room/initial-meter checks, fake personal fixtures and readonly/offline API boundary. The snapshot adds no live Google or private Worker connection.
