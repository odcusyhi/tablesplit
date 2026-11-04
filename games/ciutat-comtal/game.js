/* Ciutat Comtal — an original open-world game set in Barcelona.
   All geometry, textures, music and sound are generated in code. */
(function () {
'use strict';
const $ = id => document.getElementById(id);
if (!window.THREE) { $('title-status').textContent = 'The 3D engine could not load. Check your connection and reload the page.'; return; }

// ====================== UTIL ======================
const TAU = Math.PI * 2;
let seed = 90210;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + (b - a) * rnd();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const R = Math.random, rR = (a, b) => a + (b - a) * R(), pR = a => a[Math.floor(R() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const d2 = (ax, az, bx, bz) => { const x = ax - bx, z = az - bz; return x * x + z * z; };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;

// ====================== RENDERER ======================
const renderer = new THREE.WebGLRenderer({ antialias: !coarse, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
renderer.domElement.tabIndex = 0;
renderer.info.autoReset = false;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, 2600);
scene.fog = new THREE.Fog(0xd9d6c8, 110, 920);
const hemi = new THREE.HemisphereLight(0xe4f0ff, 0x7d6f5a, 0.65); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 520 });
sun.shadow.bias = -0.0007;
scene.add(sun); scene.add(sun.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); if (typeof post !== 'undefined') post.resize(); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); if (typeof metroCam !== 'undefined' && metroCam) { metroCam.aspect = camera.aspect; metroCam.updateProjectionMatrix(); } sizeFullmap(); });

// ====================== GEOGRAPHY ======================
// x = east, z = south (the sea is south). 1 unit = 1 metre.
const P = 80, HS = 32, CS = 14, HB = 29, CB = 11;      // Eixample pitch, sidewalk half/chamfer, building half/chamfer
const BI0 = -7, BI1 = 9, BJ0 = -7, BJ1 = 3;
const SI0 = -8, SI1 = 9, SJ0 = -8, SJ1 = 3;
const sx = si => (si + 0.5) * P, sz = sj => (sj + 0.5) * P;
const WATER_Y = -0.6, CURB = 0.18;
const MJ = { x: -860, z: 420, r: 340, h: 100 };          // Montjuïc
const DIAG = (() => { const ax = 480, az = -80, bx = -660, bz = -560; const l = Math.hypot(bx - ax, bz - az); const dx = (bx - ax) / l, dz = (bz - az) / l; return { ax, az, dx, dz, nx: -dz, nz: dx }; })();
const diagDist = (x, z) => (x - DIAG.ax) * DIAG.nx + (z - DIAG.az) * DIAG.nz;
const diagT = (x, z) => (x - DIAG.ax) * DIAG.dx + (z - DIAG.az) * DIAG.dz;
const diagPt = t => [DIAG.ax + DIAG.dx * t, DIAG.az + DIAG.dz * t];
const DIAG_T0 = -320, DIAG_T1 = 1290;
const onDiag = (x, z, w) => { const t = diagT(x, z); return t > DIAG_T0 && t < DIAG_T1 && Math.abs(diagDist(x, z)) < w; };

function terrainH(x, z) {
  let h = 0;
  const d = Math.hypot(x - MJ.x, z - MJ.z);
  if (d < MJ.r) { const s = 1 - d / MJ.r; h += MJ.h * s * s * (3 - 2 * s); }
  if (z < -680) { const t = -680 - z; h += Math.min(175, t * 0.45 + 0.0006 * t * t) * (0.85 + 0.15 * Math.sin(x * 0.006)); }
  return h;
}
function groundH(x, z) {
  let h = terrainH(x, z);
  if (z > 432 && h < 2) h = lerp(h, -4, clamp((z - 432) / 18, 0, 1));
  return h;
}

function district(x, z) {
  const t = terrainH(x, z);
  if (groundH(x, z) < WATER_Y - 0.3) return z > 450 && x < 130 ? 'Port Vell' : 'Mar Mediterrani';
  if (Math.abs(x + 160) < 32 && Math.abs(z - 160) < 32) return 'Plaça de Catalunya';
  if (Math.hypot(x - MJ.x, z - MJ.z) < MJ.r) return 'Montjuïc';
  if (d2(x, z, -100, -745) < 90 * 90) return 'Park Güell';
  if (z < -900) return 'Tibidabo';
  if (z < -640) return t > 40 ? 'Collserola' : 'Gràcia';
  if (x < -610) return z < -40 ? 'Les Corts' : 'Sants';
  if (z > 204 && x > -470 && x < 130) {
    if (Math.abs(x + 160) < 18) return 'La Rambla';
    if (x < -160) return 'El Raval';
    if (x < 20) return 'Barri Gòtic';
    return 'El Born';
  }
  if (z > 204 && x >= 130 && x < 370) return 'La Barceloneta';
  if (x >= 370 && z > 290) return 'Platja del Bogatell';
  if (x > 770) return 'Diagonal Mar';
  if (x > 360) return 'Poblenou';
  if (z < -390) return 'Gràcia';
  if (onDiag(x, z, 18)) return 'Avinguda Diagonal';
  return x > -120 ? "Dreta de l'Eixample" : "Esquerra de l'Eixample";
}

// ====================== POLYGONS ======================
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
function polyCentroid(p) { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; }
function octagon(cx, cz, h, c) { return [[cx - h + c, cz - h], [cx + h - c, cz - h], [cx + h, cz - h + c], [cx + h, cz + h - c], [cx + h - c, cz + h], [cx - h + c, cz + h], [cx - h, cz + h - c], [cx - h, cz - h + c]]; }
function rectPoly(x0, z0, x1, z1) { return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]; }
function circlePoly(cx, cz, r, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } return o; }
function clipHalf(poly, nx, nz, c) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const da = nx * a[0] + nz * a[1] - c, db = nx * b[0] + nz * b[1] - c;
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function offsetPoly(poly, d) {
  const n = poly.length, c = polyCentroid(poly), L = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;
    let nx = ez / l, nz = -ex / l;
    if (((a[0] + b[0]) / 2 - c[0]) * nx + ((a[1] + b[1]) / 2 - c[1]) * nz < 0) { nx = -nx; nz = -nz; }
    L.push([a[0] + nx * d, a[1] + nz * d, ex, ez]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = L[(i - 1 + n) % n], q = L[i];
    const cr = p[2] * q[3] - p[3] * q[2];
    if (Math.abs(cr) < 1e-6) { out.push([q[0], q[1]]); continue; }
    const t = ((q[0] - p[0]) * q[3] - (q[1] - p[1]) * q[2]) / cr;
    out.push([p[0] + p[2] * t, p[1] + p[3] * t]);
  }
  return out;
}
function pointInPoly(poly, x, z) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) ins = !ins;
  }
  return ins;
}
function pushOut(s, x, z, r) {
  if (x < s.minx - r || x > s.maxx + r || z < s.minz - r || z > s.maxz + r) return null;
  const poly = s.poly, n = poly.length;
  let best = 1e18, bx = 0, bz = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = a[0] + dx * t, cz = a[1] + dz * t, dd = (x - cx) * (x - cx) + (z - cz) * (z - cz);
    if (dd < best) { best = dd; bx = cx; bz = cz; }
  }
  const d = Math.sqrt(best);
  if (pointInPoly(poly, x, z)) { const l = d || 1; return [(bx - x) / l, (bz - z) / l, d + r]; }
  if (d < r) { const l = d || 1; return [(x - bx) / l, (z - bz) / l, r - d]; }
  return null;
}

class SHash {
  constructor(c) { this.c = c; this.m = new Map(); this.q = 0; }
  k(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  insert(o) {
    const c = this.c;
    for (let i = Math.floor(o.minx / c); i <= Math.floor(o.maxx / c); i++)
      for (let j = Math.floor(o.minz / c); j <= Math.floor(o.maxz / c); j++) {
        const k = this.k(i, j); let a = this.m.get(k); if (!a) { a = []; this.m.set(k, a); } a.push(o);
      }
  }
  query(x0, z0, x1, z1, out) {
    out.length = 0; const c = this.c, q = ++this.q;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const a = this.m.get(this.k(i, j)); if (!a) continue;
        for (const o of a) if (o._q !== q) { o._q = q; out.push(o); }
      }
    return out;
  }
}
function bbox(o) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of o.poly) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; } o.minx = a; o.maxx = b; o.minz = c; o.maxz = d; return o; }

const solidHash = new SHash(40), sideHash = new SHash(40), loopHash = new SHash(60);
const loops = [];
function addSolid(poly, top) { const s = bbox({ poly, top }); solidHash.insert(s); return s; }
function addSide(poly) { sideHash.insert(bbox({ poly })); }
function addLoop(poly, y) {
  const per = [0]; let tot = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; tot += Math.hypot(b[0] - a[0], b[1] - a[1]); per.push(tot); }
  const l = bbox({ poly, per, tot, y }); loops.push(l); loopHash.insert(l); return l;
}
function loopPoint(l, t, out) {
  t = ((t % l.tot) + l.tot) % l.tot;
  let i = 0; while (i < l.poly.length - 1 && l.per[i + 1] < t) i++;
  const a = l.poly[i], b = l.poly[(i + 1) % l.poly.length], seg = l.per[i + 1] - l.per[i];
  const f = seg > 0 ? (t - l.per[i]) / seg : 0;
  out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = Math.atan2(b[0] - a[0], b[1] - a[1]);
  return out;
}
const _qa = [], _qb = [];
function collideWorld(x, z, r, y) {
  solidHash.query(x - r, z - r, x + r, z + r, _qa);
  let px = 0, pz = 0, hit = false;
  for (const s of _qa) {
    if (y !== undefined && y > s.top) continue;
    const res = pushOut(s, x + px, z + pz, r);
    if (res) { px += res[0] * res[2]; pz += res[1] * res[2]; hit = true; }
  }
  return hit ? [px, pz] : null;
}
function solidAt(x, z, y) {
  solidHash.query(x, z, x, z, _qb);
  for (const s of _qb) if ((y === undefined || y < s.top) && x >= s.minx && x <= s.maxx && z >= s.minz && z <= s.maxz && pointInPoly(s.poly, x, z)) return true;
  return false;
}
function onSidewalk(x, z) {
  sideHash.query(x, z, x, z, _qb);
  for (const s of _qb) if (x >= s.minx && x <= s.maxx && z >= s.minz && z <= s.maxz && pointInPoly(s.poly, x, z)) return true;
  return false;
}
function los(ax, az, bx, bz, y) {
  const l = Math.hypot(bx - ax, bz - az), n = Math.ceil(l / 3);
  for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(ax + (bx - ax) * t, az + (bz - az) * t, y)) return false; }
  return true;
}
function freeSpot(x, z, r = 1.2) {
  if (!collideWorld(x, z, r)) return [x, z];
  for (let rad = 2; rad < 50; rad += 2) for (let a = 0; a < TAU; a += 0.4) {
    const px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad;
    if (!collideWorld(px, pz, r) && groundH(px, pz) > WATER_Y) return [px, pz];
  }
  return [x, z];
}
const surfH = (x, z) => groundH(x, z) + (onSidewalk(x, z) ? CURB : 0);

// ====================== TEXTURES ======================
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function canvasTex(w, h, draw, rep = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(4, maxAniso); return t;
}
const facadeCells = [];
const facadeDay = canvasTex(512, 512, g => {
  g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 512, 512);
  noiseFill(g, 512, 512, 7000, '90,70,50', '255,255,255', 0.02, 0.07);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const x = c * 64, y = r * 64, cell = { shut: rnd() < 0.5, half: rnd() < 0.5, balc: rnd() < 0.65, ac: rnd() < 0.12, plant: rnd() < 0.25 };
    facadeCells.push(cell);
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x, y + 56, 64, 2); g.fillStyle = 'rgba(60,45,30,0.25)'; g.fillRect(x, y + 58, 64, 4);
    const sg = g.createLinearGradient(0, y + 58, 0, y + 64 + 18); sg.addColorStop(0, 'rgba(70,58,45,0.22)'); sg.addColorStop(1, 'rgba(70,58,45,0)'); g.fillStyle = sg; g.fillRect(x + 18, y + 58, 28, 24);
    g.fillStyle = '#e7e0d3'; g.fillRect(x + 13, y + 6, 38, 52); g.fillStyle = 'rgba(40,30,20,0.35)'; g.fillRect(x + 49, y + 6, 2, 52); g.fillRect(x + 13, y + 56, 38, 2);
    g.fillStyle = '#1d1f22'; g.fillRect(x + 17, y + 10, 30, 46);
    const gr = g.createLinearGradient(0, y + 12, 0, y + 54); gr.addColorStop(0, '#8aa2b4'); gr.addColorStop(0.55, '#3d4c58'); gr.addColorStop(1, '#1e262d'); g.fillStyle = gr; g.fillRect(x + 19, y + 12, 26, 42);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.moveTo(x + 19, y + 12); g.lineTo(x + 29, y + 12); g.lineTo(x + 21, y + 54); g.lineTo(x + 19, y + 54); g.fill();
    g.fillStyle = '#d9d2c4'; g.fillRect(x + 31, y + 12, 2, 42);
    if (cell.shut) {
      const col = pick(['#3f6e50', '#4f7d58', '#7b5236', '#46627e', '#6b7a3e', '#8a6b3c']);
      const rects = cell.half ? [[x + 19, y + 12, 26, 22]] : [[x + 17, y + 10, 9, 46], [x + 38, y + 10, 9, 46]];
      for (const q of rects) { g.fillStyle = col; g.fillRect(q[0], q[1], q[2], q[3]); for (let k = q[1] + 1; k < q[1] + q[3]; k += 3) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(q[0], k, q[2], 1); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(q[0], k + 1, q[2], 1); } }
    }
    if (cell.balc) {
      g.fillStyle = '#cfc7b8'; g.fillRect(x + 8, y + 53, 48, 4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 8, y + 57, 48, 3);
      g.strokeStyle = '#191919'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 9, y + 38); g.lineTo(x + 55, y + 38); g.moveTo(x + 9, y + 41); g.lineTo(x + 55, y + 41);
      for (let k = 0; k <= 11; k++) { const xx = x + 9 + k * 4.2; g.moveTo(xx, y + 38); g.lineTo(xx, y + 53); } g.stroke();
      g.beginPath(); g.arc(x + 32, y + 47, 4, 0, TAU); g.stroke();
      if (cell.plant) { for (let k = 0; k < 6; k++) { g.fillStyle = pick(['#3c7a35', '#5a9a3e', '#d6372b', '#e8a0b0']); g.beginPath(); g.arc(x + 12 + rnd() * 8, y + 34 + rnd() * 6, rr(2, 4), 0, TAU); g.fill(); } g.fillStyle = '#b5623a'; g.fillRect(x + 10, y + 40, 10, 6); }
    }
    if (cell.ac) { g.fillStyle = '#c9cbcc'; g.fillRect(x + 52, y + 30, 11, 9); g.fillStyle = '#7a7c80'; for (let k = 0; k < 4; k++) g.fillRect(x + 53, y + 31 + k * 2, 9, 1); g.fillStyle = 'rgba(60,50,40,0.25)'; g.fillRect(x + 56, y + 39, 2, 14); }
  }
});
const facadeNight = canvasTex(512, 512, g => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  facadeCells.forEach((cell, i) => { if (rnd() < 0.38) { const x = (i % 8) * 64, y = Math.floor(i / 8) * 64, w = rnd(); const gr = g.createLinearGradient(0, y + 12, 0, y + 54); const col = w < 0.7 ? ['#ffd890', '#e8a050'] : w < 0.9 ? ['#fff4d0', '#d8c090'] : ['#a8d8ff', '#5080b0']; gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); g.fillStyle = gr; g.fillRect(x + 19, y + 12, 26, 42); if (cell.shut) { g.fillStyle = '#000'; if (cell.half) g.fillRect(x + 19, y + 12, 26, 22); else { g.fillRect(x + 17, y + 10, 9, 46); g.fillRect(x + 38, y + 10, 9, 46); } } g.fillStyle = '#000'; g.fillRect(x + 31, y + 12, 2, 42); } });
});
const panotTex = canvasTex(256, 256, g => {
  g.fillStyle = '#aaa69d'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = c * 64, y = r * 64, cx = x + 32, cy = y + 32;
    g.strokeStyle = '#8f8b82'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, 62, 62);
    g.fillStyle = '#97938a';
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 10, 5.5, a, 0, TAU); g.fill(); }
    g.beginPath(); g.arc(cx, cy, 4, 0, TAU); g.fill();
    for (const [qx, qy] of [[x, y], [x + 64, y], [x, y + 64], [x + 64, y + 64]]) { g.beginPath(); g.arc(qx, qy, 9, 0, TAU); g.fill(); }
  }
});
const mosaicTex = canvasTex(256, 256, g => {
  g.fillStyle = '#efe9dc'; g.fillRect(0, 0, 256, 256);
  const pal = ['#2f6db5', '#e4b52a', '#d9472b', '#3c9a5f', '#f4f1e8', '#68b8d8', '#8a3f8f', '#ef8a2a'];
  for (let i = 0; i < 560; i++) {
    const x = rnd() * 256, y = rnd() * 256, s = rr(5, 13), n = ri(3, 5);
    g.fillStyle = pick(pal); g.beginPath();
    for (let k = 0; k < n; k++) { const a = k / n * TAU + rr(-0.4, 0.4), rad = s * rr(0.6, 1); g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    g.closePath(); g.fill();
  }
});
const markTex = canvasTex(128, 352, g => {
  g.fillStyle = 'rgba(240,240,232,0.92)';
  for (let x = 6; x < 122; x += 14) { g.fillRect(x, 4, 8, 26); g.fillRect(x, 322, 8, 26); }
  for (let y = 46; y < 306; y += 34) g.fillRect(62, y, 4, 18);
  for (const lx of [32, 96]) { g.beginPath(); g.moveTo(lx, 150); g.lineTo(lx - 10, 172); g.lineTo(lx - 4, 172); g.lineTo(lx - 4, 204); g.lineTo(lx + 4, 204); g.lineTo(lx + 4, 172); g.lineTo(lx + 10, 172); g.closePath(); g.fill(); }
}, false);
const lineTex = canvasTex(64, 64, g => { g.fillStyle = 'rgba(240,240,232,0.9)'; g.fillRect(30, 0, 4, 30); });
const diagTex = canvasTex(128, 64, g => {
  g.fillStyle = 'rgba(240,240,232,0.85)'; g.fillRect(31, 0, 3, 30); g.fillRect(94, 0, 3, 30);
  g.fillStyle = 'rgba(236,196,60,0.9)'; g.fillRect(60, 0, 3, 64); g.fillRect(65, 0, 3, 64);
});
const stoneTex = canvasTex(128, 256, g => {
  g.fillStyle = '#cdb994'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '80,60,40' : '255,245,225'},${rr(0.04, 0.12)})`; g.fillRect(rnd() * 128, rnd() * 256, rr(2, 6), rr(6, 30)); }
  g.fillStyle = 'rgba(60,40,20,0.25)'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 3, 256);
  for (let y = 0; y < 256; y += 40) for (let x = 4; x < 128; x += 16) { g.fillStyle = 'rgba(30,20,10,0.35)'; g.beginPath(); g.ellipse(x + 6, y + 18, 3, 8, 0, 0, TAU); g.fill(); }
});
const gloriesTex = canvasTex(64, 128, g => {
  for (let y = 0; y < 128; y += 4) for (let x = 0; x < 64; x += 4) {
    const t = y / 128; const c = [`hsl(${lerp(5, 215, t) + rr(-20, 20)},${rr(55, 85)}%,${rr(35, 60)}%)`];
    g.fillStyle = rnd() < 0.15 ? '#cfd8e0' : c[0]; g.fillRect(x, y, 4, 4);
  }
});
const glassTex = canvasTex(64, 64, g => {
  g.fillStyle = '#2e4258'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(160,200,230,0.35)'; g.fillRect(0, 0, 30, 64);
  g.fillStyle = '#e9edf0'; g.fillRect(0, 0, 64, 3); g.fillRect(0, 0, 3, 64);
});
const glassNight = canvasTex(64, 64, g => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); if (rnd() < 0.7) { g.fillStyle = '#b8d8ff'; g.fillRect(4, 4, 58, 58); } });
function signTex(text, bg, fg, w = 512, h = 128) {
  return canvasTex(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = h * 0.56; g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
    while (g.measureText(text).width > w - 40 && fs > 10) { fs -= 2; g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; }
    g.fillText(text, w / 2, h / 2 + 3);
  }, false);
}

// ====================== LOOK: era-style rendering assets ======================
// Original procedural textures; the style (warm haze, coronas, alpha-card foliage, trails) is a nod to mid-2000s console games.
function noiseFill(g, w, h, n, dark, light, a0, a1) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? dark : light},${rr(a0, a1)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 4), rr(1, 4)); } }
function wear(g, w, h, n) { g.save(); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${rr(0.2, 0.9)})`; g.fillRect(rnd() * w, rnd() * h, rr(1, 5), rr(1, 3)); } g.restore(); }
wear(markTex.image.getContext('2d'), 128, 352, 2600); markTex.needsUpdate = true;
wear(lineTex.image.getContext('2d'), 64, 64, 300); lineTex.needsUpdate = true;
wear(diagTex.image.getContext('2d'), 128, 64, 500); diagTex.needsUpdate = true;
const SHOPS = ['FORN', 'BAR', 'FARMÀCIA', 'FRUITES', 'QUEVIURES', 'PERRUQUERIA', 'BASAR', 'LLIBRERIA', 'FERRETERIA', 'CAFÈ', 'BODEGA', 'ESTANC'];
const shopKinds = [];
const shopTex = canvasTex(1024, 160, g => {
  g.fillStyle = '#ebe4d6'; g.fillRect(0, 0, 1024, 160); noiseFill(g, 1024, 160, 4000, '80,60,40', '255,255,255', 0.03, 0.08);
  g.fillStyle = '#8f877a'; g.fillRect(0, 124, 1024, 36); noiseFill(g, 1024, 36, 600, '40,30,20', '200,190,170', 0.05, 0.15);
  for (let u = 0; u < 8; u++) {
    const x = u * 128, kind = u === 0 || u === 5 ? 'portal' : pick(['shutter', 'shop', 'shop', 'bar', 'shutter']);
    shopKinds.push(kind);
    g.fillStyle = '#d6cdbd'; g.fillRect(x, 0, 10, 124); g.fillRect(x + 118, 0, 10, 124);
    g.fillStyle = 'rgba(50,40,30,0.25)'; g.fillRect(x + 10, 0, 3, 124);
    if (kind === 'portal') {
      g.fillStyle = '#3b2a1c'; g.beginPath(); g.moveTo(x + 30, 124); g.lineTo(x + 30, 40); g.arc(x + 64, 40, 34, Math.PI, 0); g.lineTo(x + 98, 124); g.fill();
      g.strokeStyle = '#2a1d12'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 64, 40); g.lineTo(x + 64, 124); for (let y = 54; y < 120; y += 22) { g.rect(x + 36, y, 22, 16); g.rect(x + 70, y, 22, 16); } g.stroke();
      g.fillStyle = '#c8a24a'; g.fillRect(x + 58, 80, 3, 8); g.fillRect(x + 67, 80, 3, 8);
      g.fillStyle = '#1d3f73'; g.fillRect(x + 100, 30, 14, 10); g.fillStyle = '#fff'; g.font = 'bold 8px Arial'; g.fillText(String(ri(1, 240)), x + 101, 38);
    } else if (kind === 'shutter') {
      g.fillStyle = '#8d9196'; g.fillRect(x + 14, 22, 100, 102);
      for (let y = 24; y < 124; y += 4) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 14, y, 100, 1); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 14, y + 1, 100, 1); }
      for (let k = 0; k < 5; k++) { g.strokeStyle = pick(['#e3412f', '#1b1b1b', '#f2c230', '#3a8fc2', '#ffffff', '#47b05a', '#c23ab0']); g.lineWidth = rr(2, 6); g.lineCap = 'round'; g.beginPath(); g.moveTo(x + rr(20, 100), rr(40, 110)); for (let s = 0; s < 3; s++) g.bezierCurveTo(x + rr(16, 112), rr(30, 120), x + rr(16, 112), rr(30, 120), x + rr(16, 112), rr(30, 120)); g.stroke(); }
      g.fillStyle = '#4a4d52'; g.fillRect(x + 14, 14, 100, 10);
    } else {
      const bar = kind === 'bar', name = bar ? pick(['BAR', 'CAFÈ', 'BODEGA']) : pick(SHOPS);
      const gr = g.createLinearGradient(0, 30, 0, 124); gr.addColorStop(0, '#6f8798'); gr.addColorStop(1, '#1d252c'); g.fillStyle = gr; g.fillRect(x + 16, 36, 96, 88);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + 20, 36); g.lineTo(x + 50, 36); g.lineTo(x + 30, 124); g.lineTo(x + 16, 124); g.fill();
      for (let k = 0; k < 6; k++) { g.fillStyle = pick(['#d6372b', '#f2c230', '#e8e3d6', '#3c9a5f', '#7b4a8f', '#e07a4a']); g.fillRect(x + rr(22, 100), rr(84, 112), rr(6, 12), rr(8, 14)); }
      g.fillStyle = '#d8d0c0'; g.fillRect(x + 62, 36, 4, 88);
      const aw = pick(['#d6372b', '#2a6b5c', '#2b5fa8', '#b5823a']);
      for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#efe9dc' : aw; g.beginPath(); g.moveTo(x + 12 + k * 13, 14); g.lineTo(x + 25 + k * 13, 14); g.lineTo(x + 27 + k * 13, 34); g.lineTo(x + 10 + k * 13, 34); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 12, 34, 104, 3);
      g.fillStyle = bar ? '#1e1e22' : '#f4efe4'; g.fillRect(x + 18, 2, 92, 12); g.fillStyle = bar ? '#ffcf5a' : '#1e1e22'; g.font = 'bold 10px Arial'; g.textAlign = 'center'; g.fillText(name, x + 64, 11.5);
      if (name === 'FARMÀCIA') { g.fillStyle = '#38c24a'; g.fillRect(x + 100, 40, 6, 18); g.fillRect(x + 94, 46, 18, 6); }
    }
  }
});
const shopNight = canvasTex(1024, 160, g => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 160);
  shopKinds.forEach((k, u) => { const x = u * 128; if (k === 'shop' || k === 'bar') { g.fillStyle = k === 'bar' ? '#ffb85a' : '#ffe6b0'; g.fillRect(x + 16, 36, 96, 88); g.fillStyle = '#fff2c0'; g.fillRect(x + 18, 2, 92, 12); } if (k === 'portal') { g.fillStyle = '#ffd890'; g.fillRect(x + 54, 30, 20, 8); } });
});
const roofTex = canvasTex(128, 128, g => {
  g.fillStyle = '#c9b9a4'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { g.fillStyle = `rgba(${rnd() < 0.5 ? '120,70,50' : '230,220,200'},${rr(0.05, 0.2)})`; g.fillRect(x + 1, y + 1, 14, 14); }
  g.strokeStyle = 'rgba(60,50,40,0.4)'; g.lineWidth = 1; for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  noiseFill(g, 128, 128, 700, '40,30,20', '255,250,240', 0.04, 0.14);
});
const groundDetail = canvasTex(256, 256, g => {
  g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, 256, 256);
  noiseFill(g, 256, 256, 9000, '60,60,60', '255,255,255', 0.04, 0.16);
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(30,30,30,${rr(0.06, 0.14)})`; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, rr(10, 40), rr(6, 24), rnd() * 3, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(20,20,20,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) { let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rr(-12, 12); y += rr(-12, 12); g.lineTo(x, y); } g.stroke(); }
});
const barkTex = canvasTex(64, 128, g => { g.fillStyle = '#b8ad8e'; g.fillRect(0, 0, 64, 128); for (let i = 0; i < 70; i++) { g.fillStyle = pick(['#8f8a6a', '#d8d0b4', '#7d7a5c', '#a7a184', '#6f6b52']); g.beginPath(); g.ellipse(rnd() * 64, rnd() * 128, rr(3, 9), rr(4, 12), rnd() * 3, 0, TAU); g.fill(); } });
const palmBark = canvasTex(32, 64, g => { g.fillStyle = '#8d7655'; g.fillRect(0, 0, 32, 64); for (let y = 0; y < 64; y += 6) { g.fillStyle = 'rgba(40,25,10,0.45)'; g.fillRect(0, y, 32, 2); } });
const leafTex = canvasTex(128, 128, g => {
  for (let i = 0; i < 260; i++) { const x = 64 + rr(-1, 1) * 58 * Math.sqrt(rnd()), y = 64 + rr(-1, 1) * 54 * Math.sqrt(rnd()); if ((x - 64) ** 2 / 3600 + (y - 64) ** 2 / 3000 > 1) continue; g.fillStyle = pick(['#4f7a2e', '#6b9a3a', '#3d6324', '#86b04a', '#5c8a34', '#2f4f1c']); g.beginPath(); g.ellipse(x, y, rr(3, 7), rr(2, 4), rnd() * 3, 0, TAU); g.fill(); }
}, false);
const frondTex = canvasTex(64, 256, g => { g.strokeStyle = '#6d6a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke(); for (let y = 6; y < 250; y += 5) { const l = 28 * Math.sin(Math.PI * y / 256) + 3; g.strokeStyle = pick(['#4f7f2e', '#5f8f36', '#3f6a24']); g.lineWidth = 2; g.beginPath(); g.moveTo(32, y); g.lineTo(32 - l, y + 12); g.moveTo(32, y); g.lineTo(32 + l, y + 12); g.stroke(); } }, false);
const pineTex = canvasTex(128, 256, g => { for (let t = 0; t < 7; t++) { const y = 20 + t * 32, w = 14 + t * 8; for (let i = 0; i < 90; i++) { g.fillStyle = pick(['#2f5a2c', '#3c6b34', '#24461f', '#4b7a3c']); g.fillRect(64 + rr(-w, w) * (rnd() * 0.5 + 0.5), y + rr(0, 36), rr(2, 5), rr(2, 4)); } } g.fillStyle = '#5a4532'; g.fillRect(61, 210, 6, 46); }, false);
const coronaTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(0, 31, 64, 2); g.fillRect(31, 0, 2, 64); }, false);
const poolTex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
const waterNormal = canvasTex(128, 128, g => {
  const N = 128, hgt = new Float32Array(N * N);
  const waves = []; for (let k = 0; k < 9; k++) waves.push([ri(1, 6) * (rnd() < 0.5 ? 1 : -1), ri(1, 6), rr(0, TAU), rr(0.3, 1)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (const w of waves) v += Math.sin((x * w[0] + y * w[1]) / N * TAU + w[2]) * w[3]; hgt[y * N + x] = v; }
  const im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = hgt[y * N + (x + 1) % N] - hgt[y * N + (x - 1 + N) % N], dy = hgt[((y + 1) % N) * N + x] - hgt[((y - 1 + N) % N) * N + x]; const l = Math.hypot(dx, dy, 2); const i = (y * N + x) * 4; im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (2 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
});
const envCube = (() => {
  const face = (kind) => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    if (kind === 'top') { g.fillStyle = '#86b6e0'; g.fillRect(0, 0, 64, 64); }
    else if (kind === 'bottom') { g.fillStyle = '#4a4a4c'; g.fillRect(0, 0, 64, 64); }
    else { const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#7fb0dc'); gr.addColorStop(0.5, '#e0d8c6'); gr.addColorStop(0.5, '#6a645c'); gr.addColorStop(1, '#3a3836'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      for (let x = 0; x < 64; x += rr(4, 9)) { const h = rr(4, 16); g.fillStyle = pick(['#9a8f80', '#b3a690', '#857a6c']); g.fillRect(x, 32 - h, rr(3, 8), h); } }
    return c; };
  const t = new THREE.CubeTexture([face('side'), face('side'), face('top'), face('bottom'), face('side'), face('side')]); t.needsUpdate = true; return t;
})();
const faceCache = {};
function faceMat(skin) {
  if (faceCache[skin]) return faceCache[skin];
  const t = canvasTex(32, 32, g => { g.fillStyle = skin; g.fillRect(0, 0, 32, 32); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(14, 13, 4, 8); g.fillStyle = '#f4f1ea'; g.fillRect(7, 11, 7, 4); g.fillRect(18, 11, 7, 4); g.fillStyle = '#1e1a16'; g.fillRect(10, 11, 3, 4); g.fillRect(19, 11, 3, 4); g.fillRect(6, 8, 8, 2); g.fillRect(18, 8, 8, 2); g.fillStyle = 'rgba(90,30,30,0.6)'; g.fillRect(11, 24, 10, 2); }, false);
  t.magFilter = THREE.NearestFilter;
  return (faceCache[skin] = new THREE.MeshLambertMaterial({ map: t }));
}
function cardGeo(parts) {
  // parts: [cx, cy, cz, w, h, rotY, horizontal?] -> merged quads with normals bent outward from the crown centre
  const pos = [], nor = [], uv = [], ctr = parts.center || [0, 0, 0];
  for (const [cx, cy, cz, w, h, ry, horiz] of parts) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const corners = horiz ? [[-w / 2, 0, -h / 2], [w / 2, 0, -h / 2], [w / 2, 0, h / 2], [-w / 2, 0, h / 2]] : [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]];
    const P2 = corners.map(([x, y, z]) => [cx + x * c + z * s, cy + y, cz - x * s + z * c]);
    const U = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = P2[i]; pos.push(p[0], p[1], p[2]); uv.push(U[i][0], U[i][1]);
      let nx = p[0] - ctr[0], ny = p[1] - ctr[1] + 1.5, nz = p[2] - ctr[2]; const l = Math.hypot(nx, ny, nz) || 1; nor.push(nx / l, ny / l, nz / l);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g;
}
function cardMat(tex) {
  const m = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
  m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.45, side: THREE.DoubleSide });
  return m;
}

// ---------- sky dome ----------
const skyMat = new THREE.ShaderMaterial({
  uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, cloudCol: { value: new THREE.Color() }, time: { value: 0 }, night: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 top, hor, sunCol, cloudCol, sunDir; uniform float time, night; varying vec3 vDir;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
    void main(){
      vec3 d = normalize(vDir); float h = max(d.y, 0.0);
      vec3 col = mix(hor, top, pow(h, 0.5));
      if (d.y < 0.0) col = hor * 0.9;
      float sd = max(dot(d, normalize(sunDir)), 0.0);
      col += sunCol * (pow(sd, 6.0) * 0.35 + pow(sd, 60.0) * 0.5);
      col += sunCol * smoothstep(0.9990, 0.9996, sd) * 1.6;
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.1) * 1.4 + vec2(time * 0.006, time * 0.003);
        float c = smoothstep(0.5, 0.8, fbm(uv)) * smoothstep(0.0, 0.2, d.y);
        vec3 cc = mix(cloudCol, cloudCol * 0.72, fbm(uv * 2.3 + 4.0)) + sunCol * pow(sd, 3.0) * 0.45;
        col = mix(col, cc, c * 0.9);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, fog: false,
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), skyMat); skyDome.renderOrder = -10; skyDome.frustumCulled = false; scene.add(skyDome);

// ---------- coronas (glows around lights) ----------
const coronaMat = new THREE.PointsMaterial({ map: coronaTex, size: 5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd49a, opacity: 0, fog: false });
const carCoronaMat = new THREE.PointsMaterial({ map: coronaTex, size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, opacity: 0, fog: false });
const CC_MAX = 600;
const carCoronaGeo = new THREE.BufferGeometry();
carCoronaGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CC_MAX * 3), 3));
carCoronaGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(CC_MAX * 3), 3));
const carCoronas = new THREE.Points(carCoronaGeo, carCoronaMat); carCoronas.frustumCulled = false; scene.add(carCoronas);
const headSpot = new THREE.SpotLight(0xfff0d0, 0, 70, 0.55, 0.6, 1.2); scene.add(headSpot); scene.add(headSpot.target);
function updateCarLights(night) {
  carCoronaMat.opacity = smooth(0.25, 0.7, night);
  const P = carCoronaGeo.attributes.position.array, C = carCoronaGeo.attributes.color.array; let n = 0;
  if (carCoronaMat.opacity > 0.01) for (const v of vehicles) {
    if (v.dead || n > CC_MAX - 4 || d2(v.pos.x, v.pos.z, camera.position.x, camera.position.z) > 260 * 260) continue;
    const s = Math.sin(v.heading), c = Math.cos(v.heading), L = v.t.len / 2 + 0.08, y = v.pos.y + (v.t.moto ? 1.0 : 0.62), w = v.t.moto ? [0] : [-v.t.wid * 0.33, v.t.wid * 0.33];
    for (const off of w) {
      P[n * 3] = v.pos.x + s * L - c * off; P[n * 3 + 1] = y; P[n * 3 + 2] = v.pos.z + c * L + s * off; C[n * 3] = 1; C[n * 3 + 1] = 0.95; C[n * 3 + 2] = 0.8; n++;
      P[n * 3] = v.pos.x - s * L - c * off; P[n * 3 + 1] = y; P[n * 3 + 2] = v.pos.z - c * L + s * off; C[n * 3] = 0.9; C[n * 3 + 1] = 0.08; C[n * 3 + 2] = 0.05; n++;
    }
  }
  carCoronaGeo.setDrawRange(0, n); carCoronaGeo.attributes.position.needsUpdate = true; carCoronaGeo.attributes.color.needsUpdate = true;
  const v = player.car;
  if (v && !v.dead && night > 0.3) { const s = Math.sin(v.heading), c = Math.cos(v.heading); headSpot.intensity = 1.6 * smooth(0.3, 0.7, night); headSpot.position.set(v.pos.x + s * 2, v.pos.y + 1, v.pos.z + c * 2); headSpot.target.position.set(v.pos.x + s * 24, v.pos.y - 1, v.pos.z + c * 24); }
  else headSpot.intensity = 0;
}

// ---------- post-processing: grade, bloom, trails, grain ----------
const post = (() => {
  const gl2 = renderer.capabilities.isWebGL2;
  const opt = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
  const sceneRT = gl2 && THREE.WebGLMultisampleRenderTarget ? new THREE.WebGLMultisampleRenderTarget(4, 4, opt) : new THREE.WebGLRenderTarget(4, 4, opt);
  if (sceneRT.samples !== undefined) sceneRT.samples = coarse ? 2 : 4;
  const sA = new THREE.WebGLRenderTarget(4, 4, opt), sB = new THREE.WebGLRenderTarget(4, 4, opt);
  let fA = new THREE.WebGLRenderTarget(4, 4, opt), fB = new THREE.WebGLRenderTarget(4, 4, opt);
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), sc2 = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; sc2.add(quad);
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, px: { value: new THREE.Vector2() }, th: { value: 0.7 } }, vertexShader: vs, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 px; uniform float th; varying vec2 vUv; void main(){ vec3 c = (texture2D(t, vUv + px * vec2(-1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(1.0, -1.0)).rgb + texture2D(t, vUv + px * vec2(-1.0, 1.0)).rgb + texture2D(t, vUv + px).rgb) * 0.25; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(th, th + 0.3, l), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: vs, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir * 1.385).rgb + texture2D(t, vUv - dir * 1.385).rgb) * 0.316; c += (texture2D(t, vUv + dir * 3.231).rgb + texture2D(t, vUv - dir * 3.231).rgb) * 0.070; gl_FragColor = vec4(c, 1.0); }' });
  const comp = new THREE.ShaderMaterial({ uniforms: { tS: { value: null }, tB: { value: null }, tP: { value: null }, px: { value: new THREE.Vector2() }, trail: { value: 0.25 }, bloom: { value: 0.4 }, time: { value: 0 }, sat: { value: 0.9 }, con: { value: 1.08 }, tint: { value: new THREE.Vector3(1.06, 1, 0.88) }, lift: { value: new THREE.Vector3(0.02, 0.015, 0) }, grain: { value: 0.03 } },
    vertexShader: vs, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tS, tB, tP; uniform vec2 px; uniform float trail, bloom, time, sat, con, grain; uniform vec3 tint, lift; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tS, vUv).rgb + texture2D(tB, vUv).rgb * bloom;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, sat);
        c = (c - 0.5) * con + 0.5;
        c = c * tint + lift;
        vec3 p = (texture2D(tP, vUv + vec2(px.x, 0.0)).rgb + texture2D(tP, vUv - vec2(px.x, 0.0)).rgb + texture2D(tP, vUv + vec2(0.0, px.y)).rgb + texture2D(tP, vUv - vec2(0.0, px.y)).rgb) * 0.25;
        c = mix(c, p, trail);
        vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.6;
        c += (h(vUv * vec2(1733.0, 977.0) + fract(time)) - 0.5) * grain;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }` });
  const copy = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: vs, depthTest: false, depthWrite: false, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = texture2D(t, vUv); }' });
  const pass = (m, rt) => { quad.material = m; renderer.setRenderTarget(rt); renderer.render(sc2, cam2); };
  const size = new THREE.Vector2();
  function resize() {
    renderer.getDrawingBufferSize(size); const w = Math.max(4, size.x), h = Math.max(4, size.y);
    sceneRT.setSize(w, h); fA.setSize(w, h); fB.setSize(w, h);
    const qw = Math.max(4, w >> 2), qh = Math.max(4, h >> 2); sA.setSize(qw, qh); sB.setSize(qw, qh);
    bright.uniforms.px.value.set(1 / w, 1 / h); comp.uniforms.px.value.set(1.5 / w, 1.5 / h); blur.userData = [1 / qw, 1 / qh];
  }
  const P = { enabled: true, comp, resize, render(sceneObj, cam) {
    if (!P.enabled) { renderer.setRenderTarget(null); renderer.render(sceneObj, cam); return; }
    renderer.setRenderTarget(sceneRT); renderer.render(sceneObj, cam);
    bright.uniforms.t.value = sceneRT.texture; pass(bright, sA);
    for (const k of [1, 2]) { blur.uniforms.t.value = sA.texture; blur.uniforms.dir.value.set(blur.userData[0] * k, 0); pass(blur, sB); blur.uniforms.t.value = sB.texture; blur.uniforms.dir.value.set(0, blur.userData[1] * k); pass(blur, sA); }
    comp.uniforms.tS.value = sceneRT.texture; comp.uniforms.tB.value = sA.texture; comp.uniforms.tP.value = fB.texture; comp.uniforms.time.value = now * 0.001;
    pass(comp, fA); copy.uniforms.t.value = fA.texture; pass(copy, null);
    const t = fA; fA = fB; fB = t;
  }, bright };
  resize();
  return P;
})();

// ====================== MATERIALS ======================
const matCache = {};
function lam(c, extra) { const k = c + (extra ? JSON.stringify(extra) : ''); return matCache[k] || (matCache[k] = new THREE.MeshLambertMaterial(Object.assign({ color: c }, extra || {}))); }
const nightMats = [];   // {mat, max}
function glowMat(color, tex, max = 1) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex || null, emissive: new THREE.Color(color), emissiveIntensity: 0 });
  if (tex) m.emissiveMap = tex;
  nightMats.push({ m, max }); return m;
}

// ====================== GEOMETRY ACCUMULATOR ======================
class Acc {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  v(P, N, U, C) { this.p.push(P[0], P[1], P[2]); this.n.push(N[0], N[1], N[2]); this.u.push(U[0], U[1]); this.c.push(C[0], C[1], C[2]); }
  tri(A, B, C, N, ua, ub, uc, col, cb, cc) {
    cb = cb || col; cc = cc || col;
    const abx = B[0] - A[0], aby = B[1] - A[1], abz = B[2] - A[2], acx = C[0] - A[0], acy = C[1] - A[1], acz = C[2] - A[2];
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    if (cx * N[0] + cy * N[1] + cz * N[2] < 0) { this.v(A, N, ua, col); this.v(C, N, uc, cc); this.v(B, N, ub, cb); }
    else { this.v(A, N, ua, col); this.v(B, N, ub, cb); this.v(C, N, uc, cc); }
  }
  quad(A, B, C, D, N, ua, ub, uc, ud, col, top) { top = top || col; this.tri(A, B, C, N, ua, ub, uc, col, col, top); this.tri(A, C, D, N, ua, uc, ud, col, top, top); }
  mesh(mat, shadow = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m;
  }
}
const UP = [0, 1, 0], WHITE = [1, 1, 1];
function prism(wall, roof, poly, y0, y1, col, rcol, opt) {
  opt = opt || {};
  const n = poly.length, c = polyCentroid(poly);
  const vTop = opt.vFixed ? (y1 - y0) / opt.vFixed : Math.max(1, Math.round((y1 - y0) / 3.4)) / 8;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez); if (len < 0.05) continue;
    let nx = ez / len, nz = -ex / len;
    if (((a[0] + b[0]) / 2 - c[0]) * nx + ((a[1] + b[1]) / 2 - c[1]) * nz < 0) { nx = -nx; nz = -nz; }
    const cu = opt.uFixed ? len / opt.uFixed : Math.max(1, Math.round(len / 4)) / 8;
    if (opt.split) {
      const ys = opt.split, u0 = Math.floor(rnd() * 8) / 8, vt = (y1 - ys) / 27.2, sh = (k) => [col[0] * k, col[1] * k, col[2] * k];
      const mir = ex * nz - ez * nx < 0, ua = mir ? u0 + cu : u0, ub = mir ? u0 : u0 + cu;   // keep shop signs reading left-to-right from outside
      shopAcc.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], ys, b[1]], [a[0], ys, a[1]], [nx, 0, nz], [ua, 0], [ub, 0], [ub, 1], [ua, 1], sh(0.62), sh(0.92));
      wall.quad([a[0], ys, a[1]], [b[0], ys, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nx, 0, nz], [0, 0], [cu, 0], [cu, vt], [0, vt], sh(0.8), sh(Math.min(1.08, 0.98 + (y1 - ys) * 0.002)));
    } else wall.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nx, 0, nz], [0, 0], [cu, 0], [cu, vTop], [0, vTop], col);
  }
  if (roof) {
    const s = opt.roofUV || 4;
    for (let i = 1; i < n - 1; i++) roof.tri([poly[0][0], y1, poly[0][1]], [poly[i][0], y1, poly[i][1]], [poly[i + 1][0], y1, poly[i + 1][1]], UP,
      [poly[0][0] / s, poly[0][1] / s], [poly[i][0] / s, poly[i][1] / s], [poly[i + 1][0] / s, poly[i + 1][1] / s], rcol);
  }
}
const C3 = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const trimAcc = new Acc(), shopAcc = new Acc(), wallAcc = new Acc(), roofAcc = new Acc(), sideAcc = new Acc(), markAcc = new Acc(), lineAcc = new Acc(), diagAcc = new Acc();
const PAL_EIX = ['#efe3c8', '#e7cf9f', '#e9c9b4', '#dcd5c6', '#f0e2b0', '#d9a983', '#e6dccb', '#cfc2a8', '#e3b9a0'];
const PAL_OLD = ['#e0c38c', '#d9a66e', '#e8d3a8', '#c98f69', '#e3d9c3', '#d4b48a', '#c9a27a'];
const PAL_ROOF = ['#b3ab9c', '#a59c8c', '#bfb8aa', '#b56a4c'];
const PAL_MOD = ['#cfd6dc', '#b9c3cc', '#e2e2dc', '#a9b4bd', '#d8cfc0'];
const SIDE_COL = [1, 1, 1];
function ledge(poly, d, y0, y1, col) {
  const out = offsetPoly(poly, d), n = poly.length, dn = [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
  prism(trimAcc, null, out, y0, y1, col, null, { uFixed: 4, vFixed: 4 });
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], A = out[i], B = out[(i + 1) % n];
    trimAcc.quad([A[0], y1, A[1]], [B[0], y1, B[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], UP, [0, 0], [1, 0], [1, 1], [0, 1], col);
    trimAcc.quad([A[0], y0, A[1]], [B[0], y0, B[1]], [b[0], y0, b[1]], [a[0], y0, a[1]], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1], dn);
  }
}
function building(poly, floors, col, rcol, solid = true) {
  const c = polyCentroid(poly), base = Math.max(0, groundH(c[0], c[1]));
  const top = base + floors * 3.4 + 0.3;
  prism(wallAcc, roofAcc, poly, base - 1.2, top, col, rcol, { split: base + 3.4 });
  const stone = [lerp(col[0], 0.93, 0.6), lerp(col[1], 0.9, 0.6), lerp(col[2], 0.85, 0.6)];
  const jt = rnd() * 0.08;
  ledge(poly, 0.42, top - 0.55 + jt, top + 0.12 + jt, stone);
  ledge(poly, 0.2, base + 3.3 + jt, base + 3.62 + jt, stone);
  if (floors > 3) ledge(poly, 0.12, top - 3.6, top - 3.42, stone);
  if (solid) addSolid(poly, top);
  return top;
}
function boxSolid(x, z, w, d, top) { return addSolid(rectPoly(x - w / 2, z - d / 2, x + w / 2, z + d / 2), top); }

// ====================== CITY GENERATION ======================
const SPECIAL = { '-2,2': 'placa', '3,-4': 'sagrada', '6,0': 'glories', '2,1': 'arc', '4,-6': 'santpau' };
const blockCenters = [];
function rooftop(bd, top) {
  const c = polyCentroid(bd), n = ri(1, 3);
  for (let k = 0; k < n; k++) {
    const x = c[0] + rr(-16, 16), z = c[1] + rr(-16, 16), w = rr(4, 9), d = rr(4, 9);
    const r = rectPoly(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    if (r.every(p => pointInPoly(bd, p[0], p[1]))) prism(wallAcc, roofAcc, r, top - 0.2, top + 3.4, C3('#e9e3d6'), C3('#a8a092'));
  }
}
function genEixample() {
  const An = DIAG.ax * DIAG.nx + DIAG.az * DIAG.nz;
  for (let i = BI0; i <= BI1; i++) for (let j = BJ0; j <= BJ1; j++) {
    if (j === 3 && i < 5) continue;
    const cx = i * P, cz = j * P;
    if ([[-34, -34], [34, -34], [-34, 34], [34, 34]].some(o => terrainH(cx + o[0], cz + o[1]) > 0.2)) continue;
    const sp = SPECIAL[i + ',' + j];
    const sw0 = octagon(cx, cz, HS, CS), bd0 = octagon(cx, cz, HB, CB);
    let pieces = [[sw0, bd0]];
    const dd = diagDist(cx, cz), dt = diagT(cx, cz);
    if (!sp && Math.abs(dd) < 62 && dt > DIAG_T0 - 20 && dt < DIAG_T1 + 20) {
      pieces = [];
      for (const s of [1, -1]) {
        const sw = clipHalf(sw0, s * DIAG.nx, s * DIAG.nz, 15 + s * An);
        const bd = clipHalf(bd0, s * DIAG.nx, s * DIAG.nz, 19 + s * An);
        if (sw.length >= 3 && Math.abs(polyArea(sw)) > 150) pieces.push([sw, bd.length >= 3 && Math.abs(polyArea(bd)) > 140 ? bd : null]);
      }
    }
    for (const [sw, bd] of pieces) {
      prism(sideAcc, sideAcc, sw, -0.3, CURB, SIDE_COL, SIDE_COL, { roofUV: 2, uFixed: 2, vFixed: 2 });
      addSide(sw);
      if (!sp && bd) {
        const top = building(bd, ri(6, 8), C3(pick(PAL_EIX)), C3(pick(PAL_ROOF)));
        rooftop(bd, top);
        addLoop(offsetPoly(bd, 1.5), CURB);
        blockCenters.push([cx, cz]);
      } else if (!sp) addLoop(offsetPoly(sw, -2), CURB);
    }
  }
}
const RESERVED = [[-82, 248, -28, 302], [42, 230, 94, 264], [-140, 338, -108, 374], [-334, 384, -296, 411]];
const resHit = (x0, z0, x1, z1) => RESERVED.some(r => !(x1 < r[0] || x0 > r[2] || z1 < r[1] || z0 > r[3]));
function bsp(x0, z0, x1, z1, d, out) {
  const w = x1 - x0, h = z1 - z0;
  if ((w < 36 && h < 36) || d > 7) { out.push([x0, z0, x1, z1]); return; }
  const a = rr(4.5, 7.5);
  if (w >= h) { const s = rr(x0 + w * 0.35, x0 + w * 0.65); bsp(x0, z0, s - a / 2, z1, d + 1, out); bsp(s + a / 2, z0, x1, z1, d + 1, out); }
  else { const s = rr(z0 + h * 0.35, z0 + h * 0.65); bsp(x0, z0, x1, s - a / 2, d + 1, out); bsp(x0, s + a / 2, x1, z1, d + 1, out); }
}
function rowOfBuildings(x0, z0, x1, z1, fl0, fl1, pal) {
  const horiz = (x1 - x0) >= (z1 - z0); let p = horiz ? x0 : z0; const end = horiz ? x1 : z1;
  while (p < end - 0.1) {
    let q = Math.min(end, p + rr(7, 15)); if (end - q < 5) q = end;
    building(horiz ? rectPoly(p, z0, q, z1) : rectPoly(x0, p, x1, q), ri(fl0, fl1), C3(pick(pal)), C3(pick(['#b5664a', '#a9a090', '#c27a5a', '#b3ab9c'])));
    p = q;
  }
}
function genOldTown() {
  const leaves = [];
  bsp(-456, 214, -178, 408, 0, leaves); bsp(-142, 214, 18, 408, 0, leaves); bsp(40, 214, 118, 408, 0, leaves);
  for (const [x0, z0, x1, z1] of leaves) {
    if (x1 - x0 < 5 || z1 - z0 < 5 || resHit(x0, z0, x1, z1)) continue;
    rowOfBuildings(x0, z0, x1, z1, 4, 7, PAL_OLD);
    addLoop(offsetPoly(rectPoly(x0, z0, x1, z1), 1.1), 0);
  }
  // La Barceloneta: long narrow blocks
  for (let x = 134; x + 14 <= 356; x += 21) for (let z = 216; z + 40 <= 406; z += 47) {
    rowOfBuildings(x, z, x + 14, z + 40, 4, 6, ['#e8d9b8', '#d9c3a0', '#ecdcc8', '#c6a47e', '#e6cfa6']);
    addLoop(offsetPoly(rectPoly(x, z, x + 14, z + 40), 1.2), 0);
  }
}
function genOutskirts() {
  const towers = (xa, xb, za, zb, avoid) => {
    for (let x = xa; x <= xb; x += 62) for (let z = za; z <= zb; z += 62) {
      if (rnd() < 0.28 || avoid(x, z) || terrainH(x, z) > 0.4) continue;
      const w = rr(18, 32), d = rr(18, 32), r = rectPoly(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
      building(r, ri(6, 16), C3(pick(PAL_MOD)), C3('#9a9a94'));
      addLoop(offsetPoly(r, 1.4), 0);
    }
  };
  towers(-1010, -650, -580, 110, (x, z) => d2(x, z, -820, -250) < 150 * 150 || d2(x, z, -680, -110) < 50 * 50);
  towers(800, 980, -560, 230, () => false);
}

// ---------- roads & markings ----------
function strip(acc, ax, az, bx, bz, w, y, vRep) {
  const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l * w / 2, nz = dx / l * w / 2;
  acc.quad([ax + nx, y, az + nz], [ax - nx, y, az - nz], [bx - nx, y, bz - nz], [bx + nx, y, bz + nz], UP, [0, 0], [1, 0], [1, vRep], [0, vRep], WHITE);
}
function nodeOK(si, sj) {
  if (si < SI0 || si > SI1 || sj < SJ0 || sj > SJ1) return false;
  if (sj === 3 && si < 4) return false;
  return terrainH(sx(si), sz(sj)) < 0.5;
}
function genRoads() {
  for (let sj = SJ0; sj <= SJ1; sj++) for (let si = SI0; si < SI1; si++) {
    if (!nodeOK(si, sj) || !nodeOK(si + 1, sj)) continue;
    const z = sz(sj), xm = (si + 1) * P; if (onDiag(xm, z, 26)) continue;
    const dir = (sj & 1) ? -1 : 1;
    strip(markAcc, xm - 22 * dir, z, xm + 22 * dir, z, 16, 0.035, 1);
  }
  for (let si = SI0; si <= SI1; si++) for (let sj = SJ0; sj < SJ1; sj++) {
    if (!nodeOK(si, sj) || !nodeOK(si, sj + 1)) continue;
    const x = sx(si), zm = (sj + 1) * P; if (onDiag(x, zm, 26)) continue;
    const dir = (si & 1) ? -1 : 1;
    strip(markAcc, x, zm - 22 * dir, x, zm + 22 * dir, 16, 0.035, 1);
  }
  const [ax, az] = diagPt(DIAG_T0), [bx, bz] = diagPt(DIAG_T1);
  strip(diagAcc, ax, az, bx, bz, 30, 0.04, (DIAG_T1 - DIAG_T0) / 14);
  strip(lineAcc, -470, 421, 380, 421, 18, 0.035, 850 / 8);   // Passeig de Colom
  strip(lineAcc, 29, 204, 29, 412, 16, 0.035, 208 / 8);      // Via Laietana
}

// ---------- instanced vegetation & lamps ----------
const hydrantSpots = [], benchSpots = [], binSpots = [], bikeSpots = [], treeSpots = [], palmSpots = [], pineSpots = [], lampSpots = [];
function genStreetFurniture() {
  for (let sj = SJ0; sj <= SJ1; sj++) for (let si = SI0; si < SI1; si++) {
    if (!nodeOK(si, sj) || !nodeOK(si + 1, sj)) continue;
    const z = sz(sj), xm = (si + 1) * P;
    for (const side of [-9.4, 9.4]) for (let k = -24; k <= 24; k += 9.6) { const x = xm + k, zz = z + side; if (!onDiag(x, zz, 18) && onSidewalk(x, zz) && !solidAt(x, zz)) treeSpots.push([x, zz]); }
  }
  for (let si = SI0; si <= SI1; si++) for (let sj = SJ0; sj < SJ1; sj++) {
    if (!nodeOK(si, sj) || !nodeOK(si, sj + 1)) continue;
    const x = sx(si), zm = (sj + 1) * P;
    for (const side of [-9.4, 9.4]) for (let k = -24; k <= 24; k += 9.6) { const xx = x + side, z = zm + k; if (!onDiag(xx, z, 18) && onSidewalk(xx, z) && !solidAt(xx, z)) treeSpots.push([xx, z]); }
  }
  for (let si = SI0; si <= SI1; si++) for (let sj = SJ0; sj <= SJ1; sj++) {
    if (!nodeOK(si, sj)) continue;
    for (const [ox, oz] of [[-15.5, -15.5], [15.5, -15.5], [-15.5, 15.5], [15.5, 15.5]]) { const x = sx(si) + ox, z = sz(sj) + oz; if (onSidewalk(x, z) && !solidAt(x, z)) lampSpots.push([x, z]); }
  }
  const avoid = [[-113.8, 84], [700, -114], [-137, 206]];
  const segFurniture = (x, z, ux, uz) => { // segment centre and unit direction along the street
    const rx = -uz, rz = ux;
    for (const sd of [-1, 1]) if (rnd() < 0.4) benchSpots.push([x + rx * sd * 10.3, z + rz * sd * 10.3, Math.atan2(-rx * sd, -rz * sd)]);
    if (avoid.some(a => d2(a[0], a[1], x, z) < 40 * 40) || onDiag(x, z, 30)) return;
    const r = rnd(), sd = rnd() < 0.5 ? -1 : 1;
    if (r < 0.22) { const cols = ['#6d7276', '#e2b82a', '#2f6db5', '#3c8a4a', '#7a5432']; for (let k = 0; k < 5; k++) { const o = -14 + k * 1.75; binSpots.push([x + ux * o + rx * sd * 6.4, z + uz * o + rz * sd * 6.4, Math.atan2(ux, uz), cols[k]]); } }
    else if (r < 0.32) { for (let k = 0; k < 7; k++) { const o = 4 + k * 1.1; bikeSpots.push([x + ux * o + rx * sd * 6.6, z + uz * o + rz * sd * 6.6, Math.atan2(rx, rz)]); } }
  };
  const hyd = (x, z, ux, uz) => { const sd = rnd() < 0.5 ? -1 : 1, hx = x + ux * 9.6 + -uz * sd * 8.7, hz = z + uz * 9.6 + ux * sd * 8.7; if (rnd() < 0.2 && onSidewalk(hx, hz) && !solidAt(hx, hz)) hydrantSpots.push([hx, hz]); };
  for (let sj = SJ0; sj <= SJ1; sj++) for (let si = SI0; si < SI1; si++) if (nodeOK(si, sj) && nodeOK(si + 1, sj)) { segFurniture((si + 1) * P, sz(sj), 1, 0); hyd((si + 1) * P, sz(sj), 1, 0); }
  for (let si = SI0; si <= SI1; si++) for (let sj = SJ0; sj < SJ1; sj++) if (nodeOK(si, sj) && nodeOK(si, sj + 1)) segFurniture(sx(si), (sj + 1) * P, 0, 1);
  for (let z = 222; z < 400; z += 26) { benchSpots.push([-164.2, z, Math.PI / 2]); benchSpots.push([-155.8, z + 13, -Math.PI / 2]); }
  for (let z = 210; z < 410; z += 8) { treeSpots.push([-166.5, z]); treeSpots.push([-153.5, z]); }   // La Rambla
  for (let x = -460; x < 120; x += 14) if (Math.abs(x + 160) > 12) palmSpots.push([x, 433]);       // Moll de la Fusta
  for (let x = 390; x < 940; x += 22) palmSpots.push([x + rr(-3, 3), 298]);
  for (let i = 0; i < 520; i++) {
    const a = rnd() * TAU, r = Math.sqrt(rnd()) * MJ.r * 0.92, x = MJ.x + Math.cos(a) * r, z = MJ.z + Math.sin(a) * r;
    if (terrainH(x, z) > 3 && groundH(x, z) > 0.5 && d2(x, z, MJ.x, MJ.z) > 50 * 50 && d2(x, z, -700, 230) > 50 * 50) pineSpots.push([x, z]);
  }
  for (let i = 0; i < 900; i++) {
    const x = rr(-1150, 950), z = rr(-1080, -700);
    if (d2(x, z, -100, -745) < 70 * 70 || d2(x, z, 0, -1000) < 60 * 60) continue;
    pineSpots.push([x, z]);
  }
}
function buildInstanced() {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const make = (geo, mat, spots, fn, shadow = true) => {
    const im = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach((sp, i) => { fn(sp, i); m4.compose(p, q, s); im.setMatrixAt(i, m4); if (im.instanceColor !== undefined && fn.col) im.setColorAt(i, fn.col(i)); });
    im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  const cards = (geo, mat, spots, fn) => { const im = make(geo, mat, spots, fn); im.customDepthMaterial = mat.userData.depth; return im; };
  // plane trees (plàtans): mottled bark + leaf cards
  const trunkG = new THREE.CylinderGeometry(0.2, 0.32, 4.6, 7); trunkG.translate(0, 2.3, 0);
  make(trunkG, new THREE.MeshLambertMaterial({ map: barkTex }), treeSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); });
  const cp = [[0, 6.4, 0, 6.6, 5.4, 0], [0, 6.4, 0, 6.6, 5.4, Math.PI / 3], [0, 6.4, 0, 6.6, 5.4, 2 * Math.PI / 3], [0, 7.6, 0, 6.2, 6.2, 0.4, true], [1.4, 6.9, 0.8, 3.8, 3.4, 1.1], [-1.2, 7.2, -1, 3.8, 3.4, 2.2], [0.3, 5.4, -1.4, 3.6, 3, 0.2]]; cp.center = [0, 6.4, 0];
  const crownFn = (sp, i) => { const k = 0.85 + ((i * 7919) % 100) / 300; p.set(sp[0], CURB, sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, i * 1.7); s.set(k, k * 0.95, k); };
  crownFn.col = i => col.setHSL(0.2 + ((i * 31) % 10) / 120, 0.25, 0.78 + ((i * 17) % 10) / 60);
  cards(cardGeo(cp), cardMat(leafTex), treeSpots, crownFn);
  // palms
  const palmT = new THREE.CylinderGeometry(0.2, 0.34, 9.4, 7); palmT.translate(0, 4.7, 0);
  make(palmT, new THREE.MeshLambertMaterial({ map: palmBark }), palmSpots, sp => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.identity(); s.set(1, 1, 1); });
  const fr = []; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; fr.push(a); }
  const frondGeo = (() => { const pos = [], nor = [], uv = []; for (const a of fr) { const ca = Math.cos(a), sa = Math.sin(a), px2 = -sa, pz2 = ca, len = 4.6, w = 0.9;
      const pts = [[0, 9.3, 0], [ca * len * 0.55, 9.9, sa * len * 0.55], [ca * len, 8.2, sa * len]];
      for (let seg = 0; seg < 2; seg++) { const A = pts[seg], B = pts[seg + 1], v0 = seg / 2, v1 = (seg + 1) / 2;
        const Q = [[A[0] - px2 * w, A[1], A[2] - pz2 * w, 0, v0], [A[0] + px2 * w, A[1], A[2] + pz2 * w, 1, v0], [B[0] + px2 * w, B[1], B[2] + pz2 * w, 1, v1], [B[0] - px2 * w, B[1], B[2] - pz2 * w, 0, v1]];
        for (const ix of [0, 1, 2, 0, 2, 3]) { const qv = Q[ix]; pos.push(qv[0], qv[1], qv[2]); uv.push(qv[3], qv[4]); nor.push(ca * 0.4, 0.9, sa * 0.4); } } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; })();
  cards(frondGeo, cardMat(frondTex), palmSpots, (sp, i) => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, i * 0.7); s.set(1, 1, 1); });
  // pines on the hills: crossed cards
  const pg = [[0, 4.6, 0, 5.2, 9.2, 0], [0, 4.6, 0, 5.2, 9.2, Math.PI / 2]]; pg.center = [0, 3, 0];
  cards(cardGeo(pg), cardMat(pineTex), pineSpots, (sp, i) => { const k = 0.8 + (i % 7) / 10; p.set(sp[0], groundH(sp[0], sp[1]) - 0.3, sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, i); s.set(k, k, k); });
  // street lamps
  const poleG = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 5); poleG.translate(0, 3.25, 0);
  const headG = new THREE.BoxGeometry(0.7, 0.35, 0.7); headG.translate(0, 6.6, 0);
  lampPoleIM = make(poleG, lam('#2b3036'), lampSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); }, false);
  lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x8a8a80 });
  lampHeadIM = make(headG, lampHeadMat, lampSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); }, false);
  // benches (wood slats on cast-iron legs)
  const benchG = mergeColored([[G.box, '#7a5232', 0, 0.45, 0, 1.8, 0.06, 0.42], [G.box, '#7a5232', 0, 0.75, -0.2, 1.8, 0.3, 0.05, -0.2], [G.box, '#2b2f33', -0.75, 0.22, 0, 0.08, 0.45, 0.45], [G.box, '#2b2f33', 0.75, 0.22, 0, 0.08, 0.45, 0.45]]);
  benchIM = make(benchG, coreMat, benchSpots, sp => { p.set(sp[0], CURB, sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, sp[2]); s.set(1, 1, 1); });
  // recycling containers: body + darker lid, coloured per stream
  const binG = mergeColored([[G.box, '#ffffff', 0, 0.78, 0, 1.6, 1.45, 1.55], [G.box, '#bdbdbd', 0, 1.56, -0.05, 1.62, 0.14, 1.6, -0.08], [G.box, '#3a3a3a', 0, 0.06, 0, 1.4, 0.12, 1.35]]);
  const binFn = (sp) => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, sp[2] + Math.PI / 2); s.set(1, 1, 1); }; binFn.col = i => col.set(binSpots[i][3]);
  binIM = make(binG, new THREE.MeshLambertMaterial({ vertexColors: true }), binSpots, binFn);
  // Bicing docks: red bikes on a grey rack
  const ring = new THREE.TorusGeometry(0.32, 0.035, 5, 14); ring.rotateY(Math.PI / 2);
  const bikeG = mergeColored([[ring, '#1c1c1c', 0, 0.36, 0.52, 1, 1, 1], [ring, '#1c1c1c', 0, 0.36, -0.52, 1, 1, 1], [G.box, '#d6372b', 0, 0.62, 0, 0.07, 0.07, 0.95, 0.15], [G.box, '#d6372b', 0, 0.5, -0.2, 0.06, 0.45, 0.06, 0.3], [G.box, '#d6372b', 0, 0.62, 0.42, 0.06, 0.5, 0.06, -0.3], [G.box, '#1c1c1c', 0, 0.86, -0.25, 0.14, 0.05, 0.24], [G.box, '#2b2b2b', 0, 0.92, 0.5, 0.5, 0.04, 0.04], [G.box, '#d6372b', 0, 0.72, 0.62, 0.3, 0.2, 0.2], [G.box, '#9a9ea2', 0, 0.45, -0.75, 0.12, 0.9, 0.12]]);
  bikeIM = make(bikeG, coreMat, bikeSpots, sp => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, sp[2]); s.set(1, 1, 1); });
  const lp = new THREE.BufferGeometry(); lp.setAttribute('position', new THREE.Float32BufferAttribute(lampSpots.flatMap(sp => [sp[0], CURB + 6.45, sp[1]]), 3));
  lampCoronaGeo = lp;
  const lc = new THREE.Points(lp, coronaMat); lc.frustumCulled = false; scene.add(lc);
  const poolG = new THREE.PlaneGeometry(13, 13); poolG.rotateX(-Math.PI / 2);
  poolMat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  poolIM = make(poolG, poolMat, lampSpots, sp => { p.set(sp[0], CURB + 0.06, sp[1]); q.identity(); s.set(1, 1, 1); }, false); poolIM.receiveShadow = false;
  const hydG = mergeColored([[G.cyl, '#c23a2f', 0, 0.38, 0, 0.14, 0.7, 0.14], [G.sph, '#c23a2f', 0, 0.74, 0, 0.15, 0.1, 0.15], [G.cyl, '#d9d2c4', 0, 0.55, 0, 0.2, 0.08, 0.07], [G.cyl, '#5a5a5a', 0, 0.04, 0, 0.2, 0.08, 0.2]]);
  hydrantIM = make(hydG, coreMat, hydrantSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); });
}
let poolMat, lampPoleIM, lampHeadIM, benchIM, binIM, bikeIM, hydrantIM, poolIM, lampCoronaGeo;
let lampHeadMat;

// ---------- ground & water ----------
function groundColor(x, z, h) {
  if (h < WATER_Y - 0.3) return C3('#4a7a78');
  const sand = (x > 370 && z > 292) || (x > 120 && z > 411 && x <= 370);
  if (sand && h < 2) return C3('#c4ae7e');
  if (h > 2.5) { const k = clamp((h - 2.5) / 120, 0, 1); const c = new THREE.Color('#628d47').lerp(new THREE.Color('#7b8656'), k); c.offsetHSL(0, 0, (Math.sin(x * 0.05) * Math.cos(z * 0.06)) * 0.03); return [c.r, c.g, c.b]; }
  if (z > 204 && x > -470 && x < 370 && z < 432) return C3('#8b8478');
  if (x < -610 && d2(x, z, -820, -250) < 130 * 130) return C3('#5f8c4a');
  return C3('#5c5e63');
}
function buildGround() {
  const W = 2300, D = 1900, geo = new THREE.PlaneGeometry(W, D, 230, 190);
  geo.rotateX(-Math.PI / 2); geo.translate(-100, 0, -170);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = groundH(x, z);
    pos.setY(i, h); const c = groundColor(x, z, h); cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  groundDetail.repeat.set(W / 9, D / 9);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: groundDetail })); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  const wgeo = new THREE.PlaneGeometry(5200, 4200); wgeo.rotateX(-Math.PI / 2);
  waterNormal.repeat.set(5200 / 14, 4200 / 14);
  water = new THREE.Mesh(wgeo, new THREE.MeshPhongMaterial({ color: 0x1f6680, specular: 0xfff4e0, shininess: 140, normalMap: waterNormal, normalScale: new THREE.Vector2(0.7, 0.7), envMap: envCube, reflectivity: 0.35, combine: THREE.MixOperation, transparent: true, opacity: 0.9 }));
  water.position.set(-100, WATER_Y, 400); scene.add(water);
}
let water;

// ---------- landmarks ----------
const signs = [];
function addSign(text, x, y, z, rotY, w, h, bg = '#14243a', fg = '#f2c230') {
  const t = signTex(text, bg, fg);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glowMat(0xffffff, t, 0.9)); m.material.map = t;
  m.position.set(x, y, z); m.rotation.y = rotY; scene.add(m); return m;
}
function mesh(geo, mat, x, y, z, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; }
function gaudiTower(h, r, x, y, z, mat, capMat) {
  const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector2(Math.max(0.15, r * Math.pow(1 - t, 0.62)), t * h)); }
  const m = mesh(new THREE.LatheGeometry(pts, 10), mat, x, y, z);
  mesh(new THREE.SphereGeometry(r * 0.32, 8, 6), capMat, x, y + h * 0.97, z);
  return m;
}
function buildLandmarks() {
  const stone = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xffffff });
  const mosaicM = new THREE.MeshLambertMaterial({ map: mosaicTex });
  // --- Sagrada Família (block 3,-4) ---
  { const cx = 240, cz = -320;
    const nave = new THREE.Mesh(new THREE.BoxGeometry(50, 42, 26), stone); nave.position.set(cx, 21, cz); nave.castShadow = true; scene.add(nave);
    mesh(new THREE.BoxGeometry(24, 46, 52), stone, cx + 4, 23, cz);
    mesh(new THREE.ConeGeometry(16, 14, 4), lam('#b9a27c'), cx, 49, cz).rotation.y = Math.PI / 4;
    for (const [dx, dz, h] of [[20, -9, 104], [20, -3, 112], [20, 3, 112], [20, 9, 104], [-24, -9, 100], [-24, -3, 108], [-24, 3, 108], [-24, 9, 100], [-8, 22, 90], [-2, 22, 96], [8, 22, 96], [14, 22, 90]])
      gaudiTower(h, 3.6, cx + dx, 0, cz + dz, stone, mosaicM);
    gaudiTower(172, 9, cx + 2, 0, cz, stone, lam('#f4f1e8'));
    mesh(new THREE.BoxGeometry(1.2, 14, 1.2), lam('#ffffff', { emissive: 0xffffff, emissiveIntensity: 0.3 }), cx + 2, 176, cz);
    mesh(new THREE.BoxGeometry(8, 1.2, 1.2), lam('#ffffff', { emissive: 0xffffff, emissiveIntensity: 0.3 }), cx + 2, 178, cz);
    gaudiTower(138, 7, cx - 10, 0, cz - 4, stone, lam('#f2f0ff', { emissive: 0x99aaff, emissiveIntensity: 0.4 }));
    for (const [dx, dz] of [[-8, -12], [-8, 12], [12, -12], [12, 12]]) gaudiTower(135, 5, cx + dx, 0, cz + dz, stone, mosaicM);
    // construction crane
    const y = lam('#e2b230'); mesh(new THREE.BoxGeometry(2, 190, 2), y, cx + 30, 95, cz - 26); mesh(new THREE.BoxGeometry(70, 2, 2), y, cx + 15, 189, cz - 26); mesh(new THREE.BoxGeometry(5, 4, 4), lam('#333'), cx + 50, 186, cz - 26);
    addSolid(rectPoly(cx - 27, cz - 27, cx + 25, cz + 27), 60); boxSolid(cx + 30, cz - 26, 3, 3, 200);
    addLoop(octagon(cx, cz, 30.5, 13), CURB); }
  // --- Torre Glòries (block 6,0) ---
  { const cx = 480, cz = 0, pts = [];
    for (let k = 0; k <= 16; k++) { const t = k / 16; const y = t * 144; const r = y < 96 ? 19 - y * 0.015 : (17.6) * Math.sqrt(Math.max(0, 1 - Math.pow((y - 96) / 48, 2))); pts.push(new THREE.Vector2(Math.max(0.1, r), y)); }
    gloriesTex.repeat.set(6, 3);
    const m = new THREE.MeshLambertMaterial({ map: gloriesTex, emissiveMap: gloriesTex, emissive: 0xffffff, emissiveIntensity: 0 }); nightMats.push({ m, max: 1.1 });
    mesh(new THREE.LatheGeometry(pts, 24), m, cx, 0, cz);
    addSolid(circlePoly(cx, cz, 19.5, 16), 144); addLoop(circlePoly(cx, cz, 23, 16), CURB);
    addSign('TORRE GLÒRIES', cx, 3.2, cz + 26, 0, 14, 3.2); }
  // --- Arc de Triomf (block 2,1) ---
  { const cx = 160, cz = 80, b = lam('#b4553a');
    mesh(new THREE.BoxGeometry(7, 26, 7), b, cx - 9, 13, cz); mesh(new THREE.BoxGeometry(7, 26, 7), b, cx + 9, 13, cz);
    mesh(new THREE.BoxGeometry(26, 8, 7.4), b, cx, 28, cz); mesh(new THREE.BoxGeometry(27, 1.4, 8), lam('#d7c7a8'), cx, 32.6, cz);
    boxSolid(cx - 9, cz, 7, 7, 32); boxSolid(cx + 9, cz, 7, 7, 32);
    addLoop(octagon(cx, cz, 26, 11), CURB); }
  // --- Hospital de Sant Pau (block 4,-6) ---
  { const cx = 320, cz = -480, brick = lam('#b4573f');
    building(rectPoly(cx - 14, cz - 26, cx + 14, cz - 12), 4, C3('#c96a4c'), C3('#3c8a7a'));
    mesh(new THREE.CylinderGeometry(0.1, 4, 14, 8), mosaicM, cx, 23, cz - 19);
    for (const [dx, dz] of [[-18, 4], [18, 4], [-18, 20], [18, 20], [0, 14]]) {
      building(rectPoly(cx + dx - 6, cz + dz - 5, cx + dx + 6, cz + dz + 5), 2, C3('#c26a4e'), C3('#4b9c84'));
      mesh(new THREE.SphereGeometry(4, 10, 6, 0, TAU, 0, Math.PI / 2), mosaicM, cx + dx, 7, cz + dz);
    }
    addSign('HOSPITAL DE SANT PAU', cx, 9, cz - 11.8, 0, 16, 2.6, '#f4efe4', '#a8352a'); void brick;
    addLoop(octagon(cx, cz, 30.5, 13), CURB); }
  // --- Plaça de Catalunya (block -2,2) ---
  { const cx = -160, cz = 160;
    mesh(new THREE.CylinderGeometry(9, 10, 0.9, 24), lam('#d6d0c4'), cx - 14, 0.6, cz - 8, false);
    mesh(new THREE.CylinderGeometry(8.4, 8.4, 0.3, 24), new THREE.MeshPhongMaterial({ color: 0x3d8db5, shininess: 80 }), cx - 14, 1.0, cz - 8, false);
    mesh(new THREE.CylinderGeometry(0.6, 1.2, 4, 8), lam('#cfc8b8'), cx - 14, 2.5, cz - 8);
    addSolid(circlePoly(cx - 14, cz - 8, 10, 12), 1.2);
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; treeSpots.push([cx + 14 + Math.cos(a) * 12, cz + 6 + Math.sin(a) * 12]); }
    addLoop(octagon(cx, cz, 26, 11), CURB); addLoop(circlePoly(cx - 14, cz - 8, 13, 12), CURB); }
  // --- La Rambla promenade, Miró mosaic, kiosks ---
  { const p = rectPoly(-168, 204, -152, 412); prism(sideAcc, sideAcc, p, -0.3, CURB, SIDE_COL, SIDE_COL, { roofUV: 2, uFixed: 2, vFixed: 2 }); addSide(p);
    addLoop(rectPoly(-165, 208, -155, 408), CURB); addLoop(rectPoly(-163, 230, -157, 390), CURB);
    const miro = canvasTex(256, 256, g => { g.fillStyle = '#e8e2d2'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill(); const c = ['#d6372b', '#f2c230', '#2b5fa8', '#1e1e1e']; for (let i = 0; i < 14; i++) { g.fillStyle = c[i % 4]; g.beginPath(); g.arc(rr(50, 206), rr(50, 206), rr(10, 34), 0, TAU); g.fill(); } }, false);
    const disc = mesh(new THREE.CircleGeometry(5.5, 24), new THREE.MeshLambertMaterial({ map: miro, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }), -160, CURB + 0.02, 336, false); disc.rotation.x = -Math.PI / 2;
    for (const z of [252, 290, 372]) { mesh(new THREE.BoxGeometry(3.4, 2.8, 5), lam('#2f5d46'), -160, CURB + 1.4, z); mesh(new THREE.BoxGeometry(4.4, 0.3, 6.2), lam('#d6372b'), -160, CURB + 3, z); boxSolid(-160, z, 3.4, 5, 3); } }
  // --- Plaça Reial ---
  { const p = rectPoly(-138, 340, -110, 372); prism(sideAcc, sideAcc, p, -0.3, CURB, SIDE_COL, SIDE_COL, { roofUV: 2, uFixed: 2, vFixed: 2 }); addSide(p);
    rowOfBuildings(-142, 332, -106, 338, 5, 5, ['#e3cf9e']); rowOfBuildings(-142, 374, -106, 380, 5, 5, ['#e3cf9e']);
    for (const [x, z] of [[-132, 346], [-116, 346], [-132, 366], [-116, 366]]) palmSpots.push([x, z]);
    mesh(new THREE.CylinderGeometry(2.5, 3, 1.4, 12), lam('#cfc8b8'), -124, 0.9, 356); addSolid(circlePoly(-124, 356, 3, 10), 1.6);
    addLoop(rectPoly(-135, 343, -113, 369), CURB); }
  // --- Barcelona Cathedral (Gothic) ---
  { const cx = -55, cz = 275, dark = lam('#8f8371');
    mesh(new THREE.BoxGeometry(26, 26, 44), dark, cx, 13, cz);
    for (const [dx, dz, h] of [[-10, 20, 46], [10, 20, 46], [0, -14, 62]]) { mesh(new THREE.BoxGeometry(6, h, 6), dark, cx + dx, h / 2, cz + dz); mesh(new THREE.ConeGeometry(4, 16, 8), dark, cx + dx, h + 8, cz + dz); }
    addSolid(rectPoly(cx - 13, cz - 22, cx + 13, cz + 23), 62); addLoop(rectPoly(cx - 15, cz - 24, cx + 15, cz + 25), 0); }
  // --- Comissaria (Via Laietana) ---
  building(rectPoly(44, 234, 92, 262), 6, C3('#c8c2b4'), C3('#9c968a'));
  addSign('COMISSARIA', 43.8, 6, 248, -Math.PI / 2, 14, 2.6, '#1d3f73', '#ffffff');
  // --- Columbus column at the port ---
  { const cx = -160, cz = 444;
    mesh(new THREE.CylinderGeometry(8, 9, 12, 12), lam('#b9b1a0'), cx, 2, cz); mesh(new THREE.CylinderGeometry(1.8, 2.3, 44, 10), lam('#5d564a'), cx, 30, cz);
    mesh(new THREE.SphereGeometry(2.4, 10, 8), lam('#8a7a52'), cx, 53, cz); mesh(new THREE.BoxGeometry(0.8, 4, 0.8), lam('#5d564a'), cx, 56.5, cz);
    addSolid(circlePoly(cx, cz, 9, 12), 60); }
  // --- Pinta Ràpid garages ---
  for (const [x, z, rot, sx2, sz2] of [[-315, 397, 0, 34, 24], [-680, -112, 0, 36, 20]]) {
    building(rectPoly(x - sx2 / 2, z - sz2 / 2, x + sx2 / 2, z + sz2 / 2), 2, C3('#e8e4dc'), C3('#9c968a'));
    addSign('PINTA RÀPID', x, 5.6, z + sz2 / 2 + 0.15, rot, 16, 3, '#d9412f', '#ffffff');
    mesh(new THREE.BoxGeometry(10, 5, 0.3), lam('#2a2a2a'), x, 2.5, z + sz2 / 2 + 0.1, false);
  }
  // --- Bar Can Ferrer, La Barceloneta ---
  addSign('BAR CAN FERRER', 246, 4.6, 397.25, 0, 12, 2.4, '#2a6b5c', '#f4efe4');
  mesh(new THREE.BoxGeometry(12, 0.3, 3), lam('#d6372b'), 246, 3.2, 398.6, false);
  // --- Hotel towers & golden fish on the beach ---
  { glassTex.repeat.set(8, 40); glassNight.repeat.set(8, 40);
    const gm = new THREE.MeshLambertMaterial({ map: glassTex, emissiveMap: glassNight, emissive: 0xffffff, emissiveIntensity: 0 }); nightMats.push({ m: gm, max: 0.8 });
    for (const x of [545, 625]) { mesh(new THREE.BoxGeometry(28, 150, 28), gm, x, 75, 340); boxSolid(x, 340, 28, 28, 150); }
    const gold = new THREE.MeshPhongMaterial({ color: 0xd4a73c, specular: 0xfff0b0, shininess: 90, flatShading: true });
    mesh(new THREE.BoxGeometry(30, 10, 22), lam('#cfc6b4'), 480, 5, 345); boxSolid(480, 345, 30, 22, 10);
    const fish = mesh(new THREE.SphereGeometry(1, 14, 8), gold, 480, 17.5, 345); fish.scale.set(22, 8, 6);
    const tail = mesh(new THREE.ConeGeometry(7, 10, 4), gold, 503, 17.5, 345); tail.rotation.z = Math.PI / 2;
    for (const [x, z] of [[420, 360], [700, 360], [820, 360]]) { building(rectPoly(x - 5, z - 4, x + 5, z + 4), 1, C3('#d9b07a'), C3('#e2e2dc')); mesh(new THREE.BoxGeometry(12, 0.3, 10), lam('#3a8fc2'), x, 3.8, z, false); }
    for (const [x, z] of [[460, 400], [600, 405], [760, 400]]) { mesh(new THREE.BoxGeometry(2, 5, 2), lam('#e9e3d6'), x, groundH(x, z) + 2.5, z); mesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), lam('#d9412f'), x, groundH(x, z) + 5.2, z); }
    for (let k = 0; k < 7; k++) addLoop(rectPoly(390 + k * 75, 312 + (k % 3) * 25, 440 + k * 75, 335 + (k % 3) * 25), 0); }
  // --- W-style sail hotel on the breakwater ---
  { const g = new THREE.CylinderGeometry(55, 55, 98, 20, 1, false, -0.45, 0.9);
    const gm = new THREE.MeshPhongMaterial({ color: 0x6f93b0, specular: 0xcfe6ff, shininess: 120 });
    const m = mesh(g, gm, 170, 49, 410); m.rotation.y = Math.PI; m.scale.z = 0.35;
    const pier = rectPoly(140, 446, 220, 520); prism(sideAcc, sideAcc, pier, -5, 0.6, SIDE_COL, SIDE_COL, { roofUV: 2 });
    addSolid(rectPoly(150, 452, 190, 474), 98); }
  // --- Montjuïc castle and a domed palace ---
  { const cx = MJ.x, cz = MJ.z, by = MJ.h, w = lam('#a89a7e');
    mesh(new THREE.BoxGeometry(44, 14, 44), w, cx, by + 5, cz + 10);
    for (const [dx, dz] of [[-24, -14], [24, -14], [-24, 34], [24, 34]]) mesh(new THREE.BoxGeometry(12, 15, 12), w, cx + dx, by + 5.5, cz + dz);
    mesh(new THREE.BoxGeometry(10, 26, 10), w, cx, by + 13, cz + 10);
    mesh(new THREE.CylinderGeometry(0.15, 0.15, 10, 5), lam('#333'), cx, by + 31, cz + 10);
    const flag = canvasTex(90, 60, g => { for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#d6372b' : '#f2c230'; g.fillRect(0, i * 60 / 9, 90, 60 / 9 + 1); } }, false);
    const f = mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshLambertMaterial({ map: flag, side: THREE.DoubleSide }), cx + 3, by + 34, cz + 10, false); f.userData.flag = true; flagMesh = f;
    addSolid(rectPoly(cx - 30, cz - 20, cx + 30, cz + 40), by + 20);
    const py = groundH(-700, 230); mesh(new THREE.BoxGeometry(70, 20, 30), lam('#d8c9a8'), -700, py + 8, 230);
    mesh(new THREE.SphereGeometry(11, 16, 8, 0, TAU, 0, Math.PI / 2), lam('#a58f6a'), -700, py + 18, 230);
    for (const dx of [-30, 30]) mesh(new THREE.BoxGeometry(5, 34, 5), lam('#d8c9a8'), -700 + dx, py + 15, 220);
    addSolid(rectPoly(-735, 215, -665, 245), py + 34); }
  // --- Park Güell ---
  { const cx = -100, cz = -745, gy = groundH(cx, cz);
    const terrace = rectPoly(cx - 34, cz - 22, cx + 34, cz + 22);
    prism(sideAcc, sideAcc, terrace, gy - 24, gy + 1.5, SIDE_COL, SIDE_COL, { roofUV: 2, uFixed: 4, vFixed: 4 }); addSolid(terrace, gy + 1.5);
    for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 6, 16, Math.PI), mosaicM); t.position.set(cx - 30 + k * 10, gy + 1.6, cz + 20 + (k % 2 ? -1.4 : 1.4)); t.rotation.x = -Math.PI / 2; t.rotation.z = k % 2 ? 0 : Math.PI; t.scale.z = 1.6; scene.add(t); }
    for (const dx of [-20, 20]) { const hz = cz + 40, hy = groundH(cx + dx, hz); mesh(new THREE.BoxGeometry(10, 8, 10), lam('#d6c39e'), cx + dx, hy + 4, hz); mesh(new THREE.ConeGeometry(6.5, 8, 6), mosaicM, cx + dx, hy + 12, hz); mesh(new THREE.CylinderGeometry(0.6, 1.2, 6, 8), mosaicM, cx + dx + 3, hy + 15, hz); boxSolid(cx + dx, hz, 10, 10, hy + 16); }
    const lizard = mesh(new THREE.SphereGeometry(1, 10, 6), mosaicM, cx, gy - 2, cz + 28); lizard.scale.set(1.6, 1, 3.4);
  }
  // --- Tibidabo church & wheel ---
  { const cx = 0, cz = -1000, gy = groundH(cx, cz);
    mesh(new THREE.BoxGeometry(30, 22, 40), lam('#c9bfae'), cx, gy + 10, cz); mesh(new THREE.CylinderGeometry(4, 6, 30, 8), lam('#c9bfae'), cx, gy + 35, cz);
    mesh(new THREE.BoxGeometry(2, 7, 2), lam('#c7a54a', { emissive: 0xc7a54a, emissiveIntensity: 0.3 }), cx, gy + 54, cz);
    addSolid(rectPoly(cx - 15, cz - 20, cx + 15, cz + 20), gy + 50);
    const wheel = mesh(new THREE.TorusGeometry(14, 0.6, 6, 28), lam('#d6372b'), cx + 45, gy + 17, cz + 10); wheel.rotation.y = 0.4; ferris = wheel; }
  // --- Football stadium (Les Corts) ---
  { const cx = -820, cz = -250, pts = [new THREE.Vector2(62, 0), new THREE.Vector2(62, 3), new THREE.Vector2(104, 38), new THREE.Vector2(110, 40), new THREE.Vector2(112, 0)];
    mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshLambertMaterial({ color: 0x9aa3ad, side: THREE.DoubleSide }), cx, 0, cz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(83, 1.2, 4, 40), lam('#2b5fa8')); ring.position.set(cx, 20, cz); ring.rotation.x = -Math.PI / 2; ring.scale.z = 0.4; scene.add(ring);
    const pitch = mesh(new THREE.PlaneGeometry(68, 105), lam('#4c9a3f'), cx, 0.1, cz, false); pitch.rotation.x = -Math.PI / 2;
    addSolid(circlePoly(cx, cz, 112, 20), 40);
    addSign('ESTADI', cx, 32, cz + 112.5, 0, 26, 5, '#2b5fa8', '#ffffff'); }
  // --- harbour boats ---
  for (let k = 0; k < 9; k++) { const x = -420 + k * 52, z = 462 + (k % 2) * 16; const b = mesh(new THREE.BoxGeometry(5, 1.8, 14), lam(k % 3 ? '#f4efe4' : '#2b5fa8'), x, WATER_Y + 0.6, z); b.rotation.y = 0.1 * (k % 3); mesh(new THREE.CylinderGeometry(0.1, 0.1, 12, 4), lam('#ddd'), x, WATER_Y + 7, z, false); boats.push(b); }
}
let flagMesh, ferris; const boats = [];

// ====================== HUMANS ======================
const SKINS = ['#f1c9a5', '#e3b48e', '#d9a77f', '#c08a62', '#a8714c', '#8a5a3a', '#6b4430', '#f4d2b6'];
const SHIRTS = ['#d6372b', '#2b5fa8', '#e8e3d6', '#3c9a5f', '#e2b230', '#7b4a8f', '#1e1e22', '#e07a4a', '#5fb2e0', '#c9c3b5', '#f2f0ea', '#8a2f3a', '#2f6f6a', '#d98fa8'];
const PANTS = ['#2b3a55', '#3a3a3a', '#6b5a42', '#1e2430', '#8a8070', '#2f4f3a', '#3d4f7a', '#c9bfa8'];
const HAIRS = ['#2a1f18', '#5a3a22', '#c8b07a', '#1a1a1a', '#8a8a8a', '#a0522d', '#3b2a1e', '#d9cfc0'];
const boxG = {};
function bx(w, h, d) { const k = w + ',' + h + ',' + d; return boxG[k] || (boxG[k] = new THREE.BoxGeometry(w, h, d)); }
// tapered limb: pivot at the top, hanging down -y
const limbG = {};
function limbGeo(r0, r1, h) { const k = r0 + ',' + r1 + ',' + h; if (limbG[k]) return limbG[k]; const g = new THREE.CylinderGeometry(r0, r1, h, 8); g.translate(0, -h / 2, 0); return (limbG[k] = g); }
const faceDecalTex = canvasTex(64, 64, g => {
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#f6f3ee'; g.beginPath(); g.ellipse(21, 27, 6, 3.6, 0, 0, TAU); g.ellipse(43, 27, 6, 3.6, 0, 0, TAU); g.fill();
  g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(22, 27, 2.8, 0, TAU); g.arc(42, 27, 2.8, 0, TAU); g.fill();
  g.fillStyle = '#0c0a08'; g.beginPath(); g.arc(22, 27, 1.3, 0, TAU); g.arc(42, 27, 1.3, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(40,25,15,0.85)'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 20); g.quadraticCurveTo(21, 16.5, 28, 19.5); g.moveTo(36, 19.5); g.quadraticCurveTo(43, 16.5, 50, 20); g.stroke();
  g.strokeStyle = 'rgba(70,40,30,0.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(32, 30); g.lineTo(30, 40); g.lineTo(34, 41); g.stroke();
  g.strokeStyle = 'rgba(120,50,45,0.8)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(25, 49); g.quadraticCurveTo(32, 52, 39, 49); g.stroke();
}, false);
const faceDecalMat = new THREE.MeshLambertMaterial({ map: faceDecalTex, transparent: true, alphaTest: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
const shadesMat = new THREE.MeshPhongMaterial({ color: 0x0c0c0e, specular: 0x8899aa, shininess: 90 });
const faceGeo = new THREE.PlaneGeometry(0.2, 0.2);
// merge rigid parts into one vertex-coloured mesh (one draw call per body core)
function mergeColored(parts) {
  const pos = [], nor = [], col = [], m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), c = new THREE.Color();
  for (const [geo, color, x, y, z, sx, sy, sz, rx] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, 0, 0)), new THREE.Vector3(sx, sy, sz)); nm.getNormalMatrix(m); c.set(color);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    if (g !== geo) g.dispose();
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return out;
}
const coreMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const G = { sph: new THREE.SphereGeometry(1, 14, 10), cap: new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI * 0.55), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), torso: new THREE.CylinderGeometry(1, 0.82, 1, 10), cone: new THREE.CylinderGeometry(0.55, 1, 1, 12, 1, true), box: new THREE.BoxGeometry(1, 1, 1) };
function makeHuman(o) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const k = o.build || 1, sk = o.skin, hairC = o.hair || '#2a1f18';
  const parts = [];
  const P2 = (geo, c, x, y, z, sx, sy, sz, rx) => parts.push([geo, c, x, y, z, sx, sy, sz, rx]);
  // torso, hips, neck, head (rigid core)
  const top = o.jacket || o.shirt;
  P2(G.torso, top, 0, 1.25, 0, 0.25 * k, 0.6, 0.15 * k);
  if (o.jacket) { P2(G.box, o.shirt, 0, 1.3, 0.13 * k, 0.12, 0.46, 0.03); if (o.tie) P2(G.box, o.tie, 0, 1.3, 0.148 * k, 0.04, 0.34, 0.02); }
  if (o.female && !o.jacket) P2(G.sph, top, 0, 1.33, 0.08 * k, 0.2 * k, 0.09, 0.08);
  P2(G.cyl, o.skirt || o.pants, 0, 0.96, 0, 0.19 * k, 0.16, 0.12 * k);
  P2(G.cyl, '#2a2522', 0, 1.02, 0, 0.195 * k, 0.04, 0.125 * k);
  if (o.skirt) P2(G.cone, o.skirt, 0, 0.76, 0, 0.27 * k, 0.42, 0.2 * k);
  P2(G.cyl, sk, 0, 1.6, 0, 0.055, 0.12, 0.055);
  P2(G.sph, sk, 0, 1.76, 0, 0.13, 0.155, 0.14);
  P2(G.box, sk, 0, 1.745, 0.135, 0.035, 0.05, 0.04);
  P2(G.sph, sk, -0.13, 1.76, 0, 0.022, 0.04, 0.03); P2(G.sph, sk, 0.13, 1.76, 0, 0.022, 0.04, 0.03);
  const hs = o.hairStyle || 'short';
  if (hs !== 'bald') P2(G.cap, hairC, 0, 1.78, -0.012, 0.142, hs === 'curly' ? 0.17 : 0.155, 0.152, -0.25);
  else P2(G.cap, hairC, 0, 1.73, -0.03, 0.14, 0.12, 0.15, -1.2);
  if (hs === 'long') P2(G.box, hairC, 0, 1.6, -0.1, 0.27, 0.36, 0.06);
  if (hs === 'bun') P2(G.sph, hairC, 0, 1.87, -0.1, 0.07, 0.06, 0.07);
  if (hs === 'curly') P2(G.sph, hairC, 0, 1.84, -0.03, 0.16, 0.1, 0.16);
  if (o.cap) { P2(G.cap, o.cap, 0, 1.8, 0, 0.15, 0.1, 0.16); P2(G.box, o.cap, 0, 1.8, 0.16, 0.2, 0.015, 0.13); }
  if (o.backpack) { P2(G.box, o.backpack, 0, 1.3, -0.2 * k, 0.3, 0.4, 0.15); }
  if (o.bag) P2(G.box, o.bag, -0.27 * k, 1.0, 0.02, 0.07, 0.22, 0.26);
  const core = new THREE.Mesh(mergeColored(parts), coreMat); core.castShadow = true; core.userData.own = true; body.add(core);
  const face = new THREE.Mesh(faceGeo, faceDecalMat); face.position.set(0, 1.775, 0.137); body.add(face);
  if (o.shades) { const sg = new THREE.Mesh(bx(0.2, 0.045, 0.02), shadesMat); sg.position.set(0, 1.785, 0.15); body.add(sg); }
  // limbs
  const mk = (geo, color, parent, x, y, z) => { const m = new THREE.Mesh(geo, lam(color)); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const legCol = o.skirt || o.shorts ? sk : o.pants, thighCol = o.skirt ? sk : o.pants;
  const leg = side => {
    const hip = joint(body, side * 0.1 * k, 0.94, 0);
    mk(limbGeo(0.085 * k, 0.065, 0.45), thighCol, hip, 0, 0, 0);
    const knee = joint(hip, 0, -0.45, 0);
    mk(limbGeo(0.064, 0.05, 0.42), legCol, knee, 0, 0, 0);
    if (o.shorts) mk(limbGeo(0.09 * k, 0.085, 0.12), o.pants, hip, 0, -0.33, 0);
    const shoe = mk(bx(0.11, 0.08, 0.26), o.shoes || '#2a2420', knee, 0, -0.43, 0.05);
    return [hip, knee, shoe];
  };
  const arm = side => {
    const sh = joint(body, side * 0.29 * k, 1.5, 0);
    mk(limbGeo(0.058 * k, 0.05, 0.3), o.jacket || o.shirt, sh, 0, 0, 0);
    const el = joint(sh, 0, -0.3, 0);
    mk(limbGeo(0.048, 0.04, 0.26), o.sleeves === false ? sk : (o.jacket || o.shirt), el, 0, 0, 0);
    if (o.sleeves === false && !o.jacket) {} 
    const hand = mk(G.sph, sk, el, 0, -0.3, 0.01); hand.scale.set(0.045, 0.06, 0.035);
    return [sh, el];
  };
  const [legL, kneeL] = leg(-1), [legR, kneeR] = leg(1), [armL, elbowL] = arm(-1), [armR, elbowR] = arm(1);
  armL.rotation.z = -0.08; armR.rotation.z = 0.08;
  const sc = o.height || 1; g.scale.set(sc, sc, sc);
  scene.add(g);
  return { g, body, legL, legR, armL, armR, kneeL, kneeR, elbowL, elbowR, gait: o.gait || 1 };
}
function animHuman(h, phase, amt, punch) {
  const s = Math.sin(phase), c = Math.cos(phase), a = amt * h.gait;
  h.legL.rotation.x = -s * 0.55 * a; h.legR.rotation.x = s * 0.55 * a;
  h.kneeL.rotation.x = (0.08 + Math.max(0, c) * 0.95) * a; h.kneeR.rotation.x = (0.08 + Math.max(0, -c) * 0.95) * a;
  h.armL.rotation.x = s * 0.5 * a; h.elbowL.rotation.x = -0.2 - 0.35 * a;
  if (punch > 0) { const t = Math.sin(punch * Math.PI); h.armR.rotation.x = -1.55 * t - 0.1; h.elbowR.rotation.x = -1.2 * (1 - t); }
  else { h.armR.rotation.x = -s * 0.5 * a; h.elbowR.rotation.x = -0.2 - 0.35 * a; }
  h.body.position.y = Math.abs(c) * 0.035 * a;
  h.body.rotation.y = s * 0.08 * a;
  if (amt === 0) { const br = Math.sin(now * 0.002) * 0.02; h.armL.rotation.x = br; h.armR.rotation.x = punch > 0 ? h.armR.rotation.x : -br; h.body.position.y = 0; h.body.rotation.y = 0; }
}
function randomLook() {
  const r = R(), skin = pR(SKINS);
  if (r < 0.2) { // tourist
    return { skin, shirt: pR(['#f2f0ea', '#e2b230', '#5fb2e0', '#d6372b', '#7fb069', '#ef8a9a']), pants: pR(['#c9bfa8', '#3d4f7a', '#8a8070']), shorts: true, sleeves: false, hair: pR(HAIRS), hairStyle: pR(['short', 'short', 'long', 'bald']), cap: R() < 0.5 ? pR(['#e8e3d6', '#d6372b', '#2b5fa8']) : null, backpack: R() < 0.6 ? pR(['#2f4f3a', '#3a3a3a', '#d6372b', '#2b5fa8']) : null, shades: R() < 0.5, shoes: '#e8e6df', build: rR(0.95, 1.15), height: rR(0.95, 1.07), gait: 0.9 };
  }
  if (r < 0.32) { // older resident
    return { skin, shirt: pR(['#8a8070', '#5a4a3a', '#c9c3b5', '#3d4f5a']), jacket: R() < 0.6 ? pR(['#5a4a3a', '#3a3a40', '#6b5a42', '#7a6a5a']) : null, pants: pR(['#3a3a3a', '#5a4a3a', '#2b3a55']), skirt: R() < 0.4 ? pR(['#3a3a40', '#5a3a3a', '#2b3a55']) : null, female: R() < 0.5, hair: pR(['#d9cfc0', '#b8b0a4', '#8a8a8a', '#e8e4dc']), hairStyle: pR(['short', 'bun', 'bald', 'curly']), bag: R() < 0.4 ? '#5a3a22' : null, build: rR(1, 1.18), height: rR(0.92, 0.99), gait: 0.7 };
  }
  if (r < 0.45) { // office worker
    return { skin, shirt: pR(['#f2f0ea', '#cfe0ee', '#e8e3d6']), jacket: pR(['#1e2430', '#2b2f3a', '#3d3d42', '#4a4038']), tie: R() < 0.5 ? pR(['#8a2f3a', '#2b5fa8', '#1e1e22']) : null, pants: pR(['#1e2430', '#2b2f3a', '#3d3d42']), skirt: R() < 0.3 ? pR(['#1e2430', '#3d3d42']) : null, hair: pR(HAIRS), hairStyle: pR(['short', 'short', 'long', 'bun']), shoes: '#141414', bag: R() < 0.5 ? '#1e1e1e' : null, build: rR(0.92, 1.08), height: rR(0.96, 1.06), gait: 1.05 };
  }
  const female = R() < 0.5;
  return { skin, shirt: pR(SHIRTS), pants: pR(PANTS), skirt: female && R() < 0.35 ? pR(['#2b3a55', '#d6372b', '#e2b230', '#1e1e22', '#7b4a8f', '#3c9a5f']) : null, female, sleeves: R() < 0.5, shorts: !female && R() < 0.15, hair: pR(HAIRS), hairStyle: female ? pR(['long', 'long', 'bun', 'short', 'curly']) : pR(['short', 'short', 'curly', 'bald']), shades: R() < 0.12, bag: female && R() < 0.4 ? pR(['#5a3a22', '#1e1e22', '#c23a3a']) : null, shoes: pR(['#2a2420', '#e8e6df', '#1e1e22', '#5a3a22']), build: rR(0.9, 1.15), height: rR(0.93, 1.06) };
}
function disposeGroup(g) { scene.remove(g); g.traverse(m => { if (m.isMesh && m.userData.own) m.geometry.dispose(); }); }


// ====================== VEHICLES ======================
const VT = {
  picolo: { name: 'Rossa Pícolo', len: 3.9, wid: 1.72, h: 1.45, acc: 14, max: 40, grip: 7, mass: 1, hp: 900, cols: ['#c8342b', '#2d5fa8', '#e6e1d3', '#2b8a5a', '#d9a12c', '#7a7f88', '#5a5f68'] },
  taxi: { name: 'Taxi Comtal', len: 4.5, wid: 1.8, h: 1.5, acc: 13, max: 42, grip: 7, mass: 1.1, hp: 1000, cols: ['#121214'], taxi: true },
  furgo: { name: 'Furgo Mercat', len: 5.1, wid: 2.0, h: 2.3, acc: 9.5, max: 33, grip: 6, mass: 1.8, hp: 1300, cols: ['#e8e6df', '#b8c2c8', '#3a5f8f', '#d9c9a3'], van: true },
  delfi: { name: 'Delfí GT', len: 4.4, wid: 1.9, h: 1.2, acc: 23, max: 60, grip: 8.5, mass: 1.1, hp: 900, cols: ['#e2b230', '#d63a2f', '#1c1c22', '#ececec', '#2f7fb0'] },
  patrulla: { name: 'Patrulla Comtal', len: 4.6, wid: 1.85, h: 1.5, acc: 19, max: 54, grip: 8, mass: 1.3, hp: 1200, cols: ['#f2f2f0'], police: true },
  moto: { name: 'Llamp 600', len: 2.1, wid: 0.8, h: 1.2, acc: 24, max: 56, grip: 9.5, mass: 0.5, hp: 450, cols: ['#d6372b', '#1c1c22', '#2f7fb0', '#e2b230', '#ececec'], moto: true, sport: true },
  bus: { name: 'Bus Comtal', len: 12, wid: 2.55, h: 3.1, acc: 6, max: 24, grip: 6, mass: 4, hp: 2600, cols: ['#c23a2f'], van: true, bus: true },
  llanxa: { name: 'Llanxa Ràpida', len: 6.4, wid: 2.3, h: 1.6, acc: 13, max: 32, grip: 1.8, mass: 1.6, hp: 900, cols: ['#2b5fa8', '#d6372b', '#1c1c22', '#e2b230'], boat: true },
  gavina: { name: 'Gavina del Port', len: 14, wid: 4.2, h: 3.5, acc: 3.2, max: 10, grip: 1.2, mass: 6, hp: 3000, cols: ['#2a6b5c'], boat: true, gavina: true },
  scuter: { name: 'Scúter Gràcia', len: 1.9, wid: 0.75, h: 1.25, acc: 15, max: 38, grip: 9, mass: 0.45, hp: 420, cols: ['#c23a3a', '#3a8fc2', '#e8e3d6', '#2f2f2f', '#7fb069'], moto: true },
};
const vehicles = [];
const headMat = glowMat(0xfff2c0, null, 1.4); headMat.color.set(0xf4f0e0);
const tailMat = glowMat(0xff2a1a, null, 1.2); tailMat.color.set(0x8a1a12);
const glassMat = new THREE.MeshPhongMaterial({ color: 0x18222c, specular: 0xbbd4e8, shininess: 110, envMap: envCube, reflectivity: 0.45, combine: THREE.MixOperation });
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14); wheelGeo.rotateZ(Math.PI / 2);
const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 10); rimGeo.rotateZ(Math.PI / 2);
const paintCache = {};
function paintMat(col) { return paintCache[col] || (paintCache[col] = new THREE.MeshPhongMaterial({ color: col, specular: 0x666666, shininess: 70, envMap: envCube, reflectivity: 0.3, combine: THREE.MixOperation })); }
const chromeMat = new THREE.MeshPhongMaterial({ color: 0xc9ced2, specular: 0xffffff, shininess: 100, envMap: envCube, reflectivity: 0.65, combine: THREE.MixOperation });
const trimMat = lam('#1f2023'), plateMat = lam('#ecebe4');
function extrudeProfile(pts, width, bevel) {
  const sh = new THREE.Shape(); pts.forEach((pt, i) => i ? sh.lineTo(pt[0], pt[1]) : sh.moveTo(pt[0], pt[1]));
  const bt = bevel ? 0.07 : 0, depth = width - 2 * bt;
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: !!bevel, bevelThickness: bt, bevelSize: bevel ? 0.05 : 0, bevelSegments: 2, curveSegments: 1 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0); g.computeVertexNormals(); return g;
}
const motoWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10); motoWheelGeo.rotateZ(Math.PI / 2);
const wheelMat = lam('#1c1c1c');
const sirenR = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), sirenB = new THREE.MeshBasicMaterial({ color: 0x2a6bff }), sirenOff = new THREE.MeshBasicMaterial({ color: 0x333333 });
function makeVehicleMesh(t, col) {
  t.key = t.key || Object.keys(VT).find(k => VT[k] === t);
  const g = new THREE.Group(); const L = t.len, W = t.wid, H = t.h, wheels = [];
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  let siren = null;
  if (t.boat) { makeBoatMesh(t, col, g, add); return { g, wheels, siren }; }
  if (t.moto && t.sport) {
    const body = paintMat(col);
    add(bx(0.34, 0.3, 0.9), body, 0, 0.66, 0.05); add(bx(0.44, 0.4, 0.42), body, 0, 0.86, 0.6).rotation.x = -0.5;
    add(bx(0.3, 0.2, 0.04), glassMat, 0, 1.12, 0.72).rotation.x = -0.6; add(bx(0.28, 0.1, 0.55), lam('#1a1a1a'), 0, 0.88, -0.32);
    add(bx(0.26, 0.18, 0.35), body, 0, 0.92, -0.66); add(bx(0.1, 0.1, 0.6), chromeMat, 0.2, 0.45, -0.5); add(bx(0.06, 0.62, 0.06), chromeMat, 0, 0.62, 0.8).rotation.x = 0.35;
    add(bx(0.18, 0.1, 0.05), headMat, 0, 0.98, 0.84); add(bx(0.16, 0.06, 0.05), tailMat, 0, 0.92, -0.84);
    for (const z of [0.82, -0.78]) { const w = add(motoWheelGeo, wheelMat, 0, 0.34, z); w.scale.set(1, 1.15, 1.15); w.rotation.order = 'YXZ'; wheels.push(w); }
    const rider = makeHuman(Object.assign(randomLook(), { cap: null, hairStyle: 'short', jacket: '#1c1c22' })); { const hm = new THREE.Mesh(G.sph, paintMat(pR(['#e8e3d6', '#1e1e22', '#d6372b']))); hm.scale.set(0.17, 0.165, 0.18); hm.position.y = 1.79; rider.body.add(hm); } scene.remove(rider.g);
    rider.g.position.set(0, 0.2, -0.12); rider.body.rotation.x = 0.5; rider.legL.rotation.x = -1.6; rider.legR.rotation.x = -1.6; rider.kneeL.rotation.x = 1.9; rider.kneeR.rotation.x = 1.9; rider.armL.rotation.x = -1.5; rider.armR.rotation.x = -1.5; g.add(rider.g); rider.g.visible = false;
    g.userData.rider = rider.g;
  } else if (t.moto) {
    const body = paintMat(col);
    add(bx(0.42, 0.42, 1.2), body, 0, 0.62, -0.05); add(bx(0.38, 0.14, 0.6), lam('#222'), 0, 0.92, -0.25);
    add(bx(0.5, 0.7, 0.18), body, 0, 0.85, 0.62); add(bx(0.7, 0.06, 0.06), lam('#333'), 0, 1.25, 0.6);
    add(bx(0.12, 0.1, 0.05), headMat, 0, 1.0, 0.72); add(bx(0.18, 0.08, 0.05), tailMat, 0, 0.78, -0.66);
    for (const z of [0.68, -0.62]) { const w = add(motoWheelGeo, wheelMat, 0, 0.3, z); w.rotation.order = 'YXZ'; wheels.push(w); }
    const rider = makeHuman(Object.assign(randomLook(), { cap: null, hairStyle: 'short', helmet: true })); { const hm = new THREE.Mesh(G.sph, lam(pR(['#e8e3d6', '#1e1e22', '#d6372b']))); hm.scale.set(0.165, 0.16, 0.175); hm.position.y = 1.79; rider.body.add(hm); } scene.remove(rider.g);
    rider.g.position.set(0, 0.36, -0.2); rider.legL.rotation.x = -1.35; rider.legR.rotation.x = -1.35; rider.kneeL.rotation.x = 1.45; rider.kneeR.rotation.x = 1.45; rider.armL.rotation.x = -1.05; rider.armR.rotation.x = -1.05; rider.elbowL.rotation.x = -0.35; rider.elbowR.rotation.x = -0.35; g.add(rider.g); rider.g.visible = false;
    g.userData.rider = rider.g;
  } else {
    const paint = paintMat(col), b0 = 0.3, belt = t.van ? H * 0.5 : H * 0.62, ah = Math.min(0.42, belt - 0.46), zf = L * 0.32;
    const arch = zc => { const a = []; for (let k = 0; k <= 6; k++) { const th = k / 6 * Math.PI; a.push([zc + Math.cos(th) * 0.47, 0.34 + Math.sin(th) * ah]); } return a; };
    const bottom = [[L / 2 - 0.12, b0], ...arch(zf), ...arch(-zf), [-L / 2 + 0.12, b0]];
    let prof;
    if (t.bus) prof = [...bottom, [-L / 2, b0 + 0.12], [-L / 2, H - 0.12], [-L / 2 + 0.12, H], [L / 2 - 0.3, H], [L / 2 - 0.05, H - 0.45], [L / 2, b0 + 0.18]];
    else if (t.van) prof = [...bottom, [-L / 2, b0 + 0.12], [-L / 2, H - 0.05], [-L / 2 + 0.06, H], [L * 0.16, H], [L * 0.36, H * 0.56], [L / 2 - 0.05, H * 0.5], [L / 2, b0 + 0.18]];
    else prof = [...bottom, [-L / 2, b0 + 0.12], [-L / 2 + 0.04, belt - 0.12], [-L / 2 + 0.3, belt], [L / 2 - 0.42, belt - 0.05], [L / 2 - 0.06, belt - 0.2], [L / 2, b0 + 0.18]];
    const body = new THREE.Mesh(extrudeProfile(prof, W, true), paint); body.castShadow = true; g.add(body);
    if (!t.van) {
      const sport = t.key === 'delfi', cr = sport ? 0.2 : 0.3, cf = sport ? 0.06 : 0.17, ry = H, rb = -L * cr * (sport ? 0.4 : 0.55), rf = L * cf * 0.35;
      const gl = new THREE.Mesh(extrudeProfile([[-L * cr, belt - 0.03], [rb, ry - 0.04], [rf, ry - 0.04], [L * cf + (sport ? 0.25 : 0), belt - 0.03]], W * 0.86, false), glassMat); g.add(gl);
      const roof = new THREE.Mesh(extrudeProfile([[rb - 0.04, ry - 0.06], [rf + 0.04, ry - 0.06], [rf + 0.02, ry + 0.02], [rb - 0.02, ry + 0.02]], W * 0.87, false), paint); roof.castShadow = true; g.add(roof);
      for (const sx2 of [-1, 1]) add(bx(0.05, ry - belt - 0.05, 0.12), paint, sx2 * W * 0.43, (ry + belt) / 2, (rb + rf) / 2 + 0.05);
      if (t.taxi) for (const sx2 of [-1, 1]) add(bx(0.03, belt - b0 - 0.26, L * 0.42), paintMat('#f2c230'), sx2 * (W / 2 + 0.01), (belt + b0) / 2 + 0.04, -0.02);
      if (t.taxi) add(bx(0.5, 0.16, 0.22), lam('#38c24a', { emissive: 0x38c24a, emissiveIntensity: 0.6 }), 0, ry + 0.1, rf - 0.3);
      if (t.police) { for (const sx2 of [-1, 1]) add(bx(0.03, 0.22, L * 0.86), lam('#1d4f9c'), sx2 * (W / 2 + 0.01), belt - 0.22, 0);
        const r = add(bx(0.5, 0.15, 0.28), sirenR, -0.3, ry + 0.1, (rb + rf) / 2), b = add(bx(0.5, 0.15, 0.28), sirenB, 0.3, ry + 0.1, (rb + rf) / 2); siren = [r, b]; }
      for (const sx2 of [-1, 1]) add(bx(0.18, 0.1, 0.07), paint, sx2 * (W / 2 + 0.08), belt + 0.08, L * cf - 0.05);
      var lampY = belt - 0.18;
    } else if (t.bus) {
      for (const sx2 of [-1, 1]) add(bx(0.03, H * 0.3, L * 0.82), glassMat, sx2 * (W / 2 + 0.01), H * 0.66, -L * 0.04);
      add(bx(W * 0.9, H * 0.45, 0.06), glassMat, 0, H * 0.64, L / 2 + 0.01); add(bx(W * 0.86, H * 0.25, 0.06), glassMat, 0, H * 0.72, -L / 2 - 0.01);
      const dst = signTex('21 · PL. CATALUNYA', '#111111', '#ffb23a', 512, 64); add(bx(W * 0.72, 0.28, 0.05), new THREE.MeshLambertMaterial({ map: dst, emissive: 0xffffff, emissiveMap: dst, emissiveIntensity: 0.6 }), 0, H - 0.22, L / 2 + 0.03);
      for (const z of [L * 0.36, -L * 0.02]) add(bx(0.04, H * 0.62, 1.2), lam('#2b2f33'), -(W / 2 + 0.015), H * 0.42, z);
      add(bx(W + 0.02, 0.18, L * 0.96), paintMat('#f2f0ea'), 0, H * 0.46, 0);
      var lampY = 0.8;
    } else {
      add(bx(W * 0.9, 0.06, 0.95), glassMat, 0, H * 0.79, L * 0.265).rotation.x = -Math.atan2(L * 0.2, H * 0.44);
      for (const sx2 of [-1, 1]) add(bx(0.03, H * 0.24, L * 0.22), glassMat, sx2 * (W / 2 + 0.01), H * 0.74, L * 0.2);
      var lampY = H * 0.42;
    }
    g.userData.bumpers = [add(bx(W * 0.98, 0.2, 0.16), trimMat, 0, b0 + 0.12, L / 2 - 0.02), add(bx(W * 0.98, 0.2, 0.16), trimMat, 0, b0 + 0.12, -L / 2 + 0.02)];
    add(bx(W * 0.42, 0.12, 0.04), trimMat, 0, lampY, L / 2 + 0.01); add(bx(0.5, 0.11, 0.02), plateMat, 0, b0 + 0.3, -L / 2 - 0.01); add(bx(0.5, 0.11, 0.02), plateMat, 0, b0 + 0.3, L / 2 + 0.07);
    for (const x of [-W * 0.33, W * 0.33]) { add(bx(0.34, 0.13, 0.05), headMat, x, lampY, L / 2 - 0.02); add(bx(0.32, 0.15, 0.05), tailMat, x, lampY + 0.04, -L / 2 + 0.02); }
    for (const [x, z] of [[-W / 2 + 0.1, zf], [W / 2 - 0.1, zf], [-W / 2 + 0.1, -zf], [W / 2 - 0.1, -zf]]) {
      const w = new THREE.Group(); w.position.set(x, t.bus ? 0.52 : 0.36, z); w.rotation.order = 'YXZ'; if (t.bus) w.scale.set(1, 1.45, 1.45);
      const tire = new THREE.Mesh(wheelGeo, wheelMat); tire.castShadow = true; w.add(tire);
      const rim = new THREE.Mesh(rimGeo, chromeMat); rim.position.x = x > 0 ? 0.02 : -0.02; w.add(rim);
      g.add(w); wheels.push(w);
    }
    g.userData.paint = paint;
  }
  return { g, wheels, siren };
}
class Vehicle {
  constructor(key, x, z, heading, col) {
    this.key = key; this.t = VT[key];
    const chosen = col || pR(this.t.cols); const m = makeVehicleMesh(this.t, chosen); this.mesh = m.g; this.wheels = m.wheels; this.siren = m.siren; this.color = chosen;
    this.mesh.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3(x, groundH(x, z), z); this.ty = groundH(x, z); this.curb = 0; this.yv = 0; this.air = false;
    this.heading = heading; this.vx = 0; this.vz = 0; this.steer = 0; this.health = this.t.hp;
    this.driver = null; this.ai = null; this.inT = 0; this.inS = 0; this.inHB = false;
    this.burn = -1; this.dead = false; this.stuck = 0; this.rev = 0; this.sink = 0; this.smokeT = 0; this.mission = false; this.honkT = 0;
    scene.add(this.mesh); vehicles.push(this); this.sync();
  }
  get speed() { return this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading); }
  damage(a, src) {
    if (this.dead) return;
    this.health -= a;
    if (src === 'player' && this.t.police) crime('hitcop', this.pos.x, this.pos.z);
    if (src === 'player' && !this.driver && !this.dead && !this.t.moto) this.alarmT = 10;
    if (!this.t.moto) shedParts(this);
    if (this.health <= 0 && this.burn < 0) { this.burn = this.t.moto ? 1.5 : 4.5; if (this.driver === 'ai' || this.driver === 'cop') { const d = this.driver; this.driver = null; this.ai = null; ejectDriver(this, d === 'cop'); } }
  }
  physics(dt) {
    if (this.t.boat) return boatPhysics(this, dt);
    const t = this.t;
    let s = Math.sin(this.heading), c = Math.cos(this.heading);
    let fwd = this.vx * s + this.vz * c, lat = -this.vx * c + this.vz * s;
    const wet = this.ty < WATER_Y - 0.5;
    if (this.dead || wet) { this.inT = 0; this.inS = 0; }
    if (!this.air) {
      const T = this.inT;
      if (T > 0) { if (fwd < -0.5) fwd += 30 * T * dt; else if (fwd < t.max) fwd += t.acc * T * (1 - 0.55 * fwd / t.max) * dt; }
      else if (T < 0) { if (fwd > 0.5) fwd += 28 * T * dt; else if (fwd > -t.max * 0.3) fwd += t.acc * 0.6 * T * dt; }
      else fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 2.5 * dt);
      fwd -= fwd * 0.05 * dt;
      if (this.inHB) fwd -= Math.sign(fwd) * Math.min(Math.abs(fwd), 9 * dt);
      this.steer = lerp(this.steer, this.inS, Math.min(1, dt * (this.driver === 'player' ? 7 : 5)));
      const sp = Math.abs(fwd);
      const yaw = -this.steer * 2.1 * clamp(fwd / 7, -1, 1) * (1 - 0.5 * clamp(sp / t.max, 0, 1)) * (this.inHB ? 1.5 : 1) * (t.moto ? 1.15 : 1);
      this.heading = wrapA(this.heading + yaw * dt);
      lat *= Math.exp(-(this.inHB ? 1.3 : t.grip) * dt);
      s = Math.sin(this.heading); c = Math.cos(this.heading);
      this.vx = s * fwd - c * lat; this.vz = c * fwd + s * lat;
    }
    if (wet) { this.vx *= Math.exp(-2.5 * dt); this.vz *= Math.exp(-2.5 * dt); }
    this.pos.x += this.vx * dt; this.pos.z += this.vz * dt;
    // world collisions: two circles along the body
    const off = t.len * (t.len > 8 ? 0.38 : 0.3), rad = t.moto ? 0.5 : t.wid * 0.56;
    for (const k of (t.len > 8 ? [1, 0, -1] : [1, -1])) {
      const hit = collideWorld(this.pos.x + s * off * k, this.pos.z + c * off * k, rad, this.pos.y + 0.4);
      if (!hit) continue;
      this.pos.x += hit[0]; this.pos.z += hit[1];
      const l = Math.hypot(hit[0], hit[1]) || 1, nx = hit[0] / l, nz = hit[1] / l, vn = this.vx * nx + this.vz * nz;
      if (vn < 0) {
        this.vx -= 1.35 * vn * nx; this.vz -= 1.35 * vn * nz;
        this.vx *= 0.92; this.vz *= 0.92;
        const imp = -vn;
        if (imp > 4) { this.damage(Math.min(imp * imp * 0.8, this.t.hp * 0.4)); if (this.driver === 'player') { cam.shake = Math.min(1, imp / 25); sfx.crash(Math.min(1, imp / 20)); } }
      }
    }
    propCollideVehicle(this);
    // vertical
    const gT = groundH(this.pos.x, this.pos.z), curb = onSidewalk(this.pos.x, this.pos.z) ? CURB : 0;
    if (this.air || this.ty + this.yv * dt > gT + 0.3) {
      this.air = true; this.yv -= 24 * dt; this.ty += this.yv * dt;
      if (this.ty <= gT) { if (this.yv < -14) this.damage((-this.yv - 14) * 25); this.ty = gT; this.yv = 0; this.air = false; }
    } else {
      this.yv = clamp((gT - this.ty) / Math.max(dt, 1e-3), -40, 25); this.ty = gT;
    }
    this.curb = lerp(this.curb, curb, Math.min(1, dt * 14));
    this.pos.y = this.ty + this.curb;
    if (wet) { this.sink += dt; this.pos.y = Math.max(this.ty, WATER_Y - Math.min(this.sink * 0.6, 2.5)); }
    // wheels
    const fw = this.vx * Math.sin(this.heading) + this.vz * Math.cos(this.heading);
    for (let i = 0; i < this.wheels.length; i++) { const w = this.wheels[i]; w.rotation.x += fw * dt / 0.34; if (i < (this.t.moto ? 1 : 2)) w.rotation.y = -this.steer * 0.45; }
    // fire & smoke
    if (this.burn >= 0) {
      this.burn -= dt; if (R() < dt * 30) fx.spawn('fire', this.pos.x + rR(-0.6, 0.6), this.pos.y + 1, this.pos.z + rR(-0.6, 0.6));
      if (this.burn < 0) explode(this);
    } else if (!this.dead && this.health < this.t.hp * 0.35) { this.smokeT -= dt; if (this.smokeT < 0) { this.smokeT = 0.12; fx.spawn('smoke', this.pos.x + s * t.len * 0.4, this.pos.y + 1, this.pos.z + c * t.len * 0.4); } }
    this.sync();
  }
  sync() {
    const t = this.t, s = Math.sin(this.heading), c = Math.cos(this.heading);
    let pitch = 0;
    if (t.boat) pitch = -clamp(this.speed / t.max, -0.3, 1) * (t.gavina ? 0.03 : 0.13) + Math.sin(now * 0.0017 + (this.bob || 0)) * 0.025;
    else if (!this.air) { const hf = groundH(this.pos.x + s * t.len * 0.4, this.pos.z + c * t.len * 0.4), hb = groundH(this.pos.x - s * t.len * 0.4, this.pos.z - c * t.len * 0.4); pitch = Math.atan2(hb - hf, t.len * 0.8); }
    else pitch = clamp(-this.yv * 0.02, -0.4, 0.4);
    const lat = -this.vx * c + this.vz * s;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(pitch, this.heading, clamp(lat * 0.012 + (t.moto ? this.steer * 0.35 : 0), -0.4, 0.4));
    if (this.siren) {
      const on = this.ai && this.ai.mode === 'cop' && !this.dead, ph = (now * 0.008) % 2 < 1;
      this.siren[0].material = on ? (ph ? sirenR : sirenOff) : sirenOff; this.siren[1].material = on ? (ph ? sirenOff : sirenB) : sirenOff;
    }
    if (this.mesh.userData.rider) this.mesh.userData.rider.visible = !!this.driver;
  }
  remove() {
    scene.remove(this.mesh); const i = vehicles.indexOf(this); if (i >= 0) vehicles.splice(i, 1);
    if (player.car === this) { player.car = null; }
  }
}
function blacken(v) { v.mesh.traverse(m => { if (m.isMesh && m.material !== glassMat) m.material = lam('#1d1b1a'); }); }
function explode(v) {
  v.dead = true; v.burn = -1; v.health = 0; v.driver = v.driver === 'player' ? 'player' : null; v.ai = null; blacken(v);
  v.yv = 6; v.air = true;
  for (let i = 0; i < 26; i++) fx.spawn('boom', v.pos.x + rR(-1.5, 1.5), v.pos.y + rR(0.5, 2.5), v.pos.z + rR(-1.5, 1.5));
  sfx.boom(clamp(1 - Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) / 160, 0.1, 1));
  cam.shake = Math.max(cam.shake, clamp(1 - Math.hypot(v.pos.x - camera.position.x, v.pos.z - camera.position.z) / 60, 0, 1));
  if (player.car === v) { killPlayer(); }
  else { const d = Math.hypot(player.pos.x - v.pos.x, player.pos.z - v.pos.z); if (d < 9 && !player.car) hurtPlayer(70 * (1 - d / 9), v.pos.x, v.pos.z); }
  for (const pr of propsNear(v.pos.x, v.pos.z, 9)) { const d = Math.hypot(pr.x - v.pos.x, pr.z - v.pos.z) || 1; if (!pr.broken && d < 9) breakProp(pr, (pr.x - v.pos.x) / d * 12, (pr.z - v.pos.z) / d * 12, false, 'boom'); }
  scareBirds(v.pos.x, v.pos.z, 60);
  for (const p of peds) { const d = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z); if (d < 9) knockPed(p, (p.pos.x - v.pos.x) / d * 9, (p.pos.z - v.pos.z) / d * 9, 80, false); }
  for (const o of vehicles) if (o !== v && !o.dead) { const d = Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z); if (d < 9) o.damage(500 * (1 - d / 9)); }
  v.wreckT = 40;
}

// ====================== FX (particles) ======================
const fx = (() => {
  const tex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
  const pool = [];
  for (let i = 0; i < 340; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); pool.push({ s, life: 0 }); }
  let idx = 0;
  const kinds = {
    smoke: { col: 0x555555, life: 1.6, s0: 0.8, s1: 3.2, vy: 2.2, add: false, op: 0.55 },
    fire: { col: 0xff7a1a, life: 0.6, s0: 1.2, s1: 0.4, vy: 3, add: true, op: 0.9 },
    boom: { col: 0xffa030, life: 0.9, s0: 2, s1: 7, vy: 3, add: true, op: 1, spread: 6 },
    spark: { col: 0xfff2a0, life: 0.18, s0: 0.5, s1: 0.1, vy: 0, add: true, op: 1, spread: 3 },
    dust: { col: 0xbfb5a0, life: 0.7, s0: 0.5, s1: 1.8, vy: 0.6, add: false, op: 0.5, spread: 1 },
    splash: { col: 0xd8f0ff, life: 0.7, s0: 0.8, s1: 2.4, vy: 4, add: false, op: 0.8, spread: 2 },
    money: { col: 0x86d98f, life: 0.8, s0: 0.6, s1: 0.1, vy: 3, add: true, op: 1, spread: 2 },
    trash: { col: 0xd8d2c0, life: 1.4, s0: 0.35, s1: 0.3, vy: 4, add: false, op: 0.9, spread: 3, g: 9 },
    water: { col: 0xcfe8f5, life: 1.3, s0: 0.5, s1: 1.6, vy: 12, add: false, op: 0.75, spread: 1.1, g: 14 },
    tyre: { col: 0xd9d9d6, life: 1.5, s0: 0.7, s1: 2.8, vy: 0.7, add: false, op: 0.35, spread: 0.8 },
    hit: { col: 0xfff0c0, life: 0.15, s0: 0.5, s1: 0.1, vy: 0, add: true, op: 1, spread: 2 },
    trail: { col: 0xffd890, life: 0.5, s0: 2.2, s1: 0.3, vy: -1, add: true, op: 0.9, spread: 0.3 },
    firework: { col: 0xffffff, life: 2.2, s0: 5.5, s1: 1.8, vy: 0, add: true, op: 1, spread: 0, g: 4, drag: 1.1 },
  };
  return {
    spawn(kind, x, y, z, o) {
      const k = kinds[kind], p = pool[idx]; idx = (idx + 1) % pool.length;
      p.k = k; p.life = k.life * (o ? 1 : rR(0.85, 1.15)); p.s.visible = true; p.s.position.set(x, y, z);
      p.s.material.color.setHex(o && o.col !== undefined ? o.col : k.col); p.s.material.blending = k.add ? THREE.AdditiveBlending : THREE.NormalBlending; const fog = !(kind === 'firework' || kind === 'trail'); if (p.s.material.fog !== fog) { p.s.material.fog = fog; p.s.material.needsUpdate = true; }
      const sp = k.spread || 0.5; p.vx = o && o.vx !== undefined ? o.vx : rR(-sp, sp); p.vy = o && o.vy !== undefined ? o.vy : k.vy + rR(-0.5, 0.5); p.vz = o && o.vz !== undefined ? o.vz : rR(-sp, sp);
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
        if (p.k.g) p.vy -= p.k.g * dt; if (p.k.drag) { const f = Math.exp(-p.k.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
        const t = 1 - p.life / p.k.life; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        const sc = lerp(p.k.s0, p.k.s1, t); p.s.scale.set(sc, sc, sc); p.s.material.opacity = p.k.op * (1 - t);
      }
    },
  };
})();
const tracers = [];
function tracer(ax, ay, az, bx2, by, bz, col = 0xfff2a0) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx2, by, bz)]);
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true })); scene.add(l); tracers.push({ l, t: 0.08 });
}

// ====================== AUDIO ======================
const AU = { ctx: null, muted: false };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const c = AU.ctx;
  AU.master = c.createGain(); AU.master.gain.value = AU.muted ? 0 : 0.7; AU.master.connect(c.destination);
  AU.sfx = c.createGain(); AU.sfx.connect(AU.master);
  AU.music = c.createGain(); AU.music.gain.value = 0; AU.music.connect(AU.master);
  AU.busk = c.createGain(); AU.busk.gain.value = 0; AU.busk.connect(AU.master);
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
  { const sc = c.createBufferSource(); sc.buffer = nb; sc.loop = true; const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1900; sf.Q.value = 7; AU.screechG = c.createGain(); AU.screechG.gain.value = 0; sc.connect(sf); sf.connect(AU.screechG); AU.screechG.connect(AU.sfx); sc.start();
    const ho = c.createOscillator(); ho.type = 'sawtooth'; ho.frequency.value = 17; const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 190; AU.heliG = c.createGain(); AU.heliG.gain.value = 0; ho.connect(hf); hf.connect(AU.heliG); AU.heliG.connect(AU.sfx); ho.start(); }
  AU.eng = c.createOscillator(); AU.eng.type = 'sawtooth'; AU.eng2 = c.createOscillator(); AU.eng2.type = 'square';
  AU.engF = c.createBiquadFilter(); AU.engF.type = 'lowpass'; AU.engF.frequency.value = 520;
  AU.engG = c.createGain(); AU.engG.gain.value = 0;
  AU.eng.connect(AU.engF); AU.eng2.connect(AU.engF); AU.engF.connect(AU.engG); AU.engG.connect(AU.sfx); AU.eng.start(); AU.eng2.start();
  AU.sir = c.createOscillator(); AU.sir.type = 'triangle'; AU.sir.frequency.value = 880;
  AU.lfo = c.createOscillator(); AU.lfo.frequency.value = 0.55; const lg = c.createGain(); lg.gain.value = 320; AU.lfo.connect(lg); lg.connect(AU.sir.frequency);
  AU.sirG = c.createGain(); AU.sirG.gain.value = 0; AU.sir.connect(AU.sirG); AU.sirG.connect(AU.sfx); AU.sir.start(); AU.lfo.start();
  const amb = c.createBufferSource(); amb.buffer = nb; amb.loop = true; const af = c.createBiquadFilter(); af.type = 'lowpass'; af.frequency.value = 380;
  AU.ambG = c.createGain(); AU.ambG.gain.value = 0.05; amb.connect(af); af.connect(AU.ambG); AU.ambG.connect(AU.sfx); amb.start();
}
function noiseHit(t, dur, freq, q, vol, type = 'bandpass', dest) {
  const c = AU.ctx; if (!c || !(vol > 0.0005)) return;
  const s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function tone(t, freq, dur, type, vol, dest, slideTo, filt) {
  const c = AU.ctx; if (!c || !(vol > 0.0005)) return;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last = o;
  if (filt) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filt, t); f.frequency.exponentialRampToValueAtTime(Math.max(200, filt * 0.25), t + dur); o.connect(f); last = f; }
  last.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  shot() { if (!AU.ctx) return; const t = AU.ctx.currentTime; noiseHit(t, 0.18, 1800, 0.7, 0.6, 'lowpass'); tone(t, 160, 0.12, 'square', 0.25, null, 50); },
  punch() { if (!AU.ctx) return; noiseHit(AU.ctx.currentTime, 0.09, 700, 1, 0.5, 'lowpass'); },
  crash(k) { if (!AU.ctx) return; const t = AU.ctx.currentTime; noiseHit(t, 0.35, 600, 0.8, 0.7 * k, 'lowpass'); tone(t, 90, 0.2, 'triangle', 0.3 * k, null, 40); },
  boom(k) { if (!AU.ctx) return; const t = AU.ctx.currentTime; noiseHit(t, 1.4, 260, 0.6, 0.9 * k, 'lowpass'); tone(t, 70, 0.9, 'sine', 0.6 * k, null, 25); },
  pick() { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(t, 988, 0.12, 'square', 0.12); tone(t + 0.08, 1480, 0.18, 'square', 0.12); },
  horn() { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(t, 392, 0.45, 'square', 0.12, null, null, 2200); tone(t, 494, 0.45, 'square', 0.1, null, null, 2200); },
  splash() { if (!AU.ctx) return; noiseHit(AU.ctx.currentTime, 0.6, 1200, 0.5, 0.5); },
  pass() { if (!AU.ctx) return; const t = AU.ctx.currentTime; [57, 61, 64, 69, 73].forEach((m, i) => tone(t + i * 0.11, mtof(m), 0.5, 'sawtooth', 0.12, null, null, 3000)); },
  fail() { if (!AU.ctx) return; const t = AU.ctx.currentTime; [64, 63, 62, 58].forEach((m, i) => tone(t + i * 0.18, mtof(m), 0.5, 'triangle', 0.18)); },
  click() { if (!AU.ctx) return; tone(AU.ctx.currentTime, 1200, 0.04, 'square', 0.06); },
  clang(k) { if (!AU.ctx) return; const t = AU.ctx.currentTime; tone(t, rR(380, 520), 0.5, 'triangle', 0.12 * k); tone(t, rR(900, 1300), 0.25, 'square', 0.04 * k, null, null, 3000); noiseHit(t, 0.08, 2500, 1, 0.2 * k); },
  thud(k) { if (!AU.ctx) return; const t = AU.ctx.currentTime; noiseHit(t, 0.25, 400, 0.8, 0.6 * k, 'lowpass'); tone(t, 110, 0.2, 'sine', 0.3 * k, null, 50); },
  glass() { if (!AU.ctx) return; const t = AU.ctx.currentTime; for (let i = 0; i < 6; i++) tone(t + i * 0.03, rR(2500, 5000), 0.12, 'sine', 0.03); noiseHit(t, 0.2, 6000, 1, 0.15, 'highpass'); },
  whoosh() { if (!AU.ctx) return; noiseHit(AU.ctx.currentTime, 0.18, 900, 0.6, 0.12); },
};

// ---------- radio ----------
const STATIONS = [
  { name: 'Ràdio Rumba 97.3', kind: 'rumba', bpm: 112 },
  { name: 'Ona Electrònica 104.5', kind: 'electro', bpm: 124 },
  { name: 'Ràdio apagada', kind: 'off' },
];
const radio = { st: 0, step: 0, next: 0, mel: [] };
(function buildMelody() { const sc = [69, 70, 73, 74, 76, 77, 79, 81]; let s2 = 7; const r2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; }; for (let i = 0; i < 64; i++) radio.mel.push([0, 3, 6, 8, 10, 13].includes(i % 16) && r2() < 0.7 ? sc[Math.floor(r2() * sc.length)] : 0); })();
function pluck(t, m, vol) { tone(t, mtof(m), 0.38, 'sawtooth', vol, AU.music, null, 2600); }
function radioStep(st, step, t) {
  const bar = Math.floor(step / 16) % 4, i = step % 16;
  if (st.kind === 'rumba') {
    const ch = [[57, 60, 64, 69], [55, 59, 62, 67], [53, 57, 60, 65], [52, 56, 59, 64]][bar], root = [45, 43, 41, 40][bar];
    if ([0, 3, 6, 8, 11, 14].includes(i)) { const down = [0, 6, 8, 14].includes(i); ch.forEach((m, k) => pluck(t + (down ? k : 3 - k) * 0.012, m, down ? 0.06 : 0.035)); }
    if ([4, 12].includes(i)) noiseHit(t, 0.06, 2400, 1.2, 0.22, 'bandpass', AU.music);
    if ([2, 6, 10, 14].includes(i)) noiseHit(t, 0.03, 3500, 1.5, 0.08, 'bandpass', AU.music);
    if ([0, 6, 8, 14].includes(i)) tone(t, mtof(root), 0.3, 'triangle', 0.2, AU.music);
    const mel = radio.mel[step % 64]; if (mel && bar % 2 === 1) tone(t, mtof(mel), 0.26, 'triangle', 0.09, AU.music, null, 4000);
  } else if (st.kind === 'electro') {
    const ch = [[53, 56, 60], [49, 53, 56], [56, 60, 63], [51, 55, 58]][bar];
    if (i % 4 === 0) tone(t, 150, 0.28, 'sine', 0.5, AU.music, 42);
    if (i % 4 === 2) noiseHit(t, 0.05, 8000, 0.8, 0.12, 'highpass', AU.music);
    if (i === 4 || i === 12) noiseHit(t, 0.12, 1500, 0.8, 0.2, 'bandpass', AU.music);
    if ([0, 3, 6, 8, 11, 14].includes(i)) tone(t, mtof(ch[0] - 12), 0.18, 'sawtooth', 0.12, AU.music, null, 900);
    tone(t, mtof(ch[i % 3] + 12), 0.12, 'square', 0.025, AU.music, null, 3000);
  }
}
function radioTick() {
  const c = AU.ctx; if (!c) return;
  const st = STATIONS[radio.st], want = !!player.car && st.kind !== 'off' && game.state === 'play';
  AU.music.gain.setTargetAtTime(want ? 0.55 : 0, c.currentTime, 0.15);
  if (!want) { radio.next = 0; return; }
  const spb = 60 / st.bpm / 4;
  if (radio.next < c.currentTime) radio.next = c.currentTime + 0.05;
  while (radio.next < c.currentTime + 0.25) { radioStep(st, radio.step, radio.next); radio.step = (radio.step + 1) % 64; radio.next += spb; }
}

// ====================== STATE ======================
const game = { state: 'title', heat: 0, time: 10 * 60, panots: [], mission: 0, bigT: 0, toastT: 0 };
let now = 0;
const peds = [];
const pickups = [];
const player = {
  pos: new THREE.Vector3(-150, CURB, 186), heading: Math.PI, vy: 0, grounded: true, health: 100, money: 0, shownMoney: 0,
  weapon: 0, ammo: 0, hasPistol: false, car: null, human: null, anim: 0, dead: false, punchT: 0, fireT: 0, swim: false, bustT: 0, knock: 0, kvx: 0, kvz: 0,
};
const wantedLevel = () => Math.min(5, Math.floor(game.heat));

// ====================== SAVE ======================
const SAVE_KEY = 'ciutat-comtal-save-v1';
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && typeof s === 'object' ? s : null; } catch (e) { return null; } }
function saveObj() { return { mission: game.mission, money: player.money, panots: game.panots.slice(), hasPistol: player.hasPistol, hasBat: player.hasBat, ammo: player.ammo, time: game.time, stats: game.stats, armor: player.armor, outfit: player.outfit, pos: (() => { const q = player.car ? player.car.pos : player.pos; return [Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10, player.heading]; })() }; }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj())); } catch (e) { /* storage unavailable */ } }

// ====================== INPUT ======================
const keys = {};
const touch = { ax: 0, ay: 0, fire: false, jump: false };
const cam = { yaw: Math.PI, pitch: 0.3, lastMouse: -10, shake: 0, dist: 0 };
let mouseDown = false, pointerLocked = false;
addEventListener('keydown', e => {
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
  onKey(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function onKey(code) {
  auInit();
  if (game.state === 'map') { if (code === 'KeyM' || code === 'Escape') closeMap(); return; }
  if (game.state === 'pause') { if (code === 'KeyP' || code === 'Escape') resume(); return; }
  if (game.state !== 'play') return;
  if (code === 'KeyF' || code === 'Enter' || code === 'KeyE') enterExit();
  else if (code === 'KeyR' && player.car) { radio.st = (radio.st + 1) % STATIONS.length; flash('radiolab', STATIONS[radio.st].name, 2500); sfx.click(); }
  else if (code === 'KeyM') openMap();
  else if (code === 'KeyP' || code === 'Escape') pause();
  else if (code === 'KeyQ' || code === 'Tab') switchWeapon();
  else if (code === 'KeyH' && player.car) { sfx.horn(); scarePeds(player.car.pos.x, player.car.pos.z, 14); }
  else if (code === 'KeyC') cam.dist = (cam.dist + 1) % 3;
  else if (code === 'KeyN') toggleMute();
  else if (code === 'KeyI') toggleControls();
  else if (code === 'KeyT') toggleVehicleJob();
  else if (code === 'F3' || code === 'Backquote') togglePerf();
  else if (/^Digit[1-9]$/.test(code)) buyItem(+code.slice(5) - 1);
}
const cv = renderer.domElement;
cv.addEventListener('mousedown', e => {
  auInit();
  if (game.state !== 'play') return;
  if (!pointerLocked && !coarse) { try { const r = cv.requestPointerLock && cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed */ } }
  mouseDown = true; if (e.button === 0 && pointerLocked) attack();
});
addEventListener('mouseup', () => { mouseDown = false; });
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === cv; });
addEventListener('mousemove', e => {
  if (game.state !== 'play') return;
  if (pointerLocked || (mouseDown && !coarse)) { cam.yaw -= e.movementX * 0.0026; cam.pitch = clamp(cam.pitch + e.movementY * 0.0022, -0.25, 1.25); cam.lastMouse = now; }
});
cv.addEventListener('contextmenu', e => e.preventDefault());
// touch: stick + look drag + buttons
(function setupTouch() {
  if (!coarse) return;
  $('touch').hidden = false;
  const stick = $('stick'), knob = stick.querySelector('i'); let sid = null, lid = null, lx = 0, ly = 0;
  stick.addEventListener('touchstart', e => { const t = e.changedTouches[0]; sid = t.identifier; e.preventDefault(); auInit(); }, { passive: false });
  const moveStick = t => { const r = stick.getBoundingClientRect(); let x = (t.clientX - r.left - r.width / 2) / (r.width / 2), y = (t.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } touch.ax = x; touch.ay = y; knob.style.transform = `translate(${x * 35}px,${y * 35}px)`; };
  addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === sid) moveStick(t); else if (t.identifier === lid) { cam.yaw -= (t.clientX - lx) * 0.006; cam.pitch = clamp(cam.pitch + (t.clientY - ly) * 0.004, -0.25, 1.25); lx = t.clientX; ly = t.clientY; cam.lastMouse = now; } } }, { passive: true });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; touch.ax = touch.ay = 0; knob.style.transform = ''; } if (t.identifier === lid) lid = null; } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  cv.addEventListener('touchstart', e => { const t = e.changedTouches[0]; if (lid === null) { lid = t.identifier; lx = t.clientX; ly = t.clientY; } auInit(); }, { passive: true });
  const btn = (id, down, up) => { const b = $(id); b.addEventListener('touchstart', e => { e.preventDefault(); auInit(); down(); }, { passive: false }); if (up) b.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false }); };
  btn('t-fire', () => { touch.fire = true; }, () => { touch.fire = false; });
  btn('t-jump', () => { touch.jump = true; }, () => { touch.jump = false; });
  btn('t-enter', () => onKey('KeyF'));
  btn('t-map', () => { if (game.state === 'map') closeMap(); else onKey('KeyM'); });
})();
const axisX = () => clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.ax, -1, 1);
const axisY = () => clamp((keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - touch.ay, -1, 1);
const firing = () => (pointerLocked && mouseDown) || keys.ControlLeft || keys.ControlRight || keys.KeyJ || touch.fire;

// ====================== HUD HELPERS ======================
const flashT = {};
function flash(id, text, ms) { const el = $(id); el.textContent = text; el.classList.add('on'); clearTimeout(flashT[id]); flashT[id] = setTimeout(() => el.classList.remove('on'), ms); }
function bigMsg(title, sub, bad, ms = 3500) { const el = $('bigmsg'); el.querySelector('b').textContent = title; el.querySelector('b').className = 'ol' + (bad ? ' bad' : ''); el.querySelector('small').textContent = sub || ''; el.classList.add('on'); clearTimeout(flashT.big); flashT.big = setTimeout(() => el.classList.remove('on'), ms); }
function toast(html, ms = 4500) { const el = $('toast'); el.innerHTML = html; el.classList.add('on'); clearTimeout(flashT.toast); flashT.toast = setTimeout(() => el.classList.remove('on'), ms); }
const subQ = []; let subT = 0;
function say(lines) { for (const l of lines) subQ.push(l); }
function setObjective(t) { $('objective').textContent = t || ''; }
function drawWeaponIcon() {
  const g = $('wicon').getContext('2d'); g.clearRect(0, 0, 128, 128); g.fillStyle = '#f4efe4'; g.strokeStyle = '#000'; g.lineWidth = 4;
  if (player.weapon === 1) {
    g.beginPath(); g.moveTo(24, 46); g.lineTo(104, 46); g.lineTo(104, 62); g.lineTo(62, 62); g.lineTo(58, 70); g.lineTo(52, 70); g.lineTo(48, 92); g.lineTo(28, 92); g.lineTo(36, 62); g.lineTo(24, 62); g.closePath(); g.fill(); g.stroke();
    $('ammo').textContent = player.ammo;
  } else if (player.weapon === 2) {
    g.save(); g.translate(64, 64); g.rotate(-0.8); g.beginPath(); g.moveTo(-50, -5); g.lineTo(30, -12); g.quadraticCurveTo(48, 0, 30, 12); g.lineTo(-50, 5); g.closePath(); g.fillStyle = '#d9b07a'; g.fill(); g.stroke(); g.fillStyle = '#222'; g.fillRect(-50, -6, 16, 12); g.restore();
    $('ammo').textContent = '';
  } else {
    g.beginPath(); g.roundRect ? g.roundRect(34, 40, 60, 50, 12) : g.rect(34, 40, 60, 50); g.fill(); g.stroke();
    g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(49 + k * 15, 42); g.lineTo(49 + k * 15, 62); } g.moveTo(34, 64); g.lineTo(80, 64); g.stroke();
    $('ammo').textContent = '';
  }
}

// ====================== PICKUPS ======================
const pickupGeo = { money: new THREE.BoxGeometry(0.7, 0.35, 0.4), health: new THREE.BoxGeometry(0.8, 0.8, 0.25), pistol: new THREE.BoxGeometry(0.9, 0.3, 0.2), panot: new THREE.BoxGeometry(1.1, 0.12, 1.1), bag: new THREE.BoxGeometry(0.8, 0.6, 0.4), bat: new THREE.BoxGeometry(0.12, 0.12, 0.95) };
const panotMat = new THREE.MeshLambertMaterial({ map: panotTex, emissive: 0x332a10 });
function addPickup(type, x, z, opts) {
  opts = opts || {};
  const mat = type === 'money' ? lam('#3f9a4a', { emissive: 0x1c4a20 }) : type === 'health' ? lam('#e8e3d6', { emissive: 0x5a1010 }) : type === 'pistol' ? lam('#2b2b30', { emissive: 0x202030 }) : type === 'bat' ? lam('#c99a62', { emissive: 0x3a2a10 }) : type === 'panot' ? panotMat : lam('#b07a3a', { emissive: 0x3a2008 });
  const m = new THREE.Mesh(pickupGeo[type], mat); const y = opts.y !== undefined ? opts.y : surfH(x, z) + 0.9; m.position.set(x, y, z); m.castShadow = true; scene.add(m);
  if (type === 'health') { const c = new THREE.Mesh(bx(0.5, 0.14, 0.27), lam('#d9412f')); const c2 = new THREE.Mesh(bx(0.14, 0.5, 0.27), lam('#d9412f')); m.add(c); m.add(c2); }
  const p = Object.assign({ type, m, x, z, y, alive: true, respawn: 0 }, opts); pickups.push(p); return p;
}
function removePickup(p) { scene.remove(p.m); p.alive = false; const i = pickups.indexOf(p); if (i >= 0) pickups.splice(i, 1); }
function updatePickups(dt) {
  const px = player.car ? player.car.pos.x : player.pos.x, pz = player.car ? player.car.pos.z : player.pos.z, rad = player.car ? 3 : 1.6;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) p.m.visible = true; continue; }
    p.m.rotation.y += dt * 2; p.m.position.y = p.y + Math.sin(now * 0.004 + i) * 0.15;
    if (p.ttl !== undefined) { p.ttl -= dt; if (p.ttl <= 0) { removePickup(p); continue; } }
    if (Math.abs(px - p.x) > 4 || Math.abs(pz - p.z) > 4) continue;
    if (d2(px, pz, p.x, p.z) > rad * rad || Math.abs(player.pos.y - p.y) > 4 && !player.car) continue;
    if (p.type === 'health' && player.health >= 100) continue;
    collect(p);
  }
}
function collect(p) {
  sfx.pick();
  if (p.type === 'money') { player.money += p.amount; fx.spawn('money', p.x, p.y, p.z); removePickup(p); }
  else if (p.type === 'health') { player.health = 100; p.respawn = 60; p.m.visible = false; toast('Health restored.'); }
  else if (p.type === 'pistol') { player.hasPistol = true; player.ammo += 40; player.weapon = 1; drawWeaponIcon(); toast('<b>Pistol</b> picked up. Q switches weapon; click or Ctrl shoots.'); p.respawn = 120; p.m.visible = false; }
  else if (p.type === 'bat') { player.hasBat = true; player.weapon = 2; drawWeaponIcon(); toast('<b>Baseball bat.</b> It breaks lamp posts, benches and hydrants. Q switches weapon.'); p.respawn = 120; p.m.visible = false; }
  else if (p.type === 'panot') {
    game.panots.push(p.id); removePickup(p); const n = game.panots.length;
    player.money += 100; bigMsg('PANOT ' + n + '/20', n === 20 ? 'Every panot found · €5000 bonus' : 'Flower of Barcelona · €100', false, 2500);
    if (n === 20) player.money += 5000; writeSave();
  } else if (p.type === 'bag') { p.onPick && p.onPick(); removePickup(p); }
}
const PANOT_SPOTS = [[-175, 150], [-160, 333], [-124, 350], [-55, 304], [-145, 421], [300, 425], [480, 372], [585, 370], [480, 30], [240, -282], [320, -522], [-100, -745], [20, -1000], [-830, 380], [-700, 262], [-820, -130], [-640, -540], [160, 104], [700, 290], [-900, -500]];

// ====================== PEDESTRIANS ======================
const _lp = [0, 0, 0];
function spawnPed(nearOnly) {
  const px = player.pos.x, pz = player.pos.z;
  const rad = R() < 0.7 ? 95 : 170, ls = loopHash.query(px - rad, pz - rad, px + rad, pz + rad, []);
  if (!ls.length) return null;
  for (let tries = 0; tries < 8; tries++) {
    const l = ls[Math.floor(R() * ls.length)], t = R() * l.tot;
    loopPoint(l, t, _lp);
    const dd = d2(_lp[0], _lp[1], px, pz);
    if (dd < (nearOnly ? 10 * 10 : 35 * 35) || dd > rad * rad) continue;
    const h = makeHuman(randomLook());
    const p = newPed(h, _lp[0], _lp[1], l.y, l, t); p.heading = _lp[2]; return p;
  }
  return null;
}
function removePed(p) { disposeGroup(p.h.g); const i = peds.indexOf(p); if (i >= 0) peds.splice(i, 1); }
function knockPed(p, vx, vz, dmg, byPlayer) {
  if (p.state === 'down' || p.state === 'dead') { p.vx += vx * 0.3; p.vz += vz * 0.3; return; }
  p.health -= dmg; p.state = 'down'; p.timer = 4 + R() * 2; p.byPlayer = byPlayer || p.byPlayer; p.fixed = false; p.h.body.position.y = 0;
  if (p.thief && !p.rewarded && (byPlayer || d2(p.pos.x, p.pos.z, player.pos.x, player.pos.z) < 6 * 6)) { p.rewarded = true; addPickup('money', p.pos.x + 0.6, p.pos.z, { amount: Math.floor(rR(120, 220)), ttl: 60 }); toast('Thief stopped. Grab the stolen cash.', 3000); } p.vx = vx; p.vz = vz; p.vy = Math.min(8, Math.hypot(vx, vz) * 0.35);
  if (!p.dropped && R() < 0.65) { p.dropped = true; addPickup('money', p.pos.x + rR(-1, 1), p.pos.z + rR(-1, 1), { amount: Math.floor(rR(8, 60)), ttl: 40 }); }
  if (byPlayer) crime(p.thief ? 'none' : p.cop ? 'hitcop' : p.health <= 0 ? 'kill' : 'hurt', p.pos.x, p.pos.z);
  scarePeds(p.pos.x, p.pos.z, 25); scareBirds(p.pos.x, p.pos.z, 15);
}
function scarePeds(x, z, r) {
  for (const p of peds) if ((p.state === 'walk' || p.state === 'idle' || p.state === 'watch' || p.state === 'perform') && d2(p.pos.x, p.pos.z, x, z) < r * r) { p.fixed = false; p.calm = false; if (R() < 0.3) shout(p, pR(SAY.hurt)); p.state = 'flee'; p.timer = 7 + R() * 4; const a = Math.atan2(p.pos.x - x, p.pos.z - z); p.heading = a; }
}
function updatePeds(dt) {
  const target = coarse ? 26 : 42;
  if (peds.length < target && game.state === 'play') spawnPed();
  const px = player.pos.x, pz = player.pos.z;
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    const far = d2(p.pos.x, p.pos.z, px, pz);
    if (far > 200 * 200) { if (p.fixed) continue; removePed(p); continue; }
    if (p.state !== 'walk' && p.state !== 'flee' && p.state !== 'down' && p.state !== 'dead') { if (updatePedBehaviour(p, dt, far)) continue; }
    else if (p.state === 'walk') {
      p.t += p.dir * p.speed * dt;
      if (R() < dt * 0.02) p.dir = -p.dir;
      loopPoint(p.loop, p.t, _lp);
      p.pos.x = _lp[0]; p.pos.z = _lp[1]; p.pos.y = groundH(_lp[0], _lp[1]) + p.loop.y;
      p.heading = p.dir > 0 ? _lp[2] : _lp[2] + Math.PI; p.phase += dt * p.speed * 4.6;
      animHuman(p.h, p.phase, 1, 0);
      p.h.g.rotation.set(0, p.heading, 0);
    } else if (p.state === 'flee') {
      const sp = p.calm ? 1.5 : 5.2; p.heading += rR(-1, 1) * dt;
      p.pos.x += Math.sin(p.heading) * sp * dt; p.pos.z += Math.cos(p.heading) * sp * dt;
      const hit = collideWorld(p.pos.x, p.pos.z, 0.4, p.pos.y + 0.5); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; p.heading += Math.PI * 0.5 * (R() < 0.5 ? 1 : -1); }
      p.pos.y = surfH(p.pos.x, p.pos.z); p.phase += dt * (p.calm ? 5.5 : 14); animHuman(p.h, p.phase, p.calm ? 1 : 1.3, 0);
      p.h.g.rotation.set(0, p.heading, 0);
      p.timer -= dt; if (p.timer < 0 && far > 60 * 60) { removePed(p); continue; }
    } else if (p.state === 'down' || p.state === 'dead') {
      p.pos.x += p.vx * dt; p.pos.z += p.vz * dt; p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt);
      const gy = surfH(p.pos.x, p.pos.z); p.vy -= 20 * dt; p.pos.y = Math.max(gy, p.pos.y + p.vy * dt);
      const hit = collideWorld(p.pos.x, p.pos.z, 0.4); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; p.vx *= -0.3; p.vz *= -0.3; }
      p.h.g.rotation.set(-Math.PI / 2 * Math.min(1, (p.rot = (p.rot || 0) + dt * 6)), p.heading, 0);
      p.timer -= dt;
      if (p.state === 'down' && p.timer < 0) { if (p.health > 0) { p.rot = 0; p.h.g.rotation.x = 0; if (p.cop && wantedLevel() > 0) p.state = 'cop'; else if (p.tough && p.byPlayer && !player.car) { p.state = 'fight'; p.target = 'player'; p.timer = 15; shout(p, pR(SAY.fight)); } else { p.state = 'flee'; p.timer = 8; } } else { p.state = 'dead'; p.timer = 25; } }
      else if (p.state === 'dead' && p.timer < 0) { removePed(p); continue; }
    }
    if (p.pos.y < WATER_Y - 0.8 && p.state !== 'dead') { p.state = 'dead'; p.timer = 5; }
    p.h.g.position.copy(p.pos);
    if (p.state === 'down' || p.state === 'dead') p.h.g.position.y += 0.15;
  }
}
function ejectDriver(v, cop) {
  const s = Math.sin(v.heading), c = Math.cos(v.heading);
  const look = cop ? { skin: pR(SKINS), shirt: '#1d4f9c', jacket: '#1d3f73', pants: '#1e2430', cap: '#1d3f73', hairStyle: 'short', hair: pR(HAIRS), shoes: '#141414', build: 1.08 } : randomLook();
  const h = makeHuman(look); const x = v.pos.x + c * (v.t.wid / 2 + 0.8), z = v.pos.z - s * (v.t.wid / 2 + 0.8);
  const p = { h, pos: new THREE.Vector3(x, surfH(x, z), z), heading: v.heading + Math.PI / 2, loop: null, t: 0, dir: 1, speed: 1.4, state: 'flee', health: 40, timer: 9, phase: 0, vx: 0, vz: 0, vy: 0, dropped: false, cop };
  peds.push(p); return p;
}

// ====================== TRAFFIC / AI ======================
function outEdges(si, sj) { const r = [], hd = (sj & 1) ? -1 : 1, vd = (si & 1) ? -1 : 1; if (nodeOK(si + hd, sj)) r.push([si + hd, sj]); if (nodeOK(si, sj + vd)) r.push([si, sj + vd]); return r; }
function allEdges(si, sj) { return [[si + 1, sj], [si - 1, sj], [si, sj + 1], [si, sj - 1]].filter(n => nodeOK(n[0], n[1])); }
const nearestNode = (x, z) => [clamp(Math.round(x / P - 0.5), SI0, SI1), clamp(Math.round(z / P - 0.5), SJ0, SJ1)];
function inGrid(x, z) { return x > sx(SI0) - 20 && x < sx(SI1) + 20 && z > sz(SJ0) - 20 && z < sz(SJ1) + 20 && !(z > 205 && x < 360); }
function pickNext(a, b) {
  let opts = outEdges(b[0], b[1]).filter(n => !(n[0] === a[0] && n[1] === a[1]));
  if (!opts.length) opts = allEdges(b[0], b[1]).filter(n => !(n[0] === a[0] && n[1] === a[1]));
  if (!opts.length) return a;
  return opts[Math.floor(R() * opts.length)];
}
function trafficState(v) {
  const n = nearestNode(v.pos.x, v.pos.z);
  if (!nodeOK(n[0], n[1])) return null;
  const opts = allEdges(n[0], n[1]); if (!opts.length) return null;
  let best = opts[0], bd = -9; const hs = Math.sin(v.heading), hc = Math.cos(v.heading);
  for (const o of opts) { const dx = sx(o[0]) - v.pos.x, dz = sz(o[1]) - v.pos.z, l = Math.hypot(dx, dz) || 1, dd = (dx * hs + dz * hc) / l; if (dd > bd) { bd = dd; best = o; } }
  return { mode: 'traffic', a: n, b: best, c: pickNext(n, best), lane: R() < 0.5 ? -2.6 : 2.6, speed: rR(10, 14) };
}
function steerTo(v, tx, tz, tsp) {
  const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z), da = wrapA(desired - v.heading), fw = v.speed;
  v.inS = clamp(-da * 2.4, -1, 1);
  if (v.rev > 0) { v.inT = -1; v.inS = -v.inS; return; }
  v.inT = fw < tsp ? 1 : (fw > tsp + 2 ? -0.6 : 0);
  if (Math.abs(da) > 1.3 && fw > 7) v.inT = -0.5;
  v.inHB = false;
}
const _obs = [];
function obstacleAhead(v, range) {
  const s = Math.sin(v.heading), c = Math.cos(v.heading); let best = range;
  const test = (x, z, w) => { const rx = x - v.pos.x, rz = z - v.pos.z, al = rx * s + rz * c; if (al <= 0 || al > best) return; const sd = -rx * c + rz * s; if (Math.abs(sd) < w) best = al; };
  for (const o of vehicles) if (o !== v && Math.abs(o.pos.x - v.pos.x) < range && Math.abs(o.pos.z - v.pos.z) < range) test(o.pos.x, o.pos.z, 2.3);
  if (!player.car) test(player.pos.x, player.pos.z, 1.8);
  for (const p of peds) if (p.state !== 'walk' || !p.loop || p.loop.y === 0) { if (Math.abs(p.pos.x - v.pos.x) < range && Math.abs(p.pos.z - v.pos.z) < range) test(p.pos.x, p.pos.z, 1.6); }
  return best;
}
function trafficAI(v, dt) {
  const ai = v.ai;
  const ax = sx(ai.a[0]), az = sz(ai.a[1]), bx2 = sx(ai.b[0]), bz = sz(ai.b[1]);
  const dx = bx2 - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const rx = -uz, rz = ux;
  const proj = (v.pos.x - ax) * ux + (v.pos.z - az) * uz;
  const remain = l - proj;
  if (remain < 9 && (ai.depth = (ai.depth || 0) + 1) < 4) { ai.a = ai.b; ai.b = ai.c; ai.c = pickNext(ai.a, ai.b); return trafficAI(v, dt); }
  ai.depth = 0;
  const look = Math.min(l, proj + 9);
  const tx = ax + ux * look + rx * ai.lane, tz = az + uz * look + rz * ai.lane;
  let tsp = ai.speed;
  const cx2 = sx(ai.c[0]) - bx2, cz2 = sz(ai.c[1]) - bz;
  const turning = Math.abs(cx2 * ux + cz2 * uz) < 1;
  if (turning && remain < 26) tsp = Math.min(tsp, 6.5);
  if (remain > 10.5 && remain < 34) { const st = lightState(ai.b[0], ai.b[1], Math.abs(ux) > 0.5); if (st === 'r' || (st === 'a' && remain > 18)) tsp = Math.min(tsp, Math.max(0, (remain - 13) * 1.1)); }
  const ob = obstacleAhead(v, 6 + Math.max(0, v.speed) * 1.1);
  if (ob < 30) { tsp = Math.min(tsp, Math.max(0, (ob - 6.5) * 1.1)); }
  steerTo(v, tx, tz, tsp);
  if (tsp < 0.5) { v.inT = v.speed > 0.3 ? -1 : 0; v.inHB = v.speed < 1; v.honkT += dt; if (v.honkT > 3 && !player.car && d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z) < 15 * 15) { v.honkT = 0; sfx.horn(); } } else v.honkT = 0;
}
function copAI(v, dt) {
  const tg = player.car ? player.car.pos : player.pos;
  const d = Math.hypot(tg.x - v.pos.x, tg.z - v.pos.z);
  let tx = tg.x, tz = tg.z, tsp = v.t.max * 0.9;
  if (!player.car && d < 14) tsp = Math.max(0, (d - 5) * 1.5);
  if (d > 55 && inGrid(v.pos.x, v.pos.z) && !los(v.pos.x, v.pos.z, tg.x, tg.z, 2)) {
    const ai = v.ai;
    if (!ai.nav || d2(v.pos.x, v.pos.z, sx(ai.nav[0]), sz(ai.nav[1])) < 12 * 12) {
      const from = ai.nav || nearestNode(v.pos.x, v.pos.z), goal = nearestNode(tg.x, tg.z);
      let opts = allEdges(from[0], from[1]); if (ai.prev) opts = opts.filter(o => !(o[0] === ai.prev[0] && o[1] === ai.prev[1])) || opts;
      if (!ai.nav) { ai.nav = from; } else {
        let best = null, bd = 1e9; for (const o of opts) { const s = Math.abs(o[0] - goal[0]) + Math.abs(o[1] - goal[1]) + R() * 0.5; if (s < bd) { bd = s; best = o; } }
        ai.prev = ai.nav; ai.nav = best || ai.nav;
      }
    }
    tx = sx(ai.nav[0]); tz = sz(ai.nav[1]);
    const dn = Math.hypot(tx - v.pos.x, tz - v.pos.z); if (dn < 30) tsp = Math.min(tsp, 14);
  } else { v.ai.nav = null; v.ai.prev = null; }
  steerTo(v, tx, tz, tsp);
  if (tsp < 0.5) { v.inT = v.speed > 0.3 ? -1 : 0; v.inHB = true; }
  // shoot at the player from 2 stars
  v.ai.shootT = (v.ai.shootT || 0) - dt;
  if (wantedLevel() >= 2 && d < 42 && v.ai.shootT < 0) {
    v.ai.shootT = rR(0.8, 1.4);
    if (los(v.pos.x, v.pos.z, tg.x, tg.z, 1.5)) {
      const hit = R() < 0.35; const ox = hit ? 0 : rR(-2, 2), oz = hit ? 0 : rR(-2, 2);
      tracer(v.pos.x, v.pos.y + 1.4, v.pos.z, tg.x + ox, tg.y + 1.2, tg.z + oz, 0xffd0a0);
      if (AU.ctx) noiseHit(AU.ctx.currentTime, 0.15, 1500, 0.7, 0.35 * clamp(1 - d / 60, 0.2, 1), 'lowpass');
      if (hit) { if (player.car) player.car.damage(30); else hurtPlayer(7, v.pos.x, v.pos.z); }
    }
  }
}
function pathAI(v, dt) {
  const ai = v.ai; if (ai.hold) { v.inT = 0; v.inS = 0; v.inHB = true; return; }
  const wp = ai.path[ai.i]; if (!wp) { v.inT = 0; v.inHB = true; return; }
  if (d2(v.pos.x, v.pos.z, wp[0], wp[1]) < (ai.radius || 10) ** 2) { ai.i++; return; }
  let tsp = ai.speed; const ob = obstacleAhead(v, 18); if (ob < 18 && ai.cautious) tsp = Math.min(tsp, Math.max(0, ob - 6));
  if (ai.racer) { const nx = ai.path[ai.i + 1], d = Math.sqrt(d2(v.pos.x, v.pos.z, wp[0], wp[1])); if (nx && d < 50) { const a1 = Math.atan2(wp[0] - v.pos.x, wp[1] - v.pos.z), a2 = Math.atan2(nx[0] - wp[0], nx[1] - wp[1]), turn = Math.abs(wrapA(a2 - a1)); if (turn > 0.4) tsp = Math.min(tsp, lerp(ai.speed, 12, clamp((turn - 0.4) / 1.1, 0, 1)) + d * 0.25); } }
  steerTo(v, wp[0], wp[1], tsp);
}
function fleeAI(v, dt) {
  const ai = v.ai, tg = player.car ? player.car.pos : player.pos;
  if (!ai.nav || d2(v.pos.x, v.pos.z, sx(ai.nav[0]), sz(ai.nav[1])) < 10 * 10) {
    const from = ai.nav || nearestNode(v.pos.x, v.pos.z);
    let opts = allEdges(from[0], from[1]).filter(o => !ai.prev || !(o[0] === ai.prev[0] && o[1] === ai.prev[1])); if (!opts.length) opts = allEdges(from[0], from[1]);
    let best = opts[0], bd = -1e9;
    for (const o of opts) { const s = d2(sx(o[0]), sz(o[1]), tg.x, tg.z) + R() * 2000; if (s > bd) { bd = s; best = o; } }
    ai.prev = from; ai.nav = best;
  }
  const tx = sx(ai.nav[0]), tz = sz(ai.nav[1]);
  steerTo(v, tx, tz, Math.hypot(tx - v.pos.x, tz - v.pos.z) < 22 ? 13 : ai.speed);
}
function aiUpdate(v, dt) {
  if (!v.ai || v.dead || v.burn >= 0) { v.inT = 0; v.inS = 0; v.inHB = !v.driver; return; }
  const m = v.ai.mode;
  if (m === 'traffic') trafficAI(v, dt); else if (m === 'cop') copAI(v, dt); else if (m === 'path') pathAI(v, dt); else if (m === 'flee') fleeAI(v, dt);
  else { v.inT = 0; v.inS = 0; v.inHB = true; }
  // stuck recovery
  if (v.rev > 0) { v.rev -= dt; }
  else if (v.inT > 0.5 && Math.abs(v.speed) < 1.2) { v.stuck += dt; if (v.stuck > 1.3) { v.stuck = 0; v.rev = 1.1; } }
  else v.stuck = Math.max(0, v.stuck - dt);
}
function spawnTraffic(minD, maxD, mode) {
  const pn = nearestNode(player.pos.x, player.pos.z);
  for (let tries = 0; tries < 20; tries++) {
    const si = pn[0] + Math.round(rR(-4, 4)), sj = pn[1] + Math.round(rR(-4, 4));
    if (!nodeOK(si, sj)) continue;
    const ed = outEdges(si, sj); if (!ed.length) continue;
    const b = pR(ed), ax = sx(si), az = sz(sj), dx = sx(b[0]) - ax, dz = sz(b[1]) - az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    const parked = mode === 'parked', lane = parked ? (R() < 0.5 ? -6.2 : 6.2) : (R() < 0.5 ? -2.6 : 2.6), along = rR(14, 62);
    const x = ax + ux * along - uz * lane, z = az + uz * along + ux * lane;
    const dd = d2(x, z, player.pos.x, player.pos.z); if (dd < minD * minD || dd > maxD * maxD) continue;
    if (vehicles.some(o => d2(o.pos.x, o.pos.z, x, z) < 9 * 9) || collideWorld(x, z, 1.2) || onDiag(x, z, 17) || propNear(x, z, 2.6)) continue;
    let key = mode === 'cop' || mode === 'patrol' ? 'patrulla' : mode === 'parked' ? pR(['picolo', 'picolo', 'taxi', 'furgo', 'scuter', 'delfi', 'moto', 'picolo']) : pR(['picolo', 'picolo', 'picolo', 'taxi', 'taxi', 'furgo', 'scuter', 'delfi', 'picolo', 'moto', 'bus']);
    if (key === 'bus' && vehicles.filter(o => o.t.bus).length >= 2) key = 'picolo';
    const v = new Vehicle(key, x, z, Math.atan2(ux, uz));
    if (parked) { v.ai = null; v.driver = null; v.inHB = true; v.parked = true; return v; }
    v.driver = key === 'patrulla' ? 'cop' : 'ai';
    v.ai = { mode: 'traffic', a: [si, sj], b, c: pickNext([si, sj], b), lane, speed: rR(10, 14) };
    if (mode === 'cop') v.ai = { mode: 'cop' };
    const sp = mode === 'cop' ? 10 : v.ai.speed * 0.8; v.vx = ux * sp; v.vz = uz * sp;
    return v;
  }
  return null;
}
function updateTrafficPool(dt) {
  const px = player.pos.x, pz = player.pos.z;
  let moving = 0, parked = 0, cops = 0, patrol = 0;
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i]; if (v === player.car || v.mission) continue;
    const dd = d2(v.pos.x, v.pos.z, px, pz);
    if (v.dock) { if (v.dead && dd > 120 * 120) v.remove(); continue; }   // moored boats stay put; wrecks get cleared
    if (v.dead) { v.wreckT -= dt; if (v.wreckT < 0 && dd > 80 * 80) v.remove(); continue; }
    if (dd > 330 * 330 || (v.sink > 4)) { v.remove(); continue; }
    if (v.driver === 'cop') { if (v.ai && v.ai.mode === 'cop') cops++; else patrol++; }
    else if (v.parked || !v.driver) parked++; else moving++;
  }
  const inCity = inGrid(px, pz);
  const want = inCity ? (coarse ? 14 : 22) : 6;
  if (moving < want) spawnTraffic(game.state === 'play' ? 110 : 40, 240, 'traffic');
  if (parked < (inCity ? 10 : 2)) spawnTraffic(game.state === 'play' ? 70 : 30, 200, 'parked');
  const w = wantedLevel(), wantCops = [0, 2, 3, 4, 5, 6][w];
  if (w === 0 && patrol < 2 && inCity) spawnTraffic(130, 260, 'patrol');
  if (w > 0) {
    for (const v of vehicles) if (cops < wantCops && v.driver === 'cop' && v.ai && v.ai.mode !== 'cop' && !v.roadblock && d2(v.pos.x, v.pos.z, px, pz) < 300 * 300) { v.ai = { mode: 'cop' }; cops++; }
    if (cops < wantCops) { const v = spawnTraffic(120, 230, 'cop') || spawnOffroadCop(); if (v) cops++; }
  } else {
    for (const v of vehicles) if (v.driver === 'cop' && v.ai && (v.ai.mode === 'cop' || v.ai.mode === 'block')) { v.ai = trafficState(v) || { mode: 'idle' }; v.roadblock = false; }
  }
}
function spawnOffroadCop() {
  if (inGrid(player.pos.x, player.pos.z)) return null;
  const a = R() * TAU, d = rR(130, 200), x = player.pos.x + Math.cos(a) * d, z = player.pos.z + Math.sin(a) * d;
  if (groundH(x, z) < WATER_Y || collideWorld(x, z, 2)) return null;
  const v = new Vehicle('patrulla', x, z, Math.atan2(player.pos.x - x, player.pos.z - z)); v.driver = 'cop'; v.ai = { mode: 'cop' }; return v;
}

// ====================== CRIME & WANTED ======================
let copSeenT = 0, copHits = 0;
function nearestCop(x, z) { let b = 1e9, bv = null; for (const v of vehicles) if (v.driver === 'cop' && !v.dead) { const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < b) { b = d; bv = v; } } let fb = 1e9; for (const p of peds) if (p.cop && p.state !== 'dead' && p.state !== 'down') { const d = Math.hypot(p.pos.x - x, p.pos.z - z); if (d < fb) fb = d; } return [Math.min(b, fb), bv, fb]; }
function raise(h) { const before = wantedLevel(); game.heat = Math.min(5.99, Math.max(game.heat, 0) + h); if (wantedLevel() > before) copSeenT = 0; }
function crime(kind, x, z) {
  const [cd] = nearestCop(x, z), seen = cd < 120;
  switch (kind) {
    case 'hurt': raise(seen ? 1 : 0.25); if (seen && game.heat < 1) game.heat = 1; break;
    case 'kill': raise(seen ? 1.2 : 0.55); if (seen && game.heat < 1) game.heat = 1; break;
    case 'gunfire': if (cd < 100 && game.heat < 1) game.heat = 1; break;
    case 'steal': if (cd < 70) raise(1); break;
    case 'hitcop': copHits++; if (game.heat < 1) game.heat = 1; if (copHits % 4 === 0) raise(1); break;
    case 'shootcop': game.heat = Math.max(game.heat, 2); raise(0.5); break;
  }
}
function updateWanted(dt) {
  const w = wantedLevel(); const st = $('stars');
  if (w > 0) {
    const tg = player.car ? player.car.pos : player.pos;
    let seen = false;
    for (const v of vehicles) if (v.driver === 'cop' && !v.dead && v.ai && v.ai.mode === 'cop') { const d = d2(v.pos.x, v.pos.z, tg.x, tg.z); if (d < 95 * 95 && los(v.pos.x, v.pos.z, tg.x, tg.z, 2)) { seen = true; break; } }
    if (!seen) for (const p of peds) if (p.cop && p.state === 'cop' && d2(p.pos.x, p.pos.z, tg.x, tg.z) < 60 * 60 && los(p.pos.x, p.pos.z, tg.x, tg.z, 1.5)) { seen = true; break; }
    if (!seen && heliSees()) seen = true;
    if (seen) copSeenT = 0; else copSeenT += dt;
    st.classList.toggle('blink', !seen);
    if (copSeenT > 9 + w * 4) { game.heat = w - 1; copSeenT = 0; if (wantedLevel() === 0) toast('You lost the police.'); }
    // busted
    if (!player.dead) {
      const [cd, cv2] = nearestCop(tg.x, tg.z);
      const slow = player.car ? Math.abs(player.car.speed) < 1.5 : true;
      const footBust = !player.car && player.knock <= 0 && footCopNear(tg.x, tg.z, 1.8);
      if (footBust || (cv2 && Math.hypot(cv2.pos.x - tg.x, cv2.pos.z - tg.z) < (player.car ? 7 : 6.5) && slow && Math.abs(cv2.speed) < 3)) { player.bustT += dt; if (player.bustT > (player.car ? 2.4 : 1.6)) bust(); }
      else player.bustT = Math.max(0, player.bustT - dt);
    }
  } else { st.classList.remove('blink'); copSeenT = 0; player.bustT = 0; }
}

// ====================== PLAYER ======================
function hurtPlayer(a, sx2, sz2) {
  if (player.dead) return;
  const ab = Math.min(player.armor, a); player.armor -= ab; a -= ab;
  player.health -= a; cam.shake = Math.max(cam.shake, Math.min(0.6, a / 40));
  if (sx2 !== undefined && !player.car && a > 12) { const l = Math.hypot(player.pos.x - sx2, player.pos.z - sz2) || 1; player.kvx = (player.pos.x - sx2) / l * 7; player.kvz = (player.pos.z - sz2) / l * 7; player.knock = 1.2; player.vy = 4; }
  if (player.health <= 0) killPlayer();
}
function killPlayer() {
  if (player.dead) return; player.dead = true; player.health = 0;
  bigMsg('HOSPITALITZAT', 'Wasted · €100 hospital bill · weapons lost', true, 4000); sfx.fail();
  if (mission.run) failMission('You ended up in hospital.');
  setTimeout(() => respawn([320, -452], Math.PI, 100, true), 3200);
}
function bust() {
  if (player.dead) return; player.dead = true;
  bigMsg('DETINGUT', 'Busted · €100 fine · weapons confiscated', true, 4000); sfx.fail();
  if (mission.run) failMission('You were arrested.');
  setTimeout(() => respawn([29, 250], 0, 100, true), 3200);
}
function respawn(at, heading, cost, loseGuns) {
  $('fade').classList.add('on');
  setTimeout(() => {
    if (player.car) { const v = player.car; player.car = null; v.driver = null; }
    player.pos.set(at[0], surfH(at[0], at[1]), at[1]); player.heading = heading; cam.yaw = heading; player.vy = 0; player.knock = 0;
    player.health = 100; player.money = Math.max(0, player.money - cost); player.dead = false; player.human.g.visible = true; player.human.g.rotation.set(0, heading, 0);
    if (loseGuns) { player.armor = 0; player.hasPistol = false; player.hasBat = false; player.ammo = 0; player.weapon = 0; drawWeaponIcon(); }
    game.heat = 0; player.bustT = 0;
    for (const v of vehicles.slice()) if (v.driver === 'cop' && v.ai && v.ai.mode === 'cop') v.remove();
    writeSave(); $('fade').classList.remove('on');
  }, 700);
}
function switchWeapon() { const list = [0]; if (player.hasBat) list.push(2); if (player.hasPistol && player.ammo > 0) list.push(1); if (list.length === 1) { toast('Only your fists. There is a bat on the beach and one in El Raval; a pistol is hidden in El Raval too.'); return; } player.weapon = list[(list.indexOf(player.weapon) + 1) % list.length]; drawWeaponIcon(); sfx.click(); }
function enterExit() {
  if (player.dead || player.knock > 0) return;
  if (player.car) {
    const v = player.car, s = Math.sin(v.heading), c = Math.cos(v.heading), off = v.t.wid / 2 + 0.9;
    let ex = v.pos.x + c * off, ez = v.pos.z - s * off;
    if (collideWorld(ex, ez, 0.45)) { ex = v.pos.x - c * off; ez = v.pos.z + s * off; }
    if (collideWorld(ex, ez, 0.45)) { const f = freeSpot(ex, ez, 0.5); ex = f[0]; ez = f[1]; }
    const sp = Math.abs(v.speed);
    player.pos.set(ex, Math.max(surfH(ex, ez), v.pos.y), ez); player.heading = v.heading; player.car = null; player.human.g.visible = true;
    v.driver = null; v.ai = null; v.inT = 0; v.inS = 0; v.inHB = sp < 10;
    if (sp > 10) { hurtPlayer(Math.min(30, sp), v.pos.x, v.pos.z); }
    $('speedo').hidden = true;
    return;
  }
  let best = null, bd = 4.6 * 4.6;
  for (const v of vehicles) { if (v.dead || v.burn >= 0) continue; const d = d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z); if (d < bd && Math.abs(v.pos.y - player.pos.y) < 2.5) { bd = d; best = v; } }
  if (!best) return;
  if (best.driver === 'ai' || best.driver === 'cop') {
    if (Math.abs(best.speed) > 6) return;
    const wasCop = best.driver === 'cop'; ejectDriver(best, wasCop);
    if (wasCop) { game.heat = Math.max(game.heat, 2); } else crime('steal', best.pos.x, best.pos.z);
  }
  best.driver = 'player'; best.ai = null; best.parked = false; best.inHB = false; player.car = best; player.human.g.visible = false;
  cam.yaw = best.heading; flash('vehname', best.t.name, 2500); $('speedo').hidden = false;
  if (STATIONS[radio.st].kind !== 'off') flash('radiolab', STATIONS[radio.st].name, 2500);
}
function attack() {
  if (player.dead || player.car || player.knock > 0) return;
  if (player.weapon === 1 && player.ammo > 0) {
    if (player.fireT > 0) return; player.fireT = 0.28; player.ammo--; $('ammo').textContent = player.ammo;
    const ox = player.pos.x, oz = player.pos.z, oy = player.pos.y + 1.45;
    let best = null, bs = 1e9, bk = null;
    const consider = (x, z, kind, o) => { const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz); if (d > 60 || d < 0.3) return; const ang = Math.abs(wrapA(Math.atan2(dx, dz) - cam.yaw)); if (ang > 0.32) return; const sc = ang * 40 + d; if (sc < bs && los(ox, oz, x, z, 1.2)) { bs = sc; best = o; bk = kind; } };
    for (const p of peds) if (p.state !== 'dead') consider(p.pos.x, p.pos.z, 'ped', p);
    for (const v of vehicles) if (!v.dead && v !== player.car) consider(v.pos.x, v.pos.z, 'car', v);
    let hx, hy, hz;
    if (best) {
      hx = best.pos.x; hz = best.pos.z; hy = best.pos.y + (bk === 'ped' ? (best.state === 'walk' || best.state === 'flee' ? 1.2 : 0.3) : 0.9);
      player.heading = Math.atan2(hx - ox, hz - oz);
      if (bk === 'ped') { const l = Math.hypot(hx - ox, hz - oz) || 1; knockPed(best, (hx - ox) / l * 3, (hz - oz) / l * 3, 22, true); }
      else { best.damage(110, 'player'); if (best.t.police) crime('shootcop', hx, hz); for (let i = 0; i < 4; i++) fx.spawn('spark', hx, hy, hz); }
    } else {
      player.heading = cam.yaw; const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw); let d = 2;
      let hitProp = null;
      while (d < 60 && !solidAt(ox + s * d, oz + c * d, oy)) { const qx = ox + s * d, qz = oz + c * d; hitProp = propsNear(qx, qz, 1).find(pr => !pr.broken && d2(pr.x, pr.z, qx, qz) < (pr.r + 0.4) ** 2); if (hitProp) break; d += 1.0; }
      if (hitProp) { if (hitProp.kind === 'lamp') { if (!hitProp.lightOut) { hitProp.lightOut = true; setCorona(hitProp.idx, false); sfx.glass(); } } else breakProp(hitProp, s * 6, c * 6, true, 'gun'); }
      hx = ox + s * d; hy = oy - Math.sin(cam.pitch) * d * 0.3; hz = oz + c * d; if (d < 60) for (let i = 0; i < 3; i++) fx.spawn('spark', hx, hy, hz);
    }
    tracer(ox + Math.sin(player.heading) * 0.6, oy, oz + Math.cos(player.heading) * 0.6, hx, hy, hz);
    fx.spawn('spark', ox + Math.sin(player.heading) * 0.8, oy, oz + Math.cos(player.heading) * 0.8);
    sfx.shot(); scarePeds(ox, oz, 40); scareBirds(ox, oz, 70); crime('gunfire', ox, oz);
    if (player.ammo === 0) { player.weapon = 0; drawWeaponIcon(); }
  } else { meleeAttack(); return;
    if (player.punchT > 0) return; player.punchT = 0.45;
    let best = null, bd = 2.2;
    for (const p of peds) { if (p.state === 'dead' || p.state === 'down') continue; const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z); if (d < bd && Math.abs(wrapA(Math.atan2(p.pos.x - player.pos.x, p.pos.z - player.pos.z) - player.heading)) < 1.1) { bd = d; best = p; } }
    if (best) { const l = bd || 1; sfx.punch(); best.health -= 14; if (best.health <= 0) knockPed(best, (best.pos.x - player.pos.x) / l * 4, (best.pos.z - player.pos.z) / l * 4, 0, true); else { best.state = 'flee'; best.timer = 8; best.heading = player.heading; crime('hurt', best.pos.x, best.pos.z); if (!best.dropped && R() < 0.4) { best.dropped = true; addPickup('money', best.pos.x, best.pos.z, { amount: Math.floor(rR(5, 30)), ttl: 30 }); } } }
  }
}
function updatePlayer(dt) {
  if (ride && ride.kind === 'cable') { player.vy = 0; return; }
  player.fireT -= dt; player.punchT -= dt;
  if (player.dead) { if (player.car) { player.car.inT = 0; player.car.inS = 0; player.car.inHB = true; } if (!player.car) { player.human.g.rotation.x = lerp(player.human.g.rotation.x, -Math.PI / 2, dt * 5); } return; }
  if (firing()) attack();
  if (player.car) {
    const v = player.car;
    v.inT = axisY(); v.inS = axisX(); v.inHB = !!keys.Space || touch.jump;
    player.pos.copy(v.pos); player.heading = v.heading;
    if (v.sink > 2.2) { // car sank: swim out
      const x = v.pos.x, z = v.pos.z; player.car = null; v.driver = null; player.human.g.visible = true; player.pos.set(x, WATER_Y, z); sfx.splash(); $('speedo').hidden = true;
    }
    $('speedo').innerHTML = Math.round(Math.abs(v.speed) * 3.6) + '<small>km/h</small>';
    return;
  }
  const h = player.human;
  if (player.knock > 0) {
    player.knock -= dt; player.pos.x += player.kvx * dt; player.pos.z += player.kvz * dt; player.kvx *= Math.exp(-3 * dt); player.kvz *= Math.exp(-3 * dt);
    h.g.rotation.x = -Math.PI / 2 * Math.min(1, (1.2 - player.knock) * 4) * (player.knock > 0.3 ? 1 : player.knock / 0.3);
  } else h.g.rotation.x = 0;
  const ix = axisX(), iy = axisY();
  const fx2 = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let mx = fx2 * iy - fz * ix, mz = fz * iy + fx2 * ix;
  const ml = Math.hypot(mx, mz);
  const gy = surfH(player.pos.x, player.pos.z);
  player.swim = groundH(player.pos.x, player.pos.z) < WATER_Y - 1.1;
  const sprint = keys.ShiftLeft || keys.ShiftRight || (coarse && Math.hypot(touch.ax, touch.ay) > 0.95);
  const speed = player.swim ? 3 : sprint ? 9.5 : 5.2;
  if (ml > 0.1 && player.knock <= 0 && !(player.atk && player.atk.kind !== 'jab')) {
    mx /= Math.max(1, ml); mz /= Math.max(1, ml);
    player.pos.x += mx * speed * dt; player.pos.z += mz * speed * dt;
    const want = Math.atan2(mx, mz); player.heading = wrapA(player.heading + wrapA(want - player.heading) * Math.min(1, dt * 12));
    player.anim += dt * (sprint ? 13 : 8.5);
  }
  // collisions
  const hit = collideWorld(player.pos.x, player.pos.z, 0.45, player.pos.y + 0.6); if (hit) { player.pos.x += hit[0]; player.pos.z += hit[1]; }
  propCollideCircle(player.pos, 0.45);
  for (const v of vehicles) {
    const s = Math.sin(v.heading), c = Math.cos(v.heading), rx = player.pos.x - v.pos.x, rz = player.pos.z - v.pos.z;
    const al = rx * s + rz * c, sd = -rx * c + rz * s, hl = v.t.len / 2 + 0.4, hw = v.t.wid / 2 + 0.4;
    if (Math.abs(al) < hl && Math.abs(sd) < hw && Math.abs(player.pos.y - v.pos.y) < 2) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp > 4 && player.knock <= 0) { hurtPlayer(sp * 1.6, v.pos.x - v.vx, v.pos.z - v.vz); player.kvx = v.vx * 0.8; player.kvz = v.vz * 0.8; }
      const px2 = hl - Math.abs(al), pz2 = hw - Math.abs(sd);
      if (px2 < pz2) { const k = Math.sign(al) * px2; player.pos.x += s * k; player.pos.z += c * k; } else { const k = Math.sign(sd) * pz2; player.pos.x += -c * k; player.pos.z += s * k; }
    }
  }
  // vertical
  if (player.swim) { player.pos.y = lerp(player.pos.y, WATER_Y - 1.25, dt * 4); player.vy = 0; if (R() < dt * 3) fx.spawn('splash', player.pos.x, WATER_Y, player.pos.z); }
  else {
    if ((keys.Space || touch.jump) && player.grounded && player.knock <= 0) { player.vy = 7; player.grounded = false; }
    player.vy -= 22 * dt; player.pos.y += player.vy * dt;
    if (player.pos.y <= gy) { if (player.vy < -16) hurtPlayer((-player.vy - 16) * 4); player.pos.y = gy; player.vy = 0; player.grounded = true; }
    else if (player.pos.y - gy > 0.3) player.grounded = false;
  }
  h.g.position.copy(player.pos); h.g.rotation.y = player.heading;
  animHuman(h, player.anim, ml > 0.1 && !player.atk ? (sprint ? 1.25 : 1) : 0, 0);
  if (player.atk) animAttack(h, player.atk); else { h.body.rotation.x = 0; h.armR.rotation.z = 0.08; }
  if (player.weapon === 2 && !player.atk) { h.armR.rotation.x = Math.min(h.armR.rotation.x, -0.35); h.elbowR.rotation.x = -0.9; }
  if (player.weapon === 1 && player.hasPistol && player.fireT > -1) { h.armR.rotation.x = -Math.PI / 2; h.elbowR.rotation.x = 0; }
  // push peds aside
  for (const p of peds) if (p.state === 'walk' && d2(p.pos.x, p.pos.z, player.pos.x, player.pos.z) < 0.7) { p.dir = -p.dir; p.t += p.dir * 0.4; }
}

// ====================== VEHICLE INTERACTIONS ======================
function vehicleInteractions(dt) {
  const n = vehicles.length;
  for (let i = 0; i < n; i++) {
    const a = vehicles[i];
    for (let j = i + 1; j < n; j++) {
      const b = vehicles[j];
      if (Math.abs(a.pos.x - b.pos.x) > 7 || Math.abs(a.pos.z - b.pos.z) > 7) continue;
      const sa = Math.sin(a.heading), ca = Math.cos(a.heading), sb = Math.sin(b.heading), cb = Math.cos(b.heading);
      const ra = a.t.moto ? 0.55 : a.t.wid * 0.55, rb = b.t.moto ? 0.55 : b.t.wid * 0.55, oa = a.t.len * 0.3, ob = b.t.len * 0.3;
      for (const ka of [1, -1]) for (const kb of [1, -1]) {
        const ax = a.pos.x + sa * oa * ka, az = a.pos.z + ca * oa * ka, bx2 = b.pos.x + sb * ob * kb, bz = b.pos.z + cb * ob * kb;
        const dx = bx2 - ax, dz = bz - az, dd = dx * dx + dz * dz, rs = ra + rb;
        if (dd >= rs * rs || dd < 1e-6) continue;
        const d = Math.sqrt(dd), nx = dx / d, nz = dz / d, pen = rs - d, ma = a.t.mass * (a.dead ? 2 : 1), mb = b.t.mass * (b.dead ? 2 : 1), tot = ma + mb;
        a.pos.x -= nx * pen * mb / tot; a.pos.z -= nz * pen * mb / tot; b.pos.x += nx * pen * ma / tot; b.pos.z += nz * pen * ma / tot;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const jimp = -(1.3) * rv / (1 / ma + 1 / mb);
          a.vx -= jimp * nx / ma; a.vz -= jimp * nz / ma; b.vx += jimp * nx / mb; b.vz += jimp * nz / mb;
          const imp = -rv;
          if (imp > 3.5) {
            const dmg = Math.min(imp * imp * 0.9, 900) * (a.driver === 'cop' || b.driver === 'cop' ? 0.5 : 1);   // police rams hurt less
            a.damage(Math.min(dmg * mb / tot * 2, a.t.hp * 0.4), b.driver === 'player' ? 'player' : null); b.damage(Math.min(dmg * ma / tot * 2, b.t.hp * 0.4), a.driver === 'player' ? 'player' : null);
            if (a.driver === 'player' || b.driver === 'player') { sfx.crash(Math.min(1, imp / 18)); cam.shake = Math.max(cam.shake, Math.min(0.8, imp / 25)); }
            for (let k = 0; k < 3; k++) fx.spawn('spark', (ax + bx2) / 2, a.pos.y + 0.7, (az + bz) / 2);
          }
        }
      }
    }
    // vehicle vs pedestrians
    const sp = Math.hypot(a.vx, a.vz); if (sp < 1) continue;
    const s = Math.sin(a.heading), c = Math.cos(a.heading), hl = a.t.len / 2 + 0.3, hw = a.t.wid / 2 + 0.3;
    for (const p of peds) {
      if (p.state === 'dead') continue;
      const rx = p.pos.x - a.pos.x, rz = p.pos.z - a.pos.z; if (Math.abs(rx) > 4 || Math.abs(rz) > 4) continue;
      const al = rx * s + rz * c, sd = -rx * c + rz * s;
      if (Math.abs(al) < hl && Math.abs(sd) < hw) {
        if (sp > 3.5) { knockPed(p, a.vx * 0.8 + rR(-1, 1), a.vz * 0.8 + rR(-1, 1), sp * 3, a.driver === 'player'); if (a.driver === 'player') { sfx.thud(0.7); if (sp > 8) game.stats.ko++; } shout(p, pR(SAY.hurt)); }
        else { if (R() < 0.05) shout(p, pR(SAY.car)); p.pos.x += -c * Math.sign(sd) * 0.5; p.pos.z += s * Math.sign(sd) * 0.5; }
      }
    }
  }
}

// ====================== LIFE: breakables, brawls, street events, birds, fireworks ======================
game.stats = { props: 0, ko: 0, fights: 0, snatch: 0 };
// ---------- breakable props ----------
const props = [], propHash = new SHash(20), _pq = [], _m4 = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const PROP_KIND = {
  lamp: { r: 0.3, brk: 7, slow: 0.82, dmg: 25, melee: 'bat' },
  bench: { r: 0.85, brk: 3, slow: 0.9, dmg: 6, melee: 'bat' },
  bin: { r: 0.85, brk: 3, slow: 0.88, dmg: 8, melee: 'kick' },
  bike: { r: 0.45, brk: 2, slow: 0.96, dmg: 2, melee: 'kick' },
  hydrant: { r: 0.32, brk: 4, slow: 0.85, dmg: 12, melee: 'bat' },
};
function addProp(kind, x, z, refs, extra) { const k = PROP_KIND[kind]; const p = bbox({ poly: [[x - k.r, z - k.r], [x + k.r, z + k.r]] }); Object.assign(p, { kind, k, x, z, r: k.r, refs, broken: false, mats: [] }, extra || {}); props.push(p); propHash.insert(p); return p; }
function propsNear(x, z, r) { return propHash.query(x - r, z - r, x + r, z + r, _pq); }
const propNear = (x, z, r) => propsNear(x, z, r).some(p => !p.broken && d2(p.x, p.z, x, z) < (r + p.r) ** 2);
const debris = [];
const binMats = {};
function addDebris(geo, mat, matrix, vx, vy, vz, tip) {
  const m = new THREE.Mesh(geo, mat); matrix.decompose(m.position, m.quaternion, m.scale); m.castShadow = true; scene.add(m);
  const d = { m, vx, vy, vz, ax: new THREE.Vector3(rR(-1, 1), rR(-1, 1), rR(-1, 1)).normalize(), av: rR(3, 9), life: 45, rest: false, tip, q0: m.quaternion.clone(), ang: 0 };
  if (tip) { d.ax.set(tip[0], 0, tip[1]).normalize(); d.av = 0.6; }
  debris.push(d); if (debris.length > 70) { const o = debris.shift(); scene.remove(o.m); }
  return d;
}
const _q = new THREE.Quaternion();
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.life -= dt;
    if (d.life <= 0) { scene.remove(d.m); debris.splice(i, 1); continue; }
    if (d.rest) continue;
    if (d.tip) { // lamp post tipping over its base
      d.av += 7 * Math.sin(d.ang + 0.15) * dt; d.ang += d.av * dt;
      if (d.ang > 1.48) { d.ang = 1.48; d.av *= -0.3; if (Math.abs(d.av) < 0.4) d.rest = true; else sfx.clang(0.4); }
      d.m.quaternion.copy(_q.setFromAxisAngle(d.ax, d.ang)).multiply(d.q0); continue;
    }
    d.vy -= 20 * dt; d.m.position.x += d.vx * dt; d.m.position.y += d.vy * dt; d.m.position.z += d.vz * dt;
    const hit = collideWorld(d.m.position.x, d.m.position.z, 0.4, d.m.position.y); if (hit) { d.m.position.x += hit[0]; d.m.position.z += hit[1]; d.vx *= -0.4; d.vz *= -0.4; }
    d.m.quaternion.premultiply(_q.setFromAxisAngle(d.ax, d.av * dt));
    const gy = surfH(d.m.position.x, d.m.position.z);
    if (d.m.position.y < gy) { d.m.position.y = gy; if (d.vy < -3) fx.spawn('dust', d.m.position.x, gy + 0.3, d.m.position.z); d.vy = -d.vy * 0.3; d.vx *= 0.55; d.vz *= 0.55; d.av *= 0.5;
      if (Math.abs(d.vy) < 1 && Math.hypot(d.vx, d.vz) < 0.6) { d.rest = true; d.m.position.y = gy; } }
  }
}
const geysers = [];
function breakProp(p, vx, vz, byPlayer, src) {
  if (p.broken) return; p.broken = true; p.brokenAt = now; if (byPlayer) game.stats.props++;
  p.saved = p.refs.map(([im, i]) => { const m = new THREE.Matrix4(); im.getMatrixAt(i, m); return m; });
  const sp = Math.hypot(vx, vz), up = clamp(sp * 0.35, 2.5, 8);
  if (p.kind === 'lamp') {
    const g = new THREE.Group(); g.position.set(p.x, CURB, p.z); scene.add(g);
    p.refs.forEach(([im, i], j) => { if (im.isInstancedMesh) { im.setMatrixAt(i, _zero); im.instanceMatrix.needsUpdate = true; } });
    const tipDir = sp > 0.1 ? [vz / sp, -vx / sp] : [1, 0];
    const pole = new THREE.Mesh(lampPoleIM.geometry, lampPoleIM.material), head = new THREE.Mesh(lampHeadIM.geometry, lampHeadIM.material);
    const grp = new THREE.Group(); grp.add(pole); grp.add(head); grp.position.set(p.x, CURB, p.z); scene.add(grp); scene.remove(g);
    const d = { m: grp, tip: true, ax: new THREE.Vector3(tipDir[0], 0, tipDir[1]), av: 0.4 + sp * 0.05, ang: 0, q0: new THREE.Quaternion(), life: 50, rest: false };
    debris.push(d);
    setCorona(p.idx, false);
    for (let i = 0; i < 10; i++) fx.spawn('spark', p.x, CURB + 6.5, p.z); sfx.clang(0.8); sfx.glass();
  } else {
    p.refs.forEach(([im, i], j) => {
      const mat = p.kind === 'bin' ? (binMats[p.color] || (binMats[p.color] = new THREE.MeshLambertMaterial({ vertexColors: true, color: p.color }))) : im.material;
      addDebris(im.geometry, mat, p.saved[j], vx * 0.75 + rR(-1.5, 1.5), up + rR(0, 2), vz * 0.75 + rR(-1.5, 1.5));
      im.setMatrixAt(i, _zero); im.instanceMatrix.needsUpdate = true;
    });
    if (p.kind === 'bin') { for (let i = 0; i < 8; i++) fx.spawn('trash', p.x, 1, p.z); sfx.thud(0.8); }
    else if (p.kind === 'bike') { for (let i = 0; i < 5; i++) fx.spawn('spark', p.x, 0.6, p.z); sfx.clang(0.5); }
    else if (p.kind === 'bench') { for (let i = 0; i < 5; i++) fx.spawn('dust', p.x, 0.5, p.z); sfx.thud(0.6); }
    else if (p.kind === 'hydrant') { geysers.push({ x: p.x, z: p.z, t: 25, p }); sfx.splash(); sfx.clang(0.7); }
  }
  scarePeds(p.x, p.z, 10); scareBirds(p.x, p.z, 25);
  if (byPlayer && src !== 'car' && R() < 0.3) { const w = peds.find(q => q.state === 'walk' && d2(q.pos.x, q.pos.z, p.x, p.z) < 15 * 15); if (w) shout(w, pR(['Vàndal!', 'Ei! Què fas?', 'Incivic!'])); }
}
function restoreProp(p) {
  p.broken = false; p.refs.forEach(([im, i], j) => { im.setMatrixAt(i, p.saved[j]); im.instanceMatrix.needsUpdate = true; });
  if (p.kind === 'lamp') setCorona(p.idx, true);
  for (let i = geysers.length - 1; i >= 0; i--) if (geysers[i].p === p) geysers.splice(i, 1);
}
function setCorona(i, on) { if (!lampCoronaGeo) return; const a = lampCoronaGeo.attributes.position; a.setY(i, on ? CURB + 6.45 : -500); a.needsUpdate = true; if (poolIM) { if (!on) { poolIM.getMatrixAt(i, _m4); poolSaved[i] = _m4.clone(); poolIM.setMatrixAt(i, _zero); } else if (poolSaved[i]) poolIM.setMatrixAt(i, poolSaved[i]); poolIM.instanceMatrix.needsUpdate = true; } }
const poolSaved = {};
let propCheckT = 0;
function updateProps(dt) {
  updateDebris(dt);
  for (let i = geysers.length - 1; i >= 0; i--) {
    const g = geysers[i]; g.t -= dt; if (g.t <= 0) { geysers.splice(i, 1); continue; }
    if (d2(g.x, g.z, camera.position.x, camera.position.z) < 200 * 200) for (let k = 0; k < 3; k++) fx.spawn('water', g.x, CURB + 0.6, g.z);
    for (const p of peds) if (p.state === 'walk' && d2(p.pos.x, p.pos.z, g.x, g.z) < 9) { p.state = 'flee'; p.timer = 5; shout(p, pR(['Aigua!', 'Uf, quin xàfec!'])); }
    const v = player.car; if (v && !v.air && d2(v.pos.x, v.pos.z, g.x, g.z) < 2.2 * 2.2) { v.air = true; v.yv = 11; sfx.splash(); }
  }
  propCheckT -= dt; if (propCheckT > 0) return; propCheckT = 1;
  for (const p of props) if (p.broken && now - p.brokenAt > 90000 && d2(p.x, p.z, player.pos.x, player.pos.z) > 220 * 220) restoreProp(p);
}
function propCollideVehicle(v) {
  const t = v.t, s = Math.sin(v.heading), c = Math.cos(v.heading);
  for (const p of propsNear(v.pos.x, v.pos.z, 4)) {
    if (p.broken) continue;
    const dx = p.x - v.pos.x, dz = p.z - v.pos.z, al = dx * s + dz * c, sd = -dx * c + dz * s;
    if (Math.abs(al) > t.len / 2 + p.r || Math.abs(sd) > t.wid / 2 + p.r || v.pos.y > 2.5 + groundH(p.x, p.z)) continue;
    const sp = Math.hypot(v.vx, v.vz);
    if (sp > p.k.brk * (t.mass > 1.5 ? 0.6 : 1)) {
      breakProp(p, v.vx, v.vz, v.driver === 'player', 'car'); v.vx *= p.k.slow; v.vz *= p.k.slow; v.damage(p.k.dmg);
      if (v.driver === 'player') cam.shake = Math.max(cam.shake, 0.22);
    } else {
      const pa = t.len / 2 + p.r - Math.abs(al), pw = t.wid / 2 + p.r - Math.abs(sd);
      if (pa < pw) { const k = -Math.sign(al) * pa; v.pos.x += s * k; v.pos.z += c * k; } else { const k = -Math.sign(sd) * pw; v.pos.x += -c * k; v.pos.z += s * k; }
      v.vx *= 0.5; v.vz *= 0.5;
    }
  }
}
function propCollideCircle(pos, r) {
  for (const p of propsNear(pos.x, pos.z, r + 1)) {
    if (p.broken) continue; const dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz), m = r + p.r;
    if (d < m && d > 1e-4) { pos.x += dx / d * (m - d); pos.z += dz / d * (m - d); }
  }
}
function registerProps() {
  lampSpots.forEach((sp, i) => addProp('lamp', sp[0], sp[1], [[lampPoleIM, i], [lampHeadIM, i]], { idx: i }));
  benchSpots.forEach((sp, i) => addProp('bench', sp[0], sp[1], [[benchIM, i]]));
  binSpots.forEach((sp, i) => addProp('bin', sp[0], sp[1], [[binIM, i]], { color: sp[3] }));
  bikeSpots.forEach((sp, i) => addProp('bike', sp[0], sp[1], [[bikeIM, i]]));
  hydrantSpots.forEach((sp, i) => addProp('hydrant', sp[0], sp[1], [[hydrantIM, i]]));
}

// ---------- speech bubbles ----------
const bubbleTex = {};
function getBubbleTex(text) {
  if (bubbleTex[text]) return bubbleTex[text];
  const t = canvasTex(256, 72, g => {
    g.font = "bold 30px 'Barlow Condensed', Arial, sans-serif"; const w = Math.min(244, g.measureText(text).width + 30), x = (256 - w) / 2;
    g.fillStyle = 'rgba(255,255,255,0.94)'; g.strokeStyle = '#111'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x + 10, 4); g.lineTo(x + w - 10, 4); g.quadraticCurveTo(x + w, 4, x + w, 14); g.lineTo(x + w, 44); g.quadraticCurveTo(x + w, 54, x + w - 10, 54); g.lineTo(140, 54); g.lineTo(128, 68); g.lineTo(122, 54); g.lineTo(x + 10, 54); g.quadraticCurveTo(x, 54, x, 44); g.lineTo(x, 14); g.quadraticCurveTo(x, 4, x + 10, 4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 30);
  }, false);
  return (bubbleTex[text] = t);
}
const bubbles = [];
function shout(who, text) {
  if (!who || !who.pos || d2(who.pos.x, who.pos.z, player.pos.x, player.pos.z) > 45 * 45) return;
  if (who.bubble && who.bubble.t > 0.6) return;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getBubbleTex(text), transparent: true, depthWrite: false, fog: false })); s.scale.set(2.6, 0.73, 1); s.renderOrder = 5; scene.add(s);
  const b = { s, who, t: 2.2 }; who.bubble = b; bubbles.push(b);
  if (bubbles.length > 8) { const o = bubbles.shift(); scene.remove(o.s); o.s.material.dispose(); }
  if (AU.ctx) { const t0 = AU.ctx.currentTime, f = who.h && who.h.voice || 180; for (let i = 0; i < Math.min(5, text.length / 2); i++) tone(t0 + i * 0.07, f * rR(0.9, 1.3), 0.06, 'triangle', 0.035 * clamp(1 - Math.sqrt(d2(who.pos.x, who.pos.z, player.pos.x, player.pos.z)) / 40, 0, 1)); }
}
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.t -= dt;
    if (b.t <= 0 || !b.who.h || !b.who.h.g.parent) { scene.remove(b.s); b.s.material.dispose(); bubbles.splice(i, 1); continue; }
    const lying = b.who.state === 'down' || b.who.state === 'dead';
    b.s.position.set(b.who.pos.x, b.who.pos.y + (lying ? 1.0 : 2.45), b.who.pos.z); b.s.material.opacity = Math.min(1, b.t / 0.35);
  }
}
const SAY = { hurt: ['Ai!', 'Ei!', 'Què fas?!', 'Ajuda!', 'Boig!', 'Para!', 'Policia!'], fight: ['Vine aquí!', 'Ara veuràs!', 'Mira per on vas!', 'Què has dit?', 'Fora!'], car: ['Compte!', 'Ei, el cotxe!', 'Animal!', 'Frena!'], thief: ['Al lladre!', 'La meva bossa!', 'Atureu-lo!'], cop: ['Alto, policia!', 'Quiet!', 'A terra!', 'No et moguis!'], steal: ['El meu cotxe!', 'Torna-me\'l!', 'Lladre!'], chat: ['I el Barça?', 'Quina calor...', 'Has vist el preu dels pisos?', 'Bon dia!', 'Ens veiem!', 'Que vagi bé!'] };

// ---------- melee: combos, bat, props ----------
const MELEE = { jab: { dmg: 9, reach: 1.9, arc: 1.0, dur: 0.32, ko: false }, cross: { dmg: 12, reach: 1.9, arc: 1.0, dur: 0.36, ko: false }, kick: { dmg: 18, reach: 2.2, arc: 1.1, dur: 0.5, ko: true }, bat: { dmg: 32, reach: 2.5, arc: 1.5, dur: 0.55, ko: true } };
player.atk = null; player.combo = 0; player.lastHit = -9; player.hasBat = false;
function meleeAttack() {
  if (player.atk) return;
  let kind;
  if (player.weapon === 2) kind = 'bat';
  else { player.combo = now - player.lastHit < 900 ? (player.combo + 1) % 3 : 0; kind = ['jab', 'cross', 'kick'][player.combo]; }
  player.lastHit = now; const m = MELEE[kind]; player.atk = { kind, t: 0, dur: m.dur, hit: false };
}
function meleeImpact(kind) {
  const m = MELEE[kind], px = player.pos.x, pz = player.pos.z; let any = false;
  for (const p of peds) {
    if (p.state === 'dead' || p.state === 'down') continue;
    const dx = p.pos.x - px, dz = p.pos.z - pz, d = Math.hypot(dx, dz);
    if (d > m.reach || Math.abs(wrapA(Math.atan2(dx, dz) - player.heading)) > m.arc) continue;
    any = true; hitPed(p, dx / (d || 1), dz / (d || 1), m.dmg, m.ko, true);
    if (kind !== 'bat') break;
  }
  for (const pr of propsNear(px, pz, m.reach + 1)) {
    if (pr.broken) continue; const dx = pr.x - px, dz = pr.z - pz, d = Math.hypot(dx, dz);
    if (d > m.reach + pr.r || Math.abs(wrapA(Math.atan2(dx, dz) - player.heading)) > m.arc) continue;
    if (kind === 'bat' || (kind === 'kick' && pr.k.melee === 'kick')) { breakProp(pr, dx / (d || 1) * 5, dz / (d || 1) * 5, true, 'melee'); any = true; }
    else { sfx.clang(0.3); any = true; }
  }
  for (const v of vehicles) {
    if (v.dead || v === player.car) continue; const dx = v.pos.x - px, dz = v.pos.z - pz, d = Math.hypot(dx, dz);
    if (d > m.reach + v.t.wid * 0.6 || Math.abs(wrapA(Math.atan2(dx, dz) - player.heading)) > m.arc) continue;
    v.damage(kind === 'bat' ? 60 : 15, 'player'); any = true; sfx.clang(0.5); if (!v.driver) v.alarmT = 10;
    if (v.driver === 'ai' && R() < 0.4) { const ped = ejectDriver(v, false); v.driver = null; v.ai = null; ped.state = 'fight'; ped.target = 'player'; ped.timer = 14; shout(ped, pR(SAY.fight)); }
    break;
  }
  if (any) { if (kind === 'bat') sfx.thud(0.9); else sfx.punch(); cam.shake = Math.max(cam.shake, kind === 'bat' ? 0.25 : 0.12); }
  else sfx.whoosh();
}
function hitPed(p, nx, nz, dmg, ko, byPlayer) {
  p.health -= dmg;
  for (let i = 0; i < 2; i++) fx.spawn('hit', p.pos.x, p.pos.y + 1.4, p.pos.z);
  if (byPlayer) { crime(p.cop ? 'hitcop' : 'hurt', p.pos.x, p.pos.z); if (!p.dropped && R() < 0.35) { p.dropped = true; addPickup('money', p.pos.x, p.pos.z, { amount: Math.floor(rR(5, 40)), ttl: 30 }); } }
  if (p.health <= 0 || ko) { const was = p.health; p.health = Math.min(p.health, Math.max(p.health, 1)); if (was <= 0) p.health = was; knockPed(p, nx * (ko ? 7 : 4), nz * (ko ? 7 : 4), 0, false); if (byPlayer) { game.stats.ko++; crime(was <= 0 ? 'kill' : 'hurt', p.pos.x, p.pos.z); } shout(p, pR(SAY.hurt)); return; }
  p.prev = p.state === 'fight' || p.state === 'cop' ? p.state : p.prev; p.state = 'stagger'; p.timer = 0.45; p.vx = nx * 3.5; p.vz = nz * 3.5; p.attacker = byPlayer ? 'player' : p.attacker;
  shout(p, pR(SAY.hurt));
}
const batGeo = new THREE.CylinderGeometry(0.045, 0.026, 0.86, 8); batGeo.translate(0, 0.43, 0);
const batMat = new THREE.MeshPhongMaterial({ color: 0xb98a55, specular: 0x333333, shininess: 40 });
const gunGeo = new THREE.BoxGeometry(0.06, 0.12, 0.24); gunGeo.translate(0, 0, 0.08);
const gunMat = new THREE.MeshPhongMaterial({ color: 0x1a1a1c, specular: 0x777777, shininess: 80 });
function attachHeld() {
  const h = player.human; if (!h || h.held) return;
  const bat = new THREE.Mesh(batGeo, batMat); bat.position.set(0, -0.3, 0.02); bat.rotation.x = Math.PI / 2 + 0.3; bat.castShadow = true; h.elbowR.add(bat);
  const gun = new THREE.Mesh(gunGeo, gunMat); gun.position.set(0, -0.32, 0.04); gun.rotation.x = Math.PI / 2; h.elbowR.add(gun);
  h.held = { bat, gun };
}
function updateHeld() { const h = player.human; if (!h || !h.held) return; h.held.bat.visible = player.weapon === 2; h.held.gun.visible = player.weapon === 1; }
function animAttack(h, atk) {
  const t = atk.t / atk.dur, s = Math.sin(t * Math.PI);
  if (atk.kind === 'jab') { h.armR.rotation.x = -1.55 * s - 0.1; h.elbowR.rotation.x = -1.3 * (1 - s); h.body.rotation.y = -0.25 * s; }
  else if (atk.kind === 'cross') { h.armL.rotation.x = -1.55 * s - 0.1; h.elbowL.rotation.x = -1.3 * (1 - s); h.body.rotation.y = 0.35 * s; }
  else if (atk.kind === 'kick') { h.legR.rotation.x = -1.7 * s; h.kneeR.rotation.x = 0.9 * (1 - s); h.legL.rotation.x = 0.15 * s; h.body.rotation.x = -0.2 * s; h.armL.rotation.x = 0.6 * s; }
  else if (atk.kind === 'bat') { const w = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65; h.armR.rotation.x = -1.4; h.elbowR.rotation.x = -0.4; h.body.rotation.y = lerp(1.0, -1.1, t < 0.35 ? 0 : (t - 0.35) / 0.4); h.armR.rotation.z = 0.5 * w; h.armL.rotation.x = -1.2; }
}
function updatePlayerAttack(dt) {
  const a = player.atk; if (!a) return;
  a.t += dt;
  const impactAt = a.kind === 'bat' ? 0.45 : 0.5;
  if (!a.hit && a.t / a.dur >= impactAt) { a.hit = true; meleeImpact(a.kind); }
  if (a.t >= a.dur) { player.atk = null; const h = player.human; h.body.rotation.x = 0; h.armR.rotation.z = 0.08; }
}

// ---------- pedestrian behaviours ----------
function moveFree(p, tx, tz, speed, dt, away) {
  let want = Math.atan2(tx - p.pos.x, tz - p.pos.z); if (away) want += Math.PI;
  p.heading += wrapA(want - p.heading) * Math.min(1, dt * 6);
  p.pos.x += Math.sin(p.heading) * speed * dt; p.pos.z += Math.cos(p.heading) * speed * dt;
  const hit = collideWorld(p.pos.x, p.pos.z, 0.4, p.pos.y + 0.5); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; if (away) p.heading += 0.8; }
  propCollideCircle(p.pos, 0.4);
  p.pos.y = surfH(p.pos.x, p.pos.z); p.phase += dt * speed * 2.6; animHuman(p.h, p.phase, speed > 3 ? 1.3 : 1, 0); p.h.g.rotation.set(0, p.heading, 0);
}
function targetPos(t) { return t === 'player' ? player.pos : t && t.pos; }
function pedPunch(p, dt) {
  p.atkT = (p.atkT || 0) - dt; if (p.atkT > 0) { const k = 1 - p.atkT / 0.9; if (k < 0.4) { const s = Math.sin(k / 0.4 * Math.PI); p.h.armR.rotation.x = -1.5 * s - 0.1; p.h.elbowR.rotation.x = -1.2 * (1 - s); } return false; }
  p.atkT = rR(0.8, 1.2); return true;
}
// returns true if the ped was removed
function updatePedBehaviour(p, dt, far) {
  const st = p.state;
  if (st === 'stagger') {
    p.timer -= dt; p.pos.x += p.vx * dt; p.pos.z += p.vz * dt; p.vx *= Math.exp(-6 * dt); p.vz *= Math.exp(-6 * dt);
    const hit = collideWorld(p.pos.x, p.pos.z, 0.4); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; }
    p.pos.y = surfH(p.pos.x, p.pos.z); animHuman(p.h, 0, 0, 0); p.h.g.rotation.set(-0.3 * Math.sin(p.timer / 0.45 * Math.PI), p.heading, 0);
    if (p.timer <= 0) {
      p.h.g.rotation.x = 0;
      if (p.cop && wantedLevel() > 0) p.state = 'cop';
      else if (p.prev === 'fight' || ((p.tough || p.prev === 'cop') && p.attacker === 'player' && !player.car)) { p.state = 'fight'; p.target = p.prev === 'fight' && p.target ? p.target : 'player'; p.timer = 15; if (p.target === 'player') shout(p, pR(SAY.fight)); }
      else { p.state = 'flee'; p.timer = 8; const tp = targetPos(p.attacker || 'player'); if (tp) p.heading = Math.atan2(p.pos.x - tp.x, p.pos.z - tp.z); }
      p.prev = null;
    }
    return false;
  }
  if (st === 'fight') {
    const tp = targetPos(p.target); p.timer -= dt;
    const invalid = !tp || (p.target === 'player' ? (player.dead || player.car) : (p.target.state === 'down' || p.target.state === 'dead' || !p.target.h.g.parent));
    if (invalid || p.timer <= 0 || d2(tp.x, tp.z, p.pos.x, p.pos.z) > 35 * 35) { p.state = 'flee'; p.timer = 6; p.calm = true; if (p.target !== 'player' && p.target && (p.target.state === 'down' || p.target.state === 'dead')) shout(p, pR(['I no tornis!', 'Això et passa per llest!'])); return false; }
    const d = Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z);
    if (d > 1.15) moveFree(p, tp.x, tp.z, d > 4 ? 4.2 : 2, dt);
    else {
      p.heading = Math.atan2(tp.x - p.pos.x, tp.z - p.pos.z); p.h.g.rotation.set(0, p.heading, 0); animHuman(p.h, 0, 0, 0); p.h.armL.rotation.x = -0.9; p.h.elbowL.rotation.x = -1.6;
      if (pedPunch(p, dt)) {
        sfx.punch();
        if (p.target === 'player') { hurtPlayer(rR(4, 8), p.pos.x, p.pos.z); fx.spawn('hit', player.pos.x, player.pos.y + 1.4, player.pos.z); }
        else { const t = p.target; const nx = (t.pos.x - p.pos.x) / (d || 1), nz = (t.pos.z - p.pos.z) / (d || 1); hitPed(t, nx, nz, rR(6, 11), t.health < 12, false); if (t.state === 'stagger') { t.attacker = p; t.prev = 'fight'; t.target = p; } }
      }
    }
    return false;
  }
  if (st === 'cop') {
    if (wantedLevel() === 0 || far > 120 * 120) { p.state = 'flee'; p.timer = 3; p.calm = true; return false; }
    const tg = player.car ? player.car.pos : player.pos, d = Math.hypot(tg.x - p.pos.x, tg.z - p.pos.z);
    if (player.car && d > 30) { p.state = 'flee'; p.timer = 3; p.calm = true; return false; }
    if (d > 1.3) moveFree(p, tg.x, tg.z, d > 6 ? 6.2 : 3, dt);
    else { p.heading = Math.atan2(tg.x - p.pos.x, tg.z - p.pos.z); animHuman(p.h, 0, 0, 0); p.h.g.rotation.set(0, p.heading, 0); if (!player.car && pedPunch(p, dt)) { hurtPlayer(4, p.pos.x, p.pos.z); sfx.punch(); } }
    p.shootT = (p.shootT || 2) - dt;
    if (wantedLevel() >= 2 && d > 4 && d < 24 && p.shootT < 0) {
      p.shootT = rR(1.1, 1.7); p.h.armR.rotation.x = -Math.PI / 2;
      if (los(p.pos.x, p.pos.z, tg.x, tg.z, 1.5)) { const hit = R() < 0.35; tracer(p.pos.x, p.pos.y + 1.45, p.pos.z, tg.x + (hit ? 0 : rR(-1.5, 1.5)), tg.y + 1.2, tg.z + (hit ? 0 : rR(-1.5, 1.5)), 0xffd0a0); if (AU.ctx) noiseHit(AU.ctx.currentTime, 0.15, 1500, 0.7, 0.3, 'lowpass'); if (hit) { if (player.car) player.car.damage(20); else hurtPlayer(6, p.pos.x, p.pos.z); } }
    }
    if (R() < dt * 0.25) shout(p, pR(SAY.cop));
    return false;
  }
  if (st === 'thief') {
    const vic = p.target, from = vic && vic.pos ? vic.pos : player.pos;
    moveFree(p, from.x, from.z, 6.3, dt, true); p.timer -= dt;
    if (p.timer < 0 && far > 70 * 70) { removePed(p); return true; }
    return false;
  }
  if (st === 'chase') {
    const t = p.target; if (!t || !t.h.g.parent || t.state === 'down' || t.state === 'dead' || d2(t.pos.x, t.pos.z, p.pos.x, p.pos.z) > 45 * 45) { p.state = 'flee'; p.timer = 4; p.calm = true; if (t && (t.state === 'down' || t.state === 'dead')) shout(p, pR(['Gràcies!', 'Ben fet!'])); return false; }
    moveFree(p, t.pos.x, t.pos.z, 5.4, dt); if (R() < dt * 0.4) shout(p, pR(SAY.thief));
    return false;
  }
  if (st === 'idle' || st === 'watch') {
    p.timer -= dt; animHuman(p.h, 0, 0, 0);
    const ph = now * 0.003 + p.phase;
    if (st === 'idle') { p.h.armR.rotation.x = -0.35 - 0.35 * Math.max(0, Math.sin(ph * 1.7)); p.h.elbowR.rotation.x = -1.1 - 0.3 * Math.sin(ph * 2.3); if (R() < dt * 0.03) shout(p, pR(SAY.chat)); }
    else { p.h.armR.rotation.x = -0.5 * Math.max(0, Math.sin(ph * 4)); if (R() < dt * 0.1) shout(p, pR(['Uooo!', 'Dóna-li!', 'Prou, prou!', 'Truqueu la policia!'])); }
    if (p.face !== undefined) { p.heading += wrapA(p.face - p.heading) * Math.min(1, dt * 4); p.h.g.rotation.set(0, p.heading, 0); }
    if (p.timer <= 0) { if (p.loop) { p.state = 'walk'; } else { p.state = 'flee'; p.timer = 4; p.calm = true; } }
    return false;
  }
  if (st === 'perform') { performAnim(p, dt); return false; }
  return false;
}
function performAnim(p, dt) {
  const h = p.h, t = now * 0.001 + p.phase;
  animHuman(h, 0, 0, 0); h.g.rotation.set(0, p.heading, 0);
  if (p.act === 'statue') { const bow = p.bowT > 0 ? Math.sin((1 - p.bowT / 2) * Math.PI) : 0; p.bowT = (p.bowT || 0) - dt; h.armR.rotation.x = -2.7 + bow * 2; h.armL.rotation.x = -0.4; h.body.rotation.x = bow * 0.6;
    if (p.bowT < -6 && d2(player.pos.x, player.pos.z, p.pos.x, p.pos.z) < 6 * 6 && !player.car) { p.bowT = 2; shout(p, pR(['Gràcies!', '...', 'Una moneda?'])); } }
  else if (p.act === 'busker') { h.legL.rotation.x = h.legR.rotation.x = -1.45; h.kneeL.rotation.x = h.kneeR.rotation.x = 1.5; h.body.position.y = -0.45; h.armR.rotation.x = -0.6 + 0.18 * Math.sin(t * 22); h.elbowR.rotation.x = -1.3; h.armL.rotation.x = -1.0; h.elbowL.rotation.x = -1.5; }
  else if (p.act === 'dancer') { h.armL.rotation.x = -2.2 + Math.sin(t * 6.5) * 0.7; h.armR.rotation.x = -2.2 - Math.sin(t * 6.5) * 0.7; h.elbowL.rotation.x = h.elbowR.rotation.x = -0.6; h.body.rotation.y = Math.sin(t * 3.25) * 0.7; h.body.position.y = Math.abs(Math.sin(t * 6.5)) * 0.08; h.legL.rotation.x = -Math.max(0, Math.sin(t * 6.5)) * 0.6; h.kneeL.rotation.x = -h.legL.rotation.x * 1.4; h.legR.rotation.x = -Math.max(0, -Math.sin(t * 6.5)) * 0.6; h.kneeR.rotation.x = -h.legR.rotation.x * 1.4; }
}

// ---------- street events ----------
let eventT = 12;
function walkingPedsNear(minD, maxD) { return peds.filter(q => q.state === 'walk' && !q.cop && !q.fixed && (() => { const d = d2(q.pos.x, q.pos.z, player.pos.x, player.pos.z); return d > minD * minD && d < maxD * maxD; })()); }
function startPedFight() {
  const cand = walkingPedsNear(8, 55); for (const a of cand) {
    const b = cand.find(q => q !== a && d2(q.pos.x, q.pos.z, a.pos.x, a.pos.z) < 14 * 14); if (!b) continue;
    a.state = b.state = 'fight'; a.target = b; b.target = a; a.timer = b.timer = 20; game.stats.fights++;
    shout(a, pR(SAY.fight)); setTimeout(() => shout(b, pR(SAY.fight)), 900);
    const mx = (a.pos.x + b.pos.x) / 2, mz = (a.pos.z + b.pos.z) / 2;
    for (const w of peds) if (w.state === 'walk' && !w.fixed && d2(w.pos.x, w.pos.z, mx, mz) < 18 * 18 && R() < 0.6) { w.state = 'watch'; w.timer = rR(8, 14); w.face = Math.atan2(mx - w.pos.x, mz - w.pos.z); }
    return true;
  }
  return false;
}
function startSnatch() {
  const cand = walkingPedsNear(10, 60); for (const a of cand) {
    const b = cand.find(q => q !== a && d2(q.pos.x, q.pos.z, a.pos.x, a.pos.z) < 6 * 6); if (!b) continue;
    a.state = 'thief'; a.target = b; a.timer = 12; a.thief = true; a.heading = Math.atan2(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    b.state = 'chase'; b.target = a; shout(b, pR(SAY.thief)); game.stats.snatch++;
    if (d2(a.pos.x, a.pos.z, player.pos.x, player.pos.z) < 45 * 45) toast('A bag snatcher! Knock him down for a reward.', 3500);
    return true;
  }
  return false;
}
function spawnGroup() {
  const px = player.pos.x, pz = player.pos.z, ls = loopHash.query(px - 60, pz - 60, px + 60, pz + 60, []); if (!ls.length) return false;
  const l = pR(ls), t = R() * l.tot; loopPoint(l, t, _lp); if (d2(_lp[0], _lp[1], px, pz) < 20 * 20) return false;
  const n = 2 + (R() < 0.4 ? 1 : 0), cx = _lp[0], cz = _lp[1];
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + R(), x = cx + Math.cos(a) * 0.75, z = cz + Math.sin(a) * 0.75;
    const h = makeHuman(randomLook()); const p = newPed(h, x, z, l.y, l, t); p.state = 'idle'; p.timer = rR(25, 60); p.face = Math.atan2(cx - x, cz - z); p.heading = p.face;
  }
  return true;
}
function newPed(h, x, z, yOff, loop, t) {
  const p = { h, pos: new THREE.Vector3(x, groundH(x, z) + (yOff || 0), z), heading: 0, loop, t: t || 0, dir: R() < 0.5 ? 1 : -1, speed: rR(1.15, 1.6) * h.gait, state: 'walk', health: 40, timer: 0, phase: R() * 6, vx: 0, vz: 0, vy: 0, dropped: false, tough: h.gait >= 0.9 && R() < 0.22 };
  h.voice = rR(140, 260); peds.push(p); return p;
}
function updateEvents(dt) {
  eventT -= dt; if (eventT > 0) return;
  eventT = rR(14, 28);
  if (player.car && Math.abs(player.car.speed) > 18) return;
  const r = R(); (r < 0.35 ? startPedFight() : r < 0.65 ? startSnatch() : spawnGroup()) || spawnGroup();
}
// police get out of their cars when you are on foot
function updateFootCops() {
  if (wantedLevel() === 0 || player.car) return;
  let n = 0; for (const p of peds) if (p.cop && p.state === 'cop') n++;
  if (n >= 4) return;
  for (const v of vehicles) {
    if (v.driver !== 'cop' || !v.ai || v.ai.mode !== 'cop' || v.copOut || v.dead) continue;
    if (d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z) < 26 * 26 && Math.abs(v.speed) < 2.5) {
      v.copOut = true; v.ai = { mode: 'idle' };
      for (let k = 0; k < (wantedLevel() > 1 ? 2 : 1) && n < 4; k++, n++) { const c = ejectDriver(v, true); c.state = 'cop'; c.health = 60; c.cop = true; if (k) { c.pos.x -= Math.cos(v.heading) * 2.4; c.pos.z += Math.sin(v.heading) * 2.4; } shout(c, pR(SAY.cop)); }
      break;
    }
  }
}
function footCopNear(x, z, r) { for (const p of peds) if (p.cop && p.state === 'cop' && d2(p.pos.x, p.pos.z, x, z) < r * r) return p; return null; }

// ---------- performers on La Rambla ----------
const PERFORMERS = [{ act: 'statue', x: -160, z: 276, h: 0 }, { act: 'busker', x: -158.5, z: 318, h: Math.PI / 2 }, { act: 'dancer', x: -161, z: 322, h: Math.PI / 2 }];
let perfT = 0;
function updatePerformers(dt) {
  perfT -= dt; if (perfT > 0) return; perfT = 2;
  for (const pf of PERFORMERS) {
    if (pf.ped && pf.ped.h.g.parent && pf.ped.state === 'perform') continue;
    if (pf.ped && pf.ped.h.g.parent) continue;              // knocked over or fled: wait until it despawns
    if (d2(pf.x, pf.z, player.pos.x, player.pos.z) < 90 * 90 && pf.ped) continue;
    const look = pf.act === 'statue' ? { skin: '#c9a24a', shirt: '#c9a24a', pants: '#c9a24a', hair: '#b8923a', hairStyle: 'short', shoes: '#b8923a', cap: '#c9a24a', build: 1.05 } : pf.act === 'busker' ? Object.assign(randomLook(), { hairStyle: 'curly', jacket: '#5a3a22' }) : Object.assign(randomLook(), { shirt: '#d6372b', skirt: null, shorts: false });
    const h = makeHuman(look); const p = newPed(h, pf.x, pf.z, CURB, null, 0); p.state = 'perform'; p.act = pf.act; p.heading = pf.h; p.fixed = true; p.pos.y = CURB + (pf.act === 'statue' ? 0.6 : 0); pf.ped = p;
    if (!pf.prop) {
      if (pf.act === 'statue') pf.prop = mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), lam('#8f877a'), pf.x, CURB + 0.3, pf.z);
      else if (pf.act === 'busker') { pf.prop = mesh(new THREE.BoxGeometry(0.5, 0.42, 0.5), lam('#5a4a3a'), pf.x - 0.15, CURB + 0.21, pf.z); const gtr = mesh(new THREE.BoxGeometry(0.12, 0.42, 0.85), lam('#b07a3a'), pf.x + 0.18, CURB + 0.95, pf.z); gtr.rotation.x = 0.9; gtr.rotation.y = Math.PI / 2; pf.gtr = gtr; const hat = mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.08, 10), lam('#2a2420'), pf.x + 0.9, CURB + 0.04, pf.z); }
    }
  }
}
const busk = { next: 0, step: 0 };
function buskerMusic() {
  if (!AU.ctx || !AU.busk) return;
  const pf = PERFORMERS[1], ok = pf.ped && pf.ped.state === 'perform' && pf.ped.h.g.parent;
  const d = Math.hypot(player.pos.x - pf.x, player.pos.z - pf.z), c = AU.ctx;
  AU.busk.gain.setTargetAtTime(ok && !player.car ? 0.5 * clamp(1 - d / 32, 0, 1) : 0, c.currentTime, 0.2);
  if (!ok || d > 34) { busk.next = 0; return; }
  const spb = 60 / 120 / 4; if (busk.next < c.currentTime) busk.next = c.currentTime + 0.05;
  while (busk.next < c.currentTime + 0.25) {
    const bar = Math.floor(busk.step / 16) % 4, i = busk.step % 16, ch = [[57, 60, 64, 69], [55, 59, 62, 67], [53, 57, 60, 65], [52, 56, 59, 64]][bar];
    if ([0, 3, 6, 8, 11, 14].includes(i)) { const down = [0, 6, 8, 14].includes(i); ch.forEach((m, k) => tone(busk.next + (down ? k : 3 - k) * 0.014, mtof(m), 0.45, 'sawtooth', down ? 0.05 : 0.03, AU.busk, null, 2200)); }
    if ([4, 12].includes(i)) noiseHit(busk.next, 0.05, 1800, 1, 0.08, 'bandpass', AU.busk);
    busk.step = (busk.step + 1) % 64; busk.next += spb;
  }
}

// ---------- pigeons and gulls ----------
const FLOCKS = [[-150, 166, 'pigeon'], [-160, 350, 'pigeon'], [-124, 356, 'pigeon'], [-55, 308, 'pigeon'], [240, -280, 'pigeon'], [-100, -716, 'pigeon'], [420, 480, 'gull'], [-60, 470, 'gull']];
const birds = []; let birdIM;
function buildBirds() {
  const geo = mergeColored([[G.sph, '#ffffff', 0, 0.13, 0, 0.09, 0.08, 0.15], [G.sph, '#ffffff', 0, 0.21, 0.12, 0.055, 0.055, 0.055], [G.box, '#e8e8e8', 0, 0.16, -0.02, 0.4, 0.012, 0.11], [G.box, '#f2b34a', 0, 0.2, 0.18, 0.02, 0.015, 0.04], [G.box, '#e0e0e0', 0, 0.14, -0.17, 0.08, 0.01, 0.1]]);
  let n = 0; for (const f of FLOCKS) n += f[2] === 'gull' ? 10 : 22;
  birdIM = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), n); birdIM.frustumCulled = false; birdIM.castShadow = false; scene.add(birdIM);
  const col = new THREE.Color(); let i = 0;
  for (const [hx, hz, kind] of FLOCKS) {
    const gull = kind === 'gull', cnt = gull ? 10 : 22;
    for (let k = 0; k < cnt; k++, i++) {
      const a = R() * TAU, r = R() * 6, x = hx + Math.cos(a) * r, z = hz + Math.sin(a) * r;
      birds.push({ i, hx, hz, gull, x, z, y: gull ? rR(15, 30) : surfH(x, z), vx: 0, vy: 0, vz: 0, h: R() * TAU, st: gull ? 'fly' : 'ground', t: R() * 3, ph: R() * 6 });
      birdIM.setColorAt(i, gull ? col.setRGB(1, 1, 1) : col.setRGB(rR(0.45, 0.62), rR(0.47, 0.64), rR(0.52, 0.7)));
    }
  }
  birdIM.instanceColor.needsUpdate = true;
}
function scareBirds(x, z, r) { for (const b of birds) if (b.st === 'ground' && d2(b.x, b.z, x, z) < r * r) takeOff(b, x, z); }
function takeOff(b, x, z) { const a = Math.atan2(b.x - x, b.z - z) + rR(-0.8, 0.8); b.st = 'fly'; b.vx = Math.sin(a) * 5; b.vz = Math.cos(a) * 5; b.vy = rR(5, 8); b.t = rR(8, 14); if (AU.ctx && R() < 0.15) noiseHit(AU.ctx.currentTime, 0.4, 900, 0.6, 0.06 * clamp(1 - Math.sqrt(d2(b.x, b.z, player.pos.x, player.pos.z)) / 40, 0, 1)); }
const _bq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bs = new THREE.Vector3(), _be = new THREE.Euler();
function updateBirds(dt) {
  if (!birdIM) return; let dirty = false;
  const tg = player.car ? player.car.pos : player.pos, fast = player.car ? Math.abs(player.car.speed) > 3 : (keys.ShiftLeft || keys.ShiftRight);
  for (const b of birds) {
    if (d2(b.hx, b.hz, tg.x, tg.z) > 220 * 220) continue;
    dirty = true; b.t -= dt;
    if (b.st === 'ground') {
      const dd = d2(b.x, b.z, tg.x, tg.z); if (dd < (fast ? 9 : 3) ** 2) takeOff(b, tg.x, tg.z);
      if (b.t < 0) { b.t = rR(1, 4); b.h += rR(-1.5, 1.5); b.walk = R() < 0.5 ? rR(0.4, 1) : 0; }
      if (b.walk) { b.x += Math.sin(b.h) * 0.5 * dt; b.z += Math.cos(b.h) * 0.5 * dt; b.walk -= dt; if (b.walk < 0) b.walk = 0; if (d2(b.x, b.z, b.hx, b.hz) > 64) b.h = Math.atan2(b.hx - b.x, b.hz - b.z); }
      b.y = surfH(b.x, b.z);
      _be.set(Math.max(0, Math.sin(now * 0.012 + b.ph)) * 0.5, b.h, 0); _bs.set(0.45, 1, 1);
    } else {
      const alt = b.gull ? 22 : 14, cx = b.hx + Math.cos(now * 0.0004 * (b.gull ? 1 : 2) + b.ph) * (b.gull ? 40 : 18), cz = b.hz + Math.sin(now * 0.0004 * (b.gull ? 1 : 2) + b.ph) * (b.gull ? 40 : 18);
      const landing = !b.gull && b.t < 0 && d2(b.hx, b.hz, tg.x, tg.z) > 14 * 14;
      const tx = landing ? b.hx + Math.cos(b.ph) * 4 : cx, tz = landing ? b.hz + Math.sin(b.ph) * 4 : cz, ty = landing ? surfH(tx, tz) : alt + Math.sin(b.ph) * 4;
      b.vx += ((tx - b.x) * 0.25 - b.vx) * dt * 1.2; b.vz += ((tz - b.z) * 0.25 - b.vz) * dt * 1.2; b.vy += ((ty - b.y) * 0.6 - b.vy) * dt * 1.5;
      const sp = Math.hypot(b.vx, b.vz); if (sp > 9) { b.vx *= 9 / sp; b.vz *= 9 / sp; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.h = Math.atan2(b.vx, b.vz);
      if (landing && b.y - surfH(b.x, b.z) < 0.3) { b.st = 'ground'; b.y = surfH(b.x, b.z); b.t = rR(1, 3); }
      _be.set(-b.vy * 0.05, b.h, Math.sin(now * 0.002 + b.ph) * 0.2); _bs.set(0.6 + 0.6 * Math.abs(Math.sin(now * (b.gull ? 0.008 : 0.03) + b.ph)), 1, 1);
    }
    _bp.set(b.x, b.y, b.z); _bq.setFromEuler(_be); _m4.compose(_bp, _bq, _bs.multiplyScalar(b.gull ? 2 : 1)); birdIM.setMatrixAt(b.i, _m4);
  }
  if (dirty) birdIM.instanceMatrix.needsUpdate = true;
}

// ---------- fireworks over the sea at night ----------
const rockets = []; let fireT = 4, fwToastDay = -1;
function fireworkBurst(x, y, z, col) { for (let k = 0; k < 48; k++) { const u = R() * TAU, v = Math.acos(rR(-1, 1)), sp = rR(14, 19); fx.spawn('firework', x, y, z, { col: k % 6 ? col : 0xffffff, vx: Math.sin(v) * Math.cos(u) * sp, vy: Math.cos(v) * sp, vz: Math.sin(v) * Math.sin(u) * sp }); } }
function updateFireworks(dt) {
  const h = game.time / 60, on = h >= 22 || h < 1;
  if (on) {
    fireT -= dt;
    if (fireT < 0) { fireT = rR(1.2, 3.5); rockets.push({ x: rR(150, 650), y: 0, z: rR(470, 540), vy: rR(32, 40), fuse: rR(2.3, 3), col: pR([0xff4a3a, 0xffd23a, 0x4ab0ff, 0x6aff7a, 0xff7ae0, 0xffffff]) }); if (AU.ctx) tone(AU.ctx.currentTime, 900, 1.6, 'sine', 0.012, null, 2400);
      const day = Math.floor(game.time / 1440 + (h < 1 ? -1 : 0)); if (fwToastDay !== day && d2(player.pos.x, player.pos.z, 400, 450) < 900 * 900) { fwToastDay = day; toast('Fireworks over the Barceloneta tonight. Festa major!', 4000); } }
  }
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i]; r.y += r.vy * dt; r.vy -= 9 * dt; r.fuse -= dt;
    fx.spawn('trail', r.x, r.y, r.z);
    if (r.fuse <= 0) {
      rockets.splice(i, 1); fireworkBurst(r.x, r.y, r.z, r.col);
      const dist = Math.hypot(r.x - player.pos.x, r.z - player.pos.z); if (AU.ctx) { const t0 = AU.ctx.currentTime + dist / 343; noiseHit(t0, 0.9, 220, 0.6, 0.6 * clamp(1 - dist / 1200, 0.05, 1), 'lowpass'); }
    }
  }
}
// ---------- car alarms ----------
function updateAlarms(dt) {
  for (const v of vehicles) {
    if (!(v.alarmT > 0)) continue; v.alarmT -= dt; v.alarmB = (v.alarmB || 0) - dt;
    if (v.alarmB < 0 && AU.ctx) { v.alarmB = 0.42; const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z); if (d < 90) tone(AU.ctx.currentTime, (v.alarmF = v.alarmF === 880 ? 660 : 880), 0.3, 'square', 0.05 * clamp(1 - d / 90, 0, 1)); }
  }
}
// ---------- on-screen controls card and context prompts ----------
let controlsOn = true, ctrlKey = '';
try { controlsOn = localStorage.getItem('ciutat-comtal-controls') !== 'off'; } catch (e) { /* storage unavailable */ }
function toggleControls() { controlsOn = !controlsOn; try { localStorage.setItem('ciutat-comtal-controls', controlsOn ? 'on' : 'off'); } catch (e) { /* ignore */ } ctrlKey = ''; updateControls(); }
const K = k => `<kbd class="k">${k}</kbd>`;
function updateControls() {
  const card = $('controls'), tab = $('controls-tab');
  const mode = player.car ? 'car' : 'foot', w = player.weapon, weapons = 1 + (player.hasBat ? 1 : 0) + (player.hasPistol && player.ammo > 0 ? 1 : 0);
  const job = player.car ? (player.car.key === 'taxi' ? 'taxi' : player.car.t.police ? 'cop' : player.car.t.bus ? 'bus' : '') : '';
  const key = [controlsOn, mode, w, weapons, wantedLevel() > 0, job, !!act.run].join('|');
  if (key === ctrlKey) return; ctrlKey = key;
  card.hidden = !controlsOn; tab.hidden = controlsOn; if (!controlsOn) return;
  const atk = w === 2 ? 'Swing the bat' : w === 1 ? 'Shoot (aims for you)' : 'Punch · click 3× = jab, cross, kick';
  const rows = mode === 'car' ? [
    ['W', 'Accelerate'], ['S', 'Brake, then reverse'], ['A D', 'Steer'], ['Space', 'Handbrake / drift'], ['F', 'Get out'], ['H', 'Horn'], ['R', 'Change radio'], ...(job ? [['T', (act.run ? 'Stop ' : 'Start ') + (job === 'taxi' ? 'taxi fares' : job === 'bus' ? 'bus route' : 'vigilante job')]] : []), ['C', 'Camera distance'], ['M  P', 'Map · pause'],
  ] : [
    ['W A S D', 'Walk'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['Mouse', 'Look (click to capture)'], ['Click', atk], ['Q', weapons > 1 ? 'Switch weapon' : 'Switch weapon (find one first)', weapons < 2], ['F', 'Get in a car'], ['M  P', 'Map · pause'],
  ];
  if (wantedLevel() > 0) rows.push(['', mode === 'car' ? 'Wanted: get out of sight or find a Pinta Ràpid' : 'Wanted: run, or get a car']);
  rows.push(['I', 'Hide this card']);
  $('controls-mode').textContent = mode === 'car' ? 'Driving' : 'On foot';
  $('controls-list').innerHTML = rows.map(([k, t, dim]) => `<li${dim ? ' class="dim"' : ''}>${k ? K(k) : '<span></span>'}<span>${t}</span></li>`).join('');
}
let promptKey = '';
function setPrompt(html) { if (html === promptKey) return; promptKey = html; const el = $('prompt'); el.hidden = !html; if (html) el.innerHTML = html; }
function updatePrompt() {
  if (player.dead || game.state !== 'play') return setPrompt('');
  const fk = coarse ? K('ENTRA') : K('F');
  if (player.car) {
    const v = player.car;
    for (const s2 of SPRAY) if (d2(v.pos.x, v.pos.z, s2[0], s2[1]) < 30 * 30 && (wantedLevel() > 0 || v.health < v.t.hp * 0.95)) return setPrompt(`Pinta Ràpid: drive into the garage door to respray and repair (€100)`);
    if (v.burn >= 0) return setPrompt(`${fk} Get out now, it's on fire!`);
    if (!act.run && !mission.run && (v.key === 'taxi' || v.t.police || v.t.bus)) return setPrompt(`${K('T')} Start ${v.key === 'taxi' ? 'taxi fares' : v.t.bus ? 'the bus route' : 'vigilante job'}`);
    for (const p2 of placeMarkers) if (p2.kind === 'race' && !act.run && !mission.run && d2(p2.x, p2.z, v.pos.x, v.pos.z) < 40 * 40) return setPrompt(`Drive into the blue light to start the <b>${RACES[p2.race].name}</b> race`);
    return setPrompt('');
  }
  let best = null, bd = 4.6 * 4.6;
  for (const v of vehicles) { if (v.dead || v.burn >= 0) continue; const d = d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z); if (d < bd && Math.abs(v.pos.y - player.pos.y) < 2.5) { bd = d; best = v; } }
  if (best) return setPrompt(best.driver === 'ai' || best.driver === 'cop' ? (Math.abs(best.speed) > 6 ? '' : `${fk} Pull the driver out of the ${best.t.name}${best.driver === 'cop' ? ' (instant 2 stars)' : ''}`) : `${fk} Get in the ${best.t.name}`);
  for (const p2 of placeMarkers) if (!act.run && !mission.run && d2(p2.x, p2.z, player.pos.x, player.pos.z) < 12 * 12) { if (p2.kind === 'race') return setPrompt(`Street race: bring a car into the blue light`); if (p2.kind === 'rampage') return setPrompt(`Step into the orange light: <b>Destrucció</b> rampage`); if (!shopOpen) return setPrompt(`Step into the green light to shop`); }
  if (ride) return setPrompt(ride.kind === 'cable' ? 'Telefèric · mouse to look around' : '');
  for (const st of STATIONS_CC) if (d2(st.x, st.z, player.pos.x, player.pos.z) < 12 * 12) return setPrompt(`Step into the purple light to ride the cable car to ${st.u ? 'Barceloneta' : 'Montjuïc'} (€5)`);
  for (const st of metroSt) if (!shopOpen && d2(st.x, st.z, player.pos.x, player.pos.z) < 10 * 10) return setPrompt(`Walk down the stairs to take the metro`);
  const g = giverPos(); if (g && !mission.run && d2(g[0], g[1], player.pos.x, player.pos.z) < 14 * 14) return setPrompt(wantedLevel() > 0 ? 'Lose the police before starting this job' : `Step into the yellow light to start <b>${MISSIONS[game.mission].title}</b>`);
  const pr = propsNear(player.pos.x, player.pos.z, 2.2).find(q => !q.broken && d2(q.x, q.z, player.pos.x, player.pos.z) < 2.6 * 2.6);
  if (pr) { const can = player.weapon === 2 || pr.k.melee === 'kick'; return setPrompt(can ? `${coarse ? K('COP') : K('Click')} ${player.weapon === 2 ? 'Smash it' : 'Third hit of the combo kicks it over'}` : 'Too sturdy for fists. Find the bat, or drive through it'); }
  return setPrompt('');
}
let uiT = 0;
function updateLife(dt) {
  uiT -= dt; if (uiT <= 0) { uiT = 0.2; updateControls(); updatePrompt(); }
  updatePlayerAttack(dt); updateHeld(); updateProps(dt); updateBubbles(dt); updateEvents(dt); updateFootCops(); updatePerformers(dt);
  updateBirds(dt); updateFireworks(dt); updateAlarms(dt); buskerMusic();
}

// ====================== ACTIVITIES, POLICE TACTICS, TRAFFIC LIGHTS, DRIVING FEEL ======================
// ---------- shared activity runner (side jobs; never runs during a story mission) ----------
const act = { run: null, name: '', timer: -1, rings: [] };
function actRing(x, z, color = 0x5fb2e0) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })); m.position.set(x, surfH(x, z) + 7, z); scene.add(m); act.rings.push(m); return m; }
function actClearRings() { for (const m of act.rings) scene.remove(m); act.rings.length = 0; }
function startActivity(name, run) { if (mission.run || act.run) { run.cleanup && run.cleanup(); return false; } act.name = name; act.run = run; return true; }
function endActivity(msg, good) {
  if (!act.run) return; const r = act.run; act.run = null; act.timer = -1; actClearRings(); setObjective('');
  r.cleanup && r.cleanup(); if (msg) bigMsg(good ? act.name.toUpperCase() : 'FI DE LA FEINA', msg, !good, 3500); if (good) sfx.pass(); else sfx.fail(); writeSave();
}
function updateActivity(dt) {
  if (!act.run) return;
  if (act.timer > 0) act.timer = Math.max(0, act.timer - dt);
  const r = act.run.update(dt);
  if (r && r.end) endActivity(r.msg, r.good);
  if (player.dead && act.run) endActivity('You went down. Job over.', false);
}
// ---------- taxi fares ----------
const PLACES = [[-150, 190, 'Plaça de Catalunya'], [240, -278, 'Sagrada Família'], [320, -444, 'Hospital de Sant Pau'], [160, 118, 'Arc de Triomf'], [-120, 421, 'the Columbus column'], [246, 412, 'La Barceloneta'], [585, 282, 'the Olympic beach'], [470, 40, 'Torre Glòries'], [29, 300, 'Via Laietana'], [-440, 200, 'Sant Antoni'], [-520, -360, 'Les Corts'], [80, -520, 'Gràcia'], [700, -200, 'Poblenou'], [-280, -40, "l'Esquerra de l'Eixample"]];
function taxiJob() {
  let fare = null, dest = null, fares = 0, total = 0, ped = null, phase = 'find';
  const newFare = () => {
    const opts = lampSpots.filter(s => { const d = d2(s[0], s[1], player.pos.x, player.pos.z); return d > 110 * 110 && d < 300 * 300; });
    const s = opts.length ? pR(opts) : pR(lampSpots); fare = { x: s[0], z: s[1] }; phase = 'find';
    ped = makeHuman(randomLook()); ped.g.position.set(fare.x, CURB, fare.z); ped.g.rotation.y = R() * TAU; act.timer = -1;
    setObjective('Pick up the fare waving on the pavement (blue blip).');
  };
  newFare();
  return {
    blips: () => phase === 'find' ? [[fare.x, fare.z, '#5fb2e0']] : [[dest[0], dest[1], '#f2c230']],
    update() {
      const v = player.car;
      if (!v || v.key !== 'taxi') return { end: true, msg: `${fares} fares · €${total} earned`, good: fares > 0 };
      if (phase === 'find') {
        if (ped) { animHuman(ped, 0, 0, 0); ped.armR.rotation.x = -2.6 + Math.sin(now * 0.012) * 0.4; ped.g.rotation.y = Math.atan2(v.pos.x - fare.x, v.pos.z - fare.z); }
        if (d2(v.pos.x, v.pos.z, fare.x, fare.z) < 9 * 9 && Math.abs(v.speed) < 3) {
          disposeGroup(ped.g); ped = null; phase = 'ride';
          const far = PLACES.filter(p => d2(p[0], p[1], v.pos.x, v.pos.z) > 220 * 220); dest = pR(far.length ? far : PLACES);
          const d = Math.hypot(dest[0] - v.pos.x, dest[1] - v.pos.z); act.timer = Math.round(d / 11 + 25); act.dist = d;
          say([['Passenger', pR(['To ', 'Take me to ', 'Quick, to ', 'Bona tarda. To ']) + dest[2] + pR([', please.', '. I am late!', ', and no detours.', '.'])]]);
          setObjective(`Drive the passenger to ${dest[2]}.`); sfx.pick();
        }
      } else {
        if (act.timer <= 0) { say([['Passenger', 'Forget it, I will walk!']]); return { end: true, msg: `Too slow. ${fares} fares · €${total}`, good: fares > 0 }; }
        if (d2(v.pos.x, v.pos.z, dest[0], dest[1]) < 12 * 12 && Math.abs(v.speed) < 4) {
          fares++; const pay = Math.round(15 + act.dist * 0.09 + act.timer * 1.2) + (fares % 5 === 0 ? 250 : 0); total += pay; player.money += pay; game.stats.fares = (game.stats.fares || 0) + 1;
          toast(`Fare ${fares} paid <b>€${pay}</b>${fares % 5 === 0 ? ' (includes a €250 five-in-a-row bonus)' : ''}. Next fare on the radar.`, 3500); sfx.pick(); newFare();
        }
      }
    },
    cleanup() { if (ped) disposeGroup(ped.g); },
  };
}
// ---------- vigilante (police car) ----------
function vigilanteJob() {
  let level = 0, crook = null, total = 0;
  const next = () => {
    level++; crook = spawnTraffic(120, 230, 'traffic') || spawnOffroadCop(); if (!crook) return;
    crook.mission = true; crook.driver = 'ai'; crook.ai = { mode: 'flee', speed: 24 + level * 2 }; crook.health = crook.t.hp * 0.6; crook.crook = true;
    act.timer = 75 + level * 10; setObjective(`Level ${level}: stop the suspect in the ${crook.t.name} (red blip). Ram it until it's wrecked.`);
    say([['Radio', pR(['All units: armed robbery suspect fleeing, ', 'Suspect wanted for a jewellery heist, ', 'Hit-and-run driver spotted, '] ) + crook.t.name + '.']]);
  };
  next();
  return {
    blips: () => crook ? [[crook.pos.x, crook.pos.z, '#d9412f']] : [],
    update() {
      const v = player.car; if (!v || !v.t.police) return { end: true, msg: `Reached level ${level} · €${total}`, good: total > 0 };
      if (!crook) { next(); return; }
      if (crook.dead || crook.burn >= 0 || crook.health <= 0) { const pay = 150 * level; total += pay; player.money += pay; toast(`Suspect stopped. <b>+€${pay}</b>`, 2500); sfx.pick(); crook.mission = false; crook.driver = null; crook.ai = null; next(); return; }
      if (act.timer <= 0 || d2(crook.pos.x, crook.pos.z, v.pos.x, v.pos.z) > 420 * 420) return { end: true, msg: `The suspect escaped. Level ${level} · €${total}`, good: total > 0 };
    },
    cleanup() { if (crook) { crook.mission = false; } },
  };
}
// ---------- street races with AI rivals ----------
const RACES = [
  { name: "Volta de l'Eixample", start: [-130, -280, Math.PI / 2], cps: [[0, -280], [200, -280], [200, -160], [200, -40], [0, -40], [-200, -40], [-200, -160], [-200, -280], [0, -280], [200, -280], [200, -160], [200, -40], [0, -40], [-200, -40], [-200, -160], [-200, -275]] },
  { name: 'Pujada a Montjuïc', start: [-440, 421, -Math.PI / 2], cps: [[-520, 414], [-600, 404], [-680, 394], [-760, 391], [-820, 392], [-856, 394]] },
  { name: 'Sprint de la Platja', start: [680, -90, 0], cps: [[680, 40], [680, 120], [680, 200], [680, 268], [600, 280], [480, 280], [385, 280]] },
];
function raceJob(rc) {
  const v = player.car, rivals = [], [sxp, szp, hd] = rc.start;
  const s = Math.sin(hd), c = Math.cos(hd);
  v.pos.set(sxp, groundH(sxp, szp), szp); v.ty = v.pos.y; v.heading = hd; v.vx = v.vz = 0; cam.yaw = hd;
  const slots = [[-3.2, 0], [3.2, -7], [-3.2, -7], [3.2, 0]];
  for (let k = 0; k < 3; k++) {
    const [lat, back] = slots[k + 1], x = sxp + s * back - c * lat, z = szp + c * back + s * lat;
    const r = new Vehicle('delfi', x, z, hd, pR(['#d63a2f', '#2f7fb0', '#ececec', '#3c9a5f', '#7b4a8f'])); r.mission = true; r.driver = 'ai';
    r.ai = { mode: 'path', path: rc.cps, i: 0, speed: rR(29, 35), radius: 11, racer: true, hold: true }; rivals.push(r);
  }
  { const [lat] = slots[0]; v.pos.x = sxp - c * lat; v.pos.z = szp + s * lat; }
  let idx = 0, cd = 3.2, ring = actRing(rc.cps[0][0], rc.cps[0][1]), placed = 0, n = -1;
  const progress = (i, x, z) => i * 1e4 - Math.hypot(rc.cps[Math.min(i, rc.cps.length - 1)][0] - x, rc.cps[Math.min(i, rc.cps.length - 1)][1] - z);
  return {
    blips: () => [[rc.cps[idx][0], rc.cps[idx][1], '#5fb2e0'], ...rivals.map(r => [r.pos.x, r.pos.z, '#a7b0bd'])],
    update(dt) {
      const pv = player.car; if (!pv) return { end: true, msg: 'You left your car. Race abandoned.', good: false };
      if (cd > 0) { cd -= dt; pv.vx *= 0.7; pv.vz *= 0.7; for (const r of rivals) { r.vx = r.vz = 0; r.inT = 0; } const k = Math.ceil(cd); if (k !== n) { n = k; bigMsg(k > 0 ? String(k) : 'VA!', rc.name, false, 700); sfx.click(); } if (cd <= 0) for (const r of rivals) r.ai.hold = false; return; }
      ring.rotation.y += dt;
      if (near(rc.cps[idx][0], rc.cps[idx][1], 11)) { idx++; sfx.pick(); scene.remove(ring); if (idx >= rc.cps.length) {
        const pl = 1 + rivals.filter(r => r.ai && r.ai.i >= rc.cps.length).length, prize = [2000, 700, 250, 0][pl - 1];
        player.money += prize; game.stats.races = (game.stats.races || 0) + (pl === 1 ? 1 : 0);
        return { end: true, msg: `Position ${pl} of 4${prize ? ' · €' + prize : ''}`, good: pl <= 3 }; }
        ring = actRing(rc.cps[idx][0], rc.cps[idx][1]); }
      const me = progress(idx, pv.pos.x, pv.pos.z); const pos = 1 + rivals.filter(r => r.ai && progress(r.ai.i, r.pos.x, r.pos.z) > me).length;
      setObjective(`${rc.name} · checkpoint ${idx + 1}/${rc.cps.length} · position ${pos}/4`);
      if (rivals.every(r => r.ai && r.ai.i >= rc.cps.length)) return { end: true, msg: 'Every rival finished ahead of you.', good: false };
    },
    cleanup() { for (const r of rivals) { r.mission = false; r.ai = null; r.driver = null; } },
  };
}
// ---------- destruction rampage ----------
function rampageJob() {
  const start = game.stats.props, goal = 25; act.timer = 60;
  if (!player.hasBat) { player.hasBat = true; } player.weapon = 2; drawWeaponIcon();
  setObjective('Smash 25 things in 60 seconds: lamp posts, benches, containers, bikes, hydrants.');
  return { update() { const n = game.stats.props - start; setObjective(`Destrucció: ${n}/${goal} smashed`);
    if (n >= goal) { player.money += 1000; return { end: true, msg: `${n} things smashed in ${Math.round(60 - act.timer)} s · €1000`, good: true }; }
    if (act.timer <= 0) return { end: true, msg: `Only ${n}/${goal}. The street survives.`, good: false }; } };
}
// ---------- shops ----------
const OUTFITS = [
  { name: 'Teal jacket', look: { shirt: '#e8e3d6', jacket: '#2a7f7a', pants: '#2b3a55', shoes: '#e8e6df' } },
  { name: 'White tee and cap', look: { shirt: '#f2f0ea', pants: '#3d4f7a', cap: '#1e1e22', sleeves: false, shoes: '#1e1e22' } },
  { name: 'Black leather', look: { shirt: '#3a3a3a', jacket: '#151517', pants: '#1e1e22', shoes: '#141414' } },
  { name: 'Red tracksuit', look: { shirt: '#c23a2f', pants: '#c23a2f', shoes: '#f2f0ea' } },
  { name: 'Beach shirt and shorts', look: { shirt: '#e07a4a', pants: '#c9bfa8', shorts: true, sleeves: false, shoes: '#c9a24a' } },
  { name: 'Grey suit', look: { shirt: '#f2f0ea', jacket: '#5a5f68', tie: '#8a2f3a', pants: '#5a5f68', shoes: '#141414' } },
];
player.outfit = 0; player.armor = 0;
function setOutfit(i) {
  player.outfit = i; const old = player.human, look = Object.assign({ skin: '#c99b78', hair: '#1d1712', hairStyle: 'curly', build: 1.05, height: 1.02 }, OUTFITS[i].look);
  const h = makeHuman(look); { const pg = new THREE.Mesh(bx(0.2, 0.06, 0.02), lam('#c8a24a')); pg.position.set(0, 1.12, 0.16); if (!look.jacket) h.body.add(pg); }
  if (old) { h.g.position.copy(old.g.position); h.g.rotation.copy(old.g.rotation); h.g.visible = old.g.visible; disposeGroup(old.g); }
  player.human = h; attachHeld();
}
const STORES = [
  { kind: 'bar', icon: 'B', name: 'Bar La Torreta', at: [-80, 110.5] },
  { kind: 'bar', icon: 'B', name: 'Bar Ca la Pepa', at: [80, -129.5] },
  { kind: 'bar', icon: 'B', name: 'Xiringuito del Mar', at: [430, 300] },
  { kind: 'gun', icon: 'A', name: 'Armeria Comtal', at: [-300, 330] },
  { kind: 'clothes', icon: 'R', name: 'Roba Passeig', at: [-110.5, 0] },
];
const ACTS = [
  { kind: 'race', icon: 'C', race: 0, at: RACES[0].start }, { kind: 'race', icon: 'C', race: 1, at: RACES[1].start }, { kind: 'race', icon: 'C', race: 2, at: RACES[2].start },
  { kind: 'rampage', icon: 'D', at: [-40, -120] }, { kind: 'rampage', icon: 'D', at: [430, -290] },
];
function shopItems(sh) {
  if (sh.kind === 'metro') return metroItems(sh);
  if (sh.kind === 'bar') return [{ label: 'Entrepà i canya (full health)', cost: 10, ok: player.health < 100, buy() { player.health = 100; } }, { label: 'Cafè amb llet (+25 health)', cost: 3, ok: player.health < 100, buy() { player.health = Math.min(100, player.health + 25); } }];
  if (sh.kind === 'gun') return [
    player.hasPistol ? { label: '40 pistol rounds', cost: 80, ok: true, buy() { player.ammo += 40; } } : { label: 'Pistol + 40 rounds', cost: 300, ok: true, buy() { player.hasPistol = true; player.ammo += 40; player.weapon = 1; } },
    { label: 'Body armour (absorbs damage)', cost: 200, ok: player.armor < 100, buy() { player.armor = 100; } },
    { label: 'Baseball bat', cost: 60, ok: !player.hasBat, buy() { player.hasBat = true; player.weapon = 2; } }];
  return OUTFITS.map((o, i) => ({ label: o.name + (player.outfit === i ? ' (wearing)' : ''), cost: 50, ok: player.outfit !== i, buy() { setOutfit(i); } }));
}
const placeMarkers = [];
function buildPlaces() {
  for (const p of [...STORES, ...ACTS]) {
    const f = freeSpot(p.at[0], p.at[1], 1.2); p.x = f[0]; p.z = f[1];
    const m = new THREE.Mesh(beamGeo, beamMat.clone()); m.material.color.setHex(p.kind === 'race' ? 0x5fb2e0 : p.kind === 'rampage' ? 0xef8a2a : 0x6fd36f); m.scale.set(0.55, 0.5, 0.55); m.position.set(p.x, surfH(p.x, p.z) + 10, p.z); scene.add(m); p.mesh = m; placeMarkers.push(p);
  }
}
let shopOpen = null;
function renderShop() {
  const el = $('shop'); if (!shopOpen) { el.hidden = true; return; }
  const items = shopItems(shopOpen); el.hidden = false;
  el.innerHTML = `<h2>${shopOpen.kind === 'metro' ? 'Metro · ' : ''}${shopOpen.name}</h2><ul>${items.map((it, i) => `<li class="${it.ok && player.money >= it.cost ? '' : 'dim'}"><kbd class="k">${i + 1}</kbd><span>${it.label}</span><b>€${it.cost}</b></li>`).join('')}</ul><p>${shopOpen.kind === 'metro' ? 'Press a number to ride (€2) · walk away to close' : 'Press a number to buy · walk away to close'}</p>`;
}
function buyItem(i) {
  if (!shopOpen) return false; const it = shopItems(shopOpen)[i]; if (!it) return false;
  if (!it.ok) { toast('You already have that.', 1800); return true; }
  if (player.money < it.cost) { toast(`Not enough money: €${it.cost} needed.`, 1800); sfx.fail(); return true; }
  player.money -= it.cost; it.buy(); drawWeaponIcon(); sfx.pick(); toast(`Bought: <b>${it.label}</b>`, 2000); writeSave(); renderShop(); return true;
}
let placeT = 0;
function updatePlaces(dt) {
  for (const p of placeMarkers) p.mesh.visible = !act.run && !mission.run || p.kind !== 'race' && p.kind !== 'rampage';
  placeT -= dt; if (placeT > 0) return; placeT = 0.15;
  let open = null;
  for (const p of placeMarkers) {
    if (!near(p.x, p.z, p.kind === 'race' ? 7 : 2.2)) continue;
    if (STORES.includes(p)) { if (!player.car) open = p; }
    else if (!act.run && !mission.run && !player.dead) {
      if (wantedLevel() > 0) { setObjective('Lose the police before starting this.'); continue; }
      act.timer = -1;
      if (p.kind === 'race') { if (player.car && Math.abs(player.car.speed) < 6) { const rc = RACES[p.race]; startActivity(rc.name, raceJob(rc)); } }
      else if (p.kind === 'rampage') startActivity('Destrucció', rampageJob());
    }
  }
  if (!open && !player.car && !player.dead && !ride) for (const st of metroSt) if (near(st.x, st.z, 2.6)) open = st;
  if (open !== shopOpen) { shopOpen = open; renderShop(); }
}
// vehicle job toggle (T)
function toggleVehicleJob() {
  if (act.run) { endActivity('You ended the job.', true); return; }
  const v = player.car; if (!v || mission.run) return;
  act.timer = -1;
  if (v.key === 'taxi') { if (startActivity('Taxi', taxiJob())) toast('Taxi job started. Press T again to stop.', 2500); }
  else if (v.t.bus) { if (BUS_STOPS.length && startActivity('Bus', busJob())) toast('Bus route started. Press T again to stop.', 2500); }
  else if (v.t.police) { if (startActivity('Vigilant', vigilanteJob())) toast('Vigilante job started. Press T again to stop.', 2500); }
}

// ---------- police helicopter (4+ stars) and roadblocks (3+ stars) ----------
let heli = null;
function makeHeli() {
  const g = new THREE.Group(), white = paintMat('#f2f2f0'), blue = lam('#1d4f9c'), dark = lam('#1e1f22');
  const body = new THREE.Mesh(G.sph, white); body.scale.set(1.3, 1.2, 2.3); g.add(body);
  const stripe = new THREE.Mesh(G.sph, blue); stripe.scale.set(1.32, 0.35, 2.32); stripe.position.y = -0.2; g.add(stripe);
  const glass = new THREE.Mesh(G.sph, glassMat); glass.scale.set(1.1, 0.9, 1.2); glass.position.set(0, 0.2, 1.3); g.add(glass);
  const boom = new THREE.Mesh(bx(0.35, 0.35, 4.2), white); boom.position.set(0, 0.3, -3.6); g.add(boom);
  const fin = new THREE.Mesh(bx(0.12, 1.3, 0.8), blue); fin.position.set(0, 0.9, -5.5); g.add(fin);
  for (const sx2 of [-0.9, 0.9]) { const sk = new THREE.Mesh(bx(0.1, 0.1, 3.2), dark); sk.position.set(sx2, -1.45, 0); g.add(sk); }
  const rotor = new THREE.Group(); for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(bx(9.5, 0.06, 0.32), dark); b.rotation.y = r; rotor.add(b); } rotor.position.y = 1.35; g.add(rotor);
  const tr = new THREE.Mesh(bx(0.05, 1.6, 0.2), dark); tr.position.set(0.25, 0.9, -5.6); g.add(tr);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  const light = new THREE.SpotLight(0xf4f8ff, 0, 140, 0.22, 0.5, 1); scene.add(light); scene.add(light.target);
  scene.add(g); return { g, rotor, tr, light, vx: 0, vz: 0, y: 70, t: 0, shootT: 2 };
}
function updateHeli(dt) {
  const w = wantedLevel(), tg = player.car ? player.car.pos : player.pos;
  if (!heli && w >= 4 && !player.dead) { heli = makeHeli(); const a = R() * TAU; heli.g.position.set(tg.x + Math.cos(a) * 260, 70, tg.z + Math.sin(a) * 260); toast('Police helicopter overhead.', 2500); }
  if (!heli) { if (AU.heliG) AU.heliG.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.3); return; }
  const leaving = w < 4 || player.dead; heli.t += dt;
  const tx = leaving ? heli.g.position.x + heli.vx * 4 : tg.x + Math.cos(heli.t * 0.4) * 28, tz = leaving ? heli.g.position.z + heli.vz * 4 : tg.z + Math.sin(heli.t * 0.4) * 28;
  const ty = Math.max(groundH(heli.g.position.x, heli.g.position.z) + 40, leaving ? 120 : tg.y + 42);
  heli.vx += ((tx - heli.g.position.x) * 0.5 - heli.vx) * dt * 0.9; heli.vz += ((tz - heli.g.position.z) * 0.5 - heli.vz) * dt * 0.9;
  const sp = Math.hypot(heli.vx, heli.vz); if (sp > 34) { heli.vx *= 34 / sp; heli.vz *= 34 / sp; }
  heli.g.position.x += heli.vx * dt; heli.g.position.z += heli.vz * dt; heli.g.position.y += (ty - heli.g.position.y) * dt * 0.8;
  heli.g.rotation.set(clamp(sp * 0.012, 0, 0.3), Math.atan2(tg.x - heli.g.position.x, tg.z - heli.g.position.z), 0, 'YXZ');
  heli.rotor.rotation.y += dt * 30; heli.tr.rotation.x += dt * 40;
  const d = Math.hypot(tg.x - heli.g.position.x, tg.z - heli.g.position.z);
  heli.light.position.copy(heli.g.position); heli.light.target.position.copy(tg); heli.light.intensity = leaving ? 0 : 3.5 * smooth(0.3, 0.7, nightAmt);
  if (AU.heliG) AU.heliG.gain.setTargetAtTime(0.18 * clamp(1 - Math.hypot(d, heli.g.position.y - tg.y) / 300, 0, 1), AU.ctx.currentTime, 0.2);
  heli.shootT -= dt;
  if (!leaving && w >= 5 && d < 60 && heli.shootT < 0) { heli.shootT = rR(1.2, 1.8); const hit = R() < 0.3; tracer(heli.g.position.x, heli.g.position.y - 1, heli.g.position.z, tg.x + (hit ? 0 : rR(-2, 2)), tg.y + 1, tg.z + (hit ? 0 : rR(-2, 2)), 0xffd0a0); if (AU.ctx) noiseHit(AU.ctx.currentTime, 0.15, 1500, 0.7, 0.3, 'lowpass'); if (hit) { if (player.car) player.car.damage(30); else hurtPlayer(8); } }
  if (leaving && d > 450) { scene.remove(heli.g); scene.remove(heli.light); scene.remove(heli.light.target); heli = null; }
}
const heliSees = () => heli && wantedLevel() >= 4 && Math.hypot((player.car ? player.car.pos : player.pos).x - heli.g.position.x, (player.car ? player.car.pos : player.pos).z - heli.g.position.z) < 150;
let roadblockT = 6;
function updateRoadblocks(dt) {
  const v = player.car;
  for (const c of vehicles) if (c.roadblock && c.ai && c.ai.mode === 'block' && v && d2(c.pos.x, c.pos.z, v.pos.x, v.pos.z) < 28 * 28) c.ai = { mode: 'cop' };
  if (wantedLevel() < 3 || !v || Math.abs(v.speed) < 8 || !inGrid(v.pos.x, v.pos.z)) return;
  roadblockT -= dt; if (roadblockT > 0) return; roadblockT = rR(18, 26);
  const hx = Math.sin(v.heading), hz = Math.cos(v.heading), horiz = Math.abs(hx) > Math.abs(hz);
  const n = nearestNode(v.pos.x + hx * 150, v.pos.z + hz * 150); if (!nodeOK(n[0], n[1])) return;
  const nx = sx(n[0]), nz = sz(n[1]), back = 15;
  const bxp = horiz ? nx - Math.sign(hx) * back : nx, bzp = horiz ? nz : nz - Math.sign(hz) * back;
  if (d2(bxp, bzp, v.pos.x, v.pos.z) < 90 * 90 || onDiag(bxp, bzp, 20)) return;
  for (const off of [-3.4, 3.4]) {
    const x = horiz ? bxp : bxp + off, z = horiz ? bzp + off : bzp; if (collideWorld(x, z, 1.5) || vehicles.some(o => d2(o.pos.x, o.pos.z, x, z) < 16)) continue;
    const c = new Vehicle('patrulla', x, z, horiz ? 0 : Math.PI / 2); c.driver = 'cop'; c.ai = { mode: 'block' }; c.roadblock = true; c.inHB = true;
  }
}
// ---------- traffic lights ----------
const lights = []; let lightIM = null, lightBoxIM = null;
function buildTrafficLights() {
  const spots = [];
  for (let si = SI0; si <= SI1; si++) for (let sj = SJ0; sj <= SJ1; sj++) {
    if (!nodeOK(si, sj)) continue; const x0 = sx(si), z0 = sz(sj), hd = (sj & 1) ? -1 : 1, vd = (si & 1) ? -1 : 1;
    if (nodeOK(si - hd, sj)) { const x = x0 - hd * 20, z = z0 + hd * 10.2; if (onSidewalk(x, z) && !solidAt(x, z) && !onDiag(x0, z0, 34)) spots.push({ si, sj, h: true, x, z, rot: Math.atan2(-hd, 0) }); }
    if (nodeOK(si, sj - vd)) { const x = x0 - vd * 10.2, z = z0 - vd * 20; if (onSidewalk(x, z) && !solidAt(x, z) && !onDiag(x0, z0, 34)) spots.push({ si, sj, h: false, x, z, rot: Math.atan2(0, -vd) }); }
  }
  const pole = mergeColored([[G.cyl, '#2b3036', 0, 1.7, 0, 0.07, 3.4, 0.07], [G.box, '#1e2023', 0, 3.6, 0, 0.36, 1.05, 0.3]]);
  lightBoxIM = new THREE.InstancedMesh(pole, coreMat, spots.length); lightBoxIM.castShadow = true;
  lightIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  spots.forEach((s, i) => { q.setFromAxisAngle(THREE.Object3D.DefaultUp, s.rot); m.compose(new THREE.Vector3(s.x, CURB, s.z), q, one); lightBoxIM.setMatrixAt(i, m); s.i = i; s.q = q.clone(); s.st = ''; lights.push(s); });
  scene.add(lightBoxIM); scene.add(lightIM); setLights(true);
}
function lightState(si, sj, horiz) { const t = ((simClock + (si + sj) * 2.2) % 26 + 26) % 26; if (horiz) return t < 10 ? 'g' : t < 13 ? 'a' : 'r'; return t < 13 ? 'r' : t < 23 ? 'g' : 'a'; }
let simClock = 0, lightT = 0;
const LCOL = { g: new THREE.Color(0x3cff6a), a: new THREE.Color(0xffb020), r: new THREE.Color(0xff2a1a) };
function setLights(force) {
  if (!lightIM) return; const m = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(); let dirty = false;
  for (const s of lights) { const st = lightState(s.si, s.sj, s.h); if (st === s.st && !force) continue; s.st = st; dirty = true;
    const y = CURB + 3.6 + (st === 'r' ? 0.32 : st === 'a' ? 0 : -0.32), lx = Math.sin(s.rot) * 0.16, lz = Math.cos(s.rot) * 0.16;
    p.set(s.x + lx, y, s.z + lz); m.compose(p, s.q, one); lightIM.setMatrixAt(s.i, m); lightIM.setColorAt(s.i, LCOL[st]); }
  if (dirty) { lightIM.instanceMatrix.needsUpdate = true; lightIM.instanceColor.needsUpdate = true; }
}
function updateLights(dt) { simClock += dt; lightT -= dt; if (lightT < 0) { lightT = 0.25; setLights(false); } }

// ---------- driving feel: skid marks, tyre smoke, squeal ----------
const SKID_N = 900; let skidIM = null, skidI = 0;
function buildSkids() {
  const g = new THREE.PlaneGeometry(0.24, 0.55); g.rotateX(-Math.PI / 2);
  skidIM = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x0c0c0c, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), SKID_N);
  skidIM.frustumCulled = false; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < SKID_N; i++) skidIM.setMatrixAt(i, z); scene.add(skidIM);
}
const _sq = new THREE.Quaternion(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3(1, 1, 1), _sm = new THREE.Matrix4();
function updateTyres(dt) {
  let squeal = 0, dirty = false;
  for (const v of vehicles) {
    if (v.dead || v.air || v.t.moto || v.t.boat || !v.driver || d2(v.pos.x, v.pos.z, camera.position.x, camera.position.z) > 120 * 120) continue;
    const s = Math.sin(v.heading), c = Math.cos(v.heading), fwd = v.vx * s + v.vz * c, lat = Math.abs(-v.vx * c + v.vz * s);
    const slip = lat + (v.inHB && Math.abs(fwd) > 6 ? 5 : 0) + (v.inT < -0.5 && fwd > 9 ? 4 : 0) + (v.inT > 0.8 && Math.abs(fwd) < 6 && v.driver === 'player' ? 3 : 0);
    if (v.driver === 'player') squeal = slip;
    if (slip < 3.5) { v.lastSkid = null; continue; }
    const back = -v.t.len * 0.32, y = v.pos.y + 0.03;
    for (const side of [-1, 1]) {
      const wx = v.pos.x + s * back - c * side * v.t.wid * 0.42, wz = v.pos.z + c * back + s * side * v.t.wid * 0.42;
      const key = side < 0 ? 'l' : 'r'; v.skidLast = v.skidLast || {};
      const lp = v.skidLast[key]; if (lp && d2(lp[0], lp[1], wx, wz) < 0.35 * 0.35) continue; v.skidLast[key] = [wx, wz];
      _sq.setFromAxisAngle(THREE.Object3D.DefaultUp, Math.atan2(v.vx, v.vz)); _sp.set(wx, groundH(wx, wz) + (onSidewalk(wx, wz) ? CURB : 0) + 0.025, wz);
      _sm.compose(_sp, _sq, _ss); skidIM.setMatrixAt(skidI, _sm); skidI = (skidI + 1) % SKID_N; dirty = true;
      if (R() < 0.25) fx.spawn('tyre', wx, y + 0.3, wz);
    }
  }
  if (dirty) skidIM.instanceMatrix.needsUpdate = true;
  if (AU.screechG) AU.screechG.gain.setTargetAtTime(player.car ? clamp((squeal - 3.5) / 9, 0, 1) * 0.12 : 0, AU.ctx.currentTime, 0.05);
}
// bumpers fall off as a car gets wrecked
function shedParts(v) {
  const b = v.mesh.userData.bumpers; if (!b || !b.length) return;
  const frac = v.health / v.t.hp, want = frac < 0.3 ? 2 : frac < 0.6 ? 1 : 0, gone = b.filter(m => !m.visible).length;
  for (let k = gone; k < want; k++) { const m = b.find(q => q.visible); if (!m) break; m.updateMatrixWorld(); addDebris(m.geometry, m.material, m.matrixWorld.clone(), v.vx * 0.5 + rR(-2, 2), 3, v.vz * 0.5 + rR(-2, 2)); m.visible = false; sfx.clang(0.5); }
}

// ---------- performance readout and budget ----------
let perfOn = false, perfAcc = 0, perfN = 0, perfMs = 0, budgetT = 0;
function togglePerf() { perfOn = !perfOn; $('perf').hidden = !perfOn; }
function updatePerf(dt, ms) {
  perfAcc += dt; perfN++; perfMs += ms;
  if (perfOn && perfAcc > 0.5) {
    const fps = perfN / perfAcc, inf = renderer.info.render;
    $('perf').textContent = `${fps.toFixed(0)} fps · ${(perfMs / perfN).toFixed(1)} ms cpu · ${inf.calls} draw calls · ${(inf.triangles / 1000).toFixed(0)}k tris · ${peds.length} people · ${vehicles.length} vehicles · ${debris.length} debris · gfx ${GFX_NAMES[gfx]}`;
    perfAcc = 0; perfN = 0; perfMs = 0;
  } else if (!perfOn && perfAcc > 0.5) { perfAcc = 0; perfN = 0; perfMs = 0; }
  // budget: far people skip shadows and hide; far cars skip shadows
  budgetT -= dt; if (budgetT > 0) return; budgetT = 0.5;
  const cx = camera.position.x, cz = camera.position.z;
  for (const p of peds) { const d = d2(p.pos.x, p.pos.z, cx, cz), sh = d < 45 * 45 && gfx > 0, vis = d < 140 * 140 || p.state === 'perform';
    if (p.h.g.visible !== vis && p.h !== player.human) p.h.g.visible = vis;
    if (p.h.sh !== sh) { p.h.sh = sh; p.h.g.traverse(m => { if (m.isMesh) m.castShadow = sh; }); } }
  for (const v of vehicles) { const sh = d2(v.pos.x, v.pos.z, cx, cz) < 110 * 110; if (v.sh !== sh) { v.sh = sh; v.mesh.traverse(m => { if (m.isMesh) m.castShadow = sh; }); } }
}
function updateActs(dt) { updateActivity(dt); updatePlaces(dt); updateHeli(dt); updateRoadblocks(dt); updateLights(dt); updateTyres(dt); }

// ====================== TRANSPORT: boats, bus route, cable car, metro ======================
// ---------- boat meshes ----------
function hullGeo(L, W, H, bowK) {
  const sh = new THREE.Shape(); const pts = [[-W / 2, L / 2], [W / 2, L / 2], [W / 2, -L * bowK], [W * 0.18, -L / 2 + 0.2], [0, -L / 2], [-W * 0.18, -L / 2 + 0.2], [-W / 2, -L * bowK]];
  pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]));
  const g = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.computeVertexNormals(); return g;   // shape -y maps to +z (bow forward)
}
function makeBoatMesh(t, col, g, add) {
  const L = t.len, W = t.wid, paint = paintMat(col), white = paintMat('#f4f2ec'), deck = lam('#a8774a');
  const hull = new THREE.Mesh(hullGeo(L, W, t.gavina ? 1.6 : 1.0, 0.18), white); hull.position.y = -0.55; hull.castShadow = true; g.add(hull);
  const band = new THREE.Mesh(hullGeo(L * 0.995, W * 1.01, 0.22, 0.18), paint); band.position.y = t.gavina ? 0.65 : 0.25; g.add(band);
  const top = t.gavina ? 1.05 : 0.47;
  add(bx(W * 0.86, 0.06, L * 0.62), deck, 0, top + 0.03, -L * 0.05);
  if (!t.gavina) {
    add(bx(W * 0.8, 0.5, 0.08), glassMat, 0, top + 0.3, L * 0.1).rotation.x = -0.5;
    for (const x of [-0.45, 0.45]) { add(bx(0.55, 0.45, 0.55), lam('#e8e3d6'), x, top + 0.25, -L * 0.05); add(bx(0.55, 0.55, 0.12), lam('#e8e3d6'), x, top + 0.5, -L * 0.05 - 0.28); }
    add(bx(0.45, 0.7, 0.5), lam('#1e1f22'), 0, top + 0.1, -L / 2 - 0.15); add(bx(0.12, 0.6, 0.12), lam('#2b2b2b'), 0, top - 0.45, -L / 2 - 0.3);
  } else {
    add(bx(W * 0.9, 1.25, L * 0.55), white, 0, top + 0.65, -L * 0.04);
    add(bx(W * 0.92, 0.55, L * 0.5), glassMat, 0, top + 0.85, -L * 0.04);
    add(bx(W * 0.95, 0.08, L * 0.7), paint, 0, top + 2.6, -L * 0.04);
    for (const [x, z] of [[-1, -0.3], [1, -0.3], [-1, 0.25], [1, 0.25]]) add(bx(0.08, 1.3, 0.08), lam('#d6d0c4'), x * W * 0.42, top + 1.95, z * L);
    for (const x of [-1, 1]) add(bx(0.04, 0.5, L * 0.66), lam('#cfc8b8'), x * W * 0.45, top + 1.6, -L * 0.04);
    const fl = canvasTex(90, 60, gg => { for (let i = 0; i < 9; i++) { gg.fillStyle = i % 2 ? '#d6372b' : '#f2c230'; gg.fillRect(0, i * 60 / 9, 90, 60 / 9 + 1); } }, false);
    add(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshLambertMaterial({ map: fl, side: THREE.DoubleSide }), 0, top + 3.4, -L / 2 + 0.4).rotation.y = Math.PI / 2;
    add(bx(0.05, 1.4, 0.05), lam('#333'), 0, top + 2.9, -L / 2 + 0.4);
  }
  add(bx(0.2, 0.1, 0.05), headMat, 0, top + 0.1, L / 2 - 0.1); add(bx(0.2, 0.1, 0.05), tailMat, 0, top + 0.1, -L / 2 + 0.1);
  g.userData.paint = paint;
}
// ---------- boat physics (called from Vehicle.physics) ----------
function boatPhysics(v, dt) {
  const t = v.t; let s = Math.sin(v.heading), c = Math.cos(v.heading);
  let fwd = v.vx * s + v.vz * c, lat = -v.vx * c + v.vz * s;
  const afloat = groundH(v.pos.x, v.pos.z) < WATER_Y - 0.7;
  if (v.dead) { v.inT = 0; v.inS = 0; }
  const T = v.inT;
  if (T > 0 && fwd < t.max) fwd += t.acc * T * (1 - 0.6 * fwd / t.max) * dt;
  else if (T < 0) fwd += (fwd > 0 ? 12 : t.acc * 0.5) * T * dt;
  fwd -= fwd * (T ? 0.25 : 0.7) * dt; if (fwd < -t.max * 0.35) fwd = -t.max * 0.35;
  v.steer = lerp(v.steer, v.inS, Math.min(1, dt * 4));
  v.heading = wrapA(v.heading - v.steer * (t.gavina ? 0.45 : 1.15) * clamp((Math.abs(fwd) + 1.5) / 7, 0, 1) * Math.sign(fwd || 1) * dt);
  lat *= Math.exp(-t.grip * dt);
  s = Math.sin(v.heading); c = Math.cos(v.heading);
  v.vx = s * fwd - c * lat; v.vz = c * fwd + s * lat;
  if (!afloat) { v.vx *= Math.exp(-6 * dt); v.vz *= Math.exp(-6 * dt); }
  const px = v.pos.x, pz = v.pos.z;
  v.pos.x += v.vx * dt; v.pos.z += v.vz * dt;
  // running aground: probe the bow and stern
  for (const k of [0.45, -0.45]) {
    const qx = v.pos.x + s * t.len * k, qz = v.pos.z + c * t.len * k;
    if (groundH(qx, qz) > WATER_Y - 0.45) { const sp = Math.hypot(v.vx, v.vz); v.pos.x = px; v.pos.z = pz; v.vx *= -0.25; v.vz *= -0.25; if (sp > 6) { v.damage(sp * 8); if (v.driver === 'player') { sfx.thud(0.7); cam.shake = 0.3; } } break; }
  }
  const off = t.len * 0.32, rad = t.wid * 0.55;
  for (const k of [1, 0, -1]) { const hit = collideWorld(v.pos.x + s * off * k, v.pos.z + c * off * k, rad); if (hit) { v.pos.x += hit[0]; v.pos.z += hit[1]; v.vx *= 0.5; v.vz *= 0.5; } }
  v.bob = (v.bob || R() * 6);
  v.ty = WATER_Y; v.pos.y = WATER_Y - 0.05 + Math.sin(now * 0.0021 + v.bob) * (t.gavina ? 0.05 : 0.09);
  if (Math.abs(fwd) > 3 && d2(v.pos.x, v.pos.z, camera.position.x, camera.position.z) < 150 * 150) { v.wakeT = (v.wakeT || 0) - dt; if (v.wakeT < 0) { v.wakeT = 0.06; fx.spawn('splash', v.pos.x - s * t.len * 0.5 + rR(-0.5, 0.5), WATER_Y + 0.2, v.pos.z - c * t.len * 0.5 + rR(-0.5, 0.5)); if (Math.abs(fwd) > 12) fx.spawn('splash', v.pos.x + s * t.len * 0.35 - c * t.wid * 0.5 * (R() < 0.5 ? 1 : -1), WATER_Y + 0.1, v.pos.z + c * t.len * 0.35 + s * t.wid * 0.5 * (R() < 0.5 ? 1 : -1)); } }
  if (v.burn >= 0) { v.burn -= dt; if (R() < dt * 30) fx.spawn('fire', v.pos.x + rR(-0.8, 0.8), v.pos.y + 1, v.pos.z + rR(-0.8, 0.8)); if (v.burn < 0) explode(v); }
  v.sync();
}
// docked boats respawn when you are away from their berth
const DOCKS = [['llanxa', -300, 441, Math.PI / 2, '#2b5fa8'], ['llanxa', -250, 441, Math.PI / 2, '#d6372b'], ['gavina', -95, 443, Math.PI / 2, '#2a6b5c'], ['llanxa', 430, 442, Math.PI / 2, '#e2b230'], ['llanxa', 60, 441, -Math.PI / 2, '#1c1c22']];
let dockT = 0;
function updateDocks(dt) {
  dockT -= dt; if (dockT > 0) return; dockT = 2;
  for (const d of DOCKS) {
    if (d.v && vehicles.includes(d.v) && !d.v.dead) continue;
    if (d2(d[1], d[2], player.pos.x, player.pos.z) < 160 * 160) continue;
    const v = new Vehicle(d[0], d[1], d[2], d[3], d[4]); v.dock = true; d.v = v;
  }
}
// ---------- bus stops and the bus route job ----------
const BUS_STOPS = [];
function buildBusStops() {
  const segs = [];
  for (let sj = SJ0 + 1; sj <= SJ1 - 1; sj += 2) for (let si = SI0 + 1; si < SI1 - 1; si += 3) if (nodeOK(si, sj) && nodeOK(si + 1, sj)) segs.push([si, sj, true]);
  for (const [si, sj] of segs.filter((_, i) => i % 3 === 0).slice(0, 12)) {
    const z = sz(sj), x = (si + 1) * P, dir = (sj & 1) ? -1 : 1, rz = dir;   // right-hand side when driving along +x is +z
    if (onDiag(x, z, 30)) continue;
    const sxp = x, szp = z + rz * 9.9, bxp = x, bzp = z + rz * 5.4;
    if (!onSidewalk(sxp, szp) || solidAt(sxp, szp)) continue;
    BUS_STOPS.push({ x: bxp, z: bzp, sx: sxp, sz: szp, name: district(x, z) });
    const rot = rz > 0 ? Math.PI : 0;
    const shel = new THREE.Group(); shel.position.set(sxp, CURB, szp); shel.rotation.y = rot; scene.add(shel);
    const m = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; shel.add(o); return o; };
    m(bx(3.6, 0.08, 1.5), lam('#2b3036'), 0, 2.5, 0); m(bx(3.6, 2.2, 0.05), glassMat, 0, 1.3, 0.7);
    for (const px of [-1.75, 1.75]) m(bx(0.08, 2.5, 0.08), lam('#2b3036'), px, 1.25, 0.7);
    m(bx(2.4, 0.08, 0.4), lam('#7a5232'), 0, 0.48, 0.45);
    const sign = signTex('BUS', '#c23a2f', '#ffffff', 256, 128); m(bx(0.9, 0.45, 0.05), new THREE.MeshLambertMaterial({ map: sign }), 1.6, 2.9, 0.7);
    addSolid(rectPoly(sxp - 1.8, szp - 0.8, sxp + 1.8, szp + 0.8), 2.6);
  }
}
function busJob() {
  let idx = 0, total = 0, waitT = 0, riders = [];
  const v0 = player.car; const order = BUS_STOPS.slice().sort((a, b) => d2(a.x, a.z, v0.pos.x, v0.pos.z) - d2(b.x, b.z, v0.pos.x, v0.pos.z));
  const route = order.slice(0, 8);
  const spawnRiders = () => { riders.forEach(r => disposeGroup(r.g)); riders = []; const st = route[idx]; const n = ri(1, 4); for (let i = 0; i < n; i++) { const h = makeHuman(randomLook()); h.g.position.set(st.sx + rR(-1.4, 1.4), CURB, st.sz); h.g.rotation.y = Math.atan2(st.x - st.sx, st.z - st.sz); riders.push(h); } };
  spawnRiders(); act.timer = 75;
  return {
    blips: () => [[route[idx].x, route[idx].z, '#c23a2f']],
    update(dt) {
      const v = player.car; if (!v || !v.t.bus) return { end: true, msg: `${idx} stops · €${total}`, good: total > 0 };
      const st = route[idx];
      setObjective(`Bus route: stop ${idx + 1} of ${route.length} (${st.name}). Stop next to the shelter.`);
      if (d2(v.pos.x, v.pos.z, st.x, st.z) < 7 * 7 && Math.abs(v.speed) < 1.2) {
        waitT += dt; if (waitT > 2.5) {
          const pay = 25 + riders.length * 6 + Math.round(act.timer * 0.3); total += pay; player.money += pay; sfx.pick();
          toast(`${riders.length} passenger${riders.length === 1 ? '' : 's'} on board. <b>+€${pay}</b>`, 2200); waitT = 0; idx++;
          if (idx >= route.length) { player.money += 200; return { end: true, msg: `Route complete · €${total + 200} (includes €200 bonus)`, good: true }; }
          spawnRiders(); act.timer = 75;
        }
      } else waitT = 0;
      if (act.timer <= 0) return { end: true, msg: `Late at the stop. ${idx} stops · €${total}`, good: total > 0 };
    },
    cleanup() { riders.forEach(r => disposeGroup(r.g)); riders = []; },
  };
}
// ---------- cable car across the port ----------
const CABLE = { towers: [], cabins: [], pts: [] };
function cablePoint(u, out) {   // u in 0..1 along the whole line, with sag between towers
  const P2 = CABLE.pts, n = P2.length - 1, f = clamp(u, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, a = P2[i], b = P2[i + 1];
  const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
  out.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k) - span * 0.045 * 4 * k * (1 - k), lerp(a[2], b[2], k)); return out;
}
function lattice(x, z, base, top) {
  const parts = [], h = top - base, wB = 3.4, wT = 1.4, n = Math.max(3, Math.round(h / 8));
  for (const [sx2, sz2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lean = (wB - wT) / 2 / h; parts.push([G.box, '#9a2f2a', sx2 * (wB + wT) / 4, h / 2, sz2 * (wB + wT) / 4, 0.28, h, 0.28]); void lean; }
  for (let i = 1; i <= n; i++) { const y = h * i / n, w = lerp(wB, wT, i / n); parts.push([G.box, '#7a2622', 0, y, (w / 2), w, 0.18, 0.18]); parts.push([G.box, '#7a2622', 0, y, -(w / 2), w, 0.18, 0.18]); parts.push([G.box, '#7a2622', w / 2, y, 0, 0.18, 0.18, w]); parts.push([G.box, '#7a2622', -w / 2, y, 0, 0.18, 0.18, w]); }
  parts.push([G.box, '#d8d2c4', 0, h + 1.5, 0, 5, 3, 5]);
  const m = new THREE.Mesh(mergeColored(parts), coreMat); m.position.set(x, base, z); m.castShadow = true; scene.add(m);
  addSolid(circlePoly(x, z, 2.2, 8), top + 3);
}
function makeCabin() {
  const g = new THREE.Group(), red = paintMat('#c23a2f');
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(bx(2.3, 1.1, 2.3), red, 0, -3.1, 0); add(bx(2.34, 0.9, 2.34), glassMat, 0, -2.1, 0); add(bx(2.4, 0.18, 2.4), red, 0, -1.55, 0);
  add(bx(0.08, 1.4, 0.08), lam('#333'), 0, -0.75, 0); add(bx(0.7, 0.3, 0.3), lam('#333'), 0, 0, 0);
  scene.add(g); return g;
}
const STATIONS_CC = [];
function buildCableCar() {
  const A = [205, 428], B = [-40, 472], C = [-650, 402];
  const ha = groundH(A[0], A[1]), hc = groundH(C[0], C[1]);
  lattice(A[0], A[1], ha, 72); lattice(B[0], B[1], -4, 88); lattice(C[0], C[1], hc, hc + 30);
  CABLE.pts = [[A[0], 75, A[1]], [B[0], 91, B[1]], [C[0], hc + 33, C[1]]];
  const pts = []; const v = new THREE.Vector3(); for (let i = 0; i <= 120; i++) { cablePoint(i / 120, v); pts.push(v.clone().add(new THREE.Vector3(0.6, 0, 0))); }
  for (const dx of [0, -1.2]) { const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().add(new THREE.Vector3(dx, 0, 0)))); scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x222222 }))); }
  for (let i = 0; i < 3; i++) CABLE.cabins.push({ g: makeCabin(), ph: i / 3 });
  const st = mesh(new THREE.BoxGeometry(12, 6, 10), lam('#d8cfc0'), C[0], hc + 3, C[1] - 9); addSolid(rectPoly(C[0] - 6, C[1] - 14, C[0] + 6, C[1] - 4), hc + 6);
  addSign('TELEFÈRIC', C[0], hc + 5, C[1] - 3.9, 0, 6, 1.2, '#c23a2f', '#ffffff'); addSign('TELEFÈRIC', A[0], 3.6, A[1] - 2.3, Math.PI, 6, 1.2, '#c23a2f', '#ffffff');
  for (const [x, z, u, name] of [[A[0], A[1] - 7, 0, 'Barceloneta'], [C[0] + 9, C[1] + 2, 1, 'Montjuïc']]) { const f = freeSpot(x, z, 1.2); STATIONS_CC.push({ x: f[0], z: f[1], u, name }); const mk = new THREE.Mesh(beamGeo, beamMat.clone()); mk.material.color.setHex(0xb06ae0); mk.scale.set(0.55, 0.5, 0.55); mk.position.set(f[0], surfH(f[0], f[1]) + 10, f[1]); scene.add(mk); }
}
const _cv = new THREE.Vector3();
let ride = null, ccLock = null;   // ccLock: station you just arrived at; leave its light before boarding again
function updateCableCar(dt) {
  if (!CABLE.pts.length) return;
  for (const cb of CABLE.cabins) {
    const t = (now * 0.001 / 80 + cb.ph) % 2, u = t < 1 ? t : 2 - t;
    cablePoint(u, _cv); cb.g.position.copy(_cv); cb.g.rotation.z = Math.sin(now * 0.0013 + cb.ph * 9) * 0.03;
  }
  if (ride && ride.kind === 'cable') {
    ride.t += dt; const k = clamp(ride.t / ride.dur, 0, 1), e = k * k * (3 - 2 * k), u = lerp(ride.from, ride.to, e);
    cablePoint(u, _cv); ride.cab.position.copy(_cv); ride.cab.rotation.z = Math.sin(now * 0.0015) * 0.04;
    player.pos.set(_cv.x, _cv.y - 3.4, _cv.z);
    if (k >= 1) { scene.remove(ride.cab); const st = STATIONS_CC.find(s2 => s2.u === ride.to); ccLock = st; player.pos.set(st.x, surfH(st.x, st.z), st.z); player.human.g.visible = true; player.human.g.position.copy(player.pos); bigMsg(st.name, 'Telefèric', false, 2200); ride = null; }
    return;
  }
  if (ccLock && !near(ccLock.x, ccLock.z, 5)) ccLock = null;
  if (player.car || player.dead || act.run || mission.run) return;
  for (const st of STATIONS_CC) if (st !== ccLock && near(st.x, st.z, 2.4)) {
    if (wantedLevel() > 0) { setObjective('The cable car staff won\'t let you board with the police after you.'); return; }
    if (player.money < 5) { setObjective('The cable car costs €5.'); return; }
    player.money -= 5; sfx.pick();
    ride = { kind: 'cable', from: st.u, to: 1 - st.u, t: 0, dur: 55, cab: makeCabin() }; player.human.g.visible = false; toast('Telefèric: enjoy the view. Mouse to look around.', 3500);
    return;
  }
}
// ---------- metro ----------
const METRO = [['Catalunya', -140, 140], ['Drassanes', -160, 398], ['Barceloneta', 300, 404], ['Sagrada Família', 240, -290], ['Glòries', 480, 26], ['Diagonal', -430, -470], ['Espanya', -560, 108], ['Gràcia', 80, -505]];
const metroSt = [];
function buildMetro() {
  const signT = signTex('METRO', '#c23a2f', '#ffffff', 256, 96);
  for (const [name, x0, z0] of METRO) {
    const [x, z] = freeSpot(x0, z0, 2.2), y = surfH(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    const add = (geo, mat, px, py, pz) => { const o = new THREE.Mesh(geo, mat); o.position.set(px, py, pz); o.castShadow = true; g.add(o); return o; };
    add(bx(2.6, 0.04, 4.2), lam('#111'), 0, 0.03, 0);
    for (let i = 0; i < 6; i++) add(bx(2.4, 0.06, 0.4), lam('#8f877a'), 0, -0.05 - i * 0.12, -1.6 + i * 0.6);
    for (const sx2 of [-1.35, 1.35]) { add(bx(0.12, 0.9, 4.2), lam('#5a5f68'), sx2, 0.45, 0); add(bx(0.06, 0.06, 4.2), chromeMat, sx2, 1.0, 0); }
    add(bx(2.8, 0.9, 0.12), lam('#5a5f68'), 0, 0.45, 2.1);
    add(bx(0.12, 3.2, 0.12), lam('#2b3036'), 1.6, 1.6, -2.2);
    add(bx(1.5, 0.55, 0.12), new THREE.MeshLambertMaterial({ map: signT, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: 0.4 }), 1.6, 3.3, -2.2);
    metroSt.push({ name, x, z, kind: 'metro', icon: 'M' });
  }
}
// tunnel scene for the ride
let metroScene = null, metroCam = null, metroLights = null;
function buildTunnel() {
  metroScene = new THREE.Scene(); metroScene.background = new THREE.Color(0x050506); metroScene.fog = new THREE.Fog(0x050506, 20, 160);
  metroCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
  const tex = canvasTex(64, 64, g => { g.fillStyle = '#6f6a62'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '120,120,120'},0.2)`; g.fillRect(R() * 64, R() * 64, 2, 2); } g.fillStyle = '#222'; g.fillRect(0, 30, 64, 4); });
  tex.repeat.set(8, 120);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1200, 16, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.BackSide })); tube.rotation.x = Math.PI / 2; metroScene.add(tube);
  const rail = new THREE.Mesh(bx(0.1, 0.1, 1200), chromeMat); for (const x of [-0.7, 0.7]) { const r = rail.clone(); r.position.set(x, -2.2, 0); metroScene.add(r); }
  metroLights = new THREE.InstancedMesh(bx(0.35, 0.3, 2.2), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), 240);
  const m = new THREE.Matrix4(); for (let i = 0; i < 240; i++) { m.makeTranslation(i % 2 ? 2.7 : -2.7, 1.0, -(i >> 1) * 10); metroLights.setMatrixAt(i, m); } metroScene.add(metroLights);
  for (const x of [-2.95, 2.95]) { const strip = new THREE.Mesh(bx(0.06, 0.12, 1200), new THREE.MeshBasicMaterial({ color: 0x4a8fc0 })); strip.position.set(x, -0.9, 0); metroScene.add(strip); }
  metroScene.add(new THREE.AmbientLight(0xffe8c8, 0.9)); const pl = new THREE.PointLight(0xfff0d0, 2.2, 40); metroCam.add(pl); metroScene.add(metroCam);
  const car = new THREE.Group(); const body = new THREE.Mesh(bx(2.8, 2.6, 30), paintMat('#c9ccd0')); body.position.y = -0.6; car.add(body); const win = new THREE.Mesh(bx(2.82, 0.8, 28), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); win.position.y = -0.2; car.add(win);
  car.visible = false; metroScene.add(car); metroScene.userData.car = car;
}
function startMetro(dest) {
  if (!metroScene) buildTunnel();
  game.state = 'metro'; document.body.classList.add('metro'); $('shop').hidden = true; shopOpen = null; setPrompt(''); setTimeout(() => bigMsg('Next stop: ' + dest.name, 'Metro', false, 3800), 500);
  ride = { kind: 'metro', t: 0, dur: 5, dest }; metroCam.position.set(0, -0.6, 0); sfx.pick();
  if (AU.ctx) noiseHit(AU.ctx.currentTime, 4.8, 180, 0.4, 0.5, 'lowpass');
  $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 500);
}
function updateMetro(dt) {
  ride.t += dt; const k = ride.t / ride.dur, sp = 32 * Math.sin(Math.PI * clamp(k, 0, 1)) + 4;
  metroCam.position.z -= sp * dt; if (metroCam.position.z < -500) metroCam.position.z += 400;
  metroCam.position.x = Math.sin(now * 0.004) * 0.05; metroCam.position.y = -0.6 + Math.sin(now * 0.03) * 0.02 * (sp / 30);
  metroCam.lookAt(metroCam.position.x, -0.7, metroCam.position.z - 20);
  if (ride.t > ride.dur - 0.5 && !ride.fading) { ride.fading = true; $('fade').classList.add('on'); }
  if (ride.t >= ride.dur) {
    const d = ride.dest; ride = null; game.state = 'play'; document.body.classList.remove('metro');
    if (player.car) { player.car = null; }
    player.pos.set(d.x + 2.2, surfH(d.x + 2.2, d.z), d.z); const f = freeSpot(player.pos.x, player.pos.z, 0.6); player.pos.set(f[0], surfH(f[0], f[1]), f[1]); player.human.g.visible = true; player.human.g.position.copy(player.pos);
    setTimeout(() => $('fade').classList.remove('on'), 250); bigMsg(d.name, 'Metro', false, 2200); writeSave();
  }
}
function metroItems(st) { return metroSt.filter(s2 => s2 !== st).map(s2 => ({ label: s2.name, cost: 2, ok: true, buy() { startMetro(s2); } })); }
function updateTransport(dt) { updateDocks(dt); updateCableCar(dt); }

// ====================== MISSIONS ======================
const BAR = [246, 406];
const mission = { run: null, markers: [], blips: [], giverMesh: null, timer: -1, title: '' };
const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 40, 16, 1, true);
const beamMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
const ringGeo = new THREE.TorusGeometry(8, 0.5, 6, 32);
function markerAt(x, z, kind, color = 0xf2c230) {
  let m;
  if (kind === 'ring') { m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })); m.position.set(x, surfH(x, z) + 7, z); }
  else { m = new THREE.Mesh(beamGeo, beamMat.clone()); m.material.color.setHex(color); m.position.set(x, surfH(x, z) + 20, z); m.scale.set(kind === 'small' ? 0.7 : 1, 1, kind === 'small' ? 0.7 : 1); }
  m.userData.kind = kind; scene.add(m); mission.markers.push(m); return m;
}
function clearMarkers() { for (const m of mission.markers) scene.remove(m); mission.markers.length = 0; }
const near = (x, z, r) => { const p = player.car ? player.car.pos : player.pos; return d2(p.x, p.z, x, z) < r * r; };
function missionVehicle(key, x, z, h, col) { const v = new Vehicle(key, x, z, h, col); v.mission = true; return v; }
const MISSIONS = [
  { title: 'Tornada a casa', sub: 'Homecoming', giver: [-150, 176], reward: 500,
    intro: [['Marta', 'Nil! Cousin! Six years in Marseille and you come back with one bag?'], ['Marta', 'Tia Montse is waiting at the bar in La Barceloneta. She would never say it, but she needs you.'], ['Marta', 'Take my Pícolo. It is parked on Passeig de Gràcia. If you scratch it, you are paying.']],
    start() {
      const car = missionVehicle('picolo', -113.8, 84, 0, '#c8342b'); let stage = 0; const bar = markerAt(BAR[0], BAR[1], 'beam'); bar.visible = false;
      return {
        blips: () => stage === 0 ? [[car.pos.x, car.pos.z, '#5fb2e0']] : [[BAR[0], BAR[1], '#f2c230']],
        update() {
          if (car.dead || car.health <= 0) return 'fail:The Pícolo was wrecked. Marta will never lend you anything again.';
          if (player.car !== car) { stage = 0; bar.visible = false; setObjective('Get in Marta\'s red Pícolo on Passeig de Gràcia.'); return; }
          stage = 1; bar.visible = true; setObjective('Drive to Bar Can Ferrer in La Barceloneta.');
          if (near(BAR[0], BAR[1], 7) && Math.abs(car.speed) < 7) return 'pass';
        }, cleanup() { car.mission = false; } };
    } },
  { title: 'Esmorzar de forquilla', sub: 'Fork breakfast', giver: BAR, reward: 800,
    intro: [['Tia Montse', 'So the prodigal nephew returns. Good. I have no time for hugs, I have three breakfast orders.'], ['Tia Montse', 'The builders at the Sagrada Família, the night nurses at Sant Pau, and the gardeners at the Arc de Triomf.'], ['Tia Montse', 'Cap i pota goes cold fast. Take the scooter and move.']],
    start() {
      const scoot = missionVehicle('scuter', 232, 421, -Math.PI / 2, '#2a6b5c');
      const drops = [[240, -279, 'Sagrada Família'], [320, -441, 'Hospital de Sant Pau'], [160, 117, 'Arc de Triomf']].map(d => ({ x: d[0], z: d[1], name: d[2], m: markerAt(d[0], d[1], 'small'), done: false }));
      mission.timer = 210;
      return {
        blips: () => drops.filter(d => !d.done).map(d => [d.x, d.z, '#f2c230']),
        update() {
          let left = 0;
          for (const d of drops) { if (d.done) continue; left++; if (near(d.x, d.z, 6)) { d.done = true; scene.remove(d.m); player.money += 50; sfx.pick(); toast(`Order delivered to <b>${d.name}</b>. +€50 tip.`); } }
          setObjective(left ? `Deliver the breakfasts: ${left} left. Any order, any vehicle.` : '');
          if (!left) return 'pass';
          if (mission.timer <= 0) return 'fail:Too slow. The cap i pota went cold.';
        }, cleanup() { scoot.mission = false; mission.timer = -1; } };
    } },
  { title: 'Carteristes a la Rambla', sub: 'Pickpockets on the Rambla', giver: [-160, 300], reward: 1200,
    intro: [['Rosa', 'You are Montse\'s boy? Then help me. A scooter thief just took my till and a tourist\'s bag.'], ['Rosa', 'He went up towards Plaça de Catalunya. My nephew\'s scooter is right there. Knock him off it!']],
    start() {
      missionVehicle('scuter', -147, 296, Math.PI, '#d6372b').mission = false;
      const thief = missionVehicle('scuter', -120, 200, 0, '#1e1e22'); thief.health = 260; thief.driver = 'ai'; thief.ai = { mode: 'flee', speed: 27 };
      let bag = null, done = false;
      return {
        blips: () => bag ? [[bag.x, bag.z, '#86d98f']] : [[thief.pos.x, thief.pos.z, '#d9412f']],
        update() {
          if (done) return 'pass';
          if (!bag && (thief.health <= 0 || thief.dead || thief.burn >= 0)) {
            thief.driver = null; thief.ai = null;
            const f = freeSpot(thief.pos.x + 3, thief.pos.z, 0.8);
            bag = addPickup('bag', f[0], f[1], { onPick: () => { done = true; } });
            say([['Rosa (phone)', 'You got him! Grab the bag before someone else does.']]);
          }
          if (!bag) { setObjective('Chase the pickpocket and knock him off his scooter.'); if (!near(thief.pos.x, thief.pos.z, 380)) return 'fail:The pickpocket got away.'; }
          else setObjective('Pick up the stolen bag.');
        }, cleanup() { thief.mission = false; if (bag && bag.alive) removePickup(bag); } };
    }, onPass() { player.hasPistol = true; player.ammo += 30; drawWeaponIcon(); toast('Rosa slipped you her late husband\'s <b>pistol</b> and 30 rounds. Q switches weapon.', 6000); } },
  { title: 'La cursa de la Diagonal', sub: 'The Diagonal run', giver: [-178, 168], reward: 1500,
    intro: [['Jordi "Llamp"', 'You are the guy from Marseille? They say you drive like someone is chasing you.'], ['Jordi "Llamp"', 'Take the Delfí GT. Start at the top of the Diagonal, run it to Glòries and finish at the beach in under 80 seconds.'], ['Jordi "Llamp"', 'Win and you have a friend in Poblenou. Lose and you have a story.']],
    start() {
      const gt = missionVehicle('delfi', -137, 206.2, Math.PI / 2, '#e2b230');
      const st = diagPt(1110), cps = [diagPt(820), diagPt(520), diagPt(220), diagPt(-60), diagPt(-217), [680, 120], [680, 270], [585, 280]];
      let stage = 0, idx = 0, cd = 0, ring = null; const startM = markerAt(st[0], st[1], 'beam');
      return {
        blips: () => stage < 2 ? [[st[0], st[1], '#f2c230']] : [[cps[idx][0], cps[idx][1], '#f2c230']].concat(cps[idx + 1] ? [[cps[idx + 1][0], cps[idx + 1][1], '#a7b0bd']] : []),
        update(dt) {
          if (stage === 0) { setObjective('Drive to the start line at the top of the Diagonal. Any car will do; the GT is faster.'); if (player.car && near(st[0], st[1], 9)) { stage = 1; cd = 3.2; scene.remove(startM); player.car.mission = true; } return; }
          if (stage === 1) { const v = player.car; if (v) { v.vx *= 0.8; v.vz *= 0.8; } cd -= dt; setObjective(''); const n = Math.ceil(cd); if (n !== this._n) { this._n = n; bigMsg(n > 0 ? String(n) : 'VA!', '', false, 700); sfx.click(); } if (cd <= 0) { stage = 2; mission.timer = 80; ring = markerAt(cps[0][0], cps[0][1], 'ring'); } return; }
          setObjective(`Checkpoint ${idx + 1} of ${cps.length}`);
          ring.rotation.y += dt;
          if (near(cps[idx][0], cps[idx][1], 10)) { sfx.pick(); idx++; scene.remove(ring); if (idx >= cps.length) return 'pass'; ring = markerAt(cps[idx][0], cps[idx][1], 'ring'); const nx = cps[idx]; ring.lookAt(nx[0], ring.position.y, nx[1]); }
          if (mission.timer <= 0) return 'fail:Out of time. Jordi is already telling the story.';
        }, cleanup() { gt.mission = false; if (player.car) player.car.mission = false; mission.timer = -1; } };
    } },
  { title: 'Pintura fresca', sub: 'Fresh paint', giver: BAR, reward: 2500,
    intro: [['Tia Montse', 'Look at my shutter. "VENEU". Sell. Grup Torrent\'s people painted it last night.'], ['Tia Montse', 'Torrent wants the whole street for a hotel. His crew keeps their van in a warehouse in Poblenou.'], ['Tia Montse', 'Bring me that van with the paint still in it. Without the police on your tail, please.']],
    start() {
      const van = missionVehicle('furgo', 700, -114, -Math.PI / 2, '#3a3a3a'); let stolen = false; const bar = markerAt(BAR[0], BAR[1], 'beam'); bar.visible = false;
      return {
        blips: () => player.car !== van ? [[van.pos.x, van.pos.z, '#d9412f']] : wantedLevel() ? [] : [[BAR[0], BAR[1], '#f2c230']],
        update() {
          if (van.dead || van.burn >= 0) return 'fail:The van is wrecked, and the evidence with it.';
          if (player.car !== van) { bar.visible = false; setObjective(stolen ? 'Get back in the van.' : 'Steal Grup Torrent\'s van from the Poblenou warehouse.'); return; }
          if (!stolen) { stolen = true; game.heat = Math.max(game.heat, 3); copSeenT = 0; say([['Marta (phone)', 'That is the alarm! Lose the police first. A Pinta Ràpid will repaint the van if you are desperate.']]); }
          if (wantedLevel() > 0) { bar.visible = false; setObjective('Lose the police. Stay out of sight or use a Pinta Ràpid.'); return; }
          bar.visible = true; setObjective('Take the van to Bar Can Ferrer.');
          if (near(BAR[0], BAR[1], 8) && Math.abs(van.speed) < 7) return 'pass';
        }, cleanup() { van.mission = false; } };
    } },
  { title: 'El castell', sub: 'The castle', giver: BAR, reward: 5000,
    intro: [['Tia Montse', 'Nil. Torrent himself came to see me. In person. With a lawyer.'], ['Tia Montse', 'I showed him the van. He ran. He is driving to his party at Montjuïc castle to get his story straight.'], ['Tia Montse', 'There is a Delfí outside. Do not let him reach that castle.']],
    start() {
      missionVehicle('delfi', 262, 421, -Math.PI / 2, '#d63a2f').mission = false;
      const t = missionVehicle('delfi', 150, 421, -Math.PI / 2, '#1c1c22'); t.health = 700; t.driver = 'ai';
      t.ai = { mode: 'path', path: [[-120, 421], [-460, 421], [-560, 410], [-650, 395], [-740, 390], [-810, 392], [-856, 394]], i: 0, speed: 25, radius: 12 };
      let wreckT = -1;
      return {
        blips: () => [[t.pos.x, t.pos.z, '#d9412f'], [-856, 394, '#a7b0bd']],
        update(dt) {
          if (t.health <= 0 || t.dead || t.burn >= 0) { if (wreckT < 0) { wreckT = 2.5; t.driver = null; t.ai = null; say([['Nil', 'End of the road, Torrent.']]); } wreckT -= dt; setObjective(''); if (wreckT <= 0) return 'pass'; return; }
          setObjective('Wreck Torrent\'s black Delfí before he reaches Montjuïc castle.');
          if (t.ai && t.ai.i >= t.ai.path.length) return 'fail:Torrent reached the castle. His lawyers are already talking.';
        }, cleanup() { t.mission = false; } };
    }, onPass() { setTimeout(() => { bigMsg('FI', 'The bar stays. The city is yours. Find all 20 panots.', false, 7000); }, 4200); } },
];
function giverPos() { const m = MISSIONS[game.mission]; return m ? m.giver : null; }
function refreshGiver() {
  if (mission.giverMesh) { scene.remove(mission.giverMesh); mission.giverMesh = null; }
  const g = giverPos(); if (!g || mission.run) return;
  const m = new THREE.Mesh(beamGeo, beamMat); m.position.set(g[0], surfH(g[0], g[1]) + 20, g[1]); scene.add(m); mission.giverMesh = m;
}
function startMission() {
  const def = MISSIONS[game.mission]; if (!def) return;
  if (mission.giverMesh) { scene.remove(mission.giverMesh); mission.giverMesh = null; }
  mission.title = def.title;
  bigMsg(def.title, def.sub, false, 3200); say(def.intro.map(l => l));
  mission.run = def.start(); mission.def = def;
}
function passMission() {
  const def = mission.def; const r = def.reward;
  mission.run.cleanup && mission.run.cleanup(); mission.run = null; clearMarkers(); setObjective('');
  player.money += r; game.mission++; sfx.pass();
  bigMsg('FEINA FETA', 'Job done · €' + r, false, 4000);
  def.onPass && def.onPass(); writeSave(); setTimeout(refreshGiver, 1500);
}
function failMission(reason) {
  if (!mission.run) return;
  mission.run.cleanup && mission.run.cleanup(); mission.run = null; clearMarkers(); mission.timer = -1; setObjective('');
  if (!player.dead) { bigMsg('HAS FALLAT', reason, true, 4000); sfx.fail(); } else toast(reason);
  setTimeout(refreshGiver, 2500);
}
function updateMission(dt) {
  if (mission.timer > 0) mission.timer = Math.max(0, mission.timer - dt);
  const mt = $('mtimer'); const tmr = mission.run ? mission.timer : act.run ? act.timer : -1; if (tmr >= 0) { mt.hidden = false; const s = Math.ceil(tmr); mt.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); mt.style.color = s < 20 ? 'var(--vermell)' : ''; } else mt.hidden = true;
  if (mission.run) { const r = mission.run.update(dt); if (r === 'pass') passMission(); else if (r && r.startsWith('fail:')) failMission(r.slice(5)); return; }
  const g = giverPos(); if (!g || player.dead) return;
  if (mission.giverMesh) mission.giverMesh.material.opacity = 0.25 + Math.sin(now * 0.004) * 0.1;
  if (act.run) return;
  if (near(g[0], g[1], 3.2) && (!player.car || Math.abs(player.car.speed) < 3) && wantedLevel() === 0) startMission();
  else if (near(g[0], g[1], 3.2) && wantedLevel() > 0) setObjective('Lose the police before starting a job.');
}

// ====================== PINTA RÀPID ======================
const SPRAY = [[-315, 418], [-680, -91]];
let sprayCool = 0;
function updateSpray(dt) {
  sprayCool -= dt; if (!player.car || sprayCool > 0) return;
  for (const s of SPRAY) if (near(s[0], s[1], 6) && Math.abs(player.car.speed) < 6) {
    if (wantedLevel() === 0 && player.car.health >= player.car.t.hp * 0.95) continue;
    sprayCool = 6;
    if (player.money < 100) { toast('Pinta Ràpid costs €100. You are short.'); return; }
    const v = player.car; $('fade').classList.add('on');
    setTimeout(() => {
      player.money -= 100; game.heat = 0; v.health = v.t.hp; v.burn = -1;
      const c = pR(v.t.cols.length > 1 ? v.t.cols : ['#2d5fa8', '#c8342b', '#2b8a5a']);
      const oldP = v.mesh.userData.paint || paintMat(v.color), np = paintMat(c); v.mesh.traverse(m => { if (m.isMesh && m.material === oldP) m.material = np; }); v.mesh.userData.paint = np; (v.mesh.userData.bumpers || []).forEach(m => { m.visible = true; });
      v.color = c;
      for (const o of vehicles.slice()) if (o.driver === 'cop' && o.ai && o.ai.mode === 'cop' && d2(o.pos.x, o.pos.z, v.pos.x, v.pos.z) > 40 * 40) o.ai = trafficState(o) || { mode: 'idle' };
      $('fade').classList.remove('on'); toast('<b>Pinta Ràpid.</b> New paint, new plates. Wanted level cleared. −€100');
    }, 650);
  }
}

// ====================== DAY / NIGHT ======================
const HOR_D = new THREE.Color('#d9d6c8'), HOR_DUSK = new THREE.Color('#f09a62'), HOR_N = new THREE.Color('#2a2633'), TOP_D = new THREE.Color('#3f7fc8'), TOP_DUSK = new THREE.Color('#5a5f96'), TOP_N = new THREE.Color('#060b1c');
const _sky = new THREE.Color(), _top = new THREE.Color(), _v3a = new THREE.Vector3(), _v3b = new THREE.Vector3(), _v3c = new THREE.Color();
let stars;
function buildStars() {
  const g = new THREE.BufferGeometry(), a = [];
  for (let i = 0; i < 900; i++) { const u = R() * TAU, v = R() * 0.45 + 0.05; a.push(Math.cos(u) * Math.cos(v) * 1700, Math.sin(v) * 1700, Math.sin(u) * Math.cos(v) * 1700); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);
}
let nightAmt = 0, wallMat;
function updateSky(dt) {
  game.time = (game.time + dt) % 1440;
  const ang = TAU * (game.time - 840) / 1440, s = Math.cos(ang);   // solar noon ≈ 14:00 (CEST)
  const day = smooth(-0.12, 0.3, s), dusk = clamp(1 - Math.abs(s) / 0.22, 0, 1);
  nightAmt = 1 - day;
  // horizon haze (warm by day, orange at dusk, sodium-tinted at night) and zenith colour
  _sky.copy(HOR_N).lerp(HOR_D, day).lerp(HOR_DUSK, dusk * 0.75);
  _top.copy(TOP_N).lerp(TOP_D, day).lerp(TOP_DUSK, dusk * 0.5);
  scene.background = _sky; scene.fog.color.copy(_sky);
  scene.fog.near = lerp(60, 110, day); scene.fog.far = lerp(620, 920, day);
  skyMat.uniforms.hor.value.copy(_sky); skyMat.uniforms.top.value.copy(_top); skyMat.uniforms.time.value += dt * 60; skyMat.uniforms.night.value = nightAmt;
  skyMat.uniforms.cloudCol.value.copy(_sky).lerp(new THREE.Color(0xffffff), 0.55 * day + 0.1).lerp(new THREE.Color(0xf0a070), dusk * 0.4);
  skyDome.position.copy(camera.position);
  // grading per time of day
  const cu = post.comp.uniforms;
  cu.tint.value.set(1.07, 1.0, 0.86).lerp(_v3a.set(1.16, 0.95, 0.8), dusk * 0.8).lerp(_v3b.set(0.88, 0.95, 1.14), nightAmt * (1 - dusk));
  cu.lift.value.set(0.025, 0.018, 0.0).lerp(_v3a.set(0.012, 0.015, 0.035), nightAmt);
  cu.bloom.value = lerp(0.35, 1.0, nightAmt); post.bright.uniforms.th.value = lerp(0.86, 0.5, nightAmt);
  cu.trail.value = reduceMotion || lowered ? 0 : lerp(0.18, 0.34, nightAmt); cu.sat.value = lerp(0.9, 0.82, nightAmt);
  coronaMat.opacity = smooth(0.3, 0.75, nightAmt); if (poolMat) poolMat.opacity = 0.42 * smooth(0.35, 0.8, nightAmt);
  updateCarLights(nightAmt);
  if (water) { waterNormal.offset.x += dt * 0.012; waterNormal.offset.y += dt * 0.007; water.material.reflectivity = lerp(0.12, 0.38, day); }
  for (const k in paintCache) paintCache[k].reflectivity = lerp(0.1, 0.3, day);
  const sunUp = s > -0.05;
  const dx = Math.sin(ang), dy = Math.max(0.12, Math.abs(s)), dz = 0.45;
  const tg = player.car ? player.car.pos : player.pos;
  sun.position.set(tg.x + (sunUp ? dx : -dx) * 220, tg.y + dy * 220, tg.z + dz * 220); sun.target.position.copy(tg);
  sun.intensity = sunUp ? 0.3 + 0.75 * day : 0.16; sun.color.set(sunUp ? (dusk > 0.3 ? 0xffb07a : 0xffeccc) : 0x8fa4e0);
  skyMat.uniforms.sunDir.value.set(sunUp ? dx : -dx, dy, dz).normalize(); skyMat.uniforms.sunCol.value.set(sunUp ? (dusk > 0.3 ? 0xffa060 : 0xfff0d0) : 0x8090b0).multiplyScalar(sunUp ? 1 : 0.35);
  hemi.intensity = 0.3 + 0.4 * day; hemi.color.copy(_top).lerp(_sky, 0.5).lerp(_v3c.setRGB(1, 1, 1), 0.35); hemi.groundColor.setRGB(lerp(0.18, 0.5, day), lerp(0.16, 0.43, day), lerp(0.2, 0.34, day));
  if (stars) { stars.material.opacity = clamp(nightAmt * 1.4 - 0.4, 0, 1); stars.position.copy(camera.position); }
  for (const n of nightMats) n.m.emissiveIntensity = n.max * smooth(0.35, 0.8, nightAmt);
  if (wallMat) wallMat.emissiveIntensity = 0.95 * smooth(0.35, 0.8, nightAmt);
  if (lampHeadMat) lampHeadMat.color.setRGB(lerp(0.55, 1, nightAmt), lerp(0.55, 0.88, nightAmt), lerp(0.5, 0.6, nightAmt));
  const hh = Math.floor(game.time / 60), mm = Math.floor(game.time % 60);
  $('clock').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// ====================== CAMERA ======================
const _ct = new THREE.Vector3();
function updateCamera(dt) {
  let tx, ty, tz, dist;
  const dm = [1, 1.45, 0.75][cam.dist];
  if (player.car) {
    const v = player.car; tx = v.pos.x; ty = v.pos.y + (v.t.h > 2 ? v.t.h * 0.85 : 1.5); tz = v.pos.z;
    dist = ((v.t.moto ? 5.5 : Math.max(v.t.van ? 10 : 8, v.t.len * 1.3)) + Math.abs(v.speed) * 0.05) * dm;
    if (now - cam.lastMouse > 1500 && Math.abs(v.speed) > 1.5) {
      const vy2 = Math.atan2(v.vx, v.vz), target = Math.abs(v.speed) > 6 && v.speed > 0 ? v.heading + clamp(wrapA(vy2 - v.heading), -0.6, 0.6) * 0.6 : v.heading;
      cam.yaw += wrapA(target - cam.yaw) * Math.min(1, dt * 2.6); cam.pitch = lerp(cam.pitch, 0.2, dt * 1.5);
    }
  } else {
    tx = player.pos.x; ty = player.pos.y + 1.7; tz = player.pos.z; dist = (ride && ride.kind === 'cable' ? 16 : 5) * dm;
    if (player.dead) dist = 9;
  }
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), fx2 = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
  let d = dist;
  for (let k = 1; k <= 10; k++) { const f = k / 10 * dist, x = tx - fx2 * cp * f, z = tz - fz * cp * f, y = ty + sp * f; if (solidAt(x, z, y)) { d = Math.max(1.4, (k - 1.2) / 10 * dist); break; } }
  let cx = tx - fx2 * cp * d, cy = ty + sp * d, cz = tz - fz * cp * d;
  cy = Math.max(cy, groundH(cx, cz) + 0.6);
  if (cam.shake > 0 && !reduceMotion) { cx += rR(-1, 1) * cam.shake * 0.4; cy += rR(-1, 1) * cam.shake * 0.4; cam.shake = Math.max(0, cam.shake - dt * 2); }
  camera.position.set(cx, cy, cz); _ct.set(tx, ty + 0.2, tz); camera.lookAt(_ct);
  const fovT = player.car ? 62 + Math.min(14, Math.abs(player.car.speed) * 0.3) : 62;
  if (Math.abs(camera.fov - fovT) > 0.1) { camera.fov = lerp(camera.fov, fovT, dt * 3); camera.updateProjectionMatrix(); }
}

// ====================== RADAR & MAP ======================
const MAP = { x0: -1200, z0: -1100, w: 2200, h: 1860, s: 0.5 };
let mapCanvas;
function buildMapCanvas() {
  const c = document.createElement('canvas'); c.width = MAP.w * MAP.s; c.height = MAP.h * MAP.s; const g = c.getContext('2d');
  const cell = 8;
  for (let z = MAP.z0; z < MAP.z0 + MAP.h; z += cell) for (let x = MAP.x0; x < MAP.x0 + MAP.w; x += cell) {
    const h = groundH(x + cell / 2, z + cell / 2), col = groundColor(x + cell / 2, z + cell / 2, h);
    let r = col[0], gg = col[1], b = col[2];
    if (h < WATER_Y - 0.3) { r = 0.16; gg = 0.38; b = 0.55; }
    g.fillStyle = `rgb(${r * 200 | 0},${gg * 200 | 0},${b * 200 | 0})`; g.fillRect((x - MAP.x0) * MAP.s, (z - MAP.z0) * MAP.s, cell * MAP.s + 1, cell * MAP.s + 1);
  }
  const fillPoly = (poly, col) => { g.fillStyle = col; g.beginPath(); poly.forEach((p, i) => { const X = (p[0] - MAP.x0) * MAP.s, Y = (p[1] - MAP.z0) * MAP.s; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill(); };
  for (const arr of sideHash.m.values()) for (const s of arr) if (!s._drawn) { s._drawn = true; fillPoly(s.poly, '#a29c90'); }
  for (const arr of solidHash.m.values()) for (const s of arr) if (!s._drawn) { s._drawn = true; fillPoly(s.poly, '#d8d0bf'); }
  mapCanvas = c;
}
const toMap = (x, z) => [(x - MAP.x0) * MAP.s, (z - MAP.z0) * MAP.s];
function radarBlips() {
  const out = [];
  if (mission.run && mission.run.blips) for (const b of mission.run.blips()) out.push({ x: b[0], z: b[1], c: b[2], big: true });
  else { const g = giverPos(); if (g) out.push({ x: g[0], z: g[1], c: '#f2c230', big: true, icon: 'M' }); }
  for (const v of vehicles) if (v.driver === 'cop' && v.ai && v.ai.mode === 'cop') out.push({ x: v.pos.x, z: v.pos.z, c: (now / 250 | 0) % 2 ? '#2a6bff' : '#ff3a3a' });
  if (act.run && act.run.blips) for (const b of act.run.blips()) out.push({ x: b[0], z: b[1], c: b[2], big: true });
  for (const p2 of placeMarkers) { const job = p2.kind === 'race' || p2.kind === 'rampage'; if (job && (act.run || mission.run)) continue; out.push({ x: p2.x, z: p2.z, c: p2.kind === 'race' ? '#5fb2e0' : p2.kind === 'rampage' ? '#ef8a2a' : '#6fd36f', icon: p2.icon }); }
  for (const st of metroSt) out.push({ x: st.x, z: st.z, c: '#e0574a', icon: 'M' });
  for (const st of STATIONS_CC) out.push({ x: st.x, z: st.z, c: '#b06ae0', icon: 'T' });
  for (const s of SPRAY) out.push({ x: s[0], z: s[1], c: '#e9e2d0', icon: 'P' });
  out.push({ x: 320, z: -452, c: '#e9e2d0', icon: 'H' });
  return out;
}
function drawRadar() {
  const cvs = $('radar'), g = cvs.getContext('2d'), W = cvs.width, Rr = W / 2;
  const tg = player.car ? player.car.pos : player.pos;
  const zoom = (player.car ? lerp(1.5, 0.95, clamp(Math.abs(player.car.speed) / 40, 0, 1)) : 1.8) * (W / 360);
  const th = cam.yaw - Math.PI;
  g.clearRect(0, 0, W, W); g.save(); g.beginPath(); g.arc(Rr, Rr, Rr - 6, 0, TAU); g.clip();
  g.fillStyle = '#2f6e93'; g.fillRect(0, 0, W, W);
  g.translate(Rr, Rr); g.rotate(th); g.scale(zoom, zoom);
  const [mx, my] = toMap(tg.x, tg.z); g.drawImage(mapCanvas, -mx, -my);
  g.restore();
  const c = Math.cos(th), s = Math.sin(th), k = MAP.s * zoom;
  const proj = (x, z) => { const dx = (x - tg.x) * k, dz = (z - tg.z) * k; return [dx * c - dz * s, dx * s + dz * c]; };
  for (const b of radarBlips()) {
    let [rx, ry] = proj(b.x, b.z); const l = Math.hypot(rx, ry), lim = Rr - 16; let edge = false;
    if (l > lim) { if (!b.big && !b.icon) continue; rx = rx / l * lim; ry = ry / l * lim; edge = true; }
    g.fillStyle = b.c; g.strokeStyle = '#000'; g.lineWidth = 3;
    if (b.icon) { g.beginPath(); g.arc(Rr + rx, Rr + ry, 11 * W / 360, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#111'; g.font = `${14 * W / 360}px Bungee, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.icon, Rr + rx, Rr + ry + 1); }
    else { const sz = (b.big ? 10 : 6) * W / 360; g.beginPath(); if (edge) { g.arc(Rr + rx, Rr + ry, sz, 0, TAU); } else g.rect(Rr + rx - sz, Rr + ry - sz, sz * 2, sz * 2); g.fill(); g.stroke(); }
  }
  // player arrow
  const ph = player.car ? player.car.heading : player.heading, [ax, az] = [Math.sin(ph), Math.cos(ph)], arx = ax * c - az * s, ary = ax * s + az * c, an = Math.atan2(ary, arx);
  g.save(); g.translate(Rr, Rr); g.rotate(an); g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 3; const u = W / 360;
  g.beginPath(); g.moveTo(14 * u, 0); g.lineTo(-9 * u, -9 * u); g.lineTo(-4 * u, 0); g.lineTo(-9 * u, 9 * u); g.closePath(); g.stroke(); g.fill(); g.restore();
  // north
  const [nx, ny] = (() => { const dx = 0, dz = -1; const rx = dx * c - dz * s, ry = dx * s + dz * c; return [rx * (Rr - 14), ry * (Rr - 14)]; })();
  g.fillStyle = '#f4efe4'; g.font = `${18 * W / 360}px Bungee, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText('N', Rr + nx, Rr + ny); g.fillText('N', Rr + nx, Rr + ny);
  g.beginPath(); g.arc(Rr, Rr, Rr - 6, 0, TAU); g.lineWidth = 8; g.strokeStyle = '#0a0d12'; g.stroke(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.35)'; g.stroke();
}
function sizeFullmap() { const c = $('fullmap'); c.width = innerWidth * Math.min(2, devicePixelRatio || 1); c.height = innerHeight * Math.min(2, devicePixelRatio || 1); if (game.state === 'map') drawFullmap(); }
const LABELS = [[-160, 160, 'Pl. Catalunya'], [240, -360, 'Sagrada Família'], [480, -30, 'Glòries'], [-860, 360, 'Montjuïc'], [-100, -780, 'Park Güell'], [0, -1040, 'Tibidabo'], [-820, -250, 'Estadi'], [-205, 262, 'La Rambla'], [250, 300, 'Barceloneta'], [-300, 300, 'El Raval'], [-40, 372, 'Gòtic'], [600, 380, 'Platja'], [320, -500, 'Sant Pau'], [-200, -320, 'Eixample'], [-300, -420, 'Diagonal'], [600, -150, 'Poblenou'], [160, 60, 'Arc de Triomf']];
function drawFullmap() {
  const c = $('fullmap'), g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#081019'; g.fillRect(0, 0, W, H);
  const sc = Math.min(W / mapCanvas.width, H / mapCanvas.height) * 0.94, ox = (W - mapCanvas.width * sc) / 2, oy = (H - mapCanvas.height * sc) / 2;
  g.drawImage(mapCanvas, ox, oy, mapCanvas.width * sc, mapCanvas.height * sc);
  const P2 = (x, z) => { const [mx, my] = toMap(x, z); return [ox + mx * sc, oy + my * sc]; };
  const u = Math.max(1, W / 1400);
  g.font = `600 ${15 * u}px 'Barlow Condensed', Arial, sans-serif`; g.textAlign = 'center';
  for (const [x, z, t] of LABELS) { const [X, Y] = P2(x, z); g.lineWidth = 4 * u; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(t, X, Y); g.fillStyle = '#f4efe4'; g.fillText(t, X, Y); }
  for (const b of radarBlips()) { const [X, Y] = P2(b.x, b.z); g.fillStyle = b.c; g.strokeStyle = '#000'; g.lineWidth = 2 * u; g.beginPath(); g.arc(X, Y, (b.icon || b.big ? 8 : 5) * u, 0, TAU); g.fill(); g.stroke(); if (b.icon) { g.fillStyle = '#111'; g.font = `${10 * u}px Bungee, Impact, sans-serif`; g.textBaseline = 'middle'; g.fillText(b.icon, X, Y + 1); g.textBaseline = 'alphabetic'; g.font = `600 ${15 * u}px 'Barlow Condensed', Arial, sans-serif`; } }
  const tg = player.car ? player.car.pos : player.pos, [X, Y] = P2(tg.x, tg.z), ph = player.car ? player.car.heading : player.heading;
  g.save(); g.translate(X, Y); g.rotate(Math.atan2(Math.cos(ph), Math.sin(ph))); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(12 * u, 0); g.lineTo(-8 * u, -8 * u); g.lineTo(-3 * u, 0); g.lineTo(-8 * u, 8 * u); g.closePath(); g.stroke(); g.fill(); g.restore();
  g.fillStyle = '#f2c230'; g.font = `${24 * u}px 'Bungee Shade', Bungee, Impact, sans-serif`; g.textAlign = 'left'; g.fillText('BARCELONA', 24 * u, 44 * u);
  g.fillStyle = '#a7b0bd'; g.font = `600 ${16 * u}px 'Barlow Condensed', Arial, sans-serif`;
  g.fillText(`Panots ${game.panots.length}/20  ·  Story ${Math.min(game.mission, MISSIONS.length)}/${MISSIONS.length}  ·  M or Esc closes`, 24 * u, 70 * u);
  const leg = [['#f2c230', 'Story mission'], ['#6fd36f', 'Bar (B) · Armeria (A) · Roba / clothes (R)'], ['#5fb2e0', 'Street race (C)'], ['#ef8a2a', 'Destrucció rampage (D)'], ['#e0574a', 'Metro (M)'], ['#b06ae0', 'Telefèric cable car (T)'], ['#e9e2d0', 'Pinta Ràpid (P) · Hospital (H)'], ['#ff3a3a', 'Police']];
  leg.forEach(([c2, t], i) => { const y = H - (24 + i * 24) * u; g.fillStyle = c2; g.beginPath(); g.arc(32 * u, y - 5 * u, 7 * u, 0, TAU); g.fill(); g.fillStyle = '#f4efe4'; g.fillText(t, 48 * u, y); });
}
function openMap() { game.state = 'map'; $('fullmap').hidden = false; sizeFullmap(); drawFullmap(); if (document.exitPointerLock) document.exitPointerLock(); }
function closeMap() { game.state = 'play'; $('fullmap').hidden = true; $('hud').classList.add('on'); }
$('fullmap').addEventListener('click', closeMap);
function pause() {
  setPrompt(''); $('hud').classList.remove('on');
  game.state = 'pause'; $('pause').hidden = false; if (document.exitPointerLock) document.exitPointerLock();
  $('pause-stats').textContent = `€${player.money.toLocaleString('en')} · ${Math.min(game.mission, MISSIONS.length)} of ${MISSIONS.length} story jobs · ${game.panots.length} of 20 panots · ${district(player.pos.x, player.pos.z)}. Street record: ${game.stats.props} things smashed, ${game.stats.ko} people knocked down, ${game.stats.fights} brawls witnessed, ${game.stats.fares || 0} taxi fares, ${game.stats.races || 0} races won.`;
  $('b-resume').focus();
}
function resume() { game.state = 'play'; $('pause').hidden = true; $('hud').classList.add('on'); cv.focus(); }
function toggleMute() { AU.muted = !AU.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : 0.7; $('b-mute').textContent = AU.muted ? 'So: no' : 'So: sí'; }
$('b-resume').addEventListener('click', resume);
$('b-map').addEventListener('click', () => { $('pause').hidden = true; openMap(); });
$('b-mute').addEventListener('click', toggleMute);
$('b-gfx').addEventListener('click', () => setGfx((gfx + 2) % 3, true));

// ====================== MAIN LOOP ======================
let last = performance.now(), lastZone = '', zoneT = 0, hudT = 0, saveT = 0;
function update(dt) {
  updateSky(dt);
  updatePlayer(dt);
  for (const v of vehicles) { if (v.driver !== 'player') aiUpdate(v, dt); }
  for (let i = vehicles.length - 1; i >= 0; i--) { const v = vehicles[i]; const far = d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z) > 260 * 260; if (!far || v.mission) v.physics(dt); }
  vehicleInteractions(dt);
  updatePeds(dt);
  updateLife(dt);
  updateActs(dt);
  updateTransport(dt);
  updateTrafficPool(dt);
  updateWanted(dt);
  updatePickups(dt);
  updateMission(dt);
  updateSpray(dt);
  fx.update(dt);
  for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; t.l.material.opacity = t.t / 0.08; if (t.t <= 0) { scene.remove(t.l); t.l.geometry.dispose(); tracers.splice(i, 1); } }
  if (flagMesh) flagMesh.rotation.y = Math.sin(now * 0.002) * 0.3;
  if (ferris) ferris.rotation.z += dt * 0.1;
  for (let i = 0; i < boats.length; i++) boats[i].position.y = WATER_Y + 0.6 + Math.sin(now * 0.0015 + i) * 0.15;
  // subtitles
  subT -= dt; if (subT <= 0) { const l = subQ.shift(); if (l) { $('subtitle').innerHTML = `<b>${l[0]}:</b> ${l[1]}`; subT = Math.max(3.2, l[1].length * 0.055); } else $('subtitle').textContent = ''; }
  // district name
  zoneT -= dt; if (zoneT <= 0) { zoneT = 0.5; const tg = player.car ? player.car.pos : player.pos; const z = district(tg.x, tg.z); if (z !== lastZone) { lastZone = z; flash('zone', z, 3000); } }
  // HUD
  hudT -= dt; if (hudT <= 0) { hudT = 0.1;
    $('hbar').firstElementChild.style.width = clamp(player.health, 0, 100) + '%';
    $('abar').hidden = player.armor <= 0; $('abar').firstElementChild.style.width = clamp(player.armor, 0, 100) + '%';
    player.shownMoney += Math.sign(player.money - player.shownMoney) * Math.max(1, Math.ceil(Math.abs(player.money - player.shownMoney) * 0.2));
    if (Math.abs(player.money - player.shownMoney) < 1) player.shownMoney = player.money;
    $('money').textContent = '€' + String(Math.max(0, player.shownMoney | 0)).padStart(8, '0');
    const w = wantedLevel(); $('stars').innerHTML = '<b>' + '★'.repeat(w) + '</b>' + '★'.repeat(5 - w);
  }
  saveT -= dt; if (saveT <= 0) { saveT = 30; writeSave(); }
  // audio
  if (AU.ctx) {
    const t = AU.ctx.currentTime;
    if (player.car && !player.car.dead) { const v = player.car, sp = Math.abs(v.speed), g = (sp % 13) / 13; const f = 48 + g * 70 + sp * 1.4 + (v.t.moto ? 40 : 0); AU.eng.frequency.setTargetAtTime(f, t, 0.05); AU.eng2.frequency.setTargetAtTime(f * 0.502, t, 0.05); AU.engG.gain.setTargetAtTime(0.045 + Math.abs(v.inT) * 0.035, t, 0.1); }
    else AU.engG.gain.setTargetAtTime(0, t, 0.1);
    const [cd] = nearestCop(player.pos.x, player.pos.z); AU.sirG.gain.setTargetAtTime(wantedLevel() > 0 ? 0.06 * clamp(1 - cd / 220, 0, 1) : 0, t, 0.2);
    radioTick();
  }
}
let attractA = 0;
function attract(dt) {
  attractA += dt * 0.05;
  const r = 260, cx = 120, cz = -180;
  camera.position.set(cx + Math.cos(attractA) * r, 120, cz + Math.sin(attractA) * r); camera.lookAt(240, 60, -320);
  updateSky(dt * 0.5);
}
let fpsAcc = 0, fpsN = 0, lowered = false;
const GFX_NAMES = ['baixos', 'mitjans', 'alts'];
let gfx = 2, gfxChosen = false;
try { const v = localStorage.getItem('ciutat-comtal-gfx'); if (v !== null && GFX_NAMES[+v]) { gfx = +v; gfxChosen = true; } } catch (e) { /* storage unavailable */ }
function setGfx(level, chosen) {
  gfx = level; lowered = level === 0; if (chosen) { gfxChosen = true; try { localStorage.setItem('ciutat-comtal-gfx', String(level)); } catch (e) { /* ignore */ } }
  renderer.setPixelRatio(level === 2 ? Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5) : 1);
  const sz = level === 2 && !coarse ? 2048 : 1024;
  renderer.shadowMap.enabled = level > 0;
  if (sun.shadow.map && sun.shadow.mapSize.x !== sz) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.mapSize.set(sz, sz);
  post.enabled = level > 0; post.resize();
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  const b = document.getElementById('b-gfx'); if (b) b.textContent = 'Gràfics: ' + GFX_NAMES[level];
}
function frame(t) {
  requestAnimationFrame(frame);
  const tc0 = performance.now(); renderer.info.reset();
  const dt = Math.min(0.05, (t - last) / 1000); last = t; now = t;
  if (game.state === 'play') update(dt);
  else if (game.state === 'title') attract(dt);
  else if (game.state === 'metro' && ride) updateMetro(dt);
  if (game.state !== 'title' && game.state !== 'metro') updateCamera(game.state === 'play' ? dt : 0);
  if (game.state === 'metro' && metroScene) post.render(metroScene, metroCam); else post.render(scene, camera);
  if (game.state === 'play') updatePerf(frame.lt ? (t - frame.lt) / 1000 : 0.016, performance.now() - tc0); frame.lt = t;   // real elapsed time, not the physics-capped dt
  if (game.state === 'play') { drawRadar(); fpsAcc += dt; fpsN++; if (fpsN === 120) { if (fpsAcc / fpsN > 1 / 30 && !gfxChosen && gfx > 0) { setGfx(gfx - 1, false); toast('Graphics lowered to <b>' + GFX_NAMES[gfx] + '</b> to keep the game smooth. Change it in the pause menu (P).'); } fpsAcc = 0; fpsN = 0; } }
}

// ====================== BOOT ======================
function buildWorld() {
  genEixample(); genOldTown(); genOutskirts(); buildLandmarks(); genRoads(); genStreetFurniture();
  buildGround();
  wallMat = new THREE.MeshLambertMaterial({ map: facadeDay, vertexColors: true, emissive: 0xffffff, emissiveMap: facadeNight, emissiveIntensity: 0 });
  wallAcc.mesh(wallMat);
  const shopMat = new THREE.MeshLambertMaterial({ map: shopTex, vertexColors: true, emissive: 0xffffff, emissiveMap: shopNight, emissiveIntensity: 0 }); nightMats.push({ m: shopMat, max: 1.1 });
  shopAcc.mesh(shopMat);
  trimAcc.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  roofAcc.mesh(new THREE.MeshLambertMaterial({ map: roofTex, vertexColors: true }));
  sideAcc.mesh(new THREE.MeshLambertMaterial({ map: panotTex, vertexColors: true }), false);
  const mm = new THREE.MeshLambertMaterial({ map: markTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  markAcc.mesh(mm, false).renderOrder = 1;
  lineAcc.mesh(new THREE.MeshLambertMaterial({ map: lineTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false);
  diagAcc.mesh(new THREE.MeshLambertMaterial({ map: diagTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false);
  buildInstanced(); registerProps(); buildBirds(); buildTrafficLights(); buildSkids(); buildBusStops(); buildStars(); buildMapCanvas();
}
function boot(hot) {
  buildWorld();
  player.human = makeHuman({ skin: '#c99b78', shirt: '#e8e3d6', jacket: '#2a7f7a', pants: '#2b3a55', hair: '#1d1712', hairStyle: 'curly', shoes: '#e8e6df', build: 1.05, height: 1.02 });
  { const pg = new THREE.Mesh(bx(0.2, 0.06, 0.02), lam('#c8a24a')); pg.position.set(0, 1.12, 0.16); player.human.body.add(pg); }
  player.human.g.position.copy(player.pos);
  for (let i = 0; i < 12; i++) spawnTraffic(30, 220, 'traffic');
  for (let i = 0; i < 10; i++) spawnTraffic(20, 160, 'parked');
  drawWeaponIcon();
  if (gfx !== 2) setGfx(gfx, false); else { const b = document.getElementById('b-gfx'); if (b) b.textContent = 'Gràfics: alts'; }
  const saved = (hot && hot.save) || loadSave();
  $('title-status').textContent = saved && (saved.mission > 0 || saved.money > 0) ? `Saved game: ${Math.min(saved.mission, MISSIONS.length)} of ${MISSIONS.length} story jobs, €${(saved.money || 0).toLocaleString('en')}, ${(saved.panots || []).length} panots.` : 'Ready. Sound starts when you press a key or click.';
  if (saved && (saved.mission > 0 || saved.money > 0)) $('b-cont').hidden = false;
  const begin = s => {
    auInit();
    game.mission = s ? clamp(s.mission | 0, 0, MISSIONS.length) : 0; player.money = s ? Math.max(0, s.money | 0) : 0; player.shownMoney = player.money;
    game.panots = s && Array.isArray(s.panots) ? s.panots.filter(n => Number.isInteger(n)) : [];
    player.hasPistol = !!(s && s.hasPistol); player.hasBat = !!(s && s.hasBat); if (s && s.stats) Object.assign(game.stats, s.stats); player.ammo = s ? Math.max(0, s.ammo | 0) : 0; if (s && typeof s.time === 'number') game.time = s.time;
    PANOT_SPOTS.forEach((sp, i) => { if (game.panots.includes(i)) return; const f = freeSpot(sp[0], sp[1], 1); addPickup('panot', f[0], f[1], { id: i }); });
    if (s) { player.armor = clamp(+s.armor || 0, 0, 100); if (s.outfit > 0 && OUTFITS[s.outfit]) setOutfit(s.outfit);
      if (Array.isArray(s.pos) && s.pos.length === 3 && s.pos.every(Number.isFinite) && groundH(s.pos[0], s.pos[1]) > WATER_Y && !collideWorld(s.pos[0], s.pos[1], 0.6)) { player.pos.set(s.pos[0], surfH(s.pos[0], s.pos[1]), s.pos[1]); player.heading = s.pos[2]; player.human.g.position.copy(player.pos); } }
    $('title').hidden = true; $('hud').classList.add('on'); game.state = 'play'; cam.yaw = player.heading;
    refreshGiver(); drawWeaponIcon(); cv.focus();
    if (!s || game.mission === 0) { setTimeout(() => say([['Nil', 'Six years. Plaça de Catalunya still smells like churros and diesel.'], ['Nil', 'Marta said to meet her by the yellow light.']]), 1200); }
    else toast(MISSIONS[game.mission] ? `Next job: <b>${MISSIONS[game.mission].title}</b>. Follow the yellow beam on the radar.` : 'The story is done. Free roam: hunt the remaining panots.');
  };
  $('b-new').addEventListener('click', () => { if (loadSave() && !confirmNew()) return; begin(null); writeSave(); });
  $('b-cont').addEventListener('click', () => begin(loadSave() || (hot && hot.save)));
  let armed = false;
  function confirmNew() { if (armed) return true; armed = true; $('b-new').textContent = 'Overwrite save?'; setTimeout(() => { armed = false; $('b-new').textContent = 'Nova partida'; }, 3000); return false; }
  // fixed pickups
  addPickup('health', 320, -452); addPickup('health', 230, 408);
  const gp = freeSpot(-300, 300, 1); addPickup('pistol', gp[0], gp[1]);
  for (const [bx2, bz] of [[-230, 260], [650, 400]]) { const f = freeSpot(bx2, bz, 1); addPickup('bat', f[0], f[1]); }
  attachHeld(); buildPlaces(); buildCableCar(); buildMetro();
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: saveObj() })); } catch (e) { /* no hot reload */ }
  $('b-new').focus();
  requestAnimationFrame(frame);
  window.__game = { BUS_STOPS, metroSt, STATIONS_CC, DOCKS, rideRef: () => ride, Vehicle, skidCount: () => skidI, act, RACES, raceJob, startActivity, toggleVehicleJob, placeMarkers, buyItem, heliRef: () => heli, lights, togglePerf, setOutfit, fireworkBurst, props, breakProp, startPedFight, startSnatch, spawnGroup, birds, meleeAttack, updateFootCops, cam, renderer, setTime: t => { game.time = t; }, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { now += dt * 1000; update(dt); } updateCamera(0); }, keys, pickups, crime, explode, openMap, closeMap, drawFullmap, player, vehicles, peds, game, mission, MISSIONS, enterExit, startMission, solidAt, groundH, district, spawnTraffic, wantedLevel, setHeat: h => { game.heat = h; } };
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
})();
