import React, { useEffect, useState } from 'react';
import './shift-launch.css';

const MISSIONS = {
  owner: ['Owner', 'Run the shift and see how the kitchen recovers when something goes wrong.', 'Briefing'],
  kitchen: ['Kitchen', 'Pick up a ticket, cook at each station, and check the bag before handoff.', 'Cook line'],
  customer: ['Customer', 'Place an order, follow it through the kitchen, and collect it or track delivery.', 'Order counter'],
  display: ['Demo screen', 'Watch the shared floor, live tickets, and scenario replays on a second screen.', 'Spectator'],
  split: ['Split view', 'Play Customer and Owner side by side and see both avatars on the same floor.', 'Two perspectives'],
};

const ROLE_PATHS = {
  owner: 'M4 19V5h16v14H4Zm4-4v-3m4 3V8m4 7v-5',
  kitchen: 'M6 3v8m4-8v8m-4-4h4m-2 4v10M18 3c-2 2-3 5-3 8h3m0-8v18',
  customer: 'M5 8h14l1 13H4L5 8Zm4 1V6a3 3 0 0 1 6 0v3',
  display: 'M3 5h18v12H3V5Zm9 12v4m-4 0h8',
  split: 'M3 5h18v14H3V5Zm9 0v14',
};

export function RoleIcon({ role }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ROLE_PATHS[role]}/>
  </svg>;
}

function KitchenBlueprint() {
  return (
    <svg className="launch-blueprint" viewBox="0 0 840 550" aria-hidden="true">
      <defs>
        <linearGradient id="launch-floor" x2="1" y2="1">
          <stop stopColor="#41675b"/>
          <stop offset="1" stopColor="#1f3c35"/>
        </linearGradient>
        <linearGradient id="launch-siding" x2="0" y2="1">
          <stop stopColor="#294d42"/>
          <stop offset="1" stopColor="#101f1a"/>
        </linearGradient>
        <pattern id="launch-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#abc4b0" strokeOpacity=".22"/>
        </pattern>
      </defs>
      <g fill="none" stroke="#86a993" strokeOpacity=".28">
        <path d="m18 352 341 173 456-229M46 371v17m313 137v17m456-246v17"/>
        <ellipse cx="425" cy="329" rx="369" ry="153" strokeDasharray="3 9"/>
      </g>
      <path d="M82 328 357 466 787 251V278L357 493 82 355Z" fill="url(#launch-siding)" stroke="#628e75"/>
      <path d="M82 343 357 481 787 266" fill="none" stroke="#a7c5a8" strokeOpacity=".45"/>
      <g transform="matrix(.86 -.43 .86 .43 82 328)">
        <rect width="500" height="320" rx="12" fill="url(#launch-floor)" stroke="#acc9ae" strokeWidth="2"/>
        <rect x="12" y="12" width="476" height="296" rx="7" fill="url(#launch-grid)"/>
        <rect x="21" y="189" width="458" height="110" rx="8" fill="#89784f" fillOpacity=".38" stroke="#d6b882" strokeOpacity=".45"/>
        <path d="M23 166H217m63 0h198" stroke="#151e19" strokeWidth="29" strokeLinecap="round"/>
        <path d="M23 159H217m63 0h198" stroke="#d09659" strokeWidth="18" strokeLinecap="round"/>
        {[91, 248, 405].map((x, index) => (
          <g key={x} transform={`translate(${x} 69)`}>
            <rect x="-43" y="-27" width="86" height="58" rx="10" fill="#162c25" stroke="#9fc1a2" strokeWidth="2"/>
            <rect x="-33" y="-19" width="66" height="37" rx="5" fill={['#577a65', '#a28354', '#577a65'][index]}/>
            <path d="M-22-10H22m-44 9H22m-44 9H22" stroke="#deead0" strokeOpacity=".48" strokeWidth="2"/>
            <circle cx="0" cy="24" r="2.5" fill="#ffc67b"/>
          </g>
        ))}
        {[205, 320].map(x => (
          <g key={x} transform={`translate(${x} 245)`} fill="#273c31" stroke="#a8b68d" strokeWidth="2">
            <rect x="-28" y="-19" width="56" height="38" rx="11"/>
            <circle cx="-40" r="9"/><circle cx="40" r="9"/>
          </g>
        ))}
        <path className="blueprint-route" d="M63 281V220H127V119H248V106H405V119H450V218H404" fill="none" stroke="#f4c27d" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 9"/>
        <g fill="#f4c27d" stroke="#172822" strokeWidth="3">
          <circle cx="63" cy="281" r="8"/><circle cx="248" cy="106" r="8"/><circle cx="404" cy="218" r="8"/>
        </g>
      </g>
      <g className="blueprint-label" transform="translate(145 226)">
        <path d="M61 22v53" stroke="#b8cbb0" strokeDasharray="3 4"/>
        <rect width="120" height="29" rx="5"/>
        <circle cx="14" cy="14.5" r="3.5"/>
        <text x="25" y="19">01 / GRILL</text>
      </g>
      <g className="blueprint-label" transform="translate(283 153)">
        <path d="M61 22v55" stroke="#b8cbb0" strokeDasharray="3 4"/>
        <rect width="120" height="29" rx="5"/>
        <circle cx="14" cy="14.5" r="3.5"/>
        <text x="25" y="19">02 / FRYER</text>
      </g>
      <g className="blueprint-label" transform="translate(421 80)">
        <path d="M61 22v55" stroke="#b8cbb0" strokeDasharray="3 4"/>
        <rect width="129" height="29" rx="5"/>
        <circle cx="14" cy="14.5" r="3.5"/>
        <text x="25" y="19">03 / PACKING</text>
      </g>
    </svg>
  );
}

