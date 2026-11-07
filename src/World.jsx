import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import Game from "./Game.jsx";
import OperationsCenter from "./Operations.jsx";
import { Panel, ProgressBar, Notice } from "./UI.jsx";
import { WORLD_TABS, worldTab } from "./experience-logic.mjs";
import { playbackMinute } from "../shared/replay.mjs";
import "./world.css";
const DeliveryBoard = lazy(() =>
  import("./Delivery.jsx").then((m) => ({ default: m.DeliveryBoard })),
);
const ReplayStudio = lazy(() => import("./ReplayStudio.jsx"));
const ROLES = [
  ["customer", "Customer"],
  ["kitchen", "Kitchen"],
  ["owner", "Owner"],
  ["display", "Live display"],
  ["split", "Linked views"],
];
const CATEGORIES = {
  owner: [
    ["prep", "Prep planning"],
    ["staff", "Team & capacity"],
    ["finance", "Finances & receipts"],
    ["packing", "Packing & camera"],
    ["guide", "Demo guide"],
  ],
  kitchen: [
    ["prep", "Prep planning"],
    ["packing", "Packing & camera"],
    ["staff", "Team & capacity"],
    ["guide", "Demo guide"],
  ],
  display: [
    ["prep", "Prep planning"],
    ["staff", "Team & capacity"],
    ["guide", "Demo guide"],
  ],
};
function AiBrief({ state, busy }) {
  const analysis = Object.values(state.operations?.analyses || {})
    .filter((a) => a.data?.summary)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt))[0];
  return (
    <Panel className="ai-brief">
      <span className="ai-symbol" aria-hidden="true">
        ✦
      </span>
      <div>
        <span className="eyebrow">AI OPERATIONS ASSISTANT</span>
        <p>
          {busy ||
            analysis?.data.summary ||
            "Review the queue, anticipate ingredient shortages and compare recovery plans. AI recommendations use the current restaurant data; you review changes before applying them."}
        </p>
        {analysis && (
          <small>
            {analysis.basedOnVersion === state.version
              ? "Based on the current kitchen snapshot."
              : "The kitchen has changed since this analysis. Review freshness before applying."}
          </small>
        )}
      </div>
      <span className="advisory-chip">Advisory</span>
    </Panel>
  );
}
function Guide({ config }) {
  return (
    <Panel className="demo-guide">
      <span className="eyebrow">A CONNECTED DEMONSTRATION</span>
      <h2>Two Macs. One restaurant.</h2>
      <div className="guide-grid">
        {[
          [
            "Customer perspective",
            "On Mac 1, choose Customer. Walk to the counter in first person, choose a meal and submit an order. Switch to the floor plan at any time.",
          ],
          [
            "Kitchen perspective",
            "On Mac 2, select the same ticket. Accept it, visit the required stations, then assemble and verify its bag. Missing items block handoff.",
          ],
          [
            "AI packing verification",
            "In Operations → Packing & camera, select a packing ticket and Upload photo. Use an unpacked tray photo. Analyze explicitly; an uncertain view cannot approve a bag.",
          ],
          [
            "Owner operations",
            "Use preparation AI, inventory forecasts, staffing recovery and financial explanations. Replenishment requests appear inside Nova; record received units to add stock.",
          ],
          [
            "Pickup and delivery",
            "Seal a verified bag, then open Delivery. Match the courier reference after arrival. Follow the journey and confirm receipt at the house.",
          ],
          [
            "What-if scenarios",
            "Compare a missing worker, ingredient shortage, equipment outage or rush. Pause, scrub and change replay speed. Previewing leaves live orders unchanged.",
          ],
        ].map(([title, body], i) => (
          <section key={title}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <p className="demo-disclaimer">
        Demonstration data: simulated orders, travel distances and financial
        estimates. No payment, GPS, supplier purchase or external message is
        created.{" "}
        {config.visionConfigured
          ? "AI is configured on this server."
          : "Set a server-side OpenRouter key to enable AI."}{" "}
        Selected photos are sent to OpenRouter only after Analyze; Nova does not
        save the image.
      </p>
    </Panel>
  );
}
function InventoryGrid({ inventory }) {
  const [selected, setSelected] = useState("");
  const item = inventory.find((i) => i.id === selected);
  return (
    <>
      <div className="inventory-grid">
        {inventory.map((i, index) => (
          <button
            key={i.id}
            className={
              "inventory-card " +
              (i.alert ? "stock-warning " : "") +
              (i.id === selected ? "is-selected" : "")
            }
            onClick={() => setSelected(i.id)}
            aria-pressed={i.id === selected}
          >
            <span className="inventory-card-top">
              <small>INGREDIENT {String(index + 1).padStart(2, "0")}</small>
              <em>{i.alert ? "! Replenishment needed" : "Stock available"}</em>
            </span>
            <span className="inventory-card-main">
              <b>{i.name}</b>
              <strong>
                {i.available}
                <small>available</small>
              </strong>
            </span>
            <ProgressBar
              label={`${i.onHand} on hand · ${i.committed} committed`}
              value={Math.max(0, i.available)}
              max={Math.max(i.target, i.onHand, 1)}
              detail={`Target ${i.target}`}
            />
          </button>
        ))}
      </div>
      {item && (
        <Panel className="inventory-selection">
          <b>{item.name}</b>
          <p>
            {item.reason}{" "}
            {item.suggestedQuantity > 0
              ? `Suggested top-up: ${item.suggestedQuantity} units.`
              : "No top-up needed."}{" "}
            Use the tools below to request or record received stock.
          </p>
        </Panel>
      )}
    </>
  );
}
export default function World({
  state,
  config,
  operations,
  act,
  busy,
  error,
  connected,
  view,
  onRole,
  live,
  scenarios,
  staff,
  stockCorrection,
  packing,
  onDismissError,
}) {
  const [screen, setScreen] = useState(() =>
    worldTab(location.search, location.hash),
  );
  const [category, setCategory] = useState(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    return ["prep", "staff", "finance", "packing", "guide"].includes(tab)
      ? tab
      : "prep";
  });
  const [controlled, setControlled] = useState("customer"),
    [completed, setCompleted] = useState(null),
    [now, setNow] = useState(Date.now());
  const statuses = useRef(null),
    content = useRef(null);
  const opRole = view === "split" ? "owner" : view;
  const alerts = (operations?.inventory || []).filter((i) => i.alert).length;
  const categories = CATEGORIES[opRole] || [["guide", "Demo guide"]];
  const visibleCategory = categories.some(([id]) => id === category)
    ? category
    : categories[0][0];
  const active = state.orders.filter(
    (o) => !["delivered", "collected", "cancelled"].includes(o.status),
  ).length;
  function navigate(next, sub) {
    if (sub === "scenarios") {
      next = "replay";
      sub = undefined;
    }
    setScreen(next);
    if (sub) setCategory(sub);
    const url = new URL(location.href);
    url.searchParams.set("tab", next === "ops" && sub ? sub : next);
    url.hash = "";
    history.replaceState(null, "", url);
  }
  function perspective(next) {
    navigate("floor");
    onRole(next);
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + live.clockOffset), 250);
    return () => clearInterval(timer);
  }, [live.clockOffset]);
  useEffect(() => {
    if (statuses.current) {
      const order = state.orders.find(
        (o) =>
          ["delivered", "collected"].includes(o.status) &&
          statuses.current[o.id] &&
          !["delivered", "collected"].includes(statuses.current[o.id]),
      );
      if (order) setCompleted(order);
    }
    statuses.current = Object.fromEntries(
      state.orders.map((o) => [o.id, o.status]),
    );
  }, [state.orders]);
  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => setCompleted(null), 10000);
    return () => clearTimeout(timer);
  }, [completed]);
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [screen, view]);
  function followLink(event) {
    const hash = event.target.closest?.('a[href^="#"]')?.getAttribute("href");
    const target =
      hash === "#delivery-simulator"
        ? "delivery"
        : hash === "#ai-operations"
          ? "inventory"
          : hash === "#restaurant-floor"
            ? "floor"
            : hash?.startsWith("#view-guide-")
              ? "ops"
              : null;
    if (target) {
      event.preventDefault();
      navigate(target, target === "ops" ? "guide" : undefined);
    }
  }
  const replay =
    state.playback &&
    state.scenarios.find((s) => s.id === state.playback.scenarioId);
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="nova-professional"
        onClick={followLink}
        data-screen={screen}
      >
        <a className="skip-content" href="#experience-main">
          Skip to content
        </a>
        <header className="platform-header">
          <a className="platform-brand" href="/?view=customer">
            <span className="nova-mark">
              n<span>·</span>
            </span>
            <div>
              <b>nova</b>
              <small>Restaurant intelligence</small>
            </div>
          </a>
          <nav className="perspective-nav" aria-label="Restaurant perspectives">
            {ROLES.map(([id, label]) => (
              <button
                key={id}
                aria-current={view === id ? "page" : undefined}
                onClick={() => perspective(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="platform-connection">
            <span className={connected ? "is-connected" : "is-disconnected"}>
              <i />
              {connected ? "Live & synced" : "Disconnected"}
            </span>
            <small>Demo environment</small>
          </div>
        </header>
        <div className="platform-subnav">
          <nav aria-label="Workspace sections">
            {WORLD_TABS.map(([id, label]) => (
              <button
                key={id}
                id={"section-" + id}
                aria-current={screen === id ? "page" : undefined}
                aria-controls={"world-" + id}
                onClick={() => navigate(id)}
              >
                {label}
                {id === "inventory" && alerts > 0 && <span>{alerts}</span>}
              </button>
            ))}
          </nav>
          <div>
            <span>
              {active} active {active === 1 ? "order" : "orders"}
            </span>
            <button onClick={() => navigate("ops", "guide")}>
              Demo guide <span>↗</span>
            </button>
          </div>
        </div>
        <main
          id="experience-main"
          ref={content}
          tabIndex={-1}
          className="platform-main"
        >
          <section
            id="world-floor"
            hidden={screen !== "floor"}
            aria-labelledby="section-floor"
            className="platform-screen"
          >
            {view === "split" ? (
              <>
                <div className="linked-perspectives">
                  <span className="eyebrow">
                    LINKED PERSPECTIVES / ONE SHARED ORDER FLOW
                  </span>
                  <div>
                    {["customer", "owner"].map((id) => (
                      <button
                        key={id}
                        aria-pressed={controlled === id}
                        onClick={() => setControlled(id)}
                      >
                        Control {id}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="professional-split">
                  {["customer", "owner"].map((id) => (
                    <Game
                      key={id}
                      hud
                      role={id}
                      {...{ state, config, act, busy, live }}
                      keyboardActive={screen === "floor" && controlled === id}
                      onActivate={() => setControlled(id)}
                      onNavigate={navigate}
                      onPerspective={perspective}
                    />
                  ))}
                </div>
              </>
            ) : (
              <Game
                key={view}
                hud
                role={view}
                {...{ state, config, act, busy, live }}
                keyboardActive={screen === "floor"}
                onNavigate={navigate}
                onPerspective={perspective}
              />
            )}
          </section>
          <section
            id="world-delivery"
            hidden={screen !== "delivery"}
            className="platform-screen"
            aria-labelledby="section-delivery"
          >
            <PageHeading
              eyebrow="THE LAST MILE"
              title="Delivery visibility"
              detail="Follow the verified order from the restaurant to the customer’s door."
            />
            <Suspense fallback={<p>Loading delivery tracking…</p>}>
              {screen === "delivery" && (
                <DeliveryBoard
                  {...{ state, act, busy }}
                  clockOffset={live.clockOffset}
                  readOnly={view === "display"}
                  preferredOrderId={
                    view === "customer"
                      ? localStorage.getItem("nova-game-order") || ""
                      : ""
                  }
                />
              )}
            </Suspense>
          </section>
          <section
            id="world-inventory"
            hidden={screen !== "inventory"}
            className="platform-screen"
            aria-labelledby="section-inventory"
          >
            <PageHeading
              eyebrow="INGREDIENTS & REPLENISHMENT"
              title="Inventory"
              detail="See availability, anticipate shortages and record the stock that actually arrives."
            />
            <InventoryGrid inventory={operations?.inventory || []} />
            <OperationsCenter
              {...{ state, config, operations, act, busy }}
              role={view === "customer" ? "display" : opRole}
              category="inventory"
            />
            {view === "owner" && (
              <details className="advanced-tools">
                <summary>Stock corrections & demo reset</summary>
                {stockCorrection}
              </details>
            )}
          </section>
          <section
            id="world-replay"
            hidden={screen !== "replay"}
            className="platform-screen"
            aria-labelledby="section-replay"
          >
            <PageHeading
              eyebrow="PREPARE FOR THE UNEXPECTED"
              title="Scenario planning"
              detail="Compare a disruption with a recovery plan, then replay the exact same conditions."
            />
            {view === "owner" || view === "split" ? (
              <details
                className="scenario-builder"
                open={!state.scenarios.length}
              >
                <summary>
                  Compare a disruption{" "}
                  <span>Worker absence, shortages, outages or a rush</span>
                </summary>
                {scenarios}
              </details>
            ) : null}
            <Suspense fallback={<p>Loading scenario replay…</p>}>
              {screen === "replay" && (
                <ReplayStudio
                  {...{ state, act, busy }}
                  clockOffset={live.clockOffset}
                  onNavigate={navigate}
                />
              )}
            </Suspense>
          </section>
          <section
            id="world-ops"
            hidden={screen !== "ops"}
            className="platform-screen"
            aria-labelledby="section-ops"
          >
            <PageHeading
              eyebrow="ASSISTED DECISIONS. SHARED EXECUTION."
              title="Operations"
              detail="Focus on one category at a time, with AI grounded in your restaurant’s current state."
            />
            <AiBrief {...{ state, busy }} />
            <nav
              className="operations-categories"
              aria-label="Operations categories"
            >
              {categories.map(([id, label]) => (
                <button
                  key={id}
                  aria-current={visibleCategory === id ? "page" : undefined}
                  onClick={() => navigate("ops", id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div
              hidden={!["prep", "staff", "finance"].includes(visibleCategory)}
            >
              <OperationsCenter
                {...{ state, config, operations, act, busy }}
                role={opRole}
                category={
                  ["prep", "staff", "finance"].includes(visibleCategory)
                    ? visibleCategory
                    : "prep"
                }
              />
            </div>
            <div hidden={visibleCategory !== "staff"}>{staff}</div>
            <div hidden={visibleCategory !== "packing"}>{packing}</div>
            <div hidden={visibleCategory !== "guide"}>
              <Guide config={config} />
            </div>
          </section>
          <footer className="platform-footer">
            <span>Nova Kitchen Lab</span>
            <span>
              Interactive restaurant demonstration · shared across your devices
            </span>
          </footer>
        </main>
        {replay && (
          <div className="replay-status">
            <span>
              Scenario replay {state.playback.paused ? "paused" : "playing"} ·{" "}
              {Math.floor(playbackMinute(state.playback, now))}:00
            </span>
            <b>{replay.name}</b>
            <button onClick={() => navigate("replay")}>
              Replay controls →
            </button>
          </div>
        )}
        <div className="platform-notices">
          {(!connected || live.presenceError) && (
            <Notice title="Connection needs attention" kind="warning">
              {live.presenceError ||
                "Showing the last synced state. Reconnect before making changes."}
            </Notice>
          )}
          {error && (
            <div className="error-notice" role="alert">
              <p>{error}</p>
              <button onClick={onDismissError}>Dismiss ×</button>
            </div>
          )}
          {busy && <Notice title="Working">{busy}</Notice>}
          {completed && (
            <div className="completion-notice" role="status">
              <span>✓</span>
              <div>
                <b>
                  {completed.delivery
                    ? "Delivery confirmed"
                    : "Pickup confirmed"}
                </b>
                <p>
                  {completed.id} · {completed.customer}. Updated across all
                  perspectives.
                </p>
              </div>
              <button
                aria-label="Dismiss completion notice"
                onClick={() => setCompleted(null)}
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>
    </MotionConfig>
  );
}
function PageHeading({ eyebrow, title, detail }) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}
