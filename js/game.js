import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/BufferGeometryUtils.js';

/* ============================================================
   SLY RUNS — a rooftop endless heist
   Everything is procedural: geometry, textures, animation, audio.
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const smooth = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const LANES = [-3, 0, 3];
const SEG_LEN = 20;
const SEG_COUNT = 12;
const SPAWN_Z = -155;

/* ---------------- DOM ---------------- */
const dom = {
  canvas: $('#scene'),
  loader: $('#loader'),
  menu: $('#menu'),
  hud: $('#hud'),
  score: $('#score'),
  distance: $('#distance'),
  coins: $('#coins'),
  multiplier: $('#multiplier'),
  lives: [...document.querySelectorAll('.mask-life')],
  heatFill: $('#heatFill'),
  heatLabel: $('#heatLabel'),
  powers: [...document.querySelectorAll('.power')],
  comboToast: $('#comboToast'),
  callout: $('#callout'),
  hintStrip: $('#hintStrip'),
  menuBest: $('#menuBest'),
  startBtn: $('#startBtn'),
  pauseBtn: $('#pauseBtn'),
  muteBtn: $('#muteBtn'),
  pauseScreen: $('#pauseScreen'),
  resumeBtn: $('#resumeBtn'),
  quitBtn: $('#quitBtn'),
  gameOver: $('#gameOver'),
  restartBtn: $('#restartBtn'),
  menuBtn: $('#menuBtn'),
  finalScore: $('#finalScore'),
  finalDistance: $('#finalDistance'),
  finalCoins: $('#finalCoins'),
  finalCombo: $('#finalCombo'),
  newBest: $('#newBest'),
  pauseScore: $('#pauseScore'),
  pauseDistance: $('#pauseDistance'),
  pauseCoins: $('#pauseCoins'),
  speedFx: $('.speed-fx'),
};

const isTouch = matchMedia('(pointer: coarse)').matches;

/* ---------------- THREE BASICS ---------------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
} catch (error) {
  dom.loader.innerHTML = '<span style="letter-spacing:2px;line-height:1.6;text-align:center">THIS HEIST NEEDS WEBGL<br><small style="opacity:.55">Try a newer browser, detective.</small></span>';
  throw error;
}

const glInfo = (() => {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  } catch { return ''; }
})();
const SOFTWARE_GL = /swiftshader|llvmpipe|software|basic render/i.test(glInfo);
const LOW_POWER = SOFTWARE_GL || matchMedia('(pointer: coarse)').matches;

renderer.setPixelRatio(LOW_POWER ? .8 : Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !LOW_POWER;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0c1c3a, 58, 205);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(5.2, 3.4, 7.3);

const clock = new THREE.Clock();
let elapsed = 0;

/* ---------------- PROCEDURAL TEXTURES ---------------- */
function canvas2d(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  return canvas;
}
function texture(canvas, repeats = [1, 1], nearest = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeats[0], repeats[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  if (nearest) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  }
  return tex;
}

const roofTex = texture(canvas2d(512, 1024, (ctx, w, h) => {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#33445f');
  grad.addColorStop(.5, '#293852');
  grad.addColorStop(1, '#354761');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 42) {
    ctx.fillStyle = 'rgba(5,12,24,.22)';
    ctx.fillRect(0, y, w, 2);
    ctx.fillStyle = 'rgba(208,226,245,.055)';
    ctx.fillRect(0, y + 2, w, 1);
  }
  for (let x = 0; x < w; x += 128) {
    ctx.fillStyle = 'rgba(4,11,23,.14)';
    ctx.fillRect(x, 0, 1.5, h);
  }
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * .12;
    ctx.fillStyle = Math.random() > .55 ? `rgba(230,240,255,${a})` : `rgba(4,10,22,${a * 1.6})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() * 2 + .4, Math.random() * 2 + .4);
  }
  for (let i = 0; i < 9; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const r = rnd(15, 60);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(4,10,22,.18)');
    rg.addColorStop(1, 'rgba(4,10,22,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}), [1.2, 1.1]);

const laneTex = texture(canvas2d(410, 256, (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  const lines = [w / 3, (w / 3) * 2];
  for (const x of lines) {
    ctx.strokeStyle = 'rgba(255,196,77,.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([35, 23]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,177,.16)';
    ctx.lineWidth = 13;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 32; y < h; y += 92) {
    ctx.fillStyle = 'rgba(255,205,100,.17)';
    ctx.fillRect(w / 2 - 2, y, 4, 22);
  }
}), [1, 1]);

const hazardTex = texture(canvas2d(512, 128, (ctx, w, h) => {
  ctx.fillStyle = '#e9d7af';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(0, 0);
  for (let x = -h; x < w + h; x += 54) {
    ctx.fillStyle = '#d54b35';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 27, 0);
    ctx.lineTo(x + 27 + h, h);
    ctx.lineTo(x + h, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(4,10,22,.78)';
  ctx.fillRect(0, 7, w, 4);
  ctx.fillRect(0, h - 11, w, 4);
  ctx.font = '900 26px Arial Narrow, sans-serif';
  ctx.fillStyle = 'rgba(4,10,22,.72)';
  ctx.textAlign = 'center';
  ctx.fillText('POLICE LINE · DO NOT CROSS', w / 2, h / 2 + 9);
}), [1, 1]);

function neonSignTexture(label, sub, color = '#f7bd49') {
  return texture(canvas2d(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#081327';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, w - 56, h - 56);
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = color;
    ctx.font = '400 76px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(label, w / 2, 113);
    ctx.shadowBlur = 9;
    ctx.font = '600 21px "Barlow Condensed", Arial, sans-serif';
    ctx.fillStyle = '#fff3d2';
    ctx.fillText(sub, w / 2, 164);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,243,210,.2)';
    for (let y = 190; y < 224; y += 6) ctx.fillRect(95, y, w - 190, 2);
  }), [1, 1]);
}

const windowTexes = [];
for (let t = 0; t < 5; t++) {
  windowTexes.push(texture(canvas2d(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#081225';
    ctx.fillRect(0, 0, w, h);
    for (let y = 9; y < h - 10; y += 14) {
      for (let x = 8; x < w - 8; x += 12) {
        const lit = Math.random();
        if (lit > .70) {
          ctx.fillStyle = lit > .91 ? 'rgba(255,222,153,.92)' : lit > .81 ? 'rgba(247,189,73,.66)' : 'rgba(111,166,207,.50)';
          ctx.fillRect(x, y, 5, 7);
          if (lit > .94) {
            ctx.fillStyle = 'rgba(255,222,153,.15)';
            ctx.fillRect(x - 2, y - 2, 9, 11);
          }
        } else {
          ctx.fillStyle = 'rgba(17,39,72,.55)';
          ctx.fillRect(x, y, 5, 7);
        }
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < h; y += 28) ctx.fillRect(0, y, w, 2);
  }), [1, 2]));
}

function makeGlowTexture(colorInner = 'rgba(255,235,175,1)', colorOuter = 'rgba(255,180,60,0)') {
  const tex = new THREE.CanvasTexture(canvas2d(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, colorInner);
    g.addColorStop(.16, 'rgba(255,214,120,.8)');
    g.addColorStop(.42, 'rgba(255,162,48,.22)');
    g.addColorStop(1, colorOuter);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTexture();
const coolGlowTex = makeGlowTexture('rgba(190,240,255,1)', 'rgba(60,150,255,0)');

/* ---------------- MATERIAL HELPERS ---------------- */
const gradientMap = (() => {
  const data = new Uint8Array([44, 98, 166, 222, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
}

const MAT = {
  fur: toon(0x8b95a7),
  furLight: toon(0xc3c8cc),
  furDark: toon(0x4c5565),
  mask: toon(0x111827),
  blue: toon(0x1c4b7e),
  blueDark: toon(0x12345a),
  blueLight: toon(0x3f80b6),
  gold: toon(0xf4b43f, { emissive: 0x6a3d08, emissiveIntensity: .42 }),
  goldDark: toon(0xa96617),
  cream: toon(0xf3e3be),
  leather: toon(0x5a3b26),
  black: toon(0x080d18),
  red: toon(0xe4503b, { emissive: 0x4a0c06, emissiveIntensity: .3 }),
  teal: toon(0x2fae9d),
  stone: toon(0x1b2841),
  stoneDark: toon(0x111d32),
  iron: toon(0x202d42),
  glass: new THREE.MeshToonMaterial({ color: 0x8be3e6, gradientMap, transparent: true, opacity: .34, emissive: 0x1d6e7c, emissiveIntensity: .5 }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff453a }),
  laserCore: new THREE.MeshBasicMaterial({ color: 0xffd8c7 }),
  neonGold: new THREE.MeshBasicMaterial({ color: 0xffd374 }),
  neonRed: new THREE.MeshBasicMaterial({ color: 0xff5a45 }),
};
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x050a13, side: THREE.BackSide });

function outline(mesh, scale = 1.065) {
  const clone = new THREE.Mesh(mesh.geometry, outlineMat);
  clone.position.copy(mesh.position);
  clone.rotation.copy(mesh.rotation);
  clone.scale.copy(mesh.scale).multiplyScalar(scale);
  clone.castShadow = false;
  clone.receiveShadow = false;
  clone.renderOrder = -1;
  mesh.parent.add(clone);
  return clone;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function sphere(r, mat, x = 0, y = 0, z = 0, w = 12, h = 9) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function sprite(tex, scale, color = 0xffffff, opacity = 1) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.scale.set(scale, scale, 1);
  return sp;
}

function mergeGroupByMaterial(root, { keepSprites = true } = {}) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const sprites = [];
  root.traverse((obj) => {
    if (obj === root) return;
    if (obj.isSprite) {
      if (keepSprites) {
        const p = new THREE.Vector3();
        obj.getWorldPosition(p);
        p.applyMatrix4(inv);
        const clone = obj.clone();
        clone.position.copy(p);
        sprites.push(clone);
      }
      return;
    }
    if (!obj.isMesh || obj.isInstancedMesh || Array.isArray(obj.material)) return;
    obj.updateWorldMatrix(true, false);
    const m = new THREE.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    let geo = obj.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(m);
    const key = `${obj.material.uuid}|${obj.renderOrder}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: obj.material, renderOrder: obj.renderOrder, geometries: [] };
      buckets.set(key, bucket);
    }
    bucket.geometries.push(geo);
  });
  root.clear();
  for (const bucket of buckets.values()) {
    if (!bucket.geometries.length) continue;
    const merged = mergeGeometries(bucket.geometries, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.renderOrder = bucket.renderOrder;
    mesh.castShadow = !LOW_POWER;
    mesh.receiveShadow = !LOW_POWER;
    root.add(mesh);
  }
  for (const sp of sprites) root.add(sp);
  return root;
}

/* ---------------- LIGHTS ---------------- */
scene.add(new THREE.HemisphereLight(0x91b6ea, 0x11162a, 1.05));
const ambient = new THREE.AmbientLight(0x334b75, .62);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0xffe2b8, 2.4);
moonLight.position.set(-16, 25, 10);
moonLight.castShadow = !LOW_POWER;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.left = -16;
moonLight.shadow.camera.right = 16;
moonLight.shadow.camera.top = 20;
moonLight.shadow.camera.bottom = -10;
moonLight.shadow.camera.near = .5;
moonLight.shadow.camera.far = 60;
moonLight.shadow.bias = -.0015;
scene.add(moonLight);
scene.add(moonLight.target);
moonLight.target.position.set(0, 0, -12);

