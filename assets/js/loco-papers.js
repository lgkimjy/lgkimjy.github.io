// Hovering a selected publication on the about page has the robot demo above act it out:
// the wheeled-legged paper switches to the wheels robot for a high-speed run, and the
// localization paper switches to the legs robot for an aMCL particle-filter demo.
(function () {
  const DEMOS = {
    an2025high: { robot: "loco-wheelbo", kind: "speed" },
    kim2023enhancing: { robot: "loco-bot", kind: "amcl" },
  };
  const COOLDOWN = 5000; // ms, so brushing past a paper doesn't restart its demo
  const lastRun = {};

  for (const [key, demo] of Object.entries(DEMOS)) {
    const entry = document.getElementById(key);
    const item = entry && entry.closest("li");
    if (!item) continue;
    item.addEventListener("mouseenter", () => {
      const now = performance.now();
      if (now - (lastRun[key] || -Infinity) < COOLDOWN) return;
      lastRun[key] = now;
      if (window.locoShow) window.locoShow(demo.robot);
      window.dispatchEvent(new CustomEvent("loco-demo", { detail: demo.kind }));
    });
  }
})();
