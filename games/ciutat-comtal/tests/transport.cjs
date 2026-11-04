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
  const shot = async (n) => { await E(() => { __game.game.state = 'pause'; document.getElementById('pause').hidden = true; }); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(__dirname, 'out', n), timeout: 120000 }); await E(() => { __game.game.state = 'play'; }); };
  log('counts', JSON.stringify(await E(() => ({ busStops: __game.BUS_STOPS.length, metro: __game.metroSt.length, cable: __game.STATIONS_CC.length, docked: __game.vehicles.filter(v => v.dock).length }))));
  // motorbike
  log('moto', JSON.stringify(await E(() => { const g = __game; const m = new g.Vehicle('moto', -120, -300, 0); g.player.pos.set(m.pos.x + 1.5, 0.2, m.pos.z); g.enterExit(); g.keys.KeyW = true; g.step(90); const sp = Math.round(g.player.car.speed * 3.6); g.keys.KeyD = true; g.step(10); const lean = +g.player.car.mesh.rotation.z.toFixed(2); g.keys.KeyD = false; g.keys.KeyW = false; g.step(5); return { name: g.player.car.t.name, kmh3s: sp, lean }; })));
  await E(() => { const g = __game; g.cam.yaw = g.player.car.heading + 1.9; g.cam.pitch = 0.15; g.cam.lastMouse = 1e12; g.player.car.vx = g.player.car.vz = 0; g.step(2); }); await shot('moto.png');
  // bus + bus route
  log('bus', JSON.stringify(await E(() => { const g = __game; g.cam.lastMouse = -1e9; g.enterExit(); g.step(2); const st = g.BUS_STOPS[0]; const bus = new g.Vehicle('bus', st.x, st.z - 40 * Math.sign(st.z - st.sz || 1), 0); bus.pos.set(-40, 0, -200); bus.ty = 0;
    g.player.pos.set(bus.pos.x + 2.5, 0.2, bus.pos.z); g.enterExit(); const inBus = g.player.car && g.player.car.t.bus; g.toggleVehicleJob(); g.step(2); const running = g.act.run && g.act.name;
    const target = g.act.run.blips()[0]; const v = g.player.car; v.pos.set(target[0], 0, target[1]); v.ty = 0; v.vx = v.vz = 0; const m0 = g.player.money; g.step(90);
    const paid = g.player.money - m0; const obj = document.getElementById('objective').textContent; g.toggleVehicleJob(); g.step(2); return { inBus, running, paid, obj }; })));
  await E(() => { const g = __game; g.cam.yaw = g.player.car.heading + 2.2; g.cam.pitch = 0.2; g.cam.lastMouse = 1e12; g.step(2); }); await shot('bus.png');
  // boats: walk to the Moll de la Fusta, board, drive, beach
  log('boat', JSON.stringify(await E(() => { const g = __game; g.cam.lastMouse = -1e9; g.enterExit(); g.step(2); const bt = g.vehicles.find(v => v.dock && v.key === 'llanxa'); g.player.pos.set(bt.pos.x, 0, 437.5); g.step(4);
    const prompt = document.getElementById('prompt').textContent; g.enterExit(); const inBoat = g.player.car === bt; const y0 = bt.pos.y;
    g.keys.KeyD = true; g.keys.KeyW = true; g.step(60); g.keys.KeyD = false; g.step(120); const sp = Math.round(bt.speed * 3.6), pos = [Math.round(bt.pos.x), Math.round(bt.pos.z)], depth = +g.groundH(bt.pos.x, bt.pos.z).toFixed(1);
    // aim for the beach and confirm it stops at the shore
    bt.heading = Math.PI; g.step(200); g.keys.KeyW = false; const shore = +g.groundH(bt.pos.x, bt.pos.z).toFixed(1);
    return { prompt, inBoat, floatY: +y0.toFixed(2), kmh: sp, pos, depth, stoppedAtDepth: shore, hp: Math.round(bt.health) }; })));
  await E(() => { const g = __game; const bt = g.player.car; bt.heading = 0; bt.vx = 0; bt.vz = 0; g.keys.KeyW = true; g.step(100); g.keys.KeyW = false; g.cam.yaw = bt.heading + 2.5; g.cam.pitch = 0.25; g.cam.lastMouse = 1e12; g.step(2); }); await shot('boat.png');
  log('swim out', JSON.stringify(await E(() => { const g = __game; g.cam.lastMouse = -1e9; g.enterExit(); g.step(20); return { swim: g.player.swim, y: +g.player.pos.y.toFixed(2) }; })));
  // cable car
  log('cable', JSON.stringify(await E(() => { const g = __game; g.player.money = 100; const st = g.STATIONS_CC[0]; g.player.pos.set(st.x, g.groundH(st.x, st.z), st.z); g.step(3); const r = g.rideRef(); const ok = !!r; g.step(30 * 25); const mid = g.player.pos.toArray().map(v => Math.round(v));
    return { started: ok, money: g.player.money, midRide: mid }; })));
  await E(() => { const g = __game; g.cam.yaw = 2.2; g.cam.pitch = 0.1; g.cam.lastMouse = 1e12; g.step(2); }); await shot('cable.png');
  log('cable end', JSON.stringify(await E(() => { const g = __game; g.cam.lastMouse = -1e9; g.step(30 * 35); return { riding: !!g.rideRef(), at: g.district(g.player.pos.x, g.player.pos.z), visible: g.player.human.g.visible }; })));
  // metro
  log('metro', JSON.stringify(await E(() => { const g = __game; const st = g.metroSt[0]; g.player.pos.set(st.x, g.groundH(st.x, st.z) + 0.18, st.z); g.step(6); const panel = document.getElementById('shop').textContent; g.buyItem(2); return { panel: panel.slice(0, 120), state: g.game.state }; })));
  await p.waitForTimeout(2500); await p.screenshot({ path: path.join(__dirname, 'out', 'metro.png'), timeout: 120000 });
  await p.waitForFunction(() => __game.game.state === 'play', null, { timeout: 120000 });
  log('metro end', JSON.stringify(await E(() => ({ at: __game.district(__game.player.pos.x, __game.player.pos.z), money: __game.player.money }))));
  log(errs.slice(0, 8).join('\n') || 'no errors'); await b.close();
})();
