// Holiday dress-up for the site's robots. Each robot calls window.locoHoliday.decorate()
// right after drawing its head; outside the date windows it draws nothing.
// Preview any of them with ?holiday=halloween, ?holiday=christmas or ?holiday=newyear.
(function () {
  const today = new Date();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  let kind = null;
  if ((m === 10 && d >= 24) || (m === 11 && d === 1)) kind = "halloween";
  else if (m === 12 && d >= 20 && d <= 26) kind = "christmas";
  else if ((m === 12 && d === 31) || (m === 1 && d <= 2)) kind = "newyear";
  const forced = new URLSearchParams(window.location.search).get("holiday");
  if (forced) kind = forced === "none" ? null : forced;

  // Jack-o'-lantern over the head, with a candle flicker in the carved face
  function pumpkin(ctx, x, y, r, dir, now) {
    const w = r * 1.3;
    const h = r * 1.08;
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.strokeStyle = "#b45309";
    ctx.fillStyle = "#f28c28";
    for (const [ox, sx] of [
      [-0.45, 0.62],
      [0.45, 0.62],
      [0, 0.7],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x + ox * w, y, w * sx, h, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#4d7c0f";
    ctx.fillRect(x - r * 0.12, y - h - r * 0.32, r * 0.24, r * 0.4);
    const glow = 0.75 + 0.25 * Math.sin(now / 90) * Math.sin(now / 37);
    ctx.fillStyle = `rgba(255, 214, 80, ${glow})`;
    for (const s of [-1, 1]) {
      const ex = x + s * r * 0.42 + dir * r * 0.12;
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.2, y - r * 0.05);
      ctx.lineTo(ex + r * 0.2, y - r * 0.05);
      ctx.lineTo(ex, y - r * 0.38);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    const mx = x + dir * r * 0.12;
    ctx.moveTo(mx - r * 0.55, y + r * 0.25);
    for (let i = 0; i <= 6; i++) ctx.lineTo(mx - r * 0.55 + (i * r * 1.1) / 6, y + r * (i % 2 ? 0.38 : 0.25));
    ctx.lineTo(mx + r * 0.4, y + r * 0.6);
    ctx.lineTo(mx - r * 0.4, y + r * 0.6);
    ctx.closePath();
    ctx.fill();
  }

  // Floppy Santa hat whose tip leans back from the direction of travel
  function santa(ctx, x, y, r, dir) {
    const base = y - r * 0.55;
    const tipX = x - dir * r * 1.3;
    const tipY = y - r * 1.9;
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(x - r * 1.0, base);
    ctx.quadraticCurveTo(x - dir * r * 0.2, y - r * 2.2, tipX, tipY);
    ctx.quadraticCurveTo(x + dir * r * 0.3, y - r * 1.4, x + r * 1.0, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x - r * 1.1, base - r * 0.15, r * 2.2, r * 0.45, r * 0.22);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tipX, tipY, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Striped party hat with a little confetti around it
  function party(ctx, x, y, r, dir, now) {
    const base = y - r * 0.7;
    const tip = y - r * 2.3;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, base);
    ctx.lineTo(x, tip);
    ctx.lineTo(x + r * 0.7, base);
    ctx.closePath();
    ctx.clip();
    const colors = ["#2563eb", "#facc15"];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colors[i % 2];
      ctx.fillRect(x - r, tip + (i * (base - tip)) / 6, r * 2, (base - tip) / 6 + 0.5);
    }
    ctx.restore();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, tip, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    const bits = ["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7"];
    for (let i = 0; i < 6; i++) {
      const a = (i * 2 * Math.PI) / 6 + now / 1500;
      const rr = r * (1.9 + 0.3 * Math.sin(now / 400 + i));
      ctx.fillStyle = bits[i % bits.length];
      ctx.fillRect(x + Math.cos(a) * rr, y - r * 0.8 + Math.sin(a) * rr * 0.6, r * 0.22, r * 0.22);
    }
  }

  const styles = { halloween: pumpkin, christmas: santa, newyear: party };

  window.locoHoliday = {
    kind,
    // (x, y): head centre; r: head radius; dir: +1 facing right, -1 facing left
    decorate(ctx, x, y, r, dir = 1, now = performance.now()) {
      const draw = styles[kind];
      if (!draw) return;
      ctx.save();
      draw(ctx, x, y, r, dir, now);
      ctx.restore();
    },
  };
})();
