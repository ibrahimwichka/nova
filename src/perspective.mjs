// Three.js camera heading is measured clockwise from the shared floor's north.
export function movementFromCamera(key, yaw) {
  const k = key.toLowerCase();
  if (!["w", "a", "s", "d", "arrowup", "arrowdown"].includes(k)) return null;
  const forward =
    k === "w" || k === "arrowup" ? 1 : k === "s" || k === "arrowdown" ? -1 : 0;
  const strafe = k === "d" ? 1 : k === "a" ? -1 : 0;
  const x = Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
  const z = -Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
  return Math.abs(x) > Math.abs(z) ? [Math.sign(x), 0] : [0, Math.sign(z)];
}
