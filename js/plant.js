/* ==========================================================
   ANADynamics — real-time 3D Bio-CNG plant
   Three.js r147. Physically based materials, sky-lit golden hour,
   soft shadows, animated gas flow, hotspots and a guided tour.
   Markup: <div class="plant-stage" data-plant data-tour?>
             <canvas class="plant-canvas"></canvas> ...
   ========================================================== */
(async function () {
  'use strict';
  const idle = () => new Promise(r => setTimeout(r, 0)); // yield to the browser between build steps
  const stage = document.querySelector('[data-plant]');
  if (!stage) return;
  const root = document.documentElement;
  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  if (!window.THREE || !THREE.OrbitControls || !webglOK()) { stage.classList.add('plant-off'); return; }

  const T = THREE;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const C = hex => new T.Color(hex).convertSRGBToLinear();
  const smooth = t => t * t * (3 - 2 * t);
  const canvas = stage.querySelector('canvas');

  /* ---------- Renderer, scene, camera ---------- */
  const small = Math.min(innerWidth, innerHeight) < 700;
  const dpr = window.devicePixelRatio || 1;
  const renderer = new T.WebGLRenderer({ canvas: canvas, antialias: dpr < 1.5, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(dpr, small ? 1 : 1.25));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;   // scene is static: shadows are drawn once, not every frame

  const scene = new T.Scene();
  const statusEl = stage.querySelector('.l3-text');
  const status = t => { if (statusEl) statusEl.textContent = t; };
  status('Building the plant…');
  let fit = 1;            // >1 pulls the camera back on narrow / portrait screens so the whole plant fits
  let userMoved = false;

  const camera = new T.PerspectiveCamera(34, 1, 0.5, 2000);
  const controls = new T.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 14;
  controls.maxDistance = 95;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.42;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.35;
  if (!finePointer) { controls.enableZoom = false; canvas.style.touchAction = 'pan-y'; }
  else { controls.enableZoom = true; }
  // keep page scrolling with the wheel unless the user holds Ctrl / Cmd
  canvas.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation(); }, { capture: true });

  await idle();
  /* ---------- Sky + sun (golden hour, painted gradient: no sky shader cost) ---------- */
  const sunDir = new T.Vector3();
  const elev = 14, azim = 210;
  sunDir.setFromSphericalCoords(1, T.MathUtils.degToRad(90 - elev), T.MathUtils.degToRad(azim));
  (function sky() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#5f84ad'); grd.addColorStop(0.45, '#a9b9c6'); grd.addColorStop(0.72, '#f0cfa2'); grd.addColorStop(0.86, '#f6b97d'); grd.addColorStop(1, '#c9a27c');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    scene.background = t;
  })();
  if (T.RoomEnvironment) {
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  scene.fog = new T.Fog(C(0xd9b994), 110, 380);

  const sun = new T.DirectionalLight(0xffd7a8, 3.2);
  sun.position.copy(sunDir).multiplyScalar(80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(small ? 1024 : 1536, small ? 1024 : 1536);
  const sc = sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 30; sc.bottom = -30; sc.near = 10; sc.far = 200;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(new T.HemisphereLight(0xcfe0ff, C(0x4a3d2a), 0.45));

  await idle();
  /* ---------- Procedural textures ---------- */
  const aniso = renderer.capabilities.getMaxAnisotropy();
  function tex(w, h, draw, rep, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (srgb !== false) t.encoding = T.sRGBEncoding;
    t.anisotropy = aniso;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function grain(g, w, h, amt) {
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
  }
  function blotches(g, w, h, n, cols, rmin, rmax, alpha) {
    g.globalAlpha = alpha;
    for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rmin + Math.random() * (rmax - rmin), 0, 6.283); g.fill(); }
    g.globalAlpha = 1;
  }
  const grassTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4c5f2a'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 90, ['#5d7031', '#3f5223', '#6b7a3a', '#55632c', '#7a7a44'], 10, 60, 0.35);
    grain(g, w, h, 34);
  }, [60, 60]);
  const concreteTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a968e'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 90, ['#8c887f', '#a8a49b', '#85817a'], 20, 90, 0.25);
    grain(g, w, h, 26);
    g.strokeStyle = 'rgba(60,58,54,.45)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }, [10, 6]);
  const gravelTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d7468'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 90 + Math.random() * 90; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [14, 3]);
  const ribTex = tex(512, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 32, 0);
    grd.addColorStop(0, '#2f5b35'); grd.addColorStop(0.5, '#3a6b40'); grd.addColorStop(1, '#2a5230');
    for (let x = 0; x < w; x += 32) { g.save(); g.translate(x, 0); g.fillStyle = grd; g.fillRect(0, 0, 32, h); g.restore(); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < h; y += 42) g.fillRect(0, y, w, 2);
    blotches(g, w, h, 40, ['#22402a', '#4a7a4d'], 4, 18, 0.08);
    grain(g, w, h, 10);
  }, [6, 1]);
  const corrTex = tex(256, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 16) { const grd = g.createLinearGradient(x, 0, x + 16, 0); grd.addColorStop(0, '#2c5a32'); grd.addColorStop(.5, '#3b7041'); grd.addColorStop(1, '#2a5530'); g.fillStyle = grd; g.fillRect(x, 0, 16, h); }
    grain(g, w, h, 8);
  }, [4, 1]);
  const slurryTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3d3120'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 80, ['#4a3b26', '#2f2618', '#55452c'], 6, 30, 0.4); grain(g, w, h, 16);
  });
  const manureTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a3a26'; g.fillRect(0, 0, w, h);
    blotches(g, w, h, 140, ['#3a2d1d', '#5a4830', '#2e2417'], 3, 14, 0.5); grain(g, w, h, 30);
  }, [2, 2]);
  const strawTex = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#b89a5a'; g.fillRect(0, 0, w, h);
    g.lineWidth = 1.2;
    for (let i = 0; i < 450; i++) { const v = 140 + Math.random() * 80; g.strokeStyle = `rgba(${v},${v * 0.82},${v * 0.48},.8)`; const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 6.28, l = 6 + Math.random() * 18; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }, [2, 2]);
  function labelTex(lines, bg, fg, w, h) {
    return tex(w, h, (g) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      lines.forEach(l => { g.fillStyle = l.c || fg; g.font = l.f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.t, w / 2, l.y * h); });
    });
  }

  await idle();
  /* ---------- Materials ---------- */
  const M = {
    grass: new T.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
    concrete: new T.MeshStandardMaterial({ map: concreteTex, roughness: 0.85 }),
    concreteWall: new T.MeshStandardMaterial({ color: C(0xb4afa5), roughness: 0.9 }),
    gravel: new T.MeshStandardMaterial({ map: gravelTex, roughness: 1 }),
    tank: new T.MeshStandardMaterial({ map: ribTex, roughness: 0.55, metalness: 0.35 }),
    membrane: new T.MeshStandardMaterial({ color: C(0x3e7a3d), roughness: 0.38, metalness: 0.05 }),
    membraneHolder: new T.MeshStandardMaterial({ color: C(0x4a8443), roughness: 0.36, metalness: 0.05 }),
    steel: new T.MeshStandardMaterial({ color: C(0xd6d9dc), metalness: 1, roughness: 0.22 }),
    galv: new T.MeshStandardMaterial({ color: C(0xa9adb1), metalness: 0.9, roughness: 0.42 }),
    dark: new T.MeshStandardMaterial({ color: C(0x2b2d30), metalness: 0.5, roughness: 0.5 }),
    yellow: new T.MeshStandardMaterial({ color: C(0xe8b923), metalness: 0.25, roughness: 0.45 }),
    green: new T.MeshStandardMaterial({ color: C(0x3b7a3f), metalness: 0.3, roughness: 0.5 }),
    container: new T.MeshStandardMaterial({ map: corrTex, metalness: 0.4, roughness: 0.5 }),
    white: new T.MeshStandardMaterial({ color: C(0xe9e7e2), roughness: 0.7 }),
    cylinder: new T.MeshStandardMaterial({ color: C(0xd9d6cf), metalness: 0.35, roughness: 0.35 }),
    slurry: new T.MeshStandardMaterial({ map: slurryTex, roughness: 0.25, metalness: 0.1 }),
    manure: new T.MeshStandardMaterial({ map: manureTex, roughness: 1 }),
    straw: new T.MeshStandardMaterial({ map: strawTex, roughness: 1 }),
    roof: new T.MeshStandardMaterial({ color: C(0x7a8086), metalness: 0.7, roughness: 0.45 }),
    glass: new T.MeshStandardMaterial({ color: C(0x9fb6c2), metalness: 0.9, roughness: 0.08, emissive: C(0xffc98a), emissiveIntensity: 0.25 }),
    trunk: new T.MeshStandardMaterial({ color: C(0x4b3a29), roughness: 1 }),
    leaf: new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    red: new T.MeshStandardMaterial({ color: C(0xc23a2b), roughness: 0.5 })
  };

  const world = new T.Group(); scene.add(world);
  function add(geo, mat, x, y, z, rx, ry, rz, parent) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true; m.receiveShadow = true;
    (parent || world).add(m); return m;
  }
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s) => new T.CylinderGeometry(rt, rb, h, Math.min(s || 20, 44));

  await idle();
  /* ---------- Ground ---------- */
  const ground = add(new T.PlaneGeometry(900, 900), M.grass, 0, 0, 0, -Math.PI / 2);
  ground.castShadow = false;
  add(box(56, 0.2, 30), M.concrete, 2, 0.1, -1).castShadow = false;
  const road = add(new T.PlaneGeometry(14, 120), M.gravel, 34, 0.03, 0, -Math.PI / 2);
  road.castShadow = false;
  add(box(4.6, 0.12, 14), M.gravel, 30.2, 0.06, 8).castShadow = false;

  await idle();
  /* ---------- 1. Feedstock reception & pre-treatment ---------- */
  // covered feedstock shed with straw & dung heaps
  const shed = new T.Group(); shed.position.set(-21, 0.2, 7); world.add(shed);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) add(box(0.25, 4.2, 0.25), M.galv, -4.5 + i * 3, 2.1, -2.6 + k * 5.2, 0, 0, 0, shed);
  add(box(10.2, 0.15, 6.4), M.roof, 0, 4.35, 0, 0.06, 0, 0, shed);
  const heap1 = add(new T.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.straw, -2.2, 0, 0, 0, 0, 0, shed); heap1.scale.set(1.1, 0.7, 1);
  const heap2 = add(new T.SphereGeometry(1.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.manure, 2.4, 0, 0.3, 0, 0, 0, shed); heap2.scale.set(1.1, 0.55, 1);
  // mixing / feed tank
  add(cyl(2.4, 2.4, 2.4, 48), M.concreteWall, -13.5, 1.4, 7);
  add(cyl(2.2, 2.2, 0.05, 48), M.slurry, -13.5, 2.55, 7);
  add(new T.TorusGeometry(2.42, 0.05, 8, 48), M.yellow, -13.5, 3.2, 7, Math.PI / 2);
  add(box(0.6, 1.2, 0.6), M.dark, -13.5, 3.6, 7);            // agitator motor
  add(box(5, 0.12, 0.5), M.galv, -13.5, 3.0, 7);              // walkway bridge
  // shredder
  add(box(2.2, 1.6, 1.6), M.green, -17.2, 1.0, 9.6);
  add(box(1.4, 0.8, 1.2), M.dark, -17.2, 2.2, 9.6);

  await idle();
  /* ---------- 2. Anaerobic digesters (2x, double-membrane roof) ---------- */
  const digesters = [[-6.5, -4.5], [5.0, -4.5]];
  digesters.forEach(([x, z]) => {
    const R = 5.2, H = 6.2;
    add(cyl(R + 0.25, R + 0.25, 0.4, 44), M.concreteWall, x, 0.4, z);
    const shell = add(cyl(R, R, H, 44), M.tank, x, 0.6 + H / 2, z);
    shell.material = M.tank;
    add(new T.TorusGeometry(R + 0.02, 0.06, 6, 44), M.galv, x, 0.6 + H, z, Math.PI / 2);
    const dome = add(new T.SphereGeometry(R + 0.02, 44, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.membrane, x, 0.6 + H, z);
    dome.scale.y = 0.48;
    // handrail ring + posts at top
    add(new T.TorusGeometry(R + 0.55, 0.035, 5, 44), M.yellow, x, 0.6 + H + 1.0, z, Math.PI / 2);
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; add(cyl(0.03, 0.03, 1.0, 6), M.yellow, x + Math.cos(t) * (R + 0.55), 0.6 + H + 0.5, z + Math.sin(t) * (R + 0.55)); }
    add(new T.RingGeometry(R, R + 0.62, 44), M.galv, x, 0.6 + H + 0.02, z, -Math.PI / 2).material.side = T.DoubleSide;
    // ladder with cage
    const lz = z + R + 0.18;
    add(box(0.05, H + 1, 0.05), M.galv, x - 0.25, 0.6 + (H + 1) / 2, lz);
    add(box(0.05, H + 1, 0.05), M.galv, x + 0.25, 0.6 + (H + 1) / 2, lz);
    for (let y = 1; y < H + 1; y += 0.32) add(box(0.5, 0.03, 0.03), M.galv, x, 0.6 + y, lz);
    for (let y = 2.4; y < H + 1; y += 0.9) add(new T.TorusGeometry(0.4, 0.02, 4, 16, Math.PI), M.galv, x, 0.6 + y, lz + 0.05, Math.PI / 2, 0, 0);
    // side manway + sight glass
    add(cyl(0.45, 0.45, 0.3, 24), M.galv, x - R - 0.1, 1.6, z, 0, 0, Math.PI / 2);
    add(cyl(0.18, 0.18, 0.12, 16), M.glass, x + 0.1, 2.6, z + R + 0.02, Math.PI / 2);
    // gas outlet on dome
    add(cyl(0.18, 0.18, 0.8, 16), M.yellow, x + 1.2, 0.6 + H + 2.6, z);
  });

  await idle();
  /* ---------- 3. Biogas holder ---------- */
  const GH = [15.5, -6.5];
  add(cyl(4.4, 4.4, 0.45, 64), M.concreteWall, GH[0], 0.42, GH[1]);
  const holder = add(new T.SphereGeometry(4.2, 44, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.membraneHolder, GH[0], 0.64, GH[1]);
  holder.scale.y = 0.95;
  add(new T.TorusGeometry(4.22, 0.08, 8, 64), M.galv, GH[0], 0.66, GH[1], Math.PI / 2);

  await idle();
  /* ---------- 4. Purification & upgrading skid ---------- */
  const UP = [16, 5.2];
  add(box(10, 0.3, 7), M.concrete, UP[0], 0.35, UP[1]);
  // tall absorber / stripper columns (stainless)
  [[-3.6, -2.2, 0.75, 10], [-1.9, -2.2, 0.6, 8.5], [-3.6, -0.2, 0.5, 6]].forEach(([dx, dz, r, h]) => {
    add(cyl(r, r, h, 40), M.steel, UP[0] + dx, 0.5 + h / 2, UP[1] + dz);
    add(new T.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, UP[0] + dx, 0.5 + h, UP[1] + dz);
    for (let y = 2; y < h; y += 2.5) add(new T.TorusGeometry(r + 0.04, 0.03, 6, 32), M.galv, UP[0] + dx, 0.5 + y, UP[1] + dz, Math.PI / 2);
  });
  // H2S scrubber vessel
  add(cyl(0.8, 0.8, 3.2, 32), M.green, UP[0] - 0.6, 2.1, UP[1] - 2.4);
  // upgrading container with signage
  const sign = labelTex([
    { t: 'BIO-CNG', f: 'bold 120px Arial, Helvetica, sans-serif', y: 0.38, c: '#f2f5ee' },
    { t: 'PLANT', f: 'bold 120px Arial, Helvetica, sans-serif', y: 0.68, c: '#f2f5ee' },
    { t: 'ANADYNAMICS', f: 'bold 40px Arial, Helvetica, sans-serif', y: 0.9, c: '#e3a35f' }
  ], 'rgba(0,0,0,0)', '#fff', 640, 512);
  const cont = new T.Group(); cont.position.set(UP[0] + 2.2, 0.5, UP[1] + 1.1); world.add(cont);
  add(box(6.06, 2.6, 2.44), M.container, 0, 1.3, 0, 0, 0, 0, cont);
  const signMesh = new T.Mesh(new T.PlaneGeometry(2.2, 1.76), new T.MeshStandardMaterial({ map: sign, transparent: true, roughness: 0.6 }));
  signMesh.position.set(-0.9, 1.35, 1.231); cont.add(signMesh);
  add(box(0.9, 0.5, 0.06), M.galv, 1.9, 2.0, 1.23, 0, 0, 0, cont);   // louvre
  add(box(0.06, 2.4, 2.3), M.dark, 3.04, 1.3, 0, 0, 0, 0, cont);    // doors

  await idle();
  /* ---------- 5. Compression & cascade storage ---------- */
  const CP = [24.5, -3.5];
  add(box(7, 0.3, 4.2), M.concrete, CP[0], 0.35, CP[1]);
  const comp = new T.Group(); comp.position.set(CP[0], 0.5, CP[1]); world.add(comp);
  add(box(4.5, 2.5, 2.3), M.white, -0.7, 1.25, 0, 0, 0, 0, comp);
  add(box(4.52, 0.18, 2.32), M.green, -0.7, 2.45, 0, 0, 0, 0, comp);
  const compLabel = labelTex([{ t: 'CBG COMPRESSOR', f: 'bold 54px Arial, Helvetica, sans-serif', y: 0.5, c: '#1f4d27' }], '#e9e7e2', '#000', 640, 110);
  const cl = new T.Mesh(new T.PlaneGeometry(2.6, 0.45), new T.MeshStandardMaterial({ map: compLabel, roughness: 0.7 })); cl.position.set(-0.7, 1.9, 1.152); comp.add(cl);
  add(box(0.9, 1.3, 0.9), M.dark, 2.3, 0.65, 0.4, 0, 0, 0, comp);      // cooler
  // cascade (horizontal cylinder bundle on a skid)
  const CS = [25, 4.5];
  const cas = new T.Group(); cas.position.set(CS[0], 0.5, CS[1]); world.add(cas);
  add(box(3.6, 0.2, 2.2), M.galv, 0, 0.1, 0, 0, 0, 0, cas);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    add(cyl(0.2, 0.2, 3.3, 20), M.cylinder, 0, 0.45 + r * 0.42, -0.84 + c * 0.42, 0, 0, Math.PI / 2, cas);
  }
  [-1.7, 1.7].forEach(x => add(box(0.12, 2.0, 2.2), M.galv, x, 1.1, 0, 0, 0, 0, cas));

  await idle();
  /* ---------- 6. Dispenser & tube trailer ---------- */
  const DS = [30.2, 12];
  const disp = new T.Group(); disp.position.set(DS[0], 0.12, DS[1]); world.add(disp);
  add(box(1.0, 2.3, 0.6), M.white, 0, 1.15, 0, 0, 0, 0, disp);
  add(box(1.02, 0.5, 0.62), M.green, 0, 2.05, 0, 0, 0, 0, disp);
  const dsp = labelTex([{ t: 'BIO-CNG', f: 'bold 64px Arial, Helvetica, sans-serif', y: 0.5, c: '#ffffff' }], '#2f6f35', '#fff', 320, 110);
  const dl = new T.Mesh(new T.PlaneGeometry(0.9, 0.31), new T.MeshStandardMaterial({ map: dsp, roughness: 0.6 })); dl.position.set(0, 2.05, 0.312); disp.add(dl);
  const scr = new T.Mesh(new T.PlaneGeometry(0.5, 0.3), new T.MeshBasicMaterial({ color: 0x9be3a5, toneMapped: false })); scr.position.set(0, 1.5, 0.302); disp.add(scr);
  // canopy
  [[-3, -2], [3, -2], [-3, 2], [3, 2]].forEach(p => add(cyl(0.12, 0.12, 5, 12), M.galv, DS[0] + p[0], 2.6, DS[1] + p[1]));
  add(box(7.5, 0.4, 5.5), M.white, DS[0], 5.2, DS[1]);
  add(box(7.52, 0.16, 5.52), M.green, DS[0], 5.0, DS[1]);
  // tube trailer (truck carrying cascades)
  const tr = new T.Group(); tr.position.set(34.5, 0, -9); world.add(tr);
  add(box(2.4, 2.2, 2.0), M.white, 0, 1.6, 5.2, 0, 0, 0, tr);
  add(box(2.42, 0.9, 1.0), M.glass, 0, 2.2, 6.0, 0, 0, 0, tr);
  add(box(2.4, 0.4, 9), M.dark, 0, 0.9, 0.6, 0, 0, 0, tr);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) add(cyl(0.24, 0.24, 7.4, 20), M.cylinder, -0.75 + c * 0.5, 1.4 + r * 0.5, 0, Math.PI / 2, 0, 0, tr);
  [[-1, 4.6], [1, 4.6], [-1, -1.5], [1, -1.5], [-1, -2.7], [1, -2.7]].forEach(p => add(cyl(0.48, 0.48, 0.35, 24), M.dark, p[0] * 1.15, 0.48, p[1], 0, 0, Math.PI / 2, tr));

  await idle();
  /* ---------- 7. Digestate: separator + organic manure ---------- */
  const DG = [-1, 9];
  add(box(9, 0.25, 6), M.concrete, DG[0], 0.32, DG[1]);
  add(box(2.2, 1.4, 1.2), M.green, DG[0] - 2.6, 1.15, DG[1] - 1.6);
  add(cyl(0.3, 0.3, 2.4, 16), M.steel, DG[0] - 2.6, 1.1, DG[1] - 0.4, 0, 0, Math.PI / 2 - 0.35);
  const fom = add(new T.SphereGeometry(2.3, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.manure, DG[0] + 1.6, 0.42, DG[1] + 0.6); fom.scale.set(1.2, 0.5, 0.9);
  // liquid fertiliser tank
  add(cyl(1.4, 1.4, 2.6, 40), M.concreteWall, DG[0] - 5.8, 1.6, DG[1] + 0.8);

  await idle();
  /* ---------- 8. Safety flare ---------- */
  const FL = [-16, -9];
  add(box(1.6, 0.4, 1.6), M.concreteWall, FL[0], 0.4, FL[1]);
  add(cyl(0.22, 0.28, 9, 20), M.galv, FL[0], 5, FL[1]);
  add(cyl(0.4, 0.3, 0.8, 20), M.dark, FL[0], 9.8, FL[1]);
  [0, 2.1, 4.2].forEach(a => add(cyl(0.02, 0.02, 9.4, 4), M.galv, FL[0] + Math.cos(a) * 2.2, 4.4, FL[1] + Math.sin(a) * 2.2, Math.cos(a + Math.PI / 2) * 0.23, 0, Math.sin(a + Math.PI / 2) * -0.23));
  const flameMat = new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false });
  const flame = new T.Mesh(new T.ConeGeometry(0.42, 1.8, 20, 1, true), flameMat); flame.position.set(FL[0], 11.1, FL[1]); flame.userData.dynamic = true; world.add(flame);
  const flameCore = new T.Mesh(new T.ConeGeometry(0.22, 1.0, 16, 1, true), new T.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
  flameCore.position.set(FL[0], 10.7, FL[1]); flameCore.userData.dynamic = true; world.add(flameCore);
  const flameLight = new T.PointLight(0xff9a40, 1.4, 22, 2); flameLight.position.set(FL[0], 11, FL[1]); world.add(flameLight);

  await idle();
  /* ---------- 9. Control room (SCADA) ---------- */
  const CR = [-20, -3.5];
  const crg = new T.Group(); crg.position.set(CR[0], 0.2, CR[1]); world.add(crg);
  add(box(7, 3.4, 4.6), M.white, 0, 1.7, 0, 0, 0, 0, crg);
  add(box(7.6, 0.25, 5.2), M.roof, 0, 3.52, 0, 0, 0, 0, crg);
  [-2.2, 0, 2.2].forEach(x => add(box(1.5, 1.1, 0.06), M.glass, x, 2.0, 2.31, 0, 0, 0, crg));
  add(box(1.0, 2.2, 0.06), M.dark, 3.0, 1.1, 2.31, 0, 0, 0, crg);
  const board = labelTex([
    { t: 'ANADYNAMICS', f: 'bold 76px Arial, Helvetica, sans-serif', y: 0.42, c: '#e3a35f' },
    { t: 'BIO-CNG PLANT  ·  CONTROL ROOM', f: '34px Arial, Helvetica, sans-serif', y: 0.78, c: '#e9e7e2' }
  ], '#14161a', '#fff', 900, 200);
  const bm = new T.Mesh(new T.PlaneGeometry(4.5, 1.0), new T.MeshStandardMaterial({ map: board, roughness: 0.5 })); bm.position.set(0, 4.15, 2.0); crg.add(bm);
  add(box(4.6, 1.1, 0.12), M.dark, 0, 4.15, 1.93, 0, 0, 0, crg);

  await idle();
  /* ---------- Gas pipework (yellow = gas, grey = process) ---------- */
  const pipeGroups = [];
  function pipe(points, r, mat, posts) {
    const pts = points.map(p => new T.Vector3(p[0], p[1], p[2]));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = a.distanceTo(b);
      if (len < 1e-3) continue;
      const m = new T.Mesh(cyl(r, r, len, 16), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true; world.add(m);
      if (i > 0) { const j = new T.Mesh(new T.SphereGeometry(r * 1.15, 16, 10), mat); j.position.copy(a); world.add(j); }
      if (posts && Math.abs(a.y - b.y) < 0.01 && a.y > 1) {
        const n = Math.floor(len / 4);
        for (let k = 1; k <= n; k++) {
          const p = a.clone().lerp(b, k / (n + 1));
          add(box(0.14, p.y - 0.2, 0.14), M.galv, p.x, (p.y - 0.2) / 2 + 0.2, p.z);
          add(box(0.6, 0.08, 0.14), M.galv, p.x, p.y - r - 0.04, p.z);
        }
      }
    }
    pipeGroups.push(pts);
    return pts;
  }
  const H = 0.6 + 6.2;
  const flows = [];
  // feed slurry to digesters (grey)
  flows.push({ pts: pipe([[-13.5, 2.2, 4.6], [-13.5, 2.2, 1.5], [-6.5, 2.2, 1.5], [-6.5, 2.2, 0.7]], 0.14, M.galv, true), color: 0x8a6b3e, kind: 'slurry' });
  pipe([[-6.5, 2.2, 1.5], [5.0, 2.2, 1.5], [5.0, 2.2, 0.7]], 0.14, M.galv, true);
  flows.push({ pts: [new T.Vector3(-6.5, 2.2, 1.5), new T.Vector3(5.0, 2.2, 1.5), new T.Vector3(5.0, 2.2, 0.7)], color: 0x8a6b3e, kind: 'slurry' });
  // biogas from digesters to holder (yellow)
  const gA = pipe([[-5.3, H + 3.0, -4.5], [-5.3, H + 3.4, -4.5], [-5.3, H + 3.4, -11], [15.5, H + 3.4, -11], [15.5, 4.8, -11], [15.5, 4.8, -10.6]], 0.16, M.yellow, false);
  flows.push({ pts: gA, color: 0xffb347, kind: 'biogas' });
  const gB = pipe([[6.2, H + 3.0, -4.5], [6.2, H + 3.4, -4.5], [6.2, H + 3.4, -11]], 0.16, M.yellow, false);
  flows.push({ pts: gB.concat([new T.Vector3(15.5, H + 3.4, -11), new T.Vector3(15.5, 4.8, -11), new T.Vector3(15.5, 4.8, -10.6)]), color: 0xffb347, kind: 'biogas' });
  [-11].forEach(z => [-5.3, 0.5, 6.2, 11, 15.5].forEach(x => add(box(0.18, H + 3.2, 0.18), M.galv, x, (H + 3.2) / 2, z)));
  // holder to upgrading (yellow, on rack)
  const gC = pipe([[19.6, 1.2, -6.5], [20.5, 1.2, -6.5], [20.5, 3.2, -6.5], [20.5, 3.2, 1.4], [16.2, 3.2, 1.4], [16.2, 2.0, 2.4]], 0.15, M.yellow, true);
  flows.push({ pts: gC, color: 0xffb347, kind: 'biogas' });
  // upgraded Bio-CNG to compressor and cascade (green)
  const gD = pipe([[19.2, 1.6, 5.4], [21.8, 1.6, 5.4], [21.8, 1.6, -3.5], [22.4, 1.6, -3.5]], 0.11, M.green, false);
  flows.push({ pts: gD, color: 0x7cf28a, kind: 'cbg' });
  const gE = pipe([[26.9, 1.2, -3.0], [27.4, 1.2, -3.0], [27.4, 1.2, 4.5], [26.8, 1.2, 4.5]], 0.09, M.green, false);
  flows.push({ pts: gE, color: 0x7cf28a, kind: 'cbg' });
  const gF = pipe([[27.4, 1.2, 4.5], [27.4, 0.5, 4.5], [27.4, 0.5, 12], [29.7, 0.5, 12]], 0.07, M.green, false);
  flows.push({ pts: gF, color: 0x7cf28a, kind: 'cbg' });
  // digestate outflow (grey)
  flows.push({ pts: pipe([[-2, 1.2, 0.7], [-2, 1.2, 7.2], [-3.4, 1.2, 7.2]], 0.13, M.galv, false), color: 0x8a6b3e, kind: 'slurry' });
  // to flare
  flows.push({ pts: pipe([[-5.3, H + 3.4, -11], [-16, H + 3.4, -11], [-16, H + 3.4, -9.4]], 0.1, M.yellow, false), color: 0xffb347, kind: 'flare', sparse: true });

  await idle();
  /* ---------- Gas flow particles ---------- */
  const flowGroup = new T.Group(); scene.add(flowGroup);
  const dotGeo = new T.SphereGeometry(0.11, 10, 8);
  const flowItems = [];
  flows.forEach(f => {
    const seg = []; let len = 0;
    for (let i = 1; i < f.pts.length; i++) { const l = f.pts[i].distanceTo(f.pts[i - 1]); seg.push(l); len += l; }
    const mat = new T.MeshBasicMaterial({ color: f.color, transparent: true, opacity: 0.95, toneMapped: false });
    const n = Math.max(2, Math.round(len / (f.sparse ? 4 : 1.6)));
    const inst = new T.InstancedMesh(dotGeo, mat, n);
    inst.frustumCulled = false;
    flowGroup.add(inst);
    flowItems.push({ pts: f.pts, seg: seg, len: len, inst: inst, n: n, speed: f.kind === 'cbg' ? 3.2 : 2.2 });
  });
  const tmpM = new T.Matrix4(), tmpV = new T.Vector3();
  function pointAt(f, d) {
    for (let i = 0; i < f.seg.length; i++) { if (d <= f.seg[i]) return tmpV.copy(f.pts[i]).lerp(f.pts[i + 1], d / f.seg[i]); d -= f.seg[i]; }
    return tmpV.copy(f.pts[f.pts.length - 1]);
  }
  function updateFlow(t) {
    flowItems.forEach(f => {
      for (let k = 0; k < f.n; k++) {
        const d = ((t * f.speed + k * f.len / f.n) % f.len);
        tmpM.makeTranslation(pointAt(f, d).x, tmpV.y, tmpV.z);
        f.inst.setMatrixAt(k, tmpM);
      }
      f.inst.instanceMatrix.needsUpdate = true;
    });
  }

  await idle();
  /* ---------- Trees (instanced, varied) ---------- */
  (function trees() {
    const leafGeo = new T.IcosahedronGeometry(1, 2);
    const p = leafGeo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = 1 + 0.18 * Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3 - v.y * 2.1) + (Math.random() - 0.5) * 0.08;
      v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z);
    }
    leafGeo.computeVertexNormals();
    const spots = [];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, r = 36 + rnd() * 40;
      const x = 3 + Math.cos(a) * r * 1.15, z = -2 + Math.sin(a) * r * 0.85;
      if (x > 26 && x < 42) continue; // keep the road clear
      spots.push([x, z, 0.8 + rnd() * 0.7]);
    }
    for (let i = 0; i < 16; i++) spots.push([-30 + i * 3.6 + rnd(), -19 - rnd() * 3, 0.7 + rnd() * 0.4]);
    const trunks = new T.InstancedMesh(cyl(0.18, 0.28, 1, 8), M.trunk, spots.length);
    const leaves = new T.InstancedMesh(leafGeo, M.leaf, spots.length * 3);
    const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), pos = new T.Vector3(), col = new T.Color();
    spots.forEach((sp, i) => {
      const [x, z, k] = sp, th = 3.2 * k;
      m.compose(pos.set(x, th / 2, z), q.identity(), s.set(k, th, k)); trunks.setMatrixAt(i, m);
      for (let j = 0; j < 3; j++) {
        const ox = (rnd() - 0.5) * 1.6 * k, oz = (rnd() - 0.5) * 1.6 * k, oy = th + (0.6 + rnd() * 1.4) * k;
        const r = (1.4 + rnd() * 0.9) * k;
        q.setFromEuler(new T.Euler(rnd(), rnd() * 6, rnd()));
        m.compose(pos.set(x + ox, oy, z + oz), q, s.set(r, r * 0.9, r));
        leaves.setMatrixAt(i * 3 + j, m);
        col.setHSL(0.24 + rnd() * 0.06, 0.38 + rnd() * 0.2, 0.17 + rnd() * 0.08).convertSRGBToLinear();
        leaves.setColorAt(i * 3 + j, col);
      }
    });
    trunks.castShadow = leaves.castShadow = true; leaves.receiveShadow = true;
    world.add(trunks, leaves);
  })();

  await idle();
  /* ---------- Merge static meshes by material (hundreds of draw calls -> a few dozen) ---------- */
  (function mergeStatic() {
    const U = T.BufferGeometryUtils;
    if (!U || !U.mergeBufferGeometries) return;
    world.updateMatrixWorld(true);
    const buckets = new Map(), done = [];
    world.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.dynamic || Array.isArray(o.material)) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      Object.keys(g.attributes).forEach(n => { if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n); });
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.clearGroups();
      g.applyMatrix4(o.matrixWorld);
      const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '');
      if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
      buckets.get(key).geos.push(g);
      done.push(o);
    });
    done.forEach(o => { o.parent.remove(o); o.geometry.dispose(); });
    buckets.forEach(b => {
      const merged = U.mergeBufferGeometries(b.geos, false);
      b.geos.forEach(g => g.dispose());
      if (!merged) return;
      const m = new T.Mesh(merged, b.mat);
      m.castShadow = b.cast; m.receiveShadow = b.recv;
      scene.add(m);
    });
  })();

  renderer.shadowMap.needsUpdate = true;
  await idle();
  /* ---------- Hotspots / tour data ---------- */
  const SPOTS = [
    { id: 'feed', n: '01', title: 'Feedstock reception & pre-treatment', text: 'Organic waste such as cattle dung, crop residue and food waste is received, shredded and mixed with water into a uniform slurry before feeding.', at: [-15.5, 4.5, 7.5], cam: [-30, 12, 26], tgt: [-15, 1.5, 6] },
    { id: 'digester', n: '02', title: 'Anaerobic digesters', text: 'Sealed, heated tanks where bacteria break down the slurry without oxygen, producing raw biogas (about 50–65% methane). The double-membrane roof stores gas on top.', at: [-0.8, 12, -4.5], cam: [-4, 20, 30], tgt: [-1, 4, -4] },
    { id: 'holder', n: '03', title: 'Biogas storage', text: 'A double-membrane gas holder buffers the biogas so the upgrading unit receives a steady, constant flow.', at: [15.5, 5.6, -6.5], cam: [30, 12, 8], tgt: [15, 2.5, -6] },
    { id: 'upgrade', n: '04', title: 'Purification & upgrading', text: 'H₂S, moisture and CO₂ are removed (e.g. water scrubbing, PSA or membranes) to raise methane to Bio-CNG quality, ≥ 90% CH₄ as per IS 16087.', at: [13.5, 11.5, 3], cam: [6, 14, 26], tgt: [15, 4, 4] },
    { id: 'compress', n: '05', title: 'Compression & cascade storage', text: 'Bio-CNG is compressed to around 250 bar and stored in high-pressure cylinder cascades.', at: [25, 4.2, 0.5], cam: [40, 10, 14], tgt: [25, 1.5, 1] },
    { id: 'dispense', n: '06', title: 'Dispensing & dispatch', text: 'Fuel is dispensed to vehicles on site, or carried by tube trailers to CNG stations, industries and city gas networks.', at: [30.2, 6.4, 12], cam: [44, 9, 26], tgt: [31, 2, 8] },
    { id: 'digestate', n: '07', title: 'Organic manure (by-product)', text: 'Digestate is separated into solid fermented organic manure and liquid manure, a second income stream for farms.', at: [0.6, 3.2, 9.6], cam: [8, 10, 26], tgt: [-1, 1, 9] },
    { id: 'flare', n: '08', title: 'Safety flare', text: 'Burns surplus biogas safely during maintenance or upsets, so no raw methane is vented to the atmosphere.', at: [-16, 12.4, -9], cam: [-30, 14, 6], tgt: [-16, 6, -9] },
    { id: 'control', n: '09', title: 'Control room · PLC / SCADA', text: 'Automation monitors temperature, pH, pressure, gas flow, methane and H₂S in real time, with alarms and remote access. This is where ANADynamics automation comes in.', at: [-20, 5.6, -3.5], cam: [-34, 9, 14], tgt: [-20, 2, -3] }
  ];
  const overlay = stage.querySelector('.plant-hotspots');
  const info = stage.querySelector('.plant-info');
  const tourBtns = [...document.querySelectorAll('[data-tour-step]')];
  const spotEls = [];
  if (overlay) {
    SPOTS.forEach((s, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'hotspot'; b.textContent = s.n;
      b.setAttribute('aria-label', s.title);
      b.addEventListener('click', () => focus(i, true));
      overlay.appendChild(b);
      spotEls.push({ el: b, v: new T.Vector3(...s.at) });
    });
  }
  let active = -1;
  function showInfo(i) {
    if (!info) return;
    const s = SPOTS[i];
    info.querySelector('.pi-n').textContent = 'STEP ' + s.n + ' / 0' + SPOTS.length;
    info.querySelector('.pi-title').textContent = s.title;
    info.querySelector('.pi-text').textContent = s.text;
    info.hidden = false;
  }
  let fly = null;
  function focus(i, userAction) {
    active = i;
    spotEls.forEach((s, k) => s.el.classList.toggle('active', k === i));
    tourBtns.forEach(b => { const on = +b.dataset.tourStep === i; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    showInfo(i);
    const s = SPOTS[i];
    const t1 = new T.Vector3(...s.tgt);
    const p1 = new T.Vector3(...s.cam).sub(t1).multiplyScalar(fit).add(t1);
    fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p1, t1: t1 };
    if (userAction) { controls.autoRotate = false; setAuto(false); }
    kick();
  }
  tourBtns.forEach(b => b.addEventListener('click', () => focus(+b.dataset.tourStep, true)));

  const HOME = { cam: [52, 34, 58], tgt: [4, 2, 0] };
  const autoBtn = stage.querySelector('[data-plant-auto]');
  const flowBtn = stage.querySelector('[data-plant-flow]');
  const resetBtn = stage.querySelector('[data-plant-reset]');
  function setAuto(on) { controls.autoRotate = on && !reduce; if (autoBtn) autoBtn.setAttribute('aria-pressed', String(controls.autoRotate)); }
  if (autoBtn) autoBtn.addEventListener('click', () => { setAuto(!controls.autoRotate); kick(); });
  if (flowBtn) flowBtn.addEventListener('click', () => { flowGroup.visible = !flowGroup.visible; flowBtn.setAttribute('aria-pressed', String(flowGroup.visible)); kick(); });
  if (resetBtn) resetBtn.addEventListener('click', () => {
    active = -1; spotEls.forEach(s => s.el.classList.remove('active'));
    tourBtns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
    if (info) info.hidden = true;
    const ht = new T.Vector3(...HOME.tgt);
    fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new T.Vector3(...HOME.cam).sub(ht).multiplyScalar(fit).add(ht), t1: ht };
    setAuto(stage.hasAttribute('data-autorotate')); kick();
  });
  if (info) { const x = info.querySelector('.pi-close'); if (x) x.addEventListener('click', () => { info.hidden = true; }); }
  setAuto(stage.hasAttribute('data-autorotate'));
  controls.addEventListener('start', () => { fly = null; userMoved = true; });

  await idle();
  /* ---------- Layout ---------- */
  camera.position.set(...HOME.cam);
  controls.target.set(...HOME.tgt);
  const REF_H = Math.tan(T.MathUtils.degToRad(17)) * 1.75;   // horizontal view on a wide desktop stage
  let lastW = 0, lastH = 0;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === lastW && h === lastH)) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 52 : (camera.aspect < 1.3 ? 42 : 34);
    camera.updateProjectionMatrix();
    // Fit the plant to the screen shape: phones in portrait need the camera further back.
    const hTan = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const prev = fit;
    fit = Math.max(1, Math.min(2.4, REF_H / hTan));
    controls.maxDistance = 95 * fit;
    if (!fly && fit !== prev) {
      const off = camera.position.clone().sub(controls.target);
      off.setLength(off.length() * fit / prev);
      camera.position.copy(controls.target).add(off);
    }
  }
  layout();
  status('Preparing materials…');
  await idle();
  renderer.compile(scene, camera);   // compile shaders once, behind the loading message
  await idle();
  /* ---------- Loop (runs only when visible) ---------- */
  const clock = new T.Clock();
  let visible = true, raf = 0, elapsed = 0;
  let lastDraw = 0, interacting = false;
  controls.addEventListener('start', () => { interacting = true; });
  controls.addEventListener('end', () => { interacting = false; });
  function frame(now) {
    raf = 0;
    // Idle animation (gas flow, flame, auto-rotate) is capped at ~30 fps to keep the page smooth.
    if (!fly && !interacting && now && now - lastDraw < 32) { raf = requestAnimationFrame(frame); return; }
    lastDraw = now || performance.now();
    const dt = Math.min(clock.getDelta(), 0.08);
    if (!reduce) elapsed += dt;
    if (fly) {
      fly.t = Math.min(fly.t + dt / 1.8, 1);
      const k = smooth(fly.t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    if (flowGroup.visible) updateFlow(elapsed);
    const fl = 0.85 + Math.sin(elapsed * 17) * 0.08 + Math.sin(elapsed * 7.3) * 0.07;
    flame.scale.set(1, fl, 1); flameCore.scale.set(1, fl * 1.05, 1);
    flameLight.intensity = 1.2 + (fl - 0.85) * 4;
    renderer.render(scene, camera);
    if (!stage.classList.contains('is-3d-ready')) stage.classList.add('is-3d-ready');
    // hotspots
    if (spotEls.length) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      spotEls.forEach(s => {
        const p = s.v.clone().project(camera);
        const vis = p.z < 1 && p.x > -1.05 && p.x < 1.05 && p.y > -1.05 && p.y < 1.05;
        s.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
        s.el.style.opacity = vis ? '' : '0';
        s.el.style.pointerEvents = vis ? '' : 'none';
      });
    }
    const moving = fly || controls.autoRotate || !reduce;
    if (visible && !document.hidden && moving) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible && !document.hidden) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible) kick(); }, { rootMargin: '100px' }).observe(stage);
  document.addEventListener('visibilitychange', kick);
  controls.addEventListener('change', kick);
  addEventListener('resize', () => { layout(); kick(); });
  addEventListener('orientationchange', () => setTimeout(() => { layout(); kick(); }, 250));
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); kick(); }).observe(canvas);
  // Phones may drop the 3D context when memory is low: fall back to the photo instead of a black box.
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    cancelAnimationFrame(raf); raf = 0; visible = false;
    stage.classList.remove('is-3d-ready', 'is-3d-loading');
    stage.classList.add('plant-off', 'is-3d-failed');
  });
  updateFlow(0);
  stage.classList.add('plant-on');
  if (stage.dataset.pendingStep) { const s = +stage.dataset.pendingStep; delete stage.dataset.pendingStep; setTimeout(() => focus(s, true), 400); }
  kick();
  if (stage.hasAttribute('data-tour')) setTimeout(() => { if (active < 0 && !fly) { /* stay on overview until the user picks a step */ } }, 0);
})();
