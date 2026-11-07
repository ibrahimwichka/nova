import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { deliveryProgress } from '../shared/delivery.mjs';
import { presencePosition } from '../shared/presence.mjs';
import { SPOTS } from './game-logic.mjs';
import { COURIER_ROUTE, SCREENS, newestObjective, orderReward, routePose } from './hud-state.mjs';
import './presentation.css';

export const ActionHost = createContext(null);
export const dollars = cents => '$' + (cents / 100).toFixed(2);

export function HudPanel({ as: Tag = 'section', className = '', children, ...props }) {
  return <Tag className={`hud-panel ${className}`} {...props}>{children}</Tag>;
}

export function StatBar({ label, value, heat, caption }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return <div className="stat-bar" data-heat={heat}>
    {caption && <span>{caption}</span>}
    <div className="stat-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <i style={{ transform: `scaleX(${percent / 100})` }}/>
    </div>
  </div>;
}

export function ActionButton({ children, dock = true, className = '', type = 'button', ...props }) {
  const action = useContext(ActionHost);
  if (dock && action && !action.active) return null;
  const host = dock && action?.host;
  const button = <button type={type} className={`action-button ${className}`} ref={host ? action.button : undefined} {...props}>
    <span>{children}</span>{host && <kbd>E</kbd>}
  </button>;
  return host ? createPortal(button, host) : button;
}

export function MapPin({ x, y, label, className = '' }) {
  return <g className={`map-pin ${className}`} transform={`translate(${x} ${y})`}>
    <circle className="pin-halo" r="10"/><circle className="pin-core" r="4"/>
    {label && <text y="-13" textAnchor="middle">{label}</text>}
  </g>;
}

export function Wipe({ scene }) {
  const element = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let animation;
    import('gsap').then(({ gsap }) => {
      if (cancelled || !element.current) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      animation = gsap.timeline().fromTo(element.current,
        { opacity: reduced ? .22 : .96, xPercent: reduced ? 0 : -105 },
        { opacity: reduced ? .22 : .86, xPercent: 0, duration: reduced ? .01 : .22, ease: 'power2.out' }
      ).to(element.current, { opacity: 0, xPercent: reduced ? 0 : 105, duration: reduced ? .12 : .32, ease: 'power2.in' });
    }).catch(() => {});
    return () => { cancelled = true; animation?.kill(); };
  }, [scene]);
  return <div className="screen-wipe" ref={element} aria-hidden="true"><b>NOVA</b></div>;
}

function useClock(delay, active = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), delay);
    return () => clearInterval(timer);
  }, [delay, active]);
  return now;
}

