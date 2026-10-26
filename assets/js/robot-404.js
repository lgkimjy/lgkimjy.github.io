// The 404 page robot: it has fallen over. Click it to help it up; it gets up the way a
// humanoid recovers from a fall on its back (sit up, pull the knees in, rock onto its feet,
// stand, wave). Click it while standing and it topples backwards about its feet again.
// The feet stay planted at one spot throughout: the legs are solved by two-link IK to it.
(function () {
  const canvas = document.getElementById("robot-404");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const hint = document.getElementById("robot-404-hint");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const H = 190;
  const SCALE = 0.65;
  const THIGH = 34;
  const SHIN = 34;
  const LEG = 64; // pelvis height when standing
  const TORSO = 34;
  const HEAD_R = 11;
  const UPPER_ARM = 32;
  const FOREARM = 30;
  const LYING_H = 6; // pelvis height lying on the ground
  const GRAVITY = 900;
  const AUTO_GETUP = 4; // s before it gets up by itself

  // Get-up keyframes. dx: pelvis offset from the feet; h: pelvis height; torso: lean from
  // vertical (+ forward); arms: absolute angles from straight down (+ forward), near and far
  const LYING = { dx: -LEG, h: LYING_H, torso: -Math.PI / 2, nu: Math.PI / 2, nf: Math.PI / 2, fu: 1.4, ff: 1.3 };
  const GET_UP = [
    { t: 0.0, ...LYING },
    { t: 0.7, dx: -LEG, h: LYING_H, torso: -0.35, nu: -0.6, nf: -0.3, fu: -0.5, ff: -0.25 }, // sit up, hands behind
    { t: 1.3, dx: -30, h: LYING_H, torso: 0.25, nu: -0.4, nf: -0.2, fu: -0.35, ff: -0.15 }, // knees up, scoot in
    { t: 1.9, dx: -6, h: 30, torso: 0.75, nu: 0.9, nf: 1.1, fu: 0.7, ff: 0.9 }, // rock onto the feet
    { t: 2.6, dx: 0, h: LEG, torso: 0, nu: 0.08, nf: 0.12, fu: -0.08, ff: -0.04 }, // stand
  ];
  const STAND = GET_UP[GET_UP.length - 1];

  let W = 0;
  let groundY = H - 14;
  let footX = 0;
  // state: "lying" | "getup" | "standing" | "falling"
  const bot = { state: "lying", t: 0, phi: Math.PI / 2, dphi: 0, wave: 0, idle: 0 };
  const pointer = { x: -1, y: -1 };
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
    // Centre the lying body
    footX = W / 2 + LEG / 2;
  }

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      faint: s.getPropertyValue("--global-divider-color").trim() || "#ddd",
      accent: s.getPropertyValue("--global-theme-color").trim() || "#0076df",
      bg: s.getPropertyValue("--global-bg-color").trim() || "#fff",
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const smooth = (s) => s * s * (3 - 2 * s);
  const lerp = (a, b, t) => a + (b - a) * t;

  // Two-link IK: returns the middle joint for a chain from (ax, ay) toward (bx, by).
  function twoLink(ax, ay, bx, by, l1, l2, bend) {
    const dx = bx - ax;
    const dy = by - ay;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    const phi = Math.atan2(dy, dx);
    const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
    const t = phi + bend * alpha;
    const ux = dx / Math.hypot(dx, dy || 1e-6);
    const uy = dy / Math.hypot(dx, dy || 1e-6);
    return { jx: ax + l1 * Math.cos(t), jy: ay + l1 * Math.sin(t), ex: ax + ux * d, ey: ay + uy * d };
  }

  // Current pose from the state machine
  function pose() {
    if (bot.state === "getup") {
      const k = GET_UP.findIndex((f) => f.t > bot.t);
      if (k === -1) return { ...STAND };
      const a = GET_UP[k - 1];
      const b = GET_UP[k];
      const s = smooth((bot.t - a.t) / (b.t - a.t));
      const p = {};
      for (const key of ["dx", "h", "torso", "nu", "nf", "fu", "ff"]) p[key] = lerp(a[key], b[key], s);
      return p;
    }
    if (bot.state === "lying") return { ...LYING };
    // Standing, or toppling rigidly backwards about the feet by phi
    const phi = bot.state === "falling" ? bot.phi : 0;
    const breathe = bot.state === "standing" ? 0.02 * Math.sin(bot.idle * 2.2) : 0;
    return {
      dx: -LEG * Math.sin(phi),
      h: LEG * Math.cos(phi) + LYING_H * Math.sin(phi),
      torso: STAND.torso - phi + breathe,
      nu: STAND.nu + phi,
      nf: STAND.nf + phi,
      fu: STAND.fu + phi,
      ff: STAND.ff + phi,
    };
  }

  function push() {
    bot.state = "falling";
    bot.phi = 0.05;
    bot.dphi = 1.6;
    bot.wave = 0;
  }

  function getUp() {
    bot.state = "getup";
    bot.t = 0;
    if (hint) hint.textContent = "Click the robot to push it over";
  }

  function step(dt) {
    if (bot.state === "lying") {
      bot.t += dt;
      if (bot.t > AUTO_GETUP) getUp();
    } else if (bot.state === "getup") {
      bot.t += dt;
      if (bot.t >= GET_UP[GET_UP.length - 1].t) {
        bot.state = "standing";
        bot.idle = 0;
        bot.wave = 1.8; // wave hello for a moment
      }
    } else if (bot.state === "standing") {
      bot.idle += dt;
      bot.wave = Math.max(0, bot.wave - dt);
    } else if (bot.state === "falling") {
      // Rigid inverted pendulum about the feet, with a small bounce on landing
      bot.dphi += (GRAVITY / LEG) * Math.sin(bot.phi) * dt;
      bot.phi += bot.dphi * dt;
      if (bot.phi >= Math.PI / 2) {
        bot.phi = Math.PI / 2;
        bot.dphi = -0.2 * bot.dphi;
        if (Math.abs(bot.dphi) < 0.3) {
          bot.state = "lying";
          bot.t = 0;
          if (hint) hint.textContent = "Click the robot to help it up";
        }
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

    const p = pose();
    const px = footX + p.dx;
    const py = groundY - p.h;
    const sx = px + Math.sin(p.torso) * TORSO;
    const sy = py - Math.cos(p.torso) * TORSO;
    const headX = sx + Math.sin(p.torso) * (HEAD_R + 6);
    const headY = sy - Math.cos(p.torso) * (HEAD_R + 6);
    const down = bot.state === "lying" || bot.state === "falling" || (bot.state === "getup" && bot.t < 0.4);

    const arm = (u, f, alpha) => {
      const ex = sx + Math.sin(u) * UPPER_ARM;
      const ey = sy + Math.cos(u) * UPPER_ARM;
      const hx = ex + Math.sin(f) * FOREARM;
      // Hands rest on the ground rather than sinking into it
      const hy = Math.min(ey + Math.cos(f) * FOREARM, groundY);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return { ex, ey };
    };

    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.ink;
    ctx.lineWidth = 2.5;

    // The near arm waves for a moment after standing up
    let { nu, nf } = p;
    const { fu, ff } = p;
    if (bot.wave > 0) {
      const w = Math.min(1, bot.wave * 3);
      nu = lerp(nu, 2.6, w);
      nf = lerp(nf, 2.9 + 0.45 * Math.sin(now / 110), w);
    }

    // Far arm and leg, faded
    arm(fu, ff, 0.35);
    const legs = (offset, alpha) => {
      const k = twoLink(px, py, footX + offset, groundY, THIGH, SHIN, -1);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(k.jx, k.jy);
      ctx.lineTo(k.ex, k.ey);
      ctx.lineTo(k.ex + 8, k.ey);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return k;
    };
    legs(-6, 0.35);
    const knee = legs(0, 1);

    // Torso
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // Near arm
    const elbow = arm(nu, nf, 1);

    // Head; dizzy x-eyes and circling stars while down, otherwise it watches the pointer
    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    if (down) {
      ctx.lineWidth = 1.6;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(headX - 3, headY - 3 * s);
        ctx.lineTo(headX + 3, headY + 3 * s);
        ctx.stroke();
      }
      ctx.fillStyle = c.accent;
      for (let i = 0; i < 3; i++) {
        const a = now / 400 + (i * 2 * Math.PI) / 3;
        const x = headX + Math.cos(a) * 18;
        const y = headY - 6 + Math.sin(a) * 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(now / 300);
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const r = j % 2 ? 1.2 : 3.4;
          const t = (j * Math.PI) / 4;
          ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = c.ink;
    } else {
      let gx = pointer.x - headX;
      let gy = pointer.y - headY;
      if (pointer.x < 0) {
        gx = 1;
        gy = 0;
      }
      const gn = Math.hypot(gx, gy) || 1;
      ctx.beginPath();
      ctx.arc(headX + (gx / gn) * 4.5, headY + (gy / gn) * 4.5, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    window.locoHoliday && window.locoHoliday.decorate(ctx, headX, headY, HEAD_R, 1, now);

    // Joints
    for (const [x, y] of [
      [knee.jx, knee.jy],
      [px, py],
      [sx, sy],
      [elbow.ex, elbow.ey],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Click anywhere on the robot's canvas: help it up, or push it over
  canvas.addEventListener("pointerdown", () => {
    if (bot.state === "lying") getUp();
    else if (bot.state === "standing") push();
  });
  window.addEventListener(
    "pointermove",
    (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / SCALE;
      pointer.y = (e.clientY - r.top) / SCALE;
    },
    { passive: true }
  );

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize);
  if (reduceMotion) {
    bot.state = "standing";
    draw(0);
    return;
  }
  requestAnimationFrame(loop);
})();
