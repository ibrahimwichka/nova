import React, { useEffect, useRef, useState } from 'react';
import { SPOTS, CUSTOMER_SPOTS, KITCHEN_SPOTS, TILE, findPath, walkable, nearSpot, requiredStations, orderProblems } from './game-logic.mjs';
import './game.css';
import { availableInventory, itemLimit, stockIssue } from '../shared/stock.mjs';
import { presencePosition } from '../shared/presence.mjs';
import { DeliveryJourney, DeliveryBoard } from './Delivery.jsx';
import { usePlayerPresence } from './use-presence.jsx';

const FOOD = { burger: '🍔', wrap: '🌯', fries: '🍟', sprite: '🥤' };
const STATUS = { queued: 'Ticket received', preparing: 'On the cook line', packing: 'Bag check', ready: 'Ready to collect', collected: 'Collected', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
const EMPTY = { burger: 0, wrap: 0, fries: 0, sprite: 0 };
const pixel = p => ({ x: p.x * TILE + 20, y: p.y * TILE + 20 });

function useWalk(role, publish) {
  const spawn = role === 'kitchen' ? { x: 11, y: 6 } : role === 'owner' ? { x: 13, y: 8 } : { x: 3, y: 13 };
  const [position, setPosition] = useState(spawn);
  const [walking, setWalking] = useState(false);
  const positionRef = useRef(spawn), route = useRef([]);
  useEffect(() => {
    publish([spawn]);
    const id = setInterval(() => {
      const next = route.current.shift();
      if (next) { positionRef.current = next; setPosition(next); }
      setWalking(route.current.length > 0);
    }, 115);
    return () => clearInterval(id);
  }, []);
  function move(target) { route.current = findPath(role, positionRef.current, target); publish([positionRef.current, ...route.current]); setWalking(route.current.length > 0); }
  function step(dx, dy) {
    route.current = [];
    const p = positionRef.current, next = { x: p.x + dx, y: p.y + dy };
    if (walkable(role, next.x, next.y)) { publish([p, next]); positionRef.current = next; setPosition(next); }
    else publish([p]);
  }
  return { position, walking, move, step };
}

function Person({ x, y, color = '#518576', name, chef = false, walking = false, you = false, muted = false, bubble }) {
  return <g className={'person ' + (walking ? 'walking ' : '') + (muted ? 'muted-person' : '')} style={{ transform: 'translate(' + x + 'px,' + y + 'px)' }}>
    {you && <ellipse cy="12" rx="24" ry="12" fill="none" stroke="#f9be60" strokeWidth="3" strokeDasharray="4 3"/>}
    <ellipse cy="13" rx="15" ry="7" fill="#233e3c" opacity=".15"/>
    <g className="person-body">
      <rect x="-11" y="-3" width="22" height="22" rx="8" fill={color}/>
      <path d="M-6 18v5m12-5v5" stroke="#273d40" strokeWidth="6" strokeLinecap="round"/>
      <circle cy="-10" r="10" fill="#e8b289"/><path d="M-10-11q0-14 13-9l7 8-7-4-11 3" fill="#403c3b"/>
      {chef && <><rect x="-11" y="-22" width="22" height="8" rx="2" fill="#fffaf1"/><circle cx="-7" cy="-23" r="7" fill="#fffaf1"/><circle cy="-26" r="8" fill="#fffaf1"/><circle cx="7" cy="-23" r="7" fill="#fffaf1"/><path d="M-5 1v13H5V1" fill="#f2eee5"/></>}
    </g>
    {name && <><rect x="-40" y="-49" width="80" height="18" rx="9" fill={you ? '#243e3e' : '#ffffff'} opacity=".95"/><text y="-37" textAnchor="middle" fill={you ? '#fff' : '#425754'} fontSize="10" fontWeight="700">{name}</text></>}
    {bubble && <><rect x="-44" y="-76" width="88" height="21" rx="6" fill="#fff6d7"/><text y="-62" textAnchor="middle" fontSize="10" fill="#725128">{bubble}</text></>}
  </g>;
}

function Equipment({ id, x, available, active, label }) {
  return <g transform={'translate(' + x + ',65)'} className={active ? 'working-equipment' : ''}>
    <rect x="-67" y="6" width="134" height="73" rx="9" fill="#b1bdb6"/>
    <rect x="-67" width="134" height="66" rx="8" fill={available ? '#e2e8dd' : '#b9b6b2'} stroke="#94a79c" strokeWidth="2"/>
    {id === 'grill' && <><rect x="-51" y="11" width="102" height="38" rx="5" fill="#334b49"/>{[-35,-17,1,19,37].map(n => <path key={n} d={'M' + n + ' 15v30'} stroke="#647570" strokeWidth="3"/>)}<text textAnchor="middle" y="40" fontSize="28">🍔</text></>}
    {id === 'fryer' && <>{[-30,30].map(n => <g key={n}><rect x={n-22} y="12" width="44" height="34" rx="4" fill="#dba54e"/><path d={'M' + n + ' 12V-1'} stroke="#536b62" strokeWidth="5"/></g>)}<text textAnchor="middle" y="40" fontSize="28">🍟</text></>}
    {id === 'prep' && <><rect x="-50" y="12" width="100" height="38" rx="4" fill="#90ad77"/><text textAnchor="middle" y="41" fontSize="30">🌯</text></>}
    <rect x="-50" y="84" width="100" height="21" rx="6" fill={available ? '#334d48' : '#a65342'}/>
    <text textAnchor="middle" y="98" fill="#fff" fontSize="11" fontWeight="700">{available ? label : label + ' · OFF'}</text>
    {active && available && <g className="steam"><path d="M-15-4q-9-9 0-18m15 18q-9-9 0-18m15 18q-9-9 0-18" fill="none" stroke="#fff7dd" strokeWidth="3" strokeLinecap="round"/></g>}
  </g>;
}

function Restaurant({ role, state, config, selected, position, walking, move, step, onInteract, live, playerId }) {
  const room = useRef(null);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setTick(Date.now() + (live?.clockOffset || 0)), 50); return () => clearInterval(id); }, [live?.clockOffset]);
  const observer = role === 'display';
  const spots = role === 'kitchen' ? KITCHEN_SPOTS : role === 'owner' ? ['office', 'tickets', 'packing', 'counter', 'pickup'] : CUSTOMER_SPOTS;
  const playback = (observer || role === 'owner') && state.playback && state.scenarios.find(s => s.id === state.playback.scenarioId);
  const replay = playback && (state.playback.policy === 'fixed' ? playback.comparison.baseline : playback.comparison.recovery);
  const minute = replay ? Math.min(60, (tick - state.playback.startedAt) / 1000 * state.playback.speed) : 0;
  const activity = replay ? replay.schedule.filter(t => t.start <= minute && t.end > minute) : [];
  const activeStation = id => replay ? activity.some(t => t.station === id) : state.orders.some(o => o.status === 'preparing' && requiredStations(o, config.catalog).includes(id) && !o.gameStations?.includes(id));
  const stationAvailable = id => replay ? playback.snapshot.stations.find(s => s.id === id)?.available && playback.changes.equipmentDown !== id : state.stations.find(s => s.id === id)?.available;
  const remotePlayers = (live?.players || []).filter(p => p.id !== playerId && p.updatedAt > tick - 20000);
  const linkedOrders = new Set((live?.players || []).map(p => p.orderId).filter(Boolean));
  const visitors = (role === 'customer' ? state.orders.filter(o => o.id !== selected?.id) : state.orders).filter(o => !linkedOrders.has(o.id) && !['collected','out_for_delivery','delivered','cancelled'].includes(o.status)).slice(-5);
  const local = pixel(position);
  function clickFloor(e) {
    if (observer) return;
    room.current.focus({ preventScroll: true });
    const rect = e.currentTarget.getBoundingClientRect();
    move({ x: Math.floor((e.clientX - rect.left) / rect.width * 24), y: Math.floor((e.clientY - rect.top) / rect.height * 15) });
  }
  function key(e) {
    const keys = { ArrowUp: [0,-1], w: [0,-1], ArrowDown: [0,1], s: [0,1], ArrowLeft: [-1,0], a: [-1,0], ArrowRight: [1,0], d: [1,0] };
    const direction = keys[e.key] || keys[e.key.toLowerCase()];
    if (direction && !observer) { e.preventDefault(); step(...direction); }
    if (e.key.toLowerCase() === 'e' && !observer) { e.preventDefault(); onInteract(); }
  }
  return <div className="room-wrap">
    <div className="room-topline"><span><i className="live-dot"/>{replay ? 'SCENARIO REPLAY' : 'SHARED RESTAURANT'}</span><span>{replay ? Math.floor(minute) + ' / 60 sim min · ' + state.playback.policy : 'NOVA / SERVICE FLOOR'}</span></div>
    <div ref={room} className={'restaurant-room ' + (observer ? 'observer-room' : '')} tabIndex={observer ? undefined : 0} role="group" aria-label={observer ? 'Restaurant overview' : 'Restaurant game. Click the floor or use arrow keys or WASD to walk. E to interact.'} onKeyDown={key}>
      <svg viewBox="0 0 960 600" onClick={clickFloor} aria-label="Interactive restaurant floor">
        <defs>
          <pattern id="kitchen-tile" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#d5dfd4"/><path d="M40 0H0V40" fill="none" stroke="#becfc3" strokeWidth="1"/></pattern>
          <pattern id="dining-tile" width="80" height="80" patternUnits="userSpaceOnUse"><rect width="80" height="80" fill="#f3e4ca"/><rect width="40" height="40" fill="#efdfc2"/><rect x="40" y="40" width="40" height="40" fill="#efdfc2"/></pattern>
        </defs>
        <rect width="960" height="600" rx="12" fill="#354e49"/>
        <rect x="24" y="24" width="912" height="256" rx="8" fill="url(#kitchen-tile)"/>
        <rect x="24" y="320" width="912" height="256" rx="8" fill="url(#dining-tile)"/>
        <path d="M30 32h900M30 328h900" stroke="#fff" opacity=".3" strokeWidth="7"/>
        <text x="49" y="54" fontSize="12" fontWeight="800" letterSpacing="3" fill="#577267">KITCHEN</text>
        <text x="705" y="550" fontSize="14" fontWeight="800" letterSpacing="4" fill="#c7ad83">NOVA KITCHEN</text>
        {['grill','fryer','prep'].map((id, i) => <Equipment key={id} id={id} x={180+i*240} available={stationAvailable(id)} active={activeStation(id)} label={SPOTS[id].name.toUpperCase()}/>)}
        <g transform="translate(841,195)"><rect width="83" height="79" rx="7" fill="#a2afa3"/><rect width="83" height="66" rx="7" fill={state.stations.find(s => s.id === 'packing')?.available ? '#e4d5b3' : '#bd9583'}/><text x="42" y="42" textAnchor="middle" fontSize="33">🛍️</text><text x="42" y="91" textAnchor="middle" fontSize="11" fill="#35584a" fontWeight="800">PACKING</text></g>
        <g transform="translate(485,213)"><rect width="114" height="40" rx="5" fill="#49695b"/>{[0,1,2,3].map(i => <g key={i}><rect x={9+i*26} y="7" width="18" height="26" rx="2" fill="#fff8df"/><path d={'M'+(12+i*26)+' 15h12m-12 6h9'} stroke="#b0b9a1" strokeWidth="2"/></g>)}<text x="57" y="57" textAnchor="middle" fontSize="10" fill="#49695b" fontWeight="700">ORDER TICKETS</text></g>
        <g><rect x="63" y="280" width="402" height="49" rx="7" fill="#9d6647"/><rect x="63" y="278" width="402" height="34" rx="7" fill="#c18b5f"/><rect x="615" y="280" width="280" height="49" rx="7" fill="#9d6647"/><rect x="615" y="278" width="280" height="34" rx="7" fill="#c18b5f"/><rect x="222" y="280" width="68" height="30" rx="5" fill="#2d4847"/><rect x="231" y="284" width="50" height="19" rx="2" fill="#83b7a1"/><text x="140" y="303" fontSize="12" fill="#fff7e9" fontWeight="800">ORDER HERE</text><text x="651" y="302" fontSize="12" fill="#fff7e9" fontWeight="800">PICKUP</text>{state.orders.filter(o => o.status === 'ready').slice(0,4).map((o,i) => <g key={o.id}><rect x={752+i*30} y="285" width="22" height="24" rx="2" fill="#ebc68d"/><text x={763+i*30} y="300" textAnchor="middle" fontSize="7" fill="#725a3a">{o.id.slice(-3)}</text></g>)}</g>
        {[{x:400,y:440},{x:600,y:440}].map((t,i) => <g key={i} transform={'translate('+t.x+','+t.y+')'}><rect x="-51" y="-12" width="22" height="26" rx="7" fill="#6e9c81"/><rect x="29" y="-12" width="22" height="26" rx="7" fill="#6e9c81"/><rect x="-29" y="-31" width="58" height="70" rx="13" fill="#c69b6c"/><rect x="-29" y="-36" width="58" height="67" rx="13" fill="#e1bd8f"/><circle r="9" fill="#fff8e9"/><circle r="5" fill="#7fa482"/></g>)}
        {[{x:65,y:370},{x:897,y:515},{x:900,y:365}].map((p,i) => <g key={i} transform={'translate('+p.x+','+p.y+')'}><rect x="-12" y="0" width="24" height="22" rx="5" fill="#ba8060"/><circle cy="-6" r="22" fill="#6a9a73"/><circle cx="-9" cy="-13" r="13" fill="#80aa7e"/><circle cx="11" cy="-12" r="14" fill="#8db388"/></g>)}
        <rect x="82" y="557" width="116" height="19" rx="3" fill="#679b82"/><text x="140" y="571" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">ENTRANCE / EXIT</text>
        {!observer && spots.map(id => { const s = SPOTS[id], p = pixel(s), near = nearSpot(position,id); return <g key={id} className={'floor-spot ' + (near ? 'near' : '')} role="button" tabIndex="0" aria-label={'Walk to ' + s.name} onClick={e => { e.stopPropagation(); move(s); room.current.focus({preventScroll:true}); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();e.stopPropagation();move(s);} }}><ellipse cx={p.x} cy={p.y+8} rx="25" ry="13" fill={near ? '#eeb661' : '#fff8e5'} stroke={near ? '#b97b2d' : '#baae8b'} strokeWidth="2" opacity=".8"/><text x={p.x} y={p.y+13} textAnchor="middle" fill="#7b643f" fontSize="14" fontWeight="800">{near ? 'E' : '⌖'}</text></g>; })}
        {state.staff.map((w,i) => {
          const task = activity.find(t => t.workerId === w.id), spot = SPOTS[task?.station || w.home] || SPOTS.packing;
          const p = pixel(spot);
          const available = replay ? playback.snapshot.staff.find(s=>s.id===w.id)?.available && playback.changes.absentWorker !== w.id : w.available;
          return <Person key={w.id} x={p.x+37} y={p.y-14} color={['#b57857','#629387','#7c849f','#c49e4e'][i]} chef name={w.name + (!available ? ' · absent' : '')} muted={!available} bubble={task ? task.orderId : undefined}/>;
        })}
        {visitors.map((o,i) => {
          const p = o.status === 'ready' ? {x:680+i*34,y:382} : {x:265+i*52,y:504};
          return <Person key={o.id} {...p} color={['#7b8ba6','#a98397','#bc9862','#6e9e9b','#c58667'][i]} name={o.id} bubble={o.status === 'ready' ? 'Ready!' : o.verification?.status === 'red' ? 'Checking bag…' : undefined}/>;
        })}
        {remotePlayers.map(player => { const p=presencePosition(player,tick); return <Person key={player.id} {...pixel(p)} color={player.role==='owner'?'#718aa5':player.role==='kitchen'?'#527d69':'#e09e4b'} chef={player.role==='kitchen'} name={player.role.toUpperCase()} walking={p.walking}/>; })}
        {!observer && <Person {...local} color={role === 'kitchen' ? '#527d69' : role === 'owner' ? '#718aa5' : '#e09e4b'} chef={role === 'kitchen'} name={role==='owner'?'YOU / OWNER':'YOU'} you walking={walking}/>}
      </svg>
    </div>
    <div className="room-bottomline">{observer ? <span>Orders and resource availability are shared across all devices.</span> : <><span><kbd>W A S D</kbd> / arrows to walk · click floor to move · <kbd>E</kbd> interact</span><button className="quiet" onClick={onInteract}>Interact nearby ↵</button></>}</div>
  </div>;
}

