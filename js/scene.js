/* ==========================================================
   ANADynamics — real-time 3D scenes
   Three.js r147 (classic scripts, works from file:// and any host)
   1. Hero: extruded polished-copper emblem with machined gears
   2. Live robot cell: robot arm with inverse kinematics, conveyor,
      gripper, palletizing and a live HMI read-out
   ========================================================== */
(function () {
  'use strict';
  var root = document.documentElement;

  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  if (!window.THREE || !THREE.RoomEnvironment || !webglOK()) {
    root.classList.add('no-webgl');
    return;
  }
  root.classList.add('webgl');

  const T = THREE;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const smooth = (e0, e1, x) => { const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const C = hex => new T.Color(hex).convertSRGBToLinear();   // sRGB hex -> linear (accurate brand colours)

  function makeRenderer(canvas, maxDpr) {
    const r = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    return r;
  }
  function envMap(renderer) {
    const pm = new T.PMREMGenerator(renderer);
    const tex = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return tex;
  }
  function canvasTex(renderer, w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function noise(g, w, h, amount) {
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }

  /* Reveal the 3D canvas (and hide its poster) after the first frame */
  function markReady(canvas) {
    if (canvas.dataset.ready) return;
    canvas.dataset.ready = '1';
    const host = canvas.closest('[data-3d]');
    if (host) host.classList.add('is-3d-ready');
  }

  /* Render loop that only runs while the canvas is on screen and the tab is visible */
  function loop(canvas, onFrame) {
    let visible = true, raf = 0, last = performance.now();
    const tick = now => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      onFrame(dt, now / 1000);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) start(); }, { rootMargin: '120px' }).observe(canvas);
    }
    document.addEventListener('visibilitychange', start);
    start();
    return start; // call to force a frame (used after resize when motion is reduced)
  }

  /* ---------- Shared geometry builders ---------- */
  function buildLogo() {
    const loader = new T.SVGLoader();
    const data = loader.parse('<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000" fill-rule="evenodd" d="' + window.ANA_LOGO.mark + '"/></svg>');
    const shapes = [];
    data.paths.forEach(p => {
      const s = T.SVGLoader.createShapes ? T.SVGLoader.createShapes(p) : p.toShapes(true);
      for (let i = 0; i < s.length; i++) shapes.push(s[i]);
    });
    const geo = new T.ExtrudeGeometry(shapes, {
      depth: 44, bevelEnabled: true, bevelThickness: 9, bevelSize: 2.4, bevelOffset: 0, bevelSegments: 6, curveSegments: 2
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox, c = new T.Vector3();
    bb.getCenter(c);
    geo.translate(-c.x, -c.y, -c.z);
    const hY = bb.max.y - bb.min.y;
    // vertical tone: lighter copper at the top, deeper at the bottom (as in the original artwork)
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + hY / 2) / hY; // SVG y points down: 0 = top
      col[i * 3] = lerp(1.0, 0.84, t);
      col[i * 3 + 1] = lerp(1.0, 0.70, t);
      col[i * 3 + 2] = lerp(1.0, 0.60, t);
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const faces = new T.MeshPhysicalMaterial({ color: C(0xe6a96a), metalness: 1, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.18, vertexColors: true, envMapIntensity: 1.25 });
    const sides = new T.MeshPhysicalMaterial({ color: C(0xc9763e), metalness: 1, roughness: 0.14, vertexColors: true, envMapIntensity: 1.5 });
    const mesh = new T.Mesh(geo, [faces, sides]);
    const s = 3.2 / hY;
    mesh.scale.set(s, -s, s); // flip SVG y-axis
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function makeGear(teeth, mat, depth) {
    const m = 0.178, r = teeth * m / 2, ro = r + m * 0.9, ri = r - m * 1.1, step = Math.PI * 2 / teeth;
    const s = new T.Shape();
    for (let i = 0; i < teeth; i++) {
      const a = i * step;
      const pts = [[a, ri], [a + step * 0.15, ro], [a + step * 0.40, ro], [a + step * 0.55, ri]];
      for (let k = 0; k < pts.length; k++) {
        const x = Math.cos(pts[k][0]) * pts[k][1], y = Math.sin(pts[k][0]) * pts[k][1];
        if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
    }
    s.closePath();
    const hub = new T.Path();
    hub.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
    s.holes.push(hub);
    const nWin = teeth > 12 ? 6 : 4;
    for (let i = 0; i < nWin; i++) {
      const a = i / nWin * Math.PI * 2, h = new T.Path();
      h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.16, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    const geo = new T.ExtrudeGeometry(s, { depth: depth || 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3, curveSegments: 28 });
    geo.center();
    const mesh = new T.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ==========================================================
     1. HERO — polished copper emblem
     ========================================================== */
  function heroScene() {
    const canvas = document.getElementById('hero-3d');
    if (!canvas || !window.ANA_LOGO || !THREE.SVGLoader) return;
    const renderer = makeRenderer(canvas, 1.5);
    const scene = new T.Scene();
    const BG = 0x07070a;
    scene.background = new T.Color(BG);
    scene.fog = new T.Fog(C(BG), 10, 26);
    scene.environment = envMap(renderer);
    const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

    const key = new T.SpotLight(0xffe2c2, 2.6, 40, 0.5, 0.75, 1.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const rim = new T.DirectionalLight(0xc9dcff, 1.3);
    rim.position.set(6, 3, -5);
    scene.add(rim);
    const warm = new T.PointLight(0xff8a3d, 2.6, 12, 2);
    scene.add(warm);
    scene.add(new T.HemisphereLight(0xffffff, C(0x1a120c), 0.2));

    const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ color: C(0x0e0d0c), roughness: 0.4, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.15;
    floor.receiveShadow = true;
    scene.add(floor);

    const rig = new T.Group();
    scene.add(rig);
    const float = new T.Group();
    rig.add(float);
    float.add(buildLogo());

    const gearMat = new T.MeshStandardMaterial({ color: C(0x3b342e), metalness: 1, roughness: 0.4 });
    const gears = [makeGear(20, gearMat, 0.22), makeGear(13, gearMat, 0.2), makeGear(9, gearMat, 0.18)];
    gears[0].position.set(1.55, 1.05, -2.4);
    gears[1].position.set(-1.75, -0.85, -2.9);
    gears[2].position.set(2.55, -0.95, -3.4);
    const speeds = [0.22, -0.22 * 20 / 13, -0.22 * 20 / 9];
    gears.forEach(g => rig.add(g));

    function layout() {
      const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tanH = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
      const wide = camera.aspect > 1.1;
      let dist, x;
      if (wide) {
        dist = 11.5;
        x = dist * tanH * camera.aspect * 0.44;
      } else {
        dist = Math.max(3.6 * 1.25 / 2 / tanH, 3.6 * 1.2 / 2 / (tanH * camera.aspect));
        x = 0;
      }
      rig.position.set(x, 0, 0);
      camera.position.set(0, 0.7, dist);
      camera.lookAt(0, 0.05, 0);
      camera.updateProjectionMatrix();
      key.position.set(x - 3.5, 8, 6);
      key.target.position.set(x, 0, 0);
      key.target.updateMatrixWorld();
      warm.position.set(x + 0.4, -1.3, 2.6);
      scene.fog.near = dist - 0.5;
      scene.fog.far = dist + 16;
    }

    let mx = 0, my = 0, tmx = 0, tmy = 0, introStart = null;
    if (finePointer) {
      addEventListener('pointermove', e => { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; }, { passive: true });
    }
    let kick;
    layout();
    addEventListener('resize', () => { layout(); if (kick) kick(); });
    addEventListener('orientationchange', () => setTimeout(() => { layout(); if (kick) kick(); }, 250));
    if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); if (kick) kick(); }).observe(canvas);
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      const host = canvas.closest('[data-3d]');
      if (host) host.classList.remove('is-3d-ready');
      root.classList.add(canvas.id === 'hero-3d' ? 'no-webgl-hero' : 'no-webgl-cell');
    });

    kick = loop(canvas, (dt, t) => {
      if (introStart === null && (reduce || document.body.classList.contains('ready'))) introStart = t;
      const k = reduce ? 1 : (introStart === null ? 0 : smooth(0, 2.4, t - introStart));
      mx += (tmx - mx) * Math.min(1, dt * 3);
      my += (tmy - my) * Math.min(1, dt * 3);
      const sc = Math.min(window.scrollY / innerHeight, 1);
      const idle = reduce ? 0 : 1;
      float.rotation.y = (1 - k) * -1.7 + idle * Math.sin(t * 0.45) * 0.3 + mx * 0.5 + sc * 0.7 - 0.18;
      float.rotation.x = my * 0.22 + idle * Math.sin(t * 0.31) * 0.04;
      float.position.y = idle * Math.sin(t * 0.9) * 0.08 - (1 - k) * 0.7;
      float.scale.setScalar(0.82 + 0.18 * k);
      for (let i = 0; i < gears.length; i++) gears[i].rotation.z += speeds[i] * dt * idle;
      rig.rotation.y = mx * 0.08;
      renderer.render(scene, camera);
      markReady(canvas);
    });
  }

  /* ==========================================================
     2. LIVE ROBOT CELL
     ========================================================== */
  function cellScene() {
    const canvas = document.getElementById('cell-3d');
    if (!canvas) return;
    const renderer = makeRenderer(canvas, 1.5);
    const scene = new T.Scene();
    const BG = 0x0b0b0e;
    scene.background = new T.Color(BG);
    scene.fog = new T.Fog(C(BG), 8, 20);
    scene.environment = envMap(renderer);
    const camera = new T.PerspectiveCamera(36, 1, 0.05, 80);
    const target = new T.Vector3(-0.1, 0.5, 0.1);

    let controls = null;
    if (T.OrbitControls) {
      controls = new T.OrbitControls(camera, canvas);
      controls.target.copy(target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.enablePan = false;
      controls.enableZoom = false;
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = 1.38;
      controls.autoRotate = !reduce;
      controls.autoRotateSpeed = 0.3;
      if (!finePointer) {           // touch: keep page scrolling, auto-rotate only
        controls.enabled = false;
        canvas.style.touchAction = 'pan-y';
      }
    }
    const hint = document.querySelector('.drag-hint');
    if (hint && !finePointer) hint.textContent = 'Auto-rotating view';

    /* Lights */
    scene.add(new T.HemisphereLight(0xfff4e8, C(0x1a140f), 0.35));
    const sun = new T.DirectionalLight(0xfff0de, 1.7);
    sun.position.set(3.5, 6.5, 2.5);
    sun.castShadow = true;
    const smallScreen = Math.min(innerWidth, innerHeight) < 700;
    sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -3.6; sc.right = 3.6; sc.top = 3.6; sc.bottom = -3.6; sc.near = 1; sc.far = 16;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const spot = new T.SpotLight(0xffc896, 1.4, 14, 0.75, 0.9, 1.5);
    spot.position.set(-2.4, 5, -2);
    scene.add(spot, spot.target);

    /* Materials */
    const M = {
      paint: new T.MeshPhysicalMaterial({ color: C(0xd9742c), metalness: 0.2, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 }),
      graphite: new T.MeshStandardMaterial({ color: C(0x2a2a2e), metalness: 0.6, roughness: 0.38 }),
      steel: new T.MeshStandardMaterial({ color: C(0xc6cad0), metalness: 1, roughness: 0.22 }),
      darkSteel: new T.MeshStandardMaterial({ color: C(0x55585e), metalness: 1, roughness: 0.42 }),
      rubber: new T.MeshStandardMaterial({ color: C(0x151515), metalness: 0, roughness: 0.85 }),
      yellow: new T.MeshStandardMaterial({ color: C(0xf2b705), metalness: 0.1, roughness: 0.45 }),
      cabinet: new T.MeshStandardMaterial({ color: C(0xc9cbcc), metalness: 0.35, roughness: 0.48 }),
      wood: new T.MeshStandardMaterial({ color: C(0xb08455), metalness: 0, roughness: 0.85 }),
      woodDark: new T.MeshStandardMaterial({ color: C(0x8f6a42), metalness: 0, roughness: 0.9 })
    };
    const add = (parent, geo, mat, x, y, z, rx, ry, rz) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const capsule = (r, l) => T.CapsuleGeometry ? new T.CapsuleGeometry(r, l, 10, 28) : new T.CylinderGeometry(r, r, l + 2 * r, 28);

    /* Floor (epoxy concrete) */
    const floorTex = canvasTex(renderer, 512, 512, (g, w, h) => {
      g.fillStyle = '#403d3a'; g.fillRect(0, 0, w, h);
      noise(g, w, h, 22);
      g.globalAlpha = 0.07;
      for (let i = 0; i < 46; i++) {
        g.fillStyle = Math.random() < 0.5 ? '#000' : '#fff';
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 70, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
    }, [8, 8]);
    const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    /* Hazard marking around the cell */
    const hazard = len => canvasTex(renderer, 128, 32, (g, w, h) => {
      g.fillStyle = '#f2b705'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#111';
      for (let x = -h; x < w + h; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 16 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill(); }
    }, [len / 0.5, 1]);
    const X0 = -2.05, X1 = 1.7, Z0 = -1.75, Z1 = 1.75, BW = 0.1;
    [[(X0 + X1) / 2, Z0, X1 - X0, 0], [(X0 + X1) / 2, Z1, X1 - X0, 0], [X0, 0, Z1 - Z0, Math.PI / 2], [X1, 0, Z1 - Z0, Math.PI / 2]].forEach(b => {
      const m = new T.Mesh(new T.PlaneGeometry(b[2], BW), new T.MeshStandardMaterial({ map: hazard(b[2]), roughness: 0.6 }));
      m.rotation.set(-Math.PI / 2, 0, b[3]);
      m.position.set(b[0], 0.003, b[1]);
      m.receiveShadow = true;
      scene.add(m);
    });

    /* Safety fence (back and left) */
    const meshTex = canvasTex(renderer, 128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,40,44,1)'; g.lineWidth = 3;
      for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    }, [6, 6]);
    const fenceMat = new T.MeshStandardMaterial({ map: meshTex, transparent: true, alphaTest: 0.35, side: T.DoubleSide, metalness: 0.7, roughness: 0.45 });
    const fence = (x, z, len, ry) => {
      const g = new T.Group();
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      const panels = Math.round(len / 1.3);
      const pw = len / panels;
      for (let i = 0; i <= panels; i++) add(g, new T.BoxGeometry(0.05, 1.5, 0.05), M.yellow, -len / 2 + i * pw, 0.75, 0);
      for (let i = 0; i < panels; i++) {
        const p = new T.Mesh(new T.PlaneGeometry(pw - 0.06, 1.3), fenceMat);
        p.position.set(-len / 2 + (i + 0.5) * pw, 0.8, 0);
        p.castShadow = true;
        g.add(p);
        add(g, new T.BoxGeometry(pw - 0.05, 0.035, 0.035), M.yellow, -len / 2 + (i + 0.5) * pw, 1.47, 0);
        add(g, new T.BoxGeometry(pw - 0.05, 0.035, 0.035), M.yellow, -len / 2 + (i + 0.5) * pw, 0.13, 0);
      }
      scene.add(g);
    };
    fence(-0.35, -2.05, 4.6, 0);
    fence(-2.65, 0, 4.1, Math.PI / 2);

    /* ----- Robot ----- */
    const L1 = 1.0, L2 = 0.95, LT = 0.3, H0 = 0.62;
    const robot = new T.Group();
    scene.add(robot);
    add(robot, new T.CylinderGeometry(0.5, 0.56, 0.1, 56), M.graphite, 0, 0.05, 0);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      add(robot, new T.CylinderGeometry(0.024, 0.024, 0.03, 12), M.steel, Math.cos(a) * 0.47, 0.115, Math.sin(a) * 0.47);
    }
    const j1 = new T.Group(); j1.position.y = 0.1; robot.add(j1);
    add(j1, new T.CylinderGeometry(0.36, 0.42, 0.34, 56), M.paint, 0, 0.17, 0);
    add(j1, new T.CylinderGeometry(0.3, 0.3, 0.06, 56), M.graphite, 0, 0.37, 0);
    add(j1, new T.BoxGeometry(0.36, 0.38, 0.06), M.paint, 0, 0.52, 0.2);
    add(j1, new T.BoxGeometry(0.36, 0.38, 0.06), M.paint, 0, 0.52, -0.2);
    add(j1, new T.CylinderGeometry(0.09, 0.09, 0.22, 32), M.graphite, -0.05, 0.52, 0.34, Math.PI / 2, 0, 0);
    add(j1, new T.CylinderGeometry(0.095, 0.095, 0.02, 32), M.steel, -0.05, 0.52, 0.455, Math.PI / 2, 0, 0);

    const j2 = new T.Group(); j2.position.y = 0.52; j1.add(j2);
    add(j2, new T.CylinderGeometry(0.17, 0.17, 0.34, 48), M.graphite, 0, 0, 0, Math.PI / 2, 0, 0);
    add(j2, new T.CylinderGeometry(0.1, 0.1, 0.46, 32), M.steel, 0, 0, 0, Math.PI / 2, 0, 0);
    add(j2, capsule(0.13, L1 - 0.26), M.paint, L1 / 2, 0, 0, 0, 0, Math.PI / 2);
    add(j2, new T.BoxGeometry(L1 * 0.5, 0.1, 0.272), M.graphite, L1 * 0.5, 0, 0);

    const j3 = new T.Group(); j3.position.x = L1; j2.add(j3);
    add(j3, new T.CylinderGeometry(0.14, 0.14, 0.3, 48), M.graphite, 0, 0, 0, Math.PI / 2, 0, 0);
    add(j3, new T.CylinderGeometry(0.075, 0.075, 0.34, 32), M.steel, 0, 0, 0, Math.PI / 2, 0, 0);
    add(j3, new T.CylinderGeometry(0.1, 0.1, 0.22, 32), M.graphite, -0.17, 0.04, 0, 0, 0, Math.PI / 2);
    add(j3, capsule(0.1, L2 - 0.2), M.paint, L2 / 2, 0, 0, 0, 0, Math.PI / 2);

    const j4 = new T.Group(); j4.position.x = L2; j3.add(j4);
    add(j4, new T.CylinderGeometry(0.095, 0.095, 0.22, 40), M.graphite, 0, 0, 0, Math.PI / 2, 0, 0);
    add(j4, new T.CylinderGeometry(0.06, 0.06, 0.1, 32), M.paint, 0.06, 0, 0, 0, 0, Math.PI / 2);
    add(j4, new T.CylinderGeometry(0.078, 0.078, 0.04, 32), M.steel, 0.12, 0, 0, 0, 0, Math.PI / 2);
    add(j4, new T.BoxGeometry(0.07, 0.12, 0.32), M.graphite, 0.175, 0, 0);
    add(j4, new T.BoxGeometry(0.02, 0.04, 0.3), M.steel, 0.212, 0, 0);
    const fingerGeo = new T.BoxGeometry(0.15, 0.07, 0.022);
    const fL = add(j4, fingerGeo, M.steel, 0.285, 0, 0.16);
    const fR = add(j4, fingerGeo, M.steel, 0.285, 0, -0.16);
    const padGeo = new T.BoxGeometry(0.09, 0.06, 0.008);
    const pL = add(fL, padGeo, M.rubber, 0.02, 0, -0.015);
    const pR = add(fR, padGeo, M.rubber, 0.02, 0, 0.015);
    void pL; void pR;

    /* ----- Conveyor ----- */
    const CZ = 1.05, CTOP = 0.55, CX0 = -1.95, CX1 = 0.95, CW = 0.42, CLEN = CX1 - CX0;
    const beltTex = canvasTex(renderer, 256, 64, (g, w, h) => {
      g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, w, h);
      noise(g, w, h, 14);
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 4, h);
    }, [CLEN / 0.5, 1]);
    const belt = new T.Mesh(new T.PlaneGeometry(CLEN, CW), new T.MeshStandardMaterial({ map: beltTex, roughness: 0.75, metalness: 0.05 }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set((CX0 + CX1) / 2, CTOP, CZ);
    belt.receiveShadow = true;
    scene.add(belt);
    add(scene, new T.BoxGeometry(CLEN, 0.12, CW + 0.02), M.graphite, (CX0 + CX1) / 2, CTOP - 0.065, CZ);
    add(scene, new T.CylinderGeometry(0.06, 0.06, CW + 0.02, 32), M.graphite, CX0, CTOP - 0.06, CZ, Math.PI / 2, 0, 0);
    add(scene, new T.CylinderGeometry(0.06, 0.06, CW + 0.02, 32), M.graphite, CX1, CTOP - 0.06, CZ, Math.PI / 2, 0, 0);
    [-1, 1].forEach(sd => add(scene, new T.BoxGeometry(CLEN + 0.12, 0.09, 0.03), M.steel, (CX0 + CX1) / 2, CTOP + 0.015, CZ + sd * (CW / 2 + 0.03)));
    [CX0 + 0.12, (CX0 + CX1) / 2, CX1 - 0.12].forEach(x => [-1, 1].forEach(sd => add(scene, new T.BoxGeometry(0.05, CTOP - 0.13, 0.05), M.darkSteel, x, (CTOP - 0.13) / 2, CZ + sd * (CW / 2 - 0.02))));
    add(scene, new T.CylinderGeometry(0.075, 0.075, 0.22, 32), M.graphite, CX1 - 0.05, CTOP - 0.08, CZ + CW / 2 + 0.16, Math.PI / 2, 0, 0);
    add(scene, new T.BoxGeometry(0.12, 0.12, 0.1), M.paint, CX1 - 0.05, CTOP - 0.08, CZ + CW / 2 + 0.3);
    // end stopper
    add(scene, new T.BoxGeometry(0.04, 0.09, CW), M.yellow, 0.875, CTOP + 0.045, CZ);
    // photo-eye sensor + beam
    add(scene, new T.BoxGeometry(0.05, 0.08, 0.04), M.graphite, 0.55, CTOP + 0.09, CZ + CW / 2 + 0.06);
    add(scene, new T.BoxGeometry(0.05, 0.08, 0.04), M.graphite, 0.55, CTOP + 0.09, CZ - CW / 2 - 0.06);
    const beamMat = new T.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.35, toneMapped: false });
    const beam = new T.Mesh(new T.BoxGeometry(0.006, 0.006, CW + 0.08), beamMat);
    beam.position.set(0.55, CTOP + 0.09, CZ);
    scene.add(beam);

    /* ----- Pallet ----- */
    const PX = -0.95, PZ = -0.78, PS = 0.62;
    const pallet = new T.Group(); pallet.position.set(PX, 0, PZ); scene.add(pallet);
    for (let i = 0; i < 3; i++) add(pallet, new T.BoxGeometry(PS, 0.025, 0.1), M.woodDark, 0, 0.0125, -0.26 + i * 0.26);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) add(pallet, new T.BoxGeometry(0.1, 0.09, 0.1), M.woodDark, -0.26 + i * 0.26, 0.07, -0.26 + k * 0.26);
    for (let i = 0; i < 5; i++) add(pallet, new T.BoxGeometry(PS, 0.025, 0.1), M.wood, 0, 0.1275, -0.26 + i * 0.13);

    /* ----- Cartons ----- */
    const boxTex = canvasTex(renderer, 256, 256, (g, w, h) => {
      g.fillStyle = '#b88a56'; g.fillRect(0, 0, w, h);
      noise(g, w, h, 18);
      g.fillStyle = 'rgba(214,176,120,.85)'; g.fillRect(0, h * 0.42, w, h * 0.16);
      g.fillStyle = 'rgba(60,35,15,.85)';
      g.font = 'bold 22px Arial, sans-serif'; g.textAlign = 'center';
      g.fillText('ANADYNAMICS', w / 2, h * 0.3);
      g.font = '14px Arial, sans-serif';
      g.fillText('\u2191\u2191  THIS SIDE UP', w / 2, h * 0.78);
      g.strokeStyle = 'rgba(60,35,15,.35)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    });
    const boxMat = new T.MeshStandardMaterial({ map: boxTex, roughness: 0.82, metalness: 0 });
    const boxGeo = new T.BoxGeometry(0.2, 0.2, 0.2);
    const mkBox = () => { const b = new T.Mesh(boxGeo, boxMat); b.castShadow = true; b.receiveShadow = true; scene.add(b); return b; };
    const box = mkBox();
    const pal = [mkBox(), mkBox(), mkBox(), mkBox()];

    /* ----- Control cabinet with HMI + stack light ----- */
    const cab = new T.Group(); cab.position.set(-2.3, 0, 0.35); cab.rotation.y = Math.PI / 2; scene.add(cab);
    add(cab, new T.BoxGeometry(0.75, 0.08, 0.45), M.graphite, 0, 0.04, 0);
    add(cab, new T.BoxGeometry(0.75, 1.6, 0.45), M.cabinet, 0, 0.88, 0);
    add(cab, new T.BoxGeometry(0.02, 0.22, 0.03), M.graphite, 0.3, 0.9, 0.24);
    const hmiTex = canvasTex(renderer, 320, 200, (g, w, h) => {
      g.fillStyle = '#0e1116'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d2530'; g.fillRect(0, 0, w, 24);
      g.fillStyle = '#e3a35f'; g.font = 'bold 13px Arial'; g.fillText('CELL 01 \u00b7 OVERVIEW', 10, 16);
      g.fillStyle = '#5ee6a0'; g.beginPath(); g.arc(w - 16, 12, 5, 0, 6.283); g.fill();
      [[20, 'J1'], [70, 'J2'], [120, 'J3']].forEach(p => { g.strokeStyle = '#3a4656'; g.strokeRect(p[0], 40, 36, 90); g.fillStyle = '#e3a35f'; const v = 30 + Math.random() * 50; g.fillRect(p[0] + 2, 128 - v, 32, v); g.fillStyle = '#8b97a8'; g.font = '11px Arial'; g.fillText(p[1], p[0] + 10, 146); });
      g.strokeStyle = '#5ee6a0'; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x <= 130; x += 5) { const y = 90 - Math.sin(x / 14) * 22 - Math.random() * 6; if (x === 0) g.moveTo(175 + x, y); else g.lineTo(175 + x, y); }
      g.stroke();
      g.strokeStyle = '#3a4656'; g.lineWidth = 1; g.strokeRect(172, 40, 136, 90);
      ['AUTO', 'RUN', 'OK'].forEach((s, i) => { g.fillStyle = '#16301f'; g.fillRect(20 + i * 98, 160, 86, 26); g.fillStyle = '#5ee6a0'; g.font = 'bold 12px Arial'; g.fillText(s, 46 + i * 98, 178); });
    });
    const screen = new T.Mesh(new T.PlaneGeometry(0.42, 0.26), new T.MeshBasicMaterial({ map: hmiTex, toneMapped: false }));
    screen.position.set(-0.05, 1.25, 0.228);
    cab.add(screen);
    add(cab, new T.BoxGeometry(0.46, 0.3, 0.01), M.graphite, -0.05, 1.25, 0.223);
    const lamp = (col, y) => { const mtl = new T.MeshStandardMaterial({ color: C(col), emissive: C(col), emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.92 }); add(cab, new T.CylinderGeometry(0.045, 0.045, 0.07, 24), mtl, 0.25, y, 0); return mtl; };
    add(cab, new T.CylinderGeometry(0.02, 0.02, 0.08, 16), M.darkSteel, 0.25, 1.72, 0);
    const lampG = lamp(0x26e07a, 1.8), lampA = lamp(0xffb020, 1.875), lampR = lamp(0xff3b2f, 1.95);
    void lampA; void lampR;
    // E-stop on cabinet
    add(cab, new T.CylinderGeometry(0.045, 0.05, 0.03, 24), M.yellow, -0.05, 0.95, 0.235, Math.PI / 2, 0, 0);
    add(cab, new T.CylinderGeometry(0.03, 0.03, 0.03, 24), new T.MeshStandardMaterial({ color: C(0xd62020), roughness: 0.35 }), -0.05, 0.95, 0.255, Math.PI / 2, 0, 0);

    /* ----- Kinematics ----- */
    function ik(p) {
      const yaw = Math.atan2(-p.z, p.x);
      const r = Math.hypot(p.x, p.z);
      const h = p.y + LT - H0;
      let D = (r * r + h * h - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      D = Math.max(-1, Math.min(1, D));
      const a2 = -Math.acos(D);                                    // elbow-up solution
      const a1 = Math.atan2(h, r) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
      const a3 = -Math.PI / 2 - a1 - a2;                           // keep gripper vertical
      return { yaw: yaw, a1: a1, a2: a2, a3: a3 };
    }
    const toCyl = v => ({ yaw: Math.atan2(-v.z, v.x), r: Math.hypot(v.x, v.z), y: v.y });
    const fromCyl = (c, out) => out.set(Math.cos(c.yaw) * c.r, c.y, -Math.sin(c.yaw) * c.r);
    const PICK = new T.Vector3(0.75, CTOP + 0.1, CZ);
    const slotPos = i => new T.Vector3(PX + (i % 2 ? 0.13 : -0.13), 0.24, PZ + (i < 2 ? -0.13 : 0.13));
    const LIFT = 0.42;
    const K = toCyl(PICK), AK = { yaw: K.yaw, r: K.r, y: K.y + LIFT };
    const placeCyl = i => { const P = toCyl(slotPos(i)); return [P, { yaw: P.yaw, r: P.r, y: P.y + LIFT }]; };
    pal.forEach((b, i) => { b.position.copy(slotPos(i)); b.rotation.y = placeCyl(i)[0].yaw - K.yaw; b.visible = false; });

    const CYCLE = 8, ARRIVE = 0.28;
    const BELT_SPEED = (PICK.x - (CX0 + 0.15)) / (ARRIVE * CYCLE);
    const SEGS = [
      [0.00, 0.22, 'APp', 'AK', 'MOVE TO PICK'], [0.22, 0.30, 'AK', 'K', 'APPROACH'], [0.30, 0.36, 'K', 'K', 'GRIP'],
      [0.36, 0.44, 'K', 'AK', 'LIFT'], [0.44, 0.66, 'AK', 'AP', 'TRANSFER'], [0.66, 0.74, 'AP', 'P', 'PLACE'],
      [0.74, 0.80, 'P', 'P', 'RELEASE'], [0.80, 1.00, 'P', 'AP', 'RETRACT']
    ];
    const tcp = new T.Vector3();
    let elapsed = reduce ? CYCLE * 0.55 : 0, state = 'INIT', grip = 0, q = { yaw: 0, a1: 0, a2: 0, a3: 0 }, u = 0, parts = 0;

    function update(dt) {
      elapsed += dt;
      const n = Math.floor(elapsed / CYCLE);
      u = elapsed / CYCLE - n;
      const slot = n % 4, prev = (n + 3) % 4;
      const pc = placeCyl(slot);
      const pts = { K: K, AK: AK, P: pc[0], AP: pc[1], APp: placeCyl(prev)[1] };
      let seg = SEGS[SEGS.length - 1];
      for (let i = 0; i < SEGS.length; i++) if (u >= SEGS[i][0] && u < SEGS[i][1]) { seg = SEGS[i]; break; }
      const k = smooth(seg[0], seg[1], u);
      const a = pts[seg[2]], b = pts[seg[3]];
      const arc = (seg[4] === 'TRANSFER' || seg[4] === 'MOVE TO PICK') ? Math.sin(k * Math.PI) * 0.18 : 0;
      fromCyl({ yaw: lerp(a.yaw, b.yaw, k), r: lerp(a.r, b.r, k), y: lerp(a.y, b.y, k) + arc }, tcp);
      state = seg[4];
      q = ik(tcp);
      j1.rotation.y = q.yaw; j2.rotation.z = q.a1; j3.rotation.z = q.a2; j4.rotation.z = q.a3;

      grip = smooth(0.30, 0.34, u) * (1 - smooth(0.74, 0.78, u));
      const fz = lerp(0.16, 0.111, grip);
      fL.position.z = fz; fR.position.z = -fz;

      if (u < 0.36) {
        box.visible = true;
        box.position.set(lerp(CX0 + 0.15, PICK.x, Math.min(u / ARRIVE, 1)), PICK.y, CZ);
        box.rotation.set(0, 0, 0);
        box.scale.setScalar(Math.max(0.001, smooth(0, 0.035, u)));
      } else if (u < 0.74) {
        box.visible = true;
        box.position.copy(tcp);
        box.rotation.set(0, q.yaw - K.yaw, 0);
        box.scale.setScalar(1);
      } else {
        box.visible = false;
      }
      for (let i = 0; i < 4; i++) {
        let vis, s = 1;
        if (slot === 0 && n > 0 && u < 0.12) { vis = true; s = Math.max(0.001, 1 - smooth(0, 0.12, u)); }
        else vis = i < slot || (i === slot && u >= 0.74);
        pal[i].visible = vis;
        pal[i].scale.setScalar(s);
      }
      parts = n + (u >= 0.74 ? 1 : 0);
      beltTex.offset.x -= BELT_SPEED * dt / CLEN * beltTex.repeat.x;
      const blocked = u < 0.36 && Math.abs(box.position.x - 0.55) < 0.11;
      beamMat.opacity = blocked ? 0.95 : 0.3;
      lampG.emissiveIntensity = 1.6 + Math.sin(elapsed * 4) * 0.4;
    }

    /* ----- HMI overlay ----- */
    const el = id => document.getElementById(id);
    const ui = { j1: el('hmi-j1'), j2: el('hmi-j2'), j3: el('hmi-j3'), j4: el('hmi-j4'), tcp: el('hmi-tcp'), grip: el('hmi-grip'), parts: el('hmi-parts'), state: el('hmi-state'), bar: el('hmi-bar') };
    const deg = r => (r * 180 / Math.PI).toFixed(1) + '\u00b0';
    let uiT = 0;
    function updateUI(dt) {
      uiT += dt;
      if (uiT < 0.1 && dt > 0) return;
      uiT = 0;
      if (ui.j1) ui.j1.textContent = deg(q.yaw);
      if (ui.j2) ui.j2.textContent = deg(q.a1);
      if (ui.j3) ui.j3.textContent = deg(q.a2);
      if (ui.j4) ui.j4.textContent = deg(q.a3);
      if (ui.tcp) ui.tcp.textContent = [tcp.x, tcp.y, tcp.z].map(v => Math.round(v * 1000)).join(' / ');
      if (ui.grip) ui.grip.textContent = grip > 0.5 ? 'CLOSED' : 'OPEN';
      if (ui.parts) ui.parts.textContent = String(parts).padStart(4, '0');
      if (ui.state) ui.state.textContent = state;
      if (ui.bar) ui.bar.style.width = (u * 100).toFixed(1) + '%';
    }

    function layout() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const d = camera.aspect < 0.9 ? 7.6 : (camera.aspect < 1.4 ? 6.2 : 5.4);
      const tgt = controls ? controls.target : target;
      const dir = camera.position.lengthSq() > 0 ? camera.position.clone().sub(tgt).normalize() : new T.Vector3(3.4, 2.3, 3.6).normalize();
      camera.position.copy(tgt).add(dir.multiplyScalar(d));
      camera.lookAt(tgt);
      camera.updateProjectionMatrix();
    }
    let kick;
    layout();
    addEventListener('resize', () => { layout(); if (kick) kick(); });
    addEventListener('orientationchange', () => setTimeout(() => { layout(); if (kick) kick(); }, 250));
    if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); if (kick) kick(); }).observe(canvas);
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      const host = canvas.closest('[data-3d]');
      if (host) host.classList.remove('is-3d-ready');
      root.classList.add(canvas.id === 'hero-3d' ? 'no-webgl-hero' : 'no-webgl-cell');
    });

    if (reduce) update(0);
    kick = loop(canvas, dt => {
      if (!reduce) update(dt);
      updateUI(dt);
      if (controls) controls.update();
      renderer.render(scene, camera);
      markReady(canvas);
    });
  }

  function init() {
    try { heroScene(); } catch (e) { console.error('Hero 3D failed:', e); root.classList.add('no-webgl-hero'); }
    try { cellScene(); } catch (e) { console.error('Cell 3D failed:', e); root.classList.add('no-webgl-cell'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
