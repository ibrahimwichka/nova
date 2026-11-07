# Professional customer experience

Nova demonstrates one connected restaurant from arrival to delivery. The first-person room is a lightweight architectural illustration built with Three.js, not a scan of a real restaurant. It shares the existing collision grid, customer position and order state with the kitchen and owner views.

## Pitch walkthrough

1. Open Customer on Mac 1 and Kitchen on Mac 2. Use the same hosted Nova URL on both computers.
2. In Customer, choose **Walk to the counter**. The camera follows the walk and opens the menu on arrival. WASD moves relative to the camera; drag to look, arrows turn, and R faces the counter. Floor plan switches to the overhead view without changing the customer or ticket.
3. Place a burger, fries and Sprite order for delivery. Kitchen receives the same ticket. Use the perspective buttons to show the handoff on one laptop, or leave each Mac on its own perspective.
4. In Kitchen, accept the ticket, visit Grill and Fryer, then walk to Packing. Assemble a bag with the drink missing and choose **Verify packed items**. The mismatch blocks sealing. This button checks simulated counts; it does not invoke vision AI.
5. Add the drink, verify again, review the contents, and seal the bag. For an actual photo check, use Operations → Packing & camera → Upload photo on a packing ticket, then explicitly Analyze. Clear evidence still needs human confirmation; uncertainty cannot approve a bag.
6. Open Delivery. Wait for the courier to arrive, match the reference, dispatch, follow ETA and route progress, then confirm receipt at the house. Confirmation appears across perspectives.
7. Open Owner → Scenarios. Compare a disruption, then play the recovery plan. Pause, scrub, change speed, or compare fixed assignments. Previews and playback leave live orders and inventory unchanged; applying a scenario is an explicit separate action.
8. Owner → Operations groups preparation AI, team/capacity, finances/receipts and camera packing. Inventory has its own workspace for stock alerts, forecasts, requests and recording physically received units.

## Physical setup

- Two Macs and modern browsers are sufficient. No cameras, headsets or purchases are required.
- An iPhone is optional for a tray photo. Upload JPEG, PNG or WebP. If your phone saves HEIC, export a JPEG first.
- The first-person renderer needs WebGL. If unavailable, use the Floor plan fallback; the same order workflow remains available.
- The room and courier are simulated. No actual POS order, GPS tracking, payment, supplier purchase or external notification is created. AI calls use the existing server-side OpenRouter configuration.

## Local testing

```sh
npm ci
npm run build
npm run start:lan
```

The terminal prints the LAN URL to open on the second Mac. Keep the server running on Mac 1. A venue network may isolate devices; the hosted demo avoids that issue. Optional camera permissions work best at localhost or HTTPS; still-photo upload is supported.

Fresh or reset restaurants start with zero orders. Existing saved restaurant data survives refreshes and deployment. Owner → Inventory → Stock corrections & demo reset explicitly resets live orders and resources; saved scenarios remain.

## Release and deployment

Use the existing Nova Sites project from `.openai/hosting.json`. Publish the saved, archive-backed version produced for this change. It already contains the client, lazy-loaded Three.js renderer, fonts and Worker. Keep the existing D1 binding, migrations, OpenRouter secrets and private audience. There is no new infrastructure, database migration or API key needed for this revision.

GitHub and the Sites source repository contain the same release commit. Saving a version does not update the live site; publish that version in the existing project when ready. Both Macs should then reload the same hosted URL. Do not create a second Site or clear the production database.

## Verification

- All 52 prior tests plus six new tests pass: **58/58**. See [test output](professional-tests.txt).
- New checks cover replay control continuity and invalid inputs, shared replay isolation, forward heading through each route segment, reachable station priorities, category deep links, and camera-relative movement.
- Browser checks: first-person walk and menu, shared ticket on a second tab, cooking stations, missing-Sprite rejection, corrected bag confirmation, courier dispatch and receipt, replay pause/speed/keyboard scrubbing, category draft preservation, and a 390 × 844 phone layout with no horizontal overflow.
- Production client/Worker build passes. Three.js is loaded only for the first-person view; closing it disposes the renderer. Reduced motion removes camera bob and view interpolation. These checks are not a formal performance benchmark or accessibility audit.

## Screenshots

Captured against an isolated local test restaurant. Test tickets were reset after verification; the production restaurant was not reset.

| View | Screenshot |
| --- | --- |
| Customer arrival | [First person](screenshots/nova-professional-overview.jpg) |
| At the counter | [Customer order](screenshots/nova-professional-customer.jpg) |
| Kitchen | [Shared floor](screenshots/nova-professional-kitchen.jpg) |
| Courier trip | [Delivery](screenshots/nova-professional-delivery.jpg) |
| Inventory | [Stock workspace](screenshots/nova-professional-inventory.jpg) |
| Scenario replay | [Replay](screenshots/nova-professional-replay.jpg) |
| Delivery confirmation | [Completed delivery](screenshots/nova-professional-complete.jpg) |
| Phone | [390 px layout](screenshots/nova-professional-phone.jpg) |