const rimLight = new THREE.DirectionalLight(0x4d9bff, 1.7);
rimLight.position.set(12, 10, -15);
scene.add(rimLight);

const warmLight = new THREE.PointLight(0xffa63d, 18, 28, 2);
warmLight.position.set(-4, 4, 5);
scene.add(warmLight);

/* ---------------- SKY ---------------- */
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(280, 32, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x030a18) },
      mid: { value: new THREE.Color(0x0b1d42) },
      low: { value: new THREE.Color(0x224271) },
      horizon: { value: new THREE.Color(0xd26a42) },
      sun: { value: new THREE.Color(0xffa64d) },
    },
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 horizon; uniform vec3 sun;
      void main(){
        vec3 d = normalize(vPos);
        float h = d.y;
        vec3 col = mix(horizon, low, smoothstep(-0.035, 0.11, h));
        col = mix(col, mid, smoothstep(0.06, 0.32, h));
        col = mix(col, top, smoothstep(0.28, 0.82, h));
        float glow = pow(max(0.0, dot(d, normalize(vec3(-0.36, 0.045, -1.0)))), 10.0);
        col += sun * glow * 0.34;
        float haze = pow(max(0.0, dot(d, normalize(vec3(0.42, 0.03, -1.0)))), 18.0);
        col += vec3(0.32,0.18,0.36) * haze * 0.42;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
);
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(520 * 3);
for (let i = 0; i < 520; i++) {
  const theta = rnd(0, TAU);
  const y = rnd(.08, 1);
  const r = Math.sqrt(1 - y * y);
  starPositions[i * 3] = Math.cos(theta) * r * 230;
  starPositions[i * 3 + 1] = y * 230;
  starPositions[i * 3 + 2] = Math.sin(theta) * r * 230;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff1ce, size: .8, sizeAttenuation: true, transparent: true, opacity: .65, depthWrite: false }));
scene.add(stars);

const moonGlow = sprite(glowTex, 42, 0xffcb7b, .55);
moonGlow.position.set(45, 44, -155);
scene.add(moonGlow);
const moon = new THREE.Mesh(new THREE.SphereGeometry(4.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffedbe }));
moon.position.set(45, 44, -156);
scene.add(moon);
const moonShade = new THREE.Mesh(new THREE.SphereGeometry(4.35, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe1a95d, transparent: true, opacity: .26 }));
moonShade.position.set(47.2, 43.3, -155.5);
scene.add(moonShade);

const cloudMat = new THREE.MeshBasicMaterial({ color: 0x2a3b64, transparent: true, opacity: .28, depthWrite: false });
const clouds = [];
for (let i = 0; i < 9; i++) {
  const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), cloudMat);
  c.position.set(rnd(-130, 130), rnd(30, 70), rnd(-220, -120));
  c.scale.set(rnd(12, 32), rnd(1.2, 3.2), rnd(4, 10));
  scene.add(c);
  clouds.push(c);
}

function coneLight(x, z, color = 0xffefc1) {
  const geo = new THREE.ConeGeometry(7, 60, 22, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: .045, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(geo, mat);
  cone.position.set(x, 27, z);
  cone.rotation.z = x > 0 ? -.32 : .32;
  scene.add(cone);
  return cone;
}
const searchLights = [coneLight(-38, -106), coneLight(43, -92, 0xa8d8ff)];

/* ---------------- PARIS SKYLINE ---------------- */
function beamBetween(a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 5), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

const eiffel = new THREE.Group();
const towerMat = toon(0x171f2f, { emissive: 0x221509, emissiveIntensity: .35 });
const towerGold = new THREE.MeshBasicMaterial({ color: 0xffba4d });
const towerPoints = [
  new THREE.Vector3(-7, 0, 0), new THREE.Vector3(7, 0, 0),
  new THREE.Vector3(-7, 0, 5), new THREE.Vector3(7, 0, 5),
];
const towerTop = new THREE.Vector3(0, 43, 2.5);
for (const p of towerPoints) {
  eiffel.add(beamBetween(p, towerTop, .34, towerMat));
  eiffel.add(beamBetween(p, new THREE.Vector3(0, 13, 2.5), .5, towerMat));
}
for (const [y, w, d] of [[13, 11.5, 7.5], [25, 6.7, 4.6], [36, 3.5, 2.8]]) {
  const p = box(w, .55, d, towerMat, 0, y, 2.5);
  eiffel.add(p);
  const light = new THREE.Mesh(new THREE.BoxGeometry(w * .88, .08, .08), towerGold);
  light.position.set(0, y - .35, d / 2 + 2.6);
  eiffel.add(light);
}
for (let i = 0; i < 8; i++) {
  const y = 2 + i * 4.8;
  const spread = lerp(6.5, .7, i / 7);
  eiffel.add(beamBetween(new THREE.Vector3(-spread, y, 2.5), new THREE.Vector3(spread, y + 4.8, 2.5), .08, towerMat));
  eiffel.add(beamBetween(new THREE.Vector3(-spread, y + 4.8, 2.5), new THREE.Vector3(spread, y, 2.5), .08, towerMat));
}
const spire = beamBetween(new THREE.Vector3(0, 43, 2.5), new THREE.Vector3(0, 52, 2.5), .14, towerMat);
eiffel.add(spire);
const towerBeacon = sprite(glowTex, 8, 0xffc66a, .9);
towerBeacon.position.set(0, 52, 2.5);
eiffel.add(towerBeacon);
eiffel.position.set(-49, -4, -144);
eiffel.rotation.y = .12;
eiffel.scale.setScalar(1.15);
mergeGroupByMaterial(eiffel, { keepSprites: true });
scene.add(eiffel);

const farCity = new THREE.Group();
const farMats = [0x0a152b, 0x0b1933, 0x091326].map((color) => new THREE.MeshToonMaterial({ color, gradientMap }));
const beaconPositions = [];
for (let i = 0; i < 46; i++) {
  const h = rnd(12, 62);
  const w = rnd(7, 21);
  const d = rnd(5, 18);
  const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(farMats));
  const x = rnd(-145, 145);
  const z = rnd(-240, -195);
  building.position.set(x, -5 - rnd(0, 12) + h / 2, z);
  farCity.add(building);
  if (Math.random() > .65) beaconPositions.push(x, -5 + h / 2 + .4, z);
}
mergeGroupByMaterial(farCity, { keepSprites: false });
farCity.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
const beaconGeo = new THREE.BufferGeometry();
beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beaconPositions, 3));
const beacons = new THREE.Points(beaconGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffb45c, size: 2.3, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(farCity, beacons);

/* ---------------- MOVING CITY ---------------- */
const CHUNK_LEN = 240;
const buildingMats = windowTexes.map((tex) => new THREE.MeshToonMaterial({
  map: tex,
  color: 0xffffff,
  gradientMap,
  emissive: 0x5b4016,
  emissiveMap: tex,
  emissiveIntensity: .72,
}));
const roofMats = [toon(0x172840), toon(0x1d304c), toon(0x122138)];
const citySignMats = [
  new THREE.MeshBasicMaterial({ map: neonSignTexture('HOTEL', 'OPEN ALL NIGHT', '#f7bd49') }),
  new THREE.MeshBasicMaterial({ map: neonSignTexture('JAZZ', 'PARIS · FRANCE', '#52d4c4') }),
  new THREE.MeshBasicMaterial({ map: neonSignTexture('LE CHAT', 'NO COPS ALLOWED', '#ff6d55') }),
];
const citySource = new THREE.Group();
for (let i = 0; i < 30; i++) {
  const group = new THREE.Group();
  const side = i % 2 === 0 ? -1 : 1;
  const width = rnd(9, 19);
  const depth = rnd(10, 20);
  const height = rnd(18, 56);
  const top = rnd(-5, 7);
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), pick(buildingMats));
  body.position.y = top - height / 2;
  body.receiveShadow = true;
  group.add(body);

  group.add(box(width + .8, .7, depth + .8, pick(roofMats), 0, top + .2, 0));
  group.add(box(width + 1.1, .18, depth + 1.1, MAT.stoneDark, 0, top + .65, 0));

  if (Math.random() > .52) {
    const w = rnd(1.6, 3.4), h = rnd(1.2, 3.4);
    group.add(box(w, h, rnd(1.5, 2.8), MAT.stoneDark, rnd(-width * .25, width * .25), top + .7 + h / 2, rnd(-depth * .3, depth * .3)));
  }
  if (Math.random() > .63) {
    const tank = cyl(1.05, 1.15, 1.8, MAT.leather, rnd(-width * .25, width * .25), top + 1.55, rnd(-depth * .25, depth * .25), 10);
    group.add(tank);
    group.add(cyl(1.13, 1.13, .12, MAT.iron, tank.position.x, top + 2.48, tank.position.z, 10));
  }
  if (Math.random() > .70) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), pick(citySignMats));
    sign.position.set(side * -1 * (width / 2 + .08), rnd(5, 9), depth / 2 + .05);
    sign.rotation.y = side > 0 ? Math.PI : 0;
    group.add(sign);
  }

  group.position.set(side * rnd(16.5, 54), 0, -rnd(0, CHUNK_LEN));
  citySource.add(group);
}
mergeGroupByMaterial(citySource, { keepSprites: false });
citySource.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
const cityChunkA = citySource;
const cityChunkB = citySource.clone();
cityChunkA.position.z = 12;
cityChunkB.position.z = 12 - CHUNK_LEN;
scene.add(cityChunkA, cityChunkB);
const cityChunks = [cityChunkA, cityChunkB];

