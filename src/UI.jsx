import React from "react";
import { motion } from "framer-motion";
export function Panel({ children, className = "", ...props }) {
  return (
    <section className={"surface-panel " + className} {...props}>
      {children}
    </section>
  );
}
export function ProgressBar({ label, value, max = 100, detail }) {
  return (
    <div className="stock-progress">
      <span>
        <b>{label}</b>
        {detail && <small>{detail}</small>}
      </span>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i
          style={{
            transform: `scaleX(${Math.max(0, Math.min(1, value / max))})`,
          }}
        />
      </div>
    </div>
  );
}
export function Notice({ title, children, kind = "" }) {
  return (
    <div className={"service-notice " + kind} role="status">
      <span aria-hidden="true">{kind === "warning" ? "!" : "i"}</span>
      <div>
        <small>{title}</small>
        <b>{children}</b>
      </div>
    </div>
  );
}
export function MapPin({ x, y, label, color = "#367d85" }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r="10" fill={color} opacity=".15" />
      <circle r="4" fill={color} />
      {label && (
        <text y="-15" textAnchor="middle" fill="#fff" fontSize="10">
          {label}
        </text>
      )}
    </g>
  );
}
export function OrderCard({ order, catalog, selected, onClick }) {
  return (
    <motion.button
      className={
        "service-order-card " +
        (selected ? "is-selected " : "") +
        (order.verification?.status === "red" ? "needs-attention" : "")
      }
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span>
        <b>{order.id}</b>
        <small>{order.status.replaceAll("_", " ")}</small>
      </span>
      <strong>{order.customer}</strong>
      <span className="order-card-items">
        {Object.entries(order.items)
          .map(([sku, q]) => `${q} ${catalog[sku]?.name || sku}`)
          .join(" · ")}
      </span>
      {order.verification?.status === "red" && (
        <em>Bag mismatch · review required</em>
      )}
    </motion.button>
  );
}
