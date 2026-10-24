// A tiny planar biped that walks over to the cursor and reaches for it.
// Pelvis: damped spring toward a stand-off point, height limited by leg reach.
// Feet: procedural footstep planner with alternating swing phases.
// Legs and arm: analytic two-link IK. Click on the canvas to make it hop.
(function () {
  const canvas = document.getElementById("loco-bot");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const readout = document.getElementById("loco-bot-readout");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const H = 190;
  const SCALE = 0.8; // draw everything at 80%, proportions unchanged
  const THIGH = 34;
  const SHIN = 34;
  const LEG_MAX = THIGH + SHIN - 2;
  const TORSO = 34;
  const HEAD_R = 11;
  const UPPER_ARM = 32;
  const FOREARM = 30;
  const REACH = UPPER_ARM + FOREARM;
  const STAND = 62; // hip height when standing, knees slightly bent
  const STEP_T = 0.26; // swing duration, s
  const STEP_H = 11; // swing apex, px
  const MAX_V = 150; // px/s

  let W = 0;
  let groundY = H - 14;

  const bot = { x: 0, v: 0, a: 0, pitch: 0, hipH: STAND, hopY: 0, hopV: 0, dir: 1, steps: 0 };
  // Foot 0 is the near leg, foot 1 the far leg
  const feet = [
    { x: 0, lift: 0, from: 0, to: 0, s: -1 },
    { x: 0, lift: 0, from: 0, to: 0, s: -1 },
  ];
  let lastStep = 1;
  const target = { x: 0, y: 0 };
  let pointerInside = false;
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
      feet[0].x = bot.x + 5;
      feet[1].x = bot.x - 5;
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
  const smooth = (s) => s * s * (3 - 2 * s);

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
    if (bot.hopY === 0 && bot.hopV === 0) bot.hopV = -250;
  }

  function startStep(i) {
    const f = feet[i];
    // Land where the pelvis will be at touchdown, plus half a stride ahead
    const ahead = clamp(bot.v * STEP_T * 0.6, -26, 26);
    const rest = Math.abs(bot.v) < 15 ? (i === 0 ? 5 : -5) * bot.dir : 0;
    f.from = f.x;
    f.to = bot.x + bot.v * STEP_T + ahead + rest;
    f.s = 0;
    lastStep = i;
  }

  function planSteps() {
    if (feet.some((f) => f.s >= 0)) return;
    const moving = Math.abs(bot.v) > 15;
    const px = bot.x + bot.v * 0.15;
    const thr = moving ? 12 : 7;
    const next = 1 - lastStep;
    const restOff = (i) => (moving ? 0 : (i === 0 ? 5 : -5) * bot.dir);
    const err = (i) => Math.abs(feet[i].x - (px + restOff(i)));
    if (err(next) > thr) startStep(next);
    else if (err(lastStep) > thr * 2) startStep(lastStep);
  }

  function step(dt, now) {
    // Wander on a slow Lissajous path while the pointer is away, gliding the target onto it
    if (!pointerInside) {
      const t = now / 1000;
      const k = Math.min(1, dt * 2);
      target.x += (W * (0.5 + 0.38 * Math.sin(t * 0.35)) - target.x) * k;
      target.y += (H * (0.42 + 0.22 * Math.sin(t * 0.8 + 1)) - target.y) * k;
    }

    if (target.x - bot.x > 12) bot.dir = 1;
    else if (target.x - bot.x < -12) bot.dir = -1;

    const airborne = bot.hopY < 0 || bot.hopV !== 0;

    // Pelvis: spring toward a stand-off point; walking is slower than rolling
    const xDes = clamp(target.x - bot.dir * 0.55 * REACH, 20, W - 20);
    const aCmd = clamp(20 * (xDes - bot.x) - 9 * bot.v, -700, 700);
    const vPrev = bot.v;
    bot.v = airborne ? bot.v : clamp(bot.v + aCmd * dt, -MAX_V, MAX_V);
    bot.x = clamp(bot.x + bot.v * dt, 20, W - 20);
    bot.a = dt > 0 ? (bot.v - vPrev) / dt : 0;

    const pitchDes = clamp(bot.a * 0.0005 + bot.v * 0.0008, -0.3, 0.3);
    bot.pitch += (pitchDes - bot.pitch) * Math.min(1, dt * 6);

    // Footsteps. In the air the feet travel with the body, so a running hop lands in stride
    if (airborne) {
      for (const f of feet) {
        f.x += bot.v * dt;
        f.from += bot.v * dt;
        f.to += bot.v * dt;
      }
    } else {
      planSteps();
    }
    for (const f of feet) {
      if (f.s < 0) continue;
      f.s = Math.min(1, f.s + dt / STEP_T);
      f.x = f.from + (f.to - f.from) * smooth(f.s);
      f.lift = Math.sin(Math.PI * f.s) * STEP_H * clamp(Math.abs(f.to - f.from) / 25 + 0.3, 0.3, 1);
      if (f.s >= 1) {
        f.s = -1;
        f.lift = 0;
        bot.steps++;
      }
    }

    // Hip height: crouch toward low targets, rise a little mid-swing,
    // and never higher than the planted feet can reach
    const swing = feet.find((f) => f.s >= 0);
    let hipDes = clamp(groundY - target.y - TORSO + 10, 48, STAND);
    if (swing) hipDes += 2 * Math.sin(Math.PI * swing.s);
    for (const f of feet) {
      const dx = f.x - bot.x;
      hipDes = Math.min(hipDes, Math.sqrt(Math.max(0, LEG_MAX * LEG_MAX - dx * dx)) + f.lift);
    }
    bot.hipH += (hipDes - bot.hipH) * Math.min(1, dt * 10);

    if (airborne) {
      bot.hopV += 1100 * dt;
      bot.hopY += bot.hopV * dt;
      if (bot.hopY >= 0) {
        bot.hopY = 0;
        bot.hopV = 0;
      }
    }
  }

  function drawLeg(hx, hy, f, alpha) {
    // Feet tuck up a little more than the pelvis during a hop, so the knees bend
    const fy = groundY - f.lift + bot.hopY * 1.3;
    const knee = twoLink(hx, hy, f.x, fy, THIGH, SHIN, -bot.dir);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(knee.jx, knee.jy);
    ctx.lineTo(knee.ex, knee.ey);
    ctx.lineTo(knee.ex + bot.dir * 8, knee.ey);
    ctx.moveTo(knee.ex, knee.ey);
    ctx.lineTo(knee.ex - bot.dir * 3, knee.ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(knee.jx, knee.jy, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
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

    const hx = bot.x;
    const hy = groundY - bot.hipH + bot.hopY;
    const sx = hx + Math.sin(bot.pitch) * TORSO;
    const sy = hy - Math.cos(bot.pitch) * TORSO;
    const headX = sx + Math.sin(bot.pitch) * (HEAD_R + 6);
    const headY = sy - Math.cos(bot.pitch) * (HEAD_R + 6);
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

    // Back arm swings against the far leg
    const swingAng = clamp((feet[1].x - bot.x) / 30, -1, 1) * 0.5;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    const ex = sx - Math.sin(swingAng) * 22;
    const ey = sy + Math.cos(swingAng) * 22;
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex - Math.sin(swingAng - 0.3 * bot.dir) * 18, ey + Math.cos(swingAng - 0.3 * bot.dir) * 18);
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawLeg(hx, hy, feet[1], 0.35);
    drawLeg(hx, hy, feet[0], 1);

    // Torso
    ctx.beginPath();
    ctx.moveTo(hx, hy);
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
      readout.textContent = `‖e‖ ${err.toFixed(1)} px · v ${(bot.v / 100).toFixed(2)} m/s · steps ${bot.steps}`;
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