/* ---------------- ROOFTOP WORLD ---------------- */
const trackSource = new THREE.Group();
const roofMat = new THREE.MeshToonMaterial({ map: roofTex, color: 0xffffff, gradientMap });
const laneMat = new THREE.MeshBasicMaterial({ map: laneTex, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
const goldCapMat = toon(0xc98a27, { emissive: 0x5a3006, emissiveIntensity: .55 });

function roofProp(seg, side) {
  const x = side * rnd(4.45, 4.95);
  const z = rnd(-7.5, 7.5);
  const type = Math.random();
  if (type < .25) {
    const g = new THREE.Group();
    g.add(box(1.15, 1.25, 1.15, MAT.stoneDark, 0, .62, 0));
    g.add(box(1.35, .15, 1.35, MAT.stone, 0, 1.3, 0));
    g.add(box(.55, .16, .55, MAT.stoneDark, 0, 1.42, 0));
    g.position.set(x, 0, z);
    seg.add(g);
  } else if (type < .48) {
    const g = new THREE.Group();
    g.add(box(1.2, .55, .85, MAT.iron, 0, .28, 0));
    for (let i = -2; i <= 2; i++) g.add(box(.07, .42, .04, MAT.stoneDark, i * .18, .30, -.44));
    g.position.set(x, 0, z);
    seg.add(g);
  } else if (type < .68) {
    const g = new THREE.Group();
    g.add(cyl(.64, .72, .95, MAT.leather, 0, .48, 0, 10));
    g.add(cyl(.68, .68, .08, MAT.iron, 0, .98, 0, 10));
    g.position.set(x, 0, z);
    seg.add(g);
  } else if (type < .84) {
    const g = new THREE.Group();
    g.add(box(1.5, .18, 1.1, MAT.glass, 0, .1, 0));
    g.add(box(1.7, .18, .14, MAT.iron, 0, .12, .58));
    g.add(box(1.7, .18, .14, MAT.iron, 0, .12, -.58));
    g.position.set(x, 0, z);
    seg.add(g);
  } else {
    const g = new THREE.Group();
    const pole = cyl(.055, .07, 1.65, MAT.iron, 0, .82, 0, 6);
    g.add(pole);
    const orb = sphere(.13, MAT.neonGold, 0, 1.72, 0, 8, 6);
    g.add(orb);
    g.position.set(side * 5.25, 0, z);
    seg.add(g);
  }
}

function makeRoofSegment(i) {
  const seg = new THREE.Group();
  const base = box(11.9, 1.5, SEG_LEN + .2, MAT.stoneDark, 0, -.76, 0);
  base.receiveShadow = true;
  seg.add(base);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(11.8, SEG_LEN + .2), roofMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = .006;
  top.receiveShadow = true;
  seg.add(top);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(11.5, SEG_LEN + .2), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = .022;
  seg.add(lane);

  for (const side of [-1, 1]) {
    const wall = box(.42, .92, SEG_LEN + .15, MAT.stone, side * 5.86, .35, 0);
    seg.add(wall);
    const cap = box(.55, .11, SEG_LEN + .1, goldCapMat, side * 5.86, .84, 0);
    seg.add(cap);
    for (let z = -7; z <= 7; z += 7) {
      const stud = box(.16, .09, .18, MAT.neonGold, side * 5.86, .92, z);
      seg.add(stud);
    }
  }

  const sides = Math.random() > .5 ? [1, -1] : [-1, 1];
  roofProp(seg, sides[0]);
  if (Math.random() > .38) roofProp(seg, sides[1]);

  if (Math.random() > .84) {
    const puddle = new THREE.Mesh(new THREE.PlaneGeometry(rnd(2.2, 4.2), rnd(1.2, 2.6)), new THREE.MeshBasicMaterial({ color: 0x6fb7db, transparent: true, opacity: .12, depthWrite: false }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(rnd(-2.4, 2.4), .032, rnd(-7, 7));
    seg.add(puddle);
  }

  seg.position.z = -i * SEG_LEN;
  trackSource.add(seg);
  return seg;
}
for (let i = 0; i < SEG_COUNT; i++) makeRoofSegment(i);

// A couple of rooftop billboards, carried along with the rooftops.
function makeBillboard(label, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  const frame = box(6.9, 3.5, .24, MAT.stoneDark, 0, 0, 0);
  g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 3.1), new THREE.MeshBasicMaterial({ map: neonSignTexture(label, 'THE COOPER JOB · PARIS', '#f7bd49') }));
  face.position.z = .14;
  g.add(face);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  trackSource.add(g);
  return g;
}
makeBillboard('CASINO', -8.8, 4.7, -64, .22);
makeBillboard('LE CHAT', 8.8, 5.2, -174, -.22);

mergeGroupByMaterial(trackSource, { keepSprites: false });
trackSource.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
const trackChunkA = trackSource;
const trackChunkB = trackSource.clone();
trackChunkA.position.z = 12;
trackChunkB.position.z = 12 - CHUNK_LEN;
scene.add(trackChunkA, trackChunkB);
const trackChunks = [trackChunkA, trackChunkB];

/* ---------------- THE RACCOON ---------------- */
const hero = new THREE.Group();
const heroRig = new THREE.Group();
hero.add(heroRig);
scene.add(hero);
hero.position.set(1.7, 0, -1.2);

const upper = new THREE.Group();
upper.position.y = .95;
heroRig.add(upper);

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.315, .28, 5, 12), MAT.blue);
torso.position.set(0, .37, 0);
torso.scale.set(.96, 1, .74);
torso.castShadow = true;
upper.add(torso);
outline(torso, 1.055);

const chest = new THREE.Mesh(new THREE.SphereGeometry(.23, 12, 8), MAT.cream);
chest.position.set(0, .42, -.20);
chest.scale.set(.9, 1.08, .42);
upper.add(chest);

const vestTrimL = box(.04, .58, .05, MAT.gold, -.16, .38, -.245);
const vestTrimR = box(.04, .58, .05, MAT.gold, .16, .38, -.245);
upper.add(vestTrimL, vestTrimR);

const belt = box(.67, .12, .48, MAT.leather, 0, .02, 0);
upper.add(belt);
const buckle = box(.15, .12, .04, MAT.gold, 0, .02, -.27);
upper.add(buckle);
const buckleGem = new THREE.Mesh(new THREE.OctahedronGeometry(.052, 0), MAT.neonGold);
buckleGem.position.set(0, .02, -.30);
buckleGem.rotation.z = Math.PI / 4;
upper.add(buckleGem);

const neckScarf = new THREE.Mesh(new THREE.TorusGeometry(.205, .055, 6, 14), MAT.red);
neckScarf.position.set(0, .76, 0);
neckScarf.rotation.x = Math.PI / 2;
upper.add(neckScarf);

const headGroup = new THREE.Group();
headGroup.position.set(0, .93, -.01);
upper.add(headGroup);

const skull = sphere(.335, MAT.fur, 0, 0, 0, 18, 14);
skull.scale.set(1.05, .96, .98);
headGroup.add(skull);
outline(skull, 1.055);

const maskBand = box(.51, .13, .08, MAT.mask, 0, .045, -.295);
maskBand.rotation.x = -.04;
headGroup.add(maskBand);
for (const side of [-1, 1]) {
  const patch = sphere(.13, MAT.mask, side * .145, .055, -.287, 12, 8);
  patch.scale.set(1.18, .87, .46);
  headGroup.add(patch);
  const eye = sphere(.059, MAT.cream, side * .142, .055, -.348, 12, 9);
  eye.scale.set(.9, 1.08, .6);
  headGroup.add(eye);
  const pupil = sphere(.027, MAT.gold, side * .145, .055, -.381, 8, 6);
  headGroup.add(pupil);
  const glint = sphere(.011, MAT.cream, side * .133, .069, -.403, 6, 4);
  headGroup.add(glint);
}
const muzzle = sphere(.185, MAT.furLight, 0, -.09, -.30, 14, 10);
muzzle.scale.set(1.0, .69, .86);
headGroup.add(muzzle);
outline(muzzle, 1.05);
const nose = new THREE.Mesh(new THREE.SphereGeometry(.073, 10, 7), MAT.black);
nose.position.set(0, -.025, -.446);
nose.scale.set(1.08, .8, .78);
headGroup.add(nose);
const mouth = box(.105, .014, .02, MAT.black, 0, -.16, -.408);
headGroup.add(mouth);

for (const side of [-1, 1]) {
  const ear = sphere(.145, MAT.fur, side * .275, .27, .015, 12, 9);
  ear.scale.set(.74, 1.05, .45);
  headGroup.add(ear);
  const inner = sphere(.082, MAT.mask, side * .275, .27, -.018, 10, 7);
  inner.scale.set(.65, 1, .3);
  headGroup.add(inner);
}

const cap = new THREE.Mesh(new THREE.SphereGeometry(.365, 18, 10, 0, TAU, 0, Math.PI / 2), MAT.blue);
cap.position.set(0, .075, 0);
cap.scale.set(1.03, .82, 1.04);
cap.castShadow = true;
headGroup.add(cap);
outline(cap, 1.045);
const capBand = new THREE.Mesh(new THREE.TorusGeometry(.315, .036, 6, 18), MAT.gold);
capBand.position.set(0, .1, 0);
capBand.rotation.x = Math.PI / 2;
capBand.scale.z = .85;
headGroup.add(capBand);
const brim = box(.53, .055, .22, MAT.blueDark, 0, .09, -.34);
brim.rotation.x = .08;
headGroup.add(brim);
const capPin = new THREE.Mesh(new THREE.OctahedronGeometry(.055, 0), MAT.gold);
capPin.position.set(0, .285, -.302);
capPin.scale.set(.8, 1.2, .55);
headGroup.add(capPin);

// Arms
function makeArm(side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * .405, .61, 0);
  upper.add(pivot);
  const shoulder = sphere(.128, MAT.blueDark, 0, 0, 0, 10, 8);
  pivot.add(shoulder);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.082, .30, 4, 9), MAT.fur);
  arm.position.set(0, -.24, 0);
  arm.castShadow = true;
  pivot.add(arm);
  const cuff = cyl(.098, .098, .08, MAT.gold, 0, -.43, 0, 8);
  pivot.add(cuff);
  const hand = sphere(.092, MAT.black, 0, -.515, -.015, 9, 7);
  pivot.add(hand);
  return { pivot, hand };
}
const armL = makeArm(-1);
const armR = makeArm(1);

// Cane
const cane = new THREE.Group();
cane.position.set(0, -.50, .02);
cane.rotation.z = -.09;
armR.pivot.add(cane);
const caneShaft = cyl(.026, .029, 1.08, MAT.gold, 0, -.34, 0, 7);
cane.add(caneShaft);
const caneGrip = cyl(.038, .038, .21, MAT.leather, 0, .1, 0, 7);
cane.add(caneGrip);
const hook = new THREE.Mesh(new THREE.TorusGeometry(.095, .029, 6, 14, Math.PI * 1.25), MAT.gold);
hook.position.set(0, .25, 0);
hook.rotation.z = .25;
cane.add(hook);

// Legs
function makeLeg(side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * .165, .91, 0);
  heroRig.add(pivot);
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.105, .33, 4, 9), MAT.blueDark);
  thigh.position.set(0, -.27, 0);
  thigh.castShadow = true;
  pivot.add(thigh);
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.09, .24, 4, 9), MAT.furDark);
  shin.position.set(0, -.58, -.005);
  shin.castShadow = true;
  pivot.add(shin);
  const boot = box(.19, .19, .34, MAT.leather, 0, -.78, -.055);
  pivot.add(boot);
  const sole = box(.205, .055, .37, MAT.black, 0, -.885, -.065);
  pivot.add(sole);
  const buckle2 = box(.075, .075, .025, MAT.gold, side * .005, -.73, -.235);
  pivot.add(buckle2);
  return pivot;
}
const legL = makeLeg(-1);
const legR = makeLeg(1);

// Tail
const tailRoot = new THREE.Group();
tailRoot.position.set(0, .08, .20);
upper.add(tailRoot);
const tailSegments = [];
for (let i = 0; i < 8; i++) {
  const t = i / 7;
  const r = .17 - i * .011;
  const mat = i % 2 === 0 ? MAT.fur : MAT.furDark;
  const seg = sphere(
    r,
    mat,
    Math.sin(t * Math.PI * .62) * .52,
    .03 + Math.sin(t * Math.PI * .8) * .62,
    .10 + t * .72,
    10,
    8
  );
  seg.scale.set(1, 1, 1.14);
  tailRoot.add(seg);
  tailSegments.push(seg);
}
const tailTip = sphere(.085, MAT.mask, .56, .32, .86, 8, 6);
tailRoot.add(tailTip);

// A little gold insignia on the back of the vest
const backPin = new THREE.Mesh(new THREE.TorusGeometry(.085, .022, 5, 10), MAT.gold);
backPin.position.set(0, .44, .25);
upper.add(backPin);

// Collapse static detail into a handful of draw calls while keeping the rig animatable.
mergeGroupByMaterial(headGroup, { keepSprites: false });
mergeGroupByMaterial(tailRoot, { keepSprites: false });
const torsoStatic = new THREE.Group();
for (const child of [...upper.children]) {
  if (child.isMesh) torsoStatic.add(child);
}
upper.add(torsoStatic);
mergeGroupByMaterial(torsoStatic, { keepSprites: false });

