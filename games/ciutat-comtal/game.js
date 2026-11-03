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
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, 2600);
scene.fog = new THREE.Fog(0xc4dceb, 280, 1500);
const hemi = new THREE.HemisphereLight(0xe4f0ff, 0x7d6f5a, 0.65); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 520 });
sun.shadow.bias = -0.0007;
scene.add(sun); scene.add(sun.target);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); sizeFullmap(); });

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
const facadeDay = canvasTex(512, 512, g => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const x = c * 64, y = r * 64;
    g.fillStyle = 'rgba(70,50,30,0.07)'; g.fillRect(x, y + 59, 64, 5);
    g.fillStyle = '#d6d0c4'; g.fillRect(x + 14, y + 8, 36, 50);
    g.fillStyle = '#26303b'; g.fillRect(x + 17, y + 11, 30, 46);
    g.fillStyle = 'rgba(150,185,215,0.35)'; g.fillRect(x + 17, y + 11, 11, 46);
    if (rnd() < 0.55) {
      g.fillStyle = pick(['#3f6e50', '#527d5c', '#7b5236', '#46627e', '#6b7a3e']);
      const rects = rnd() < 0.5 ? [[x + 17, y + 11, 30, 24]] : [[x + 17, y + 11, 8, 46], [x + 39, y + 11, 8, 46]];
      for (const q of rects) { g.fillRect(q[0], q[1], q[2], q[3]); g.fillStyle = 'rgba(0,0,0,0.22)'; for (let k = q[1] + 2; k < q[1] + q[3]; k += 4) g.fillRect(q[0], k, q[2], 1); g.fillStyle = pick(['#3f6e50', '#527d5c', '#7b5236']); }
    }
    g.fillStyle = '#b8b0a2'; g.fillRect(x + 9, y + 55, 46, 4);
    g.strokeStyle = '#1e1e1e'; g.lineWidth = 1.6; g.beginPath();
    g.moveTo(x + 10, y + 41); g.lineTo(x + 54, y + 41);
    for (let k = 0; k <= 8; k++) { const xx = x + 10 + k * 5.5; g.moveTo(xx, y + 41); g.lineTo(xx, y + 55); }
    g.stroke();
  }
});
const facadeNight = canvasTex(512, 512, g => {
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (rnd() < 0.36) { const w = rnd(); g.fillStyle = w < 0.7 ? '#ffcf7a' : w < 0.9 ? '#fff0c4' : '#9fd0ff'; g.fillRect(c * 64 + 17, r * 64 + 11, 30, 46); }
  }
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
  tri(A, B, C, N, ua, ub, uc, col) {
    const abx = B[0] - A[0], aby = B[1] - A[1], abz = B[2] - A[2], acx = C[0] - A[0], acy = C[1] - A[1], acz = C[2] - A[2];
    const cx = aby * acz - abz * acy, cy = abz * acx - abx * acz, cz = abx * acy - aby * acx;
    if (cx * N[0] + cy * N[1] + cz * N[2] < 0) { this.v(A, N, ua, col); this.v(C, N, uc, col); this.v(B, N, ub, col); }
    else { this.v(A, N, ua, col); this.v(B, N, ub, col); this.v(C, N, uc, col); }
  }
  quad(A, B, C, D, N, ua, ub, uc, ud, col) { this.tri(A, B, C, N, ua, ub, uc, col); this.tri(A, C, D, N, ua, uc, ud, col); }
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
    wall.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [nx, 0, nz], [0, 0], [cu, 0], [cu, vTop], [0, vTop], col);
  }
  if (roof) {
    const s = opt.roofUV || 4;
    for (let i = 1; i < n - 1; i++) roof.tri([poly[0][0], y1, poly[0][1]], [poly[i][0], y1, poly[i][1]], [poly[i + 1][0], y1, poly[i + 1][1]], UP,
      [poly[0][0] / s, poly[0][1] / s], [poly[i][0] / s, poly[i][1] / s], [poly[i + 1][0] / s, poly[i + 1][1] / s], rcol);
  }
}
const C3 = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const wallAcc = new Acc(), roofAcc = new Acc(), sideAcc = new Acc(), markAcc = new Acc(), lineAcc = new Acc(), diagAcc = new Acc();
const PAL_EIX = ['#efe3c8', '#e7cf9f', '#e9c9b4', '#dcd5c6', '#f0e2b0', '#d9a983', '#e6dccb', '#cfc2a8', '#e3b9a0'];
const PAL_OLD = ['#e0c38c', '#d9a66e', '#e8d3a8', '#c98f69', '#e3d9c3', '#d4b48a', '#c9a27a'];
const PAL_ROOF = ['#b3ab9c', '#a59c8c', '#bfb8aa', '#b56a4c'];
const PAL_MOD = ['#cfd6dc', '#b9c3cc', '#e2e2dc', '#a9b4bd', '#d8cfc0'];
const SIDE_COL = [1, 1, 1];
function building(poly, floors, col, rcol, solid = true) {
  const c = polyCentroid(poly), base = Math.max(0, groundH(c[0], c[1]));
  const top = base + floors * 3.4 + 0.3;
  prism(wallAcc, roofAcc, poly, base - 1.2, top, col, rcol);
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
const treeSpots = [], palmSpots = [], pineSpots = [], lampSpots = [];
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
  // plane trees (plàtans)
  const trunkG = new THREE.CylinderGeometry(0.22, 0.32, 4.4, 6); trunkG.translate(0, 2.2, 0);
  const crownG = new THREE.IcosahedronGeometry(2.7, 0); crownG.translate(0, 5.6, 0);
  make(trunkG, lam('#8a7a62'), treeSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); });
  const crownFn = (sp, i) => { const k = 0.85 + ((i * 7919) % 100) / 300; p.set(sp[0], CURB, sp[1]); q.setFromAxisAngle(THREE.Object3D.DefaultUp, i); s.set(k, k * 0.9, k); };
  crownFn.col = i => col.setHSL(0.22 + ((i * 31) % 10) / 160, 0.45, 0.32 + ((i * 17) % 10) / 90);
  make(crownG, new THREE.MeshLambertMaterial({ color: 0xffffff }), treeSpots, crownFn);
  // palms
  const palmT = new THREE.CylinderGeometry(0.2, 0.32, 9, 6); palmT.translate(0, 4.5, 0);
  const palmC = new THREE.ConeGeometry(3.2, 1.6, 7); palmC.translate(0, 9.2, 0);
  make(palmT, lam('#9b8466'), palmSpots, sp => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.identity(); s.set(1, 1, 1); });
  make(palmC, lam('#4f8a3c'), palmSpots, sp => { p.set(sp[0], groundH(sp[0], sp[1]), sp[1]); q.identity(); s.set(1, 1, 1); });
  // pines on the hills
  const pineG = new THREE.ConeGeometry(2.6, 7.5, 6); pineG.translate(0, 5, 0);
  const pineTr = new THREE.CylinderGeometry(0.25, 0.3, 2.4, 5); pineTr.translate(0, 1.2, 0);
  const pf = (sp, i) => { const k = 0.8 + (i % 7) / 10; p.set(sp[0], groundH(sp[0], sp[1]) - 0.2, sp[1]); q.identity(); s.set(k, k, k); };
  make(pineG, lam('#3e6b3a'), pineSpots, pf);
  make(pineTr, lam('#6d5843'), pineSpots, pf, false);
  // street lamps
  const poleG = new THREE.CylinderGeometry(0.09, 0.13, 6.5, 5); poleG.translate(0, 3.25, 0);
  const headG = new THREE.BoxGeometry(0.7, 0.35, 0.7); headG.translate(0, 6.6, 0);
  make(poleG, lam('#2b3036'), lampSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); }, false);
  lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x8a8a80 });
  make(headG, lampHeadMat, lampSpots, sp => { p.set(sp[0], CURB, sp[1]); q.identity(); s.set(1, 1, 1); }, false);
}
let lampHeadMat;

