# Zindabad Dash: final prompt audit

Reviewed against NOVAOpeningSlides.pdf pages 13–18. The sponsor asks for a working demo with a happy and sad path, supported by a deck explaining chosen problems and solutions. All five opportunities appear in the prototype, at different depths.

| Opportunity | Implemented | Production gap |
|---|---|---|
| Order management and preparation timing | Shared queue, stock-aware ordering, prep AI advice, kitchen station progress | Real POS/multichannel feeds and calibrated prep times |
| Order packing and pickup | Real OpenRouter photo observations, code comparison, uncertainty/revision guards, human approval, matching pickup reference | Real photographs across packaging, lighting and occlusion |
| Inventory and forecasting | Stock reservations, alerts, rough AI demand estimates, owner requests, stock receipt and waste records | Demand history and supplier integrations |
| Bookkeeping and financial health | Receipt draft extraction/review and AI explanation of computed demo estimates | Bank, POS, payroll and accounting integrations |
| Staffing and skill optimization | Absence/outage/rush scenarios, skill-qualified recovery, shared replay and AI explanations | Trained shift forecasting and morale assessment |

## Focus and trimming

Customer navigation now contains only Experience and Delivery. Main perspective navigation contains Customer, Kitchen and Owner. Inventory, Scenarios and Operations stay separate. Auxiliary display and linked views still work by direct URL. The galaxy animation runs only at entry and supports reduced motion. The operational interface keeps the professional design. The architecture, order state and external repository retain some internal Nova identifiers to preserve compatibility.

## Photo checks and test data

Two AI-generated transparent-bag photos are included: complete.jpg (1 burger, 1 fries, 1 Sprite) and missing-drink.jpg (1 burger, 1 fries). They are downloadable in the guided demo at packing and at the house. Analyze missing drink calls the real vision endpoint. Next loads the corrected bag and makes another real call. Photos never tell the model the expected counts. Code compares observations with the actual ticket. Unknown/occluded evidence is amber, mismatches red, exact clear matches green. Delivery confirmation requires fresh green doorstep evidence.

Actual live checks on the included images: packing missing Sprite returned red with Sprite 0/1; corrected packing returned green with all three counts 1/1. Doorstep missing Sprite returned red and blocked receipt; corrected doorstep returned green and permitted explicit confirmation. This is a small synthetic smoke test, not a measured real-world accuracy evaluation.

## Verification and limits

Automated suite: 58 passing tests including stock reservations, mismatch/uncertainty blocking, stale evidence, courier arrival/travel, required doorstep photo, replay and shared persistence. Production build succeeds. Manual browser run: order, cooking, both packing checks, reference pickup, animated delivery, both doorstep checks and receipt. Prior browser run covered responsive phone layout, scenario controls and operations. No exhaustive claim about every browser or failure combination.

Delivery routes/times are simulated. No GPS, real order/payment, supplier purchase, email or SMS is sent. AI advice needs human review. No real-world performance or 100% fail-proof claim is supported.