hero.traverse((obj) => {
  if (obj.isMesh && obj.material !== outlineMat) obj.castShadow = !LOW_POWER;
});

/* ---------------- HERO ANIMATION ---------------- */
const heroAnim = { phase: 0, laneTilt: 0, menuTime: 0 };
let menuBlend = 1; // 1 = title pose, 0 = chase pose
let gameplayBlend = 0;

function animateHero(dt, mode) {
  const running = mode === 'playing' || mode === 'starting';
  const speedNow = state.speed || 18;
  heroAnim.menuTime += dt;

  if (mode === 'menu') {
    const t = heroAnim.menuTime;
    hero.rotation.y = Math.PI + .17;
    hero.position.set(1.75, Math.sin(t * 1.15) * .012, -1.2);
    heroAnim.phase = 0;
    upper.rotation.set(-.02 + Math.sin(t * 1.2) * .012, -.03, 0);
    upper.position.y = .95;
    headGroup.rotation.set(.03, Math.sin(t * .8) * .08, 0);
    armL.pivot.rotation.set(-.38, .12, .42 + Math.sin(t * 1.1) * .02);
    armR.pivot.rotation.set(-.82, -.05, -.30);
    legL.rotation.set(.10, 0, -.05);
    legR.rotation.set(-.14, 0, .08);
    tailRoot.rotation.set(-.15, Math.sin(t * 1.4) * .13, .09 + Math.sin(t * 1.05) * .04);
    cane.rotation.z = -.12;
  } else {
    const air = clamp(state.jumpY / 1.15, 0, 1);
    const slide = state.slideT > 0;
    const sway = Math.sin(heroAnim.phase);
    const bob = Math.abs(Math.sin(heroAnim.phase * 2));

    if (slide) {
      upper.rotation.x = damp(upper.rotation.x, -1.05, 18, dt);
      upper.position.y = damp(upper.position.y, .61, 16, dt);
      upper.rotation.z = damp(upper.rotation.z, 0, 12, dt);
      legL.rotation.x = damp(legL.rotation.x, -1.16, 16, dt);
      legR.rotation.x = damp(legR.rotation.x, -1.02, 16, dt);
      legL.rotation.z = -.08;
      legR.rotation.z = .08;
      armL.pivot.rotation.x = damp(armL.pivot.rotation.x, .7, 14, dt);
      armR.pivot.rotation.x = damp(armR.pivot.rotation.x, .85, 14, dt);
      armL.pivot.rotation.z = .24;
      armR.pivot.rotation.z = -.22;
      headGroup.rotation.x = .34;
      tailRoot.rotation.z = .18;
    } else if (air > .08) {
      upper.rotation.x = damp(upper.rotation.x, -.20, 12, dt);
      upper.position.y = damp(upper.position.y, .95, 14, dt);
      legL.rotation.x = damp(legL.rotation.x, -.90 - air * .25, 12, dt);
      legR.rotation.x = damp(legR.rotation.x, .55 + air * .25, 12, dt);
      legL.rotation.z = -.06;
      legR.rotation.z = .06;
      armL.pivot.rotation.x = damp(armL.pivot.rotation.x, -1.25, 11, dt);
      armR.pivot.rotation.x = damp(armR.pivot.rotation.x, -1.0, 11, dt);
      armL.pivot.rotation.z = .5;
      armR.pivot.rotation.z = -.5;
      headGroup.rotation.x = -.06;
      tailRoot.rotation.set(.15, 0, -.12);
    } else {
      heroAnim.phase += dt * (8.3 + speedNow * .19);
      const runSway = Math.sin(heroAnim.phase);
      upper.rotation.x = damp(upper.rotation.x, -.13, 12, dt);
      upper.position.y = damp(upper.position.y, .95 + bob * .028, 14, dt);
      upper.rotation.z = damp(upper.rotation.z, runSway * .018, 9, dt);
      legL.rotation.x = runSway * .96;
      legR.rotation.x = -runSway * .96;
      legL.rotation.z = -.04;
      legR.rotation.z = .04;
      armL.pivot.rotation.x = -runSway * .83;
      armR.pivot.rotation.x = runSway * .68;
      armL.pivot.rotation.z = .16;
      armR.pivot.rotation.z = -.15;
      headGroup.rotation.set(Math.sin(heroAnim.phase * 2) * .018, 0, -runSway * .018);
      tailRoot.rotation.set(-.03, Math.sin(elapsed * 4.1) * .16, .08 + Math.sin(elapsed * 3.1) * .055);
    }

    hero.rotation.y = damp(hero.rotation.y, 0, 9, dt);
    hero.position.x = damp(hero.position.x, state.playerX, 13, dt);
    hero.position.z = damp(hero.position.z, 0, 9, dt);
    hero.position.y = state.jumpY;
    heroRig.rotation.z = damp(heroRig.rotation.z, -clamp(state.playerX - hero.position.x, -3, 3) * .04, 9, dt);
    heroRig.rotation.x = damp(heroRig.rotation.x, slide ? .08 : 0, 10, dt);
    cane.rotation.z = damp(cane.rotation.z, slide ? .65 : -.09, 9, dt);
  }
}

/* ---------------- OBSTACLES ---------------- */
const obstacleGroup = new THREE.Group();
scene.add(obstacleGroup);
const obstacles = [];
const obstaclePools = { barrier: [], guard: [], laser: [], sign: [], crate: [], vent: [] };

const barrierMat = new THREE.MeshToonMaterial({ map: hazardTex, gradientMap });
const signFaceTex = neonSignTexture('CASINO', 'SLIDE UNDER', '#ff765c');
const crateMat = toon(0x8b5a32);
const crateBand = toon(0x3a2617);

function buildBarrier() {
  const g = new THREE.Group();
  const panel = box(2.45, .55, .15, barrierMat, 0, .7, 0);
  g.add(panel);
  g.add(box(2.58, .075, .19, MAT.stoneDark, 0, 1.01, 0));
  g.add(box(2.58, .075, .19, MAT.stoneDark, 0, .40, 0));
  for (const side of [-1, 1]) {
    g.add(box(.11, .42, .12, MAT.iron, side * 1.04, .22, 0));
    g.add(box(.55, .08, .52, MAT.stoneDark, side * 1.04, .035, 0));
  }
  const lamp = sphere(.09, MAT.neonRed, 0, 1.07, 0, 8, 6);
  g.add(lamp);
  const glow = sprite(glowTex, 1.1, 0xff6b45, .55);
  glow.position.set(0, 1.09, 0);
  g.add(glow);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'barrier', kind: 'low', halfWidth: 1.25, colliderHeight: 1.02 };
  return g;
}

function buildGuard() {
  const g = new THREE.Group();
  const uniform = toon(0x183e70);
  const uniformLight = toon(0x2b5a92);
  for (const side of [-1, 1]) {
    g.add(box(.23, .63, .28, MAT.black, side * .18, .33, 0));
    g.add(box(.27, .11, .39, MAT.black, side * .18, .06, -.03));
  }
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.37, .46, 4, 10), uniform);
  body.position.y = 1.16;
  body.scale.z = .78;
  body.castShadow = true;
  g.add(body);
  g.add(box(.39, .34, .06, uniformLight, 0, 1.19, -.30));
  g.add(box(.72, .13, .43, MAT.black, 0, .83, 0));
  g.add(box(.15, .1, .04, MAT.gold, 0, .91, -.27));
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.105, .42, 4, 8), uniformLight);
    arm.position.set(side * .43, 1.08, 0);
    arm.rotation.z = side * .12;
    arm.castShadow = true;
    g.add(arm);
    g.add(sphere(.105, MAT.black, side * .46, .77, -.03, 8, 6));
  }
  const head = sphere(.285, toon(0xa46b4d), 0, 1.82, 0, 14, 10);
  head.scale.set(1.02, .95, .95);
  g.add(head);
  const snout = sphere(.16, toon(0xd6a377), 0, 1.73, -.235, 10, 7);
  snout.scale.set(.92, .68, .9);
  g.add(snout);
  g.add(sphere(.072, MAT.black, 0, 1.76, -.36, 8, 6));
  for (const side of [-1, 1]) {
    g.add(sphere(.035, MAT.black, side * .105, 1.86, -.27, 6, 4));
    const ear = sphere(.09, toon(0x8d5941), side * .23, 2.03, .01, 8, 6);
    ear.scale.set(.7, .8, .45);
    g.add(ear);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.29, 14, 8, 0, TAU, 0, Math.PI / 2), uniform);
  cap.position.y = 1.98;
  cap.scale.set(1.04, .8, 1.04);
  g.add(cap);
  g.add(box(.53, .07, .22, MAT.black, 0, 2.04, -.25));
  g.add(box(.15, .09, .03, MAT.gold, 0, 2.09, -.235));
  const badge = new THREE.Mesh(new THREE.OctahedronGeometry(.065, 0), MAT.gold);
  badge.position.set(.19, 1.35, -.29);
  badge.scale.z = .4;
  g.add(badge);
  const flashlight = new THREE.Mesh(new THREE.CylinderGeometry(.055, .075, .24, 7), MAT.iron);
  flashlight.position.set(.47, .55, -.01);
  flashlight.rotation.x = .2;
  g.add(flashlight);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'guard', kind: 'tall', halfWidth: .56, colliderHeight: 2.3 };
  return g;
}

function buildLaser() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    g.add(box(.16, 2.55, .18, MAT.iron, side * 1.28, 1.25, 0));
    g.add(box(.5, .13, .55, MAT.stoneDark, side * 1.28, .065, 0));
    g.add(box(.25, .24, .24, MAT.neonRed, side * 1.28, 2.47, 0));
  }
  for (let i = 0; i < 3; i++) {
    const y = 1.26 + i * .35;
    const bar = cyl(.033, .033, 2.48, MAT.laser, 0, y, 0, 6);
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
    const core = cyl(.012, .012, 2.48, MAT.laserCore, 0, y, 0, 5);
    core.rotation.z = Math.PI / 2;
    g.add(core);
  }
  const glow = sprite(glowTex, 3.2, 0xff342b, .50);
  glow.position.set(0, 1.6, 0);
  g.add(glow);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'laser', kind: 'overhead', halfWidth: 1.3, colliderHeight: 2.45 };
  return g;
}

function buildSign() {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    g.add(box(.13, 2.35, .14, MAT.iron, side * 1.3, 1.17, .04));
    g.add(box(.45, .08, .48, MAT.stoneDark, side * 1.3, .04, .04));
  }
  const board = box(2.65, 1.0, .18, MAT.stoneDark, 0, 2.1, 0);
  g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.48, .88), new THREE.MeshBasicMaterial({ map: signFaceTex }));
  face.position.set(0, 2.1, .10);
  g.add(face);
  const glow = sprite(glowTex, 3.1, 0xff9d55, .34);
  glow.position.set(0, 2.1, .3);
  g.add(glow);
  const lampA = sphere(.07, MAT.neonGold, -.96, 2.68, .05, 6, 4);
  const lampB = sphere(.07, MAT.neonGold, .96, 2.68, .05, 6, 4);
  g.add(lampA, lampB);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'sign', kind: 'overhead', halfWidth: 1.32, colliderHeight: 2.58 };
  return g;
}

