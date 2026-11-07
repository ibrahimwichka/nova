import React, { useEffect, useState } from 'react';
import './operations.css';

const positiveInteger = value => Number.isInteger(Number(value)) && Number(value) > 0;
const key = () => crypto.randomUUID();
const amount = cents => (Number(cents || 0) / 100).toFixed(2);
const cents = value => Math.round(Number(value) * 100);
const money = (value, currency = 'USD') => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value || 0) / 100); }
  catch { return `${currency} ${amount(value)}`; }
};
const when = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};
const confidence = value => typeof value === 'number' ? `${Math.round(value <= 1 ? value * 100 : value)}% confidence` : value ? `${value} confidence` : 'Confidence not supplied';
const isOpen = request => request.status === 'pending';

export function OwnerAlerts({ state, operations = {}, role }) {
  if (!['owner', 'split', 'display'].includes(role)) return null;
  const alerts = (operations.inventory || []).filter(item => item.alert);
  const requests = (state.operations?.restockRequests || []).filter(isOpen);
  if (!alerts.length && !requests.length) return null;
  return <aside className="ops-owner-banner" aria-label="Owner stock alert"><div role="status"><b>Stock needs attention</b><span>{alerts.length} ingredient alert{alerts.length === 1 ? '' : 's'} · {requests.length} pending replenishment request{requests.length === 1 ? '' : 's'}</span></div><a href="#ai-operations">{role === 'display' ? 'View stock alerts' : 'Review replenishment'} ↓</a></aside>;
}

function AnalysisMeta({ analysis, version, actionable = false }) {
  if (!analysis) return null;
  const stale = analysis.basedOnVersion !== version;
  return <p className="ops-analysis-meta">AI · {analysis.model || 'configured model'} · {when(analysis.generatedAt)} · kitchen v{analysis.basedOnVersion}
    {stale && <span className="ops-stale">{actionable ? 'Kitchen changed. Analyze again before applying.' : 'Kitchen changed since this analysis.'}</span>}
  </p>;
}

function FinanceFigures({ finance = {} }) {
  return <><div className="ops-metrics">
    <div><small>Simulated menu revenue</small><b>{money(finance.simulatedRevenueCents, finance.currency)}</b><span>{finance.completedOrders || 0} completed orders</span></div>
    <div><small>Estimated food costs</small><b>{money(finance.estimatedFoodCostCents, finance.currency)}</b><span>Ingredient cost assumptions</span></div>
    <div><small>Estimated contribution</small><b>{money(finance.contributionCents, finance.currency)}</b><span>Before labor, rent & other costs</span></div>
    <div><small>Logged waste cost</small><b>{money(finance.loggedWasteCents, finance.currency)}</b><span>Based on recorded units</span></div>
  </div><p className="ops-note">{finance.assumptions || 'Demo menu prices and ingredient cost estimates. These figures are not accounting records.'}</p>
    {!!finance.receiptsByCurrency?.length && <p className="ops-note">Reviewed receipts: {finance.receiptsByCurrency.map(row => `${money(row.totalCents, row.currency)} (${row.count} ${row.currency} receipt${row.count === 1 ? '' : 's'})`).join(' · ')}. Currency totals are kept separate.</p>}
  </>;
}

function receiptReview(analysis) {
  if (!analysis?.data) return null;
  const data = analysis.data;
  return {
    merchant: data.merchant || '', date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : '',
    currency: data.currency || '', total: amount(data.totalCents),
    lines: (data.lines || []).map(line => ({ description: line.description || '', ingredient: line.ingredient || '', quantity: line.quantity ?? 0, total: amount(line.totalCents) })),
  };
}

async function resizeReceipt(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP receipt photo.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a receipt photo smaller than 20 MB.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The receipt photo could not be read.'));
    reader.readAsDataURL(file);
  });
  const photo = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The receipt photo could not be opened.'));
    image.src = source;
  });
  const scale = Math.min(1, 1280 / Math.max(photo.naturalWidth, photo.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the receipt photo.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .88);
}