function Steps({ labels, current }) { return <ol className="game-steps">{labels.map((label,i) => <li key={label} className={i < current ? 'done' : i === current ? 'current' : ''}><span>{i < current ? '✓' : i+1}</span>{label}</li>)}</ol>; }
function WalkButton({ id, position, move, children }) { return <button className="walk-button" onClick={() => move(SPOTS[id])}>{nearSpot(position,id) ? '↗ ' : '⌖ '}{children || 'Walk to ' + SPOTS[id].name}</button>; }
function Receipt({ order, config }) { return <div className="game-receipt">{Object.entries(order.items).map(([sku,n]) => <div key={sku}><span>{FOOD[sku]} {config.catalog[sku].name}</span><b>×{n}</b></div>)}</div>; }
function QuantityEditor({ name, value, limit, change, disabled = false }) {
  return <div className="quantity-editor">
    <button type="button" disabled={disabled || value <= 0} aria-label={'Remove ' + name} onClick={() => change(Math.max(0, value - 1))}>−</button>
    <input type="number" aria-label={name + ' quantity'} min="0" max={limit} value={value} disabled={disabled} onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 0) change(n); }}/>
    <button type="button" disabled={disabled || value >= limit} aria-label={'Add ' + name} onClick={() => change(Math.min(limit, value + 1))}>+</button>
    <button type="button" className="remove-line" disabled={disabled || value <= 0} aria-label={'Clear ' + name} onClick={() => change(0)}>×</button>
  </div>;
}

