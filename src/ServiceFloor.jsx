import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { nearSpot, SPOTS } from "./game-logic.mjs";
import { nextObjective } from "./experience-logic.mjs";
import { OrderCard, Panel } from "./UI.jsx";
const FirstPersonRestaurant = lazy(() => import("./FirstPersonRestaurant.jsx"));
const LABELS = {
  customer: [
    "Customer experience",
    "From the front door to the final handoff.",
  ],
  kitchen: ["Kitchen workspace", "Prepare, verify and hand off every ticket."],
  owner: [
    "Restaurant overview",
    "A shared view of service, people and bottlenecks.",
  ],
  display: [
    "Live restaurant",
    "Follow the same orders across every perspective.",
  ],
};
export default function ServiceFloor({
  children,
  mission,
  role,
  state,
  config,
  live,
  position,
  walking,
  step,
  order,
  onSelect,
  move,
  interact,
  onNavigate,
  onPerspective,
  busy,
  active = true,
}) {
  const [perspective, setPerspective] = useState("first"),
    [arrived, setArrived] = useState(!!order),
    [open, setOpen] = useState(!!order);
  const objective = nextObjective(role, order, state, config, position),
    controls = useRef(null);
  controls.current = { objective, move, interact, onNavigate, order };
  useEffect(() => {
    if (
      role === "customer" &&
      !arrived &&
      !walking &&
      nearSpot(position, "counter")
    ) {
      setArrived(true);
      setOpen(true);
      interact();
    }
  }, [role, position, walking, arrived]);
  function customerAction() {
    if (!arrived && !order) {
      move(SPOTS.counter);
      return;
    }
    setOpen(true);
    interact();
  }
  function next() {
    if (role === "customer") {
      customerAction();
      return;
    }
    if (objective.screen) {
      onNavigate(objective.screen);
      return;
    }
    if (objective.target && !objective.open) move(SPOTS[objective.target]);
    else interact();
  }
  useEffect(() => {
    if (!active) return;
    function key(e) {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key.toLowerCase() !== "e" ||
        e.target.closest?.('input,textarea,select,[contenteditable="true"]')
      )
        return;
      e.preventDefault();
      if (role === "customer") customerAction();
      else next();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [active, role, arrived, order?.id, objective.label]);
  const tickets = [...state.orders]
    .reverse()
    .filter((o) => o.status !== "cancelled");
  const activeOrders = tickets.filter(
    (o) => !["delivered", "collected"].includes(o.status),
  );
  const [title, subtitle] = LABELS[role] || LABELS.owner;
  return (
    <div className={"service-experience role-" + role}>
      <div className="experience-heading">
        <div>
          <span className="eyebrow">
            {role === "customer"
              ? "THE CUSTOMER JOURNEY"
              : "CONNECTED OPERATIONS"}
          </span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {role === "customer" ? (
          <div
            className="perspective-toggle"
            aria-label="Customer camera perspective"
          >
            <button
              aria-pressed={perspective === "first"}
              onClick={() => setPerspective("first")}
            >
              First person
            </button>
            <button
              aria-pressed={perspective === "floor"}
              onClick={() => setPerspective("floor")}
            >
              Floor plan
            </button>
          </div>
        ) : (
          <span className="subtle-live">
            <i /> Shared live floor
          </span>
        )}
      </div>
      {role === "customer" && (
        <ol className="journey-steps" aria-label="Customer journey steps">
          {[
            "Enter restaurant",
            "Choose your meal",
            "Kitchen & verification",
            "Pickup or delivery",
          ].map((label, i) => {
            const current =
              !arrived && !order
                ? 0
                : !order
                  ? 1
                  : ["queued", "preparing", "packing"].includes(order.status)
                    ? 2
                    : 3;
            return (
              <li
                key={label}
                className={
                  i < current ? "complete" : i === current ? "current" : ""
                }
                aria-current={i === current ? "step" : undefined}
              >
                <span>{i < current ? "✓" : i + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>
      )}
      <div className="service-floor-layout">
        <div className="service-visual-column">
          <div
            className={
              "service-scene " + (role === "customer" ? "customer-scene" : "")
            }
          >
            {role === "customer" && perspective === "first" ? (
              <Suspense
                fallback={
                  <div className="scene-loading">
                    Opening customer perspective…
                  </div>
                }
              >
                <FirstPersonRestaurant
                  {...{ position, walking, step, state, live }}
                  active={active}
                  onFallback={() => setPerspective("floor")}
                />
              </Suspense>
            ) : (
              children
            )}
            {role !== "customer" && (
              <div className="floor-caption">
                <span>
                  <i className="subtle-dot" />{" "}
                  {live.presenceError ||
                    `${live.players.length} connected perspectives`}
                </span>
                <span>WASD to move · click a station to walk</span>
              </div>
            )}
          </div>
          <div className="experience-context">
            <div>
              <span className="eyebrow">
                {role === "customer" ? "YOUR NEXT STEP" : "CURRENT PRIORITY"}
              </span>
              <b>
                {role === "customer"
                  ? !arrived && !order
                    ? "Walk up to the order counter"
                    : order
                      ? "Your order is connected to the kitchen"
                      : "Choose a meal at the counter"
                  : objective.label}
              </b>
              <p>
                {role === "customer"
                  ? !arrived && !order
                    ? "Follow the customer from the entrance. You can also explore with WASD."
                    : order
                      ? `${order.id} · updates are shared with kitchen and owner.`
                      : "The menu uses the ingredients currently available in storage."
                  : objective.detail}
              </p>
            </div>
            {role === "customer" && !open ? (
              <button
                className="primary"
                disabled={!!busy || walking}
                onClick={customerAction}
              >
                {walking
                  ? "Walking to counter…"
                  : !arrived && !order
                    ? "Walk to the counter"
                    : "Open menu / order"}{" "}
                <span>→</span>
              </button>
            ) : role === "kitchen" && objective.target && !objective.open ? (
              <button onClick={next}>
                Go to {SPOTS[objective.target].name} →
              </button>
            ) : role === "owner" ? (
              <button onClick={() => onNavigate("ops")}>
                Review operations →
              </button>
            ) : null}
          </div>
          {role === "customer" && (
            <div className="perspective-handoff">
              <span>One order, three perspectives.</span>
              <button onClick={() => onPerspective("kitchen")}>
                View kitchen perspective <span>→</span>
              </button>
              <button onClick={() => onPerspective("owner")}>
                View owner perspective <span>→</span>
              </button>
            </div>
          )}
          {role !== "customer" && (
            <div className="service-tickets">
              <div className="section-heading">
                <h2>
                  Order queue <span>{activeOrders.length}</span>
                </h2>
                <small>Shared across devices</small>
              </div>
              {tickets.length ? (
                <div className="service-ticket-list">
                  {tickets.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      catalog={config.catalog}
                      selected={o.id === order?.id}
                      onClick={() => onSelect(o.id)}
                    />
                  ))}
                </div>
              ) : (
                <Panel className="quiet-empty">
                  <b>Ready for the first order</b>
                  <p>
                    Open the customer perspective on the second Mac and walk to
                    the counter.
                  </p>
                  <button onClick={() => onPerspective("customer")}>
                    Open customer experience →
                  </button>
                </Panel>
              )}
            </div>
          )}
        </div>
        <aside
          className="service-task-column"
          aria-label={
            role === "customer"
              ? "Order menu and tracking"
              : role === "kitchen"
                ? "Preparation and packing controls"
                : "Service summary"
          }
        >
          {role === "customer" ? (
            open ? (
              mission
            ) : (
              <Panel className="arrival-card">
                <span className="eyebrow">WELCOME TO NOVA</span>
                <h2>A better experience starts at the counter.</h2>
                <p>
                  Step into the customer's shoes. Walk up, choose a meal and
                  watch the restaurant respond to the same order in real time.
                </p>
                <div className="arrival-detail">
                  <span>01</span>
                  <div>
                    <b>Experience it</b>
                    <p>First-person arrival and ordering</p>
                  </div>
                </div>
                <div className="arrival-detail">
                  <span>02</span>
                  <div>
                    <b>See it happen</b>
                    <p>Live cooking and packing verification</p>
                  </div>
                </div>
                <div className="arrival-detail">
                  <span>03</span>
                  <div>
                    <b>Close the loop</b>
                    <p>Matched pickup or tracked delivery</p>
                  </div>
                </div>
                <small>
                  Interactive demonstration. No real order or payment.
                </small>
              </Panel>
            )
          ) : role === "kitchen" ? (
            mission
          ) : (
            <Panel className="service-summary">
              <span className="eyebrow">SERVICE AT A GLANCE</span>
              <h2>Every order, connected.</h2>
              <div className="summary-stats">
                <div>
                  <b>{activeOrders.length}</b>
                  <small>Active orders</small>
                </div>
                <div>
                  <b>{tickets.length - activeOrders.length}</b>
                  <small>Completed</small>
                </div>
                <div>
                  <b>
                    {state.staff.filter((w) => w.available).length}/
                    {state.staff.length}
                  </b>
                  <small>Staff available</small>
                </div>
                <div>
                  <b>
                    {
                      state.orders.filter(
                        (o) =>
                          o.verification?.status === "red" &&
                          o.status === "packing",
                      ).length
                    }
                  </b>
                  <small>Packing flags</small>
                </div>
              </div>
              <h3>Recent activity</h3>
              <div className="service-activity">
                {state.events.slice(0, 5).map((e) => (
                  <p key={e.id}>{e.message}</p>
                ))}
              </div>
              <p className="helper-text">
                Use Operations for AI advice and resources. Compare disruptions
                in Scenarios before applying a recovery plan.
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}
