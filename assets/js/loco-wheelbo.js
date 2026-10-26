// A tiny planar wheeled-legged humanoid that chases the cursor with its hand.
// Base: damped spring toward a stand-off point, leaning into acceleration like a TWIP.
// Leg and arm: analytic two-link IK. Click on the canvas to make it hop.
(function () {
  const canvas = document.getElementById("loco-wheelbo");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const readout = document.getElementById("loco-wheelbo-readout");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const H = 190;
  const SCALE = 0.8; // draw everything at 80%, proportions unchanged
  const WHEEL_R = 11;
  const THIGH = 36;
  const SHIN = 36;
  const TORSO = 34;
  const HEAD_R = 11;
  const UPPER_ARM = 34;
  const FOREARM = 32;
  const REACH = UPPER_ARM + FOREARM;

  let W = 0;
  let groundY = H - 14;

  const bot = { x: 0, v: 0, a: 0, pitch: 0, legH: 50, hopY: 0, hopV: 0, dir: 1 };
  const target = { x: 0, y: 0 };
  let pointerInside = false;
  let demo = null;
  let visible = true;
  let last = performance.now();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.parentElement.clientWidth / SCALE;
    canvas.width = W * SCALE * dpr;
    canvas.height = H * SCALE * dpr;
    canvas.style.width = W * SCALE + "px";
    canvas.style.height = H * SCALE + "px";
    ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);
    groundY = H - 14;
    if (!bot.x) {
      bot.x = W * 0.3;
      target.x = W * 0.6;
      target.y = H * 0.4;
    }
  }

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      faint: s.getPropertyValue("--global-divider-color").trim() || "#ddd",
      accent: s.getPropertyValue("--global-theme-color").trim() || "#0076df",
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Two-link IK: returns the middle joint for a chain from (ax, ay) toward (bx, by).
  function twoLink(ax, ay, bx, by, l1, l2, bend) {
    const dx = bx - ax;
    const dy = by - ay;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const phi = Math.atan2(dy, dx);
    const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
    const t = phi + bend * alpha;
    const jx = ax + l1 * Math.cos(t);
    const jy = ay + l1 * Math.sin(t);
    const ux = dx / Math.hypot(dx, dy || 1e-6);
    const uy = dy / Math.hypot(dx, dy || 1e-6);
    return { jx, jy, ex: ax + ux * d, ey: ay + uy * d };
  }

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    // Only follow the pointer while it's near the robot's strip of the page
    pointerInside = e.clientY > r.top - 60 && e.clientY < r.bottom + 60 && e.clientX > r.left && e.clientX < r.right;
    if (!pointerInside) return;
    target.x = clamp((e.clientX - r.left) / SCALE, 8, W - 8);
    target.y = clamp((e.clientY - r.top) / SCALE, 30, groundY - 6);
  }

  function hop() {
    if (bot.hopY === 0) bot.hopV = -250;
  }

  function step(dt, now) {
    // Wander on a slow Lissajous path while the pointer is away, gliding the target onto it
    // Paper demo (loco-papers.js): a fast back-and-forth run, leaning into every reversal
    if (demo && now < demo.until) {
      const t = (now - demo.start) / 1000;
      target.x = W * (0.5 + 0.42 * Math.sin(t * 2.4));
      target.y = H * 0.45;
    } else if (!pointerInside) {
      const t = now / 1000;
      const k = Math.min(1, dt * 2);
      target.x += (W * (0.5 + 0.38 * Math.sin(t * 0.45)) - target.x) * k;
      target.y += (H * (0.42 + 0.22 * Math.sin(t * 0.9 + 1)) - target.y) * k;
    }

    // Face the target, with a little hysteresis so it doesn't flicker
    if (target.x - bot.x > 12) bot.dir = 1;
    else if (target.x - bot.x < -12) bot.dir = -1;

    const xDes = clamp(target.x - bot.dir * 0.65 * REACH, WHEEL_R + 6, W - WHEEL_R - 6);
    const aCmd = clamp(38 * (xDes - bot.x) - 11 * bot.v, -1400, 1400);
    const vPrev = bot.v;
    bot.v = clamp(bot.v + aCmd * dt, -480, 480);
    bot.x = clamp(bot.x + bot.v * dt, WHEEL_R + 4, W - WHEEL_R - 4);
    // Lean on the acceleration actually achieved, so cruising at top speed stays upright
    bot.a = dt > 0 ? (bot.v - vPrev) / dt : 0;

    // Lean into acceleration, like an inverted pendulum on wheels
    const pitchDes = clamp(bot.a * 0.00035, -0.45, 0.45);
    bot.pitch += (pitchDes - bot.pitch) * Math.min(1, dt * 8);

    // Crouch or stretch so the shoulder sits near the target height
    const wheelY = groundY - WHEEL_R;
    const legDes = clamp(wheelY - (target.y + 20) - TORSO, 26, THIGH + SHIN - 6);
    bot.legH += (legDes - bot.legH) * Math.min(1, dt * 4);

    // Hop
    if (bot.hopV !== 0 || bot.hopY < 0) {
      bot.hopV += 1100 * dt;
      bot.hopY += bot.hopV * dt;
      if (bot.hopY >= 0) {
        bot.hopY = 0;
        bot.hopV = 0;
      }
    }
  }

  function draw(now) {
    const c = colors();
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Ground
    ctx.strokeStyle = c.faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(0, groundY + 0.5);
    ctx.lineTo(W, groundY + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cones for the high-speed run
    if (demo && now < demo.until) {
      ctx.fillStyle = "#f97316";
      for (let i = 1; i < 6; i++) {
        const x = (W * i) / 6;
        ctx.beginPath();
        ctx.moveTo(x - 6, groundY);
        ctx.lineTo(x, groundY - 16);
        ctx.lineTo(x + 6, groundY);
        ctx.closePath();
        ctx.fill();
      }
    }

    const wx = bot.x;
    const wy = groundY - WHEEL_R + bot.hopY;
    const hx = wx + Math.sin(bot.pitch) * bot.legH;
    const hy = wy - Math.cos(bot.pitch) * bot.legH;
    const sx = hx + Math.sin(bot.pitch * 1.4) * TORSO;
    const sy = hy - Math.cos(bot.pitch * 1.4) * TORSO;
    const headX = sx + Math.sin(bot.pitch * 1.4) * (HEAD_R + 6);
    const headY = sy - Math.cos(bot.pitch * 1.4) * (HEAD_R + 6);

    const knee = twoLink(wx, wy, hx, hy, SHIN, THIGH, bot.dir);
    const arm = twoLink(sx, sy, target.x, target.y, UPPER_ARM, FOREARM, bot.dir);
    const reached = Math.hypot(arm.ex - target.x, arm.ey - target.y) < 2;

    // Target
    const pulse = reached ? 3 * Math.sin(now / 120) : 0;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 7 + pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.ink;
    ctx.lineWidth = 2.5;

    // Back arm, hanging
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - bot.dir * 6, sy + 22);
    ctx.lineTo(sx - bot.dir * 2, sy + 40);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Wheel with a spoke so the rolling is visible
    const roll = bot.x / WHEEL_R;
    ctx.beginPath();
    ctx.arc(wx, wy, WHEEL_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(roll) * WHEEL_R, wy + Math.sin(roll) * WHEEL_R);
    ctx.stroke();

    // Leg, torso
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(knee.jx, knee.jy);
    ctx.lineTo(hx, hy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // Head with a visor that looks at the target
    ctx.beginPath();
    ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
    ctx.stroke();
    const gx = target.x - headX;
    const gy = target.y - headY;
    const gn = Math.hypot(gx, gy) || 1;
    ctx.beginPath();
    ctx.arc(headX + (gx / gn) * 4.5, headY + (gy / gn) * 4.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    window.locoHoliday && window.locoHoliday.decorate(ctx, headX, headY, HEAD_R, bot.dir, now);

    // Reaching arm and a two-finger gripper that closes on contact
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(arm.jx, arm.jy);
    ctx.lineTo(arm.ex, arm.ey);
    ctx.stroke();
    const ang = Math.atan2(arm.ey - arm.jy, arm.ex - arm.jx);
    const open = reached ? 0.25 : 0.65;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(arm.ex, arm.ey);
      ctx.lineTo(arm.ex + Math.cos(ang + s * open) * 8, arm.ey + Math.sin(ang + s * open) * 8);
      ctx.stroke();
    }

    // Joints
    for (const [x, y] of [
      [knee.jx, knee.jy],
      [hx, hy],
      [sx, sy],
      [arm.jx, arm.jy],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (readout) {
      const err = Math.hypot(arm.ex - target.x, arm.ey - target.y);
      const tag = demo && now < demo.until ? " · demo: high-speed run (IEEE Access 2025)" : "";
      readout.textContent = `‖e‖ ${err.toFixed(1)} px · v ${(bot.v / 100).toFixed(2)} m/s · θ ${((bot.pitch * 180) / Math.PI).toFixed(1)}°${tag}`;
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (visible && !document.hidden) {
      step(dt, now);
      draw(now);
    }
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize);

  if (reduceMotion) {
    draw(0);
    return;
  }

  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("loco-demo", (e) => {
    if (e.detail === "speed") demo = { start: performance.now(), until: performance.now() + 4500 };
  });
  document.addEventListener("mouseout", (e) => {
    if (!e.relatedTarget) pointerInside = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    onPointer(e);
    hop();
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);
  requestAnimationFrame(loop);
})();
