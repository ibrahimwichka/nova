import React, { useEffect, useState } from 'react';
import { deliveryProgress } from '../shared/delivery.mjs';
import './delivery.css';
export function DeliveryJourney({ order, act, busy, clockOffset = 0, readOnly = false }) {
  const [now,setNow] = useState(Date.now() + clockOffset);
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()+clockOffset),100); return ()=>clearInterval(timer); },[clockOffset]);
  if (!order?.delivery) return null;
  const d=order.delivery, trip=deliveryProgress(order,now);
  const label={waiting:'Kitchen preparing your order',to_restaurant:'Courier heading to restaurant',at_restaurant:'Courier waiting for pickup',on_way:'On the way to your house',at_home:'Courier at your door',delivered:'Delivery confirmed'}[trip.stage];
  const onRoad=['on_way','at_home','delivered'].includes(trip.stage);
  const x=onRoad?130+trip.progress*500:trip.stage==='to_restaurant'?60+trip.progress*70:trip.stage==='waiting'?55:130;
  const y=onRoad?150:165;
  return <section className={'delivery-journey '+(trip.stage==='delivered'?'trip-complete':'')} aria-label={'Delivery tracking for '+order.id}>
    <div className="delivery-heading"><div><small>SIMULATED DELIVERY · {order.id}</small><h3>{label}</h3></div><span>{trip.stage==='delivered'?'✓ Delivered':trip.stage==='at_home'?'At door':onRoad?trip.seconds+'s to door':trip.stage==='to_restaurant'?trip.seconds+'s to pickup':d.distanceKm+' km'}</span></div>
    <svg viewBox="0 0 760 240" role="img" aria-label={'Courier travelling from Nova Kitchen to '+d.name}>
      <rect width="760" height="240" rx="12" fill="#eef1e4"/>
      <path d="M25 155H735" stroke="#d2d8c9" strokeWidth="53"/><path d="M25 155H735" stroke="#fff9df" strokeWidth="2" strokeDasharray="12 12"/>
      <path d="M130 155H630" stroke="#8eb299" strokeWidth="7" opacity=".4"/>
      {onRoad&&<path d={'M130 155H'+x} stroke="#4e8b69" strokeWidth="7" strokeLinecap="round"/>}
      <g transform="translate(85,34)"><rect x="0" y="22" width="95" height="65" rx="6" fill="#d5b183"/><path d="M-9 22h113L87 0H8Z" fill="#568371"/><rect x="10" y="36" width="27" height="30" fill="#e6efe2"/><rect x="61" y="39" width="20" height="48" rx="2" fill="#6d8772"/><text x="47" y="105" textAnchor="middle" fontSize="12" fontWeight="800" fill="#496655">NOVA KITCHEN</text></g>
      <g transform="translate(583,28)"><path d="M-10 39L47 0l57 39" fill={d.color}/><rect x="0" y="36" width="94" height="62" rx="4" fill="#e7d5b5"/><rect x="38" y="57" width="22" height="41" fill="#917c5d"/><rect x="10" y="51" width="19" height="20" fill="#9ebdad"/><rect x="67" y="51" width="18" height="20" fill="#9ebdad"/><text x="47" y="117" textAnchor="middle" fontSize="12" fontWeight="800" fill="#496655">{d.name.toUpperCase()}</text></g>
      <g className="courier-sprite" style={{transform:'translate('+x+'px,'+y+'px)'}}><ellipse cy="16" rx="23" ry="8" fill="#344d3a" opacity=".13"/><text textAnchor="middle" y="10" fontSize="36">{trip.stage==='delivered'?'✅':'🛵'}</text><rect x="-29" y="-42" width="58" height="17" rx="7" fill="#355b4b"/><text y="-30" textAnchor="middle" fontSize="8" fill="white">COURIER</text></g>
      <text x="380" y="214" textAnchor="middle" fontSize="12" fill="#829077">{onRoad?trip.remainingKm.toFixed(1)+' km remaining · destination: '+d.name:d.distanceKm+' km from restaurant to '+d.name}</text>
    </svg>
    <div className="delivery-stages">{[['Kitchen','waiting'],['Pickup','at_restaurant'],['On the way','on_way'],['At your door','at_home'],['Confirmed','delivered']].map(([text,stage],i)=><span key={stage} className={['waiting','at_restaurant','on_way','at_home','delivered'].indexOf(trip.stage==='to_restaurant'?'at_restaurant':trip.stage)>=i?'reached':''}>{text}</span>)}</div>
    <p className="delivery-note">{d.distanceKm} km demo distance · {d.simulatedMinutes} estimated real-world minutes represented by {d.travelSeconds} game seconds. No GPS, real address, or actual delivery.</p>
    {!readOnly&&trip.stage==='at_restaurant'&&<button className="game-primary" disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/collect',{code:order.pickupCode})}>Match reference & let courier collect →</button>}
    {!readOnly&&trip.stage==='at_home'&&<button className="game-primary" disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/deliver')}>Confirm delivery received at house ✓</button>}
    {trip.stage==='delivered'&&<p className="delivery-confirmation">✓ Received at {d.name}. Confirmation is shared with the kitchen and owner.</p>}
  </section>;
}
export function DeliveryBoard({state,act,busy,clockOffset,readOnly=false}) {
  const orders=[...state.orders].reverse().filter(o=>o.delivery&&o.status!=='cancelled');
  if(!orders.length)return null;
  return <div className="delivery-board"><h2>Restaurant → customer homes</h2><p>Live courier position, destination, pickup status, and time to arrival.</p>{orders.map(order=><DeliveryJourney key={order.id} {...{order,act,busy,clockOffset,readOnly}}/>)}</div>;
}