// ---------- ground & water ----------
function groundColor(x, z, h) {
  if (h < WATER_Y - 0.3) return C3('#4a7a78');
  const sand = (x > 370 && z > 292) || (x > 120 && z > 411 && x <= 370);
  if (sand && h < 2) return C3('#e0cc95');
  if (h > 2.5) { const k = clamp((h - 2.5) / 120, 0, 1); const c = new THREE.Color('#628d47').lerp(new THREE.Color('#7b8656'), k); c.offsetHSL(0, 0, (Math.sin(x * 0.05) * Math.cos(z * 0.06)) * 0.03); return [c.r, c.g, c.b]; }
  if (z > 204 && x > -470 && x < 370 && z < 432) return C3('#8b8478');
  if (x < -610 && d2(x, z, -820, -250) < 130 * 130) return C3('#5f8c4a');
  return C3('#505257');
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
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  const wgeo = new THREE.PlaneGeometry(5200, 4200); wgeo.rotateX(-Math.PI / 2);
  water = new THREE.Mesh(wgeo, new THREE.MeshPhongMaterial({ color: 0x2b7da3, specular: 0x9fd8ff, shininess: 60, transparent: true, opacity: 0.88 }));
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
    const fish = mesh(new THREE.SphereGeometry(1, 14, 8), gold, 480, 22, 345); fish.scale.set(22, 8, 6);
    const tail = mesh(new THREE.ConeGeometry(7, 10, 4), gold, 503, 22, 345); tail.rotation.z = Math.PI / 2;
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
const SKINS = ['#f1c9a5', '#d9a77f', '#b07850', '#8a5a3a', '#e8b896', '#6b4430'];
const SHIRTS = ['#d6372b', '#2b5fa8', '#e8e3d6', '#3c9a5f', '#e2b230', '#7b4a8f', '#1e1e22', '#e07a4a', '#5fb2e0', '#c9c3b5'];
const PANTS = ['#2b3a55', '#3a3a3a', '#6b5a42', '#1e2430', '#8a8070', '#2f4f3a'];
const boxG = {};
function bx(w, h, d) { const k = w + ',' + h + ',' + d; return boxG[k] || (boxG[k] = new THREE.BoxGeometry(w, h, d)); }
function makeHuman(o) {
  const g = new THREE.Group();
  const skin = lam(o.skin), shirt = lam(o.shirt), pants = lam(o.pants), hair = lam(o.hair || '#2a1f18');
  const limb = (w, h, d, mat, x, y) => { const piv = new THREE.Group(); piv.position.set(x, y, 0); const m = new THREE.Mesh(bx(w, h, d), mat); m.position.y = -h / 2; m.castShadow = true; piv.add(m); g.add(piv); return piv; };
  const legL = limb(0.22, 0.88, 0.24, pants, -0.13, 0.9), legR = limb(0.22, 0.88, 0.24, pants, 0.13, 0.9);
  const torso = new THREE.Mesh(bx(0.56, 0.66, 0.3), shirt); torso.position.y = 1.24; torso.castShadow = true; g.add(torso);
  const armL = limb(0.16, 0.64, 0.18, shirt, -0.37, 1.54), armR = limb(0.16, 0.64, 0.18, shirt, 0.37, 1.54);
  const hand = new THREE.Mesh(bx(0.14, 0.14, 0.14), skin); hand.position.y = -0.68; armR.add(hand);
  const handL = new THREE.Mesh(bx(0.14, 0.14, 0.14), skin); handL.position.y = -0.68; armL.add(handL);
  const head = new THREE.Mesh(bx(0.32, 0.34, 0.32), skin); head.position.y = 1.76; head.castShadow = true; g.add(head);
  const hr = new THREE.Mesh(bx(0.34, 0.1, 0.34), hair); hr.position.y = 1.95; g.add(hr);
  if (o.cap) { const cap = new THREE.Mesh(bx(0.36, 0.1, 0.46), lam(o.cap)); cap.position.set(0, 1.97, 0.05); g.add(cap); }
  scene.add(g);
  return { g, legL, legR, armL, armR };
}
function animHuman(h, phase, amt, punch) {
  const s = Math.sin(phase) * 0.75 * amt;
  h.legL.rotation.x = s; h.legR.rotation.x = -s; h.armL.rotation.x = -s * 0.8;
  h.armR.rotation.x = punch > 0 ? -1.5 * Math.sin(punch * Math.PI) - 0.2 : s * 0.8;
}
function randomLook() { return { skin: pR(SKINS), shirt: pR(SHIRTS), pants: pR(PANTS), hair: pR(['#2a1f18', '#5a3a22', '#c8b07a', '#1a1a1a', '#8a8a8a', '#a0522d']) }; }
function disposeGroup(g) { scene.remove(g); }

// ====================== VEHICLES ======================
const VT = {
  picolo: { name: 'Rossa Pícolo', len: 3.9, wid: 1.72, h: 1.45, acc: 14, max: 40, grip: 7, mass: 1, hp: 900, cols: ['#c8342b', '#2d5fa8', '#e6e1d3', '#2b8a5a', '#d9a12c', '#7a7f88', '#5a5f68'] },
  taxi: { name: 'Taxi Comtal', len: 4.5, wid: 1.8, h: 1.5, acc: 13, max: 42, grip: 7, mass: 1.1, hp: 1000, cols: ['#121214'], taxi: true },
  furgo: { name: 'Furgo Mercat', len: 5.1, wid: 2.0, h: 2.3, acc: 9.5, max: 33, grip: 6, mass: 1.8, hp: 1300, cols: ['#e8e6df', '#b8c2c8', '#3a5f8f', '#d9c9a3'], van: true },
  delfi: { name: 'Delfí GT', len: 4.4, wid: 1.9, h: 1.2, acc: 23, max: 60, grip: 8.5, mass: 1.1, hp: 900, cols: ['#e2b230', '#d63a2f', '#1c1c22', '#ececec', '#2f7fb0'] },
  patrulla: { name: 'Patrulla Comtal', len: 4.6, wid: 1.85, h: 1.5, acc: 19, max: 54, grip: 8, mass: 1.3, hp: 1200, cols: ['#f2f2f0'], police: true },
  scuter: { name: 'Scúter Gràcia', len: 1.9, wid: 0.75, h: 1.25, acc: 15, max: 38, grip: 9, mass: 0.45, hp: 420, cols: ['#c23a3a', '#3a8fc2', '#e8e3d6', '#2f2f2f', '#7fb069'], moto: true },
};
const vehicles = [];
const headMat = glowMat(0xfff2c0, null, 1.4); headMat.color.set(0xf4f0e0);
const tailMat = glowMat(0xff2a1a, null, 1.2); tailMat.color.set(0x8a1a12);
const glassMat = new THREE.MeshPhongMaterial({ color: 0x1b2633, specular: 0x88aacc, shininess: 90 });
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 10); wheelGeo.rotateZ(Math.PI / 2);
const motoWheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10); motoWheelGeo.rotateZ(Math.PI / 2);
const wheelMat = lam('#1c1c1c');
const sirenR = new THREE.MeshBasicMaterial({ color: 0xff2a2a }), sirenB = new THREE.MeshBasicMaterial({ color: 0x2a6bff }), sirenOff = new THREE.MeshBasicMaterial({ color: 0x333333 });
function makeVehicleMesh(t, col) {
  const g = new THREE.Group(); const L = t.len, W = t.wid, H = t.h, body = lam(col), wheels = [];
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  let siren = null;
  if (t.moto) {
    add(bx(0.42, 0.42, 1.2), body, 0, 0.62, -0.05); add(bx(0.38, 0.14, 0.6), lam('#222'), 0, 0.92, -0.25);
    add(bx(0.5, 0.7, 0.18), body, 0, 0.85, 0.62); add(bx(0.7, 0.06, 0.06), lam('#333'), 0, 1.25, 0.6);
    add(bx(0.12, 0.1, 0.05), headMat, 0, 1.0, 0.72); add(bx(0.18, 0.08, 0.05), tailMat, 0, 0.78, -0.66);
    for (const z of [0.68, -0.62]) { const w = add(motoWheelGeo, wheelMat, 0, 0.3, z); w.rotation.order = 'YXZ'; wheels.push(w); }
    const rider = makeHuman({ skin: pR(SKINS), shirt: pR(SHIRTS), pants: pR(PANTS), cap: '#e8e3d6' }); scene.remove(rider.g);
    rider.g.position.set(0, 0.32, -0.15); rider.legL.rotation.x = -1.2; rider.legR.rotation.x = -1.2; rider.armL.rotation.x = -1.1; rider.armR.rotation.x = -1.1; g.add(rider.g); rider.g.visible = false;
    g.userData.rider = rider.g;
  } else {
    const bh = H * 0.46, base = 0.32;
    add(bx(W, bh, L), body, 0, base + bh / 2, 0);
    const cabL = t.van ? L * 0.78 : L * 0.5, cabZ = t.van ? -L * 0.08 : -L * 0.05, cabH = H - bh - 0.32 + (t.van ? 0.05 : 0);
    add(bx(W * 0.9, cabH, cabL), glassMat, 0, base + bh + cabH / 2, cabZ);
    add(bx(W * 0.92, 0.08, cabL * 0.96), body, 0, base + bh + cabH + 0.02, cabZ);
    if (t.van) add(bx(W * 0.92, cabH * 0.9, cabL * 0.62), body, 0, base + bh + cabH * 0.47, cabZ - cabL * 0.2);
    if (t.taxi) { add(bx(W + 0.02, bh * 0.72, L * 0.46), lam('#f2c230'), 0, base + bh * 0.52, -L * 0.03); add(bx(0.5, 0.18, 0.2), lam('#38c24a', { emissive: 0x38c24a, emissiveIntensity: 0.5 }), 0, base + bh + cabH + 0.15, cabZ + 0.3); }
    if (t.police) {
      add(bx(W + 0.02, 0.26, L * 0.96), lam('#1d4f9c'), 0, base + bh * 0.55, 0);
      const r = add(bx(0.55, 0.16, 0.3), sirenR, -0.32, base + bh + cabH + 0.14, cabZ), b = add(bx(0.55, 0.16, 0.3), sirenB, 0.32, base + bh + cabH + 0.14, cabZ);
      siren = [r, b];
    }
    for (const x of [-W * 0.32, W * 0.32]) { add(bx(0.36, 0.16, 0.05), headMat, x, base + bh * 0.6, L / 2 + 0.01); add(bx(0.32, 0.14, 0.05), tailMat, x, base + bh * 0.62, -L / 2 - 0.01); }
    for (const [x, z] of [[-W / 2 + 0.08, L * 0.32], [W / 2 - 0.08, L * 0.32], [-W / 2 + 0.08, -L * 0.32], [W / 2 - 0.08, -L * 0.32]]) { const w = add(wheelGeo, wheelMat, x, 0.34, z); w.rotation.order = 'YXZ'; wheels.push(w); }
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
    if (this.health <= 0 && this.burn < 0) { this.burn = this.t.moto ? 1.5 : 4.5; if (this.driver === 'ai' || this.driver === 'cop') { const d = this.driver; this.driver = null; this.ai = null; ejectDriver(this, d === 'cop'); } }
  }
  physics(dt) {
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
    const off = t.len * 0.3, rad = t.moto ? 0.5 : t.wid * 0.56;
    for (const k of [1, -1]) {
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
    if (!this.air) { const hf = groundH(this.pos.x + s * t.len * 0.4, this.pos.z + c * t.len * 0.4), hb = groundH(this.pos.x - s * t.len * 0.4, this.pos.z - c * t.len * 0.4); pitch = Math.atan2(hb - hf, t.len * 0.8); }
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
  for (const p of peds) { const d = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z); if (d < 9) knockPed(p, (p.pos.x - v.pos.x) / d * 9, (p.pos.z - v.pos.z) / d * 9, 80, false); }
  for (const o of vehicles) if (o !== v && !o.dead) { const d = Math.hypot(o.pos.x - v.pos.x, o.pos.z - v.pos.z); if (d < 9) o.damage(500 * (1 - d / 9)); }
  v.wreckT = 40;
}

// ====================== FX (particles) ======================
const fx = (() => {
  const tex = canvasTex(64, 64, g => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }, false);
  const pool = [];
  for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.visible = false; scene.add(s); pool.push({ s, life: 0 }); }
  let idx = 0;
  const kinds = {
    smoke: { col: 0x555555, life: 1.6, s0: 0.8, s1: 3.2, vy: 2.2, add: false, op: 0.55 },
    fire: { col: 0xff7a1a, life: 0.6, s0: 1.2, s1: 0.4, vy: 3, add: true, op: 0.9 },
    boom: { col: 0xffa030, life: 0.9, s0: 2, s1: 7, vy: 3, add: true, op: 1, spread: 6 },
    spark: { col: 0xfff2a0, life: 0.18, s0: 0.5, s1: 0.1, vy: 0, add: true, op: 1, spread: 3 },
    dust: { col: 0xbfb5a0, life: 0.7, s0: 0.5, s1: 1.8, vy: 0.6, add: false, op: 0.5, spread: 1 },
    splash: { col: 0xd8f0ff, life: 0.7, s0: 0.8, s1: 2.4, vy: 4, add: false, op: 0.8, spread: 2 },
    money: { col: 0x86d98f, life: 0.8, s0: 0.6, s1: 0.1, vy: 3, add: true, op: 1, spread: 2 },
  };
  return {
    spawn(kind, x, y, z) {
      const k = kinds[kind], p = pool[idx]; idx = (idx + 1) % pool.length;
      p.k = k; p.life = k.life; p.s.visible = true; p.s.position.set(x, y, z);
      p.s.material.color.setHex(k.col); p.s.material.blending = k.add ? THREE.AdditiveBlending : THREE.NormalBlending;
      const sp = k.spread || 0.5; p.vx = rR(-sp, sp); p.vy = k.vy + rR(-0.5, 0.5); p.vz = rR(-sp, sp);
    },
    update(dt) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
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
  const nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
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
  const c = AU.ctx; if (!c) return;
  const s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
function tone(t, freq, dur, type, vol, dest, slideTo, filt) {
  const c = AU.ctx; if (!c) return;
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
function saveObj() { return { mission: game.mission, money: player.money, panots: game.panots.slice(), hasPistol: player.hasPistol, ammo: player.ammo, time: game.time }; }
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(saveObj())); } catch (e) { /* storage unavailable */ } }