function buildCrate() {
  const g = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const c = box(1.45, .85, 1.15, crateMat, 0, .45 + i * .84, 0);
    g.add(c);
    g.add(box(1.49, .085, 1.19, crateBand, 0, .45 + i * .84, 0));
    g.add(box(.1, .84, 1.18, crateBand, -.5, .45 + i * .84, 0));
    g.add(box(.1, .84, 1.18, crateBand, .5, .45 + i * .84, 0));
  }
  const tag = box(.34, .23, .03, MAT.cream, .18, 1.22, -.59);
  g.add(tag);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'crate', kind: 'tall', halfWidth: .78, colliderHeight: 1.72 };
  return g;
}

function buildVent() {
  const g = new THREE.Group();
  const body = box(2.25, .52, 1.0, MAT.iron, 0, .27, 0);
  g.add(body);
  for (let i = -3; i <= 3; i++) {
    g.add(box(.08, .4, .09, MAT.stoneDark, i * .27, .29, -.52));
  }
  g.add(box(2.37, .07, 1.09, MAT.stone, 0, .55, 0));
  const steam = sprite(coolGlowTex, 1.4, 0x93cbe8, .2);
  steam.position.set(.5, .83, 0);
  g.add(steam);
  mergeGroupByMaterial(g, { keepSprites: true });
  g.userData = { type: 'vent', kind: 'low', halfWidth: 1.14, colliderHeight: .68 };
  return g;
}

const builders = { barrier: buildBarrier, guard: buildGuard, laser: buildLaser, sign: buildSign, crate: buildCrate, vent: buildVent };

function acquireObstacle(type) {
  const pool = obstaclePools[type];
  let obj = pool.pop();
  if (!obj) {
    obj = builders[type]();
    obstacleGroup.add(obj);
  }
  obj.visible = true;
  return obj;
}
function releaseObstacle(obj) {
  obj.visible = false;
  obstaclePools[obj.userData.type].push(obj);
  const i = obstacles.indexOf(obj);
  if (i >= 0) obstacles.splice(i, 1);
}
function spawnObstacle(type, lane, z, extra = {}) {
  const obj = acquireObstacle(type);
  obj.position.set(LANES[lane], 0, z);
  obj.rotation.set(0, type === 'barrier' ? rnd(-.035, .035) : 0, 0);
  obj.userData.lane = lane;
  obj.userData.z = z;
  Object.assign(obj.userData, extra);
  obstacles.push(obj);
  return obj;
}

/* ---------------- COINS & LOOT ---------------- */
const MAX_COINS = 110;
const coins = [];
const freeCoinSlots = Array.from({ length: MAX_COINS }, (_, i) => i);
const coinGeo = new THREE.CylinderGeometry(.31, .31, .075, 14);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshToonMaterial({ color: 0xffc24b, gradientMap, emissive: 0xb65a06, emissiveIntensity: .65 });
const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, MAX_COINS);
coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
coinMesh.frustumCulled = false;
coinMesh.castShadow = false;
scene.add(coinMesh);
const coinDummy = new THREE.Object3D();
const hiddenCoinMatrix = new THREE.Matrix4().makeScale(0, 0, 0).setPosition(0, -200, 0);
function updateCoinInstance(c) {
  coinDummy.position.set(c.x, c.y, c.z);
  coinDummy.rotation.set(0, c.rotation, 0);
  coinDummy.scale.set(1, 1, 1);
  coinDummy.updateMatrix();
  coinMesh.setMatrixAt(c.slot, coinDummy.matrix);
  coinMesh.instanceMatrix.needsUpdate = true;
}
for (let i = 0; i < MAX_COINS; i++) coinMesh.setMatrixAt(i, hiddenCoinMatrix);
coinMesh.instanceMatrix.needsUpdate = true;

function spawnCoin(lane, y, z, value = 10) {
  const slot = freeCoinSlots.pop();
  if (slot === undefined) return null;
  const c = {
    slot,
    x: LANES[lane],
    y,
    z,
    baseY: y,
    value,
    rotation: rnd(0, TAU),
    collected: false,
  };
  coins.push(c);
  updateCoinInstance(c);
  return c;
}
function releaseCoin(c) {
  c.collected = true;
  const i = coins.indexOf(c);
  if (i >= 0) coins.splice(i, 1);
  coinMesh.setMatrixAt(c.slot, hiddenCoinMatrix);
  coinMesh.instanceMatrix.needsUpdate = true;
  freeCoinSlots.push(c.slot);
}

function coinLine(lane, z, count = 6, gap = 2.2, y = 1.08) {
  for (let i = 0; i < count; i++) spawnCoin(lane, y, z - i * gap);
}
function coinArc(lane, z, count = 7, gap = 2.1) {
  const peak = 2.25;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const y = 1.04 + Math.sin(t * Math.PI) * (peak - 1.04);
    spawnCoin(lane, y, z - (i - 3) * gap);
  }
}

/* ---------------- POWER-UPS ---------------- */
const powerConfig = {
  magnet: { color: 0x5be7ff, label: 'MAGNET', duration: 8, icon: '⌁' },
  shield: { color: 0xffd25b, label: 'SHIELD', duration: 8, icon: '◆' },
  boost: { color: 0xff8154, label: 'TURBO', duration: 6, icon: 'ϟ' },
};
const powerGroup = new THREE.Group();
scene.add(powerGroup);
const powerUps = [];
const powerPool = { magnet: [], shield: [], boost: [] };

function iconTexture(kind) {
  const cfg = powerConfig[kind];
  const draw = {
    magnet: (ctx, w, h) => {
      ctx.strokeStyle = '#fff7d8'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(w / 2, h / 2 + 5, 21, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 - 21, h / 2 + 5); ctx.lineTo(w / 2 - 21, h / 2 + 26); ctx.moveTo(w / 2 + 21, h / 2 + 5); ctx.lineTo(w / 2 + 21, h / 2 + 26); ctx.stroke();
    },
    shield: (ctx, w, h) => {
      ctx.fillStyle = '#fff7d8';
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 30); ctx.lineTo(w / 2 + 25, h / 2 - 15); ctx.lineTo(w / 2 + 19, h / 2 + 18); ctx.lineTo(w / 2, h / 2 + 32); ctx.lineTo(w / 2 - 19, h / 2 + 18); ctx.lineTo(w / 2 - 25, h / 2 - 15); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = cfg.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - 12); ctx.lineTo(w / 2, h / 2 + 18); ctx.stroke();
    },
    boost: (ctx, w, h) => {
      ctx.fillStyle = '#fff7d8';
      ctx.beginPath(); ctx.moveTo(w / 2 + 8, h / 2 - 33); ctx.lineTo(w / 2 - 19, h / 2 + 3); ctx.lineTo(w / 2 - 1, h / 2 + 3); ctx.lineTo(w / 2 - 9, h / 2 + 33); ctx.lineTo(w / 2 + 24, h / 2 - 7); ctx.lineTo(w / 2 + 5, h / 2 - 7); ctx.closePath(); ctx.fill();
    },
  }[kind];
  return texture(canvas2d(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.48)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    draw(ctx, w, h);
  }), [1, 1]);
}
const powerIconTex = { magnet: iconTexture('magnet'), shield: iconTexture('shield'), boost: iconTexture('boost') };

function makePowerUp(kind) {
  const cfg = powerConfig[kind];
  const g = new THREE.Group();
  const core = sphere(.34, new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: .34 }), 0, 0, 0, 12, 9);
  g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.48, .035, 6, 22), new THREE.MeshBasicMaterial({ color: cfg.color }));
  g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.48, .02, 5, 22), new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: .55 }));
  ring2.rotation.x = Math.PI / 2;
  g.add(ring2);
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: powerIconTex[kind], transparent: true, depthWrite: false }));
  icon.scale.set(.86, .86, 1);
  g.add(icon);
  const glow = sprite(glowTex, 2.6, cfg.color, .55);
  g.add(glow);
  g.userData = { type: 'power', kind, collected: false, z: 0 };
  return g;
}
function spawnPowerUp(kind, lane, z) {
  let p = powerPool[kind].pop();
  if (!p) {
    p = makePowerUp(kind);
    powerGroup.add(p);
  }
  p.visible = true;
  p.position.set(LANES[lane], 1.25, z);
  p.userData.collected = false;
  p.userData.z = z;
  powerUps.push(p);
  return p;
}
function releasePowerUp(p) {
  p.visible = false;
  const i = powerUps.indexOf(p);
  if (i >= 0) powerUps.splice(i, 1);
  powerPool[p.userData.kind].push(p);
}

/* ---------------- PARTICLES ---------------- */
const PARTICLE_COUNT = 260;
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleColors = new Float32Array(PARTICLE_COUNT * 3);
const particleVel = new Float32Array(PARTICLE_COUNT * 3);
const particleLife = new Float32Array(PARTICLE_COUNT);
const particleMax = new Float32Array(PARTICLE_COUNT);
const particleSizes = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) particlePositions[i * 3 + 1] = -200;
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
const particleMat = new THREE.PointsMaterial({ size: .18, vertexColors: true, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending });
const particlePoints = new THREE.Points(particleGeo, particleMat);
particlePoints.frustumCulled = false;
scene.add(particlePoints);
let particleCursor = 0;

function spawnParticles(pos, color, count = 12, force = 3.2, gravity = 5, size = .2) {
  const c = new THREE.Color(color);
  for (let n = 0; n < count; n++) {
    const i = particleCursor++ % PARTICLE_COUNT;
    particlePositions[i * 3] = pos.x + rnd(-.16, .16);
    particlePositions[i * 3 + 1] = pos.y + rnd(-.16, .16);
    particlePositions[i * 3 + 2] = pos.z + rnd(-.16, .16);
    const theta = rnd(0, TAU);
    const up = rnd(.2, 1.2);
    particleVel[i * 3] = Math.cos(theta) * force * rnd(.3, 1);
    particleVel[i * 3 + 1] = up * force * .7;
    particleVel[i * 3 + 2] = Math.sin(theta) * force * rnd(.3, 1);
    particleColors[i * 3] = c.r;
    particleColors[i * 3 + 1] = c.g;
    particleColors[i * 3 + 2] = c.b;
    particleLife[i] = particleMax[i] = rnd(.38, .9);
    particleSizes[i] = size;
  }
  particleGeo.attributes.position.needsUpdate = true;
  particleGeo.attributes.color.needsUpdate = true;
}
function updateParticles(dt) {
  let any = false;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (particleLife[i] <= 0) continue;
    any = true;
    particleLife[i] -= dt;
    if (particleLife[i] <= 0) {
      particlePositions[i * 3 + 1] = -200;
      continue;
    }
    particleVel[i * 3 + 1] -= 6.5 * dt;
    particlePositions[i * 3] += particleVel[i * 3] * dt;
    particlePositions[i * 3 + 1] += particleVel[i * 3 + 1] * dt;
    particlePositions[i * 3 + 2] += particleVel[i * 3 + 2] * dt;
    if (particlePositions[i * 3 + 1] < .05) {
      particlePositions[i * 3 + 1] = .05;
      particleVel[i * 3 + 1] *= -.32;
      particleVel[i * 3] *= .72;
      particleVel[i * 3 + 2] *= .72;
    }
  }
  if (any) particleGeo.attributes.position.needsUpdate = true;
}
function spawnDust() {
  const pos = new THREE.Vector3(state.playerX + rnd(-.2, .2), .15, .2);
  const i = particleCursor++ % PARTICLE_COUNT;
  particlePositions[i * 3] = pos.x;
  particlePositions[i * 3 + 1] = pos.y;
  particlePositions[i * 3 + 2] = pos.z;
  particleVel[i * 3] = rnd(-.4, .4);
  particleVel[i * 3 + 1] = rnd(.3, .8);
  particleVel[i * 3 + 2] = rnd(1.2, 2.4);
  particleColors[i * 3] = .42; particleColors[i * 3 + 1] = .56; particleColors[i * 3 + 2] = .78;
  particleLife[i] = particleMax[i] = rnd(.28, .5);
  particleGeo.attributes.position.needsUpdate = true;
  particleGeo.attributes.color.needsUpdate = true;
}

