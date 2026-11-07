export const HOMES = [
  { id: 'maple', name: 'Maple House', distanceKm: 1.2, travelSeconds: 18, simulatedMinutes: 6, color: '#cc9770' },
  { id: 'park', name: 'Park House', distanceKm: 2.8, travelSeconds: 30, simulatedMinutes: 10, color: '#7da38b' },
  { id: 'river', name: 'River House', distanceKm: 4.5, travelSeconds: 45, simulatedMinutes: 15, color: '#869bb5' },
];
export const COURIER_APPROACH_MS = 6000;
export function deliveryProgress(order, now = Date.now()) {
  const d = order?.delivery;
  if (!d) return null;
  if (order.status === 'delivered') return { stage: 'delivered', progress: 1, seconds: 0, remainingKm: 0 };
  if (order.status === 'out_for_delivery') {
    const progress = Math.max(0, Math.min(1, (now - d.departedAt) / (d.arrivesAt - d.departedAt)));
    return { stage: progress >= 1 ? 'at_home' : 'on_way', progress, seconds: Math.max(0, Math.ceil((d.arrivesAt - now) / 1000)), remainingKm: Math.max(0, d.distanceKm * (1 - progress)) };
  }
  if (order.status === 'ready') {
    const progress = Math.max(0, Math.min(1, (now - d.courierAssignedAt) / COURIER_APPROACH_MS));
    return { stage: progress >= 1 ? 'at_restaurant' : 'to_restaurant', progress, seconds: Math.max(0, Math.ceil((d.courierArrivesAt - now) / 1000)), remainingKm: d.distanceKm };
  }
  return { stage: 'waiting', progress: 0, seconds: d.travelSeconds, remainingKm: d.distanceKm };
}
