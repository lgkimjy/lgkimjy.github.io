---
permalink: /assets/js/visitor-counter-setup.js
---
(function () {
  const code = "{{ site.goatcounter_code }}";
  const counters = document.querySelectorAll(".visitor-count");
  if (!code || counters.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  const fetchCount = (params) => {
    const query = params ? `?${params}` : "";
    const url = `https://${code}.goatcounter.com/counter/TOTAL.json${query}`;

    return fetch(url).then((response) => {
      if (!response.ok) throw new Error("counter unavailable");
      return response.json();
    });
  };

  Promise.allSettled([
    fetchCount(`start=${today}&end=${today}`),
    fetchCount(),
  ]).then(([todayResult, totalResult]) => {
    counters.forEach((counter) => {
      const todayEl = counter.querySelector(".visitor-count-today");
      const totalEl = counter.querySelector(".visitor-count-total");

      if (todayResult.status === "fulfilled") {
        todayEl.textContent = todayResult.value.count;
      } else {
        todayEl.textContent = "—";
      }

      if (totalResult.status === "fulfilled") {
        totalEl.textContent = totalResult.value.count;
      } else {
        totalEl.textContent = "—";
      }
    });
  });
})();