/* ---------------- GAME STATE ---------------- */
const state = {
  mode: 'menu',
  speed: 3.2,
  baseSpeed: 19,
  distance: 0,
  score: 0,
  coinScore: 0,
  coins: 0,
  lives: 3,
  lane: 1,
  playerX: 0,
  jumpY: 0,
  jumpV: 0,
  grounded: true,
  slideT: 0,
  invuln: 0,
  comboCount: 0,
  comboTimer: 0,
  multiplier: 1,
  bestCombo: 1,
  spawnCountdown: 22,
  nextPowerUp: 220,
  power: { magnet: 0, shield: 0, boost: 0 },
  transition: 0,
  shake: 0,
  lastDust: 0,
  startedAt: 0,
  hintTimer: 0,
  hitStop: 0,
  endTimer: 0,
};
let best = 0;
try { best = Number(localStorage.getItem('slyRunsBest') || 0) || 0; } catch { best = 0; }
dom.menuBest.textContent = best.toLocaleString('en-US');

/* ---------------- BLOB SHADOW ---------------- */
const blobTex = new THREE.CanvasTexture(canvas2d(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(0,0,0,.72)');
  g.addColorStop(.45, 'rgba(0,0,0,.42)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}));
blobTex.colorSpace = THREE.SRGBColorSpace;
const heroShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.1, 2.6),
  new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: .6, depthWrite: false })
);
heroShadow.rotation.x = -Math.PI / 2;
heroShadow.position.set(0, .045, 0);
heroShadow.renderOrder = 2;
scene.add(heroShadow);
function updateHeroShadow() {
  const airFade = clamp(1 - state.jumpY * .22, .55, 1);
  heroShadow.position.set(hero.position.x, .045, hero.position.z + .05);
  heroShadow.scale.setScalar(Math.max(.45, airFade));
  heroShadow.material.opacity = .58 * airFade;
}

/* ---------------- POWER AURA ---------------- */
const auraGroup = new THREE.Group();
auraGroup.position.y = 1.0;
hero.add(auraGroup);
const auraCore = new THREE.Mesh(
  new THREE.SphereGeometry(.95, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd25b, transparent: true, opacity: .09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
);
auraGroup.add(auraCore);
const auraRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.0, .018, 5, 30), new THREE.MeshBasicMaterial({ color: 0xffd25b, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending }));
auraRing1.rotation.x = Math.PI / 2.4;
auraGroup.add(auraRing1);
const auraRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.08, .012, 5, 30), new THREE.MeshBasicMaterial({ color: 0xffd25b, transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending }));
auraRing2.rotation.x = -Math.PI / 3;
auraGroup.add(auraRing2);
auraGroup.visible = false;

/* ---------------- UI HELPERS ---------------- */
function padScore(n) { return Math.max(0, Math.floor(n)).toString().padStart(6, '0'); }
function updateHud() {
  dom.score.textContent = padScore(state.score);
  dom.distance.textContent = Math.floor(state.distance * .52).toLocaleString('en-US');
  dom.coins.textContent = state.coins.toLocaleString('en-US');
  dom.multiplier.textContent = `x${state.multiplier}`;
  const heat = clamp(state.distance / 1800 + (state.speed - 18) / 55, 0, 1);
  dom.heatFill.style.width = `${Math.max(6, heat * 100)}%`;
  dom.heatLabel.textContent = heat > .82 ? 'SWARMING' : heat > .56 ? 'HIGH' : heat > .28 ? 'RISING' : 'LOW';
  dom.lives.forEach((el, i) => el.classList.toggle('is-lost', i >= state.lives));
  for (const el of dom.powers) {
    const kind = el.dataset.power;
    const t = state.power[kind];
    const duration = powerConfig[kind].duration;
    el.classList.toggle('active', t > 0);
    const bar = el.querySelector('i b');
    if (bar) bar.style.transform = `scaleX(${clamp(t / duration, 0, 1)})`;
  }
}
let calloutTimer = 0;
function showCallout(text, danger = false, duration = 1.15) {
  dom.callout.textContent = text;
  dom.callout.classList.toggle('danger', danger);
  dom.callout.classList.add('show');
  clearTimeout(calloutTimer);
  calloutTimer = setTimeout(() => dom.callout.classList.remove('show'), duration * 1000);
}
let comboTimeout = 0;
function showCombo(text, duration = 1.0) {
  dom.comboToast.textContent = text;
  dom.comboToast.classList.add('show');
  clearTimeout(comboTimeout);
  comboTimeout = setTimeout(() => dom.comboToast.classList.remove('show'), duration * 1000);
}
function flashHit() {
  document.body.classList.remove('hit-flash', 'shake');
  void document.body.offsetWidth;
  document.body.classList.add('hit-flash', 'shake');
  setTimeout(() => document.body.classList.remove('hit-flash', 'shake'), 480);
}

/* ---------------- AUDIO ---------------- */
class HeistAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.nextNote = 0;
  }
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = .9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = .105;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = .34;
    this.sfxGain.connect(this.master);
    this.noiseBuffer = this.makeNoise();
    this.startMusic();
  }
  makeNoise() {
    const len = this.ctx.sampleRate * 1.2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .9, this.ctx.currentTime, .04);
  }
  env(node, gain, attack, decay, when) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), when + attack);
    g.gain.exponentialRampToValueAtTime(.0001, when + attack + decay);
    node.connect(g);
    g.connect(this.sfxGain);
    return g;
  }
  tone(freq, when, duration, type = 'sine', gain = .14, slide = 0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), when + duration);
    g.gain.setValueAtTime(.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + .012);
    g.gain.exponentialRampToValueAtTime(.0001, when + duration);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + duration + .03);
  }
  noise(when, duration, gain = .06, freq = 1400) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = .8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(.0001, when + duration);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(when); src.stop(when + duration + .02);
  }
  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(1046, t, .09, 'triangle', .10, 360);
    this.tone(1568, t + .035, .12, 'sine', .075, 260);
  }
  jump() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(190, t, .22, 'sine', .085, 380);
    this.noise(t, .14, .035, 900);
  }
  slide() {
    if (!this.ctx) return;
    this.noise(this.ctx.currentTime, .24, .06, 620);
  }
  hit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(95, t, .36, 'sawtooth', .16, -45);
    this.tone(160, t + .02, .3, 'square', .06, -60);
    this.noise(t, .28, .11, 340);
  }
  power() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, t + i * .06, .2, 'triangle', .075, 30));
  }
  ui() {
    if (!this.ctx) return;
    this.tone(440, this.ctx.currentTime, .07, 'triangle', .05, 120);
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + .15;
    this.musicTimer = setInterval(() => this.schedule(), 100);
  }
  schedule() {
    if (!this.ctx) return;
    while (this.nextNote < this.ctx.currentTime + .45) {
      this.musicStep(this.step, this.nextNote);
      this.step = (this.step + 1) % 32;
      this.nextNote += .265;
    }
  }
  musicStep(step, when) {
    const bassNotes = [55, 0, 55, 0, 65.41, 0, 55, 0, 73.42, 0, 65.41, 0, 58.27, 0, 55, 0];
    const bass = bassNotes[step % 16];
    if (bass) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bass;
      g.gain.setValueAtTime(.0001, when);
      g.gain.exponentialRampToValueAtTime(.13, when + .02);
      g.gain.exponentialRampToValueAtTime(.0001, when + .22);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(when); osc.stop(when + .26);
    }
    if (step % 4 === 2) {
      this.noiseMusic(when, .04, .022, 6000);
    }
    if (step % 8 === 0) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, when);
      osc.frequency.exponentialRampToValueAtTime(55, when + .16);
      g.gain.setValueAtTime(.12, when);
      g.gain.exponentialRampToValueAtTime(.0001, when + .2);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(when); osc.stop(when + .23);
    }
    if (step % 8 === 4) {
      const chord = step % 16 === 4 ? [220, 261.6, 329.6] : [174.6, 220, 261.6];
      chord.forEach((f) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(.0001, when);
        g.gain.exponentialRampToValueAtTime(.035, when + .22);
        g.gain.exponentialRampToValueAtTime(.0001, when + 1.0);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(when); osc.stop(when + 1.05);
      });
    }
  }
  noiseMusic(when, dur, gain, freq) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(.0001, when + dur);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(when); src.stop(when + dur + .02);
  }
}
const audio = new HeistAudio();

/* ---------------- SPAWNING ---------------- */
function laneCoins(lane, z, n = 6, gap = 2.1) { coinLine(lane, z, n, gap); }

function populateRunway() {
  coinLine(1, -10, 4, 2.1);
  coinLine(1, -25, 5, 2.15);
  spawnObstacle('barrier', 1, -48);
  coinArc(1, -48, 7, 1.9);

  spawnObstacle('guard', 0, -73);
  spawnObstacle('guard', 1, -73);
  coinLine(2, -64, 6, 2.05);

  spawnObstacle('laser', 0, -98);
  spawnObstacle('sign', 2, -98);
  coinLine(1, -89, 6, 2.05);

  spawnObstacle('crate', 0, -125);
  spawnObstacle('crate', 2, -125);
  coinLine(1, -116, 6, 2.05);

  spawnPowerUp('shield', 2, -86);
}

function spawnPatternRow() {
  const d = state.distance;
  const hard = clamp((d - 180) / 1500, 0, 1);
  const roll = Math.random();
  const open = (Math.random() * 3) | 0;
  const other = (open + 1 + ((Math.random() * 2) | 0)) % 3;
  const third = 3 - open - other;
  const z = SPAWN_Z;

  if (roll < .18) {
    // A lone low barrier with a coin arc.
    spawnObstacle('barrier', open, z);
    coinArc(open, z, 7, 1.85);
    coinLine(other, z + 7, 4, 2.1);
  } else if (roll < .35) {
    // Two guards, one open lane.
    spawnObstacle('guard', open, z);
    spawnObstacle('guard', other, z);
    coinLine(third, z + 7, 6, 2.05);
  } else if (roll < .49) {
    // Laser gate / hanging sign: slide or move over.
    spawnObstacle('laser', open, z);
    if (hard > .25) spawnObstacle('vent', other, z + 1.5);
    coinLine(other, z + 8, 5, 2.0);
    if (Math.random() > .58) spawnCoin(open, 1.0, z - 2.2);
  } else if (roll < .63) {
    // Low vents across two lanes: jump!
    spawnObstacle('vent', open, z);
    spawnObstacle('vent', other, z);
    coinLine(third, z + 7, 5, 2.0);
  } else if (roll < .78) {
    // Crate stack and a guard, leaving one lane.
    spawnObstacle('crate', open, z);
    spawnObstacle('guard', other, z + 2.2);
    coinLine(third, z + 7, 5, 2.0);
  } else if (roll < .90) {
    // Sign you can duck under, with coins underneath.
    spawnObstacle('sign', open, z);
    coinLine(open, z + 5, 5, 1.9, .95);
    if (hard > .4) spawnObstacle('barrier', other, z + 2.6);
  } else {
    // Zig-zag: a tall blocker, a low blocker, one clean lane.
    spawnObstacle('crate', open, z);
    spawnObstacle('barrier', other, z + 2.2);
    coinLine(third, z + 8, 6, 2.0);
  }

  if (state.distance > state.nextPowerUp) {
    state.nextPowerUp += rnd(230, 330);
    const kinds = ['magnet', 'shield', 'boost'];
    spawnPowerUp(pick(kinds), (Math.random() * 3) | 0, z - 14);
  }
}

