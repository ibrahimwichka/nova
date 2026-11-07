import { useEffect, useRef, useState } from 'react';
export function usePlayerPresence(role, live, orderId) {
  const [id] = useState(() => crypto.randomUUID());
  const sequence = useRef(Date.now() * 1000);
  const context = useRef({ live, orderId });
  context.current = { live, orderId };
  const pending = useRef(null), running = useRef(false), latest = useRef(null), alive = useRef(true);
  const packing = useRef(null);
  async function flush() {
    if (running.current || !pending.current || !alive.current) return;
    const input = pending.current; pending.current = null; running.current = true;
    try {
      const response = await fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) context.current.live?.onPresenceError?.('Movement sync unavailable. Reconnect before the demo.');
      else context.current.live?.onPresenceError?.('');
    } catch { context.current.live?.onPresenceError?.('Movement sync disconnected.'); }
    finally { running.current = false; if (pending.current) flush(); }
  }
  function publish(path, startedAt = Date.now() + (context.current.live?.clockOffset || 0)) {
    if (!['customer', 'kitchen', 'owner'].includes(role)) return;
    latest.current = { path, startedAt };
    pending.current = { id, role, path, startedAt, sequence: ++sequence.current, orderId: context.current.orderId || '', packing: packing.current };
    flush();
  }
  useEffect(() => {
    alive.current = true;
    if (!['customer','kitchen','owner'].includes(role)) return;
    const timer = setInterval(() => { if (latest.current) publish(latest.current.path, latest.current.startedAt); }, 5000);
    return () => {
      alive.current = false; clearInterval(timer);
      fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, leave: true }), keepalive: true }).catch(() => {});
    };
  }, []);
  function publishBag(bag) { packing.current = bag; if (latest.current) publish(latest.current.path,latest.current.startedAt); }
  return { id, publish, publishBag };
}
