/* ==========================================================
   ANADynamics — site interactions (vanilla JS, multi-page)
   ========================================================== */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const EMAIL = 'anadynamics1@gmail.com';   // change here if you use a different inbox
  const body = document.body;

  $$('.js-year').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- 1. Boot loader (home page, first visit per session) ---------- */
  const loader = $('.loader');
  const ready = () => body.classList.add('ready');
  if (!loader) {
    ready();
  } else {
    let seen = false;
    try { seen = sessionStorage.getItem('anaBoot') === '1'; sessionStorage.setItem('anaBoot', '1'); } catch (e) { /* private mode */ }
    const pct = $('#boot-pct');
    const t0 = performance.now();
    const minWait = (seen || reduce) ? 0 : 1500;
    let done = false;
    if (pct && minWait) {
      const run = t => {
        const p = Math.min((t - t0) / 1400, 1);
        pct.textContent = Math.round(100 * (1 - Math.pow(1 - p, 3)));
        if (p < 1 && !done) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }
    const finish = () => {
      if (done) return; done = true;
      setTimeout(() => {
        if (pct) pct.textContent = '100';
        loader.classList.add('done');
        body.classList.remove('is-loading');
        ready();
        setTimeout(() => loader.remove(), 800);
      }, Math.max(0, minWait - (performance.now() - t0)));
    };
    if (seen) finish();
    else if (document.readyState === 'complete') finish();
    else addEventListener('load', finish);
    setTimeout(finish, 4000);
  }

  /* ---------- 2. Dynamic navbar ---------- */
  const header = $('.site-header'), toTop = $('.to-top'), menu = $('#nav-menu');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    if (header) {
      header.classList.toggle('scrolled', y > 30);
      const menuOpen = menu && menu.classList.contains('open');
      header.classList.toggle('hide', !menuOpen && y > 500 && y > lastY + 4);
      if (y < lastY - 4) header.classList.remove('hide');
    }
    if (toTop) toTop.classList.toggle('show', y > 800);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (header) header.addEventListener('focusin', () => header.classList.remove('hide'));

  /* ---------- 3. Mobile menu + dropdowns ---------- */
  const toggle = $('.nav-toggle');
  const setMenu = open => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
    body.style.overflow = open ? 'hidden' : '';
    if (open && header) header.classList.remove('hide');
  };
  if (toggle) toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  if (menu) $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  const subs = $$('.has-sub');
  const closeSubs = except => subs.forEach(li => {
    if (li === except) return;
    li.classList.remove('open');
    const b = $('.sub-toggle', li); if (b) b.setAttribute('aria-expanded', 'false');
  });
  subs.forEach(li => {
    const btn = $('.sub-toggle', li);
    if (!btn) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !li.classList.contains('open');
      closeSubs(li);
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    li.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSubs(); btn.focus(); } });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.has-sub')) closeSubs(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu && menu.classList.contains('open')) { setMenu(false); toggle.focus(); }
  });
  addEventListener('resize', () => { if (innerWidth > 1100 && menu && menu.classList.contains('open')) setMenu(false); });

  /* ---------- 4. Staggered scroll reveal ---------- */
  const reveals = $$('.reveal');
  reveals.forEach(el => {
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.setProperty('--i', Math.min(sibs.indexOf(el), 6));
  });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    reveals.forEach(el => io.observe(el));
  } else reveals.forEach(el => el.classList.add('in'));

  /* ---------- 5. Counters ---------- */
  const counters = $$('.count');
  if (!reduce && 'IntersectionObserver' in window) {
    const co = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, to = +el.dataset.to, t1 = performance.now() + 300, dur = 1500;
      el.textContent = '0';
      const tick = t => {
        const p = Math.max(0, Math.min((t - t1) / dur, 1));
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick); co.unobserve(el);
    }), { threshold: 0.6 });
    counters.forEach(c => co.observe(c));
  }

  /* ---------- 6. 3D tilt + spotlight ---------- */
  if (finePointer && !reduce) {
    $$('[data-tilt]').forEach(el => {
      const max = parseFloat(el.dataset.tiltMax || 7);
      const isCard = el.classList.contains('card');
      el.addEventListener('mouseenter', () => { el.style.transition = 'transform .15s ease-out, box-shadow .5s, border-color .4s'; });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max * 2}deg) rotateY(${(px - 0.5) * max * 2}deg) translateY(${isCard ? -8 : 0}px)`;
        el.style.setProperty('--mx', px * 100 + '%');
        el.style.setProperty('--my', py * 100 + '%');
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.22,.8,.2,1), box-shadow .5s, border-color .4s';
        el.style.transform = '';
      });
    });
  }

  /* ---------- 7. Tabs (WAI-ARIA) ---------- */
  $$('[role="tablist"]').forEach(list => {
    const tabs = $$('[role="tab"]', list);
    const activate = tab => tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => activate(t));
      t.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
        activate(n); n.focus(); e.preventDefault();
      });
    });
  });

  /* ---------- 8. Filters (solutions, FAQ) ---------- */
  $$('[data-filter-group]').forEach(group => {
    const scope = document.getElementById(group.dataset.filterGroup);
    if (!scope) return;
    const btns = $$('.filter', group), items = $$('[data-cat]', scope);
    btns.forEach(b => b.addEventListener('click', () => {
      const f = b.dataset.filter;
      btns.forEach(x => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); });
      items.forEach(p => {
        const show = f === 'all' || p.dataset.cat.split(' ').includes(f);
        p.classList.toggle('is-hidden', !show);
        p.classList.remove('flash');
        if (show) { p.classList.add('in'); void p.offsetWidth; p.classList.add('flash'); }
      });
    }));
  });

  /* ---------- 9. Detail modal ---------- */
  const modal = $('#modal');
  if (modal) {
    let lastFocus = null;
    $$('[data-modal]').forEach(btn => btn.addEventListener('click', () => {
      const card = btn.closest('.card');
      lastFocus = btn;
      $('#m-title').textContent = $('h3', card).textContent;
      const meta = $('.p-meta', card);
      $('#m-meta').textContent = meta ? meta.textContent : (card.classList.contains('service') ? 'Service' : '');
      const mb = $('.m-body', modal); mb.innerHTML = '';
      mb.appendChild($('template', card).content.cloneNode(true));
      typeof modal.showModal === 'function' ? modal.showModal() : modal.setAttribute('open', '');
      body.style.overflow = 'hidden';
      $('.m-close', modal).focus();
    }));
    const closeModal = () => typeof modal.close === 'function' ? modal.close() : modal.removeAttribute('open');
    modal.addEventListener('close', () => { body.style.overflow = ''; if (lastFocus) lastFocus.focus({ preventScroll: true }); });
    $('.m-close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    const cta = $('.m-cta', modal); if (cta) cta.addEventListener('click', closeModal);
  }

  /* ---------- 9b. Click-to-load maps (keeps Google Maps off the initial load) ---------- */
  $$('[data-map-load]').forEach(b => b.addEventListener('click', () => {
    const box = b.closest('[data-map-src]');
    if (!box) return;
    const f = document.createElement('iframe');
    f.title = box.dataset.mapTitle || 'Map';
    f.src = box.dataset.mapSrc;
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    box.innerHTML = '';
    box.appendChild(f);
    box.classList.add('map-live');
  }));

  /* ---------- 10. Enquiry form ---------- */
  const form = $('#contact-form');
  if (form) {
    const status = $('.status', form);
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, phoneRe = /^[+]?[\d\s()-]{7,20}$/;
    const typeSel = form.elements.enquiry;
    const bioBox = $('.bio-fields', form);
    const isBio = () => typeSel && /bio-cng/i.test(typeSel.value);
    const syncBio = () => { if (bioBox) bioBox.hidden = !isBio(); };
    if (typeSel) {
      const pre = new URLSearchParams(location.search).get('enquiry');
      if (pre) [...typeSel.options].forEach(o => { if (o.value.toLowerCase().startsWith(pre.toLowerCase())) typeSel.value = o.value; });
      typeSel.addEventListener('change', syncBio);
      syncBio();
    }
    const rules = {
      name: v => v.trim().length >= 2 || 'Please enter your name.',
      phone: v => phoneRe.test(v.trim()) || 'Please enter a valid phone number.',
      email: v => !v.trim() || emailRe.test(v.trim()) || 'Please enter a valid email address.',
      enquiry: v => !!v || 'Please choose an enquiry type.',
      message: v => v.trim().length >= 10 || 'Please add a few details (at least 10 characters).'
    };
    const fields = Object.keys(rules).filter(n => form.elements[n]);
    const check = el => {
      const r = rules[el.name](el.value), ok = r === true;
      const f = el.closest('.field'), err = $('.err', f);
      f.classList.remove('invalid'); if (!ok) { void f.offsetWidth; f.classList.add('invalid'); }
      el.setAttribute('aria-invalid', String(!ok));
      if (err) { el.setAttribute('aria-describedby', err.id); err.textContent = ok ? '' : r; }
      return ok;
    };
    fields.forEach(n => {
      const el = form.elements[n];
      el.addEventListener('blur', () => { if (el.value || el.closest('.field').classList.contains('invalid')) check(el); });
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { if (el.closest('.field').classList.contains('invalid')) check(el); });
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      status.className = 'status'; status.textContent = '';
      if (form.elements._gotcha && form.elements._gotcha.value) return;
      const els = fields.map(n => form.elements[n]);
      const res = els.map(check);
      if (res.includes(false)) { els[res.indexOf(false)].focus(); status.classList.add('fail'); status.textContent = 'Please correct the highlighted fields.'; return; }
      const data = {};
      [...form.elements].forEach(el => {
        if (!el.name || el.name === '_gotcha' || el.type === 'submit') return;
        if (el.closest('.bio-fields') && !isBio()) return;
        if (el.value.trim()) data[el.name] = el.value.trim();
      });
      const endpoint = form.dataset.endpoint;
      if (endpoint) {
        const btn = $('button[type="submit"]', form); btn.disabled = true;
        try {
          const r = await fetch(endpoint, { method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          if (!r.ok) throw new Error(r.status);
          form.reset(); syncBio();
          status.classList.add('ok'); status.textContent = 'Thank you. Your enquiry has been sent. We will contact you shortly.';
        } catch (err) { status.classList.add('fail'); status.textContent = `Sending failed. Please call us or email ${EMAIL}.`; }
        finally { btn.disabled = false; }
      } else {
        const labels = { name: 'Name', company: 'Company', phone: 'Phone', email: 'Email', location: 'Location', enquiry: 'Enquiry', land: 'Land available', feedstock: 'Feedstock', quantity: 'Feedstock quantity', message: 'Message' };
        const lines = Object.keys(data).filter(k => k !== 'message').map(k => `${labels[k] || k}: ${data[k]}`);
        const text = lines.join('\n') + '\n\n' + (data.message || '');
        location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Website enquiry: ' + (data.enquiry || 'General'))}&body=${encodeURIComponent(text)}`;
        status.classList.add('ok'); status.textContent = 'Your email app should now open with the enquiry ready to send.';
      }
    });
  }
})();