const GUIDES = {
  customer: {
    name: 'Customer',
    intro: 'Order a meal for delivery or pickup while the other Mac plays Kitchen. Menu quantities follow live ingredient stock; use minus or × to remove items.',
    steps: [
      ['Walk in & order', 'Walk to the counter, open the menu, choose delivery or pickup, and set quantities. You can edit or remove items until Kitchen accepts the ticket. No payment is taken.'],
      ['Wait for the kitchen', 'Your ticket appears on the other Mac. Its player must cook and pack it. Your status updates automatically; a missing item keeps the bag in the kitchen.'],
      ['Collect the right bag', 'For delivery, watch the courier approach, match the pickup reference, and follow the trip to your selected house. For pickup, walk to Pickup counter and collect the bag.'],
      ['Leave or play again', 'At the house, choose Confirm delivery received. Pickup guests can walk to Exit. Play another order starts a new visit; refreshing keeps the shared timeline.'],
    ],
    note: 'Click the floor or destination markers to walk. Focus the room to use WASD/arrows; E interacts nearby. You cannot walk through tables or into the kitchen.',
  },
  kitchen: {
    name: 'Kitchen',
    intro: 'You prepare the customer’s order. If there are no tickets, ask the other Mac to place the first order in Customer.',
    steps: [
      ['Choose & accept a ticket', 'Select a ticket below the room. Walk to Order tickets, then Accept ticket & start cooking. Ingredients are reserved once; shortages can block this step.'],
      ['Visit the cooking stations', 'Walk to each required station and choose Prepare. Stay there for the two-second game task. Checkmarks show saved progress. Drinks-only orders use Packing.'],
      ['Pack & check every item', 'At Packing bench, tap shelf items to add them; tap bag items to remove them. Check game bag reports missing or extra items. Fix the bag and check again.'],
      ['Seal & hand off', 'After a matching check, confirm and seal. A delivery courier approaches and collects with the matching reference, then travels to the house. The customer confirms receipt at the door.'],
    ],
    note: 'Walking is shared across devices, along with tickets, station tasks, bag checks, and courier progress. Detailed controls below include manual counts and the optional camera.',
  },
  owner: {
    name: 'Owner',
    intro: 'Walk your owner avatar around the shared floor, oversee orders, track couriers, and test disruptions. The restaurant starts empty; place customer orders first, or explicitly choose a Lunch rush challenge.',
    steps: [
      ['Watch the live shift', 'The floor, ticket cards, and counters reflect customer orders and kitchen progress. IN PLAY counts active tickets; SERVED counts completed pickups and deliveries; BAG FLAGS counts unresolved mismatches.'],
      ['Choose a challenge', 'Worker absence, missing chicken, or broken equipment tests the current tickets. Lunch rush adds six simulated tickets to the comparison. Fixed uses normal assignments; Recovery uses qualified cover.'],
      ['Preview, then apply', 'Play Fixed or Recovery to show a separate simulation on Owner and Demo screen. Live tickets stay unchanged. Apply challenge changes the shared kitchen; compare again if it has changed.'],
      ['Resolve or reset', 'Use Detailed controls for staff, equipment, stock, AI explanations, and saved drills. Reset for another round clears live orders and restores resources on both Macs.'],
    ],
    note: 'Refresh preserves the shared restaurant. Reset returns it to zero orders and keeps saved drills. Saved-drill restarts restore their old snapshots; unavailable stock or equipment may still leave orders blocked.',
  },
  display: {
    name: 'Demo screen',
    intro: 'This is a read-only spectator view. Keep it open in a spare window while the two players use Customer and Kitchen.',
    steps: [
      ['Start with the players', 'Zero orders means no one has ordered yet. Open Customer on one Mac and Kitchen on the other; no automatic sample tickets appear.'],
      ['Follow each stage', 'Watch tickets move from received to cooking, bag check, pickup, and collected. Customer figures reflect order stages; faded staff are absent.'],
      ['Read flags & events', 'The live counters and event feed show packing problems, resource changes, pickup, and delivery confirmation. The delivery board shows destination, remaining distance, and ETA.'],
      ['Watch a replay', 'Owner starts Fixed or Recovery playback. The floor shows simulated time and station assignments; live ticket counts remain live. Owner stops replay to return to the live floor.'],
    ],
    note: 'This page is read-only. Shared avatars show the actual players moving; the delivery board follows their courier. Live split view puts Customer and Owner together with separate controls.',
  },
};
function PageGuide({ role, compact = false }) {
  const guide = GUIDES[role];
  return <details className="page-guide" open={!compact}>
    <summary>How this page works · {guide.name}<span aria-hidden="true">Collapse guide ↑</span></summary>
    <p>{guide.intro}</p>
    <ol>{guide.steps.map(([title, text]) => <li key={title}><b>{title}</b><p>{text}</p></li>)}</ol>
    <p className="guide-note">{guide.note}</p>
  </details>;
}

