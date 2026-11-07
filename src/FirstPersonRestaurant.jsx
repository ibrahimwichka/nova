import React, { useEffect, useRef, useState } from "react";
import { presencePosition } from "../shared/presence.mjs";
import { movementFromCamera } from "./perspective.mjs";
import { nearSpot } from "./game-logic.mjs";

// A small, code-built restaurant. Camera position uses the same walkable grid as
// the shared floor; changing perspective never creates a second customer.
export default function FirstPersonRestaurant({
  position,
  walking,
  step,
  active = true,
  state,
  live,
  onFallback,
}) {
  const host = useRef(null),
    current = useRef({ position, walking, step, state, live }),
    [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  current.current = { position, walking, step, state, live };
  useEffect(() => {
    if (!active) return;
    setFailed(false);
    let stopped = false,
      cleanup = () => {};
    import("three")
      .then((THREE) => {
        if (stopped) return;
        const container = host.current;
        let renderer;
        try {
          renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "low-power",
            preserveDrawingBuffer: true,
          });
        } catch {
          setFailed(true);
          return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor("#dfe6df");
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.domElement.setAttribute(
          "aria-label",
          "First-person restaurant view. WASD to walk, drag to look, R to face the counter.",
        );
        renderer.domElement.setAttribute("role", "img");
        container.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#dfe6df");
        scene.fog = new THREE.Fog("#e1e6db", 21, 50);
        const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 70);
        const start = current.current.position;
        camera.position.set(start.x + 0.5, 1.65, start.y + 0.5);
        let yaw = Math.atan2(6 - start.x, start.y - 7),
          pitch = 0,
          manualLook = false,
          last = performance.now(),
          raf;
        scene.add(new THREE.HemisphereLight("#fff5df", "#93aaa0", 2.1));
        const sun = new THREE.DirectionalLight("#fff0d2", 2.3);
        sun.position.set(-8, 14, 15);
        scene.add(sun);
        const mats = new Map();
        const material = (color) => {
          if (!mats.has(color))
            mats.set(
              color,
              new THREE.MeshStandardMaterial({
                color,
                roughness: 0.75,
                metalness: color === "#a7b3af" ? 0.35 : 0,
              }),
            );
          return mats.get(color);
        };
        function box(x, y, z, w, h, d, color) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, d),
            material(color),
          );
          mesh.position.set(x, y, z);
          scene.add(mesh);
          return mesh;
        }
        function cylinder(x, y, z, r, h, color) {
          const mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(r, r, h, 20),
            material(color),
          );
          mesh.position.set(x, y, z);
          scene.add(mesh);
          return mesh;
        }
        function sign(
          text,
          x,
          y,
          z,
          w,
          h,
          { color = "#f9f5e8", ink = "#193c34", size = 70 } = {},
        ) {
          const canvas = document.createElement("canvas");
          canvas.width = 1024;
          canvas.height = Math.round((1024 * h) / w);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = ink;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `600 ${size}px Arial`;
          text
            .split("\n")
            .forEach((line, i, lines) =>
              ctx.fillText(
                line,
                512,
                canvas.height / 2 +
                  (i - (lines.length - 1) / 2) * (size * 1.65),
              ),
            );
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ map: texture }),
          );
          plane.position.set(x, y, z);
          scene.add(plane);
          return plane;
        }
        // Warm stone, oak joinery and a green service wall give the walkthrough an architectural feel.
        box(12, -0.11, 7.5, 24, 0.2, 15, "#dfd9cb");
        box(12, 0.01, 3.7, 24, 0.02, 7.4, "#c6cfca");
        for (let x = 0; x <= 24; x++)
          box(x, 0.005, 11, 0.012, 0.01, 7.2, "#c9c4b7");
        for (let z = 8; z <= 15; z++)
          box(12, 0.006, z, 24, 0.01, 0.012, "#c9c4b7");
        box(12, 2.4, 0.05, 24, 4.8, 0.15, "#244c40");
        box(0.04, 2.4, 7.5, 0.12, 4.8, 15, "#d4dbcd");
        box(23.96, 2.4, 7.5, 0.12, 4.8, 15, "#d4dbcd");
        box(12, 4.85, 7.5, 24, 0.15, 15, "#ece8db");
        // Counter positions match the floor divider and its central passage.
        box(6.4, 0.62, 7.4, 10.4, 1.24, 1.25, "#ad8970");
        box(6.4, 1.3, 7.4, 10.7, 0.16, 1.5, "#efe8d9");
        box(19.4, 0.62, 7.4, 6.7, 1.24, 1.25, "#ad8970");
        box(19.4, 1.3, 7.4, 7, 0.16, 1.5, "#efe8d9");
        for (let x = 1.35; x < 11.55; x += 0.22)
          box(x, 0.62, 8.04, 0.045, 1.15, 0.035, "#96775d");
        for (let x = 16.2; x < 22.7; x += 0.22)
          box(x, 0.62, 8.04, 0.045, 1.15, 0.035, "#96775d");
        sign("ORDER HERE", 6.4, 0.72, 8.07, 3, 0.43, {
          color: "#ad8970",
          ink: "#fff8e8",
          size: 90,
        });
        sign("PICKUP", 19.4, 0.72, 8.07, 2.4, 0.43, {
          color: "#ad8970",
          ink: "#fff8e8",
          size: 90,
        });
        // Register and a small printed menu, rather than floating game UI in the room.
        box(6.4, 1.42, 7.75, 0.55, 0.12, 0.45, "#264139");
        const terminal = box(6.4, 1.74, 7.55, 0.9, 0.52, 0.08, "#223b35");
        terminal.rotation.x = -0.12;
        sign("NOVA\nWELCOME", 6.4, 1.76, 7.61, 0.77, 0.39, {
          color: "#c4d8c8",
          ink: "#234b3c",
          size: 100,
        });
        sign("NOVA", 6.4, 4.25, 5.8, 3.3, 0.57, {
          color: "#244c40",
          ink: "#f0ead6",
          size: 145,
        });
        sign("FRESH FOOD. ONE CONNECTED KITCHEN.", 6.4, 3.91, 5.81, 5.4, 0.18, {
          color: "#244c40",
          ink: "#d8d8bf",
          size: 47,
        });
        for (const [x, title, items] of [
          [4.5, "THE MENU", "BURGER  /  8.50\nCHICKEN WRAP  /  8.00"],
          [9.2, "SIDES & DRINKS", "FRIES  /  3.00\nSPRITE  /  2.00"],
        ]) {
          box(x, 2.46, 5.9, 4, 0.08, 0.1, "#244c40");
          sign(title + "\n" + items, x, 3.15, 5.9, 3.8, 1.2, {
            color: "#f6f1e5",
            ink: "#244c40",
            size: 58,
          });
        }
        // Visible open kitchen and equipment.
        for (const [x, color] of [
          [4.5, "#4b5b56"],
          [10.5, "#bdac7e"],
          [16.5, "#769b87"],
        ]) {
          box(x, 0.65, 2.2, 3, 1.3, 1.2, "#a7b3af");
          box(x, 1.35, 2.2, 3.1, 0.13, 1.35, color);
          box(x, 3.3, 1.4, 3.4, 0.3, 1.7, "#a7b3af");
        }
        box(21.5, 0.7, 5.3, 2.1, 1.4, 1.2, "#a7b3af");
        function person(x, z, color) {
          const group = new THREE.Group();
          const torso = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.28, 0.65, 12),
            material(color),
          );
          torso.position.y = 1.12;
          group.add(torso);
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.17, 14, 12),
            material("#c99474"),
          );
          head.position.y = 1.65;
          group.add(head);
          const hat = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.18, 0.18, 12),
            material("#f9f8f1"),
          );
          hat.position.y = 1.86;
          group.add(hat);
          for (const offset of [-0.13, 0.13]) {
            const leg = new THREE.Mesh(
              new THREE.CylinderGeometry(0.075, 0.08, 0.65, 8),
              material("#34423b"),
            );
            leg.position.set(offset, 0.47, 0);
            group.add(leg);
          }
          group.position.set(x, 0, z);
          scene.add(group);
          return group;
        }
        const remoteActors = new Map();
        person(6.4, 6.45, "#e6e6d8");
        person(17, 3.8, "#cbdccf");
        // Dining furniture uses the same blocked tiles as shared pathfinding.
        for (const x of [10, 15]) {
          box(x + 0.5, 0.75, 11.05, 1.7, 0.12, 1.8, "#b79774");
          cylinder(x + 0.5, 0.36, 11.05, 0.11, 0.72, "#536052");
          for (const side of [-1, 1]) {
            box(x + 0.5 + side * 1.2, 0.47, 11.05, 0.55, 0.12, 0.6, "#506e5b");
            box(x + 0.5 + side * 1.35, 0.86, 11.05, 0.1, 0.75, 0.6, "#506e5b");
          }
          cylinder(x + 0.5, 0.9, 11.05, 0.12, 0.2, "#e9e1cc");
        }
        // Side windows, quiet greenery and pendant lighting.
        for (const z of [9.8, 12.4]) {
          box(0.12, 2.5, z, 0.08, 2.9, 2.1, "#c2d9d8");
          box(0.2, 2.5, z, 0.08, 0.06, 2.1, "#758e7c");
          box(0.2, 2.5, z, 0.08, 2.9, 0.06, "#758e7c");
        }
        for (const [x, z] of [
          [0.8, 8.7],
          [23.2, 12.8],
        ]) {
          cylinder(x, 0.35, z, 0.28, 0.7, "#c5b59d");
          for (let i = 0; i < 5; i++) {
            const leaf = new THREE.Mesh(
              new THREE.SphereGeometry(0.35, 12, 8),
              material(i % 2 ? "#4b7454" : "#76916a"),
            );
            leaf.scale.set(0.5, 1.7, 0.5);
            leaf.position.set(
              x + Math.sin(i * 1.5) * 0.25,
              1.1 + i * 0.12,
              z + Math.cos(i) * 0.2,
            );
            leaf.rotation.z = Math.sin(i) * 0.4;
            scene.add(leaf);
          }
        }
        for (const x of [4, 8, 13, 18]) {
          cylinder(x, 4.25, 9.5, 0.015, 1.2, "#485c4c");
          const shade = new THREE.Mesh(
            new THREE.ConeGeometry(0.4, 0.4, 20, 1, true),
            material("#d7c4a5"),
          );
          shade.rotation.x = Math.PI;
          shade.position.set(x, 3.55, 9.5);
          scene.add(shade);
          cylinder(x, 3.5, 9.5, 0.29, 0.035, "#fff1d4");
        }
        // A physical bag appears at the pass when an order is ready.
        const bag = box(19.3, 1.57, 7.4, 0.42, 0.5, 0.25, "#b79062");
        bag.visible = false;
        function resize() {
          const { width, height } = container.getBoundingClientRect();
          if (width && height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
        }
        const observer = new ResizeObserver(resize);
        observer.observe(container);
        resize();
        camera.lookAt(6.4, 1.65, 7.4);
        renderer.render(scene, camera);
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        function render(at) {
          if (stopped) return;
          const dt = Math.min(0.05, (at - last) / 1000);
          last = at;
          const p = current.current.position;
          const factor = reduced ? 1 : 1 - Math.exp(-10 * dt);
          camera.position.x += (p.x + 0.5 - camera.position.x) * factor;
          camera.position.z += (p.y + 0.5 - camera.position.z) * factor;
          camera.position.y =
            1.65 +
            (current.current.walking && !reduced
              ? Math.sin(at * 0.011) * 0.012
              : 0);
          if (!manualLook) {
            const desired = Math.atan2(
              6.4 - camera.position.x,
              camera.position.z - 7.4,
            );
            yaw +=
              Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw)) *
              factor;
          }
          camera.lookAt(
            camera.position.x + Math.sin(yaw) * 5,
            1.65 + Math.sin(pitch) * 3,
            camera.position.z - Math.cos(yaw) * 5,
          );
          bag.visible = current.current.state.orders.some(
            (o) => o.status === "ready",
          );
          const players = (current.current.live.players || []).filter((p) =>
            ["owner", "kitchen"].includes(p.role),
          );
          for (const p of players) {
            let actor = remoteActors.get(p.id);
            if (!actor) {
              actor = person(0, 0, p.role === "owner" ? "#8b9c8b" : "#d8e4d6");
              remoteActors.set(p.id, actor);
            }
            const point = presencePosition(
              p,
              Date.now() + (current.current.live.clockOffset || 0),
            );
            actor.position.set(point.x + 0.5, 0, point.y + 0.5);
          }
          for (const [id, actor] of remoteActors) {
            if (!players.some((p) => p.id === id)) {
              scene.remove(actor);
              actor.traverse((o) => o.geometry?.dispose());
              remoteActors.delete(id);
            }
          }
          renderer.render(scene, camera);
          raf = requestAnimationFrame(render);
        }
        let drag = null;
        const canvas = renderer.domElement;
        function down(e) {
          drag = { x: e.clientX, y: e.clientY };
          canvas.setPointerCapture(e.pointerId);
        }
        function move(e) {
          if (!drag) return;
          manualLook = true;
          yaw -= (e.clientX - drag.x) * 0.004;
          pitch = Math.max(
            -0.3,
            Math.min(0.3, pitch - (e.clientY - drag.y) * 0.003),
          );
          drag = { x: e.clientX, y: e.clientY };
        }
        function up() {
          drag = null;
        }
        function key(e) {
          if (
            e.defaultPrevented ||
            e.ctrlKey ||
            e.metaKey ||
            e.altKey ||
            e.target.closest?.('input,textarea,select,[contenteditable="true"]')
          )
            return;
          const k = e.key.toLowerCase();
          if (k === "r") {
            manualLook = false;
            pitch = 0;
            return;
          }
          if (
            ![
              "w",
              "a",
              "s",
              "d",
              "arrowup",
              "arrowdown",
              "arrowleft",
              "arrowright",
            ].includes(k)
          )
            return;
          e.preventDefault();
          if (k === "arrowleft" || k === "arrowright") {
            manualLook = true;
            yaw += k === "arrowleft" ? 0.16 : -0.16;
            return;
          }
          const direction = movementFromCamera(k, yaw);
          if (direction) current.current.step(...direction);
        }
        function lost(e) {
          e.preventDefault();
          setFailed(true);
        }
        canvas.addEventListener("webglcontextlost", lost);
        canvas.addEventListener("pointerdown", down);
        canvas.addEventListener("pointermove", move);
        canvas.addEventListener("pointerup", up);
        canvas.addEventListener("pointercancel", up);
        window.addEventListener("keydown", key);
        raf = requestAnimationFrame(render);
        setReady(true);
        cleanup = () => {
          cancelAnimationFrame(raf);
          observer.disconnect();
          window.removeEventListener("keydown", key);
          canvas.removeEventListener("webglcontextlost", lost);
          canvas.removeEventListener("pointerdown", down);
          canvas.removeEventListener("pointermove", move);
          canvas.removeEventListener("pointerup", up);
          canvas.removeEventListener("pointercancel", up);
          scene.traverse((object) => {
            object.geometry?.dispose();
            if (object.material) {
              const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];
              materials.forEach((material) => {
                material.map?.dispose();
                material.dispose();
              });
            }
          });
          renderer.dispose();
          canvas.remove();
        };
      })
      .catch(() => setFailed(true));
    return () => {
      stopped = true;
      cleanup();
      setReady(false);
    };
  }, [active]);
  return (
    <div className="first-person-scene" ref={host}>
      {!ready && !failed && (
        <div className="scene-loading">
          <span className="scene-loader" />
          <b>Opening the restaurant</b>
          <small>Preparing your customer perspective…</small>
        </div>
      )}
      {failed && (
        <div className="scene-loading">
          <b>3D view unavailable on this device</b>
          <p>You can use the shared floor plan to complete the same order.</p>
          <button onClick={onFallback}>Use floor plan</button>
        </div>
      )}
      <div className="scene-location">
        <span className="scene-dot" />
        {nearSpot(position, "counter")
          ? "At the order counter"
          : walking
            ? "Walking to the counter"
            : "Inside Nova Kitchen"}
      </div>
      <div className="scene-instructions">
        <span>
          <kbd>WASD</kbd> Walk
        </span>
        <span>Drag to look around</span>
        <span>
          <kbd>R</kbd> Face counter
        </span>
      </div>
    </div>
  );
}
