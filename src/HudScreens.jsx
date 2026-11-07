import React, { useEffect, useState } from 'react';
import { ActionButton, HudPanel, MapPin, StatBar } from './Hud.jsx';

const INGREDIENT_ICONS = { buns: '◈', patties: '◆', chicken: '✦', tortillas: '▰', potatoes: '▧', drinks: '▣' };

export function InventoryScreen({ inventory, view, act, busy }) {
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState('');
  const [sent, setSent] = useState('');
  const item = inventory.find(row => row.id === selected);
  const canRequest = ['owner', 'kitchen', 'split'].includes(view);
  function assign(id) {
    const next = inventory.find(row => row.id === id);
    if (!next) return;
    setSelected(id);
    setQuantity(String(Math.max(1, next.suggestedQuantity || 1)));
    setSent('');
  }
  async function request(event) {
    event.preventDefault();
    const result = await act('/restock-requests', { ingredient: selected, quantity: Number(quantity) }, 'Sending a restock request…');
    if (result) setSent(`${quantity} × ${item.name} requested in Ops.`);
  }
  return <section id="inventory-hud" className="hud-page">
    <div className="screen-title"><span className="hud-eyebrow">02 / Supply room</span><h1>Inventory</h1><p>Uncommitted stock updates as tickets enter the kitchen.</p></div>
    <div className="inventory-grid">
      {inventory.map(row => <button key={row.id} type="button" className="inventory-slot" data-stock={row.available <= 0 ? 'missing' : row.alert ? 'low' : 'ready'}
        aria-pressed={selected === row.id} onClick={() => assign(row.id)} draggable={canRequest}
        onDragStart={event => event.dataTransfer.setData('text/plain', row.id)}>
        <span className="inventory-glyph" aria-hidden="true">{INGREDIENT_ICONS[row.id] || '▣'}</span>
        <span className="inventory-qty">{row.available}<small> free</small></span>
        <b>{row.name}</b>
        <span className="stock-state">{row.available <= 0 ? 'Out of stock' : row.alert ? 'Restock needed' : 'Available'}</span>
        <StatBar label={row.name + ' stock level'} value={row.available / Math.max(row.target, 1)}/>
        <small>{row.committed} committed · {row.onHand} on hand</small>
      </button>)}
    </div>
    {canRequest && <HudPanel className="inventory-assignment" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); assign(event.dataTransfer.getData('text/plain')); }}>
      <div><span className="hud-eyebrow">Restock assignment</span><h2>{item?.name || 'Choose an ingredient'}</h2><p>Tap a slot or drag it here to prepare an in-app request.</p></div>
      {item && <form onSubmit={request}>
        <label>Units<input type="number" min="1" max="1000" value={quantity} required onChange={event => setQuantity(event.target.value)}/></label>
        <ActionButton type="submit" disabled={!!busy}>Request stock</ActionButton>
      </form>}
      {sent && <p role="status">{sent}</p>}
    </HudPanel>}
  </section>;
}

export function DispatcherFeed({ analyses = {}, version }) {
  const labels = { prep: 'PREP', inventory: 'SUPPLY', staff: 'STAFF', finance: 'FINANCE' };
  const dispatches = Object.entries(analyses)
    .filter(([kind, report]) => labels[kind] && report?.data?.summary)
    .sort(([, a], [, b]) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));
  return <HudPanel className="dispatcher-feed" aria-label="Dispatcher messages">
    <span className="hud-eyebrow">◉ Dispatcher / Radio</span>
    {dispatches.length ? dispatches.map(([kind, report]) => <p key={kind} className="dispatch-message">
      <b>{labels[kind]}</b><span>{report.data.summary}</span><small>{report.basedOnVersion === version ? 'Current' : 'Earlier snapshot'}</small>
    </p>) : <p className="dispatch-message"><b>Standby</b><span>Run a copilot below to hear its next recommendation.</span></p>}
  </HudPanel>;
}

