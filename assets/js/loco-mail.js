// Clicking the email or CV icon sends a small robot to deliver it first: it walks in from
// the left of the icon row holding an envelope (or a CV page) overhead, tosses it into the
// icon, and then the mail client (or the PDF) opens. Feet are planted while in stance, so
// they never slide. Clicking again mid-delivery (or with a modifier key) opens it right away.
(function () {
  const row = document.querySelector(".contact-icons");
  if (!row) return;
  const mail = row.querySelector('a[href^="mailto:"]');
  const cv = row.querySelector('a[title="CV"]');
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SCALE = 0.4;
  const THIGH = 34;
  const SHIN = 34;
  const TORSO = 34;
  const HEAD_R = 11;
  const UPPER_ARM = 32;
  const FOREARM = 30;
  const PELVIS_H = 58; // a slightly bent-knee walk so the longer stride stays within reach
  const SPEED = 450; // model px/s
  const PERIOD = 0.3; // s per gait cycle
  const STRIDE = SPEED * PERIOD;
  const TOSS_T = 0.38;
  const PAD = 90; // css px of canvas around the icon row

  let running = null;

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      bg: s.getPropertyValue("--global-bg-color").trim() || "#fff",
      accent: s.getPropertyValue("--global-theme-color").trim() || "#0076df",
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

  // A new tab opened this long after the click can be caught by the popup blocker;
  // fall back to opening it in this tab
  function openLink(link) {
    if (link.target === "_blank") {
      const tab = window.open(link.href, "_blank");
      if (tab) return;
    }
    window.location.href = link.href;
  }

  function deliver(link, item) {
    const rr = row.getBoundingClientRect();
    const ir = (link.querySelector("i") || link).getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const left = rr.left + scrollX - PAD;
    const top = rr.top + scrollY - PAD;
    const cw = rr.width + 2 * PAD;
    const ch = rr.height + PAD + 10;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.cssText = `position: absolute; left: ${left}px; top: ${top}px; width: ${cw}px; height: ${ch}px; z-index: 5; pointer-events: none;`;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    // Model coordinates: x along the row, y = 0 on the ground under the icons
    const ground = (rr.bottom + scrollY - top) / SCALE;
    const iconX = (ir.left + ir.width / 2 + scrollX - left) / SCALE;
    const iconY = (ir.top + ir.height / 2 + scrollY - top) / SCALE - ground;
    const x1 = iconX - ir.width / 2 / SCALE - 30;
    // Set off just left of the icon row, with at least a short walk for the leftmost icon
    const x0 = Math.max(10 / SCALE, Math.min((PAD - 40) / SCALE, x1 - 70 / SCALE));
    const walkT = Math.max(0.2, (x1 - x0) / SPEED);
    const start = performance.now();
    const icon = link.querySelector("i") || link;
    let tossed = false;

    const bodyX = (t) => x0 + SPEED * clamp(t, 0, walkT);

    // Planted feet: foot i lands every PERIOD, half a cycle apart, a quarter stride ahead
    // of the pelvis, and holds still until it swings to the next landing spot
    function foot(i, t) {
      const off = (i * PERIOD) / 2;
      const tau = t + off;
      const k = Math.floor(tau / PERIOD);
      const c = tau - k * PERIOD;
      const plant = (n) => bodyX(n * PERIOD - off) + STRIDE / 4;
      if (c < PERIOD / 2) return { x: plant(k), y: 0 };
      const s = (c - PERIOD / 2) / (PERIOD / 2);
      return { x: lerp(plant(k), plant(k + 1), s), y: -Math.sin(Math.PI * s) * 14 };
    }

    function frame(now) {
      const t = (now - start) / 1000;
      const arrived = t >= walkT;
      const after = t - walkT;
      const c = colors();
      ctx.setTransform(dpr * SCALE, 0, 0, dpr * SCALE, 0, 0);
      ctx.clearRect(0, 0, cw / SCALE, ch / SCALE);
      ctx.translate(0, ground);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = c.ink;
      ctx.fillStyle = c.ink;
      ctx.lineWidth = 3;

      const bx = bodyX(t);
      const walking = !arrived;
      const py = -PELVIS_H + (walking ? 3 * Math.abs(Math.sin((Math.PI * 2 * t) / PERIOD)) : 0);
      const sx = bx;
      const sy = py - TORSO;
      const headX = sx;
      const headY = sy - HEAD_R - 6;

      // Legs; once arrived the feet settle together under the pelvis
      const settle = clamp(after / 0.15, 0, 1);
      for (const [i, alpha] of [
        [1, 0.35],
        [0, 1],
      ]) {
        let f = foot(i, Math.min(t, walkT));
        if (arrived) f = { x: lerp(f.x, bx + (i ? -4 : 4), settle), y: lerp(f.y, 0, settle) };
        const k = twoLink(bx, py, f.x, f.y, THIGH, SHIN, -1);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(bx, py);
        ctx.lineTo(k.jx, k.jy);
        ctx.lineTo(k.ex, k.ey);
        ctx.lineTo(k.ex + 8, k.ey);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(bx, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      // Envelope or CV page held overhead, then tossed along an arc into the icon
      const holdX = sx + 6;
      const holdY = headY - HEAD_R - 26;
      let ex = holdX;
      let ey = holdY;
      let size = 1;
      let alphaEnv = 1;
      const toss = clamp(after / TOSS_T, 0, 1);
      if (arrived) {
        const cx = (holdX + iconX) / 2;
        const cy = Math.min(holdY, iconY) - 60;
        ex = (1 - toss) * (1 - toss) * holdX + 2 * (1 - toss) * toss * cx + toss * toss * iconX;
        ey = (1 - toss) * (1 - toss) * holdY + 2 * (1 - toss) * toss * cy + toss * toss * iconY;
        size = 1 - 0.6 * toss;
        alphaEnv = 1 - Math.max(0, toss - 0.8) * 5;
      }

      // Arms reach up to the item, then follow through after the toss
      const reach = arrived ? lerp(2.75, 2.2, toss) : 2.75;
      for (const [side, alpha] of [
        [-1, 0.35],
        [1, 1],
      ]) {
        const u = reach + 0.12 * side;
        const elx = sx + Math.sin(u) * UPPER_ARM;
        const ely = sy + Math.cos(u) * UPPER_ARM;
        const f = u + 0.25;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(elx, ely);
        ctx.lineTo(elx + Math.sin(f) * FOREARM, ely + Math.cos(f) * FOREARM);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Head, looking ahead to the icon
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(headX, headY, HEAD_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const gx = iconX - headX;
      const gy = iconY - headY;
      const gn = Math.hypot(gx, gy) || 1;
      ctx.fillStyle = c.ink;
      ctx.beginPath();
      ctx.arc(headX + (gx / gn) * 4.5, headY + (gy / gn) * 4.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
      window.locoHoliday && window.locoHoliday.decorate(ctx, headX, headY, HEAD_R, 1, now);

      if (alphaEnv > 0) {
        ctx.globalAlpha = clamp(alphaEnv, 0, 1);
        ctx.fillStyle = c.bg;
        ctx.lineWidth = 2.5;
        if (item === "envelope") {
          const w = 44 * size;
          const h = 30 * size;
          ctx.beginPath();
          ctx.rect(ex - w / 2, ey - h / 2, w, h);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ex - w / 2, ey - h / 2);
          ctx.lineTo(ex, ey + h * 0.1);
          ctx.lineTo(ex + w / 2, ey - h / 2);
          ctx.stroke();
          ctx.fillStyle = c.accent;
          ctx.beginPath();
          ctx.arc(ex, ey + h * 0.1, 3.5 * size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // A CV page: heading bar and a few lines of text
          const w = 32 * size;
          const h = 42 * size;
          ctx.beginPath();
          ctx.rect(ex - w / 2, ey - h / 2, w, h);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = c.accent;
          ctx.fillRect(ex - w * 0.32, ey - h * 0.34, w * 0.64, h * 0.12);
          ctx.lineWidth = 1.8;
          for (let i = 0; i < 4; i++) {
            const ly = ey - h * 0.08 + i * h * 0.13;
            ctx.beginPath();
            ctx.moveTo(ex - w * 0.32, ly);
            ctx.lineTo(ex + w * (i === 3 ? 0.05 : 0.32), ly);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      if (arrived && toss >= 1 && !tossed) {
        tossed = true;
        if (icon.animate) icon.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 260 });
        setTimeout(() => {
          finish();
          openLink(link);
        }, 280);
      }
      if (running) requestAnimationFrame(frame);
    }

    function finish() {
      running = null;
      canvas.remove();
    }

    running = { finish };
    requestAnimationFrame(frame);
  }

  for (const [link, item] of [
    [mail, "envelope"],
    [cv, "page"],
  ]) {
    if (!link) continue;
    link.addEventListener("click", (e) => {
      // Modified clicks, a second click mid-delivery, or reduced motion: open right away
      if (reduceMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (running) {
        running.finish();
        openLink(link);
        return;
      }
      deliver(link, item);
    });
  }
})();
