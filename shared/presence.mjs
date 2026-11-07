export const MOVEMENT_STEP_MS = 115;
export function presencePosition(player, now = Date.now()) {
  const path = player.path;
  if (!path?.length) return { x: 3, y: 13, walking: false };
  const progress = Math.max(0, (now - player.startedAt) / MOVEMENT_STEP_MS);
  const index = Math.min(path.length - 1, Math.floor(progress));
  const from = path[index], to = path[Math.min(index + 1, path.length - 1)];
  const fraction = Math.min(1, progress - index);
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction, walking: progress < path.length - 1 };
}
