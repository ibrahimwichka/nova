# Zindabad Dash presentation pack

- `pitch/Zindabad-Dash.pptx`: 11 main slides for a five-minute pitch plus one test-image appendix. Editable text and native coverage table. Presenter notes include timing and source references.
- `pitch/Zindabad-Dash.pdf`: portable slide copy.
- `pitch/Zindabad-Dash-Video.mp4`: 81-second edited walkthrough combining real browser recording and held screenshots of the same demonstration. Default English caption track, no narration. Shows cooking, real AI bag mismatch/correction, simulated delivery, doorstep mismatch/correction, inventory and scenario replay.
- `test-data/`: two generated transparent-bag photos and generation prompt description.
- `FINAL_PROMPT_AUDIT.md`: five sponsor opportunities, implementation coverage, trims, tests and production gaps.

## Demo steps

Start with zero orders. On Mac 1, Customer walks to the counter and orders 1 burger, 1 fries, 1 Sprite for delivery. Mac 2 accepts, completes Grill and Fryer, and walks to Packing. Open AI camera packing check, then Guided photo demo. Analyze missing drink: expect Sprite 0/1 and a blocked handoff. Click Next to add the missing drink and rerun the real model. Confirm the green result and mark ready. In Delivery, match the courier reference, follow the demo trip and open the photo demo at the house. A missing drink blocks receipt. Next reruns the complete bag. Confirm receipt after green.

For a physical photo, use Upload photo at packing and Upload delivery photo at the house. A phone is enough. Keep the contents readable through a clear bag. The app sends a still photo to OpenRouter, does not retain the image, and cannot identify hidden ingredients. No dedicated webcam is required.

The recording uses synthetic fixtures and a simulated delivery clock. It does not establish real-world vision accuracy. The underlying repo and hosted URL retain the original `nova` identifier for compatibility.