// ====================== INPUT ======================
const keys = {};
const touch = { ax: 0, ay: 0, fire: false, jump: false };
const cam = { yaw: Math.PI, pitch: 0.3, lastMouse: -10, shake: 0, dist: 0 };
let mouseDown = false, pointerLocked = false;
addEventListener('keydown', e => {
  if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
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
  } else {
    g.beginPath(); g.roundRect ? g.roundRect(34, 40, 60, 50, 12) : g.rect(34, 40, 60, 50); g.fill(); g.stroke();
    g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo(49 + k * 15, 42); g.lineTo(49 + k * 15, 62); } g.moveTo(34, 64); g.lineTo(80, 64); g.stroke();
    $('ammo').textContent = '';
  }
}

// ====================== PICKUPS ======================
const pickupGeo = { money: new THREE.BoxGeometry(0.7, 0.35, 0.4), health: new THREE.BoxGeometry(0.8, 0.8, 0.25), pistol: new THREE.BoxGeometry(0.9, 0.3, 0.2), panot: new THREE.BoxGeometry(1.1, 0.12, 1.1), bag: new THREE.BoxGeometry(0.8, 0.6, 0.4) };
const panotMat = new THREE.MeshLambertMaterial({ map: panotTex, emissive: 0x332a10 });
function addPickup(type, x, z, opts) {
  opts = opts || {};
  const mat = type === 'money' ? lam('#3f9a4a', { emissive: 0x1c4a20 }) : type === 'health' ? lam('#e8e3d6', { emissive: 0x5a1010 }) : type === 'pistol' ? lam('#2b2b30', { emissive: 0x202030 }) : type === 'panot' ? panotMat : lam('#b07a3a', { emissive: 0x3a2008 });
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
  const ls = loopHash.query(px - 170, pz - 170, px + 170, pz + 170, []);
  if (!ls.length) return null;
  for (let tries = 0; tries < 8; tries++) {
    const l = ls[Math.floor(R() * ls.length)], t = R() * l.tot;
    loopPoint(l, t, _lp);
    const dd = d2(_lp[0], _lp[1], px, pz);
    if (dd < (nearOnly ? 10 * 10 : 45 * 45) || dd > 165 * 165) continue;
    const h = makeHuman(randomLook());
    const p = { h, pos: new THREE.Vector3(_lp[0], groundH(_lp[0], _lp[1]) + l.y, _lp[1]), heading: _lp[2], loop: l, t, dir: R() < 0.5 ? 1 : -1, speed: rR(1.1, 1.7), state: 'walk', health: 40, timer: 0, phase: R() * 6, vx: 0, vz: 0, vy: 0, dropped: false };
    peds.push(p); return p;
  }
  return null;
}
function removePed(p) { disposeGroup(p.h.g); const i = peds.indexOf(p); if (i >= 0) peds.splice(i, 1); }
function knockPed(p, vx, vz, dmg, byPlayer) {
  if (p.state === 'down' || p.state === 'dead') { p.vx += vx * 0.3; p.vz += vz * 0.3; return; }
  p.health -= dmg; p.state = 'down'; p.timer = 4 + R() * 2; p.vx = vx; p.vz = vz; p.vy = Math.min(8, Math.hypot(vx, vz) * 0.35);
  if (!p.dropped && R() < 0.65) { p.dropped = true; addPickup('money', p.pos.x + rR(-1, 1), p.pos.z + rR(-1, 1), { amount: Math.floor(rR(8, 60)), ttl: 40 }); }
  if (byPlayer) crime(p.health <= 0 ? 'kill' : 'hurt', p.pos.x, p.pos.z);
  scarePeds(p.pos.x, p.pos.z, 25);
}
function scarePeds(x, z, r) {
  for (const p of peds) if (p.state === 'walk' && d2(p.pos.x, p.pos.z, x, z) < r * r) { p.state = 'flee'; p.timer = 7 + R() * 4; const a = Math.atan2(p.pos.x - x, p.pos.z - z); p.heading = a; }
}
function updatePeds(dt) {
  const target = coarse ? 26 : 42;
  if (peds.length < target && game.state === 'play') spawnPed();
  const px = player.pos.x, pz = player.pos.z;
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    const far = d2(p.pos.x, p.pos.z, px, pz);
    if (far > 200 * 200) { removePed(p); continue; }
    if (p.state === 'walk') {
      p.t += p.dir * p.speed * dt;
      if (R() < dt * 0.02) p.dir = -p.dir;
      loopPoint(p.loop, p.t, _lp);
      p.pos.x = _lp[0]; p.pos.z = _lp[1]; p.pos.y = groundH(_lp[0], _lp[1]) + p.loop.y;
      p.heading = p.dir > 0 ? _lp[2] : _lp[2] + Math.PI; p.phase += dt * p.speed * 4.2;
      animHuman(p.h, p.phase, 1, 0);
      p.h.g.rotation.set(0, p.heading, 0);
    } else if (p.state === 'flee') {
      const sp = 5.2; p.heading += rR(-1, 1) * dt;
      p.pos.x += Math.sin(p.heading) * sp * dt; p.pos.z += Math.cos(p.heading) * sp * dt;
      const hit = collideWorld(p.pos.x, p.pos.z, 0.4, p.pos.y + 0.5); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; p.heading += Math.PI * 0.5 * (R() < 0.5 ? 1 : -1); }
      p.pos.y = surfH(p.pos.x, p.pos.z); p.phase += dt * 14; animHuman(p.h, p.phase, 1.3, 0);
      p.h.g.rotation.set(0, p.heading, 0);
      p.timer -= dt; if (p.timer < 0 && far > 60 * 60) { removePed(p); continue; }
    } else if (p.state === 'down' || p.state === 'dead') {
      p.pos.x += p.vx * dt; p.pos.z += p.vz * dt; p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt);
      const gy = surfH(p.pos.x, p.pos.z); p.vy -= 20 * dt; p.pos.y = Math.max(gy, p.pos.y + p.vy * dt);
      const hit = collideWorld(p.pos.x, p.pos.z, 0.4); if (hit) { p.pos.x += hit[0]; p.pos.z += hit[1]; p.vx *= -0.3; p.vz *= -0.3; }
      p.h.g.rotation.set(-Math.PI / 2 * Math.min(1, (p.rot = (p.rot || 0) + dt * 6)), p.heading, 0);
      p.timer -= dt;
      if (p.state === 'down' && p.timer < 0) { if (p.health > 0) { p.state = 'flee'; p.timer = 8; p.rot = 0; } else { p.state = 'dead'; p.timer = 25; } }
      else if (p.state === 'dead' && p.timer < 0) { removePed(p); continue; }
    }
    if (p.pos.y < WATER_Y - 0.8 && p.state !== 'dead') { p.state = 'dead'; p.timer = 5; }
    p.h.g.position.copy(p.pos);
    if (p.state === 'down' || p.state === 'dead') p.h.g.position.y += 0.15;
  }
}
function ejectDriver(v, cop) {
  const s = Math.sin(v.heading), c = Math.cos(v.heading);
  const look = cop ? { skin: pR(SKINS), shirt: '#1d4f9c', pants: '#1e2430', cap: '#1d3f73' } : randomLook();
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
  const ai = v.ai; const wp = ai.path[ai.i]; if (!wp) { v.inT = 0; v.inHB = true; return; }
  if (d2(v.pos.x, v.pos.z, wp[0], wp[1]) < (ai.radius || 10) ** 2) { ai.i++; return; }
  let tsp = ai.speed; const ob = obstacleAhead(v, 18); if (ob < 18 && ai.cautious) tsp = Math.min(tsp, Math.max(0, ob - 6));
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
    if (vehicles.some(o => d2(o.pos.x, o.pos.z, x, z) < 9 * 9) || collideWorld(x, z, 1.2) || onDiag(x, z, 17)) continue;
    const key = mode === 'cop' || mode === 'patrol' ? 'patrulla' : pR(['picolo', 'picolo', 'picolo', 'taxi', 'taxi', 'furgo', 'scuter', 'delfi', 'picolo']);
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
    for (const v of vehicles) if (cops < wantCops && v.driver === 'cop' && v.ai && v.ai.mode !== 'cop' && d2(v.pos.x, v.pos.z, px, pz) < 300 * 300) { v.ai = { mode: 'cop' }; cops++; }
    if (cops < wantCops) { const v = spawnTraffic(120, 230, 'cop') || spawnOffroadCop(); if (v) cops++; }
  } else {
    for (const v of vehicles) if (v.driver === 'cop' && v.ai && v.ai.mode === 'cop') { v.ai = trafficState(v) || { mode: 'idle' }; }
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
function nearestCop(x, z) { let b = 1e9, bv = null; for (const v of vehicles) if (v.driver === 'cop' && !v.dead) { const d = Math.hypot(v.pos.x - x, v.pos.z - z); if (d < b) { b = d; bv = v; } } return [b, bv]; }
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
    if (seen) copSeenT = 0; else copSeenT += dt;
    st.classList.toggle('blink', !seen);
    if (copSeenT > 9 + w * 4) { game.heat = w - 1; copSeenT = 0; if (wantedLevel() === 0) toast('You lost the police.'); }
    // busted
    if (!player.dead) {
      const [cd, cv2] = nearestCop(tg.x, tg.z);
      const slow = player.car ? Math.abs(player.car.speed) < 1.5 : true;
      if (cv2 && cd < (player.car ? 7 : 6.5) && slow && Math.abs(cv2.speed) < 3) { player.bustT += dt; if (player.bustT > (player.car ? 2.4 : 1.6)) bust(); }
      else player.bustT = Math.max(0, player.bustT - dt);
    }
  } else { st.classList.remove('blink'); copSeenT = 0; player.bustT = 0; }
}