function spawnUpdate(dt) {
  state.spawnCountdown -= state.speed * dt;
  if (state.spawnCountdown <= 0) {
    spawnPatternRow();
    state.spawnCountdown += rnd(27, 39) * (1 - clamp((state.speed - 19) / 40, 0, .22));
  }
}

/* ---------------- ACTIONS ---------------- */
function moveLane(dir) {
  if (state.mode !== 'playing' && state.mode !== 'starting') return;
  const next = clamp(state.lane + dir, 0, 2);
  if (next === state.lane) return;
  state.lane = next;
  state.playerX = LANES[next];
  audio.ui();
}
function jump() {
  if (state.mode !== 'playing' && state.mode !== 'starting') return;
  if (!state.grounded || state.slideT > 0) return;
  state.jumpV = 11.2;
  state.grounded = false;
  state.slideT = 0;
  spawnParticles(new THREE.Vector3(state.playerX, .2, 0), 0x9dd9ff, 10, 2.0, 4, .12);
  audio.jump();
}
function slide() {
  if (state.mode !== 'playing' && state.mode !== 'starting') return;
  if (state.slideT > 0) return;
  state.slideT = .62;
  if (state.jumpY > .2) {
    state.jumpV = Math.min(state.jumpV, -5);
  }
  audio.slide();
}

function clearDynamic() {
  while (obstacles.length) releaseObstacle(obstacles[obstacles.length - 1]);
  while (coins.length) releaseCoin(coins[coins.length - 1]);
  while (powerUps.length) releasePowerUp(powerUps[powerUps.length - 1]);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particleLife[i] = 0;
    particlePositions[i * 3 + 1] = -200;
  }
  particleGeo.attributes.position.needsUpdate = true;
}

/* ---------------- COLLISION ---------------- */
function collectCoin(c) {
  const pos = new THREE.Vector3(c.x, c.y, c.z);
  const value = c.value;
  releaseCoin(c);
  state.coins++;
  state.comboCount++;
  state.comboTimer = 2.15;
  state.multiplier = Math.min(8, 1 + Math.floor(state.comboCount / 7));
  state.bestCombo = Math.max(state.bestCombo, state.multiplier);
  state.coinScore += value * state.multiplier;
  spawnParticles(pos, 0xffd36b, 8, 2.7, 4, .14);
  audio.coin();
  if (state.comboCount % 7 === 0) showCombo(`COMBO x${state.multiplier}`);
}
function collectPower(p) {
  p.userData.collected = true;
  const kind = p.userData.kind;
  const pos = p.position.clone();
  releasePowerUp(p);
  state.power[kind] = Math.max(state.power[kind], powerConfig[kind].duration);
  if (kind === 'boost') {
    state.invuln = Math.max(state.invuln, .5);
    showCallout('TURBO!', false, 1.0);
  } else if (kind === 'shield') {
    showCallout('SHIELD UP', false, 1.0);
  } else {
    showCallout('MAGNET!', false, 1.0);
  }
  spawnParticles(pos, powerConfig[kind].color, 24, 4.2, 3, .18);
  audio.power();
}
function damagePlayer(obstacle) {
  if (state.invuln > 0) return;
  const pos = obstacle.position.clone().add(new THREE.Vector3(0, .8, 0));
  releaseObstacle(obstacle);
  spawnParticles(pos, 0xff8c5c, 26, 5, 5, .2);
  if (state.power.shield > 0) {
    state.power.shield = 0;
    state.invuln = .75;
    showCallout('SHIELD SAVED YOU', false, 1.15);
    audio.power();
    return;
  }
  state.lives--;
  state.invuln = 1.65;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.multiplier = 1;
  state.shake = .52;
  state.hitStop = .12;
  flashHit();
  audio.hit();
  if (state.lives <= 0) {
    state.mode = 'dying';
    state.endTimer = .55;
    showCallout('BUSTED!', true, 1.2);
  } else {
    showCallout(pick(['BUSTED!', 'OOF!', 'WATCH IT!']), true, .85);
  }
}
function checkCollisions(dt) {
  // coins
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (state.power.magnet > 0 && c.z < 15 && c.z > -2.5) {
      c.x = damp(c.x, state.playerX, 11, dt);
      c.y = damp(c.y, state.jumpY + 1.0, 8, dt);
      c.z = damp(c.z, 0, 2.2, dt);
    }
    const dx = Math.abs(c.x - state.playerX);
    const dz = Math.abs(c.z);
    const dy = Math.abs(c.y - (state.jumpY + (state.slideT > 0 ? .72 : 1.12)));
    if (dx < .92 && dz < 1.0 && dy < (state.power.magnet > 0 ? 1.6 : .95)) collectCoin(c);
  }
  // power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    const dx = Math.abs(p.position.x - state.playerX);
    const dz = Math.abs(p.position.z);
    const dy = Math.abs(p.position.y - (state.jumpY + 1.0));
    if (dx < 1.0 && dz < 1.0 && dy < 1.25) collectPower(p);
  }
  // obstacles
  if (state.invuln > 0) return;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const dz = Math.abs(o.position.z);
    if (dz > 1.2) continue;
    const dx = Math.abs(o.position.x - state.playerX);
    if (dx > o.userData.halfWidth + .27) continue;
    const kind = o.userData.kind;
    let safe = false;
    if (kind === 'low') safe = state.jumpY > o.userData.colliderHeight * .78;
    else if (kind === 'overhead') safe = state.slideT > 0 && state.jumpY < .3;
    if (!safe) damagePlayer(o);
  }
}

/* ---------------- WORLD UPDATE ---------------- */
function updateWorld(dt) {
  const speed = state.speed;
  for (const chunk of trackChunks) {
    chunk.position.z += speed * dt;
    if (chunk.position.z > 12 + CHUNK_LEN) chunk.position.z -= CHUNK_LEN * 2;
  }
  for (const chunk of cityChunks) {
    chunk.position.z += speed * .82 * dt;
    if (chunk.position.z > 12 + CHUNK_LEN) chunk.position.z -= CHUNK_LEN * 2;
  }
  clouds.forEach((c, i) => {
    c.position.x += Math.sin(elapsed * .05 + i) * .015;
  });
  searchLights[0].rotation.z = -.32 + Math.sin(elapsed * .28) * .22;
  searchLights[1].rotation.z = .32 + Math.sin(elapsed * .22 + 2) * .19;
  moonLight.position.x = -16 + Math.sin(elapsed * .07) * 2;

  if (state.mode === 'playing' || state.mode === 'starting') {
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.position.z += speed * dt;
      if (o.position.z > 12) releaseObstacle(o);
    }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.z += speed * dt;
      c.rotation += dt * 4.7;
      c.y = c.baseY + Math.sin(elapsed * 3.1 + c.z * .22) * .06;
      updateCoinInstance(c);
      if (c.z > 12) releaseCoin(c);
    }
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const p = powerUps[i];
      p.position.z += speed * dt;
      p.rotation.y += dt * 1.8;
      p.position.y = 1.27 + Math.sin(elapsed * 2.4 + p.position.z) * .09;
      if (p.position.z > 12) releasePowerUp(p);
    }
    spawnUpdate(dt);
  }
  updateParticles(dt);
}

/* ---------------- CAMERA ---------------- */
const camLook = new THREE.Vector3();
const menuCamPos = new THREE.Vector3();
const menuCamLook = new THREE.Vector3();
const gameCamPos = new THREE.Vector3();
const gameCamLook = new THREE.Vector3();

function updateCamera(dt) {
  const t = elapsed;
  const narrow = window.innerWidth < 700;
  menuCamPos.set(
    (narrow ? 4.45 : 4.8) + Math.sin(t * .24) * .22,
    (narrow ? 4.5 : 3.35) + Math.sin(t * .43) * .04,
    narrow ? 9.7 : 7.4
  );
  menuCamLook.set(narrow ? .18 : -1.55, narrow ? 3.4 : 1.16, -2.6);

  const speedN = clamp((state.speed - 18) / 22, 0, 1);
  const boost = state.power.boost > 0 ? .35 : 0;
  gameCamPos.set(
    state.playerX * .37 + Math.sin(t * 5.2) * .018,
    (narrow ? 4.9 : 4.55) + state.jumpY * .10 + speedN * .13 + Math.sin(t * 9) * .014,
    (narrow ? 10.2 : 9.15) - speedN * .55 - boost * .4
  );
  gameCamLook.set(state.playerX * .46, 1.28 + state.jumpY * .04, -11.2);

  if (state.mode === 'menu') {
    camera.position.lerp(menuCamPos, 1 - Math.exp(-2.8 * dt));
    camLook.lerp(menuCamLook, 1 - Math.exp(-3.0 * dt));
  } else {
    camera.position.lerp(gameCamPos, 1 - Math.exp(-9 * dt));
    camLook.lerp(gameCamLook, 1 - Math.exp(-10 * dt));
  }

  if (state.shake > 0) {
    const s = state.shake;
    camera.position.x += rnd(-1, 1) * s * .24;
    camera.position.y += rnd(-1, 1) * s * .18;
    camera.position.z += rnd(-1, 1) * s * .12;
    state.shake = Math.max(0, state.shake - dt * 2.3);
  }
  camera.lookAt(camLook);
  camera.rotation.z += Math.sin(t * 2.2) * .0008;
  const targetFov = state.mode === 'menu' ? (narrow ? 52 : 44) : (narrow ? 66 : 55) + speedN * 3 + boost * 4;
  camera.fov = damp(camera.fov, targetFov, 3.5, dt);
  camera.updateProjectionMatrix();
}

/* ---------------- RUN LIFECYCLE ---------------- */
function resetRunState() {
  state.distance = 0;
  state.score = 0;
  state.coinScore = 0;
  state.coins = 0;
  state.lives = 3;
  state.lane = 1;
  state.playerX = 0;
  state.jumpY = 0;
  state.jumpV = 0;
  state.grounded = true;
  state.slideT = 0;
  state.invuln = 0;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.multiplier = 1;
  state.bestCombo = 1;
  state.spawnCountdown = 25;
  state.nextPowerUp = 220;
  state.power.magnet = state.power.shield = state.power.boost = 0;
  state.shake = 0;
  state.hitStop = 0;
  state.endTimer = 0;
  state.lastDust = 0;
  hero.rotation.set(0, 0, 0);
  heroRig.rotation.set(0, 0, 0);
  upper.rotation.set(0, 0, 0);
  upper.position.y = .95;
  cane.rotation.z = -.09;
  auraGroup.visible = false;
}