function CustomerMission({ state, config, act, busy, position, move, selected, setSelected, interact, setInteract, live }) {
  const [name, setName] = useState(() => localStorage.getItem('nova-game-name') || 'Demo guest');
  const [cart, setCart] = useState({ burger: 1, fries: 1, sprite: 1, wrap: 0 });
  const [menuOpen, setMenuOpen] = useState(false), [left, setLeft] = useState(false), [editing, setEditing] = useState(false);
  const [fulfillment,setFulfillment] = useState('delivery'), [homeId,setHomeId] = useState('maple');
  const order = state.orders.find(o => o.id === selected);
  const atCounter = nearSpot(position,'counter'), atPickup = nearSpot(position,'pickup'), atExit = nearSpot(position,'exit');
  const issues = orderProblems(order,state,config);
  const stock = availableInventory(state,config.catalog,editing?order?.id:undefined);
  const shortage = stockIssue(cart,stock,config.catalog);
  const liveBag = live.players.find(p=>p.packing?.orderId===order?.id)?.packing;
  const total = Object.values(cart).reduce((a,b)=>a+b,0);
  useEffect(()=>{if(editing&&order?.status!=='queued'){setEditing(false);setMenuOpen(false);}},[order?.status,editing]);
  useEffect(() => { if (!order) { setLeft(false); setMenuOpen(false); setEditing(false); } }, [order?.id]);
  useEffect(() => { if (!atCounter && !editing) setMenuOpen(false); }, [atCounter]);
  useEffect(() => {
    if (!interact) return;
    if (atCounter && !order) setMenuOpen(true);
    else if (atPickup && order?.status === 'ready' && !order.delivery && !busy) act('/orders/'+order.id+'/collect',{code:order.pickupCode});
    else if (atExit && order?.status === 'collected') setLeft(true);
    setInteract(0);
  }, [interact, atCounter]);
  async function place(e) {
    e.preventDefault();
    const r = editing ? await act('/orders/'+order.id+'/edit',{items:cart},'Updating the ticket…') : await act('/orders',{customer:name,items:cart,fulfillment,homeId},'Sending your order to the kitchen…');
    if (r) { if(!editing){setSelected(r.orderId);localStorage.setItem('nova-game-order',r.orderId);localStorage.setItem('nova-game-name',name);move(SPOTS.lounge);} setMenuOpen(false);setEditing(false);setLeft(false); }
  }
  const completed = order && ['collected','delivered','cancelled'].includes(order.status);
  const current = !order ? 0 : completed ? 5 : order.status === 'out_for_delivery' ? 4 : order.status === 'ready' ? 3 : 2;
  const again = () => { setSelected(''); localStorage.removeItem('nova-game-order'); setLeft(false);setMenuOpen(false);setEditing(false); };
  return <aside className="mission-panel">
    <div className="mission-eyebrow">CUSTOMER / ORDER & DELIVERY</div>
    <h2>{!order?'What are we having?':order.status==='cancelled'?'Order cancelled.':order.status==='delivered'?'Your food is home.':order.status==='out_for_delivery'?'Follow your courier.':left?'Thanks for stopping by.':order.status==='collected'?'Pickup complete!':order.status==='ready'?'Your order is ready.':'The kitchen has your ticket.'}</h2>
    <Steps labels={['Walk in','Order','Kitchen','Pickup','Delivery']} current={menuOpen&&!order?1:current}/>
    {!order&&!menuOpen&&<><p>Walk to the counter to build your order. Choose delivery to a demo house or pickup at the restaurant.</p><div className="mission-illustration">🍔 <span>+</span> 🍟 <span>+</span> 🥤</div><WalkButton id="counter" {...{position,move}}/>{atCounter&&<button className="game-primary" onClick={()=>setMenuOpen(true)}>Open menu →</button>}</>}
    {menuOpen&&(!order||editing)&&<form onSubmit={place} className="game-menu">
      {!editing&&<><label>Your name<input value={name} maxLength="40" required onChange={e=>setName(e.target.value)}/></label><div className="fulfillment-choice"><button type="button" className={fulfillment==='delivery'?'chosen':''} onClick={()=>setFulfillment('delivery')}>🛵 Delivery</button><button type="button" className={fulfillment==='pickup'?'chosen':''} onClick={()=>setFulfillment('pickup')}>🛍 Pickup</button></div>{fulfillment==='delivery'&&<label>Demo destination<select value={homeId} onChange={e=>setHomeId(e.target.value)}>{config.homes.map(home=><option key={home.id} value={home.id}>{home.name} · {home.distanceKm} km · {home.travelSeconds}s demo trip</option>)}</select></label>}</>}
      <h3>{editing?'Edit the unstarted ticket':'Choose your meal'}</h3>
      {Object.entries(config.catalog).map(([sku,item])=>{const limit=itemLimit(sku,cart,stock,config.catalog);return <div className="game-menu-item" key={sku}><span className="food-art">{FOOD[sku]}</span><div><b>{item.name}</b><small>Up to {limit} from stock</small></div><QuantityEditor name={item.name} value={cart[sku]||0} limit={limit} change={n=>setCart(c=>({...c,[sku]:n}))}/></div>;})}
      {shortage&&<div className="cart-warning">Stock changed: {config.ingredients[shortage.id]} needs {shortage.required}, but only {shortage.available} is available. Reduce the quantity or ask Owner to restock.</div>}
      <div className="row wrap"><button type="button" onClick={()=>setCart({...EMPTY})}>Clear all items</button>{editing&&<button type="button" onClick={()=>{setEditing(false);setMenuOpen(false);}}>Keep current order</button>}</div>
      <button className="game-primary" disabled={!!busy||!total||!!shortage}>{editing?'Save order changes':'Place order'} · {total} items →</button><small>Quantities follow ingredients in storage and existing queued tickets.</small>
    </form>}
    {order&&!editing&&<><div className="ticket-heading"><span>{order.id}</span><b>{STATUS[order.status]}</b></div><Receipt {...{order,config}}/>
      {order.status==='queued'&&<div className="row wrap"><button disabled={!!busy} onClick={()=>{setCart({...EMPTY,...order.items});setEditing(true);setMenuOpen(true);}}>Edit / remove items</button><button disabled={!!busy} className="quiet" onClick={()=>act('/orders/'+order.id+'/cancel')}>Cancel order</button></div>}
      {issues.length>0&&<div className="game-alert">{issues.map(t=><p key={t}>{t}</p>)}</div>}
      {order.status==='packing'&&liveBag&&<div className="live-bag-preview"><b>Kitchen is packing now</b><p>{Object.entries(liveBag.counts).filter(([,n])=>n>0).map(([sku,n])=>FOOD[sku]+' ×'+n).join(' · ')||'Empty bag'}</p></div>}
      {order.verification?.status==='red'&&order.status==='packing'&&<div className="game-alert">The bag check caught a missing or extra item. The kitchen must fix it before handoff.</div>}
      {order.delivery?<DeliveryJourney {...{order,act,busy}} clockOffset={live.clockOffset}/>:order.status==='ready'?<><div className="reference-card"><small>YOUR PICKUP REFERENCE</small><b>{order.pickupCode}</b></div><WalkButton id="pickup" {...{position,move}}/><button className="game-primary" disabled={!!busy||!atPickup} onClick={()=>act('/orders/'+order.id+'/collect',{code:order.pickupCode})}>Show reference & collect bag</button></>:null}
      {['queued','preparing','packing'].includes(order.status)&&<><div className="waiting-message"><span className="waiting-dot"/>{order.status==='queued'?'Waiting for Kitchen to accept your ticket. You can still edit the items.':order.status==='preparing'?'The kitchen is working at the required stations.':'Your bag is being assembled and checked.'}</div><WalkButton id="lounge" {...{position,move}}>Take a seat nearby</WalkButton><p className="hint">On the other Mac, select {order.id} in Kitchen.</p></>}
      {order.status==='collected'&&!left&&<><WalkButton id="exit" {...{position,move}}/><button className="game-primary" disabled={!atExit} onClick={()=>setLeft(true)}>Leave restaurant →</button></>}
      {completed&&<button className="game-primary" onClick={again}>Play another order</button>}
    </>}
  </aside>;
}