// ====================== PLAYER ======================
function hurtPlayer(a, sx2, sz2) {
  if (player.dead) return;
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
    if (loseGuns) { player.hasPistol = false; player.ammo = 0; player.weapon = 0; drawWeaponIcon(); }
    game.heat = 0; player.bustT = 0;
    for (const v of vehicles.slice()) if (v.driver === 'cop' && v.ai && v.ai.mode === 'cop') v.remove();
    writeSave(); $('fade').classList.remove('on');
  }, 700);
}
function switchWeapon() { if (!player.hasPistol) { toast('You have no weapon yet. Look for one in El Raval.'); return; } player.weapon = player.weapon ? 0 : 1; drawWeaponIcon(); sfx.click(); }
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
      while (d < 60 && !solidAt(ox + s * d, oz + c * d, oy)) d += 1.5;
      hx = ox + s * d; hy = oy - Math.sin(cam.pitch) * d * 0.3; hz = oz + c * d; if (d < 60) for (let i = 0; i < 3; i++) fx.spawn('spark', hx, hy, hz);
    }
    tracer(ox + Math.sin(player.heading) * 0.6, oy, oz + Math.cos(player.heading) * 0.6, hx, hy, hz);
    fx.spawn('spark', ox + Math.sin(player.heading) * 0.8, oy, oz + Math.cos(player.heading) * 0.8);
    sfx.shot(); scarePeds(ox, oz, 40); crime('gunfire', ox, oz);
    if (player.ammo === 0) { player.weapon = 0; drawWeaponIcon(); }
  } else {
    if (player.punchT > 0) return; player.punchT = 0.45;
    let best = null, bd = 2.2;
    for (const p of peds) { if (p.state === 'dead' || p.state === 'down') continue; const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z); if (d < bd && Math.abs(wrapA(Math.atan2(p.pos.x - player.pos.x, p.pos.z - player.pos.z) - player.heading)) < 1.1) { bd = d; best = p; } }
    if (best) { const l = bd || 1; sfx.punch(); best.health -= 14; if (best.health <= 0) knockPed(best, (best.pos.x - player.pos.x) / l * 4, (best.pos.z - player.pos.z) / l * 4, 0, true); else { best.state = 'flee'; best.timer = 8; best.heading = player.heading; crime('hurt', best.pos.x, best.pos.z); if (!best.dropped && R() < 0.4) { best.dropped = true; addPickup('money', best.pos.x, best.pos.z, { amount: Math.floor(rR(5, 30)), ttl: 30 }); } } }
  }
}
function updatePlayer(dt) {
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
  if (ml > 0.1 && player.knock <= 0) {
    mx /= Math.max(1, ml); mz /= Math.max(1, ml);
    player.pos.x += mx * speed * dt; player.pos.z += mz * speed * dt;
    const want = Math.atan2(mx, mz); player.heading = wrapA(player.heading + wrapA(want - player.heading) * Math.min(1, dt * 12));
    player.anim += dt * (sprint ? 13 : 8.5);
  }
  // collisions
  const hit = collideWorld(player.pos.x, player.pos.z, 0.45, player.pos.y + 0.6); if (hit) { player.pos.x += hit[0]; player.pos.z += hit[1]; }
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
  animHuman(h, player.anim, ml > 0.1 ? (sprint ? 1.25 : 1) : 0, player.punchT > 0 && player.weapon === 0 ? player.punchT / 0.45 : 0);
  if (player.weapon === 1 && player.hasPistol && player.fireT > -1) h.armR.rotation.x = -Math.PI / 2;
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
            const dmg = Math.min(imp * imp * 0.9, 900);
            a.damage(dmg * mb / tot * 2, b.driver === 'player' ? 'player' : null); b.damage(dmg * ma / tot * 2, a.driver === 'player' ? 'player' : null);
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
        if (sp > 3.5) { knockPed(p, a.vx * 0.8 + rR(-1, 1), a.vz * 0.8 + rR(-1, 1), sp * 3, a.driver === 'player'); if (a.driver === 'player') sfx.punch(); }
        else { p.pos.x += -c * Math.sign(sd) * 0.5; p.pos.z += s * Math.sign(sd) * 0.5; }
      }
    }
  }
}

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
  const mt = $('mtimer'); if (mission.timer >= 0 && mission.run) { mt.hidden = false; const s = Math.ceil(mission.timer); mt.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); mt.style.color = s < 20 ? 'var(--vermell)' : ''; } else mt.hidden = true;
  if (mission.run) { const r = mission.run.update(dt); if (r === 'pass') passMission(); else if (r && r.startsWith('fail:')) failMission(r.slice(5)); return; }
  const g = giverPos(); if (!g || player.dead) return;
  if (mission.giverMesh) mission.giverMesh.material.opacity = 0.25 + Math.sin(now * 0.004) * 0.1;
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
      v.mesh.traverse(m => { if (m.isMesh && m.material && m.material.color && !m.material.map && m.material !== glassMat && m.material !== wheelMat && m.material !== headMat && m.material !== tailMat && !m.material.isMeshBasicMaterial && m.material.color.getHexString() === new THREE.Color(v.color || '#ffffff').getHexString()) m.material = lam(c); });
      v.color = c;
      for (const o of vehicles.slice()) if (o.driver === 'cop' && o.ai && o.ai.mode === 'cop' && d2(o.pos.x, o.pos.z, v.pos.x, v.pos.z) > 40 * 40) o.ai = trafficState(o) || { mode: 'idle' };
      $('fade').classList.remove('on'); toast('<b>Pinta Ràpid.</b> New paint, new plates. Wanted level cleared. −€100');
    }, 650);
  }
}

