# Nova Kitchen Lab

A functional hackathon prototype for testing how orders, shortages, staffing, packing, and pickup connect. Two Macs are enough; no cameras or hardware purchases are required.

## Hosted testing

Open the deployed site on both Macs. All views share one persisted restaurant and sync about every 1.5 seconds:

- `/?view=owner`: inject disruptions, compare policies, manage resources, and replay drills.
- `/?view=kitchen`: start/finish simulated preparation, verify packing, and confirm pickup.
- `/?view=customer`: place sample orders and track their demo status.
- `/?view=display`: read-only pipeline or scenario playback in another window.

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
- Ingredient reservations, staff skills, equipment availability, and explicit blocked states.
- Absence, shortage, equipment-failure, and six-order-rush scenarios.
- Fixed assignments versus cross-trained recovery under identical starting conditions.
- Saved snapshots, deterministic replay, shared animated playback, and explicit drill restart.
- Manual packing counts, labeled fixtures, and optional AI image verification with red/amber/green outcomes.
- AI explanations of computed results; review commentary alongside the authoritative comparison.
- Revision checks that prevent silent concurrent overwrites and applying stale plans.

## What is simulated

Orders, recipes, staff, stock, durations, preparation, and disruptions are sample data. Preparation advances when a tester clicks the kitchen controls. Replay is a forecast animation and does not advance live orders. The model assumes one task per station and worker, fixed recipe durations, all-or-nothing ingredient reservation, and earliest-due work first. It is a heuristic comparison, not a globally optimal scheduler.

Camera checks evaluate visible components, not hidden ingredients, food safety, or sealed-bag contents. Manual counts and fixtures are labeled and are never described as AI observations. Pickup uses an order-specific, single-use reference. The app does not place real orders, charge customers, or dispatch couriers. An impossible shortage/outage remains unresolved.

## Optional iPhone check

Use an iPhone paired with a Mac through Continuity Camera, choose it under **Kitchen -> Start camera**, capture one frame, and choose **Analyze image with OpenRouter**. Alternatively transfer a JPEG from the iPhone to the Mac and use **Upload photo**.

Keep items visible on a tray before sealing the bag. Try a labeled/recognizable burger, two distinct fries portions, and a readable Sprite can. Unmarked containers or cups should produce uncertainty. Holding the phone for a still photo works; no dedicated mount is required. Camera capture is user-started and requests no microphone. Nova does not save frames; an image is sent to OpenRouter only when analysis is requested.

## Development and hosting

Run `npm test` and `npm run build`.

The React/Vite client uses one portable Fetch API backend (`server/api.mjs`). Local mode persists to ignored `.data/state.json`. The hosted Worker uses D1 with revision-checked shared storage; migrations are under `drizzle/`. Client assets are embedded in the Worker, with no external client CDN.

`OPENROUTER_API_KEY` belongs in local ignored `.env` or hosted runtime secrets. It is never returned by the API or included in the client bundle. `OPENROUTER_MODEL` defaults to `google/gemini-2.5-flash`.

Existing repository connection-test files are preserved and are unrelated to the app.
