import { initialState } from '../server/domain.mjs';

// Explicit orders for scheduler and packing tests; never used to seed the app.
export function sampleState() {
  return { ...initialState(), orders: [
      { id: 'N101', customer: 'Alex M.', source: 'DoorDash · sample', due: 6, arrival: 0, status: 'packing', revision: 1, items: { burger: 1, fries: 2, sprite: 1 }, note: 'Keep the drink beside the bag.' },
      { id: 'N102', customer: 'Taylor K.', source: 'Direct · sample', due: 10, arrival: 0, status: 'packing', revision: 1, items: { wrap: 1, fries: 1, sprite: 1 }, note: 'One separate fries portion.' },
      { id: 'N103', customer: 'Jordan S.', source: 'DoorDash · sample', due: 12, arrival: 0, status: 'queued', revision: 1, items: { burger: 2, fries: 1 }, note: '' },
      { id: 'N104', customer: 'Alex R.', source: 'Direct · sample', due: 15, arrival: 1, status: 'queued', revision: 1, items: { wrap: 2, sprite: 2 }, note: 'Match the reference; two customers are named Alex.' },
      { id: 'N105', customer: 'Casey L.', source: 'DoorDash · sample', due: 18, arrival: 2, status: 'queued', revision: 1, items: { burger: 1, fries: 2, sprite: 1 }, note: '' },
      { id: 'N106', customer: 'Morgan J.', source: 'Direct · sample', due: 22, arrival: 3, status: 'queued', revision: 1, items: { wrap: 1, fries: 1 }, note: '' },
      { id: 'N107', customer: 'Riley W.', source: 'DoorDash · sample', due: 25, arrival: 4, status: 'queued', revision: 1, items: { burger: 2, sprite: 2 }, note: '' },
      { id: 'N108', customer: 'Jamie P.', source: 'Direct · sample', due: 28, arrival: 5, status: 'queued', revision: 1, items: { wrap: 1, fries: 2, sprite: 1 }, note: '' },
      { id: 'N109', customer: 'Chris D.', source: 'DoorDash · sample', due: 31, arrival: 6, status: 'queued', revision: 1, items: { burger: 1, fries: 1 }, note: '' },
      { id: 'N110', customer: 'Drew B.', source: 'Direct · sample', due: 35, arrival: 7, status: 'queued', revision: 1, items: { wrap: 1, sprite: 1 }, note: '' },
    ] };
}
