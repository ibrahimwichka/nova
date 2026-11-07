import React, { useEffect, useRef, useState } from 'react';
import Game from './Game.jsx';
import { DeliveryBoard } from './Delivery.jsx';
import { OPERATION_TABS, WORKSPACE_TABS, WorkspacePanel, WorkspaceTabs } from './WorkspaceTabs.jsx';
import OperationsCenter, { OwnerAlerts } from './Operations.jsx';
import { GameSignals, HudHeader, ScreenDock, useHudAudio, Wipe } from './Hud.jsx';
import { DispatcherFeed, InventoryScreen, ReplayScreen } from './HudScreens.jsx';
import { SCREENS, shiftScore, stageFromLocation } from './hud-state.mjs';

export default function PlayInterior({ data, view, views, changeView, connected, act, busy, error, clearError, live, floorRef, inventoryTools, opsTools, children }) {
  const [screen, setScreen] = useState(() => stageFromLocation(location.hash, new URLSearchParams(location.search).get('tab')));
  const [opsTab, setOpsTab] = useState(() => new URLSearchParams(location.search).get('tab') || 'prep');
  const tabs = WORKSPACE_TABS[view]?.filter(([id]) => !['floor', 'delivery', 'inventory'].includes(id));
  const category = tabs?.some(([id]) => id === opsTab) ? opsTab : 'prep';
  const [controlledRole, setControlledRole] = useState('customer');
  const [grain, setGrain] = useState(true);
  const [startedAt] = useState(Date.now);
  const dockRef = useRef(null);
  const { sound, toggleSound, play } = useHudAudio();
  const { state, config, operations = {} } = data;
  const { orders } = state;
  const pricing = state.operations?.pricing || {};
  const score = shiftScore(orders, pricing);
  const gameProps = { state, config, act, busy, live, screenActive: screen === 'floor' };
  const preferredOrderId = view === 'customer' || view === 'split' ? localStorage.getItem('nova-game-order') || '' : '';
  const player = view === 'customer' ? localStorage.getItem('nova-game-name') || 'Demo guest' : '';

  function selectScreen(id) {
    const next = SCREENS.find(entry => entry.id === id);
    if (!next) return;
    const url = new URL(location.href);
    url.searchParams.delete('tab');
    if (id === 'ops' && tabs) url.searchParams.set('tab', category);
    url.hash = next.id === 'floor' ? '' : next.anchor;
    history.replaceState(null, '', url);
    setScreen(next.id);
    play();
  }

  function selectCategory(id) {
    setOpsTab(id);
    const url = new URL(location.href);
    url.searchParams.set('tab', id);
    url.hash = 'ai-operations';
    history.replaceState(null, '', url);
  }

  useEffect(() => {
    function readScreen() { setScreen(stageFromLocation(location.hash, new URLSearchParams(location.search).get('tab'))); }
    window.addEventListener('hashchange', readScreen);
    return () => window.removeEventListener('hashchange', readScreen);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    function onKey(event) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
      if (event.key.toLowerCase() === 'q') {
        event.preventDefault();
        dockRef.current?.querySelector('[aria-current="page"]')?.focus();
      } else if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        selectScreen(SCREENS[Number(event.key) - 1].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return <div className="nova-play" data-screen={screen} data-grain={grain}>
    <HudHeader {...{ view, views, changeView, connected, player, score, startedAt }}/>
    <ScreenDock screen={screen} onScreen={selectScreen} {...{ sound, toggleSound, grain, dockRef }} toggleGrain={() => setGrain(current => !current)}/>
    <main onClick={event => {
      const href = event.target.closest?.('a[href^="#"]')?.getAttribute('href');
      const next = SCREENS.find(entry => href === '#' + entry.anchor);
      if (!next) return;
      event.preventDefault();
      selectScreen(next.id);
    }} className="game-mode-active" ref={floorRef} tabIndex={-1}>
      {(!connected || error || busy) && <div className="hud-notices">
        {!connected && <div className="notice error">Connection lost · reconnect before making changes</div>}
        {error && <div className="notice error" role="alert">{error}<button type="button" className="quiet" onClick={clearError}>Dismiss</button></div>}
        {busy && <div className="busy" role="status">{busy}</div>}
      </div>}
      <section id="restaurant-floor" className="floor-screen" aria-label="Service floor" hidden={screen !== 'floor'}>
        {view === 'split' ? <>
          <div className="split-intro">
            <h1>Live split view</h1>
            <div className="row wrap">
              {['customer', 'owner'].map(role => <button key={role} type="button" aria-pressed={controlledRole === role} onClick={() => setControlledRole(role)}>WASD · {role === 'customer' ? 'Customer' : 'Owner'}</button>)}
            </div>
          </div>
          <div className="split-layout">
            <Game {...gameProps} compact role="customer" keyboardActive={controlledRole === 'customer'} onActivate={() => setControlledRole('customer')}/>
            <Game {...gameProps} compact role="owner" keyboardActive={controlledRole === 'owner'} onActivate={() => setControlledRole('owner')}/>
          </div>
        </> : <Game {...gameProps} key={view} role={view}/>}
      </section>
      <div className="stage-surface" hidden={screen !== 'delivery'}>
        <div className="screen-title"><span className="hud-eyebrow">01 / Courier dispatch</span><h1>Delivery map</h1><p>Track the bag from the kitchen to the customer’s door.</p></div>
        <DeliveryBoard state={state} act={act} busy={busy} clockOffset={live.clockOffset} readOnly={view === 'display'} preferredOrderId={preferredOrderId} active={screen === 'delivery'}/>
      </div>
      <div className="stage-surface" hidden={screen !== 'inventory'}>
        <InventoryScreen inventory={operations.inventory || []} {...{ view, act, busy }}/>
        {tabs && <details className="workspace-advanced"><summary>Inventory history & stock controls</summary>
          <OperationsCenter {...{ state, config, operations, act, busy }} role={view} category="inventory" id="inventory-operations"/>
          {inventoryTools}
        </details>}
      </div>
      <div className="stage-surface" hidden={screen !== 'replay'}>
        <ReplayScreen scenarios={state.scenarios} stations={state.stations} staff={state.staff} active={screen === 'replay'}/>
      </div>
      <div className="stage-surface" hidden={screen !== 'ops'}>
        <div className="screen-title"><span className="hud-eyebrow">04 / Dispatch desk</span><h1>Operations</h1></div>
        <OwnerAlerts state={state} operations={operations} role={view}/>
        <DispatcherFeed analyses={state.operations?.analyses} version={state.version}/>
        {tabs ? <>
          <WorkspaceTabs role={view} value={category} onChange={selectCategory} tabs={tabs}/>
          <WorkspacePanel role={view} id="operations" value={category}>
            <OperationsCenter {...{ state, config, operations, act, busy }} role={view} category={OPERATION_TABS.includes(category) ? category : 'prep'}/>
            {opsTools(category, () => selectScreen('floor'))}
          </WorkspacePanel>
          {tabs.filter(([id]) => !OPERATION_TABS.includes(id)).map(([id]) => <WorkspacePanel key={id} role={view} id={id} value={category}>
            {opsTools(id, () => selectScreen('floor'))}
          </WorkspacePanel>)}
        </> : <>
          <OperationsCenter {...{ state, config, operations, act, busy }} role={view === 'customer' ? 'display' : view}/>
          {opsTools(category, () => selectScreen('floor'))}
        </>}
      </div>
      <div className="support-shell" hidden={screen !== 'ops'}>{children}</div>
    </main>
    <GameSignals orders={orders} pricing={pricing} play={play}/>
    <Wipe scene={screen}/>
  </div>;
}
