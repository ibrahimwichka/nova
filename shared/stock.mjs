export function itemNeeds(items, catalog) {
  const needs = {};
  for (const [sku, count] of Object.entries(items)) {
    if (!catalog[sku]) continue;
    for (const [id, units] of Object.entries(catalog[sku].ingredients)) needs[id] = (needs[id] || 0) + count * units;
  }
  return needs;
}
export function availableInventory(state, catalog, excludeOrderId) {
  const stock = { ...state.inventory };
  for (const order of state.orders) {
    if (order.status !== 'queued' || order.id === excludeOrderId) continue;
    for (const [id, count] of Object.entries(itemNeeds(order.items, catalog))) stock[id] = Math.max(0, (stock[id] || 0) - count);
  }
  return stock;
}
export function itemLimit(sku, cart, stock, catalog) {
  const other = itemNeeds(Object.fromEntries(Object.entries(cart).filter(([id]) => id !== sku)), catalog);
  return Math.max(0, Math.min(...Object.entries(catalog[sku].ingredients).map(([id, units]) => Math.floor(((stock[id] || 0) - (other[id] || 0)) / units))));
}
export function stockIssue(items, stock, catalog) {
  for (const [id, count] of Object.entries(itemNeeds(items, catalog))) if (count > (stock[id] || 0)) return { id, required: count, available: stock[id] || 0 };
  return null;
}
