import {
  SPOTS,
  nearSpot,
  requiredStations,
  orderProblems,
} from "./game-logic.mjs";
export const WORLD_TABS = [
  ["floor", "Experience"],
  ["delivery", "Delivery"],
  ["inventory", "Inventory"],
  ["replay", "Scenarios"],
  ["ops", "Operations"],
];
export function worldTab(query, hash = "") {
  const tab = new URLSearchParams(query).get("tab");
  if (WORLD_TABS.some(([id]) => id === tab)) return tab;
  if (tab === "scenarios") return "replay";
  if (["prep", "staff", "finance", "packing", "guide"].includes(tab))
    return "ops";
  if (hash === "#delivery-simulator") return "delivery";
  if (hash === "#ai-operations") return "inventory";
  return "floor";
}
export function nextObjective(role, order, state, config, position) {
  if (role === "owner")
    return {
      label: "Check the service plan",
      detail: "AI recommendations, team availability and resources",
      screen: "ops",
      tag: "OPERATIONS",
    };
  if (role === "display")
    return {
      label: "Follow restaurant activity",
      detail: "Read-only display · shared across devices",
      disabled: true,
      tag: "SPECTATOR",
    };
  if (role === "customer") {
    if (
      !order ||
      ["delivered", "cancelled", "collected"].includes(order.status)
    )
      return {
        label: order ? "Your next order" : "Choose your meal",
        detail: "Open the menu · walk freely with WASD",
        tag: "ORDER UP",
        open: true,
      };
    if (order.delivery)
      return {
        label: "Track your order",
        detail: "Follow kitchen → courier → your door",
        screen: "delivery",
        tag: "YOUR DELIVERY",
      };
    return {
      label:
        order.status === "ready" ? "Collect your meal" : "View your ticket",
      detail:
        order.status === "ready"
          ? "Show your matching pickup reference"
          : "Kitchen progress updates in real time",
      open: true,
      tag: "YOUR ORDER",
    };
  }
  if (!order)
    return {
      label: "Waiting for the first ticket",
      detail: "Open Customer on the other Mac to place an order",
      disabled: true,
      tag: "STANDBY",
    };
  if (orderProblems(order, state, config).length)
    return {
      label: "Resolve blocked ticket",
      detail: orderProblems(order, state, config)[0],
      screen: "ops",
      tag: "NEEDS ATTENTION",
    };
  if (
    order.delivery &&
    ["ready", "out_for_delivery", "delivered"].includes(order.status)
  )
    return {
      label:
        order.status === "ready"
          ? "Dispatch the courier"
          : "Follow the delivery",
      detail: "Reference check & live delivery progress",
      screen: "delivery",
      tag: "HANDOFF",
    };
  const target =
    order.status === "queued"
      ? "tickets"
      : order.status === "preparing"
        ? requiredStations(order, config.catalog).find(
            (id) => !order.gameStations?.includes(id),
          ) || "packing"
        : order.status === "packing"
          ? "packing"
          : null;
  if (target && !nearSpot(position, target))
    return {
      label: "Walk to " + SPOTS[target].name,
      detail: "Follow the suggested route or use WASD to move",
      target,
      tag: "NEXT OBJECTIVE",
    };
  return {
    label:
      order.status === "queued"
        ? "Accept the ticket"
        : order.status === "preparing"
          ? "Prepare at " + SPOTS[target].name
          : order.status === "packing"
            ? "Pack & verify the bag"
            : "View handoff details",
    detail:
      order.status === "packing"
        ? "Build the bag or verify a real photo with AI"
        : "Live shared progress · demonstration actions",
    target,
    open: true,
    tag: order.id,
  };
}
