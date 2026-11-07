import React, { useEffect, useRef, useState } from 'react';
import { SPOTS, CUSTOMER_SPOTS, KITCHEN_SPOTS, TILE, findPath, walkable, nearSpot, requiredStations, orderProblems } from './game-logic.mjs';
import './game.css';

const FOOD = { burger: '🍔', wrap: '🌯', fries: '🍟', sprite: '🥤' };
const STATUS = { queued: 'Ticket received', preparing: 'On the cook line', packing: 'Bag check', ready: 'Ready to collect', collected: 'Collected' };
const EMPTY = { burger: 0, wrap: 0, fries: 0, sprite: 0 };
const pixel = p => ({ x: p.x * TILE + 20, y: p.y * TILE + 20 });

function useWalk(role) {
  const spawn = role === 'kitchen' ? { x: 11, y: 6 } : { x: 3, y: 13 };
  const [position, setPosition] = useState(spawn);
  const [walking, setWalking] = useState(false);
  const positionRef = useRef(spawn), route = useRef([]);
  useEffect(() => {
    const id = setInterval(() => {
      const next = route.current.shift();
      if (next) { positionRef.current = next; setPosition(next); }
      setWalking(route.current.length > 0);
    }, 115);
    return () => clearInterval(id);
  }, []);
  function move(target) { route.current = findPath(role, positionRef.current, target); setWalking(route.current.length > 0); }
  function step(dx, dy) {
    route.current = [];
    const p = positionRef.current, next = { x: p.x + dx, y: p.y + dy };
    if (walkable(role, next.x, next.y)) { positionRef.current = next; setPosition(next); }
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

function Restaurant({ role, state, config, selected, position, walking, move, step, onInteract }) {
  const room = useRef(null);
  const [tick, setTick] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setTick(Date.now()), 150); return () => clearInterval(id); }, []);
  const observer = role === 'owner' || role === 'display';
  const spots = role === 'kitchen' ? KITCHEN_SPOTS : CUSTOMER_SPOTS;
  const playback = observer && state.playback && state.scenarios.find(s => s.id === state.playback.scenarioId);
  const replay = playback && (state.playback.policy === 'fixed' ? playback.comparison.baseline : playback.comparison.recovery);
  const minute = replay ? Math.min(60, (tick - state.playback.startedAt) / 1000 * state.playback.speed) : 0;
  const activity = replay ? replay.schedule.filter(t => t.start <= minute && t.end > minute) : [];
  const activeStation = id => replay ? activity.some(t => t.station === id) : state.orders.some(o => o.status === 'preparing' && requiredStations(o, config.catalog).includes(id) && !o.gameStations?.includes(id));
  const stationAvailable = id => replay ? playback.snapshot.stations.find(s => s.id === id)?.available && playback.changes.equipmentDown !== id : state.stations.find(s => s.id === id)?.available;
  const visitors = (role === 'customer' ? state.orders.filter(o => o.id !== selected?.id) : state.orders).filter(o => o.status !== 'collected').slice(-5);
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
        {!observer && <Person {...local} color={role === 'kitchen' ? '#527d69' : '#e09e4b'} chef={role === 'kitchen'} name="YOU" you walking={walking}/>}
      </svg>
    </div>
    <div className="room-bottomline">{observer ? <span>Orders and resource availability are shared across all devices.</span> : <><span><kbd>W A S D</kbd> / arrows to walk · click floor to move · <kbd>E</kbd> interact</span><button className="quiet" onClick={onInteract}>Interact nearby ↵</button></>}</div>
  </div>;
}

function Steps({ labels, current }) { return <ol className="game-steps">{labels.map((label,i) => <li key={label} className={i < current ? 'done' : i === current ? 'current' : ''}><span>{i < current ? '✓' : i+1}</span>{label}</li>)}</ol>; }
function WalkButton({ id, position, move, children }) { return <button className="walk-button" onClick={() => move(SPOTS[id])}>{nearSpot(position,id) ? '↗ ' : '⌖ '}{children || 'Walk to ' + SPOTS[id].name}</button>; }
function Receipt({ order, config }) { return <div className="game-receipt">{Object.entries(order.items).map(([sku,n]) => <div key={sku}><span>{FOOD[sku]} {config.catalog[sku].name}</span><b>×{n}</b></div>)}</div>; }

