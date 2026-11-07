# Nova Kitchen Lab

A connected restaurant demonstration for exploring customer arrival, preparation, packing verification, delivery and operational recovery. Two Macs are enough; no new hardware is required.

## Hosted testing

Start in **Customer** for a first-person walk to the counter and ordering. **Kitchen** prepares and verifies the same live ticket; **Owner** oversees service, stock and AI recommendations. The existing Dinner Service entrance is preserved.

The workspaces are **Experience**, **Delivery**, **Inventory**, **Scenarios** and **Operations**. Operations separates prep planning, team/capacity, finances/receipts and packing/camera controls. Forms and participant positions survive workspace changes. Scenarios includes shared pause, scrubbing and 0.5×–4× playback controls.

Open the same private hosted Site on both Macs and sign in with allowed accounts. These are demonstration perspectives, not separate permission levels. All views use one persisted restaurant and poll the live endpoint after each previous response, approximately every 400 ms.

Fresh or reset restaurants start with **zero orders**. Refresh and deployment preserve existing orders. Use the explicit Owner inventory reset to clear live tickets and restore resources; saved drills remain.

See the [professional demo walkthrough, screenshots, validation and deployment steps](docs/PROFESSIONAL_DEMO.md).

## Run locally

Requires Node.js 22.12+ and npm.

```bash
npm ci
cp .env.example .env
# Optional: add your own OpenRouter key to .env. Never commit this file.
npm run dev
```

Open `http://localhost:3000`. Simulation, manual packing, fixtures, QR codes, and pickup checks work without an AI key. AI explanations and image analysis use a server-side OpenRouter key.

To share one server across both Macs, run `npm run dev:lan`. The terminal prints the team URL to open on the second Mac. Both devices need a network that permits device-to-device traffic; venue guest networks may isolate devices. The hosted site avoids this requirement. Use a trusted LAN; this is not a public multi-tenant restaurant service.

For a production build, run `npm run build` and `npm start` (or `npm run start:lan`). Camera access over plain LAN HTTP may be blocked; use the host Mac at localhost, the HTTPS hosted site, or a photo upload.

## Included

- Shared persisted orders: received, preparing, packing, ready, collected.
- Interactive restaurant scene, collision-aware walking, customer menu, station tasks, and item-by-item simulated packing.
- Ingredient reservations, staff skills, equipment availability, and explicit blocked states.
- Absence, shortage, equipment-failure, and six-order-rush scenarios.
- Fixed assignments versus cross-trained recovery under identical starting conditions.
- Saved snapshots, deterministic replay, shared animated playback, and explicit drill restart.
- Manual packing counts, labeled fixtures, and optional AI image verification with red/amber/green outcomes.
- AI explanations of computed results; review commentary alongside the authoritative comparison.
- Revision checks that prevent silent concurrent overwrites and applying stale plans.

## What is simulated

Orders, recipes, staff, stock, durations, preparation, and disruptions are sample data. Station preparation takes two seconds per station and represents a manual simulation action, not a measurement of cooking time. Required station completion is saved on the shared order; packing begins after all required stations are complete. Drink-only orders use the packing station. Original detailed controls can still advance preparation directly.

Player paths and live packing counts are published through a separate shared presence table, independent of kitchen revisions. Other views animate those paths using server-synchronized time. Presence expires after 20 seconds without a heartbeat; closing a view removes its participant. The unfinished bag is controlled by its kitchen tab and broadcast for observation. Reopening or leaving a packing mission clears it; check it again before handoff.

Menu quantities follow the limiting ingredient after queued-ticket commitments and other cart items. The server rechecks the entire cart and rejects overselling. Accepting a ticket consumes its physical ingredients once. Minus removes one, × clears an item type, and Clear all empties the cart or bag. Queued tickets can be edited or cancelled; accepted tickets are locked.

The full-width **Delivery simulator** has its own Delivery tab on Owner and Kitchen. On other role pages it appears below the restaurant floor and shrinks to a slim bar until a delivery order exists. Select an order tab to follow its courier and complete the handoff or receipt steps; the Demo screen remains read-only.

Delivery is an accelerated simulation with fictional destinations: Maple House (1.2 km, 18 game seconds), Park House (2.8 km, 30 seconds), and River House (4.5 km, 45 seconds). A ready bag triggers a six-second courier approach. A matching-reference pickup starts the persisted trip; arrival enables explicit receipt confirmation. Pickup and delivery are distinct statuses. Refreshing or opening another device keeps the same clock. These are illustrative ETAs, not routing or traffic estimates.

Replay is a forecast animation and does not advance live orders. The model assumes one task per station and worker, fixed recipe durations, all-or-nothing ingredient reservation, and earliest-due work first. Same-recipe units within one ticket are scheduled as one station batch so large orders do not create thousands of tasks. It is a heuristic comparison, not a globally optimal scheduler.