function ReceiptPanel({ analysis, savedReceipts, ingredients, stateVersion, act, disabled, aiDisabled }) {
  const [image, setImage] = useState(''), [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false), [error, setError] = useState('');
  const [review, setReview] = useState(() => receiptReview(analysis));
  useEffect(() => { setReview(receiptReview(analysis)); }, [analysis?.id]);
  const saved = analysis && savedReceipts.some(receipt => receipt.draftId === analysis.id);
  const field = (name, value) => setReview(old => ({ ...old, [name]: value }));
  const lineField = (index, name, value) => setReview(old => ({ ...old, lines: old.lines.map((line, i) => i === index ? { ...line, [name]: value } : line) }));
  async function selectPhoto(file) {
    if (!file) return;
    setUploading(true); setError(''); setImage('');
    try { setImage(await resizeReceipt(file)); setImageName(file.name); }
    catch (problem) { setError(problem.message); }
    finally { setUploading(false); }
  }
  async function saveReceipt(event) {
    event.preventDefault(); setError('');
    if (!review || !analysis) return;
    if (!/^[A-Z]{3}$/.test(review.currency) || !Number.isFinite(cents(review.total)) || cents(review.total) < 0) { setError('Check the currency and total before saving.'); return; }
    const lines = review.lines.map(line => ({ description: line.description.trim(), ingredient: line.ingredient, quantity: Number(line.quantity), totalCents: cents(line.total) }));
    if (lines.some(line => !line.description || !Number.isSafeInteger(line.quantity) || line.quantity < 0 || line.quantity > 1000 || !Number.isSafeInteger(line.totalCents) || line.totalCents < 0 || line.totalCents > 100000000)) { setError('Each line needs a description, a whole-unit quantity from 0 to 1,000, and a valid amount.'); return; }
    if (lines.length > 30 || lines.reduce((total, line) => total + line.totalCents, 0) > cents(review.total)) { setError('Review up to 30 lines. Their combined amount must not exceed the receipt total.'); return; }
    await act('/receipts', { draftId: analysis.id, merchant: review.merchant.trim(), date: review.date, currency: review.currency, totalCents: cents(review.total), lines }, 'Saving reviewed receipt…');
  }
  return <section className="ops-card ops-receipt"><div className="ops-card-heading"><div><span className="ops-eyebrow">5 / RECEIPT REVIEW</span><h3>Turn a receipt photo into a draft</h3></div></div>
    <p>Choose a receipt, analyze it, then correct every field before saving. Saving a receipt does not add stock; matched lines may update estimated ingredient costs.</p>
    <div className="ops-button-row"><label className="ops-upload">Choose receipt photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || uploading} onChange={event => { selectPhoto(event.target.files?.[0]); event.target.value = ''; }}/></label>
      {image && <button type="button" disabled={disabled || uploading} onClick={() => { setImage(''); setImageName(''); }}>Clear photo</button>}
      <button type="button" className="primary" disabled={aiDisabled || uploading || !image} onClick={() => act('/ai/receipt', { image }, 'Reading receipt with OpenRouter…')}>Analyze selected receipt</button>
    </div>
    {uploading && <p role="status" className="ops-note">Preparing photo…</p>}
    {image && <figure className="ops-receipt-preview"><img src={image} alt="Selected receipt awaiting analysis"/><figcaption>{imageName} · resized to at most 1,280 px</figcaption></figure>}
    <p className="ops-note">The selected still image is sent to OpenRouter only when you press Analyze selected receipt. Nova does not store the image.</p>
    {error && <p className="ops-error" role="alert">{error}</p>}
    {analysis && review && <><AnalysisMeta analysis={analysis} version={stateVersion}/><p className="ops-note">{confidence(analysis.data?.confidence)} · review against the original receipt.</p>
      <form onSubmit={saveReceipt} className="ops-receipt-form"><div className="ops-form-grid ops-receipt-fields">
        <label>Merchant<input required maxLength="120" value={review.merchant} disabled={disabled || saved} onChange={event => field('merchant', event.target.value)}/></label>
        <label>Receipt date<input type="date" value={review.date} disabled={disabled || saved} onChange={event => field('date', event.target.value)}/></label>
        <label>Currency<input required pattern="[A-Z]{3}" maxLength="3" value={review.currency} disabled={disabled || saved} onChange={event => field('currency', event.target.value.toUpperCase())}/></label>
        <label>Total ({review.currency})<input required type="number" min="0" step="0.01" value={review.total} disabled={disabled || saved} onChange={event => field('total', event.target.value)}/></label>
      </div><div className="ops-table-wrap"><table><thead><tr><th>Description</th><th>Match ingredient</th><th>Units received on receipt</th><th>Line total ({review.currency})</th><th><span className="ops-screen-reader">Remove line</span></th></tr></thead><tbody>
        {review.lines.map((line, index) => <tr key={index}><td><input required aria-label={`Receipt line ${index + 1} description`} value={line.description} maxLength="200" disabled={disabled || saved} onChange={event => lineField(index, 'description', event.target.value)}/></td>
          <td><select aria-label={`Receipt line ${index + 1} ingredient`} value={line.ingredient} disabled={disabled || saved} onChange={event => lineField(index, 'ingredient', event.target.value)}><option value="">Unmatched</option>{ingredients.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></td>
          <td><input required aria-label={`Receipt line ${index + 1} quantity`} type="number" min="0" max="1000" step="1" value={line.quantity} disabled={disabled || saved} onChange={event => lineField(index, 'quantity', event.target.value)}/></td>
          <td><input aria-label={`Receipt line ${index + 1} total`} type="number" min="0" step="0.01" value={line.total} disabled={disabled || saved} onChange={event => lineField(index, 'total', event.target.value)}/></td>
          <td><button type="button" aria-label={`Remove receipt line ${index + 1}`} disabled={disabled || saved} onClick={() => setReview(old => ({ ...old, lines: old.lines.filter((_, i) => i !== index) }))}>×</button></td></tr>)}
      </tbody></table></div><div className="ops-button-row"><button type="button" disabled={disabled || saved || review.lines.length >= 30} onClick={() => setReview(old => ({ ...old, lines: [...old.lines, { description: '', ingredient: '', quantity: 0, total: '0.00' }] }))}>Add line</button><button className="primary" disabled={disabled || saved}>{saved ? 'Receipt saved' : 'Save reviewed receipt'}</button></div>
      <p className="ops-note">Match quantities to the inventory unit before saving cost estimates. Record any physically received stock separately in Owner replenishment.</p></form>
    </>}
    {!!savedReceipts.length && <details><summary>Recently saved receipts ({savedReceipts.length})</summary><ul className="ops-simple-list">{savedReceipts.slice(0, 5).map(receipt => <li key={receipt.id}><b>{receipt.merchant || 'Receipt'}</b><span>{receipt.date || when(receipt.reviewedAt)} · {money(receipt.totalCents, receipt.currency)}</span></li>)}</ul></details>}
  </section>;
}

