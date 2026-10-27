// Career journey map under the bio, told with cute versions of the robots of each stop.
// From Hanyang to KIST, ALICE (adult-size soccer humanoid) dribbles a ball, its stereo camera's
// field of view nodding as it walks, with guide robots ABLE and ERICA plus the little companion
// robot EDIE tagging along behind; they fade away at KIST. There ALICE becomes the wheeled-legged
// robot, which drives and then walks on point feet, leaps the Pacific and lands as a Unitree G1
// for the last stretch to NC State. It sets off the first time the map scrolls into view;
// click a stop to send it there. Walking feet stay planted on the road.
(function () {
  const canvas = document.getElementById("loco-journey");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STOPS = [
    {
      at: 0.1,
      robot: "alice",
      name: "Hanyang Univ.",
      short: "HYU",
      note: "M.S. · 2020–22",
      year: "2020–22",
      brand: { light: "#003c71", dark: "#59b7e8" },
    },
    {
      at: 0.42,
      robot: "wl",
      name: "KIST",
      short: "KIST",
      note: "Humanoid Robotics Lab · 2023–25",
      year: "2023–25",
      brand: { light: "#ff7e55", dark: "#ff7e55" },
    },
    {
      at: 0.92,
      robot: "g1",
      name: "NC State",
      short: "NC State",
      note: "Ph.D. · HIER Lab · 2025–",
      year: "2025–",
      brand: { light: "#cc0000", dark: "#ff5a5f" },
    },
  ];
  // Widen the Pacific symmetrically so both land gaps shrink without moving any career stop.
  const SHORE_KR = 0.645;
  const SHORE_US = 0.765;

  const H = 156; // css px, with headroom for the enlarged robots' leap
  const ROAD_Y = 106;
  const SCALE = 0.6; // robot model -> css px
  const PROP_SCALE = SCALE / 0.4; // keep the ball and goal proportional to the robots
  // Chibi proportions: short legs, big heads
  const THIGH = 26;
  const SHIN = 26;
  const TORSO = 30;
  // Same arm length on every humanoid
  const UPPER_ARM = 20;
  const FOREARM = 18;
  const PELVIS_H = 44;
  // Walking speed and gait period per robot; strides stay within the legs' reach
  const GAIT = {
    alice: { speed: 52, period: 0.67 },
    wl: { speed: 48, period: 0.67 },
    g1: { speed: 60, period: 0.6 },
  };
  const DRIVE_SPEED = 100; // css px/s
  const SKATE_SPEED = 75;
  const SKATE_PERIOD = 0.93; // s per left-right push cycle
  const PAUSE = 1;
  const LEAP_T = 1.5;
  const SWAP_T = 1.2;

  let W = 0;
  const bot = {
    x: 0,
    dir: 1,
    stop: 0,
    visited: 0,
    robot: "alice",
    moves: [],
    wave: 0,
    swap: 0,
    swapFrom: null,
    kick: 0,
  };
  const ball = { x: 0, v: 0, on: false, alpha: 0, scored: 0 };
  // A goal just short of wherever ALICE is dribbling to (KIST on the way out, Hanyang on the
  // way back), its mouth facing her; it comes and goes with the ball
  const goal = { x: 0, dir: 1 };
  // Hanyang lab-mates that follow ALICE, with the floating WHALE robot above the group.
  const SHOW_WHALE = false;
  const crew = [
    ...(SHOW_WHALE ? [{ kind: "whale", gap: 134, x: 0, v: 0 }] : []),
    { kind: "able", gap: 46, x: 0, v: 0 },
    { kind: "erica", gap: 91, x: 0, v: 0 },
    { kind: "edie", gap: 132, x: 0, v: 0 },
  ];
  let crewAlpha = 1;
  let lineupAlpha = 0;
  let started = false;
  let hover = -1;
  let fade = 1; // overall opacity of the robot being drawn (mid-air crossfade)
  let last = performance.now();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const oldW = W;
    W = canvas.parentElement.clientWidth;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = oldW ? W / oldW : 1;
    for (const m of crew) m.x = oldW ? m.x * k : STOPS[0].at * W - m.gap;
    if (!bot.moves.length) {
      bot.x = restingX(bot.stop);
      return;
    }
    // Mid-journey: stretch the queued route with the page so the robot still ends at its stop
    bot.x *= k;
    ball.x *= k;
    for (const m of bot.moves) {
      m.from *= k;
      m.to *= k;
    }
  }

  function colors() {
    const s = getComputedStyle(document.documentElement);
    return {
      ink: s.getPropertyValue("--global-text-color").trim() || "#000",
      light: s.getPropertyValue("--global-text-color-light").trim() || "#888",
      faint: s.getPropertyValue("--global-divider-color").trim() || "#ddd",
      accent: s.getPropertyValue("--global-theme-color").trim() || "#0076df",
      bg: s.getPropertyValue("--global-bg-color").trim() || "#fff",
    };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (s) => s * s * (3 - 2 * s);

  // At NC State, G1 stops just before the marker, leaving a small workspace on its right.
  function restingX(i) {
    const markerX = STOPS[i].at * W;
    if (i !== STOPS.length - 1) return markerX;
    return Math.max(18, markerX - 30);
  }

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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  // ---- Route -------------------------------------------------------------------------------

  // Queue the moves from the current stop to stop j, with the right robot on each stretch
  function goTo(j) {
    if (j === bot.stop && !bot.moves.length) return;
    const moves = [];
    let x = bot.x;
    const dirStep = j > bot.stop ? 1 : -1;
    for (let k = bot.stop + dirStep; dirStep > 0 ? k <= j : k >= j; k += dirStep) {
      const from = STOPS[k - dirStep];
      const to = STOPS[k];
      const tx = to.at * W;
      const arrivalX = dirStep > 0 && k === STOPS.length - 1 ? restingX(k) : tx;
      if (from.robot === "alice" || to.robot === "alice") {
        // Hanyang <-> KIST: ALICE walks, dribbling the ball on the way out
        if (from.robot !== "alice") moves.push({ kind: "swap", robot: "alice", from: x, to: x });
        moves.push({ kind: "walk", robot: "alice", from: x, to: tx, ball: dirStep > 0 });
        if (to.robot !== "alice") moves.push({ kind: "swap", robot: to.robot, from: tx, to: tx });
      } else {
        // KIST <-> NC State: wheeled-legged on the Korean side, G1 on the US side
        const kr = SHORE_KR * W;
        const us = SHORE_US * W;
        if (dirStep > 0) {
          // Drive, then walk on point feet, then skate up to the shore, distances 1 : 1.5 : 2
          const a = lerp(x, kr, 1 / 4.5);
          const b = lerp(x, kr, 2.5 / 4.5);
          moves.push({ kind: "drive", robot: "wl", from: x, to: a });
          moves.push({ kind: "walk", robot: "wl", from: a, to: b });
          moves.push({ kind: "skate", robot: "wl", from: b, to: kr });
          moves.push({ kind: "leap", robot: "wl", next: "g1", from: kr, to: us });
          moves.push({ kind: "walk", robot: "g1", from: us, to: arrivalX });
        } else {
          const a = lerp(kr, tx, 2 / 4.5);
          const b = lerp(kr, tx, 3.5 / 4.5);
          moves.push({ kind: "walk", robot: "g1", from: x, to: us });
          moves.push({ kind: "leap", robot: "g1", next: "wl", from: us, to: kr });
          moves.push({ kind: "skate", robot: "wl", from: kr, to: a });
          moves.push({ kind: "walk", robot: "wl", from: a, to: b });
          moves.push({ kind: "drive", robot: "wl", from: b, to: tx });
        }
      }
      moves.push({ kind: "pause", robot: to.robot, from: arrivalX, to: arrivalX, stop: k });
      x = arrivalX;
    }
    for (const m of moves) {
      m.t = 0;
      const dist = Math.abs(m.to - m.from);
      if (m.kind === "walk") m.T = Math.max(0.05, dist / GAIT[m.robot].speed);
      else if (m.kind === "drive") m.T = Math.max(0.05, dist / DRIVE_SPEED);
      else if (m.kind === "skate") m.T = Math.max(0.05, dist / SKATE_SPEED);
      else if (m.kind === "swap") m.T = SWAP_T;
      else m.T = m.kind === "leap" ? LEAP_T : PAUSE;
    }
    // Carry each boundary pose into the next locomotion mode so feet, wheels, and body lean
    // continue from the preceding frame instead of restarting from a hard-coded stance.
    for (let i = 1; i < moves.length; i++) {
      const prev = moves[i - 1];
      const m = moves[i];
      if (prev.kind === "drive" && m.kind === "walk" && prev.robot === m.robot) {
        // Arrive at the walking speed instead of halving the body's velocity in one frame.
        // With constant deceleration, distance = average speed * time.
        prev.exitSpeed = GAIT[m.robot].speed;
        prev.T = (2 * Math.abs(prev.to - prev.from)) / (DRIVE_SPEED + prev.exitSpeed);
        const d = prev.to >= prev.from ? 1 : -1;
        const wheelAngle = (d * prev.to) / (MAHRU_WHEEL * SCALE);
        m.entryPose = {
          source: "drive",
          feet: [
            { x: 5, y: 0 },
            { x: -5, y: 0 },
          ],
          lean: 0.09 + 0.015 * Math.sin((Math.PI * 2 * prev.T) / 1.1),
          wheelAngle: Math.atan2(Math.sin(wheelAngle), Math.cos(wheelAngle)),
        };
      } else if (prev.kind === "walk" && m.kind === "skate" && prev.robot === m.robot) {
        m.entryPose = {
          source: "walk",
          feet: walkingFeetAt(prev, prev.T, prev.to),
          pelvisY: -52 + bob(prev, "wl", prev.T),
          lean: 0.04,
          arms: locomotionArms(prev, prev.T),
        };
      }
    }
    bot.moves = moves;
  }

  function step(dt) {
    bot.wave = Math.max(0, bot.wave - dt);
    bot.swap = Math.max(0, bot.swap - dt);
    if (bot.swap === 0) bot.swapFrom = null;
    bot.kick = Math.max(0, bot.kick - dt);
    ball.alpha = clamp(ball.alpha + (ball.on ? dt : -dt) * 4, 0, 1);

    // The crew sticks with ALICE and fades away once she has moved on to KIST
    crewAlpha = clamp(crewAlpha + (bot.robot === "alice" ? dt : -dt) * 2, 0, 1);
    for (const m of crew) {
      const target = bot.x - bot.dir * m.gap;
      if (crewAlpha === 0) m.x = target;
      const xPrev = m.x;
      m.x += (target - m.x) * Math.min(1, dt * 3);
      m.v = (m.x - xPrev) / dt;
    }

    // Once the full journey is complete, bring the robots from each chapter back as a
    // quiet standing lineup. Leaving NC State fades the lineup away again.
    const lineupOn = started && bot.stop === STOPS.length - 1 && bot.moves.length === 0;
    lineupAlpha = clamp(lineupAlpha + (lineupOn ? dt : -dt) * 2.4, 0, 1);

    if (ball.scored && performance.now() - ball.scored > 1500) ball.on = false;

    const m = bot.moves[0];
    if (!m) return;
    if (m.t === 0) {
      // A robot change outside a leap gets a little puff to cover the swap
      if (m.robot !== bot.robot && m.kind !== "leap") {
        bot.swapFrom = bot.robot;
        bot.swap = SWAP_T;
        bot.robot = m.robot;
      }
      if (m.kind === "walk" && m.robot === "alice") {
        const dir = m.to >= m.from ? 1 : -1;
        goal.dir = dir;
        goal.x = m.to - dir * 24 * PROP_SCALE;
        ball.on = true;
        ball.x = m.from + dir * 16 * PROP_SCALE;
        ball.v = 0;
        ball.scored = 0;
      }
      if (m.robot !== "alice") ball.on = false;
    }
    m.t += dt;
    if (m.kind !== "pause") bot.dir = m.to >= m.from ? 1 : -1;
    const done = m.t >= m.T;
    let travel = m.t / m.T;
    if (!done && m.kind === "drive" && m.exitSpeed) {
      // Constant deceleration makes both position and velocity continuous at drive -> walk.
      const acceleration = (m.exitSpeed - DRIVE_SPEED) / m.T;
      const distance = Math.abs(m.to - m.from);
      travel = (DRIVE_SPEED * m.t + 0.5 * acceleration * m.t * m.t) / distance;
    }
    bot.x = done ? m.to : lerp(m.from, m.to, travel);

    // Dribbling: the ball rolls out and slows; when ALICE catches up she kicks it again, until
    // it ends up in the net
    if (ball.on && !ball.scored) {
      const gd = goal.dir;
      ball.v = Math.max(0, ball.v - 110 * dt);
      ball.x += gd * ball.v * dt;
      if (gd * (ball.x - goal.x) >= -4 * PROP_SCALE) {
        ball.x = goal.x + gd * 3 * PROP_SCALE;
        ball.scored = performance.now();
        ball.v = 0;
      } else if (m.kind === "walk" && m.robot === "alice" && gd * (bot.x - ball.x) > -11 * PROP_SCALE && ball.v < 25 && !done) {
        ball.v = 125;
        bot.kick = 0.28;
      }
    }

    if (done) {
      if (m.kind === "leap") bot.robot = m.next;
      if (m.kind === "pause") {
        bot.stop = m.stop;
        bot.visited = Math.max(bot.visited, m.stop);
        if (m.stop === STOPS.length - 1) bot.wave = 1.6;
        if (bot.robot !== "alice") ball.on = false;
      }
      bot.moves.shift();
    }
  }

  // Planted feet for the current walk, relative to the pelvis in model units
  function walkingFeetAt(m, t, bodyPosition) {
    const g = GAIT[m.robot];
    const d = m.to >= m.from ? 1 : -1;
    const stride = g.speed * g.period;
    const bodyX = (t) => m.from + g.speed * d * clamp(t, 0, m.T);
    return [0, 1].map((i) => {
      const off = (i * g.period) / 2;
      const tau = t + off;
      const k = Math.floor(tau / g.period);
      const c = tau - k * g.period;
      const plant = (n) => bodyX(n * g.period - off) + (d * stride) / 4;
      let x;
      let y = 0;
      if (c < g.period / 2) x = plant(k);
      else {
        const s = (c - g.period / 2) / (g.period / 2);
        x = lerp(plant(k), plant(k + 1), s);
        y = -Math.sin(Math.PI * s) * 4;
      }
      return { x: (x - bodyPosition) / SCALE, y: y / SCALE };
    });
  }

  function plantedFeet(m) {
    return walkingFeetAt(m, m.t, bot.x);
  }

  // ---- Map ---------------------------------------------------------------------------------

  function drawMap(c, now) {
    const kr = SHORE_KR * W;
    const us = SHORE_US * W;
    ctx.strokeStyle = c.faint;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (const [a, b] of [
      [0, kr],
      [us, W],
    ]) {
      ctx.beginPath();
      ctx.moveTo(a, ROAD_Y + 0.5);
      ctx.lineTo(b, ROAD_Y + 0.5);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let x = kr; x <= us; x += 2) ctx.lineTo(x, ROAD_Y + 2 + Math.sin(x / 8 + now / 500) * 2.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.light;
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("~ Pacific ~", (kr + us) / 2, ROAD_Y + 20);

    // Soccer goal in profile, mouth facing ALICE: posts, crossbar and a grid net
    if (ball.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = ball.alpha;
      ctx.translate(goal.x, ROAD_Y);
      ctx.scale(goal.dir * PROP_SCALE, PROP_SCALE);
      ctx.strokeStyle = c.light;
      ctx.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-6 + i * 3, -16);
        ctx.lineTo(-6 + i * 3 + 4, 0);
        ctx.stroke();
      }
      // Cross strands complete the net instead of leaving a one-way hatch.
      for (let y = -12; y <= -4; y += 4) {
        ctx.beginPath();
        ctx.moveTo(-6, y);
        ctx.lineTo(10 + y / 4, y);
        ctx.stroke();
      }
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(-6, -16);
      ctx.lineTo(6, -16);
      ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Institution colors tie each stop marker to its school name; secondary copy stays neutral.
    const narrow = W < 520;
    const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    STOPS.forEach((s, i) => {
      const x = s.at * W;
      const on = i <= bot.visited && started;
      const brand = s.brand[theme];
      ctx.strokeStyle = brand;
      ctx.fillStyle = on ? brand : c.bg;
      ctx.lineWidth = i === hover ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(x, ROAD_Y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = i === STOPS.length - 1 ? "right" : "center";
      const tx = i === STOPS.length - 1 ? x + 6 : x;
      ctx.fillStyle = brand;
      ctx.font = "600 11px sans-serif";
      ctx.fillText(narrow ? s.short : s.name, tx, ROAD_Y + 34);
      ctx.fillStyle = c.light;
      ctx.font = "10px sans-serif";
      ctx.fillText(narrow ? s.year : s.note, tx, ROAD_Y + 47);
    });
    ctx.textAlign = "left";
  }

  // Classic soccer ball: white, a black pentagon in the middle and five patches around the
  // edge, the whole pattern turning as it rolls
  function drawBall(c) {
    if (ball.alpha <= 0) return;
    const r = 5.5 * PROP_SCALE;
    const cx = ball.x;
    const cy = ROAD_Y - r;
    const roll = ball.x / r;
    const pent = (x, y, size, rot) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.save();
    ctx.globalAlpha = ball.alpha;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = "#1a1a1a";
    pent(cx, cy, r * 0.36, roll);
    for (let i = 0; i < 5; i++) {
      const a = roll + (i * Math.PI * 2) / 5 - Math.PI / 2;
      pent(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, r * 0.32, roll + Math.PI / 5);
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ball.alpha;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = PROP_SCALE;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // "GOAL!" pops up over the net for a moment
    const since = ball.scored ? (performance.now() - ball.scored) / 1000 : 9;
    if (since < 1.2) {
      ctx.globalAlpha = 1 - since / 1.2;
      ctx.fillStyle = c.accent;
      ctx.font = `700 ${11 * PROP_SCALE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("GOAL!", goal.x + goal.dir * 2 * PROP_SCALE, ROAD_Y - (22 + since * 10) * PROP_SCALE);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }

  // ---- Main robots -------------------------------------------------------------------------

  // Shared chibi rig, in model units with the pelvis at x = 0 and the ground at y = 0.
  // Each robot supplies its feet, leg ends (feet or wheels), torso and head.
  function rig(c, o) {
    const d = bot.dir;
    // Robots can override the shared chibi segment lengths with their own proportions
    const thigh = o.thigh || THIGH;
    const shin = o.shin || SHIN;
    const torso = o.torsoLen || TORSO;
    const upper = o.upper || UPPER_ARM;
    const fore = o.fore || FOREARM;
    const py = o.pelvisY;
    const rigidUpper = Boolean(o.rigidUpper);
    const outlineColor = o.outline || c.ink;
    const sx = rigidUpper ? 0 : d * Math.sin(o.lean) * torso;
    const sy = rigidUpper ? py - torso : py - Math.cos(o.lean) * torso;
    ctx.strokeStyle = outlineColor;
    ctx.fillStyle = c.ink;

    // Some robots carry their complete upper-body kinematic tree with the torso lean.
    const upperBody = (draw) => {
      if (!rigidUpper) {
        draw();
        return;
      }
      ctx.save();
      ctx.translate(0, py);
      ctx.rotate(d * o.lean);
      ctx.translate(0, -py);
      draw();
      ctx.restore();
    };

    // An outlined limb, each segment in its own colour (or plain ink)
    const limb = (pts, width, segColors) => {
      ctx.lineWidth = segColors ? width + 2 : width;
      ctx.strokeStyle = outlineColor;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      if (!segColors) return;
      ctx.lineWidth = width - 1;
      for (let i = 0; i < pts.length - 1; i++) {
        ctx.strokeStyle = segColors[i];
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        ctx.stroke();
      }
      ctx.strokeStyle = outlineColor;
    };

    const leg = (f, alpha, showFoot = true) => {
      const end = o.legEnd(f);
      const k = twoLink(0, py, end.x, end.y, thigh, shin, -d);
      ctx.globalAlpha = fade * alpha;
      limb(
        [
          [0, py],
          [k.jx, k.jy],
          [k.ex, k.ey],
        ],
        o.limb,
        o.legColors
      );
      if (showFoot) o.foot(k, f);
      if (o.actuators) {
        ctx.fillStyle = c.bg;
        ctx.beginPath();
        ctx.arc(k.jx, k.jy, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = c.ink;
      }
    };
    const arm = ([u, f], alpha) => {
      const ex = sx + d * Math.sin(u) * upper;
      const ey = sy + Math.cos(u) * upper;
      ctx.globalAlpha = fade * alpha;
      limb(
        [
          [sx, sy + 4],
          [ex, ey],
          [ex + d * Math.sin(f) * fore, ey + Math.cos(f) * fore],
        ],
        o.limb - 1,
        o.armColors
      );
    };
    // When side-view feet overlap, the faded rear foot otherwise reads as a false sole under
    // the front one. Let the front foot occlude it just as it would in a solid drawing.
    const footOverlap = o.occludeFarFoot && Math.abs(o.feet[0].x - o.feet[1].x) < o.occludeFarFoot && Math.abs(o.feet[0].y - o.feet[1].y) < 5;
    // Far arm and leg first, faded
    upperBody(() => arm(o.arms[1], 0.4));
    leg(o.feet[1], 0.4, !footOverlap);
    leg(o.feet[0], 1);
    ctx.globalAlpha = fade;
    upperBody(() => o.torso(sx, sy, py));
    upperBody(() => arm(o.arms[0], 1));
    ctx.globalAlpha = fade;
    upperBody(() => o.head(sx, sy));
  }

  // Base locomotion swing. Kept separate so a mode change can inherit the preceding pose.
  function locomotionArms(m, t = m ? m.t : 0) {
    const walking = m && m.kind === "walk";
    const skating = m && m.kind === "skate";
    const g = m && GAIT[m.robot];
    const swing = walking ? 0.4 * Math.sin((Math.PI * 2 * t) / g.period) : skating ? 0.32 * Math.cos((Math.PI * 2 * t) / SKATE_PERIOD) : 0;
    return [1, -1].map((side) => {
      let u = side * swing + 0.15 * side;
      const f = u + (skating ? 0.38 : 0.3);
      return [u, f];
    });
  }

  // Arm swing against the legs while walking, up in the air, a wave on arrival. [near, far]
  function armPose(m, air, now) {
    let arms = locomotionArms(m);
    if (m && m.kind === "skate" && m.entryPose) {
      const q = smooth(clamp(m.t / (SKATE_PERIOD / 2), 0, 1));
      arms = arms.map((arm, i) => [lerp(m.entryPose.arms[i][0], arm[0], q), lerp(m.entryPose.arms[i][1], arm[1], q)]);
    }
    arms = arms.map(([u0, f0], i) => {
      const side = i === 0 ? 1 : -1;
      let u = u0;
      let f = f0;
      if (air) {
        u = lerp(u, 2.6 + 0.2 * side, air);
        f = lerp(f, 2.8 + 0.2 * side, air);
      }
      return [u, f];
    });
    if (bot.wave > 0) {
      const w = Math.min(1, bot.wave * 3);
      arms[0] = [lerp(arms[0][0], 2.6, w), lerp(arms[0][1], 2.9 + 0.45 * Math.sin(now / 110), w)];
    }
    return arms;
  }

  function legFeet(m, air) {
    if (air) return [0, 1].map((i) => ({ x: bot.dir * (i ? -6 : 6), y: -26 * air }));
    if (m && m.kind === "walk" && m.inPlace) {
      return [0, 1].map((i) => {
        const phase = (m.t / GAIT[m.robot].period + i * 0.5) % 1;
        if (phase < 0.5) {
          return { x: lerp(7, -7, smooth(phase * 2)), y: 0 };
        }
        const s = smooth((phase - 0.5) * 2);
        return { x: lerp(-7, 7, s), y: -Math.sin(Math.PI * s) * 7 };
      });
    }
    if (m && m.kind === "walk" && m.robot === bot.robot) return plantedFeet(m);
    return [
      { x: 5, y: 0 },
      { x: -5, y: 0 },
    ];
  }

  function bob(m, robot, t = m ? m.t : 0) {
    return m && m.kind === "walk" ? 2.5 * Math.abs(Math.sin((Math.PI * 2 * t) / GAIT[robot].period)) : 0;
  }

  const ALICE = { shell: "#f4f4f2", dark: "#292b2e", lens: "#d7eef6" };

  // ALICE: wide boxy head with a visor holding a stereo camera, sturdy chest, big flat feet.
  // The camera's field of view nods up and down as she walks; she kicks with her near foot.
  function drawAlice(c, m, air, now) {
    const d = bot.dir;
    const walking = m && m.kind === "walk";
    const feet = legFeet(m, air);
    if (bot.kick > 0) {
      const k = Math.sin((Math.PI * bot.kick) / 0.28);
      feet[0] = { x: d * (10 + 16 * k), y: -10 * k };
    }
    const pitch = walking ? 0.45 + 0.3 * Math.sin(now / 380) : 0.35 + 0.08 * Math.sin(now / 900);
    rig(c, {
      pelvisY: -PELVIS_H + bob(m, "alice"),
      lean: 0.05,
      shin: SHIN - 5,
      limb: 8,
      outline: ALICE.dark,
      occludeFarFoot: 16,
      legColors: [ALICE.shell, ALICE.shell],
      armColors: [ALICE.shell, ALICE.shell],
      feet,
      legEnd: (f) => ({ x: f.x, y: f.y - 5 }),
      foot: (k, f) => {
        ctx.save();
        // Preserve ALICE's original flat foot, clipping only the sub-ground antialiasing.
        ctx.beginPath();
        ctx.rect(k.ex - 20, f.y - 10, 40, 10);
        ctx.clip();
        ctx.fillStyle = ALICE.shell;
        ctx.strokeStyle = ALICE.dark;
        ctx.lineWidth = 1.5;
        const fx = k.ex - 6 - (d > 0 ? 0 : 6);
        const fy = f.y - 6;
        roundRect(fx, fy, 18, 6, 3);
        ctx.fill();
        // Outline the upper shell only. A bottom stroke reads as an added sole at this scale.
        ctx.beginPath();
        ctx.moveTo(fx, f.y - 1);
        ctx.lineTo(fx, fy + 3);
        ctx.quadraticCurveTo(fx, fy, fx + 3, fy);
        ctx.lineTo(fx + 15, fy);
        ctx.quadraticCurveTo(fx + 18, fy, fx + 18, fy + 3);
        ctx.lineTo(fx + 18, f.y - 1);
        ctx.stroke();
        ctx.restore();
      },
      arms: armPose(m, air, now),
      torso: (sx, sy, py) => {
        ctx.fillStyle = ALICE.shell;
        ctx.strokeStyle = ALICE.dark;
        ctx.lineWidth = 1.5;
        roundRect(sx - 13, sy - 2, 26, py - sy + 8, 7);
        ctx.fill();
        ctx.stroke();
      },
      head: (sx, sy) => {
        const hx = sx + d * 2;
        const hy = sy - 18;
        // Field of view from the camera, pitching up and down. The finale hides it so the
        // standing lineup stays visually quiet.
        if (!m || !m.hideFov) {
          const ex = hx + d * 14;
          const ang = d > 0 ? pitch : Math.PI - pitch;
          const len = 130;
          ctx.fillStyle = c.accent;
          ctx.globalAlpha = fade * 0.14;
          ctx.beginPath();
          ctx.moveTo(ex, hy);
          ctx.lineTo(ex + Math.cos(ang - 0.32) * len, hy + Math.sin(ang - 0.32) * len);
          ctx.lineTo(ex + Math.cos(ang + 0.32) * len, hy + Math.sin(ang + 0.32) * len);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = fade;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(d * (pitch - 0.35) * 0.6);
        ctx.fillStyle = ALICE.shell;
        ctx.strokeStyle = ALICE.dark;
        ctx.lineWidth = 1.5;
        roundRect(-17, -14, 34, 28, 8);
        ctx.fill();
        ctx.stroke();
        // Visor with the stereo camera pair
        ctx.fillStyle = ALICE.dark;
        roundRect(d > 0 ? -3 : -17, -6, 20, 12, 5);
        ctx.fill();
        ctx.fillStyle = ALICE.lens;
        for (const ox of [3.5, 10.5]) {
          ctx.beginPath();
          ctx.arc(d * ox, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },
    });
  }

  // MAHRU-WL (KIST), drawn to match ALICE's proportions: wheels at the ends of the shins,
  // a one-piece silver body with a copper front panel and a titanium-blue battery on the back,
  // silver thighs with dark knee covers, metallic-blue shins, and a chrome head whose white
  // face panel carries two blinking eyes under a black camera strip. Driving, the knees bend
  // and the wheels spin; walking on point feet, the wheels lock; skating, it leans in and
  // pushes off one leg at a time.
  const MAHRU = {
    silver: "#a8a9ad",
    chrome: "#d7d9dc",
    copper: "#d07a3b",
    battery: "#5a7894",
    blue: "#32527a",
    dark: "#1d2130",
    steel: "#8c9196",
    tire: "#2b2b2b",
  };
  const MAHRU_WHEEL = 9;

  function drawWheeled(c, m, air, now) {
    const d = bot.dir;
    const driving = m && m.kind === "drive";
    const walking = m && m.kind === "walk";
    const skating = m && m.kind === "skate";
    const driveEntry = walking && m.entryPose && m.entryPose.source === "drive";
    const driveWalkRamp = driveEntry ? smooth(clamp(m.t / (GAIT.wl.period / 2), 0, 1)) : 1;
    let feet = legFeet(m, air);
    if (driving) {
      feet = [
        { x: 5, y: 0 },
        { x: -5, y: 0 },
      ];
    }
    if (driveEntry && m.t < GAIT.wl.period / 2) {
      const halfStep = GAIT.wl.period / 2;
      const bodyAtHalf = m.from + GAIT.wl.speed * d * halfStep;
      const targetFeet = walkingFeetAt(m, halfStep, bodyAtHalf);
      feet = [
        {
          x: lerp(m.entryPose.feet[0].x, targetFeet[0].x, driveWalkRamp),
          y: lerp(m.entryPose.feet[0].y, targetFeet[0].y, driveWalkRamp),
        },
        {
          x: lerp(m.entryPose.feet[1].x, targetFeet[1].x, driveWalkRamp),
          y: -Math.sin(Math.PI * driveWalkRamp) * (4 / SCALE),
        },
      ];
    }
    if (skating) {
      const halfStep = SKATE_PERIOD / 2;
      if (m.entryPose && m.t < halfStep) {
        // Continue directly from the last walking frame: the near/right foot makes the first
        // recovery arc while the far foot rolls back. At half a cycle this meets the regular
        // skating gait exactly, so there is no second seam.
        const s = smooth(clamp(m.t / halfStep, 0, 1));
        feet = [
          { x: lerp(m.entryPose.feet[0].x, d * 8, s), y: -Math.sin(Math.PI * s) * 16 },
          { x: lerp(m.entryPose.feet[1].x, -d * 20, s), y: 0 },
        ];
      } else {
        // Alternate a grounded push with an airborne recovery. While one wheel rolls backward
        // relative to the body, the other follows a smooth arc to the next contact point.
        feet = [0, 1].map((i) => {
          // The near/right foot (index 0) takes the first swing so the lift reads clearly.
          const phase = (m.t / SKATE_PERIOD + (i === 0 ? 0.5 : 0)) % 1;
          if (phase < 0.5) {
            const s = smooth(phase * 2);
            return { x: lerp(d * 8, -d * 20, s), y: 0 };
          }
          const s = smooth((phase - 0.5) * 2);
          return {
            x: lerp(-d * 20, d * 8, s),
            y: -Math.sin(Math.PI * s) * 16,
          };
        });
      }
    }
    const rolling = driving || skating;
    const roll = bot.x / (MAHRU_WHEEL * SCALE);
    const skateLeanPulse = skating ? Math.abs(Math.sin((Math.PI * 2 * m.t) / SKATE_PERIOD)) : 0;
    const skateRamp = skating ? smooth(clamp(m.t / (SKATE_PERIOD / 2), 0, 1)) : 1;
    const bodyLean = skating
      ? lerp(m.entryPose ? m.entryPose.lean : 0.04, 0.18 + 0.1 * skateLeanPulse, skateRamp)
      : driving
        ? 0.09 + 0.015 * Math.sin((Math.PI * 2 * m.t) / 1.1)
        : driveEntry
          ? lerp(m.entryPose.lean, 0.04, driveWalkRamp)
          : 0.04;
    const outline = () => {
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    rig(c, {
      pelvisY: skating ? lerp(m.entryPose ? m.entryPose.pelvisY : -52, -45, skateRamp) : -52 + bob(m, "wl"),
      lean: bodyLean,
      rigidUpper: true,
      torsoLen: 31,
      limb: 7,
      legColors: [MAHRU.silver, MAHRU.blue],
      armColors: [MAHRU.silver, MAHRU.dark],
      feet,
      // The shin ends at the wheel hub, one wheel radius above the contact point
      legEnd: (f) => ({ x: f.x, y: f.y - MAHRU_WHEEL }),
      foot: (k) => {
        // Dark knee cover
        ctx.fillStyle = MAHRU.dark;
        ctx.beginPath();
        ctx.arc(k.jx, k.jy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Main wheel: dark tyre, silver hub, a spoke that spins while rolling
        ctx.beginPath();
        ctx.arc(k.ex, k.ey, MAHRU_WHEEL, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = MAHRU.silver;
        ctx.beginPath();
        ctx.arc(k.ex, k.ey, 4, 0, Math.PI * 2);
        ctx.fill();
        let a = rolling ? d * roll : -Math.PI / 2;
        if (driveEntry) {
          const target = -Math.PI / 2;
          const delta = Math.atan2(Math.sin(target - m.entryPose.wheelAngle), Math.cos(target - m.entryPose.wheelAngle));
          a = m.entryPose.wheelAngle + delta * driveWalkRamp;
        }
        ctx.strokeStyle = MAHRU.silver;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(k.ex + Math.cos(a) * 4, k.ey + Math.sin(a) * 4);
        ctx.lineTo(k.ex + Math.cos(a) * 8, k.ey + Math.sin(a) * 8);
        ctx.stroke();
        ctx.strokeStyle = c.ink;
        ctx.fillStyle = c.ink;
      },
      arms: armPose(m, air, now),
      torso: (sx, sy, py) => {
        const h = py - sy + 6;
        // Battery pack on the back
        ctx.fillStyle = MAHRU.battery;
        roundRect(d > 0 ? sx - 17 : sx + 8, sy + 5, 9, h * 0.5, 3);
        ctx.fill();
        outline();
        // One-piece silver body, like ALICE's, with the copper panel down the front
        ctx.fillStyle = MAHRU.silver;
        roundRect(sx - 11, sy - 2, 22, h, 9);
        ctx.fill();
        outline();
        ctx.fillStyle = MAHRU.copper;
        roundRect(d > 0 ? sx + 7.5 : sx - 10.5, sy + 4, 3, h * 0.42, 1.5);
        ctx.fill();
      },
      head: (sx, sy) => {
        const hx = sx;
        const hy = sy - 15;
        // Chrome head, rounded, with the white face panel up front; two eyes on the panel
        // make it a face, and they blink now and then
        ctx.fillStyle = MAHRU.chrome;
        roundRect(hx - 14, hy - 12, 28, 24, 11);
        ctx.fill();
        outline();
        ctx.fillStyle = "#f2f2f2";
        roundRect(d > 0 ? hx - 1 : hx - 13, hy - 6, 14, 13, 5);
        ctx.fill();
        outline();
        ctx.fillStyle = "#1a1a1a";
        roundRect(d > 0 ? hx + 1 : hx - 11, hy - 10, 10, 2.5, 1.2);
        ctx.fill();
        const blink = now % 3600 < 150 ? 0.15 : 1;
        for (const ox of [3, 8.5]) {
          ctx.beginPath();
          ctx.ellipse(hx + d * ox, hy + 0.5, 1.7, 2.6 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    });
  }

  // Unitree G1: small round head with a glossy black face visor, two-tone light-grey shells
  // over a dark-grey frame, a backpack hump, ring actuators at the hips and knees, long legs
  // and slim arms
  const G1 = { shell: "#c9ccd1", frame: "#3b3f45", foot: "#6b7076", visor: "#111316", glint: "#7fd3ff" };

  function drawG1(c, m, air, now) {
    const d = bot.dir;
    const outline = () => {
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    const ring = (x, y, r) => {
      ctx.fillStyle = G1.frame;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = G1.shell;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    };
    rig(c, {
      pelvisY: -PELVIS_H + bob(m, "g1"),
      lean: 0.03,
      torsoLen: 29,
      shin: SHIN - 5,
      limb: 7,
      occludeFarFoot: 16,
      legColors: [G1.shell, G1.frame],
      armColors: [G1.shell, G1.frame],
      feet: legFeet(m, air),
      legEnd: (f) => ({ x: f.x, y: f.y - 5 }),
      foot: (k, f) => {
        // Ankle linkage: two thin rods running down behind the shin
        ctx.strokeStyle = G1.frame;
        ctx.lineWidth = 1.5;
        for (const off of [3, 5.5]) {
          ctx.beginPath();
          ctx.moveTo(k.jx - d * off, k.jy + 2);
          ctx.lineTo(k.ex - d * (off - 1), k.ey - 3);
          ctx.stroke();
        }
        ring(k.jx, k.jy, 6);
        // A single solid foot body; no inset panel or outline that can read as a second sole.
        ctx.fillStyle = G1.foot;
        roundRect(k.ex - (d > 0 ? 6 : 14), f.y - 7, 20, 7, 2.5);
        ctx.fill();
      },
      arms: armPose(m, air, now),
      torso: (sx, sy, py) => {
        const h = py - sy;
        // Backpack hump on the back
        ctx.fillStyle = G1.frame;
        roundRect(d > 0 ? sx - 17 : sx + 6, sy + 2, 11, h * 0.55, 5);
        ctx.fill();
        outline();
        // Light chest shell over a narrow dark waist
        ctx.fillStyle = G1.frame;
        roundRect(-6, sy + h * 0.5, 12, h * 0.55, 4);
        ctx.fill();
        ctx.fillStyle = G1.shell;
        roundRect(sx - 11, sy - 2, 22, h * 0.62, 9);
        ctx.fill();
        outline();
        ring(0, py, 7);
        ring(sx, sy + 3, 5);
      },
      head: (sx, sy) => {
        const hx = sx + d * 1;
        const hy = sy - 17;
        // Slim neck, round shell head, glossy visor over the front
        ctx.strokeStyle = G1.frame;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(hx, hy + 6);
        ctx.stroke();
        ctx.fillStyle = G1.shell;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 14, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        outline();
        ctx.fillStyle = G1.visor;
        ctx.beginPath();
        ctx.ellipse(hx + d * 5, hy + 0.5, 9.5, 11.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Two glowing LED eyes in the visor, blinking now and then
        const blink = now % 4100 < 150 ? 0.15 : 1;
        ctx.fillStyle = G1.glint;
        for (const ox of [3, 9]) {
          ctx.beginPath();
          ctx.ellipse(hx + d * ox, hy, 1.8, 3 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      },
    });
  }

  const DRAW = { alice: drawAlice, wl: drawWheeled, g1: drawG1 };

  // ---- Hanyang crew --------------------------------------------------------------------------

  // Real-colour palette for the Hanyang crew, outlined so they read on light and dark pages
  const WHITE = "#f4f4f2";
  const BLACK = "#2b2b2b";

  // ABLE: the HERoEHS guide robot in a gentle three-quarter view — domed projected face,
  // tapered white body, low black mobile base, and an arm-mounted information display.
  function drawAble(c, m, now) {
    const d = bot.dir;
    const sway = 0.3 * Math.sin(now / 600) + clamp(m.v / 250, -0.3, 0.3);
    ctx.save();
    ctx.translate(d * sway * 1.5, 0);

    // Low wheeled base.
    ctx.fillStyle = BLACK;
    roundRect(-21, -14, 42, 14, 6);
    ctx.fill();
    ctx.fillStyle = "#151515";
    for (const x of [-14, 14]) {
      ctx.beginPath();
      ctx.ellipse(x, -3, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ABLE's right arm stays outside the broad shell, like ERICA's visible free arm.
    ctx.save();
    ctx.globalAlpha *= 0.78;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-d * 13, -56);
    ctx.lineTo(-d * 22, -47);
    ctx.lineTo(-d * 21, -33);
    ctx.stroke();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.fillStyle = BLACK;
    roundRect(-d * 21 - 3, -36, 6, 8, 2);
    ctx.fill();
    ctx.restore();

    // Broad tapered shell, kept almost frontal with a small directional offset.
    ctx.fillStyle = WHITE;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-19, -14);
    ctx.lineTo(-11 - d, -58);
    ctx.quadraticCurveTo(d * 2, -65, 12 + d, -58);
    ctx.lineTo(19, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ABLE's dark triangular chest panel, shifted subtly toward the leading side.
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(-7 + d * 2, -59);
    ctx.lineTo(9 + d * 2, -59);
    ctx.lineTo(5 + d * 2, -34);
    ctx.lineTo(d * 2, -43);
    ctx.lineTo(-3 + d * 2, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#666";
    ctx.beginPath();
    ctx.arc(d * 3, -54, 2, 0, Math.PI * 2);
    ctx.fill();
    // Near arm carries a visible, angled information display.
    const ex = d * 16;
    const ey = -46 + sway * 1.5;
    const hx = d * 16;
    const hy = -36 + sway * 1.5;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(d * 10, -56);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.save();
    ctx.scale(d, 1);
    ctx.translate(21, -48 + sway * 1.5);
    ctx.rotate(-0.06);
    ctx.fillStyle = BLACK;
    roundRect(-16, -9, 32, 18, 3);
    ctx.fill();
    ctx.fillStyle = "#d9f0f7";
    roundRect(-13, -6, 26, 12, 1.8);
    ctx.fill();
    // STT display: a live voice waveform on the left becomes short text lines on the right.
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 1.7;
      const amp = 1 + 1.5 * Math.abs(Math.sin(now / 150 + i * 0.9));
      ctx.moveTo(x, -amp);
      ctx.lineTo(x, amp);
    }
    ctx.stroke();
    ctx.fillStyle = "#6f8d98";
    roundRect(2, -3.5, 8.5, 1.3, 0.6);
    ctx.fill();
    roundRect(2, -0.3, 6.5, 1.3, 0.6);
    ctx.fill();
    roundRect(2, 2.9, 9.5, 1.3, 0.6);
    ctx.fill();
    ctx.restore();
    // The black gripper stays visible beneath the screen instead of disappearing into it.
    ctx.fillStyle = BLACK;
    roundRect(hx - 3, hy - 4, 7, 8, 2);
    ctx.fill();

    // Glass dome and projected monkey face: both eyes remain visible, with the nearer eye larger.
    const hyc = -78;
    ctx.fillStyle = "rgba(68, 75, 80, 0.94)";
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, hyc, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.scale(d, 1);
    ctx.fillStyle = "#e3b27a";
    ctx.beginPath();
    ctx.ellipse(3, hyc + 1, 11, 11.5, 0, 0, Math.PI * 2);
    ctx.fill();

    for (const eye of [
      { x: -1.5, r: 2.9, a: 0.72 },
      { x: 6, r: 3.6, a: 1 },
    ]) {
      ctx.globalAlpha *= eye.a;
      ctx.strokeStyle = "#f08a3c";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(eye.x, hyc - 2, eye.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.arc(eye.x + 0.7, hyc - 2, 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha /= eye.a;
    }
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.arc(3.2, hyc + 1.3, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(4, hyc + 3, 3.5, 0.35, Math.PI - 0.35);
    ctx.stroke();
    ctx.restore();

    // A small glass highlight keeps the dome from reading as a flat disk.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-d * 4, hyc - 3, 10, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    // Camera on top of the dome.
    ctx.fillStyle = BLACK;
    roundRect(-3, hyc - 21, 6, 4, 1.5);
    ctx.fill();

    // ABLE's spoken reply: alphabet glyphs ride a soft wave above its head and travel forward.
    ctx.save();
    ctx.scale(d, 1);
    const speechBaseAlpha = ctx.globalAlpha;
    const speechPhase = now / 180;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = speechBaseAlpha * 0.18;
    ctx.beginPath();
    for (let x = 3; x <= 43; x += 2) {
      const y = -104 + Math.sin(x / 5 - speechPhase) * 3;
      if (x === 3) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = c.accent;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const speechDrift = (now / 45) % 40;
    const glyphs = ["A", "b", "C", "…"];
    for (let i = 0; i < glyphs.length; i++) {
      const x = 3 + ((i * 10 + speechDrift) % 40);
      const y = -104 + Math.sin(x / 5 - speechPhase) * 3;
      const edgeFade = Math.sin(((x - 3) / 40) * Math.PI);
      ctx.globalAlpha = speechBaseAlpha * (0.25 + edgeFade * 0.65);
      ctx.fillText(glyphs[i], x, y);
    }
    ctx.restore();
    ctx.restore();
  }

  // ERICA: Hanyang ERICA's humanoid guide robot, with a compact humanoid upper body, a display
  // carried on the left arm, and a black mecanum-wheel base connected by a slim central mast.
  function drawErica(c, m, now) {
    const d = bot.dir;
    const sway = 0.3 * Math.sin(now / 600) + clamp(m.v / 250, -0.3, 0.3);

    // Two visible mecanum wheels, with diagonal rollers.
    for (const x of [-14, 14]) {
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.ellipse(x, -7, 6.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#8295a5";
      ctx.lineWidth = 1.4;
      for (const y of [-11, -7, -3]) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 2);
        ctx.lineTo(x + 4, y + 2);
        ctx.stroke();
      }
    }

    // Trapezoidal black mobile base.
    ctx.fillStyle = BLACK;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-17, -17);
    ctx.lineTo(17, -17);
    ctx.lineTo(21, -2);
    ctx.lineTo(-21, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4d85a4";
    ctx.beginPath();
    ctx.arc(d * 5, -10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Slim central column between the base and humanoid torso.
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(0, -41);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.translate(sway * 1.5, 0);

    const arm = (side, points, alpha) => {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      ctx.lineTo(points[1][0], points[1][1]);
      ctx.lineTo(points[2][0], points[2][1]);
      ctx.stroke();
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.fillStyle = BLACK;
      for (const p of points.slice(0, 2)) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
      roundRect(points[2][0] - 2.5, points[2][1] - 2, 5, 7, 2);
      ctx.fill();
      ctx.restore();
    };

    // Far arm hangs naturally beside the body.
    arm(
      -1,
      [
        [-d * 14, -61],
        [-d * 19, -47],
        [-d * 16, -30],
      ],
      0.45
    );

    // Human-shaped white torso with black shoulder joints.
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, -63);
    ctx.quadraticCurveTo(0, -69, 15, -63);
    ctx.lineTo(9, -39);
    ctx.quadraticCurveTo(0, -35, -9, -39);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = BLACK;
    for (const x of [-14, 14]) {
      ctx.beginPath();
      ctx.arc(x, -61, 4.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#4d85a4";
    ctx.beginPath();
    ctx.arc(d * 5, -57, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Near arm bends forward to support the information display.
    arm(
      1,
      [
        [d * 14, -61],
        [d * 20, -51],
        [d * 13, -43],
      ],
      1
    );
    ctx.save();
    ctx.scale(d, 1);
    ctx.translate(5, -44);
    ctx.rotate(-0.08);
    ctx.fillStyle = BLACK;
    roundRect(-13, -8, 26, 16, 2.5);
    ctx.fill();
    ctx.fillStyle = "#d9f0f7";
    roundRect(-10.5, -5.5, 21, 11, 1.5);
    ctx.fill();
    ctx.restore();

    // Black neck and white helmet shell around the horizontal camera face.
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -64);
    ctx.lineTo(0, -72);
    ctx.stroke();
    ctx.strokeStyle = c.ink;
    ctx.fillStyle = WHITE;
    roundRect(-13, -88, 26, 18, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = BLACK;
    roundRect(-10 + d * 2, -85, 20, 12, 5);
    ctx.fill();
    // Two camera lenses in the dark face panel.
    ctx.fillStyle = "#5f7888";
    for (const x of [-4, 4]) {
      ctx.beginPath();
      ctx.arc(x + d * 2, -79, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#bfe9ff";
      ctx.beginPath();
      ctx.arc(x + d * 2 + 0.5, -79.5, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5f7888";
    }
    // Short rear antenna fins.
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = 2;
    for (const y of [-84, -75]) {
      ctx.beginPath();
      ctx.moveTo(-d * 12, y);
      ctx.lineTo(-d * 17, y - 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  // EDIE: a fluffy white ball with small black panda ears and a black face panel with big
  // yellow glowing eyes that blink, bouncing along.
  function drawEdie(c, m, now) {
    const d = bot.dir;
    const moving = Math.abs(m.v) > 5;
    const hop = moving ? -Math.abs(Math.sin(now / 130)) * 6 : 0;
    ctx.save();
    ctx.translate(0, hop);
    const cy = -19;
    // Ears behind the fur.
    ctx.fillStyle = BLACK;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 15, cy - 13, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fluffy body: a ring of soft bumps around a round core.
    ctx.fillStyle = WHITE;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI * 2) / 14;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 15, cy + Math.sin(a) * 14, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, cy, 16, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face panel and eyes, glancing the way it is going.
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.ellipse(d * 2, cy + 1, 10.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5c542";
    roundRect(d * 2 - 9, cy - 2, 18, 8, 4);
    ctx.fill();
    const blink = now % 3200 < 140 ? 0.15 : 1;
    for (const s of [-1, 1]) {
      const ex = d * 2 + s * 4.5;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(ex, cy + 2, 3.8, 3.8 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.ellipse(ex + d * 0.8, cy + 2.2, 2.6, 2.6 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // WHALE: the lab's seven-metre bio-inspired balloon robot. Its long envelope floats behind
  // the ground robots while the two side fins and the articulated tail move independently.
  function drawWhale(c, m, now) {
    const d = bot.dir;
    const bob = 7 * Math.sin(now / 650 + m.gap * 0.02);
    const finStroke = Math.sin(now / 420);
    const tailStroke = Math.sin(now / 360 + 0.7);
    ctx.save();
    ctx.translate(0, -112 + bob);
    ctx.rotate(d * (-0.025 + clamp(m.v / 2200, -0.035, 0.035)));
    ctx.scale(d, 1);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#4f5c65";
    ctx.lineWidth = 2;

    // Far-side fin passes behind the balloon body.
    ctx.save();
    ctx.globalAlpha *= 0.68;
    ctx.translate(-3, -4);
    ctx.rotate(-0.18 - finStroke * 0.08);
    ctx.fillStyle = "#778790";
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.quadraticCurveTo(-11, -27, -47, -36 - finStroke * 4);
    ctx.quadraticCurveTo(-30, -7, -7, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Exposed linkage and tail mechanism at the rear of the inflated envelope.
    ctx.save();
    ctx.translate(-79, 0);
    ctx.rotate(tailStroke * 0.09);
    ctx.strokeStyle = "#3e474d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(-29, -7);
    ctx.lineTo(-43, 0);
    ctx.lineTo(-29, 7);
    ctx.lineTo(0, 9);
    ctx.moveTo(-7, -8);
    ctx.lineTo(-29, 7);
    ctx.moveTo(-7, 8);
    ctx.lineTo(-29, -7);
    ctx.stroke();
    ctx.translate(-42, 0);
    ctx.rotate(tailStroke * 0.1);
    ctx.fillStyle = "#788891";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(1, 0);
    ctx.quadraticCurveTo(-8, -24 - tailStroke * 3, -20, -28 - tailStroke * 3);
    ctx.quadraticCurveTo(-21, -10, -8, 0);
    ctx.quadraticCurveTo(-21, 11, -19, 27 + tailStroke * 3);
    ctx.quadraticCurveTo(-7, 23 + tailStroke * 3, 1, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Long segmented balloon envelope, matching the cool grey body of the real WHALE.
    const bodyFill = ctx.createLinearGradient(0, -27, 0, 27);
    bodyFill.addColorStop(0, "#aebbc2");
    bodyFill.addColorStop(0.52, "#82939c");
    bodyFill.addColorStop(1, "#657780");
    ctx.fillStyle = bodyFill;
    ctx.strokeStyle = "#4f5c65";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(8, 0, 92, 27, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(58, 70, 78, 0.42)";
    ctx.lineWidth = 1;
    for (const x of [-55, -24, 9, 42, 70]) {
      const h = 25 * Math.sqrt(Math.max(0, 1 - ((x - 8) * (x - 8)) / (92 * 92)));
      ctx.beginPath();
      ctx.moveTo(x, -h);
      ctx.quadraticCurveTo(x + 4, 0, x, h);
      ctx.stroke();
    }

    // Near-side fin has its own small flapping motion.
    ctx.save();
    ctx.translate(5, 7);
    ctx.rotate(0.18 + finStroke * 0.1);
    ctx.fillStyle = "#687a84";
    ctx.strokeStyle = "#4f5c65";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.quadraticCurveTo(-12, 25, -47, 37 + finStroke * 5);
    ctx.quadraticCurveTo(-28, 9, -7, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawCrew(c, now) {
    if (crewAlpha <= 0) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const m of crew) {
      ctx.save();
      ctx.globalAlpha = crewAlpha;
      ctx.translate(m.x, ROAD_Y);
      ctx.scale(SCALE, SCALE);
      if (m.kind === "able") drawAble(c, m, now);
      else if (m.kind === "erica") drawErica(c, m, now);
      else if (m.kind === "edie") drawEdie(c, m, now);
      else drawWhale(c, m, now);
      ctx.restore();
    }
  }

  function drawLineup(c, now) {
    if (lineupAlpha <= 0) return;

    const oldDir = bot.dir;
    const oldWave = bot.wave;
    const oldFade = fade;
    bot.dir = 1;
    bot.wave = 0;
    fade = lineupAlpha;

    const idle = { kind: "idle", v: 0, gap: 0, hideFov: true };
    const drawAt = (kind, x) => {
      const pose = kind === "wl" ? { kind: "walk", robot: "wl", t: now / 1000, inPlace: true, v: 0, gap: 0 } : idle;
      ctx.save();
      ctx.globalAlpha = lineupAlpha;
      ctx.translate(x, ROAD_Y);
      ctx.scale(SCALE, SCALE);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (DRAW[kind]) DRAW[kind](c, pose, 0, now);
      else if (kind === "able") drawAble(c, idle, now);
      else if (kind === "erica") drawErica(c, idle, now);
      else drawEdie(c, idle, now);
      ctx.restore();
    };

    const hyu = STOPS[0].at * W;
    const kist = STOPS[1].at * W;
    const hyuCenter = lerp(hyu, kist, 0.5);
    const mahruX = lerp(kist, SHORE_KR * W, 0.5);

    // Props identify the research chapter without adding more labels: high-speed course cones
    // around MAHRU and a small tabletop manipulation scene beside G1.
    ctx.save();
    ctx.globalAlpha = lineupAlpha;
    ctx.fillStyle = "#f97316";
    for (const x of [mahruX + 34, mahruX + 54]) {
      ctx.beginPath();
      ctx.moveTo(x - 5, ROAD_Y);
      ctx.lineTo(x, ROAD_Y - 14);
      ctx.lineTo(x + 5, ROAD_Y);
      ctx.closePath();
      ctx.fill();
    }

    const g1X = restingX(STOPS.length - 1);
    const tableX = clamp(g1X + 54, g1X + 38, W - 22);
    const tableTop = ROAD_Y - 25;
    ctx.strokeStyle = c.light;
    ctx.fillStyle = c.light;
    ctx.lineWidth = 1.5;
    ctx.fillRect(tableX - 21, tableTop, 42, 3);
    ctx.beginPath();
    ctx.moveTo(tableX - 16, tableTop + 3);
    ctx.lineTo(tableX - 13, ROAD_Y);
    ctx.moveTo(tableX + 16, tableTop + 3);
    ctx.lineTo(tableX + 13, ROAD_Y);
    ctx.stroke();

    // A small cardboard box with a visible top face, sized as a simple G1 manipulation target.
    ctx.fillStyle = "#c58a52";
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1;
    ctx.fillRect(tableX - 7, tableTop - 11, 14, 11);
    ctx.strokeRect(tableX - 7, tableTop - 11, 14, 11);
    ctx.fillStyle = "#e0ad76";
    ctx.beginPath();
    ctx.moveTo(tableX - 7, tableTop - 11);
    ctx.lineTo(tableX - 3, tableTop - 14);
    ctx.lineTo(tableX + 9, tableTop - 14);
    ctx.lineTo(tableX + 7, tableTop - 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    if (W < 620) {
      drawAt("alice", hyuCenter);
    } else {
      const gap = clamp((kist - hyu) / 5, 38, 58);
      ["edie", "erica", "able", "alice"].forEach((kind, i) => {
        drawAt(kind, hyuCenter + (i - 1.5) * gap);
      });
    }

    // MAHRU occupies its Korean chapter; the already-arrived G1 remains at NC State.
    drawAt("wl", mahruX);

    bot.dir = oldDir;
    bot.wave = oldWave;
    fade = oldFade;
    ctx.globalAlpha = 1;
  }

  function drawBot(c, now) {
    const m = bot.moves[0];
    let air = 0;
    let lift = 0;
    if (m && m.kind === "leap") {
      air = Math.sin((Math.PI * m.t) / m.T);
      lift = air * 32;
    }
    ctx.save();
    ctx.translate(bot.x, ROAD_Y - lift);
    ctx.scale(SCALE, SCALE);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (m && m.kind === "leap") {
      // Changes robot in mid-air
      const u = smooth(clamp((m.t / m.T - 0.3) / 0.4, 0, 1));
      fade = 1 - u;
      DRAW[m.robot](c, m, air, now);
      fade = u;
      DRAW[m.next](c, m, air, now);
    } else if (bot.swap > 0 && bot.swapFrom) {
      // Keep both sets of feet on the road. Hold each identity briefly at the ends, then use
      // a slow scale hand-off to bridge the robots' height difference without a hard cut.
      const p = clamp(1 - bot.swap / SWAP_T, 0, 1);
      const u = smooth(clamp((p - 0.18) / 0.64, 0, 1));
      ctx.save();
      ctx.scale(lerp(1, 0.94, u), lerp(1, 0.94, u));
      fade = 1 - u;
      DRAW[bot.swapFrom](c, null, 0, now);
      ctx.restore();
      ctx.save();
      ctx.scale(lerp(0.94, 1, u), lerp(0.94, 1, u));
      fade = u;
      DRAW[bot.robot](c, null, 0, now);
      ctx.restore();
    } else {
      fade = 1;
      DRAW[bot.robot](c, m, air, now);
    }
    fade = 1;
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- Interaction -------------------------------------------------------------------------

  function stopAt(clientX) {
    const r = canvas.getBoundingClientRect();
    const x = clientX - r.left;
    let best = -1;
    let bestD = 40;
    STOPS.forEach((s, i) => {
      const dd = Math.abs(s.at * W - x);
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    return best;
  }

  canvas.addEventListener("pointermove", (e) => {
    hover = stopAt(e.clientX);
    canvas.style.cursor = hover >= 0 ? "pointer" : "default";
  });
  canvas.addEventListener("pointerleave", () => {
    hover = -1;
  });
  canvas.addEventListener("pointerdown", (e) => {
    const j = stopAt(e.clientX);
    if (j < 0) return;
    started = true;
    if (reduceMotion) {
      bot.stop = bot.visited = j;
      bot.robot = STOPS[j].robot;
      bot.x = restingX(j);
      return;
    }
    goTo(j);
  });

  // Set off on the whole journey the first time the map comes into view
  new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting || started) return;
      started = true;
      if (reduceMotion) {
        bot.stop = bot.visited = STOPS.length - 1;
        bot.robot = STOPS[bot.stop].robot;
        bot.x = restingX(bot.stop);
      } else {
        goTo(STOPS.length - 1);
      }
    },
    { threshold: 0.6 }
  ).observe(canvas);

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000) || 0.016;
    last = now;
    step(dt);
    const c = colors();
    ctx.clearRect(0, 0, W, H);
    drawMap(c, now);
    drawCrew(c, now);
    drawBall(c);
    drawLineup(c, now);
    drawBot(c, now);
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(loop);
})();
