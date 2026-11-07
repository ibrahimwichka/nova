import test from 'node:test';
import assert from 'node:assert/strict';
import { CUSTOMER_SPOTS, KITCHEN_SPOTS, SPOTS, walkable, findPath } from '../src/game-logic.mjs';
import { initialState, prepareOrder, completeGameStation } from '../server/domain.mjs';
import { sampleState } from './fixtures.mjs';
import { createApi } from '../server/api.mjs';

test('every player destination is reachable without crossing furniture or the kitchen divider', () => {
  for (const [role, start, destinations] of [['customer', {x:3,y:13}, CUSTOMER_SPOTS], ['kitchen', {x:11,y:6}, KITCHEN_SPOTS]]) {
    for (const id of destinations) {
      const path = findPath(role,start,SPOTS[id]);
      if (start.x === SPOTS[id].x && start.y === SPOTS[id].y) continue;
      assert.ok(path.length > 0, role + ' must reach ' + id);
      assert.deepEqual(path.at(-1), {x:SPOTS[id].x,y:SPOTS[id].y});
      let previous = start;
      for (const step of path) {
        assert.ok(walkable(role,step.x,step.y));
        assert.equal(Math.abs(previous.x-step.x)+Math.abs(previous.y-step.y),1);
        previous = step;
      }
    }
  }
  assert.deepEqual(findPath('customer',{x:3,y:13},SPOTS.grill),[]);
  assert.deepEqual(findPath('kitchen',{x:11,y:6},SPOTS.counter),[]);
  assert.deepEqual(findPath('customer',{x:3,y:13},{x:9,y:10}),[]);
});

test('game preparation requires every needed station and rejects duplicates, irrelevant work, and unavailable capacity', () => {
  const state = sampleState(), id = 'N103';
  assert.throws(()=>completeGameStation(state,id,'grill'));
  prepareOrder(state,id);
  assert.throws(()=>completeGameStation(state,id,'prep'));
  completeGameStation(state,id,'grill');
  const order = state.orders.find(o=>o.id===id);
  assert.equal(order.status,'preparing');
  assert.deepEqual(order.gameStations,['grill']);
  assert.throws(()=>completeGameStation(state,id,'grill'));
  state.stations.find(s=>s.id==='fryer').available=false;
  assert.throws(()=>completeGameStation(state,id,'fryer'));
  assert.deepEqual(order.gameStations,['grill']);
  state.stations.find(s=>s.id==='fryer').available=true;
  completeGameStation(state,id,'fryer');
  assert.equal(order.status,'packing');
});

test('two game clients share station progress, bag errors, verification and matching pickup', async () => {
  let state = initialState();
  const store = {async load(){return structuredClone(state);},async save(next){state=next;}};
  const customer = createApi({store}), kitchen = createApi({store});
  async function call(api,path,input) {
    const response = await api(new Request('https://nova.test/api'+path, input === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}));
    return {status:response.status,body:await response.json()};
  }
  const placed = await call(customer,'/orders',{customer:'Game player',items:{burger:1,fries:1,sprite:1}});
  const id = placed.body.orderId;
  await call(kitchen,'/orders/'+id+'/prepare',{});
  await call(kitchen,'/orders/'+id+'/game-cook',{station:'grill'});
  assert.deepEqual((await call(customer,'/state')).body.state.orders.find(o=>o.id===id).gameStations,['grill']);
  assert.equal((await call(kitchen,'/orders/'+id+'/game-cook',{station:'grill'})).status,409);
  await call(kitchen,'/orders/'+id+'/game-cook',{station:'fryer'});
  const observation = {quality:'clear',occluded:false,items:[{sku:'burger',count:1,certainty:'clear'},{sku:'fries',count:1,certainty:'clear'}],notes:['Simulated game bag.']};
  let checked = await call(kitchen,'/orders/'+id+'/verify',{mode:'game',observation});
  let order = checked.body.state.orders.find(o=>o.id===id);
  assert.equal(order.verification.status,'red');
  assert.equal((await call(kitchen,'/orders/'+id+'/ready',{verificationId:order.verification.id})).status,409);
  observation.items.push({sku:'sprite',count:1,certainty:'clear'});
  checked = await call(kitchen,'/orders/'+id+'/verify',{mode:'game',observation});
  order = checked.body.state.orders.find(o=>o.id===id);
  const ready = await call(kitchen,'/orders/'+id+'/ready',{verificationId:order.verification.id});
  order = ready.body.state.orders.find(o=>o.id===id);
  assert.equal(order.verification.mode,'game');
  assert.equal((await call(customer,'/orders/'+id+'/collect',{code:order.pickupCode})).status,200);
  assert.equal((await call(kitchen,'/state')).body.state.orders.find(o=>o.id===id).status,'collected');
  const drink = await call(customer,'/orders',{customer:'Drinks only',items:{sprite:1}});
  const drinkId = drink.body.orderId;
  await call(kitchen,'/orders/'+drinkId+'/prepare',{});
  const packed = await call(kitchen,'/orders/'+drinkId+'/game-cook',{station:'packing'});
  assert.equal(packed.body.state.orders.find(o=>o.id===drinkId).status,'packing');
});
