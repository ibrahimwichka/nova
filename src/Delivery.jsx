import React, { useEffect, useState } from 'react';
import { deliveryProgress } from '../shared/delivery.mjs';
import './delivery.css';

const DELIVERY_STEPS = [
  ['waiting', 'Kitchen'],
  ['at_restaurant', 'Pickup'],
  ['on_way', 'On the way'],
  ['at_home', 'At the door'],
  ['delivered', 'Confirmed'],
];

function CourierMarker({ x, y, delivered }) {
  return (
    <g className="courier-sprite" style={{ transform: `translate(${x}px, ${y}px)` }} aria-hidden="true">
      <ellipse cy="14" rx="27" ry="7" fill="#071b15" opacity=".55"/>
      {delivered ? <>
        <circle r="17" fill="#a5d5a4" stroke="#183a2e" strokeWidth="2"/>
        <path d="m-8 0 5 6 11-12" fill="none" stroke="#19382a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </> : <g className="courier-bike">
        <circle cx="-17" cy="8" r="8" fill="#172c27" stroke="#aebfb1" strokeWidth="2"/>
        <circle cx="19" cy="8" r="8" fill="#172c27" stroke="#aebfb1" strokeWidth="2"/>
        <path d="M-23 1c1-6 6-9 12-9H0l5 10h6l5-12c5 0 8 3 9 9l-6 1-8 8H-12Z" fill="#f6c584" stroke="#253831" strokeWidth="2" strokeLinejoin="round"/>
        <path d="m13 4 6-19 6-1" fill="none" stroke="#e4e8d6" strokeWidth="2.5" strokeLinecap="round"/>
        <path className="courier-headlight" d="m24-8 8 2-8 2Z" fill="#fff3ad"/>
        <rect x="-27" y="-19" width="16" height="12" rx="2.5" fill="#d58555" stroke="#253831" strokeWidth="1.5"/>
        <path d="M-22-15h6m2 5H-2" fill="none" stroke="#fbdfb6" strokeWidth="2" strokeLinecap="round"/>
      </g>}
      <rect x="-34" y="-47" width="68" height="20" rx="5" fill="#163b2e" stroke="#acc7a5"/>
      <text y="-34" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing="1" fill="#ecf5e2">{delivered ? 'ARRIVED' : 'COURIER'}</text>
    </g>
  );
}

