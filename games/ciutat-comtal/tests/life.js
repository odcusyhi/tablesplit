const { chromium } = require('playwright');
const path = require('path');
const G = path.resolve(__dirname, '..');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }); if (u.startsWith('file://')) return r.continue(); return r.abort(); });
  const html = require('fs').readFileSync(G + '/index.html', 'utf8').replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  require('fs').writeFileSync(G + '/_test.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  await p.goto('file://' + G + '/_test.html'); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.click('#b-new'); await p.waitForTimeout(300);
  const E = (f, a) => p.evaluate(f, a), log = (...a) => console.log(...a);
  log('props by kind', await E(() => { const c = {}; __game.props.forEach(p => c[p.kind] = (c[p.kind] || 0) + 1); return JSON.stringify(c); }), 'birds', await E(() => __game.birds.length));
  // 1. drive a car through a lamp row: find a lamp, put a car 25 m behind it aimed at it
  const r1 = await E(() => { const g = __game, lamp = g.props.find(p => p.kind === 'lamp' && Math.abs(p.x + 120) < 200 && Math.abs(p.z) < 200);
    const car = g.spawnTraffic(0, 400, 'parked') || g.vehicles[0]; car.pos.set(lamp.x, 0, lamp.z - 25); car.ty = 0; car.heading = 0; car.vx = 0; car.vz = 0; car.parked = false;
    g.player.pos.set(car.pos.x + 1.5, 0.2, car.pos.z); g.enterExit(); const before = g.game.stats.props;
    g.keys.KeyW = true; for (let i = 0; i < 120 && !lamp.broken; i++) { const c = g.player.car; c.heading = Math.atan2(lamp.x - c.pos.x, lamp.z - c.pos.z); g.step(1); } g.keys.KeyW = false; g.step(20);
    return { broke: lamp.broken, stats: g.game.stats.props - before, carHp: Math.round(g.player.car.health) }; });
  log('car vs lamp', JSON.stringify(r1));
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'lamp.png') });
  // 2. melee combo on a ped
  const r2 = await E(() => { const g = __game; g.enterExit(); g.step(5); const ped = g.peds.find(q => q.state === 'walk'); ped.tough = false; ped.health = 40;
    g.player.pos.set(ped.pos.x, ped.pos.y, ped.pos.z - 1.2); g.player.heading = 0; const out = [];
    for (let k = 0; k < 3; k++) { ped.pos.set(g.player.pos.x, ped.pos.y, g.player.pos.z + 1.2); if (ped.state !== 'down') ped.state = 'idle'; ped.timer = 9; g.meleeAttack(); out.push(g.player.atk && g.player.atk.kind); g.step(18); out.push(ped.state + ':' + Math.round(ped.health)); }
    return out; });
  log('combo', JSON.stringify(r2));
  // 3. bat vs bin/bench/hydrant
  const r3 = await E(() => { const g = __game; g.player.hasBat = true; g.player.weapon = 2; const res = {};
    for (const kind of ['bin', 'bench', 'hydrant']) { const pr = g.props.find(q => q.kind === kind && !q.broken); g.player.pos.set(pr.x, 0.2, pr.z - 1.6); g.player.heading = 0; g.step(2); g.player.pos.set(pr.x, 0.2, pr.z - 1.6); g.player.heading = 0; g.meleeAttack(); g.step(25); res[kind] = pr.broken; }
    return res; });
  log('bat', JSON.stringify(r3));
  await E(() => __game.step(30)); await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'geyser.png') });
  // 4. events
  const r4 = await E(() => { const g = __game; g.player.pos.set(-160, 0.2, 300); g.player.weapon = 0; g.step(200); const f = g.startPedFight(), s = g.startSnatch(), gr = g.spawnGroup(); g.step(90);
    const st = {}; g.peds.forEach(q => st[q.state] = (st[q.state] || 0) + 1); return { fight: f, snatch: s, group: gr, states: st }; });
  log('events', JSON.stringify(r4));
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'events.png') });
  // 5. foot cops
  const r5 = await E(() => { const g = __game; g.setHeat(2); g.step(30 * 12); const cops = g.peds.filter(q => q.cop); const near = cops.map(c => Math.round(Math.hypot(c.pos.x - g.player.pos.x, c.pos.z - g.player.pos.z)));
    return { footCops: cops.length, states: cops.map(c => c.state), dist: near, hp: Math.round(g.player.health), dead: g.player.dead }; });
  log('foot cops', JSON.stringify(r5));
  await p.screenshot({ path: path.join(__dirname, 'out', 'cops.png') });
  await p.waitForTimeout(4500);
  // 6. pigeons scatter & fireworks
  const r6 = await E(() => { const g = __game; g.setHeat(0); g.step(5); g.player.pos.set(-150, 0.2, 170); g.step(10); const fly0 = g.birds.filter(b => b.st === 'fly' && !b.gull).length; g.keys.ShiftLeft = true; g.player.pos.set(-150, 0.2, 166); g.step(10); g.keys.ShiftLeft = false; const fly1 = g.birds.filter(b => b.st === 'fly' && !b.gull).length; return { fly0, fly1 }; });
  log('pigeons flying before/after sprint through flock', JSON.stringify(r6));
  await E(() => { const g = __game; g.setTime(22 * 60 + 30); g.player.pos.set(300, 0.2, 420); g.player.heading = Math.PI; g.cam.yaw = 0; g.cam.pitch = -0.15; g.cam.lastMouse = 1e12; g.step(150); });
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'fireworks.png') });
  log(errs.slice(0, 8).join('\n') || 'no errors');
  await b.close();
})();
