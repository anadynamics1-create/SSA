/* ==========================================================
   ANADynamics — on-demand 3D loader
   The page renders instantly with a still image. The 3D library
   (Three.js) is downloaded only:
     - after the page has finished loading and the browser is idle,
     - when the 3D area is about to scroll into view,
     - and only on devices that can handle it.
   Data-saver / low-memory devices get a "Load 3D" button instead.
   ========================================================== */
(function () {
  'use strict';
  var els = Array.prototype.slice.call(document.querySelectorAll('[data-3d]'));
  if (!els.length) return;

  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  var DEPS = {
    hero:  [CDN + 'build/three.min.js', CDN + 'examples/js/loaders/SVGLoader.js', CDN + 'examples/js/environments/RoomEnvironment.js', 'js/logo-data.js', 'js/scene.js'],
    cell:  [CDN + 'build/three.min.js', CDN + 'examples/js/environments/RoomEnvironment.js', CDN + 'examples/js/controls/OrbitControls.js', 'js/scene.js'],
    plant: [CDN + 'build/three.min.js', CDN + 'examples/js/environments/RoomEnvironment.js', CDN + 'examples/js/controls/OrbitControls.js', CDN + 'examples/js/utils/BufferGeometryUtils.js', 'js/plant.js']
  };

  var cache = {};
  function load(src) {
    if (!cache[src]) {
      cache[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = false;
        s.onload = resolve;
        s.onerror = function () { reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return cache[src];
  }
  function loadAll(list) {
    return list.reduce(function (p, src) { return p.then(function () { return load(src); }); }, Promise.resolve());
  }

  function webgl() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  var conn = navigator.connection || {};
  var saveData = !!conn.saveData || /2g$/.test(conn.effectiveType || '');
  var lowEnd = (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4);
  var touchOrSmall = matchMedia('(max-width: 960px)').matches || !matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGL = webgl();

  function whenIdle(cb) {
    var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(cb, { timeout: 2500 }); };
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  }
  function fail(el, kind) {
    el.classList.remove('is-3d-loading');
    el.classList.add('is-3d-failed');
    if (kind === 'plant') el.classList.add('plant-off');
    else document.documentElement.classList.add(kind === 'hero' ? 'no-webgl-hero' : 'no-webgl-cell');
  }
  function start(el, kind) {
    if (el.dataset.l3) return;
    el.dataset.l3 = '1';
    el.classList.remove('is-3d-optin');
    el.classList.add('is-3d-loading');
    var txt = el.querySelector('.l3-text'); if (txt) txt.textContent = 'Downloading 3D engine…';
    loadAll(DEPS[kind]).catch(function () { fail(el, kind); });
  }

  els.forEach(function (el) {
    var kind = el.getAttribute('data-3d');
    if (!DEPS[kind]) return;
    if (!hasGL) { if (kind !== 'hero') fail(el, kind); return; }

    // Hero logo: desktop only. Phones keep the still image (fastest, saves battery).
    if (kind === 'hero') {
      if (touchOrSmall || saveData || lowEnd || reduce) return;
      whenIdle(function () { start(el, kind); });
      return;
    }

    var btn = el.querySelector('.l3-btn');
    if (btn) btn.addEventListener('click', function () { start(el, kind); });

    // Bio-CNG plant: never loads by itself, so the page opens instantly.
    // It starts only when the visitor clicks "Launch" (or a tour step).
    // While the browser is idle we quietly pre-download the engine (no execution),
    // so the click feels fast.
    if (kind === 'plant') {
      el.classList.add('is-3d-optin');
      Array.prototype.forEach.call(document.querySelectorAll('[data-tour-step]'), function (b) {
        b.addEventListener('click', function () {
          if (el.classList.contains('is-3d-ready')) return;
          el.dataset.pendingStep = b.getAttribute('data-tour-step');
          start(el, kind);
        });
      });
      if (!saveData && !lowEnd) {
        whenIdle(function () {
          DEPS.plant.forEach(function (src) {
            if (!/^https?:/.test(src)) return;
            var l = document.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = src;
            document.head.appendChild(l);
          });
        });
      }
      return;
    }
    // Robot cell: phones & tablets start it with a tap (saves data and battery); laptops load it automatically.
    if (saveData || lowEnd || (kind === 'cell' && touchOrSmall)) { el.classList.add('is-3d-optin'); if (btn) btn.hidden = false; return; }

    whenIdle(function () {
      if (!('IntersectionObserver' in window)) { start(el, kind); return; }
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); start(el, kind); }
      }, { rootMargin: '400px 0px' });
      io.observe(el);
    });
  });
})();
