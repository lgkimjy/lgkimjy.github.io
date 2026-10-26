// Stepping stones on the publications page: each year divider holds a stone, zigzagging
// along the divider lines, and a small robot hops from stone to stone as the page scrolls,
// landing on the year you are reading. Crouch before take-off, ballistic arc, squash on landing.
(function () {
  const headers = [...document.querySelectorAll(".publications h2.bibliography")];
  if (!headers.length) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SCALE = 0.42;
  const THIGH = 34;
  const SHIN = 34;
  const LEG = 64;
  const TORSO = 34;
  const HEAD_R = 11;
  const UPPER_ARM = 32;
  const FOREARM = 30;
  const HOP_T = 0.55; // s in the air
  const CROUCH_T = 0.12;
  const LAND_T = 0.16;
  const STONE_W = 34;
  const STONE_H = 7;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position: fixed; left: 0; top: 0; z-index: 5; pointer-events: none;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  // cur: stone it stands on; hop: { from, to, t, phase: "crouch" | "air" | "land" }
  const bot = { cur: 0, hop: null, dir: 1 };
  const pointer = { x: -1, y: -1 };
  let W = 0;
  let H = 0;
  let last = performance.now();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Stone i in viewport coordinates: on the divider line, zigzagging in the right-hand margin
  // beside the year label, clear of the publication text column
  function stone(i) {
    const r = headers[i].getBoundingClientRect();
    const x = r.left + r.width * (i % 2 ? 0.87 : 0.955);
    return { x, y: r.top };
  }

  // The year you are reading: the last divider above the middle of the screen. At the bottom
  // of the page the last year counts too, even if a short page never scrolls it that high
  function activeStone() {
    if (window.scrollY > 0 && window.scrollY >= document.documentElement.scrollHeight - H - 2) return headers.length - 1;
    let k = 0;
    headers.forEach((h, i) => {
      if (h.getBoundingClientRect().top < H * 0.55) k = i;
    });
    return k;
  }

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      light: s.getPropertyValue("--global-text-color-light").trim() || "#888",
      bg: s.getPropertyValue("--global-bg-color").trim() || "#fff",
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;

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

  function step(dt) {
    const want = activeStone();
    if (!bot.hop && want !== bot.cur) {
      // One stone at a time, so a long scroll becomes a run of hops
      const to = bot.cur + Math.sign(want - bot.cur);
      bot.hop = { from: bot.cur, to, t: 0, phase: reduceMotion ? "land" : "crouch" };
      bot.dir = stone(to).x >= stone(bot.cur).x ? 1 : -1;
    }
    if (!bot.hop) return;
    const h = bot.hop;
    h.t += dt;
    if (h.phase === "crouch" && h.t >= CROUCH_T) {
      h.phase = "air";
      h.t = 0;
    } else if (h.phase === "air" && h.t >= HOP_T) {
      h.phase = "land";
      h.t = 0;
      bot.cur = h.to;
    } else if (h.phase === "land" && h.t >= LAND_T) {
      bot.cur = h.to;
      bot.hop = null;
    }
  }

  // Feet position, crouch amount (0 standing, 1 deep) and how far into the flight we are
  function state() {
    const h = bot.hop;
    if (!h) {
      const s = stone(bot.cur);
      return { x: s.x, y: s.y - STONE_H, crouch: 0, air: 0 };
    }
    const a = stone(h.from);
    const b = stone(h.to);
    if (h.phase === "crouch") return { x: a.x, y: a.y - STONE_H, crouch: h.t / CROUCH_T, air: 0 };
    if (h.phase === "land") return { x: b.x, y: b.y - STONE_H, crouch: Math.sin((Math.PI * h.t) / LAND_T) * 0.7, air: 0 };
    // Ballistic arc: quadratic Bezier peaking above the higher stone
    const u = h.t / HOP_T;
    const cx = (a.x + b.x) / 2;
    const cy = Math.min(a.y, b.y) - STONE_H - 90 * SCALE * 2;
    const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x;
    const y = (1 - u) * (1 - u) * (a.y - STONE_H) + 2 * (1 - u) * u * cy + u * u * (b.y - STONE_H);
    return { x, y, crouch: 0, air: Math.sin(Math.PI * u) };
  }

  function drawStones(c) {
    ctx.fillStyle = c.light;
    ctx.globalAlpha = 0.45;
    headers.forEach((_, i) => {
      const s = stone(i);
      if (s.y < -20 || s.y > H + 20) return;
      ctx.beginPath();
      ctx.roundRect(s.x - STONE_W / 2, s.y - STONE_H, STONE_W, STONE_H, 3);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawBot(c, now) {
    const st = state();
    if (st.y < -60 || st.y > H + 60) return;
    const d = bot.dir;
    ctx.save();
    ctx.translate(st.x, st.y);
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.ink;
    ctx.lineWidth = 3;

    // Pelvis drops when crouching; in the air the feet tuck up under it
    const pelvisH = LEG - 26 * st.crouch - 4 * st.air + 1.5 * Math.sin(now / 450) * (bot.hop ? 0 : 1);
    const px = 0;
    const py = -pelvisH;
    const lean = 0.25 * st.crouch + 0.15 * st.air;
    const sx = px + d * Math.sin(lean) * TORSO;
    const sy = py - Math.cos(lean) * TORSO;
    const headX = sx + d * Math.sin(lean) * (HEAD_R + 6);
    const headY = sy - Math.cos(lean) * (HEAD_R + 6);

    // Legs: feet on the stone, or tucked in the air
    for (const [off, alpha] of [
      [-5, 0.35],
      [4, 1],
    ]) {
      const fx = d * off * (1 - st.air);
      const fy = -22 * st.air;
      const k = twoLink(px, py, fx, fy, THIGH, SHIN, -d);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(k.jx, k.jy);
      ctx.lineTo(k.ex, k.ey);
      ctx.lineTo(k.ex + d * 8, k.ey);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Torso
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    // Arms swing back in the crouch and up in the air
    for (const [side, alpha] of [
      [-1, 0.35],
      [1, 1],
    ]) {
      const up = lerp(lerp(0.15 * side, -0.9, st.crouch), 2.5 + 0.2 * side, st.air);
      const ex = sx + d * Math.sin(up) * UPPER_ARM;
      const ey = sy + Math.cos(up) * UPPER_ARM;
      const fore = up + 0.3;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.lineTo(ex + d * Math.sin(fore) * FOREARM, ey + Math.cos(fore) * FOREARM);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Head watching the pointer (or looking where it is going)
    ctx.fillStyle = c.bg;
    ctx.beginPath();
    ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    let gx = d;
    let gy = 0;
    if (pointer.x >= 0 && !bot.hop) {
      gx = (pointer.x - st.x) / SCALE - headX;
      gy = (pointer.y - st.y) / SCALE - headY;
    }
    const gn = Math.hypot(gx, gy) || 1;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(headX + (gx / gn) * 4.5, headY + (gy / gn) * 4.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    window.locoHoliday && window.locoHoliday.decorate(ctx, headX, headY, HEAD_R, d, now);
    ctx.restore();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt);
    const c = colors();
    ctx.clearRect(0, 0, W, H);
    drawStones(c);
    drawBot(c, now);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    },
    { passive: true }
  );
  resize();
  bot.cur = activeStone();
  requestAnimationFrame(loop);
})();
