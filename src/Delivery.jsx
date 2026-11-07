import React, { useEffect, useState } from 'react';
import { deliveryProgress } from '../shared/delivery.mjs';
import { ActionButton, MapPin, StatBar } from './Hud.jsx';
import { COURIER_APPROACH, COURIER_ROUTE, routePose } from './hud-state.mjs';
import './delivery.css';

const DELIVERY_STEPS = [
  ['waiting', 'Kitchen'],
  ['at_restaurant', 'Packed'],
  ['on_way', 'Out for delivery'],
  ['at_home', 'Arriving'],
  ['delivered', 'Delivered'],
];

const routePath = COURIER_ROUTE.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ');

function CourierMarker({ x, y, heading, delivered, moving }) {
  return (
    <g className="courier-sprite" style={{ transform: `translate(${x}px, ${y}px)` }} aria-hidden="true">
      <ellipse cy="14" rx="27" ry="7" fill="#071b15" opacity=".55"/>
      {delivered ? <>
        <circle r="17" fill="#a5d5a4" stroke="#183a2e" strokeWidth="2"/>
        <path d="m-8 0 5 6 11-12" fill="none" stroke="#19382a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </> : <g className="courier-bike" transform={`rotate(${heading})`}>
        {moving && <path className="courier-wake" d="M-64-8h26m-34 8h31m-23 8h23" fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round"/>}
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

export function DeliveryJourney({ order, act, busy, clockOffset = 0, readOnly = false, active = true }) {
  const [now,setNow] = useState(Date.now() + clockOffset);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() + clockOffset);
    const timer = setInterval(() => setNow(Date.now() + clockOffset), 100);
    return () => clearInterval(timer);
  }, [clockOffset, active]);
  if (!order?.delivery) return null;
  const d=order.delivery, trip=deliveryProgress(order,now);
  const label={waiting:'Kitchen preparing your order',to_restaurant:'Courier heading to restaurant',at_restaurant:'Courier waiting for pickup',on_way:'On the way to your house',at_home:'Courier at your door',delivered:'Delivery confirmed'}[trip.stage];
  const onRoad=['on_way','at_home','delivered'].includes(trip.stage);
  const pose = onRoad ? routePose(COURIER_ROUTE, trip.progress) : routePose(COURIER_APPROACH, trip.stage === 'waiting' ? 0 : trip.progress);
  const stageIndex = DELIVERY_STEPS.findIndex(([stage]) => stage === (trip.stage === 'to_restaurant' ? 'at_restaurant' : trip.stage));
  return <section className={'delivery-journey '+(trip.stage==='delivered'?'trip-complete':'')} aria-label={'Delivery tracking for '+order.id}>
    <div className="delivery-heading"><div><small>SIMULATED DELIVERY · {order.id}</small><h3>{label}</h3></div><span>{trip.stage==='delivered'?'✓ Delivered':trip.stage==='at_home'?'At door':onRoad?trip.seconds+'s to door':trip.stage==='to_restaurant'?trip.seconds+'s to pickup':d.distanceKm+' km'}</span></div>
    <svg className="delivery-map" viewBox="0 0 760 240" role="img" aria-label={`Simulated courier route from Nova Kitchen to ${d.name}`}>
      <rect width="760" height="240" rx="12" fill="#150d30"/>
      <g fill="none" stroke="#8c6bb0" strokeWidth="12" opacity=".24">
        <path d="M207 0v81l64 57v102M505 0v75l-52 64v101M0 62h184m45 0h259m37 0h235M352 0v240"/>
      </g>
      <g fill="#31204f" stroke="#9e6fc8" strokeOpacity=".35">
        <rect x="272" y="22" width="76" height="24" rx="6"/><rect x="365" y="22" width="80" height="24" rx="6"/>
        <rect x="303" y="83" width="92" height="35" rx="8"/><rect x="488" y="189" width="56" height="26" rx="6"/>
      </g>
      <path d={`M20 160H130 ${routePath.replace(/^M130 160/, '')}H740`} fill="none" stroke="#0a0717" strokeWidth="38" strokeLinejoin="round" strokeLinecap="round"/>
      <path d={routePath} fill="none" stroke="#8759c4" strokeWidth="3" strokeDasharray="5 7" strokeLinecap="round"/>
      {onRoad && <path className="neon-courier-route" d={routePath} pathLength="1" fill="none" stroke="#00e5ff" strokeWidth="4" strokeDasharray="1" strokeDashoffset={1 - trip.progress} strokeLinecap="round" strokeLinejoin="round"/>}
      <MapPin x={130} y={160} className="pickup-pin"/>
      <MapPin x={630} y={160} className="delivery-pin"/>
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
      <CourierMarker {...pose} delivered={trip.stage === 'delivered'} moving={trip.stage === 'on_way'}/>
      <text x="380" y="224" textAnchor="middle" fontSize="12" fill="#dce6ff">{onRoad ? `${trip.remainingKm.toFixed(1)} km remaining` : `${d.distanceKm} km to ${d.name}`}</text>
    </svg>
    <StatBar label="Courier route progress" value={onRoad ? trip.progress : 0} caption={onRoad ? `${Math.round(trip.progress * 100)}% of route` : 'Awaiting dispatch'}/>
    <div className="delivery-stages" aria-label="Delivery progress">
      {DELIVERY_STEPS.map(([stage, text], index) => <span key={stage} aria-current={index === stageIndex ? 'step' : undefined} className={index < stageIndex ? 'reached' : ''}>{text}</span>)}
    </div>
    <p className="delivery-note">{d.distanceKm} km demo distance · {d.simulatedMinutes} estimated real-world minutes represented by {d.travelSeconds} game seconds. No GPS, real address, or actual delivery.</p>
    {!readOnly&&trip.stage==='at_restaurant'&&<ActionButton disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/collect',{code:order.pickupCode})}>Dispatch scooter</ActionButton>}
    {!readOnly&&trip.stage==='at_home'&&<ActionButton disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/deliver')}>Confirm delivery received</ActionButton>}
    {trip.stage==='delivered'&&<p className="delivery-confirmation">✓ Received at {d.name}. Confirmation is shared with the kitchen and owner.</p>}
  </section>;
}
export function DeliveryBoard({state,act,busy,clockOffset,readOnly=false,preferredOrderId='',active=true}) {
  const [selected,setSelected]=useState('');
  const orders=[...state.orders].reverse().filter(o=>o.delivery&&o.status!=='cancelled');
  useEffect(()=>{if(preferredOrderId)setSelected(preferredOrderId);},[preferredOrderId]);
  const order=orders.find(o=>o.id===selected)||orders.find(o=>o.id===preferredOrderId)||orders.find(o=>o.status!=='delivered')||orders[0];
  if(orders.length===0) return <section id="delivery-simulator" aria-label="Delivery simulator" className="delivery-board delivery-main-stage delivery-idle">
    <span className="delivery-idle-marker" aria-hidden="true">⇢</span><div><b>Delivery simulator</b><p>Choose Delivery when ordering to follow a courier here.</p></div>
  </section>;
  return <section id="delivery-simulator" aria-label="Delivery simulator" className="delivery-board delivery-main-stage">
    <div className="delivery-stage-header">
      <div><small>Courier routes</small><h2>Delivery simulator</h2><p>Follow a courier from pickup to the customer’s door.</p></div>
      <a href="#restaurant-floor">Back to the floor ↑</a>
    </div>
    <div className="delivery-order-tabs" aria-label="Choose delivery order">
      {orders.map(o => <button type="button" key={o.id} className={o.id === order.id ? 'selected' : ''} onClick={() => setSelected(o.id)} aria-pressed={o.id === order.id}>
        {o.id} · {o.customer}<small>{o.delivery.name}</small>
      </button>)}
    </div>
    <DeliveryJourney key={order.id} {...{order,act,busy,clockOffset,readOnly,active}}/>
  </section>;
}