export default function ShiftLaunch({ roles, view, onViewChange, onEnter, connected, hasSnapshot }) {
  const [opening, setOpening] = useState(false);
  const [name, description, station] = MISSIONS[view];

  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(onEnter, 540);
    return () => clearTimeout(timer);
  }, [opening, onEnter]);

  function openFloor() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onEnter();
    else setOpening(true);
  }

  return (
    <div className="shift-launch">
      {opening && <div className="launch-shutter" aria-hidden="true">
        <span>Shift 01</span>
        <b>Starting service</b>
      </div>}
      <header className="launch-header">
        <div className="launch-brand">
          <span className="launch-brand-mark" aria-hidden="true">N</span>
          <b>Nova Kitchen Lab</b>
        </div>
        <div className={`launch-sync${connected ? ' is-online' : ''}`} role="status">
          <span aria-hidden="true"/>
          {connected ? 'Restaurant synced' : hasSnapshot ? 'Reconnecting' : 'Connecting to restaurant'}
        </div>
      </header>
      <main className="launch-content">
        <section className="launch-briefing" aria-labelledby="launch-title">
          <p className="launch-kicker"><span/> Shift 01 · Restaurant simulation</p>
          <h1 id="launch-title">Dinner<br/>service<span>.</span></h1>
          <p className="launch-lede">One restaurant across your screens. Choose a role and take the next ticket through the shift.</p>
          <div className="launch-role-picker" role="group" aria-label="Choose a view">
            {Object.keys(roles).map(key => (
              <button key={key} type="button" aria-pressed={view === key} disabled={opening} onClick={() => onViewChange(key)}>
                <RoleIcon role={key}/>
                {MISSIONS[key][0]}
              </button>
            ))}
          </div>
          <div className="launch-mission">
            <span>{station}</span>
            <p>{description}</p>
          </div>
          <div className="launch-actions">
            <button className="launch-enter" type="button" disabled={opening || !hasSnapshot} onClick={openFloor}>
              {opening ? 'Opening the floor…' : view === 'display' ? 'Open demo screen' : 'Enter the restaurant'}
              <span aria-hidden="true">↗</span>
            </button>
            <button className="launch-skip" type="button" onClick={onEnter}>Skip intro</button>
          </div>
        </section>
        <aside className="launch-stage" aria-label="Restaurant floor preview">
          <div className="launch-stage-top"><span>Floor preview</span><span>01 / NOVA</span></div>
          <KitchenBlueprint/>
          <div className="launch-stage-bottom"><span><i/> Shared restaurant</span><span>{name} view</span></div>
        </aside>
      </main>
    </div>
  );
}
