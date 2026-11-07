# Nova Kitchen Lab

A playable hackathon prototype for testing how orders, shortages, staffing, packing, and pickup connect. Two Macs are enough; no cameras or hardware purchases are required.

## Hosted testing

New and reset restaurants start with **zero orders**. Orders appear only when a customer places one or you explicitly apply a rush challenge. Refreshing preserves the shared restaurant; use **Reset for another round** to clear live tickets and restore resources. Saved drills remain available and can restore their recorded snapshots when explicitly restarted.

Every view has an expanded **How this page works** guide with its role, steps, controls, and explanation of what syncs. Collapse it once you know the flow.

Open the deployed site on both Macs. All views share one persisted restaurant. The client polls the lightweight live endpoint every 400 ms after the previous response; synchronized movement paths and courier timestamps animate between updates:

- `/?view=owner`: overlook the restaurant floor, choose challenge cards, and play fixed versus recovery plans.
- `/?view=kitchen`: walk to the ticket pass and cooking stations, assemble a bag item by item, and verify it before handoff.
- `/?view=customer`: walk in, choose from the menu, wait for the kitchen player, collect with a matching reference, and leave.
- `/?view=display`: read-only restaurant floor, live tickets, courier trips, and scenario playback.
- `/?view=split`: Customer and Owner together, with separate controls and shared moving players.

Use **WASD / arrow keys** to walk freely without focusing the floor; typing in form fields never moves your player. Click-to-walk and destination markers are optional, and a manual step interrupts an automatic walk. Customer ordering, pickup, and leaving do not require an exact location or force a route. The direction arrow suggests a destination. **E** opens the customer menu or collects a ready pickup; kitchen actions still use their stations. In split view, click a player panel or the **WASD: Customer / Owner** buttons to choose which player the keyboard controls. The mission panel gives the next action. Original dashboards, resource controls, QR codes, and optional camera checks remain under **Detailed controls & optional camera**.

Sites hosting is private by default. Each viewer must sign in with an account allowed to view the Site. Role tabs are demonstration perspectives, not separate permission levels. All viewers work in the same restaurant.

**Mac 1:** owner and kitchen tabs. **Mac 2:** customer view. Put the display view in any spare window. See [the two-Mac test script](docs/TESTING.md).

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
- Interactive restaurant scene, collision-aware walking, customer menu, station tasks, and item-by-item game packing.
- Ingredient reservations, staff skills, equipment availability, and explicit blocked states.
- Absence, shortage, equipment-failure, and six-order-rush scenarios.
- Fixed assignments versus cross-trained recovery under identical starting conditions.
- Saved snapshots, deterministic replay, shared animated playback, and explicit drill restart.
- Manual packing counts, labeled fixtures, and optional AI image verification with red/amber/green outcomes.
- AI explanations of computed results; review commentary alongside the authoritative comparison.
- Revision checks that prevent silent concurrent overwrites and applying stale plans.

## What is simulated

Orders, recipes, staff, stock, durations, preparation, and disruptions are sample data. Game cooking takes two seconds per station and represents a manual simulation action, not a measurement of cooking time. Required station completion is saved on the shared order; packing begins after all required stations are complete. Drink-only orders use the packing station. Original detailed controls can still advance preparation directly.

Player paths and live packing counts are published through a separate shared presence table, independent of kitchen revisions. Other views animate those paths using server-synchronized time. Presence expires after 20 seconds without a heartbeat; closing a view removes its player. The unfinished bag is controlled by its kitchen tab and broadcast for observation. Reopening or leaving a packing mission clears it; check it again before handoff.

Menu quantities follow the limiting ingredient after queued-ticket commitments and other cart items. The server rechecks the entire cart and rejects overselling. Accepting a ticket consumes its physical ingredients once. Minus removes one, × clears an item type, and Clear all empties the cart or bag. Queued tickets can be edited or cancelled; accepted tickets are locked.

The full-width **Delivery simulator** is a main stage on every role page, above the restaurant floor. Select an order tab to follow its courier and complete the handoff or receipt steps; the Demo screen remains read-only.

Delivery is an accelerated simulation with fictional destinations: Maple House (1.2 km, 18 game seconds), Park House (2.8 km, 30 seconds), and River House (4.5 km, 45 seconds). A ready bag triggers a six-second courier approach. A matching-reference pickup starts the persisted trip; arrival enables explicit receipt confirmation. Pickup and delivery are distinct statuses. Refreshing or opening another device keeps the same clock. These are illustrative ETAs, not routing or traffic estimates.

Replay is a forecast animation and does not advance live orders. The model assumes one task per station and worker, fixed recipe durations, all-or-nothing ingredient reservation, and earliest-due work first. Same-recipe units within one ticket are scheduled as one station batch so large orders do not create thousands of tasks. It is a heuristic comparison, not a globally optimal scheduler.