export default function OperationsCenter({ state, config = {}, operations = {}, act, busy, role, category }) {
  const [staffMessage, setStaffMessage] = useState('');
  const ingredients = Object.entries(config.ingredients || {});
  const firstIngredient = ingredients[0]?.[0] || '';
  const [requestIngredient, setRequestIngredient] = useState(firstIngredient), [requestQuantity, setRequestQuantity] = useState('');
  const [receiveIngredient, setReceiveIngredient] = useState(firstIngredient), [receiveQuantity, setReceiveQuantity] = useState('');
  const [wasteIngredient, setWasteIngredient] = useState(firstIngredient), [wasteQuantity, setWasteQuantity] = useState(''), [wasteReason, setWasteReason] = useState('');
  const [shortageIngredient, setShortageIngredient] = useState(firstIngredient);
  const [tab, setTab] = useState(config.visionConfigured ? 'ai' : 'stock');
  if (role === 'customer') return null;
  const owner = role === 'owner' || role === 'split', readOnly = role === 'display';
  const disabled = !!busy, aiDisabled = disabled || !config.visionConfigured;
  const stored = state.operations || {}, analyses = stored.analyses || {};
  const inventory = operations.inventory || [], finance = operations.finance || {};
  const requests = (stored.restockRequests || []).filter(isOpen);
  const alerts = inventory.filter(item => item.alert);
  const ingredientName = id => config.ingredients?.[id] || id;
  const prep = analyses.prep, forecast = analyses.inventory, staff = analyses.staff;
  const scenario = state.scenarios?.find(item => item.id === staff?.data?.scenarioId);
  const prepStale = !prep || prep.basedOnVersion !== state.version;
  const staffStale = !staff || staff.basedOnVersion !== state.version || scenario?.snapshot?.version !== state.version;
  const requestFor = ingredient => requests.find(request => request.ingredient === ingredient);
  const receive = (ingredient, quantity, requestId) => act('/restock', { ingredient, quantity: Number(quantity), ...(requestId ? { requestId } : {}), idempotencyKey: key() }, 'Recording received stock…');
  async function manualRequest(event) {
    event.preventDefault();
    const result = await act('/restock-requests', { ingredient: requestIngredient, quantity: Number(requestQuantity) }, 'Notifying owner in this app…');
    if (result) setRequestQuantity('');
  }
  async function manualReceive(event) {
    event.preventDefault();
    const result = await receive(receiveIngredient, receiveQuantity, requestFor(receiveIngredient)?.id);
    if (result) setReceiveQuantity('');
  }
  async function recordWaste(event) {
    event.preventDefault();
    const result = await act('/inventory/waste', { ingredient: wasteIngredient, quantity: Number(wasteQuantity), reason: wasteReason.trim(), idempotencyKey: key() }, 'Recording inventory waste…');
    if (result) { setWasteQuantity(''); setWasteReason(''); }
  }
  const categoryTitles = { prep: ['Preparation', 'Review the next tickets and start a feasible order.'], inventory: ['Inventory & restocking', 'Track ingredients, receive stock, and review demand.'], staff: ['Team & equipment', 'Preview how the kitchen can cover an absence or outage.'], finance: ['Finances & receipts', 'Review shift figures and upload supplier receipts.'] };
  const title = categoryTitles[category];
  const showCard = name => !category || category === name;
  return <section id="ai-operations" className={'operations-center' + (category ? ' is-categorized' : '')} aria-label="AI and kitchen operations"><div className="ops-title"><div><span className="ops-eyebrow">SHARED KITCHEN OPERATIONS</span><h2>{title?.[0] || (readOnly ? 'Operations overview' : 'Plan the shift. Review each action.')}</h2><p>{title?.[1] || (readOnly ? 'Live inventory alerts and simulated financial figures from the shared restaurant.' : 'Live stock counts, explicit AI analysis, and owner replenishment in one place.')}</p></div><span className="ops-live-label">Kitchen v{state.version}</span></div>
    <section hidden={!!category && category !== 'inventory'} className={'ops-alerts ' + (alerts.length || requests.length ? 'has-alerts' : '')} aria-label="Owner stock notifications"><div className="ops-alert-heading"><h3>Owner stock notifications</h3><span role="status">{alerts.length} stock alert{alerts.length === 1 ? '' : 's'} · {requests.length} open request{requests.length === 1 ? '' : 's'}</span></div>
      <p className="ops-note">Shared in-app notifications update on both Macs. Replenishment records units that have actually arrived.</p>
      {!alerts.length && !requests.length && <p className="ops-all-clear">Stock is above the current alert thresholds. No open replenishment requests.</p>}
      {!!alerts.length && <ul className="ops-alert-list">{alerts.map(item => <li key={item.id}><div><b>{item.name || ingredientName(item.id)} · {item.available} available</b><span>{item.reason || `Reorder point ${item.reorderPoint}; target ${item.target}.`}</span></div>{!readOnly && Number(item.suggestedQuantity) > 0 && (owner ? <button disabled={disabled} onClick={() => receive(item.id, item.suggestedQuantity, requestFor(item.id)?.id)}>Record received +{item.suggestedQuantity}</button> : <button disabled={disabled || !!requestFor(item.id)} onClick={() => act('/restock-requests', { ingredient: item.id, quantity: item.suggestedQuantity }, 'Notifying owner in this app…')}>{requestFor(item.id) ? 'Owner request open' : `Request ${item.suggestedQuantity} units`}</button>)}</li>)}</ul>}
      {!!requests.length && <div className="ops-request-list"><h4>Awaiting owner replenishment</h4>{requests.map(request => <div key={request.id}><span><b>{ingredientName(request.ingredient)} · {request.quantity} units still requested</b><small>{request.source || 'Shared stock request'}{request.receivedQuantity ? ` · ${request.receivedQuantity} units already received` : ''}{request.createdAt ? ` · ${when(request.createdAt)}` : ''}</small></span>{owner && <button disabled={disabled} onClick={() => receive(request.ingredient, request.quantity, request.id)}>Record received +{request.quantity}</button>}</div>)}</div>}
    </section>
    {readOnly ? <div className="ops-card"><h3>Simulated shift figures</h3><FinanceFigures finance={finance}/></div> : <>
      {!category && <div className="ops-tabs" role="tablist" aria-label="Operations sections">
        {[['stock', 'Stock', alerts.length ? String(alerts.length) : ''], ['ai', 'AI tools', config.visionConfigured ? '' : 'off'], ...(owner ? [['receipts', 'Receipts', config.visionConfigured ? '' : 'off']] : [])].map(([id, label, badge]) =>
          <button key={id} type="button" role="tab" id={`ops-tab-${id}`} aria-controls={`ops-panel-${id}`} aria-selected={tab === id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}{badge && <span className={'ops-tab-badge' + (badge === 'off' ? ' muted' : '')}>{badge}</span>}</button>)}
      </div>}
      <div className="ops-tab-panel ops-ai-wrapper" hidden={!category && tab !== 'ai'} {...(!category ? {role:'tabpanel',id:'ops-panel-ai','aria-labelledby':'ops-tab-ai'} : {})}>{!config.visionConfigured && <p className="ops-ai-off" role="status"><b>AI is off on this server.</b> Add OPENROUTER_API_KEY to the server environment and restart or redeploy to enable these buttons. Stock tools work without it.</p>}<div className="ops-grid"><section hidden={!showCard('prep')} className="ops-card"><div className="ops-card-heading"><div><span className="ops-eyebrow">1 / PREPARATION PRIORITIES</span><h3>Choose the next feasible ticket</h3></div><button disabled={aiDisabled} onClick={() => act('/ai/prep', {}, 'Checking preparation priorities with AI…')}>Analyze prep queue</button></div><p>AI ranks tickets using live stock, staff, and equipment. Starting a ticket still passes the kitchen’s ingredient and capacity checks.</p>
        {!prep && <p className="ops-empty">Analyze the current queue to see suggested starts, holds, and blockers.</p>}
        {prep && <><p>{prep.data?.summary}</p><AnalysisMeta analysis={prep} version={state.version} actionable/><ul className="ops-priority-list">{(prep.data?.priorities || []).map((priority, index) => {
          const evidence = operations.orders?.find(order => order.id === priority.orderId);
          const startable = priority.action === 'start' && evidence?.canStart;
          return <li key={`${priority.orderId}-${index}`}><div><b>{priority.orderId} <span className="ops-action-tag">{priority.action}</span></b><p>{priority.reason}</p>{!!evidence?.blockingReasons?.length && <small>{evidence.blockingReasons.join(' · ')}</small>}</div>{priority.action === 'start' && <button disabled={disabled || prepStale || !startable} onClick={() => act('/ai/prep/start', { orderId: priority.orderId, analysisId: prep.id }, 'Starting checked preparation…')}>Start prep</button>}</li>;
        })}</ul></>}
      </section>
      <section hidden={!showCard('inventory')} className="ops-card"><div className="ops-card-heading"><div><span className="ops-eyebrow">2 / INVENTORY ESTIMATE</span><h3>Look ahead at ingredient demand</h3></div><button disabled={aiDisabled} onClick={() => act('/ai/inventory', {}, 'Estimating demand and queuing owner requests…')}>Forecast & request stock</button></div><p>Creates a rough next-30-minute estimate and queues in-app owner requests for ingredients below target. Estimates use sparse demo history; this is not a trained demand predictor.</p>
        {forecast && <><p>{forecast.data?.summary}</p><AnalysisMeta analysis={forecast} version={state.version}/><ul className="ops-simple-list">{(forecast.data?.forecasts || []).map((item, index) => <li key={`${item.ingredient}-${index}`}><div><b>{ingredientName(item.ingredient)} · {item.unitsNext30Min} estimated units</b><span>{item.reason}</span></div><small>{confidence(item.confidence)}</small></li>)}</ul></>}
        {!forecast && <p className="ops-empty">Live stock alerts above work before any AI analysis.</p>}
      </section>
      <section hidden={!showCard('staff')} className="ops-card"><div className="ops-card-heading"><div><span className="ops-eyebrow">3 / STAFF & EQUIPMENT</span><h3>Preview a recovery plan</h3></div></div><p>Describe an absence or equipment outage. AI interprets the request; the simulator compares fixed assignments with qualified cross-station coverage.</p>
        <form onSubmit={event => { event.preventDefault(); act('/ai/staff', { message: staffMessage.trim() }, 'Interpreting staffing disruption and comparing recovery…'); }}><label>What changed?<textarea required maxLength="1000" rows="3" value={staffMessage} disabled={disabled} onChange={event => setStaffMessage(event.target.value)} placeholder="For example: the grill worker is absent and the fryer is unavailable."/></label><div className="ops-button-row"><button disabled={aiDisabled || !staffMessage.trim()}>Preview recovery with AI</button></div></form>
        <details><summary>Current staff & equipment</summary><ul className="ops-simple-list">{(state.staff || []).map(worker => <li key={worker.id}><span>{worker.name} · {worker.skills?.join(', ')}</span><b>{worker.available ? 'Available' : 'Absent'}</b></li>)}{(state.stations || []).map(station => <li key={station.id}><span>{station.name}</span><b>{station.available ? 'Equipment on' : 'Equipment off'}</b></li>)}</ul></details>
        {staff && <><p>{staff.data?.summary}</p><AnalysisMeta analysis={staff} version={state.version} actionable/>{scenario && <><div className="ops-comparison"><div><small>Fixed assignments</small><b>{scenario.comparison?.baseline?.metrics?.completed ?? 0} completed</b></div><div><small>Qualified recovery</small><b>{scenario.comparison?.recovery?.metrics?.completed ?? 0} completed</b></div></div><ul className="ops-bullets">{(scenario.comparison?.actions || []).map((action, index) => <li key={index}>{action}</li>)}{(scenario.comparison?.recovery?.moves || []).map((move, index) => <li key={`move-${index}`}>{move}</li>)}</ul>{owner && <button className="primary" disabled={disabled || staffStale} onClick={() => act(`/scenarios/${scenario.id}/apply`, {}, 'Applying reviewed staffing scenario…')}>Apply recovery scenario</button>}<p className="ops-note">Applying changes the shared simulated kitchen. Previewing alone leaves live resources unchanged.</p></>}{!scenario && <p className="ops-note">No saved scenario was returned. Analyze a new disruption to compare outcomes.</p>}</>}
      </section>
      <section hidden={!showCard('finance')} className="ops-card"><div className="ops-card-heading"><div><span className="ops-eyebrow">4 / FINANCIAL EXPLANATION</span><h3>Understand the demo shift figures</h3></div><button disabled={aiDisabled} onClick={() => act('/ai/finance', {}, 'Explaining simulated financial figures…')}>Explain figures with AI</button></div><FinanceFigures finance={finance}/>{analyses.finance && <><p>{analyses.finance.data?.summary}</p><AnalysisMeta analysis={analyses.finance} version={state.version}/><ul className="ops-simple-list">{(analyses.finance.data?.insights || []).map((insight, index) => <li key={index}><div><b>{insight.title}</b><span>{insight.detail}</span></div></li>)}</ul></>}
      </section></div></div>
      <div className="ops-tab-panel ops-stock-wrapper" hidden={category ? category !== 'inventory' : tab !== 'stock'} {...(!category ? {role:'tabpanel',id:'ops-panel-stock','aria-labelledby':'ops-tab-stock'} : {})}><section className="ops-card ops-stock"><div className="ops-card-heading"><div><span className="ops-eyebrow">LIVE INVENTORY</span><h3>{owner ? 'Owner replenishment' : 'Request owner replenishment'}</h3></div></div><p>On hand is physical demo stock. Committed units are reserved for queued demand; available units show what remains after commitments. Record received units only when replenishment has arrived.</p>
        <div className="ops-table-wrap"><table><thead><tr><th>Ingredient</th><th>On hand</th><th>Committed</th><th>Available</th><th>Reorder / target</th><th>Suggested top-up</th></tr></thead><tbody>{inventory.map(item => <tr key={item.id} className={item.alert ? 'ops-low-stock' : ''}><th scope="row">{item.name || ingredientName(item.id)}</th><td>{item.onHand}</td><td>{item.committed}</td><td>{item.available}</td><td>{item.reorderPoint} / {item.target}</td><td>{item.suggestedQuantity}</td></tr>)}</tbody></table></div>
        <div className="ops-stock-forms"><form onSubmit={manualRequest}><h4>Send an in-app owner request</h4><div className="ops-form-grid"><label>Ingredient<select value={requestIngredient} disabled={disabled} onChange={event => setRequestIngredient(event.target.value)}>{ingredients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Units requested<input required type="number" min="1" max="1000" step="1" value={requestQuantity} disabled={disabled} onChange={event => setRequestQuantity(event.target.value)}/></label></div><button disabled={disabled || !positiveInteger(requestQuantity) || !requestIngredient}>Notify owner</button><p className="ops-note">Requests appear here on the owner’s device. No email, SMS, supplier order, or purchase is sent.</p></form>
          {owner && <form onSubmit={manualReceive}><h4>Record stock actually received</h4><div className="ops-form-grid"><label>Ingredient<select value={receiveIngredient} disabled={disabled} onChange={event => setReceiveIngredient(event.target.value)}>{ingredients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Units received<input required type="number" min="1" max="1000" step="1" value={receiveQuantity} disabled={disabled} onChange={event => setReceiveQuantity(event.target.value)}/></label></div><button className="primary" disabled={disabled || !positiveInteger(receiveQuantity) || !receiveIngredient}>Add received units to stock</button><p className="ops-note">Adds these units to shared inventory and reduces the matching request. It closes when fully received.</p></form>}
        </div>
        {owner && <details><summary>Record waste or simulate a shortage</summary><div className="ops-stock-forms"><form onSubmit={recordWaste}><h4>Record discarded units</h4><div className="ops-form-grid"><label>Ingredient<select value={wasteIngredient} disabled={disabled} onChange={event => setWasteIngredient(event.target.value)}>{ingredients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Units discarded<input required type="number" min="1" max="1000" step="1" value={wasteQuantity} disabled={disabled} onChange={event => setWasteQuantity(event.target.value)}/></label></div><label>Reason<input required maxLength="200" value={wasteReason} disabled={disabled} onChange={event => setWasteReason(event.target.value)} placeholder="For example: damaged packaging"/></label><button disabled={disabled || !positiveInteger(wasteQuantity) || !wasteReason.trim()}>Record waste & deduct stock</button></form><div><h4>Test the shared owner alert</h4><p className="ops-note">This demo control sets the selected ingredient’s on-hand quantity to zero immediately.</p><label>Ingredient<select value={shortageIngredient} disabled={disabled} onChange={event => setShortageIngredient(event.target.value)}>{ingredients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><button disabled={disabled || !shortageIngredient} onClick={() => act('/resources', { type: 'inventory', id: shortageIngredient, quantity: 0 }, 'Simulating an ingredient stockout…')}>Simulate stockout</button></div></div></details>}
        {!!stored.restocks?.length && <details><summary>Recent received stock ({stored.restocks.length})</summary><ul className="ops-simple-list">{stored.restocks.slice(0, 5).map(restock => <li key={restock.id}><span>{ingredientName(restock.ingredient)} · +{restock.quantity} units</span><small>{when(restock.at)}</small></li>)}</ul></details>}
      </section></div>
      {owner && <div className="ops-tab-panel ops-receipt-wrapper" hidden={category ? category !== 'finance' : tab !== 'receipts'} {...(!category ? {role:'tabpanel',id:'ops-panel-receipts','aria-labelledby':'ops-tab-receipts'} : {})}>{!config.visionConfigured && <p className="ops-ai-off" role="status"><b>AI is off on this server.</b> Add OPENROUTER_API_KEY to the server environment and restart or redeploy to enable these buttons. Stock tools work without it.</p>}<ReceiptPanel analysis={analyses.receipt} savedReceipts={stored.receipts || []} ingredients={ingredients} stateVersion={state.version} act={act} disabled={disabled} aiDisabled={aiDisabled}/></div>}
      <details hidden={!!category} className="ops-test-notes"><summary>How to test these tools</summary><ol><li>Place two Customer orders, then analyze prep. Start a feasible suggestion; change stock and confirm the old suggestion becomes unavailable.</li><li>In Owner replenishment, simulate a stockout. Check the shared alert on the other Mac, request stock from Kitchen, then record the received units as Owner.</li><li>Run Forecast & request stock. Check the estimate label and the owner’s open requests.</li><li>Describe a real worker name and equipment outage. Review the computed comparison before applying the recovery scenario.</li><li>Complete a demo order, record waste, and ask AI to explain the simulated figures.</li><li>Choose a receipt photo, explicitly analyze it, edit the draft, and save it. Verify inventory stays unchanged until received units are recorded separately.</li></ol></details>
    </>}
  </section>;
}
