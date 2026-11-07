export const APPROACH_ROUTE = [
  { x: 70, y: 480 },
  { x: 180, y: 480 },
  { x: 180, y: 365 },
];
export function deliveryRoute(home = "maple") {
  const end =
    home === "park"
      ? [
          { x: 720, y: 220 },
          { x: 720, y: 480 },
          { x: 925, y: 480 },
        ]
      : home === "river"
        ? [
            { x: 600, y: 220 },
            { x: 600, y: 100 },
            { x: 925, y: 100 },
          ]
        : [
            { x: 720, y: 220 },
            { x: 720, y: 130 },
            { x: 925, y: 130 },
          ];
  return [{ x: 180, y: 365 }, { x: 370, y: 365 }, { x: 370, y: 220 }, ...end];
}
// Distance-weighted interpolation keeps the scooter moving forward through every turn.
export function routePose(points, fraction) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = Math.max(0, Math.min(1, fraction)) * total;
  const traveled = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const a = points[i],
        b = points[i + 1],
        t = lengths[i] ? remaining / lengths[i] : 0;
      const pose = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        heading: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
      return { ...pose, traveled: [...traveled, { x: pose.x, y: pose.y }] };
    }
    remaining -= lengths[i];
    traveled.push(points[i + 1]);
  }
  return { ...points[0], heading: 0, traveled };
}
export const routePoints = (points) =>
  points.map((p) => `${p.x},${p.y}`).join(" ");
