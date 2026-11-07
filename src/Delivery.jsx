import React, { useEffect, useState } from "react";
import { deliveryProgress } from "../shared/delivery.mjs";
import {
  APPROACH_ROUTE,
  deliveryRoute,
  routePose,
  routePoints,
} from "../shared/courier-route.mjs";
import { MapPin, Panel } from "./UI.jsx";
import "./delivery.css";
import PhotoDemo from "./PhotoDemo.jsx";
const STEPS = ["Packed", "Out for delivery", "Arriving", "Delivered"];
function CourierMarker({ pose, delivered, moving }) {
  return (
    <g
      className="courier-sprite"
      transform={`translate(${pose.x},${pose.y})`}
      aria-hidden="true"
    >
      <circle r="31" fill="#9bcfcb" opacity=".07" />
      <g transform={`rotate(${pose.heading})`}>
        {moving && (
          <g
            stroke="#9bcfcb"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".7"
          >
            <path d="M-34-7h-18m18 14h-25m28-7h-17" />
          </g>
        )}
        {delivered ? (
          <g transform={`rotate(${-pose.heading})`}>
            <circle r="18" fill="#7ae8d9" />
            <path
              d="m-9 0 6 6 12-13"
              stroke="#13282e"
              strokeWidth="3"
              fill="none"
            />
          </g>
        ) : (
          <>
            <ellipse cy="8" rx="26" ry="7" fill="#05070c" opacity=".5" />
            <circle
              cx="-17"
              cy="8"
              r="7"
              fill="#100d1a"
              stroke="#cfb5d7"
              strokeWidth="2"
            />
            <circle
              cx="19"
              cy="8"
              r="7"
              fill="#100d1a"
              stroke="#cfb5d7"
              strokeWidth="2"
            />
            <path
              d="M-23 0q3-11 15-10h10l5 12h7l4-15 9 2-4 16-11 10h-23Z"
              fill="#ff9b5d"
              stroke="#28172f"
              strokeWidth="2"
            />
            <path
              d="m15 0 5-16 8-1"
              fill="none"
              stroke="#e8e1ee"
              strokeWidth="3"
            />
            <rect
              x="-28"
              y="-25"
              width="21"
              height="17"
              rx="3"
              fill="#8fba9c"
              stroke="#ffb1d1"
              strokeWidth="1.5"
            />
            <path d="M-23-20h11" stroke="#ffd9e9" strokeWidth="2" />
            <circle cx="0" cy="-17" r="6" fill="#f4d0b3" />
            <path
              d="m0-11 4 10h10"
              stroke="#9ce9e6"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
      <rect
        x="-36"
        y="-59"
        width="72"
        height="21"
        rx="3"
        fill="#193e48"
        stroke="#9ecfce"
        strokeOpacity=".65"
      />
      <text
        y="-45"
        fill="#d3eeeb"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1"
      >
        {delivered ? "RECEIVED" : "COURIER"}
      </text>
    </g>
  );
}
export function DistrictMap({ order, trip }) {
  const route = deliveryRoute(order?.delivery?.id || order?.delivery?.homeId),
    destination = route.at(-1);
  const onRoad = ["on_way", "at_home", "delivered"].includes(trip?.stage),
    approaching = trip?.stage === "to_restaurant";
  const pose = routePose(
    onRoad ? route : APPROACH_ROUTE,
    onRoad
      ? trip.progress
      : approaching
        ? trip.progress
        : trip?.stage === "at_restaurant"
          ? 1
          : 0,
  );
  return (
    <svg
      className="district-map"
      viewBox="0 0 1120 600"
      role="img"
      aria-label={`Live simulated delivery map from Zindabad Dash to ${order?.delivery?.name || "the neighborhood"}`}
    >
      <defs>
        <pattern
          id="district-grid"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
        >
          <path d="M40 0H0V40" fill="none" stroke="#264750" strokeWidth=".5" />
        </pattern>
        <linearGradient id="river-color">
          <stop stopColor="#274c62" />
          <stop offset="1" stopColor="#1d3b50" />
        </linearGradient>
      </defs>
      <rect width="1120" height="600" fill="#112b32" />
      <rect width="1120" height="600" fill="url(#district-grid)" />
      <path
        d="M860-20q-170 90-100 230t-70 220q-80 70-35 190h120q-40-110 40-180t40-200q-50-135 120-240Z"
        fill="url(#river-color)"
        stroke="#36718c"
        strokeOpacity=".35"
      />
      <g fill="#25444c" stroke="#587d7d" strokeOpacity=".4">
        {[
          [50, 50, 210, 180],
          [280, 45, 230, 95],
          [405, 260, 170, 60],
          [225, 395, 105, 55],
          [50, 260, 80, 60],
          [65, 515, 225, 55],
          [410, 400, 170, 150],
          [840, 260, 225, 135],
          [940, 45, 125, 115],
          [865, 520, 210, 50],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="5" />
        ))}
      </g>
      <g
        fill="none"
        stroke="#34575e"
        strokeWidth="23"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M-20 365H1120M180-20V620M370-20v620M-20 480h1140M-20 220H1120M600-20v640M720-20v640M925-20v640M520 100h620M600 130h500" />
      </g>
      <g fill="none" stroke="#82a39c" strokeWidth="1" opacity=".35">
        <path d="M-20 365H1120M180-20V620M370-20v620M-20 480h1140M-20 220H1120M600-20v640M720-20v640M925-20v640M520 100h620M600 130h500" />
      </g>
      <g fontSize="9" letterSpacing="3" fill="#aac6bb" opacity=".75">
        <text x="450" y="356">
          MARKET STREET
        </text>
        <text x="410" y="470">
          PARK AVENUE
        </text>
        <text x="415" y="208">
          SERVICE DRIVE
        </text>
        <text x="90" y="100">
          SERVICE
        </text>
        <text x="90" y="116">
          DISTRICT
        </text>
        <text x="855" y="333">
          RESIDENTIAL
        </text>
        <text x="855" y="349">
          QUARTER
        </text>
        <text
          transform="translate(805,380) rotate(-73)"
          fill="#689cb4"
          fontSize="8"
        >
          THE RIVER
        </text>
      </g>
      <g fill="#587770" stroke="#9bb9a7" strokeOpacity=".4">
        {[
          [65, 270],
          [85, 293],
          [110, 270],
          [444, 80],
          [470, 80],
          [445, 110],
          [990, 295],
          [1035, 295],
          [990, 350],
          [1035, 350],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="20" height="16" rx="2" />
        ))}
      </g>
      <polyline
        points={routePoints(route)}
        fill="none"
        stroke="#8fba9c"
        strokeWidth="16"
        strokeOpacity=".08"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={routePoints(route)}
        fill="none"
        stroke="#9ec1a6"
        strokeWidth="3"
        strokeDasharray="5 6"
        strokeLinejoin="round"
      />
      {onRoad && (
        <>
          <polyline
            points={routePoints(pose.traveled)}
            fill="none"
            stroke="#9bcfcb"
            strokeOpacity=".12"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points={routePoints(pose.traveled)}
            fill="none"
            stroke="#c5e9dc"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      <g transform="translate(180,315)">
        <rect
          x="-39"
          y="-48"
          width="78"
          height="45"
          rx="3"
          fill="#a45f7b"
          stroke="#fac5d5"
        />
        <path d="M-44-48h88l-10-15h-68Z" fill="#e99378" />
        <path
          d="M-30-48v13m12-13v13m12-13v13m12-13v13m12-13v13m12-13v13"
          stroke="#63334f"
          strokeWidth="8"
        />
        <rect x="-6" y="-24" width="16" height="21" fill="#28162d" />
        <rect x="-30" y="-25" width="17" height="12" fill="#70d9e6" />
        <text
          y="-77"
          fill="#e4eddb"
          fontSize="10"
          fontWeight="700"
          textAnchor="middle"
          letterSpacing="2"
        >
          ZINDABAD DASH
        </text>
        <path d="M0 0v25" stroke="#ff7dad" strokeWidth="2" />
      </g>
      <MapPin x={180} y={365} color="#cee6ba" />
      <g transform={`translate(${destination.x},${destination.y - 25})`}>
        <path d="M-23-30 0-49l23 19" fill="#da8d88" />
        <rect x="-19" y="-30" width="38" height="29" rx="2" fill="#b9a2b7" />
        <rect x="-4" y="-17" width="9" height="16" fill="#4b3a59" />
        <rect x="-14" y="-21" width="7" height="7" fill="#ffdf95" />
        <text
          y="-64"
          textAnchor="middle"
          fill="#f4e8c4"
          fontSize="10"
          fontWeight="700"
          letterSpacing="1"
        >
          {order?.delivery?.name?.toUpperCase() || "MAPLE HOUSE"}
        </text>
      </g>
      <MapPin x={destination.x} y={destination.y} color="#e4d39c" />
      {trip && (
        <CourierMarker
          {...{ pose }}
          delivered={trip.stage === "delivered"}
          moving={approaching || trip.stage === "on_way"}
        />
      )}
      <g transform="translate(52,550)" fill="#dfc8da">
        <circle r="22" fill="#130d1e" stroke="#a27d9f" />
        <path d="m0-14 5 20-5-4-5 4Z" fill="#ff9cbb" />
        <text y="-29" textAnchor="middle" fontSize="8">
          N
        </text>
      </g>
      <text
        x="1065"
        y="566"
        textAnchor="end"
        fill="#c29fb9"
        fontSize="8"
        letterSpacing="2"
      >
        ZINDABAD DISTRICT / SIMULATED
      </text>
    </svg>
  );
}
function DoorstepPhoto({order,act,busy}) {
 const [image,setImage]=useState(''),[error,setError]=useState('');
 async function upload(file){if(!file)return;try{if(file.size>12000000)throw Error('Choose a photo under 12 MB.');const b=await createImageBitmap(file),c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(b.width,b.height));c.width=b.width*scale;c.height=b.height*scale;c.getContext('2d').drawImage(b,0,0,c.width,c.height);b.close();setImage(c.toDataURL('image/jpeg',.85));setError('');}catch(e){setError(e.message);}}
 const check=order.deliveryVerification;
 return <section className="doorstep-photo"><h3>Check the delivery photo</h3><PhotoDemo {...{order,act,busy}} doorstep/><p>Open the bag and show every item. Upload a JPEG, PNG or WebP photo. The AI counts visible items against this ticket; a mismatch or unclear photo keeps receipt unconfirmed.</p><label className="upload">Upload delivery photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e.target.files[0])}/></label>{image&&<><img className="capture" style={{maxHeight:220,width:'auto',display:'block',margin:'12px 0'}} src={image} alt="Delivery items selected for AI verification"/><button disabled={!!busy} onClick={()=>act('/orders/'+order.id+'/delivery-verify',{mode:'vision',image},'Checking the delivered items with OpenRouter…')}>Analyze delivery photo</button></>}{error&&<p role="alert">{error}</p>}{check&&<div className={'verification '+check.status} role="status"><h3>{check.status==='green'?'Delivered items match':check.status==='red'?'Delivery mismatch — recheck items':'Unclear evidence — take another photo'}</h3>{check.rows.map(r=><p key={r.sku}>{r.name}: {r.observed} of {r.expected} visible</p>)}{check.observation.notes.map((n,i)=><small className="block" key={i}>{n}</small>)}</div>}<p className="hint">One still image is sent to OpenRouter. Images are not saved by this app. Visible contents only; hidden ingredients cannot be confirmed.</p></section>;
}
export function DeliveryJourney({
  order,
  act,
  busy,
  clockOffset = 0,
  readOnly = false,
}) {
  const [now, setNow] = useState(Date.now() + clockOffset);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + clockOffset), 80);
    return () => clearInterval(timer);
  }, [clockOffset]);
  if (!order?.delivery) return null;
  const d = order.delivery,
    trip = deliveryProgress(order, now);
  const labels = {
    waiting: "The kitchen has your ticket.",
    to_restaurant: "Courier approaching the restaurant.",
    at_restaurant: "Ready for verified handoff.",
    on_way: "On the way to the customer.",
    at_home: "At your door.",
    delivered: "Delivery confirmed.",
  };
  const stage = ["waiting"].includes(trip.stage)
    ? -1
    : ["to_restaurant", "at_restaurant"].includes(trip.stage)
      ? 0
      : trip.stage === "on_way"
        ? 1
        : trip.stage === "at_home"
          ? 2
          : 3;
  const progress = ["on_way", "at_home", "delivered"].includes(trip.stage)
    ? trip.progress
    : 0;
  return (
    <section
      className="district-journey"
      aria-label={"Delivery tracking for " + order.id}
    >
      <div className="district-stage-heading">
        <div>
          <small>
            {order.id} / {order.customer} → {d.name}
          </small>
          <h2>{labels[trip.stage]}</h2>
        </div>
        <div>
          <strong>
            {trip.stage === "delivered"
              ? "✓"
              : trip.stage === "at_home"
                ? "0"
                : trip.seconds}
            <small>
              {trip.stage === "delivered"
                ? "DELIVERED"
                : trip.stage === "on_way" || trip.stage === "at_home"
                  ? "SECONDS TO DOOR"
                  : trip.stage === "to_restaurant"
                    ? "SECONDS TO PICKUP"
                    : "DEMO SECONDS"}
            </small>
          </strong>
        </div>
      </div>
      <div className="district-map-wrap">
        <DistrictMap {...{ order, trip }} />
        <div className="district-map-key">
          <span>● RESTAURANT</span>
          <span>● COURIER</span>
          <span>● DESTINATION</span>
        </div>
      </div>
      <div className="district-progress">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="district-trip-bar">
        <div className="district-stages" aria-label="Delivery stages">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={i <= stage ? "is-reached" : ""}
              aria-current={i === stage ? "step" : undefined}
            >
              <i>
                {i < stage || trip.stage === "delivered"
                  ? "✓"
                  : String(i + 1).padStart(2, "0")}
              </i>
              {label}
            </span>
          ))}
        </div>
        <div className="district-distance">
          <b>
            {trip.remainingKm.toFixed(1)} <small>KM LEFT</small>
          </b>
          <span>{Math.round(progress * 100)}% OF ROUTE</span>
        </div>
      </div>
      <div className="district-action">
        {!readOnly && trip.stage === "at_restaurant" ? (
          <button
            className="primary"
            disabled={!!busy}
            onClick={() =>
              act("/orders/" + order.id + "/collect", {
                code: order.pickupCode,
              })
            }
          >
            Match {order.pickupCode} & dispatch courier ↗
          </button>
        ) : !readOnly && trip.stage === "at_home" ? (
          <>
          <DoorstepPhoto {...{order,act,busy}}/>
          <button
            className="primary"
            disabled={!!busy || order.deliveryVerification?.status !== "green"}
            onClick={() => act("/orders/" + order.id + "/deliver")}
          >
            Confirm delivery received ✓
          </button></>
        ) : (
          <p>
            {trip.stage === "waiting"
              ? "Complete cooking, packing verification and bag confirmation before dispatch."
              : trip.stage === "to_restaurant"
                ? "The courier must reach the restaurant before reference matching."
                : trip.stage === "on_way"
                  ? "The courier is heading to your house. Receipt unlocks on arrival."
                  : trip.stage === "delivered"
                    ? "✓ Delivery receipt is shared with the kitchen and owner."
                    : readOnly
                      ? "Spectator view. A player confirms the handoff."
                      : ""}
          </p>
        )}
        <small>
          {d.distanceKm} km · {d.simulatedMinutes} estimated real-world minutes
          represented by {d.travelSeconds} demo seconds. No real GPS or
          delivery.
        </small>
      </div>
    </section>
  );
}
export function DeliveryBoard({
  state,
  act,
  busy,
  clockOffset,
  readOnly = false,
  preferredOrderId = "",
}) {
  const [selected, setSelected] = useState("");
  const orders = [...state.orders]
    .reverse()
    .filter((o) => o.delivery && o.status !== "cancelled");
  useEffect(() => {
    if (preferredOrderId) setSelected(preferredOrderId);
  }, [preferredOrderId]);
  const order =
    orders.find((o) => o.id === selected) ||
    orders.find((o) => o.id === preferredOrderId) ||
    orders.find((o) => o.status !== "delivered") ||
    orders[0];
  return (
    <section
      id="delivery-simulator"
      className="district-board"
      aria-label="Delivery simulator"
    >
      {orders.length ? (
        <>
          <div
            className="delivery-order-tabs"
            aria-label="Choose delivery order"
          >
            {orders.map((o) => (
              <button
                key={o.id}
                onClick={() => setSelected(o.id)}
                aria-pressed={o.id === order.id}
              >
                {o.id} · {o.customer}
                <small>{o.delivery.name}</small>
              </button>
            ))}
          </div>
          <DeliveryJourney
            key={order.id}
            {...{ order, act, busy, clockOffset, readOnly }}
          />
        </>
      ) : (
        <>
          <div className="district-map-wrap">
            <DistrictMap />
            <Panel className="district-empty">
              <span className="eyebrow">WAITING FOR DISPATCH</span>
              <h2>Ready to follow the delivery.</h2>
              <p>
                Place a delivery order as Customer. Once the bag is verified,
                your courier will appear on this map.
              </p>
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}