function useTicker(target) {
  const current = useRef(target);
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || current.current === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame;
    function update(now) {
      const fraction = Math.min(1, (now - start) / 450);
      current.current = Math.round(from + (target - from) * (1 - (1 - fraction) ** 3));
      setValue(current.current);
      if (fraction < 1) frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

const roles = { customer: 'Guest', kitchen: 'Line cook', owner: 'Shift manager', display: 'Spectator', split: 'Dual control' };
const secondsLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export function HudHeader({ view, views, changeView, connected, player, score, startedAt }) {
  const now = useClock(1000);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minute = (18 * 60 + Math.floor(elapsed / 5)) % (24 * 60);
  const earnings = useTicker(score.earnings);
  const rankFloor = score.rank === 'Shift captain' ? 750 : score.rank === 'Line lead' ? 300 : 0;
  const rankCeiling = rankFloor === 750 ? 1500 : rankFloor === 300 ? 750 : 300;
  return <header className="hud-header">
    <HudPanel className="player-card">
      <div className="player-crest" aria-hidden="true">N</div>
      <div className="player-profile">
        <span className="hud-eyebrow">{roles[view]}</span><b>{player || roles[view]}</b>
        <StatBar label="Rank progress" value={(score.xp - rankFloor) / (rankCeiling - rankFloor)} caption={`${score.rank} · ${score.xp} XP`}/>
      </div>
      <label className="view-picker"><span className="hud-sr">Player view</span><select value={view} onChange={event => changeView(event.target.value)}>
        {Object.entries(views).map(([id, name]) => <option value={id} key={id}>{name}</option>)}
      </select></label>
    </HudPanel>
    <HudPanel className="service-banner">
      <div className="service-head"><span className="hud-eyebrow">Shift 01 · Live sim</span><time>{secondsLabel(minute)}</time></div>
      <b>Dinner Service</b>
      <StatBar label="Rush pressure" value={score.rush} heat={score.heat} caption={`${score.heat} · ${score.active} active tickets`}/>
    </HudPanel>
    <HudPanel className="earnings-card">
      <div className="score-meta"><span className={connected ? 'connection-online' : 'connection-offline'}>{connected ? '● Synced' : '○ Offline'}</span><time aria-label="Shift elapsed">{secondsLabel(elapsed)}</time></div>
      <div className="earnings-total"><b aria-label={dollars(score.earnings) + ' simulated earnings'}>{dollars(earnings)}</b><span key={score.combo} className={score.combo > 1 ? 'combo streak' : 'combo'}>{score.combo ? `×${score.combo}` : '—'}</span></div>
      <small>Sim earnings · {score.served} served{score.flags ? ` · ${score.flags} bag flag${score.flags === 1 ? '' : 's'}` : ''}</small>
    </HudPanel>
  </header>;
}

export function ScreenDock({ screen, onScreen, sound, toggleSound, grain, toggleGrain, dockRef }) {
  return <nav className="screen-dock" aria-label="Game screens" ref={dockRef}>
    <div className="screen-tabs">
      {SCREENS.map((tab, index) => <button type="button" key={tab.id} aria-current={tab.id === screen ? 'page' : undefined} onClick={() => onScreen(tab.id)}>
        <span className="screen-icon" aria-hidden="true">{tab.icon}</span>{tab.label}<kbd>{index + 1}</kbd>
      </button>)}
    </div>
    <div className="hud-options">
      <button type="button" aria-pressed={sound} aria-label={sound ? 'Mute game audio' : 'Enable game audio'} onClick={toggleSound}>{sound ? 'Audio on' : 'Audio off'}</button>
      <button type="button" aria-pressed={grain} onClick={toggleGrain}>Grain</button>
    </div>
  </nav>;
}

function MissionCard({ order, catalog, now, selected, onSelect, status }) {
  const seconds = Math.max(0, Math.floor((now - (Date.parse(order.createdAt) || now)) / 1000));
  const units = Object.values(order.items || {}).reduce((sum, count) => sum + count, 0);
  const complexity = Math.min(3, Math.max(1, Math.ceil(units / 3) + Number(Boolean(order.delivery))));
  const inner = <>
    <span className="mission-ring" style={{ '--ticket-age': `${Math.min(1, seconds / 180)}turn` }}><small>{secondsLabel(seconds)}</small></span>
    <span className="mission-ticket-copy"><span className="mission-ticket-meta">{order.id} · {status[order.status]}</span><b>{order.customer}</b>
      <small>{Object.entries(order.items || {}).map(([sku, count]) => `${count}× ${catalog[sku]?.name || sku}`).join(' · ')}</small>
    </span>
    <span className="mission-stars" aria-label={`Complexity ${complexity} of 3`}>{'★'.repeat(complexity)}{'☆'.repeat(3 - complexity)}</span>
  </>;
  return onSelect ? <button className="mission-card" type="button" aria-pressed={selected} onClick={() => onSelect(order.id)}>{inner}</button>
    : <article className="mission-card">{inner}</article>;
}

export function MissionRail({ orders, catalog, selected, onSelect, status, active }) {
  const now = useClock(1000, active);
  const tickets = orders.filter(order => !['delivered', 'collected', 'cancelled'].includes(order.status)).slice().reverse();
  return <HudPanel className="mission-rail" aria-label="Ticket missions">
    <div className="rail-heading"><span className="hud-eyebrow">Ticket missions</span><b>{tickets.length}</b></div>
    <div className="rail-cards">
      {tickets.length ? tickets.map(order => <MissionCard key={order.id} {...{ order, catalog, now, status, onSelect }} selected={order.id === selected}/>)
        : <p className="hud-empty">Waiting for the first ticket</p>}
    </div>
  </HudPanel>;
}

export function MiniMap({ state, live, position, active }) {
  const [expanded, setExpanded] = useState(() => !matchMedia('(max-width: 650px)').matches);
  const now = useClock(250, active && expanded);
  const scaleX = x => 12 + x * 3.5, scaleY = y => 14 + y * 4.5;
  const tripOrder = state.orders.find(order => order.status === 'out_for_delivery');
  const trip = tripOrder && deliveryProgress(tripOrder, now + live.clockOffset);
  const courier = trip && routePose(COURIER_ROUTE, trip.progress);
  return <HudPanel as="details" className="minimap" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><span className="hud-eyebrow">Radar</span><span aria-hidden="true">⌁</span></summary>
    {expanded && <svg viewBox="0 0 104 110" role="img" aria-label="Radar showing staff, players, order counter and courier">
      <circle cx="52" cy="52" r="45" fill="#130e2d" stroke="#9a68e2" strokeWidth="1.5"/>
      <path d="M12 52H92M52 12V92" stroke="#4b3d69" strokeDasharray="3 4"/>
      <path d="M18 23H86V46H18ZM17 56H86V80H17Z" fill="#302150" stroke="#70518d"/>
      {state.staff.filter(worker => worker.available && SPOTS[worker.home]).map(worker => <MapPin key={worker.id} x={scaleX(SPOTS[worker.home].x)} y={scaleY(SPOTS[worker.home].y)} className="radar-staff"/>)}
      {live.players.map(player => {
        const p = presencePosition(player, now + live.clockOffset);
        return <MapPin key={player.id} x={scaleX(p.x)} y={scaleY(p.y)} className="radar-peer"/>;
      })}
      {position && <MapPin x={scaleX(position.x)} y={scaleY(position.y)} className="radar-you"/>}
      {state.orders.some(order => order.status === 'queued') && <MapPin x={scaleX(SPOTS.tickets.x)} y={scaleY(SPOTS.tickets.y)} className="radar-ticket"/>}
      <path d="M13 103H91" stroke="#7866a9" strokeDasharray="3 3"/>
      {courier && <g transform={`translate(${13 + (courier.x - 130) / 500 * 78} 103) rotate(${courier.heading})`}><path d="M-4-4 5 0-4 4Z" fill="#00e5ff"/></g>}
    </svg>}
  </HudPanel>;
}

export function Toast({ kind, title, children, onDismiss }) {
  return <HudPanel className={`hud-toast ${kind}`} role="status">
    <span className="hud-eyebrow">{kind === 'ticket' ? 'New objective' : kind === 'passed' ? 'Mission passed' : 'Mission ended'}</span>
    <strong>{title}</strong>{children}
    <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
  </HudPanel>;
}

export function GameSignals({ orders, pricing, play }) {
  const previous = useRef(orders);
  const [signal, setSignal] = useState(null);
  useEffect(() => {
    const next = newestObjective(previous.current, orders);
    previous.current = orders;
    if (next) {
      setSignal(next);
      play(next.kind);
    }
  }, [orders, play]);
  useEffect(() => {
    if (!signal) return;
    const timer = setTimeout(() => setSignal(null), signal.kind === 'ticket' ? 4500 : 14_000);
    return () => clearTimeout(timer);
  }, [signal]);
  if (!signal) return null;
  const { order, kind } = signal;
  const reward = orderReward(order, pricing);
  const title = kind === 'ticket' ? `Ticket ${order.id} is in` : kind === 'failed' ? 'Ticket cancelled' : order.delivery ? 'Delivered' : 'Handoff complete';
  return <Toast key={`${order.id}-${kind}`} kind={kind} title={title} onDismiss={() => setSignal(null)}>
    <p>{order.customer} · {order.id}</p>
    {reward && <>
      <span className="result-stars" aria-label={`${reward.stars} out of 5 stars`}>{'★'.repeat(reward.stars)}{'☆'.repeat(5 - reward.stars)}</span>
      <dl><div><dt>Payout</dt><dd>{dollars(reward.payout)}</dd></div><div><dt>Game tip</dt><dd>{dollars(reward.tips)}</dd></div><div><dt>Time bonus</dt><dd>{dollars(reward.bonus)}</dd></div></dl>
      <small>Simulated rewards · +{reward.xp} XP</small>
    </>}
  </Toast>;
}

export function useHudAudio() {
  const [sound, setSound] = useState(false);
  const audio = useRef(null);
  function play(kind = 'click') {
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    const tones = kind === 'passed' ? [523, 659, 784] : kind === 'failed' ? [180, 130] : kind === 'ticket' ? [660, 880] : [330];
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator(), volume = context.createGain();
      const start = context.currentTime + index * .085;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(.045, start);
      volume.gain.exponentialRampToValueAtTime(.001, start + .12);
      oscillator.connect(volume).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + .13);
    });
  }
  async function toggleSound() {
    if (audio.current) { audio.current.close().catch(() => {}); audio.current = null; setSound(false); return; }
    if (!window.AudioContext) return;
    try { audio.current = new AudioContext(); await audio.current.resume(); setSound(true); play(); }
    catch { audio.current?.close().catch(() => {}); audio.current = null; }
  }
  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);
  return { sound, toggleSound, play };
}
