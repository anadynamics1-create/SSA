/* ==========================================================
   ANADynamics — Bio-CNG feedstock & output estimator
   Indicative only. All factors are editable on the page.
   ========================================================== */
(function () {
  'use strict';
  const form = document.getElementById('est-form');
  if (!form) return;
  const $ = s => form.querySelector(s);
  const CH4_DENSITY = 0.717;               // kg per Nm³ of methane (0 °C, 1 atm)
  const COLORS = { dung: '#8ccf4d', agri: '#d9b45a', food: '#e3a35f', ind: '#6fb7c9', sludge: '#a08cff' };
  const fmt = (v, d) => (isFinite(v) ? v : 0).toLocaleString('en-IN', { maximumFractionDigits: d === undefined ? 0 : d, minimumFractionDigits: d || 0 });
  const num = el => { const v = parseFloat(el.value); return isFinite(v) && v >= 0 ? v : 0; };

  function calc() {
    let biogas = 0, tonnes = 0;
    const parts = [];
    form.querySelectorAll('[data-feed]').forEach(row => {
      const id = row.dataset.feed;
      const t = num(row.querySelector('[data-qty]'));
      const y = num(row.querySelector('[data-yield]'));
      const g = t * y;
      tonnes += t; biogas += g;
      parts.push({ id: id, g: g });
    });
    const ch4pct = Math.min(num($('#p-ch4')), 100) / 100;
    const rec = Math.min(num($('#p-rec')), 100) / 100;
    const days = Math.min(num($('#p-days')), 366);
    const price = num($('#p-price'));
    const methane = biogas * ch4pct;
    const cbg = methane * rec * CH4_DENSITY;             // kg/day
    const annual = cbg * days / 1000;                    // tonnes/year
    const rev = price > 0 ? cbg * days * price : 0;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('o-cbg', fmt(cbg));
    set('o-tpd', fmt(cbg / 1000, 2));
    set('o-feed', fmt(tonnes, 1) + ' t/day');
    set('o-biogas', fmt(biogas) + ' m³/day');
    set('o-ch4', fmt(methane) + ' Nm³/day');
    set('o-annual', fmt(annual, 0) + ' t/year');
    set('o-rev', price > 0 ? '₹ ' + fmt(rev) + ' /year' : 'Enter a price');
    let cls = 'Enter feedstock quantities';
    if (cbg > 0) cls = cbg < 1000 ? 'Small plant · below 1 TPD' : cbg < 5000 ? 'Medium plant · 1–5 TPD' : cbg < 10000 ? 'Large plant · 5–10 TPD' : 'Very large plant · 10+ TPD';
    set('o-class', cls);

    const bar = document.getElementById('o-bar');
    if (bar) {
      bar.innerHTML = '';
      parts.forEach(p => {
        if (!biogas || !p.g) return;
        const s = document.createElement('span');
        s.style.width = (p.g / biogas * 100).toFixed(2) + '%';
        s.style.background = COLORS[p.id];
        s.title = p.id;
        bar.appendChild(s);
      });
    }
  }
  form.addEventListener('input', calc);
  form.addEventListener('submit', e => e.preventDefault());
  const reset = document.getElementById('est-reset');
  if (reset) reset.addEventListener('click', () => { form.reset(); calc(); });
  calc();
})();