Camera checks evaluate visible components, not hidden ingredients, food safety, or sealed-bag contents. Game bags, manual counts, and fixtures are labeled and are never described as AI observations. Pickup uses an order-specific, single-use reference. The app does not place real orders, charge customers, or dispatch couriers. An impossible shortage/outage remains unresolved.

## Optional iPhone check

Use an iPhone paired with a Mac through Continuity Camera, choose it under **Kitchen -> Detailed controls & optional camera -> Start camera**, capture one frame, and choose **Analyze image with OpenRouter**. Alternatively transfer a JPEG from the iPhone to the Mac and use **Upload photo**.

Keep items visible on a tray before sealing the bag. Try a labeled/recognizable burger, two distinct fries portions, and a readable Sprite can. Unmarked containers or cups should produce uncertainty. Holding the phone for a still photo works; no dedicated mount is required. Camera capture is user-started and requests no microphone. Nova does not save frames; an image is sent to OpenRouter only when analysis is requested.

## Development and hosting

Run `npm test` and `npm run build`.

The React/Vite client uses one portable Fetch API backend (`server/api.mjs`). Local mode persists to ignored `.data/state.json`. The hosted Worker uses D1 with revision-checked shared storage; migrations are under `drizzle/`. Client assets are embedded in the Worker, with no external client CDN.

`OPENROUTER_API_KEY` belongs in local ignored `.env` or hosted runtime secrets. It is never returned by the API or included in the client bundle. `OPENROUTER_MODEL` defaults to `google/gemini-2.5-flash`.

Existing repository connection-test files are preserved and are unrelated to the app.

## AI operations and restocking

Owner, Kitchen, and Live split view include AI operations below the game. Owner receives a top-of-page alert when uncommitted stock reaches three units or less, an up-to-date AI estimate exceeds available stock, or someone opens a restock request. These are shared **in-app** messages; no email, SMS, supplier integration, or purchase is sent.

- **Preparation copilot:** ranks current tickets and explains starts/holds/blockers. Start prep validates the plan version, ingredients, and qualified capacity again. Recommendations are advisory; no cooking happens automatically.
- **AI packing check:** at the game packing bench, expand AI camera packing check. Use an iPhone camera/photo or Mac camera. The vision model counts only visible food/package identities; obscured or uncertain evidence cannot seal a bag. A human confirms a fresh matching check. Game bag counts remain a separately labeled deterministic test.
- **Inventory copilot:** estimates additional next-30-minute ingredient demand from the current demo snapshot, then opens owner requests where stock is insufficient. Sparse history means this is an AI estimate, not a trained demand forecast. Threshold alerts work without any AI calls.
- **Staff copilot:** describe a known worker absence or equipment outage in plain language. AI parses it; the deterministic simulator produces qualified coverage and remaining blockers. Review the comparison before applying; a stale scenario cannot apply.
- **Financial assistant:** explains completed simulated orders, current sample menu prices, estimated ingredient costs, reviewed receipts, and explicitly logged waste. Contribution excludes labor, tax, rent and fees; it is not actual net profit. Prices are demo assumptions. Reviewed USD receipt lines update matched unit cost estimates; other currencies stay separate.
- **Receipt extraction:** choose a JPEG/PNG/WebP receipt photo, explicitly send it to AI, review/edit the draft, then save. Images are not stored. Saving a receipt does not increase stock. Match receipt quantities to the ingredient unit first.

To demonstrate restocking on two Macs: open Kitchen on one and Owner on the other. In Owner operations, expand **Record waste or simulate a shortage**, choose an ingredient, and select **Simulate stockout**. The shared alert appears immediately. Kitchen can request units, or **Forecast & request stock** can create an AI owner request. Owner records full or partial received quantities; stock and menu availability update on both Macs. A request is not an actual supplier order.

No new equipment is required. The server needs `OPENROUTER_API_KEY` with credits/access to the selected models (the hosted demo already has the supplied key). Task defaults are GPT-6.1 Terra for prep/inventory, Claude Opus 5.5 for staffing/financial explanations, and Gemini 4 Argon for packing/receipt vision. See `.env.example` for per-task overrides. Model identifiers were checked against the live OpenRouter catalogue at implementation. Key credentials remain server-side; analysis buttons make real paid requests, while screen polling and threshold alerts do not call AI.

For the optional phone demo, photograph a well-lit tray before closing the bag or upload a readable receipt photo. No continuous camera feed, new webcam, or third Mac is needed. Real demand forecasting would need historical timestamped POS data, delivery ETAs and lead times; real margin reporting would need real prices and cost records. This MVP intentionally labels the demo assumptions.