function CustomerMission({ state, config, act, busy, position, move, selected, setSelected, interact, setInteract }) {
  const [name, setName] = useState(() => localStorage.getItem('nova-game-name') || 'Demo guest');
  const [cart, setCart] = useState({ burger: 1, fries: 1, sprite: 1, wrap: 0 });
  const [menuOpen, setMenuOpen] = useState(false), [left, setLeft] = useState(false);
  const order = state.orders.find(o => o.id === selected);
  const atCounter = nearSpot(position,'counter'), atPickup = nearSpot(position,'pickup'), atExit = nearSpot(position,'exit');
  const issues = orderProblems(order,state,config);
  useEffect(() => { if (!atCounter) setMenuOpen(false); }, [atCounter]);
  useEffect(() => {
    if (!interact) return;
    if (atCounter && !order) setMenuOpen(true);
    else if (atPickup && order?.status === 'ready' && !busy) act('/orders/'+order.id+'/collect',{code:order.pickupCode});
    else if (atExit && order?.status === 'collected') setLeft(true);
    setInteract(0);
  }, [interact, atCounter]);
  async function place(e) {
    e.preventDefault();
    const r = await act('/orders', {customer:name,items:cart}, 'Sending your order to the kitchen…');
    if (r) { setSelected(r.orderId); localStorage.setItem('nova-game-order',r.orderId); localStorage.setItem('nova-game-name',name); setMenuOpen(false); setLeft(false); move(SPOTS.lounge); }
  }
  const current = !order ? 0 : order.status === 'collected' ? 4 : order.status === 'ready' ? 3 : 2;
  return <aside className="mission-panel">
    <div className="mission-eyebrow">PLAYER 01 / CUSTOMER</div>
    <h2>{left ? 'Thanks for stopping by.' : !order ? 'Your lunch break starts here.' : order.status === 'collected' ? 'Order complete!' : order.status === 'ready' ? 'Your order is up.' : 'The kitchen has your ticket.'}</h2>
    <Steps labels={['Walk in','Order','Wait','Collect']} current={menuOpen && !order ? 1 : current}/>
    {!order && !menuOpen && <><p>Walk up to the counter, open the menu, and build your lunch.</p><div className="mission-illustration">🍔 <span>+</span> 🍟 <span>+</span> 🥤</div><WalkButton id="counter" {...{position,move}}/>{atCounter && <button className="game-primary" onClick={() => setMenuOpen(true)}>Open menu →</button>}</>}
    {menuOpen && (!order || order.status === 'collected') && <form onSubmit={place} className="game-menu"><label>Your name<input value={name} maxLength="40" required onChange={e => setName(e.target.value)}/></label><h3>What sounds good?</h3>{Object.entries(config.catalog).map(([sku,item]) => <div className="game-menu-item" key={sku}><span className="food-art">{FOOD[sku]}</span><div><b>{item.name}</b><small>{sku === 'sprite' ? 'Cold & refreshing' : sku === 'fries' ? 'Golden & crispy' : 'Made to order'}</small></div><div className="stepper"><button type="button" aria-label={'Remove ' + item.name} disabled={!cart[sku]} onClick={() => setCart(c => ({...c,[sku]:Math.max(0,c[sku]-1)}))}>−</button><b>{cart[sku]}</b><button type="button" aria-label={'Add ' + item.name} disabled={cart[sku]>=6} onClick={() => setCart(c => ({...c,[sku]:Math.min(6,c[sku]+1)}))}>+</button></div></div>)}<button className="game-primary" disabled={!!busy || !Object.values(cart).some(Boolean)}>Place order · {Object.values(cart).reduce((a,b)=>a+b,0)} items →</button><small>Demo menu · no payment required</small></form>}
    {order && order.status !== 'collected' && <><div className="ticket-heading"><span>{order.id}</span><b>{STATUS[order.status]}</b></div><Receipt {...{order,config}}/>{issues.length > 0 && <div className="game-alert"><b>A little hold-up</b>{issues.map(t => <p key={t}>{t}</p>)}<small>The operator can restore resources or try a recovery drill.</small></div>}{order.verification?.status === 'red' && <div className="game-alert">The bag check caught a missing or extra item. Your order stays with the kitchen until it matches.</div>}{order.status === 'ready' ? <><div className="reference-card"><small>YOUR PICKUP REFERENCE</small><b>{order.pickupCode}</b></div><WalkButton id="pickup" {...{position,move}}/><button className="game-primary" disabled={!!busy || !atPickup} onClick={() => act('/orders/'+order.id+'/collect',{code:order.pickupCode})}>Show reference & collect bag</button>{!atPickup && <small>Walk to pickup before collecting.</small>}</> : <><div className="waiting-message"><span className="waiting-dot"/>{order.status === 'queued' ? 'Waiting for the kitchen player to accept your ticket.' : order.status === 'preparing' ? 'Your food is moving through the cooking stations.' : 'The kitchen player is filling and checking your bag.'}</div><WalkButton id="lounge" {...{position,move}}>Take a seat nearby</WalkButton><p className="hint">On Mac 1, switch to Kitchen and select {order.id}.</p></>}</>}
    {order?.status === 'collected' && !menuOpen && <><div className="completion-stamp">✓<span>RIGHT ORDER.<br/>RIGHT CUSTOMER.</span></div><p>{order.customer}, your bag made it through preparation, packing verification, and matching pickup.</p>{!left ? <><WalkButton id="exit" {...{position,move}}/><button className="game-primary" disabled={!atExit} onClick={() => setLeft(true)}>Leave restaurant →</button></> : <button className="game-primary" onClick={() => {setSelected('');localStorage.removeItem('nova-game-order');setLeft(false);}}>Play another order</button>}</>}
  </aside>;
}