Camera checks evaluate visible components, not hidden ingredients, food safety, or sealed-bag contents. Game bags, manual counts, and fixtures are labeled and are never described as AI observations. Pickup uses an order-specific, single-use reference. The app does not place real orders, charge customers, or dispatch couriers. An impossible shortage/outage remains unresolved.

## Optional iPhone check

Use an iPhone paired with a Mac through Continuity Camera, choose it under **Kitchen -> Packing & camera -> select a packing order -> Start camera**, capture one frame, and choose **Analyze image with OpenRouter**. Alternatively transfer a JPEG from the iPhone to the Mac and use **Upload photo**.

Keep items visible on a tray before sealing the bag. Try a labeled/recognizable burger, two distinct fries portions, and a readable Sprite can. Unmarked containers or cups should produce uncertainty. Holding the phone for a still photo works; no dedicated mount is required. Camera capture is user-started and requests no microphone. Nova does not save frames; an image is sent to OpenRouter only when analysis is requested.

## Development and hosting

Run `npm test` and `npm run build`.

The React/Vite client uses one portable Fetch API backend (`server/api.mjs`). Local mode persists to ignored `.data/state.json`. The hosted Worker uses D1 with revision-checked shared storage; migrations are under `drizzle/`. Client assets are embedded in the Worker, with no external client CDN.

`OPENROUTER_API_KEY` belongs in local ignored `.env` or hosted runtime secrets. It is never returned by the API or included in the client bundle. `OPENROUTER_MODEL` defaults to `google/gemini-2.5-flash`.

Existing repository connection-test files are preserved and are unrelated to the app.

## AI operations and restocking

Owner and Kitchen organize AI tools into Prep, Inventory, and Team tabs. Owner also has Finances, including receipt upload. Live split view keeps AI operations below the game. Owner receives a top-of-page alert when uncommitted stock reaches three units or less, an up-to-date AI estimate exceeds available stock, or someone opens a restock request. These are shared **in-app** messages; no email, SMS, supplier integration, or purchase is sent.

- **Preparation copilot:** ranks current tickets and explains starts/holds/blockers. Start prep validates the plan version, ingredients, and qualified capacity again. Recommendations are advisory; no cooking happens automatically.
- **AI packing check:** at the game packing bench, expand AI camera packing check. Use an iPhone camera/photo or Mac camera. The vision model counts only visible food/package identities; obscured or uncertain evidence cannot seal a bag. A human confirms a fresh matching check. Game bag counts remain a separately labeled deterministic test.
- **Inventory copilot:** estimates additional next-30-minute ingredient demand from the current demo snapshot, then opens owner requests where stock is insufficient. Sparse history means this is an AI estimate, not a trained demand forecast. Threshold alerts work without any AI calls.
- **Staff copilot:** describe a known worker absence or equipment outage in plain language. AI parses it; the deterministic simulator produces qualified coverage and remaining blockers. Review the comparison before applying; a stale scenario cannot apply.
- **Financial assistant:** explains completed simulated orders, current sample menu prices, estimated ingredient costs, reviewed receipts, and explicitly logged waste. Contribution excludes labor, tax, rent and fees; it is not actual net profit. Prices are demo assumptions. Reviewed USD receipt lines update matched unit cost estimates; other currencies stay separate.
- **Receipt extraction:** choose a JPEG/PNG/WebP receipt photo, explicitly send it to AI, review/edit the draft, then save. Images are not stored. Saving a receipt does not increase stock. Match receipt quantities to the ingredient unit first.

To demonstrate restocking on two Macs: open Kitchen on one and Owner on the other. In the Owner Inventory tab, expand **Record waste or simulate a shortage**, choose an ingredient, and select **Simulate stockout**. The shared alert appears immediately. Kitchen can request units, or **Forecast & request stock** can create an AI owner request. Owner records full or partial received quantities; stock and menu availability update on both Macs. A request is not an actual supplier order.

No new equipment is required. The server needs `OPENROUTER_API_KEY` with credits/access to the selected models (the hosted demo already has the supplied key). Task defaults are GPT-6.1 Terra for prep/inventory, Claude Opus 5.5 for staffing/financial explanations, and Gemini 4 Argon for packing/receipt vision. See `.env.example` for per-task overrides. Model identifiers were checked against the live OpenRouter catalogue at implementation. Key credentials remain server-side; analysis buttons make real paid requests, while screen polling and threshold alerts do not call AI.

For the optional phone demo, photograph a well-lit tray before closing the bag or upload a readable receipt photo. No continuous camera feed, new webcam, or third Mac is needed. Real demand forecasting would need historical timestamped POS data, delivery ETAs and lead times; real margin reporting would need real prices and cost records. This MVP intentionally labels the demo assumptions.
