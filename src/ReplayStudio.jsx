import React, { useEffect, useState } from "react";
import { playbackMinute } from "../shared/replay.mjs";
import { Panel } from "./UI.jsx";
export default function ReplayStudio({
  state,
  act,
  busy,
  clockOffset,
  onNavigate,
}) {
  const [now, setNow] = useState(Date.now()),
    [chosen, setChosen] = useState(""),
    [scrub, setScrub] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffset), 100);
    return () => clearInterval(id);
  }, [clockOffset]);
  const playback = state.playback,
    scenario =
      state.scenarios.find((s) => s.id === (playback?.scenarioId || chosen)) ||
      state.scenarios[0];
  const run =
    scenario &&
    (playback?.policy === "fixed"
      ? scenario.comparison.baseline
      : scenario.comparison.recovery);
  const minute = playbackMinute(playback, now),
    frame = scrub ?? minute;
  async function start(policy) {
    await act("/playback", { scenarioId: scenario.id, policy });
  }
  async function seek() {
    if (scrub !== null) {
      await act("/playback", { action: "seek", minute: scrub });
      setScrub(null);
    }
  }
  if (!scenario)
    return (
      <Panel className="world-empty">
        <span>↶</span>
        <h2>Every shift is a chance to learn.</h2>
        <p>
          Save a disruption drill in Ops. Compare the fixed plan with recovery,
          then play the same scenario as often as you like.
        </p>
        <button className="primary" onClick={() => onNavigate("replay")}>
          Use Owner to create a scenario
        </button>
      </Panel>
    );
  return (
    <div className="replay-studio">
      <Panel className="replay-transport">
        <div className="replay-title">
          <span className="eyebrow">SIMULATION / READ ONLY</span>
          <h2>{scenario.name}</h2>
          <p>
            Replay a separate 60-minute plan. Live orders and inventory stay
            unchanged.
          </p>
        </div>
        <div className="row wrap">
          <label>
            Saved scenario
            <select
              aria-label="Replay saved scenario"
              value={scenario.id}
              onChange={async (e) => {
                setChosen(e.target.value);
                if (playback)
                  await act("/playback", {
                    scenarioId: e.target.value,
                    policy: playback.policy,
                  });
              }}
            >
              {state.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!!busy}
            aria-pressed={playback?.policy === "fixed"}
            onClick={() => start("fixed")}
          >
            Fixed plan
          </button>
          <button
            disabled={!!busy}
            aria-pressed={playback?.policy === "adaptive"}
            onClick={() => start("adaptive")}
          >
            Recovery plan
          </button>
        </div>
        <div className="replay-scrubber">
          <label htmlFor="replay-minute">
            SIMULATION CLOCK{" "}
            <b>
              {Math.floor(frame).toString().padStart(2, "0")}:
              {Math.floor((frame % 1) * 60)
                .toString()
                .padStart(2, "0")}{" "}
              / 60:00
            </b>
          </label>
          <input
            id="replay-minute"
            aria-label="Replay minute"
            type="range"
            min="0"
            max="60"
            step="0.1"
            value={frame}
            disabled={!!busy || !playback}
            onChange={(e) => setScrub(Number(e.target.value))}
            onPointerUp={seek}
            onKeyUp={(e) => {
              if (
                [
                  "ArrowLeft",
                  "ArrowRight",
                  "Home",
                  "End",
                  "PageUp",
                  "PageDown",
                ].includes(e.key)
              )
                seek();
            }}
            onBlur={seek}
          />
        </div>
        <div className="replay-buttons">
          <button
            className="primary"
            disabled={!!busy}
            onClick={() =>
              playback
                ? act("/playback", {
                    action:
                      playback.paused || minute >= 60 ? "resume" : "pause",
                  })
                : start("adaptive")
            }
          >
            {!playback
              ? "▶ Start recovery replay"
              : playback.paused || minute >= 60
                ? "▶ Play"
                : "Ⅱ Pause"}
          </button>
          <label>
            Speed
            <select
              aria-label="Replay speed"
              disabled={!!busy || !playback}
              value={playback?.speed || 2}
              onChange={(e) =>
                act("/playback", {
                  action: "speed",
                  speed: Number(e.target.value),
                })
              }
            >
              {[0.5, 1, 2, 4].map((n) => (
                <option value={n} key={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => onNavigate("floor")}>Live restaurant ↗</button>
          <button onClick={() => onNavigate("delivery")}>Delivery map ↗</button>
          {playback && (
            <button
              disabled={!!busy}
              onClick={() => act("/playback", { action: "stop" })}
            >
              End replay
            </button>
          )}
        </div>
      </Panel>
      <div className="replay-stage">
        <div className="replay-stage-top">
          <span>
            ACTIVE PLAN /{" "}
            {playback?.policy === "fixed"
              ? "FIXED ASSIGNMENTS"
              : "QUALIFIED RECOVERY"}
          </span>
          <b>
            {
              run.orders.filter((o) => o.status === "done" && o.finish <= frame)
                .length
            }{" "}
            / {run.metrics.total} COMPLETE
          </b>
        </div>
        <div className="replay-timeline">
          {state.stations.map((station, index) => (
            <div className="replay-track" key={station.id}>
              <span>
                <small>0{index + 1}</small>
                <b>{station.name}</b>
              </span>
              <div>
                {run.schedule
                  .filter((t) => t.station === station.id)
                  .map((t, i) => (
                    <div
                      key={i}
                      className={
                        "timeline-task " +
                        (t.start <= frame && t.end > frame ? "is-active" : "")
                      }
                      style={{
                        left: (t.start / 60) * 100 + "%",
                        width: ((t.end - t.start) / 60) * 100 + "%",
                      }}
                      title={`${t.orderId} · ${t.label} · ${t.start}–${t.end} min`}
                    >
                      <span>{t.orderId}</span>
                    </div>
                  ))}
                <i
                  className="timeline-playhead"
                  style={{ left: (frame / 60) * 100 + "%" }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="replay-axis">
          <span>00:00</span>
          <span>15:00</span>
          <span>30:00</span>
          <span>45:00</span>
          <span>60:00</span>
        </div>
      </div>
      <div className="replay-outcomes">
        <Panel>
          <small>PREDICTED COMPLETED</small>
          <strong>
            {run.metrics.completed}
            <i>/{run.metrics.total}</i>
          </strong>
        </Panel>
        <Panel>
          <small>ON TIME / LATE</small>
          <strong>
            {run.metrics.onTime}
            <i> / {run.metrics.late}</i>
          </strong>
        </Panel>
        <Panel>
          <small>UNRESOLVED</small>
          <strong>{run.metrics.blocked}</strong>
        </Panel>
        <Panel>
          <small>MEAN COMPLETION</small>
          <strong>
            {run.metrics.averageTime}
            <i> MIN</i>
          </strong>
        </Panel>
      </div>
      <Panel className="replay-plan">
        <h3>Recovery plan</h3>
        <ul>
          {scenario.comparison.actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
        <p>{scenario.comparison.assumptions}</p>
      </Panel>
    </div>
  );
}