function startRun() {
  const fromMenu = state.mode === 'menu';
  audio.init();
  audio.ui();
  clearDynamic();
  resetRunState();
  state.mode = 'playing';
  state.transition = .82;
  state.fromMenu = fromMenu;
  state.speed = 18.5;
  state.startedAt = elapsed;
  camera.position.set(0, 4.55, 9.15);
  camLook.set(0, 1.28, -11.2);
  camera.lookAt(camLook);
  state.hintTimer = 7;
  if (fromMenu) {
    hero.position.set(1.75, 0, -1.2);
    hero.rotation.y = Math.PI + .17;
  } else {
    hero.position.set(0, 0, 0);
    hero.rotation.y = 0;
  }
  populateRunway();
  dom.menu.hidden = false;
  dom.menu.classList.add('is-hidden');
  window.setTimeout(() => {
    if (state.mode !== 'menu' && dom.menu.classList.contains('is-hidden')) dom.menu.hidden = true;
  }, 520);
  dom.pauseScreen.hidden = true;
  dom.gameOver.hidden = true;
  dom.hintStrip.classList.remove('is-hidden');
  document.body.classList.add('in-game');
  updateHud();
  showCallout('THE HEIST IS ON', false, .9);
  setTimeout(() => { if (state.mode === 'playing') showCallout('GO!', false, .55); }, 760);
}

function endRun() {
  if (state.mode === 'over') return;
  state.mode = 'over';
  const score = Math.floor(state.score);
  const isNew = score > best;
  if (isNew) {
    best = score;
    try { localStorage.setItem('slyRunsBest', String(best)); } catch { /* ignore */ }
    dom.menuBest.textContent = best.toLocaleString('en-US');
  }
  dom.finalScore.textContent = score.toLocaleString('en-US');
  dom.finalDistance.textContent = `${Math.floor(state.distance * .52).toLocaleString('en-US')} m`;
  dom.finalCoins.textContent = state.coins.toLocaleString('en-US');
  dom.finalCombo.textContent = `x${state.bestCombo}`;
  dom.newBest.hidden = !isNew;
  dom.gameOver.hidden = false;
  dom.callout.classList.remove('show');
  dom.speedFx.style.opacity = 0;
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  dom.pauseScore.textContent = Math.floor(state.score).toLocaleString('en-US');
  dom.pauseDistance.textContent = `${Math.floor(state.distance * .52).toLocaleString('en-US')} m`;
  dom.pauseCoins.textContent = state.coins.toLocaleString('en-US');
  dom.pauseScreen.hidden = false;
  dom.callout.classList.remove('show');
  audio.ui();
}
function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  dom.pauseScreen.hidden = true;
  audio.ui();
}
function returnToMenu() {
  clearDynamic();
  trackChunks[0].position.z = 12;
  trackChunks[1].position.z = 12 - CHUNK_LEN;
  cityChunks[0].position.z = 12;
  cityChunks[1].position.z = 12 - CHUNK_LEN;
  state.mode = 'menu';
  state.speed = 3.2;
  state.distance = 0;
  state.power.magnet = state.power.shield = state.power.boost = 0;
  state.invuln = 0;
  state.jumpY = 0;
  state.slideT = 0;
  state.transition = 0;
  dom.gameOver.hidden = true;
  dom.pauseScreen.hidden = true;
  dom.menu.hidden = false;
  dom.menu.classList.remove('is-hidden');
  dom.hintStrip.classList.add('is-hidden');
  document.body.classList.remove('in-game');
  hero.position.set(1.75, 0, -1.2);
  hero.rotation.y = Math.PI + .17;
  heroRig.rotation.set(0, 0, 0);
  upper.position.y = .95;
  camera.position.copy(menuCamPos);
  camLook.copy(menuCamLook);
  auraGroup.visible = false;
  audio.ui();
}

/* ---------------- AURA & GAME UPDATE ---------------- */
function updateAura(dt) {
  const shield = state.power.shield > 0;
  const magnet = state.power.magnet > 0;
  const boost = state.power.boost > 0;
  const active = (shield || magnet || boost) && state.mode !== 'menu';
  auraGroup.visible = active;
  if (!active) return;
  const color = shield ? 0xffd25b : magnet ? 0x55e7ff : 0xff8354;
  auraCore.material.color.setHex(color);
  auraRing1.material.color.setHex(color);
  auraRing2.material.color.setHex(color);
  auraGroup.rotation.y += dt * (magnet ? 2.2 : 1.3);
  auraRing2.rotation.z += dt * 1.6;
  const pulse = 1 + Math.sin(elapsed * 4.2) * .055;
  auraGroup.scale.set(pulse, pulse, pulse);
  auraCore.material.opacity = shield ? .13 : .075;
}

function updateGame(dt) {
  if (state.mode === 'menu') {
    state.speed = damp(state.speed, 3.2, 1.2, dt);
    updateWorld(dt);
    return;
  }
  if (state.mode === 'paused' || state.mode === 'over') {
    if (state.mode === 'over') state.speed = damp(state.speed, 0, 1.6, dt);
    updateWorld(dt);
    state.shake = Math.max(0, state.shake - dt * 2.3);
    return;
  }

  if (state.mode === 'starting') {
    state.transition += dt;
    const p = smooth(clamp(state.transition / .82, 0, 1));
    state.speed = lerp(8.5, 19.5, p);
    state.distance += state.speed * dt;
    if (state.transition >= .82) {
      state.mode = 'playing';
      state.transition = .82;
    }
  } else if (state.mode === 'dying') {
    state.speed = damp(state.speed, 4, 4, dt);
    state.distance += state.speed * dt;
    state.endTimer -= dt;
    state.shake = Math.max(0, state.shake - dt * 2.3);
    if (state.endTimer <= 0) {
      endRun();
      return;
    }
  } else {
    state.baseSpeed = Math.min(38, 19 + state.distance * .0062);
    const boost = state.power.boost > 0 ? 1.38 : 1;
    state.speed = damp(state.speed, state.baseSpeed * boost, 2.0, dt);
    state.distance += state.speed * dt;
  }

  // Jump / gravity
  if (!state.grounded) {
    state.jumpV -= 32 * dt;
    state.jumpY += state.jumpV * dt;
    if (state.jumpY <= 0) {
      state.jumpY = 0;
      state.jumpV = 0;
      state.grounded = true;
      spawnParticles(new THREE.Vector3(state.playerX, .1, 0), 0x9dc9ff, 8, 1.8, 3, .12);
    }
  }
  if (state.slideT > 0) state.slideT = Math.max(0, state.slideT - dt);
  if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - dt);

  // Power-ups
  for (const kind of Object.keys(state.power)) {
    if (state.power[kind] > 0) state.power[kind] = Math.max(0, state.power[kind] - dt);
  }
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.comboCount = 0;
      state.multiplier = 1;
    }
  }
  if (state.power.boost > 0 && Math.random() > .55) {
    spawnParticles(new THREE.Vector3(state.playerX + rnd(-.3, .3), .2 + rnd(0, 1.2), .6), 0xff8a4b, 1, .9, 1, .1);
  }

  state.score = state.distance * 4.4 + state.coinScore;
  updateWorld(dt);
  checkCollisions(dt);
  updateAura(dt);

  state.lastDust += dt;
  if (state.grounded && state.slideT <= 0 && state.lastDust > .12) {
    state.lastDust = 0;
    spawnDust();
  }

  const sfx = clamp((state.speed - 23) / 24, 0, 1);
  dom.speedFx.style.opacity = state.mode === 'playing' ? (sfx * .40).toFixed(2) : 0;

  if (state.hintTimer > 0) {
    state.hintTimer -= dt;
    if (state.hintTimer <= 0) dom.hintStrip.classList.add('is-hidden');
  }
  updateHud();
}

/* ---------------- INPUT ---------------- */
window.addEventListener('keydown', (e) => {
  const key = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) e.preventDefault();
  if (state.mode === 'menu') {
    if (key === 'Enter' || key === ' ') startRun();
    return;
  }
  if (state.mode === 'over') {
    if (key === 'Enter' || key === ' ') startRun();
    return;
  }
  if (state.mode === 'paused') {
    if (key === 'Escape' || key === 'p' || key === 'P') resumeGame();
    return;
  }
  if (key === 'Escape' || key === 'p' || key === 'P') { pauseGame(); return; }
  if (key === 'm' || key === 'M') { toggleMute(); return; }
  if (state.mode !== 'playing' && state.mode !== 'starting') return;
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') moveLane(-1);
  else if (key === 'ArrowRight' || key === 'd' || key === 'D') moveLane(1);
  else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') jump();
  else if (key === 'ArrowDown' || key === 's' || key === 'S') slide();
}, { passive: false });

let pointerStart = null;
dom.canvas.addEventListener('pointerdown', (e) => {
  pointerStart = { x: e.clientX, y: e.clientY, t: performance.now() };
}, { passive: true });
dom.canvas.addEventListener('pointerup', (e) => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  const dt = performance.now() - pointerStart.t;
  pointerStart = null;
  if (state.mode === 'menu') return;
  if (state.mode === 'over') { startRun(); return; }
  if (state.mode === 'paused') return;
  if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else if (dy < -26) jump();
  else if (dy > 26) slide();
  else if (dt < 260 && Math.abs(dx) < 24 && Math.abs(dy) < 24) jump();
}, { passive: true });
dom.canvas.addEventListener('pointercancel', () => { pointerStart = null; }, { passive: true });

for (const btn of document.querySelectorAll('[data-action]')) {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const action = btn.dataset.action;
    if (action === 'left') moveLane(-1);
    else if (action === 'right') moveLane(1);
    else if (action === 'jump') jump();
    else if (action === 'slide') slide();
  }, { passive: false });
}

function toggleMute() {
  audio.init();
  const muted = !audio.muted;
  audio.setMuted(muted);
  dom.muteBtn.style.opacity = muted ? .38 : 1;
  dom.muteBtn.setAttribute('aria-pressed', String(muted));
}
dom.muteBtn.addEventListener('click', toggleMute);
dom.pauseBtn.addEventListener('click', () => { state.mode === 'paused' ? resumeGame() : pauseGame(); });
dom.resumeBtn.addEventListener('click', resumeGame);
dom.quitBtn.addEventListener('click', returnToMenu);
dom.menuBtn.addEventListener('click', returnToMenu);
dom.restartBtn.addEventListener('click', startRun);
dom.startBtn.addEventListener('click', startRun);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame();
});

/* ---------------- RESIZE ---------------- */
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 700 ? 1.6 : 2));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

/* ---------------- MAIN LOOP ---------------- */
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), .1);
  if (state.mode !== 'paused') {
    elapsed += dt;
    updateGame(dt);
    animateHero(dt, state.mode);
    updateHeroShadow();
    updateCamera(dt);
  } else {
    updateCamera(0);
  }
  renderer.render(scene, camera);
}

// initial framing
updateHud();
animateHero(.016, 'menu');
const startNarrow = window.innerWidth < 700;
camera.position.copy(menuCamPos.set(startNarrow ? 4.45 : 4.8, startNarrow ? 4.5 : 3.35, startNarrow ? 9.7 : 7.4));
camLook.copy(menuCamLook.set(startNarrow ? .18 : -1.55, startNarrow ? 3.4 : 1.16, -2.6));
camera.lookAt(camLook);
renderer.render(scene, camera);
requestAnimationFrame(() => dom.loader.classList.add('is-done'));
tick();

// Expose a tiny debug surface for automated visual checks.
window.__slyRuns = {
  start: startRun,
  end: endRun,
  menu: returnToMenu,
  state,
  scene,
  camera,
  renderer,
  hero,
  THREE,
};