function PackBag({ order, config, act, busy }) {
  const [counts,setCounts] = useState(EMPTY), [confirmed,setConfirmed] = useState(false);
  const [checkedBag,setCheckedBag] = useState('');
  const signature = JSON.stringify(counts);
  const fresh = checkedBag === signature && order.verification?.mode === 'game';
  async function check() {
    const r = await act('/orders/'+order.id+'/verify',{mode:'game',observation:{quality:'clear',occluded:false,items:Object.entries(counts).map(([sku,count])=>({sku,count,certainty:'clear'})),notes:['Player assembled this simulated bag. No camera inference or physical food check performed.']}},'Checking your game bag…');
    if(r) {setCheckedBag(signature);setConfirmed(false);}
  }
  function change(sku,delta) {setCounts(c=>({...c,[sku]:Math.max(0,Math.min(12,c[sku]+delta))}));setConfirmed(false);}
  const contents = Object.entries(counts).flatMap(([sku,n])=>Array.from({length:n},(_,i)=>({sku,key:sku+i})));
  const checkResult = fresh ? order.verification : null;
  return <div className="pack-game"><p>Tap the shelf to add items. Tap an item in the bag to take it out.</p><div className="food-shelf">{Object.entries(config.catalog).map(([sku,item])=><button key={sku} disabled={!!busy || counts[sku]>=12} onClick={()=>change(sku,1)} aria-label={'Pack '+item.name}><span>{FOOD[sku]}</span><small>{item.name}</small><b>+</b></button>)}</div><div className="bag-zone"><span className="bag-label">YOUR BAG · {contents.length} ITEMS</span>{contents.length ? <div className="bag-items">{contents.map(({sku,key})=><button key={key} onClick={()=>change(sku,-1)} aria-label={'Take '+config.catalog[sku].name+' out of bag'}>{FOOD[sku]}</button>)}</div> : <span className="empty-bag">🛍️<small>Fill this bag from the shelf</small></span>}</div><button className="game-primary" disabled={!!busy} onClick={check}>Check game bag →</button>{checkResult && <div className={'bag-result '+checkResult.status}><b>{checkResult.status === 'green' ? '✓ Bag matches the ticket' : 'Something is missing or extra'}</b>{checkResult.rows.filter(r=>r.expected!==r.observed).map(r=><p key={r.sku}>{r.name}: {r.observed} of {r.expected}</p>)}</div>}{signature !== checkedBag && checkedBag && <small>Bag changed. Check it again before handoff.</small>}{checkResult?.status==='green' && <><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked this game bag</label><button className="game-primary" disabled={!!busy || !confirmed} onClick={()=>act('/orders/'+order.id+'/ready',{verificationId:checkResult.id})}>Seal bag & send to pickup →</button></>}<small>Simulated packing · optional camera remains in Detailed controls.</small></div>;
}