export function DeliveryJourney({ order, act, busy, clockOffset = 0, readOnly = false }) {
  const [now,setNow] = useState(Date.now() + clockOffset);
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()+clockOffset),100); return ()=>clearInterval(timer); },[clockOffset]);
  if (!order?.delivery) return null;
  const d=order.delivery, trip=deliveryProgress(order,now);
  const label={waiting:'Kitchen preparing your order',to_restaurant:'Courier heading to restaurant',at_restaurant:'Courier waiting for pickup',on_way:'On the way to your house',at_home:'Courier at your door',delivered:'Delivery confirmed'}[trip.stage];
  const onRoad=['on_way','at_home','delivered'].includes(trip.stage);
  const x=onRoad?130+trip.progress*500:trip.stage==='to_restaurant'?60+trip.progress*70:trip.stage==='waiting'?55:130;
  const y=onRoad?150:165;
  const stageIndex = DELIVERY_STEPS.findIndex(([stage]) => stage === (trip.stage === 'to_restaurant' ? 'at_restaurant' : trip.stage));
  return <section className={'delivery-journey '+(trip.stage==='delivered'?'trip-complete':'')} aria-label={'Delivery tracking for '+order.id}>
    <div className="delivery-heading"><div><small>SIMULATED DELIVERY · {order.id}</small><h3>{label}</h3></div><span>{trip.stage==='delivered'?'✓ Delivered':trip.stage==='at_home'?'At door':onRoad?trip.seconds+'s to door':trip.stage==='to_restaurant'?trip.seconds+'s to pickup':d.distanceKm+' km'}</span></div>
    <svg className="delivery-map" viewBox="0 0 760 240" role="img" aria-label={`Simulated courier route from Nova Kitchen to ${d.name}`}>
      <rect width="760" height="240" rx="12" fill="#193b31"/>
      <g fill="none" stroke="#6d917b" strokeWidth="12" opacity=".24">
        <path d="M207 0v81l64 57v102M505 0v75l-52 64v101M0 62h184m45 0h259m37 0h235"/>
      </g>
      <g fill="#345748" stroke="#89a48a" strokeOpacity=".22">
        <rect x="272" y="22" width="76" height="24" rx="6"/><rect x="365" y="22" width="80" height="24" rx="6"/>
        <rect x="303" y="83" width="92" height="35" rx="8"/><rect x="488" y="189" width="56" height="26" rx="6"/>
      </g>
      <path d="M20 160H740" stroke="#142c26" strokeWidth="47" strokeLinecap="round"/>
      <path d="M25 160H735" stroke="#789280" strokeWidth="2" strokeDasharray="11 11"/>
      <path d="M130 160H630" stroke="#a4c5a8" strokeWidth="6" opacity=".43" strokeLinecap="round"/>
      {onRoad && <path d={`M130 160H${x}`} stroke="#ffc779" strokeWidth="6" strokeLinecap="round"/>}
      <circle cx="130" cy="160" r="7" fill="#abd0ab" stroke="#142c26" strokeWidth="2"/>
      <circle cx="630" cy="160" r="7" fill="#ffc779" stroke="#142c26" strokeWidth="2"/>
      <g transform="translate(85,27)">
        <rect y="22" width="95" height="62" rx="6" fill="#d5b183"/>
        <path d="M-9 22h113L87 0H8Z" fill="#83a590"/>
        <rect x="10" y="36" width="27" height="27" fill="#e6efe2"/>
        <rect x="61" y="39" width="20" height="45" rx="2" fill="#4d6a5b"/>
        <text x="47" y="105" textAnchor="middle" fontSize="12" fontWeight="800" fill="#eff5e5">NOVA KITCHEN</text>
      </g>
      <g transform="translate(583,20)">
        <path d="M-10 39L47 0l57 39" fill={d.color}/>
        <rect y="36" width="94" height="59" rx="4" fill="#e7d5b5"/>
        <rect x="38" y="57" width="22" height="38" fill="#806b50"/>
        <rect x="10" y="51" width="19" height="20" fill="#7a9c89"/>
        <rect x="67" y="51" width="18" height="20" fill="#7a9c89"/>
        <text x="47" y="113" textAnchor="middle" fontSize="12" fontWeight="800" fill="#eff5e5">{d.name.toUpperCase()}</text>
      </g>
      <CourierMarker x={x} y={y} delivered={trip.stage === 'delivered'}/>
      <text x="380" y="219" textAnchor="middle" fontSize="12" fill="#d3e4d1">{onRoad ? `${trip.remainingKm.toFixed(1)} km remaining` : `${d.distanceKm} km to ${d.name}`}</text>
    </svg>
    <div className="delivery-stages" aria-label="Delivery progress">
      {DELIVERY_STEPS.map(([stage, text], index) => <span key={stage} aria-current={index === stageIndex ? 'step' : undefined} className={index < stageIndex ? 'reached' : ''}>{text}</span>)}
    </div>
    <p className="delivery-note">{d.distanceKm} km demo distance · {d.simulatedMinutes} estimated real-world minutes represented by {d.travelSeconds} game seconds. No GPS, real address, or actual delivery.</p>
    {!readOnly&&trip.stage==='at_restaurant'&&<button className="game-primary" disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/collect',{code:order.pickupCode})}>Match reference & let courier collect →</button>}
    {!readOnly&&trip.stage==='at_home'&&<button className="game-primary" disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/deliver')}>Confirm delivery received at house ✓</button>}
    {trip.stage==='delivered'&&<p className="delivery-confirmation">✓ Received at {d.name}. Confirmation is shared with the kitchen and owner.</p>}
  </section>;
}
export function DeliveryBoard({state,act,busy,clockOffset,readOnly=false,preferredOrderId=''}) {
  const [selected,setSelected]=useState('');
  const orders=[...state.orders].reverse().filter(o=>o.delivery&&o.status!=='cancelled');
  useEffect(()=>{if(preferredOrderId)setSelected(preferredOrderId);},[preferredOrderId]);
  const order=orders.find(o=>o.id===selected)||orders.find(o=>o.id===preferredOrderId)||orders.find(o=>o.status!=='delivered')||orders[0];
  if(orders.length===0) return <section id="delivery-simulator" aria-label="Delivery simulator" className="delivery-board delivery-main-stage delivery-idle">
    <span aria-hidden="true">🏪 → 🛵 → 🏡</span><div><b>Delivery simulator</b><p>No deliveries yet. Choose Delivery when ordering and the courier's trip will show here.</p></div>
  </section>;
  return <section id="delivery-simulator" aria-label="Delivery simulator" className="delivery-board delivery-main-stage">
    <div className="delivery-stage-header"><div><small>LIVE DELIVERY STAGE</small><h2>Delivery simulator</h2><p>Follow a courier from pickup to the customer’s door.</p></div><div className="delivery-stage-links"><span>{orders.length} delivery {orders.length===1?'order':'orders'}</span><a href="#restaurant-floor">Restaurant floor ↓</a></div></div>
    {orders.length>0?<><div className="delivery-order-tabs" aria-label="Choose delivery order">{orders.map(o=><button key={o.id} className={o.id===order.id?'selected':''} onClick={()=>setSelected(o.id)} aria-pressed={o.id===order.id}>{o.id} · {o.customer}<small>{o.delivery.name}</small></button>)}</div><DeliveryJourney key={order.id} {...{order,act,busy,clockOffset,readOnly}}/></>:<div className="delivery-empty-stage"><span aria-hidden="true">Pickup → Drop-off</span><div><b>No courier trips yet</b><p>Choose Delivery at the order counter to follow a courier here.</p></div></div>}
  </section>;
}
