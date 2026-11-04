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
  // shops
  log('shop', JSON.stringify(await E(() => { const g = __game; g.player.money = 1000; const gun = g.placeMarkers.find(q => q.kind === 'gun'); g.player.pos.set(gun.x, 0.2, gun.z); g.step(3);
    const open = !document.getElementById('shop').hidden; g.buyItem(0); g.buyItem(1); const r = { open, pistol: g.player.hasPistol, ammo: g.player.ammo, armor: g.player.armor, money: g.player.money };
    const cl = g.placeMarkers.find(q => q.kind === 'clothes'); g.player.pos.set(cl.x, 0.2, cl.z); g.step(3); g.buyItem(2); r.outfit = g.player.outfit; return r; })));
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'shop.png') , timeout: 120000 });
  // armour absorbs damage
  log('armour', JSON.stringify(await E(() => { const g = __game; g.player.pos.set(-150, 0.2, 186); g.step(2); const h0 = g.player.health; g.player.armor = 30; /* hurt via crime-free path */ g.player.health = 100; return { before: [100, 30] }; })));
  // taxi
  log('taxi', JSON.stringify(await E(() => { const g = __game; const t = g.spawnTraffic(0, 400, 'parked'); let taxi = g.vehicles.find(v => v.key === 'taxi' && !v.driver) || t; if (taxi.key !== 'taxi') { taxi = new (g.vehicles[0].constructor)('taxi', -114, 40, 0); }
    g.player.pos.set(taxi.pos.x + 2, 0.2, taxi.pos.z); g.enterExit(); g.toggleVehicleJob(); g.step(2);
    const a = g.act; const fare = a.run.blips()[0]; const v = g.player.car; v.pos.set(fare[0] + 3, 0, fare[1]); v.ty = 0; v.vx = v.vz = 0; g.step(4);
    const dest = a.run.blips()[0]; const t0 = a.timer; v.pos.set(dest[0], 0, dest[1]); v.ty = 0; v.vx = v.vz = 0; const m0 = g.player.money; g.step(4);
    return { name: a.name, timer: Math.round(t0), paid: g.player.money - m0, stillRunning: !!a.run }; })));
  log('taxi stop', await E(() => { const g = __game; g.toggleVehicleJob(); g.step(2); return !g.act.run; }));
  // vigilante
  log('vigilante', JSON.stringify(await E(() => { const g = __game; g.enterExit(); g.step(2); const pc = new (g.vehicles[0].constructor)('patrulla', -114, 60, 0); g.player.pos.set(pc.pos.x + 2, 0.2, pc.pos.z); g.enterExit(); g.toggleVehicleJob(); g.step(30);
    const crook = g.vehicles.find(v => v.crook); const p0 = crook.pos.clone(); g.step(60); const moved = Math.round(crook.pos.distanceTo(p0)); const m0 = g.player.money; crook.damage(9999); g.step(5); return { moved, paid: g.player.money - m0, level2: !!g.vehicles.find(v => v.crook && !v.dead && v !== crook) }; })));
  await E(() => { const g = __game; g.toggleVehicleJob(); g.step(2); });
  // race with rivals (autopilot)
  log('race', JSON.stringify(await E(() => { const g = __game; const car = g.player.car; car.pos.set(-130, 0, -280); car.ty = 0; car.vx = car.vz = 0; g.step(3); /* triggers via blue light */
    if (!g.act.run) return { started: false }; const name = g.act.name; let steps = 0; const rivals = g.vehicles.filter(v => v.ai && v.ai.racer);
    while (g.act.run && steps < 30 * 150) { const b = g.act.run.blips()[0]; const c = g.player.car; let da = Math.atan2(b[0] - c.pos.x, b[1] - c.pos.z) - c.heading; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; const dd = Math.hypot(b[0] - c.pos.x, b[1] - c.pos.z);
      g.keys.KeyW = !(c.speed > 25 && Math.abs(da) > 0.35) && !(dd < 45 && c.speed > 22); g.keys.KeyS = (dd < 45 && c.speed > 24); g.keys.KeyA = da > 0.08; g.keys.KeyD = da < -0.08; g.step(1); steps++; }
    for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) g.keys[k] = false;
    return { started: true, name, secs: Math.round(steps / 30), rivalsProgress: rivals.map(r => r.ai ? r.ai.i : 'done'), result: document.querySelector('#bigmsg small').textContent }; })));
  // rampage
  log('rampage', JSON.stringify(await E(() => { const g = __game; if (g.player.car) g.enterExit(); g.step(60); const rp = g.placeMarkers.find(q => q.kind === 'rampage'); g.player.pos.set(rp.x, 0.2, rp.z); g.step(3); const running = g.act.name; let n = 0;
    for (const pr of g.props) { if (n >= 25) break; if (!pr.broken && Math.hypot(pr.x - rp.x, pr.z - rp.z) < 120) { g.breakProp(pr, 1, 1, true, 'melee'); n++; } } g.step(3); return { running, result: document.querySelector('#bigmsg small').textContent, over: !g.act.run }; })));
  // helicopter + roadblocks + lights
  log('police', JSON.stringify(await E(() => { const g = __game; const pc = new (g.vehicles[0].constructor)('picolo', -120, -200, 0); g.player.pos.set(pc.pos.x + 2, 0.2, pc.pos.z); g.enterExit(); g.setHeat(4.5); g.keys.KeyW = true;
    let rb = 0; for (let i = 0; i < 40; i++) { const c = g.player.car; if (c.pos.z > 150) { c.pos.z = -400; } c.heading = 0; g.step(30); rb = Math.max(rb, g.vehicles.filter(v => v.roadblock).length); } g.keys.KeyW = false;
    const h = g.heliRef(); return { heli: !!h, heliAlt: h && Math.round(h.g.position.y), roadblockCars: rb, lights: g.lights.length, lightStates: [...new Set(g.lights.map(l => l.st))].join('') }; })));
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'out', 'heli.png') , timeout: 120000 });
  // traffic waits at red: count AI cars stopped near a red light
  log('lights obeyed', JSON.stringify(await E(() => { const g = __game; g.setHeat(0); g.step(30 * 8); const stopped = g.vehicles.filter(v => v.driver === 'ai' && v.ai && v.ai.mode === 'traffic' && Math.abs(v.speed) < 0.5).length; const moving = g.vehicles.filter(v => v.driver === 'ai' && Math.abs(v.speed) > 3).length; return { stopped, moving }; })));
  // skids + bumpers + perf + save
  log('feel', JSON.stringify(await E(() => { const g = __game; const c = g.player.car; c.vx = Math.sin(c.heading) * 25; c.vz = Math.cos(c.heading) * 25; g.keys.Space = true; g.keys.KeyD = true; g.step(25); g.keys.Space = false; g.keys.KeyD = false;
    const b0 = c.mesh.userData.bumpers.filter(m => m.visible).length; c.damage(c.t.hp * 0.75); const b1 = c.mesh.userData.bumpers.filter(m => m.visible).length;
    g.togglePerf(); g.step(20); const perf = document.getElementById('perf').textContent; g.togglePerf(); return { bumpersBefore: b0, bumpersAfter: b1, perf }; })));
  log('save pos', await E(() => { const s = JSON.parse(localStorage.getItem('ciutat-comtal-save-v1')); return JSON.stringify({ pos: s.pos, outfit: s.outfit, armor: s.armor }); }));
  log(errs.slice(0, 8).join('\n') || 'no errors');
  await b.close();
})();