function KitchenMission({state,config,act,busy,position,move,order,interact,setInteract}) {
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
  if(!order) return <aside className="mission-panel"><h2>No tickets yet.</h2><p>Ask the customer player to place an order.</p></aside>;
  const stations=requiredStations(order,config.catalog), done=order.gameStations || [];
  const remaining=stations.filter(id=>!done.includes(id));
  const atStation=remaining.find(id=>nearSpot(position,id));
  const next=order.status==='queued'?'tickets':order.status==='preparing'?(remaining[0]||'packing'):'packing';
  const current=['queued','preparing','packing','ready','collected'].indexOf(order.status);
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
    {order.status==='packing'&&(nearSpot(position,'packing')?<><h3>Build the right bag.</h3><PackBag key={order.id} {...{order,config,act,busy}}/></>:<><p>Food is ready. Carry it to the packing bench and assemble the order.</p><WalkButton id="packing" {...{position,move}}/></>)}
    {order.status==='ready'&&<><div className="completion-stamp">✓<span>VERIFIED.<br/>READY FOR PICKUP.</span></div><p>Ask the customer player to walk to Pickup and show their reference.</p><div className="reference-card"><small>MATCH AT HANDOFF</small><b>{order.pickupCode}</b></div><button disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/recheck')}>Reopen bag for a recheck</button></>}
    {order.status==='collected'&&<><div className="completion-stamp">✓<span>ORDER<br/>DELIVERED.</span></div><p>Matching pickup confirmed. Choose another ticket below the room.</p></>}
    {(order.status==='preparing'&&!atStation&&!cooking&&stations.length>0)&&<WalkButton id={next} {...{position,move}}>Go to next task →</WalkButton>}
  </aside>;
}

function OwnerMission({state,act,busy}) {
  const [running,setRunning]=useState('');
  const [selected,setSelected]=useState('');
  const scenario=state.scenarios.find(s=>s.id===selected)||state.scenarios[0];
  const challenges=[{name:'One worker down',icon:'👨‍🍳',detail:'Leo cannot make the shift',changes:{absentWorker:'leo'}},{name:'No chicken today',icon:'📦',detail:'An ingredient delivery is missing',changes:{shortage:'chicken'}},{name:'Lunch rush',icon:'⚡',detail:'Six more tickets arrive at once',changes:{rush:true}},{name:'Fryer breakdown',icon:'🔧',detail:'A station goes offline',changes:{equipmentDown:'fryer'}}];
  async function challenge(c) {setRunning(c.name);const r=await act('/scenarios',{name:c.name,changes:c.changes},'Comparing recovery strategies…');if(r)setSelected(r.scenarioId);setRunning('');}
  return <aside className="mission-panel owner-mission"><div className="mission-eyebrow">MISSION CONTROL / OWNER</div><h2>Keep the kitchen moving.</h2><p>Watch live tickets on the floor, or choose a challenge and compare how the team recovers.</p><div className="challenge-grid">{challenges.map(c=><button key={c.name} disabled={!!busy||!!running} onClick={()=>challenge(c)}><span>{c.icon}</span><b>{c.name}</b><small>{c.detail}</small></button>)}</div>{scenario&&<div className="challenge-result"><small>SELECTED CHALLENGE</small><select aria-label="Game saved challenge" value={scenario.id} onChange={e=>setSelected(e.target.value)}>{state.scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><div className="score-comparison"><div><small>FIXED PLAN</small><b>{scenario.comparison.baseline.metrics.completed}<span>/{scenario.comparison.baseline.metrics.total}</span></b><small>orders completed</small></div><div><small>RECOVERY</small><b>{scenario.comparison.recovery.metrics.completed}<span>/{scenario.comparison.recovery.metrics.total}</span></b><small>orders completed</small></div></div><div className="row"><button disabled={!!busy} onClick={()=>act('/playback',{scenarioId:scenario.id,policy:'fixed'})}>▶ Fixed</button><button className="game-primary" disabled={!!busy} onClick={()=>act('/playback',{scenarioId:scenario.id,policy:'adaptive'})}>▶ Recovery</button></div><button className="walk-button" disabled={!!busy||scenario.snapshot.version!==state.version} onClick={()=>act('/scenarios/'+scenario.id+'/apply')}>Apply challenge to live kitchen</button>{scenario.snapshot.version!==state.version&&<small>Live kitchen changed. Choose a challenge again to compare a fresh snapshot.</small>}<small>Replay previews a separate 60-minute simulation; live tickets stay unchanged.</small></div>}{state.playback&&<button onClick={()=>act('/playback',{action:'stop'})}>Stop replay / show live floor</button>}<details><summary>Reset for another round</summary><p>This resets live tickets and resources on both Macs. Saved challenges remain.</p><button className="danger" disabled={!!busy} onClick={()=>act('/reset')}>Reset demo restaurant</button></details></aside>;
}

function DisplayMission({state,config}) {
  return <aside className="mission-panel"><div className="mission-eyebrow">SPECTATOR / LIVE FEED</div><h2>Every ticket has a journey.</h2><p>Orders, packing failures, pickup, and disruptions sync from the two players.</p><div className="spectator-counts">{Object.entries(STATUS).map(([key,label])=><div key={key}><b>{state.orders.filter(o=>o.status===key).length}</b><span>{label}</span></div>)}</div><h3>Latest events</h3><div className="game-events">{state.events.slice(0,5).map(e=><p key={e.id}>{e.message}</p>)}</div></aside>;
}

export default function Game({role,state,config,act,busy}) {
  const {position,walking,move,step}=useWalk(role);
  const [selected,setSelected]=useState(()=>role==='customer'?localStorage.getItem('nova-game-order')||'':new URLSearchParams(location.search).get('order')||localStorage.getItem('nova-game-kitchen-order')||'');
  const [interact,setInteract]=useState(0);
  const [interactionHint,setInteractionHint]=useState('');
  const order=state.orders.find(o=>o.id===selected)||(role==='kitchen'?[...state.orders].reverse().find(o=>o.status!=='collected'):undefined);
  useEffect(()=>{if(role==='kitchen'&&order&&!state.orders.some(o=>o.id===selected))setSelected(order.id);},[role,order?.id,selected,state.orders]);
  const active=state.orders.filter(o=>o.status!=='collected').length, collected=state.orders.filter(o=>o.status==='collected').length, flagged=state.orders.filter(o=>o.status!=='collected'&&o.verification?.status==='red').length;
  function interactNearby() {
    setInteract(n=>n+1);
    const nearby=(role==='kitchen'?KITCHEN_SPOTS:CUSTOMER_SPOTS).find(id=>nearSpot(position,id));
    setInteractionHint(nearby?SPOTS[nearby].name+' reached. Use the action in your mission panel.':'Walk to a marked spot to interact.');
  }
  return <section className="game-experience"><div className="game-titlebar"><div><span className="game-kicker">NOVA / RESTAURANT SIMULATOR</span><h1>{role==='customer'?'A lunch run. A live kitchen.':role==='kitchen'?'Take the ticket. Make it happen.':role==='owner'?'Run the shift. Handle the unexpected.':'The whole restaurant, in motion.'}</h1></div><div className="shift-score"><div><b>{active}</b><small>IN PLAY</small></div><div><b>{collected}</b><small>SERVED</small></div><div className={flagged?'score-warning':''}><b>{flagged}</b><small>BAG FLAGS</small></div></div></div>
    <div className="game-layout"><div className="game-world-column"><Restaurant {...{role,state,config,selected:order,position,walking,move,step}} onInteract={interactNearby}/>{interactionHint&&<div className="interaction-hint" role="status">{interactionHint}</div>}
      {role==='kitchen'&&<div className="ticket-strip"><div className="ticket-strip-title"><b>LIVE TICKETS</b><small>Newest first · select an order to play</small></div><div>{[...state.orders].reverse().map(o=><button key={o.id} className={o.id===order?.id?'active-ticket':''} onClick={()=>{setSelected(o.id);localStorage.setItem('nova-game-kitchen-order',o.id);}}><b>{o.id}</b><span>{o.customer}</span><small>{STATUS[o.status]}</small>{o.verification?.status==='red'&&<i>!</i>}</button>)}</div></div>}
      {role!=='kitchen'&&<div className="floor-legend"><span><i className="legend-you"/>Your player</span><span><i className="legend-staff"/>Kitchen team</span><span>● Customers reflect shared order stages</span><small>Movement is local. Tickets, packing, resources, and replays sync across devices.</small></div>}
      {(role==='owner'||role==='display')&&<div className="live-order-lane">{[...state.orders].reverse().slice(0,8).map(o=><div key={o.id}><span>{o.id} · {o.customer}</span><b>{STATUS[o.status]}</b><small>{Object.entries(o.items).map(([sku,n])=>FOOD[sku]+'×'+n).join(' ')}</small></div>)}</div>}
    </div>
      {role==='customer'&&<CustomerMission {...{state,config,act,busy,position,move,selected,setSelected,interact,setInteract}}/>}
      {role==='kitchen'&&<KitchenMission key={order?.id} {...{state,config,act,busy,position,move,order,interact,setInteract}}/>}
      {role==='owner'&&<OwnerMission {...{state,act,busy}}/>}
      {role==='display'&&<DisplayMission {...{state,config}}/>}
    </div>
  </section>;
}
