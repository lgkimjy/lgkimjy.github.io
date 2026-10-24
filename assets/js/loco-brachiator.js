// The HIER Lab gorilla brachiating along the scroll progress bar under the navbar.
// It hangs from the filled end of the bar: scroll down and it swings hand over hand to the
// right, scroll up and it turns back. The shoulder rides a pendulum arc under the gripping
// hand, the free hand sweeps forward to the next grip, and the body and legs hang as a
// pendulum driven by the shoulder's acceleration. At the bottom of the page it lets go with
// one hand and waves. Clicks pass straight through it.
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const bar = document.getElementById("progress");
  if (!bar) return;

  const H = 64;
  const GRIP = 36; // spacing between successive hand holds on the bar
  const REACH = 24; // gripping hand to shoulder at the bottom of the swing
  const UPPER_ARM = 13;
  const FOREARM = 13;
  const TORSO = 15;
  const THIGH = 8;
  const SHIN = 8;
  const HEAD_R = 5.5;
  const MARGIN = 20;
  const GRAVITY = 900;
  const ARMOR = "#d7262e"; // HIER red

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position: fixed; left: 0; z-index: 9; pointer-events: none; opacity: 0; transition: opacity 0.3s;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let W = 0;
  const bot = { x: MARGIN, v: 0, a: 0, dir: 1, anchor: MARGIN, phi: 0, dphi: 0, legs: 0, dlegs: 0, wave: 0 };
  let running = false;
  let last = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wake();
  }

  function progress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  // Follow the filled end of the bar
  const targetX = () => MARGIN + progress() * (W - 2 * MARGIN);

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      bg: s.getPropertyValue("--global-bg-color").trim() || "#fff",
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
    return { jx: ax + l1 * Math.cos(t), jy: ay + l1 * Math.sin(t) };
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function step(dt, now) {
    // Shoulder chases the end of the bar with a critically damped spring
    const vPrev = bot.v;
    const acc = clamp(25 * (targetX() - bot.x) - 10 * bot.v, -900, 900);
    bot.v = clamp(bot.v + acc * dt, -450, 450);
    bot.x += bot.v * dt;
    bot.a = (bot.v - vPrev) / dt;
    // Only turn around for a deliberate reversal, not the small settle at the end of a scroll
    if (bot.v > 30) bot.dir = 1;
    else if (bot.v < -30) bot.dir = -1;

    // Hand over hand: once the shoulder is half a hold past the gripping hand, the free hand
    // has reached the next hold and takes over. Reversing simply swings back the other way.
    while (bot.x - bot.anchor > GRIP / 2) bot.anchor += GRIP;
    while (bot.anchor - bot.x > GRIP / 2) bot.anchor -= GRIP;

    // Body hangs from the shoulder as a pendulum, driven by the shoulder's acceleration
    const L = TORSO;
    // (the drive is scaled down: a real ape keeps its body fairly tucked while it swings)
    bot.dphi += (-(GRAVITY / L) * Math.sin(bot.phi) - 4 * bot.dphi - 0.35 * (bot.a / L) * Math.cos(bot.phi)) * dt;
    bot.phi = clamp(bot.phi + bot.dphi * dt, -0.7, 0.7);
    // Legs trail the body a little
    bot.dlegs += (-60 * (bot.legs - bot.phi) - 6 * bot.dlegs) * dt;
    bot.legs += bot.dlegs * dt;

    // Wave at the bottom of the page once settled
    const atEnd = progress() > 0.995 && Math.abs(bot.v) < 5;
    bot.wave += ((atEnd ? 1 : 0) - bot.wave) * Math.min(1, dt * 4);
    return atEnd;
  }

  function draw(now) {
    const c = colors();
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.ink;
    const d = bot.dir;

    // Shoulder rides an arc under the gripping hand
    const off = bot.x - bot.anchor;
    const sx = bot.x;
    const sy = Math.sqrt(Math.max(1, REACH * REACH - off * off)) + 2;

    // Free hand sweeps from the hold behind to the hold ahead, dipping on the way.
    // At the end of the page it lets go and waves instead
    const u = clamp((off * d + GRIP / 2) / GRIP, 0, 1);
    let fx = bot.anchor - d * GRIP + 2 * d * GRIP * u;
    let fy = Math.sin(Math.PI * u) * 9;
    // Slowing down, the free hand settles onto the bar beside the gripping one
    const rest = clamp(1 - Math.abs(bot.v) / 40, 0, 1);
    fx += (bot.anchor + d * 8 - fx) * rest;
    fy += (0 - fy) * rest;
    const waveAng = -0.6 + 0.5 * Math.sin(now / 130);
    fx += (sx + d * (16 * Math.cos(waveAng)) - fx) * bot.wave;
    fy += (sy - 4 + 16 * Math.sin(waveAng) - fy) * bot.wave;

    const hx = sx + Math.sin(bot.phi) * TORSO;
    const hy = sy + Math.cos(bot.phi) * TORSO;

    // Free arm (far side, faded), then legs
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    const fe = twoLink(sx, sy, fx, fy, UPPER_ARM, FOREARM, d);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(fe.jx, fe.jy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.lineWidth = 2;
    for (const [spread, alpha] of [
      [-0.25, 0.45],
      [0.15, 1],
    ]) {
      const la = bot.legs + spread;
      const kx = hx + Math.sin(la) * THIGH;
      const ky = hy + Math.cos(la) * THIGH;
      // Knees fold forward a little, like a hanging ape
      const fa = la - 0.6 * d;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(kx, ky);
      ctx.lineTo(kx + Math.sin(fa) * SHIN, ky + Math.cos(fa) * SHIN);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Bulky torso
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Gripping arm (near side)
    const ge = twoLink(sx, sy, bot.anchor, 0, UPPER_ARM, FOREARM, -d);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ge.jx, ge.jy);
    ctx.lineTo(bot.anchor, 0);
    ctx.stroke();

    // Armor plate on the shoulder, like the lab logo
    ctx.fillStyle = ARMOR;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Head beside the shoulder, facing the direction of travel
    const headX = sx + d * 5;
    const headY = sy - 3;
    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(headX + d * 2, headY - 0.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000) || 0.016;
    last = now;
    canvas.style.top = bar.getBoundingClientRect().top + "px";
    // Out of the way at the very top of the page
    canvas.style.opacity = window.scrollY > 30 ? "1" : "0";
    const waving = step(dt, now);
    draw(now);
    const settled =
      !waving &&
      Math.abs(targetX() - bot.x) < 0.3 &&
      Math.abs(bot.v) < 0.5 &&
      Math.abs(bot.phi) < 0.002 &&
      Math.abs(bot.dphi) < 0.01 &&
      bot.wave < 0.01;
    if (settled) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
  }

  resize();
  bot.x = bot.anchor = targetX();
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("load", wake);
})();