// ====================== DAY / NIGHT ======================
const skyDay = new THREE.Color('#8fc6ee'), skyDusk = new THREE.Color('#f0a070'), skyNight = new THREE.Color('#0b1430'), _sky = new THREE.Color();
let stars;
function buildStars() {
  const g = new THREE.BufferGeometry(), a = [];
  for (let i = 0; i < 900; i++) { const u = R() * TAU, v = R() * 0.45 + 0.05; a.push(Math.cos(u) * Math.cos(v) * 1800, Math.sin(v) * 1800, Math.sin(u) * Math.cos(v) * 1800); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })); scene.add(stars);
}
let nightAmt = 0, wallMat;
function updateSky(dt) {
  game.time = (game.time + dt) % 1440;
  const ang = TAU * (game.time - 840) / 1440, s = Math.cos(ang);   // solar noon ≈ 14:00 (CEST)
  const day = smooth(-0.12, 0.3, s), dusk = clamp(1 - Math.abs(s) / 0.22, 0, 1);
  nightAmt = 1 - day;
  _sky.copy(skyNight).lerp(skyDay, day).lerp(skyDusk, dusk * 0.55);
  scene.background = _sky; scene.fog.color.copy(_sky);
  scene.fog.near = lerp(160, 280, day); scene.fog.far = lerp(900, 1500, day);
  const sunUp = s > -0.05;
  const dx = Math.sin(ang), dy = Math.max(0.12, Math.abs(s)), dz = 0.45;
  const tg = player.car ? player.car.pos : player.pos;
  sun.position.set(tg.x + (sunUp ? dx : -dx) * 220, tg.y + dy * 220, tg.z + dz * 220); sun.target.position.copy(tg);
  sun.intensity = sunUp ? 0.25 + 0.8 * day : 0.18; sun.color.set(sunUp ? (dusk > 0.3 ? 0xffc89a : 0xfff0d8) : 0x9fb4ff);
  hemi.intensity = 0.28 + 0.42 * day; hemi.color.copy(_sky).lerp(new THREE.Color(0xffffff), 0.5);
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
    const v = player.car; tx = v.pos.x; ty = v.pos.y + (v.t.van ? 2.2 : 1.5); tz = v.pos.z;
    dist = ((v.t.moto ? 5.5 : v.t.van ? 10 : 8) + Math.abs(v.speed) * 0.05) * dm;
    if (now - cam.lastMouse > 1500 && Math.abs(v.speed) > 1.5) {
      const target = v.speed < -2 ? v.heading : v.heading;
      cam.yaw += wrapA(target - cam.yaw) * Math.min(1, dt * 2.6); cam.pitch = lerp(cam.pitch, 0.2, dt * 1.5);
    }
  } else {
    tx = player.pos.x; ty = player.pos.y + 1.7; tz = player.pos.z; dist = 5 * dm;
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
  const leg = [['#f2c230', 'Story mission'], ['#e9e2d0', 'Pinta Ràpid (P) · Hospital (H)'], ['#ff3a3a', 'Police']];
  leg.forEach(([c2, t], i) => { const y = H - (24 + i * 24) * u; g.fillStyle = c2; g.beginPath(); g.arc(32 * u, y - 5 * u, 7 * u, 0, TAU); g.fill(); g.fillStyle = '#f4efe4'; g.fillText(t, 48 * u, y); });
}
function openMap() { game.state = 'map'; $('fullmap').hidden = false; sizeFullmap(); drawFullmap(); if (document.exitPointerLock) document.exitPointerLock(); }
function closeMap() { game.state = 'play'; $('fullmap').hidden = true; }
$('fullmap').addEventListener('click', closeMap);
function pause() {
  game.state = 'pause'; $('pause').hidden = false; if (document.exitPointerLock) document.exitPointerLock();
  $('pause-stats').textContent = `€${player.money.toLocaleString('en')} · ${Math.min(game.mission, MISSIONS.length)} of ${MISSIONS.length} story jobs · ${game.panots.length} of 20 panots · ${district(player.pos.x, player.pos.z)}`;
  $('b-resume').focus();
}
function resume() { game.state = 'play'; $('pause').hidden = true; cv.focus(); }
function toggleMute() { AU.muted = !AU.muted; if (AU.master) AU.master.gain.value = AU.muted ? 0 : 0.7; $('b-mute').textContent = AU.muted ? 'So: no' : 'So: sí'; }
$('b-resume').addEventListener('click', resume);
$('b-map').addEventListener('click', () => { $('pause').hidden = true; openMap(); });
$('b-mute').addEventListener('click', toggleMute);

