// A planar robot gorilla, after the HIER Lab mascot. It knuckle-walks on four limbs to get
// around and rears up onto its legs to reach the cursor: loco-manipulation, gorilla style.
// Gait: a phase clock sets a lateral-sequence walk; planted feet and knuckles stay fixed on
// the ground and each swing lands half a stride ahead. Limbs: analytic two-link IK.
// Hold on the canvas to run; let go to leap toward the target on a ballistic arc
// whose height grows with the distance to cover.
(function () {
  const canvas = document.getElementById("loco-gorillabot");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const readout = document.getElementById("loco-gorillabot-readout");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Same on-screen height as the other robots (190 at 80%), but drawn at full size: a gorilla is bulky
  const H = 152;
  const SCALE = 1;
  // Long enough that elbows and knees stay bent even at the ends of a stride
  const THIGH = 26;
  const SHIN = 26;
  const TORSO = 46;
  const UPPER_ARM = 36;
  const FOREARM = 36;
  const HIP_H = 38; // hip height above ground
  // Walk: long stance, leaves all-planted gaps to stop in. Run: shorter stance, longer stride
  const STRIDE_WALK = 34; // ground covered by one stance phase
  const STRIDE_RUN = 44;
  const DUTY_WALK = 0.8; // fraction of the cycle a limb is planted
  const DUTY_RUN = 0.6;
  const MIN_RATE = 1.2; // gait cycles/s while starting, stopping or shuffling into place
  const LIFT = 8;
  const MAX_V = 80; // px/s walking
  const RUN_V = 150; // px/s while the pointer is held down
  const GRAVITY = 900; // px/s^2
  const LAND_T = 0.18; // landing dip, s
  const QUAD_PITCH = 0.55; // torso angle above horizontal on all fours, rad
  const BIPED_PITCH = 1.4; // torso angle when standing up
  const ARMOR = "#d7262e"; // HIER red

  // Lateral-sequence walk: near hind, near fore, far hind, far fore
  const limbs = [
    { hind: true, off: 0, x: 0, from: 0, to: 0, lift: 0, swing: false },
    { hind: false, off: 0.25, x: 0, from: 0, to: 0, lift: 0, swing: false },
    { hind: true, off: 0.5, x: 0, from: 0, to: 0, lift: 0, swing: false },
    { hind: false, off: 0.75, x: 0, from: 0, to: 0, lift: 0, swing: false },
  ];
  const [nearHind, nearFore, farHind, farFore] = limbs;

  let W = 0;
  let groundY = H - 14;

  const bot = { x: 0, v: 0, dir: 1, phase: 0, pitch: QUAD_PITCH, rear: 0, reach: 0, run: 0 };
  const leap = { air: false, vx: 0, vy: 0, y: 0, t: 0, T: 1, land: 0 };
  const target = { x: 0, y: 0 };
  let pointerInside = false;
  let holding = false;
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
      for (const l of limbs) l.x = l.to = nominal(l);
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
    const jx = ax + l1 * Math.cos(t);
    const jy = ay + l1 * Math.sin(t);
    const ux = dx / Math.hypot(dx, dy || 1e-6);
    const uy = dy / Math.hypot(dx, dy || 1e-6);
    return { jx, jy, ex: ax + ux * d, ey: ay + uy * d };
  }

  // Where a limb rests when standing: under the hip, or under the shoulder
  function nominal(l) {
    const base = l.hind ? bot.x : bot.x + bot.dir * Math.cos(bot.pitch) * TORSO;
    return base + bot.dir * 3;
  }

  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    // Only follow the pointer while it's near the robot's strip of the page
    pointerInside = e.clientY > r.top - 60 && e.clientY < r.bottom + 60 && e.clientX > r.left && e.clientX < r.right;
    if (!pointerInside) return;
    target.x = clamp((e.clientX - r.left) / SCALE, 8, W - 8);
    target.y = clamp((e.clientY - r.top) / SCALE, 30, groundY - 6);
  }

  // Ballistic leap to the reaching spot in front of the target: near targets get a low,
  // short hop, far ones a higher arc. Flight time follows from the apex height.
  function jump() {
    if (leap.air) return;
    const landX = clamp(target.x - bot.dir * 40, 24, W - 24);
    const dx = clamp(landX - bot.x, -220, 220);
    const apex = clamp(10 + Math.abs(dx) * 0.15, 10, 40);
    const tUp = Math.sqrt((2 * apex) / GRAVITY);
    leap.vy = -GRAVITY * tUp;
    leap.vx = dx / (2 * tUp);
    leap.t = 0;
    leap.T = 2 * tUp;
    leap.air = true;
  }

  function step(dt, now) {
    // Wander on a slow Lissajous path while the pointer is away, gliding the target onto it
    if (!pointerInside) {
      const t = now / 1000;
      const k = Math.min(1, dt * 2);
      target.x += (W * (0.5 + 0.38 * Math.sin(t * 0.3)) - target.x) * k;
      target.y += (H * (0.42 + 0.22 * Math.sin(t * 0.7 + 1)) - target.y) * k;
    }

    // In the air: ballistic arc. Feet and knuckles ride along with the body and drift to
    // their spots under it, so the landing comes down square
    if (leap.air) {
      leap.t += dt;
      leap.vy += GRAVITY * dt;
      leap.y += leap.vy * dt;
      const dx = clamp(bot.x + leap.vx * dt, 24, W - 24) - bot.x;
      bot.x += dx;
      for (const l of limbs) {
        l.x += dx + (nominal(l) - l.x) * Math.min(1, dt * 6);
        l.from = l.to = l.x;
      }
      // Nose up on the way up, down on the way down
      bot.pitch = lerp(QUAD_PITCH, BIPED_PITCH, bot.rear) + clamp(-leap.vy * 0.0006, -0.25, 0.25);
      if (leap.y >= 0) {
        leap.air = false;
        leap.y = 0;
        leap.land = LAND_T;
        for (const l of limbs) {
          l.swing = false;
          l.lift = 0;
        }
        bot.v = clamp(leap.vx * 0.3, -MAX_V, MAX_V);
      }
      return;
    }
    if (leap.land > 0) leap.land = Math.max(0, leap.land - dt);

    const dirPrev = bot.dir;
    if (target.x - bot.x > 14) bot.dir = 1;
    else if (target.x - bot.x < -14) bot.dir = -1;
    // Turning around swaps which end of the body the shoulder is on; mirror the planted
    // feet and knuckles about the body centre so they stay under the hip and shoulder
    if (bot.dir !== dirPrev) {
      const cx = bot.x + dirPrev * Math.cos(bot.pitch) * TORSO * 0.5;
      for (const l of limbs) {
        l.x = 2 * cx - l.x;
        l.from = 2 * cx - l.from;
        l.to = 2 * cx - l.to;
      }
      bot.x = 2 * cx - bot.x;
    }

    bot.run += ((holding ? 1 : 0) - bot.run) * Math.min(1, dt * 4);
    const vMax = lerp(MAX_V, RUN_V, bot.run);
    const xDes = clamp(target.x - bot.dir * 40, 24, W - 24);
    const aCmd = clamp(14 * (xDes - bot.x) - 8 * bot.v, -400 - 300 * bot.run, 400 + 300 * bot.run);
    bot.v = clamp(bot.v + aCmd * dt, -vMax, vMax);
    const xNext = clamp(bot.x + bot.v * dt, 24, W - 24);
    // Stopped by the edge: drop the velocity too, or the feet keep stepping ahead of a body that isn't moving
    if (xNext !== bot.x + bot.v * dt) bot.v = 0;
    bot.x = xNext;

    // Rear up when close to the target (not while running); stand taller for higher targets.
    // Looser exit avoids flicker
    const near = !holding && (bot.rear > 0.5 ? Math.abs(xDes - bot.x) < 45 : Math.abs(xDes - bot.x) < 18 && Math.abs(bot.v) < 30);
    const rearDes = near ? clamp((groundY - target.y - 30) / 70, 0.15, 1) : 0;
    bot.rear += (rearDes - bot.rear) * Math.min(1, dt * 4);
    // Reaching is separate from standing: low targets get a three-limbed reach
    bot.reach += ((near ? 1 : 0) - bot.reach) * Math.min(1, dt * 5);
    // Running flattens the back a little
    bot.pitch = lerp(QUAD_PITCH, BIPED_PITCH, bot.rear) - 0.12 * bot.run;

    // Fore limbs off the ground (reaching, hanging) don't count toward settling
    const foreUp = bot.reach > 0.1 || bot.rear > 0.3;
    const grounded = (l) => l.hind || !foreUp;

    // Gait clock: tied to distance so stance never slips, with a floor so feet settle when stopping
    const duty = lerp(DUTY_WALK, DUTY_RUN, bot.run);
    const stride = lerp(STRIDE_WALK, STRIDE_RUN, bot.run);
    const unsettled = limbs.some((l) => grounded(l) && (l.swing || Math.abs(l.x - nominal(l)) > 3));
    const distRate = (Math.abs(bot.v) * duty) / stride;
    const rate = Math.max(distRate, Math.abs(bot.v) > 4 || unsettled ? MIN_RATE : 0);
    bot.phase = (bot.phase + rate * dt) % 1;

    const swingT = (1 - duty) / Math.max(rate, 1e-3);
    const stanceT = Math.min(1, duty / Math.max(rate, 1e-3));
    for (const l of limbs) {
      const p = (bot.phase + l.off) % 1;
      const inSwing = p >= duty;
      if (inSwing && !l.swing) {
        l.swing = true;
        l.from = l.x;
      }
      if (!l.swing) continue;
      if (!inSwing) {
        // Touchdown: the foot stays exactly here until its next swing
        l.swing = false;
        l.x = l.to;
        l.lift = 0;
        continue;
      }
      const s = (p - duty) / (1 - duty);
      const remain = Math.min(0.3, (1 - s) * swingT);
      l.to = nominal(l) + bot.v * remain + clamp((bot.v * stanceT) / 2, -stride / 2, stride / 2);
      l.x = lerp(l.from, l.to, smooth(s));
      l.lift = Math.sin(Math.PI * s) * LIFT * clamp(Math.abs(l.to - l.from) / 12, 0.3, 1);
    }
  }

  // Round head with an eye that looks at the target, like the other robots
  function drawHead(x, y, c) {
    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.bg;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const gx = target.x - x;
    const gy = target.y - y;
    const gn = Math.hypot(gx, gy) || 1;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(x + (gx / gn) * 4, y + (gy / gn) * 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    window.locoHoliday && window.locoHoliday.decorate(ctx, x, y, 10, bot.dir, performance.now());
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

    const d = bot.dir;
    // Torso axis u (hip to shoulder) and its upward normal n
    const ux = d * Math.cos(bot.pitch);
    const uy = -Math.sin(bot.pitch);
    const nx = -d * Math.sin(bot.pitch);
    const ny = -Math.cos(bot.pitch);
    const hx = bot.x;
    const dip = leap.land > 0 ? 5 * Math.sin(Math.PI * (1 - leap.land / LAND_T)) : 0;
    // Drop the hip when a planted foot is far out, so the knees never lock straight
    let hipH = HIP_H + 4 * bot.rear;
    if (!leap.air) {
      const r = 0.9 * (THIGH + SHIN);
      for (const l of [nearHind, farHind]) {
        const dx = l.x - bot.x;
        hipH = Math.min(hipH, l.lift + Math.sqrt(Math.max(0, r * r - dx * dx)));
      }
    }
    const hy = groundY - hipH + leap.y + dip;
    const sx = hx + ux * TORSO;
    const sy = hy + uy * TORSO;
    // Head sits on a short neck, clear of the shoulder plate
    const headX = sx + ux * 14 + nx * 2;
    const headY = sy + uy * 14 + ny * 2;

    // Hands walk on the knuckles, reach and hang when standing. In the air the limbs fold into a
    // landing pose (fore arms forward under the shoulder, hind legs under the hip), most at the apex
    const air = leap.air ? Math.sin(Math.PI * clamp(leap.t / leap.T, 0, 1)) * 0.85 : 0;
    const tuck = leap.air ? leap.y : 0;
    const knuckle = (l) => ({
      x: lerp(l.x, sx + d * 10, air),
      y: lerp(groundY - 3 - l.lift + tuck, sy + 46, air),
    });
    const foot = (l) => ({
      x: lerp(l.x, hx + d * 2, air),
      y: lerp(groundY - l.lift + tuck, hy + 34, air),
    });
    const reachT = smooth(bot.reach);
    // The far hand leaves the ground early as the shoulder rises, before the arm runs out of length
    const hangT = smooth(clamp((bot.rear - 0.18) / 0.4, 0, 1));
    // A knuckle that would need an almost straight arm is lifted off the ground instead
    const hang = { x: sx + d * 6, y: sy + 44 };
    const planted = (l) => {
      const k = knuckle(l);
      const ext = Math.hypot(k.x - sx, k.y - sy) / (UPPER_ARM + FOREARM);
      const t = Math.max(l === farFore ? hangT : 0, smooth(clamp((ext - 0.86) / 0.08, 0, 1)));
      return { x: lerp(k.x, hang.x, t), y: lerp(k.y, hang.y, t) };
    };
    let nearHand = planted(nearFore);
    const farHand = planted(farFore);
    nearHand = { x: lerp(nearHand.x, target.x, reachT), y: lerp(nearHand.y, target.y, reachT) };
    const nearArm = twoLink(sx, sy, nearHand.x, nearHand.y, UPPER_ARM, FOREARM, d);
    const farArm = twoLink(sx, sy, farHand.x, farHand.y, UPPER_ARM, FOREARM, d);
    const nf = foot(nearHind);
    const ff = foot(farHind);
    const nearLeg = twoLink(hx, hy, nf.x, nf.y, THIGH, SHIN, -d);
    const farLeg = twoLink(hx, hy, ff.x, ff.y, THIGH, SHIN, -d);
    const reached = !leap.air && reachT > 0.95 && Math.hypot(nearArm.ex - target.x, nearArm.ey - target.y) < 2;

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

    const limb = (ax, ay, j, alpha, width) => {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(j.jx, j.jy);
      ctx.lineTo(j.ex, j.ey);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Far side first, faded
    limb(hx, hy, farLeg, 0.35, 3);
    limb(sx, sy, farArm, 0.35, 3.5);

    // Bulky torso
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    limb(hx, hy, nearLeg, 1, 3);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(nearLeg.ex, nearLeg.ey);
    ctx.lineTo(nearLeg.ex + d * 7, nearLeg.ey);
    ctx.stroke();

    // Near arm, long and heavy
    ctx.strokeStyle = c.ink;
    ctx.fillStyle = c.ink;
    limb(sx, sy, nearArm, 1, 4);
    if (reachT > 0.5) {
      const ang = Math.atan2(nearArm.ey - nearArm.jy, nearArm.ex - nearArm.jx);
      const open = reached ? 0.25 : 0.65;
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(nearArm.ex, nearArm.ey);
        ctx.lineTo(nearArm.ex + Math.cos(ang + s * open) * 8, nearArm.ey + Math.sin(ang + s * open) * 8);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.arc(nearArm.ex, nearArm.ey, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Red armor plates on shoulder and hip, like the lab logo
    for (const [x, y, r] of [
      [sx, sy, 6.5],
      [hx, hy, 5],
    ]) {
      ctx.fillStyle = ARMOR;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Neck, then the head on top of everything else
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    drawHead(headX, headY, c);

    ctx.fillStyle = c.ink;
    for (const j of [nearArm, nearLeg]) {
      ctx.beginPath();
      ctx.arc(j.jx, j.jy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (readout) {
      const err = Math.hypot(nearArm.ex - target.x, nearArm.ey - target.y);
      const v = leap.air ? leap.vx : bot.v;
      const mode = leap.air ? "leap" : bot.run > 0.5 ? "running" : bot.rear > 0.5 ? "biped" : bot.reach > 0.5 ? "tripod" : "quadruped";
      readout.textContent = `‖e‖ ${err.toFixed(1)} px · v ${(v / 100).toFixed(2)} m/s · ${mode}`;
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
  // Hold to run, release to leap
  canvas.addEventListener("pointerdown", (e) => {
    onPointer(e);
    holding = true;
  });
  window.addEventListener("pointerup", () => {
    if (!holding) return;
    holding = false;
    jump();
  });
  window.addEventListener("pointercancel", () => {
    holding = false;
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);
  requestAnimationFrame(loop);
})();