function PackBag({ order, state, config, act, busy, onBagChange }) {
  const [counts,setCounts] = useState({...EMPTY}), [confirmed,setConfirmed] = useState(false);
  const [checkedBag,setCheckedBag] = useState(null);
  const signature = JSON.stringify(counts);
  const fresh = checkedBag === signature && order.verification?.mode === 'game';
  const stock = availableInventory(state,config.catalog);
  for(const [sku,n] of Object.entries(order.items)) for(const [ingredient,units] of Object.entries(config.catalog[sku].ingredients)) stock[ingredient]=(stock[ingredient]||0)+n*units;
  async function check() {
    const r=await act('/orders/'+order.id+'/verify',{mode:'game',observation:{quality:'clear',occluded:false,items:Object.entries(counts).map(([sku,count])=>({sku,count,certainty:'clear'})),notes:['Player assembled this simulated bag. No camera inference or physical food check performed.']}},'Checking your game bag…');
    if(r){setCheckedBag(signature);setConfirmed(false);}
  }
  function change(sku,count){setCounts(c=>({...c,[sku]:count}));setConfirmed(false);setCheckedBag(null);}
  const checkResult=fresh?order.verification:null;
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  useEffect(()=>{onBagChange({orderId:order.id,counts});return()=>onBagChange(null);},[signature,order.id]);
  return <div className="pack-game"><p>Tap the shelf to add items. Use − to remove one, × to remove a type, or Clear bag to start over.</p><div className="food-shelf">{Object.entries(config.catalog).map(([sku,item])=><button type="button" key={sku} disabled={!!busy||counts[sku]>=itemLimit(sku,counts,stock,config.catalog)} onClick={()=>change(sku,counts[sku]+1)} aria-label={'Pack '+item.name}><span>{FOOD[sku]}</span><small>{item.name}</small><b>+</b></button>)}</div><div className="bag-zone"><span className="bag-label">YOUR BAG · {total} ITEMS</span>{total?Object.entries(config.catalog).filter(([sku])=>counts[sku]>0).map(([sku,item])=><div className="bag-count-row" key={sku}><span>{FOOD[sku]}</span><b>{item.name}</b><QuantityEditor name={'bag '+item.name} value={counts[sku]} limit={itemLimit(sku,counts,stock,config.catalog)} disabled={!!busy} change={n=>change(sku,n)}/></div>):<span className="empty-bag">🛍️<small>Fill this bag from the shelf</small></span>}</div><button type="button" disabled={!!busy||!total} onClick={()=>{setCounts({...EMPTY});setConfirmed(false);setCheckedBag(null);}}>Clear bag</button><button className="game-primary" disabled={!!busy} onClick={check}>Check game bag →</button>{checkResult&&<div className={'bag-result '+checkResult.status}><b>{checkResult.status==='green'?'✓ Bag matches the ticket':'Something is missing or extra'}</b>{checkResult.rows.filter(r=>r.expected!==r.observed).map(r=><p key={r.sku}>{r.name}: {r.observed} of {r.expected}</p>)}</div>}{checkResult?.status==='green'&&<><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked this game bag</label><button className="game-primary" disabled={!!busy||!confirmed} onClick={()=>act('/orders/'+order.id+'/ready',{verificationId:checkResult.id})}>Seal bag & send to pickup →</button></>}<small>Any item change requires a new check. Optional camera remains in Detailed controls.</small></div>;
}