export function ReplayScreen({ scenarios, stations, staff, active }) {
  const [id, setId] = useState('');
  const [plan, setPlan] = useState('recovery');
  const [minute, setMinute] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const scenario = scenarios.find(entry => entry.id === id) || scenarios[0];
  const run = scenario?.comparison?.[plan];
  const done = minute >= 60;
  useEffect(() => {
    if (!active || !playing || !run || done) return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = (now - previous) / 1000 * speed * 3;
      previous = now;
      setMinute(current => Math.min(60, current + delta));
    }, 100);
    return () => clearInterval(timer);
  }, [active, playing, speed, done, run]);
  function rewind() { setMinute(0); setPlaying(false); }
  return <section id="replay-hud" className="hud-page">
    <div className="screen-title"><span className="hud-eyebrow">03 / Scenario playback</span><h1>Replay room</h1><p>Scrub a saved forecast while the live floor keeps running.</p></div>
    {run ? <>
      <div className="replay-top">
        <label>Saved drill<select value={scenario.id} onChange={event => { setId(event.target.value); rewind(); }}>{scenarios.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <label>Active plan<select value={plan} onChange={event => { setPlan(event.target.value); rewind(); }}><option value="baseline">Fixed assignments</option><option value="recovery">Qualified recovery</option></select></label>
        <label>Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[.5, 1, 2, 3, 4].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
      </div>
      <HudPanel className="replay-hud-panel">
        <div className="replay-hud-head">
          <div><span className="hud-eyebrow">{plan === 'baseline' ? 'Fixed assignments' : 'Qualified recovery'}</span><h2>{scenario.name}</h2></div>
          <div className="replay-clock"><b>{minute.toFixed(1)}</b><span> / 60 sim min</span></div>
        </div>
        <svg className="replay-blueprint" viewBox="0 0 600 96" role="img" aria-label="Simulated station activity">
          <path d="M45 54H555" stroke="#9560de" strokeWidth="3" strokeDasharray="6 7"/>
          {stations.map((station, index) => {
            const task = run.schedule.find(entry => entry.station === station.id && minute >= entry.start && minute < entry.end);
            return <MapPin x={75 + index * 150} y={54} key={station.id} label={station.name.toUpperCase()} className={task ? 'replay-pin active' : 'replay-pin'}/>;
          })}
        </svg>
        <div className="replay-lanes">{stations.map(station => {
          const tasks = run.schedule.filter(task => task.station === station.id);
          const current = tasks.find(task => minute >= task.start && minute < task.end);
          return <div className="replay-lane" key={station.id}>
            <b>{station.name}</b>
            <div className="lane-track" aria-hidden="true">{tasks.map((task, index) => <span key={index} className={current === task ? 'active' : ''} style={{ left: `${task.start / 60 * 100}%`, width: `${(task.end - task.start) / 60 * 100}%` }}/>)}
              <i style={{ transform: `translateX(${minute / 60 * 100}%)` }}/>
            </div>
            <small>{current ? `${current.orderId} · ${staff.find(worker => worker.id === current.workerId)?.name || 'Assigned'}` : 'Idle'}</small>
          </div>;
        })}</div>
        <div className="replay-playbar">
          <ActionButton onClick={() => { if (done) setMinute(0); setPlaying(done || !playing); }}>{playing && !done ? 'Pause replay' : 'Play replay'}</ActionButton>
          <label>Simulation clock<input type="range" aria-label="Replay scrubber" min="0" max="60" step=".1" value={minute} onChange={event => setMinute(Number(event.target.value))}/></label>
        </div>
        <p className="replay-results">{run.metrics.completed} completed · {run.metrics.onTime} on time · {run.metrics.blocked} blocked</p>
      </HudPanel>
    </> : <HudPanel className="hud-empty">Choose a disruption in Owner’s shift controls to create a replay.</HudPanel>}
    <div className="hud-page-links"><a href="#restaurant-floor">← Service floor</a><a href="#delivery-simulator">Delivery map →</a></div>
  </section>;
}