// ====================== MAIN LOOP ======================
let last = performance.now(), lastZone = '', zoneT = 0, hudT = 0, saveT = 0;
function update(dt) {
  updateSky(dt);
  updatePlayer(dt);
  for (const v of vehicles) { if (v.driver !== 'player') aiUpdate(v, dt); }
  for (let i = vehicles.length - 1; i >= 0; i--) { const v = vehicles[i]; const far = d2(v.pos.x, v.pos.z, player.pos.x, player.pos.z) > 260 * 260; if (!far || v.mission) v.physics(dt); }
  vehicleInteractions(dt);
  updatePeds(dt);
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
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - last) / 1000); last = t; now = t;
  if (game.state === 'play') update(dt);
  else if (game.state === 'title') attract(dt);
  if (game.state !== 'title') updateCamera(game.state === 'play' ? dt : 0);
  renderer.render(scene, camera);
  if (game.state === 'play') { drawRadar(); fpsAcc += dt; fpsN++; if (fpsN === 120) { if (fpsAcc / fpsN > 1 / 30 && !lowered) { lowered = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); } fpsAcc = 0; fpsN = 0; } }
}

// ====================== BOOT ======================
function buildWorld() {
  genEixample(); genOldTown(); genOutskirts(); buildLandmarks(); genRoads(); genStreetFurniture();
  buildGround();
  wallMat = new THREE.MeshLambertMaterial({ map: facadeDay, vertexColors: true, emissive: 0xffffff, emissiveMap: facadeNight, emissiveIntensity: 0 });
  wallAcc.mesh(wallMat);
  roofAcc.mesh(new THREE.MeshLambertMaterial({ vertexColors: true }));
  sideAcc.mesh(new THREE.MeshLambertMaterial({ map: panotTex, vertexColors: true }), false);
  const mm = new THREE.MeshLambertMaterial({ map: markTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  markAcc.mesh(mm, false).renderOrder = 1;
  lineAcc.mesh(new THREE.MeshLambertMaterial({ map: lineTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false);
  diagAcc.mesh(new THREE.MeshLambertMaterial({ map: diagTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false);
  buildInstanced(); buildStars(); buildMapCanvas();
}
function boot(hot) {
  buildWorld();
  player.human = makeHuman({ skin: '#c99b78', shirt: '#2a7f7a', pants: '#2b3a55', hair: '#1d1712' });
  player.human.g.position.copy(player.pos);
  for (let i = 0; i < 12; i++) spawnTraffic(30, 220, 'traffic');
  for (let i = 0; i < 10; i++) spawnTraffic(20, 160, 'parked');
  drawWeaponIcon();
  const saved = (hot && hot.save) || loadSave();
  $('title-status').textContent = saved && (saved.mission > 0 || saved.money > 0) ? `Saved game: ${Math.min(saved.mission, MISSIONS.length)} of ${MISSIONS.length} story jobs, €${(saved.money || 0).toLocaleString('en')}, ${(saved.panots || []).length} panots.` : 'Ready. Sound starts when you press a key or click.';
  if (saved && (saved.mission > 0 || saved.money > 0)) $('b-cont').hidden = false;
  const begin = s => {
    auInit();
    game.mission = s ? clamp(s.mission | 0, 0, MISSIONS.length) : 0; player.money = s ? Math.max(0, s.money | 0) : 0; player.shownMoney = player.money;
    game.panots = s && Array.isArray(s.panots) ? s.panots.filter(n => Number.isInteger(n)) : [];
    player.hasPistol = !!(s && s.hasPistol); player.ammo = s ? Math.max(0, s.ammo | 0) : 0; if (s && typeof s.time === 'number') game.time = s.time;
    PANOT_SPOTS.forEach((sp, i) => { if (game.panots.includes(i)) return; const f = freeSpot(sp[0], sp[1], 1); addPickup('panot', f[0], f[1], { id: i }); });
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
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ save: saveObj() })); } catch (e) { /* no hot reload */ }
  $('b-new').focus();
  requestAnimationFrame(frame);
  window.__game = { renderer, setTime: t => { game.time = t; }, step: (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { now += dt * 1000; update(dt); } updateCamera(0); }, keys, pickups, crime, explode, openMap, closeMap, drawFullmap, player, vehicles, peds, game, mission, MISSIONS, enterExit, startMission, solidAt, groundH, district, spawnTraffic, wantedLevel, setHeat: h => { game.heat = h; } };
}
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(boot); else boot(hot && hot.data ? hot.data : {});
})();