function KitchenMission({state,config,act,busy,position,move,order,interact,setInteract,live,onBagChange}) {
  const [cooking,setCooking]=useState(null);
  const timer=useRef(null);
  useEffect(()=>()=>clearTimeout(timer.current),[order?.id,order?.status]);
  useEffect(()=>setCooking(null),[order?.id,order?.status]);
  useEffect(()=>{if(cooking&&!nearSpot(position,cooking)){clearTimeout(timer.current);setCooking(null);}},[position,cooking]);
  useEffect(()=>{
    if(!interact)return;
    setInteract(0);
    if(!order||busy||cooking||orderProblems(order,state,config).length)return;
    if(order.status==='queued'&&nearSpot(position,'tickets'))act('/orders/'+order.id+'/prepare');
    if(order.status==='preparing'){
      const required=requiredStations(order,config.catalog);
      const station=required.find(id=>!order.gameStations?.includes(id)&&nearSpot(position,id));
      if(station)cook(station);
      else if(!required.length&&nearSpot(position,'packing'))cook('packing');
    }
  },[interact]);
  if(!order) return <aside className="mission-panel"><div className="mission-eyebrow">PLAYER 02 / KITCHEN</div><h2>No tickets yet.</h2><p>The restaurant starts with zero orders. Ask the other Mac to open Customer, walk to the counter, and place the first order.</p><p>It will appear in the ticket strip below the room. Select it, accept it at Order tickets, then follow the cooking and packing steps.</p><a href="/?view=customer" target="_blank" rel="noreferrer">Open Customer in another tab ↗</a></aside>;
  const stations=requiredStations(order,config.catalog), done=order.gameStations || [];
  const remaining=stations.filter(id=>!done.includes(id));
  const atStation=remaining.find(id=>nearSpot(position,id));
  const next=order.status==='queued'?'tickets':order.status==='preparing'?(remaining[0]||'packing'):'packing';
  const current=['queued','preparing','packing','ready','out_for_delivery','delivered','collected'].indexOf(order.status);
  const issues=orderProblems(order,state,config);
  function cook(id) {
    setCooking(id);
    timer.current=setTimeout(async()=>{
      await act('/orders/'+order.id+'/game-cook',{station:id},'Completing station task…');
      setCooking(null);
    },1800);
  }
  return <aside className="mission-panel"><div className="mission-eyebrow">PLAYER 02 / KITCHEN</div><h2>{order.id} <span className="guest-name">for {order.customer}</span></h2><Steps labels={['Ticket','Cook','Pack','Handoff']} current={Math.min(4,current)}/><Receipt {...{order,config}}/>{issues.length>0&&<div className="game-alert">{issues.map(t=><p key={t}>{t}</p>)}<small>Owner controls can restore stock or capacity.</small></div>}
    {order.status==='queued'&&<><p>Pick up this ticket at the pass. Accepting it reserves the ingredients.</p><WalkButton id="tickets" {...{position,move}}/><button className="game-primary" disabled={!!busy||!nearSpot(position,'tickets')||issues.length>0} onClick={()=>act('/orders/'+order.id+'/prepare')}>Accept ticket & start cooking →</button></>}
    {order.status==='preparing'&&<><p>Visit every required cooking station. Each task takes two game seconds.</p><div className="station-checklist">{stations.map(id=><button key={id} className={done.includes(id)?'task-done':''} onClick={()=>move(SPOTS[id])}><span>{done.includes(id)?'✓':'⌖'}</span>{SPOTS[id].name}<small>{done.includes(id)?'Completed':'Walk here'}</small></button>)}</div>{!stations.length&&<WalkButton id="packing" {...{position,move}}>Walk to drinks / packing</WalkButton>}{cooking?<div className="cooking-progress" role="status"><b>Working at {SPOTS[cooking].name}…</b><div><span/></div></div>:<button className="game-primary" disabled={!!busy||issues.length>0||(!atStation&&!(stations.length===0&&nearSpot(position,'packing')))} onClick={()=>cook(atStation||'packing')}>{atStation?'Prepare at '+SPOTS[atStation].name:stations.length===0?'Get drinks ready':'Walk to a cooking station'}</button>}<small>Station completion is shared across devices. These actions simulate cooking.</small></>}
    {order.status==='packing'&&(nearSpot(position,'packing')?<><h3>Build the right bag.</h3><PackBag key={order.id} {...{order,state,config,act,busy,onBagChange}}/></>:<><p>Food is ready. Carry it to the packing bench and assemble the order.</p><WalkButton id="packing" {...{position,move}}/></>)}
    {order.delivery&&['ready','out_for_delivery','delivered'].includes(order.status)&&<DeliveryJourney {...{order,act,busy}} clockOffset={live.clockOffset}/>}
    {order.status==='ready'&&!order.delivery&&<><div className="completion-stamp">✓<span>VERIFIED.<br/>READY FOR PICKUP.</span></div><p>The customer collects from their screen.</p><div className="reference-card"><small>MATCH AT HANDOFF</small><b>{order.pickupCode}</b></div><button disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/recheck')}>Reopen bag for a recheck</button></>}
    {order.status==='collected'&&<><div className="completion-stamp">✓<span>PICKUP<br/>CONFIRMED.</span></div><p>The matching bag was collected.</p></>}
    {order.status==='cancelled'&&<p>This unstarted ticket was cancelled. Its stock is available again.</p>}
    {(order.status==='preparing'&&!atStation&&!cooking&&stations.length>0)&&<WalkButton id={next} {...{position,move}}>Go to next task →</WalkButton>}
  </aside>;
}

function OwnerMission({state,act,busy}) {
  const [running,setRunning]=useState('');
  const [selected,setSelected]=useState('');
  const scenario=state.scenarios.find(s=>s.id===selected)||(state.orders.length ? state.scenarios[0] : undefined);
  const challenges=[{name:'One worker down',icon:'👨‍🍳',detail:'Leo cannot make the shift',changes:{absentWorker:'leo'}},{name:'No chicken today',icon:'📦',detail:'An ingredient delivery is missing',changes:{shortage:'chicken'}},{name:'Lunch rush',icon:'⚡',detail:'Six more tickets arrive at once',changes:{rush:true}},{name:'Fryer breakdown',icon:'🔧',detail:'A station goes offline',changes:{equipmentDown:'fryer'}}];
  async function challenge(c) {setRunning(c.name);const r=await act('/scenarios',{name:c.name,changes:c.changes},'Comparing recovery strategies…');if(r)setSelected(r.scenarioId);setRunning('');}
  return <aside className="mission-panel owner-mission"><div className="mission-eyebrow">MISSION CONTROL / OWNER</div><h2>Keep the kitchen moving.</h2><p>Watch live tickets on the floor, or choose a challenge and compare how the team recovers.</p><div className="challenge-grid">{challenges.map(c=><button key={c.name} disabled={!!busy||!!running} onClick={()=>challenge(c)}><span>{c.icon}</span><b>{c.name}</b><small>{c.detail}</small></button>)}</div>{scenario&&<div className="challenge-result"><small>SELECTED CHALLENGE</small><select aria-label="Game saved challenge" value={scenario.id} onChange={e=>setSelected(e.target.value)}>{state.scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="score-comparison"><div><small>FIXED PLAN</small><b>{scenario.comparison.baseline.metrics.completed}<span>/{scenario.comparison.baseline.metrics.total}</span></b><small>orders completed</small></div><div><small>RECOVERY</small><b>{scenario.comparison.recovery.metrics.completed}<span>/{scenario.comparison.recovery.metrics.total}</span></b><small>orders completed</small></div></div><div className="row"><button disabled={!!busy} onClick={()=>act('/playback',{scenarioId:scenario.id,policy:'fixed'})}>▶ Fixed</button><button className="game-primary" disabled={!!busy} onClick={()=>act('/playback',{scenarioId:scenario.id,policy:'adaptive'})}>▶ Recovery</button></div><button className="walk-button" disabled={!!busy||scenario.snapshot.version!==state.version} onClick={()=>act('/scenarios/'+scenario.id+'/apply')}>Apply challenge to live kitchen</button>{scenario.snapshot.version!==state.version&&<small>Live kitchen changed. Choose a challenge again to compare a fresh snapshot.</small>}<small>Replay previews a separate 60-minute simulation; live tickets stay unchanged.</small></div>}{state.playback&&<button onClick={()=>act('/playback',{action:'stop'})}>Stop replay / show live floor</button>}<details><summary>Reset for another round</summary><p>This clears all live tickets and restores resources on both Macs. You start again with zero orders. Saved challenges remain.</p><button className="danger" disabled={!!busy} onClick={async()=>{const r=await act('/reset');if(r)setSelected('');}}>Reset demo restaurant</button></details></aside>;
}

function DisplayMission({state,config}) {
  return <aside className="mission-panel"><div className="mission-eyebrow">SPECTATOR / LIVE FEED</div><h2>Every ticket has a journey.</h2><p>Orders, packing failures, pickup, and disruptions sync from the two players.</p><div className="spectator-counts">{Object.entries(STATUS).map(([key,label])=><div key={key}><b>{state.orders.filter(o=>o.status===key).length}</b><span>{label}</span></div>)}</div><h3>Latest events</h3><div className="game-events">{state.events.slice(0,5).map(e=><p key={e.id}>{e.message}</p>)}</div></aside>;
}

export default function Game({role,state,config,act,busy,live,compact=false}) {
  const [selected,setSelected]=useState(()=>role==='customer'?localStorage.getItem('nova-game-order')||'':new URLSearchParams(location.search).get('order')||localStorage.getItem('nova-game-kitchen-order')||'');
  const presence=usePlayerPresence(role,live,role==='customer'?selected:'');
  const {position,walking,move,step}=useWalk(role,presence.publish);
  const [interact,setInteract]=useState(0);
  const [interactionHint,setInteractionHint]=useState('');
  const order=state.orders.find(o=>o.id===selected)||(role==='kitchen'?[...state.orders].reverse().find(o=>!['collected','delivered','cancelled'].includes(o.status)):undefined);
  useEffect(()=>{if(role==='kitchen'&&order&&!state.orders.some(o=>o.id===selected))setSelected(order.id);},[role,order?.id,selected,state.orders]);
  const active=state.orders.filter(o=>!['collected','delivered','cancelled'].includes(o.status)).length, collected=state.orders.filter(o=>['collected','delivered'].includes(o.status)).length, flagged=state.orders.filter(o=>o.status==='packing'&&o.verification?.status==='red').length;
  function interactNearby() {
    setInteract(n=>n+1);
    const nearby=(role==='kitchen'?KITCHEN_SPOTS:role==='owner'?['office',...KITCHEN_SPOTS,...CUSTOMER_SPOTS]:CUSTOMER_SPOTS).find(id=>nearSpot(position,id));
    setInteractionHint(nearby?SPOTS[nearby].name+' reached. Use the action in your mission panel.':'Walk to a marked spot to interact.');
  }
  return <section className="game-experience"><div className="game-titlebar"><div><span className="game-kicker">NOVA / RESTAURANT SIMULATOR</span><h1>{role==='customer'?'A lunch run. A live kitchen.':role==='kitchen'?'Take the ticket. Make it happen.':role==='owner'?'Run the shift. Handle the unexpected.':'The whole restaurant, in motion.'}</h1></div><div className="shift-score"><div><b>{active}</b><small>IN PLAY</small></div><div><b>{collected}</b><small>SERVED</small></div><div className={flagged?'score-warning':''}><b>{flagged}</b><small>BAG FLAGS</small></div></div></div>
    <PageGuide role={role} compact={compact}/>
    <div className="game-layout"><div className="game-world-column"><Restaurant {...{role,state,config,selected:order,position,walking,move,step,live}} playerId={presence.id} onInteract={interactNearby}/><div className={"presence-indicator "+(live.presenceError?"error":"")}><i className="live-dot"/>{live.presenceError||("Live movement · "+live.players.length+" connected players · syncs across devices")}</div>{interactionHint&&<div className="interaction-hint" role="status">{interactionHint}</div>}
      {role==='kitchen'&&<div className="ticket-strip"><div className="ticket-strip-title"><b>LIVE TICKETS</b><small>Newest first · select an order to play</small></div><div>{[...state.orders].reverse().map(o=><button key={o.id} className={o.id===order?.id?'active-ticket':''} onClick={()=>{setSelected(o.id);localStorage.setItem('nova-game-kitchen-order',o.id);}}><b>{o.id}</b><span>{o.customer}</span><small>{STATUS[o.status]}</small>{o.verification?.status==='red'&&<i>!</i>}</button>)}</div></div>}
      {role!=='kitchen'&&<div className="floor-legend"><span><i className="legend-you"/>Your player</span><span><i className="legend-staff"/>Kitchen team</span><span>● Customers reflect shared order stages</span><small>Player movement, tickets, packing, resources, and courier progress sync across devices.</small></div>}
      {(role==='owner'||role==='display')&&<div className="live-order-lane">{[...state.orders].reverse().slice(0,8).map(o=><div key={o.id}><span>{o.id} · {o.customer}</span><b>{STATUS[o.status]}</b><small>{Object.entries(o.items).map(([sku,n])=>FOOD[sku]+'×'+n).join(' ')}</small></div>)}</div>}
    </div>
      {role==='customer'&&<CustomerMission {...{state,config,act,busy,position,move,selected,setSelected,interact,setInteract,live}}/>}
      {role==='kitchen'&&<KitchenMission key={order?.id} {...{state,config,act,busy,position,move,order,interact,setInteract,live}} onBagChange={presence.publishBag}/>}
      {role==='owner'&&<OwnerMission {...{state,act,busy}}/>}
      {role==='display'&&<DisplayMission {...{state,config}}/>}
    </div>
    {(role==='owner'||role==='display')&&<div className="live-bags">{live.players.filter(p=>p.packing&&state.orders.some(o=>o.id===p.packing.orderId&&o.status==='packing')).map(p=><div className="live-bag-preview" key={p.id}><b>Live packing · {p.packing.orderId}</b><p>{Object.entries(p.packing.counts).filter(([,n])=>n>0).map(([sku,n])=>FOOD[sku]+' ×'+n).join(' · ')||'Empty bag'}</p></div>)}</div>}
    {(role==='owner'||role==='display')&&<DeliveryBoard {...{state,act,busy}} clockOffset={live.clockOffset} readOnly={role==='display'}/> }
  </section>;
}
