export function playbackMinute(playback, now = Date.now()) {
  if (!playback) return 0;
  const position = Number.isFinite(playback.position) ? playback.position : 0;
  return Math.max(
    0,
    Math.min(
      60,
      position +
        (playback.paused
          ? 0
          : (Math.max(0, now - playback.startedAt) / 1000) * playback.speed),
    ),
  );
}
// Anchor every change at server time so all spectators see the same frame.
export function controlPlayback(playback, input, now = Date.now()) {
  if (!playback) throw new Error("Start a saved replay first.");
  if (!["pause", "resume", "seek", "speed"].includes(input.action))
    throw new Error("Choose a replay control.");
  const next = {
    ...playback,
    position: playbackMinute(playback, now),
    startedAt: now,
  };
  if (input.action === "pause") next.paused = true;
  if (input.action === "resume") {
    next.paused = false;
    if (next.position === 60) next.position = 0;
  }
  if (input.action === "seek") {
    if (
      typeof input.minute !== "number" ||
      !Number.isFinite(input.minute) ||
      input.minute < 0 ||
      input.minute > 60
    )
      throw new Error("Choose a replay minute from 0 to 60.");
    next.position = input.minute;
  }
  if (input.action === "speed") {
    if (![0.5, 1, 2, 4].includes(input.speed))
      throw new Error("Choose a replay speed from 0.5× to 4×.");
    next.speed = input.speed;
  }
  return next;
}
