# Two-Mac testing guide

No purchases, phones, or cameras are required for the first five tests. On the hosted version, each viewer needs access to the private Site. Open the same deployed origin on both devices, not separate local servers.

## Start with the game

The restaurant starts with zero orders. Each page explains its own controls in **How this page works**. Reset clears live orders; refreshing keeps them.

1. Mac 1 opens Kitchen and Owner in separate tabs. Mac 2 opens Customer. Refresh existing tabs after deployment.
2. Customer clicks **Walk to Order counter**, or clicks the counter marker on the floor. Click **Open menu** or press **E** while the room is focused.
3. Enter a name, choose **Pickup** for this first test, adjust the menu with +/−, and place a burger/fries/Sprite order. Keep its C… ticket number. The player walks to the waiting area.
4. Kitchen selects that ticket in the strip below the room. Walk to **Order tickets** and choose **Accept ticket & start cooking** (or press **E** nearby).
5. Walk to **Grill** and choose **Prepare at Grill**. Stay there for the two-second game task. Repeat at **Fryer**. Both station tasks must finish before packing.
6. Walk to **Packing bench**. Add a burger and fries from the shelf. Click **Check game bag** with the Sprite missing: expect a red mismatch, a bag flag, and a customer notice.
7. Add Sprite, check again, tick **I checked this game bag**, and choose **Seal bag & send to pickup**. Changing the bag after checking removes the handoff action until a new check.
8. Customer walks to **Pickup counter**, chooses **Show reference & collect bag** (or presses **E**), then walks to **Exit** and leaves.
9. Owner chooses **One worker down**, compares the scores, and plays **Fixed** and **Recovery**. The Demo screen follows the same replay. The absent worker is faded; active staff move to simulated station tasks.
10. Stop replay before returning to live play. **Apply challenge** changes the shared kitchen; preview/replay alone does not. Use Owner's **Reset for another round** to reset the live restaurant on both Macs.

Movement supports click-to-walk, destination buttons, WASD, and arrows. Customers cannot walk into the kitchen or through tables. Movement paths, live packing counts, order stages, completed station tasks, bag checks, and pickup are shared across tabs and Macs. No other player is required for walking, but a second person must advance the kitchen ticket for the customer's order to complete.

The original dashboard tests below are available through **Detailed controls & optional camera**.

## Live movement, stock, and home delivery

1. Open Customer on Mac 2, Kitchen on Mac 1, and Owner or Live split view in another window. Walk both customer and owner; each view should show the other moving without refresh. Owner can cross the center pass into the kitchen.
2. Open the menu. With initial stock, burgers can go above six to twelve. Set nine, press minus, and expect eight. Use × to clear a type. Check fries and drinks the same way. Reducing stock in Owner changes the allowed quantity.
3. Place a ticket. The available menu stock on another client subtracts queued commitments. Try ordering more than what remains: it must be rejected rather than oversold.
4. Before Kitchen accepts, choose Edit / remove items. Remove an item and save. Kitchen should see the new receipt. Once accepted, editing closes. Cancel an unstarted ticket to release its demand.
5. Place a new **Delivery** order and choose a demo house. Prepare it, then pack an extra burger and remove it with minus. Owner/Customer should see live bag counts. Deliberately omit Sprite, check, then correct it and seal.
6. Watch the courier approach for six seconds. At the restaurant, choose Match reference & let courier collect. All views should show Out for delivery, the same destination, remaining distance, and countdown.
7. The scooter moves toward the house without refresh. Maple takes 18 game seconds, Park 30, River 45. Confirmation must stay unavailable until arrival. At the door, Customer confirms delivery received; Owner and Kitchen show Delivered.
8. Refresh mid-trip or open the same order on another screen: the ETA must continue from the same persisted timestamps. Demo screen has no delivery-control buttons.

## 1. Shared order and packing failure

1. Mac 1 opens Owner and Kitchen in separate tabs. Mac 2 opens Customer.
2. Customer enters a recognizable test name and places a burger/fries/Sprite order.
3. Select the new order in Kitchen; it should appear within about two seconds.
4. Click Start simulated preparation. Customer should show Preparing.
5. Click Finish simulated prep. Customer should show Packing.
6. Record manual counts with Sprite set to 0. Expect a red mismatch and no ready action. The customer sees a packing problem.
7. Correct the counts, record again, confirm this is the checked order, and mark ready.
8. Customer sees Ready and the same reference. Enter a wrong reference in Kitchen: expect rejection.
9. Enter the correct reference, or use Confirm demo pickup on Customer. Both show Collected. A repeated pickup is rejected.

## 2. Recover from a worker absence

1. Owner resets the restaurant; verify zero orders in all views.
2. Place a burger/fries order from Customer. Keep the default Fryer worker absent scenario in Detailed controls and compare.
3. Fixed assignments should leave the fries order blocked; qualified cross-station recovery should complete it in the simulation.
4. Apply the drill. Leo becomes unavailable in Owner and Demo.
5. Inspect coverage and tradeoffs. It is a simulated plan, not automatic physical staff movement.

## 3. Shortage affects the customer

1. Reset; customer places a chicken-wrap order.
2. Owner sets chicken portions to 0 through live stock controls.
3. Customer sees an ingredient issue; Kitchen cannot start the affected order.
4. A burger order can still progress if its resources are available.
5. Restore chicken and verify that preparation can start. There is no silent substitution or cancellation.

## 4. Shared replay

1. Compare a scenario and open Demo screen in another window.
2. Owner plays the fixed plan, then the recovery plan.
3. Demo shows simulated time, active station tasks, and outcomes. Live orders retain their actual demo status.
4. Stop replay to return to the live pipeline.
5. Recompute identical replay preserves results. Restart from saved snapshot explicitly restores the saved operating conditions.

## 5. Stale-plan protection

Compare a scenario, then place another customer order. The old plan's Apply button becomes unavailable after sync. Compare again to include the new order, or explicitly restart the saved drill.

## 6. Optional AI and iPhone

- After comparison, choose Explain with AI. Read commentary alongside authoritative computed results; model explanations can be imperfect.
- Optionally use iPhone Continuity Camera or upload a tray photo.
- Try complete, missing-item, and obscured cases. An unclear image should return amber, not a guessed green.
- Fixture buttons exercise workflow logic without hardware and do not establish camera accuracy.

## Limitations

One shared demo restaurant; no separate customer authentication or per-role permissions. Reset and restart affect all views. Upstream work is manually advanced simulation, and forecasts are estimates. The model is not calibrated against real shifts. Test camera accuracy on your own items, packaging, lighting, and tray.
