const { chromium } = require('playwright');
const path = require('path');
const G = path.resolve(__dirname, '..');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push(m.text()); });
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }); if (u.startsWith('file://')) return r.continue(); return r.abort(); });
  await p.goto('file://' + G + '/_test.html');
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.click('#b-new'); await p.waitForTimeout(300);
  const E = (f, a) => p.evaluate(f, a); const log = (...a) => console.log(...a);
  const objective = () => E(() => document.getElementById('objective').textContent);
  // jump to mission 3
  await E(() => { const g = __game; g.game.mission = 2; g.step(2); g.player.pos.set(-160, 0.2, 300); g.step(5); });
  await E(() => { const g = __game; g.step(60); const th = g.vehicles.find(v => v.mission && v.ai && v.ai.mode === 'flee'); th.damage(999); g.step(3); });
  await E(() => { const g = __game; const bag = g.pickups.find(k => k.type === 'bag'); g.player.pos.set(bag.x, bag.y - 0.9, bag.z); g.step(3); });
  log('M3 done? idx', await E(() => __game.game.mission), 'pistol', await E(() => __game.player.hasPistol + '/' + __game.player.ammo));
  // M4 race: go to giver, get GT, teleport to start, then teleport through checkpoints with car
  await E(() => { const g = __game; g.step(90); g.player.pos.set(-178, 0.2, 168); g.step(5); });
  log('M4 running', await E(() => !!__game.mission.run), await objective());
  await E(() => { const g = __game; const gt = g.vehicles.find(v => v.mission && v.key === 'delfi'); g.player.pos.set(gt.pos.x, 0.2, gt.pos.z - 2.5); g.enterExit(); });
  const pts = await E(() => { const d = (t) => [480 + (-0.9217) * t, -80 + (-0.3881) * t]; return [d(1110)]; });
  await E((pt) => { const g = __game; const c = g.player.car; c.pos.set(pt[0], 0, pt[1]); c.ty = 0; c.vx = c.vz = 0; g.step(140); }, pts[0]);
  log('race stage obj:', await objective(), 'timer', await E(() => __game.mission.timer.toFixed(0)));
  // actually drive the race with simple autopilot to test checkpoint reachability: steer toward next ring
  const res = await E(() => {
    const g = __game, c = g.player.car; let steps = 0, out = [];
    const ring = () => g.mission.run && g.mission.run.blips()[0];
    while (g.mission.run && steps < 30 * 100) {
      const b = ring(); if (!b) break;
      const desired = Math.atan2(b[0] - c.pos.x, b[1] - c.pos.z); let da = desired - c.heading; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      g.keys.KeyW = true; g.keys.KeyA = da > 0.08; g.keys.KeyD = da < -0.08; g.keys.Space = Math.abs(da) > 0.9 && c.speed > 15;
      const dd = Math.hypot(b[0]-c.pos.x,b[1]-c.pos.z); if ((c.speed > 25 && Math.abs(da) > 0.35) || (dd < 70 && c.speed > 30)) { g.keys.KeyW = false; g.keys.KeyS = c.speed > 32; } else g.keys.KeyS = false;
      const hp0 = c.health; g.step(1); steps++;
      if (c.health < hp0 - 50) { const nv = g.vehicles.filter(o => o !== c).map(o => [o.key, Math.round(Math.hypot(o.pos.x - c.pos.x, o.pos.z - c.pos.z)), o.ai && o.ai.mode]).sort((a, b) => a[1] - b[1])[0]; out.push(['HIT', Math.round(c.pos.x), Math.round(c.pos.z), Math.round(hp0 - c.health), Math.round(c.health), JSON.stringify(nv)]); }
      if (steps % 300 === 0) out.push([Math.round(c.pos.x), Math.round(c.pos.z), Math.round(c.speed), Math.round(c.health)]);
    }
    g.keys.KeyW = g.keys.KeyA = g.keys.KeyD = g.keys.Space = false;
    return { steps, secs: (steps / 30).toFixed(1), out, idx: g.game.mission, timer: g.mission.timer };
  });
  log('race autopilot', JSON.stringify(res));
  log('M4 msg', await E(() => document.querySelector('#bigmsg b').textContent + ' / ' + document.querySelector('#bigmsg small').textContent));
  await p.waitForTimeout(4500);
  log('after M4 idx', await E(() => __game.game.mission), 'money', await E(() => __game.player.money));
  if (await E(() => __game.game.mission) === 3) { await E(() => { __game.game.mission = 4; }); log('(forced past race for remaining tests)'); }
  // M5 van + wanted
  await E(() => { const g = __game; if (g.player.car) g.enterExit(); g.step(90); g.player.pos.set(246, 0, 406); g.step(5); });
  log('M5 running', await E(() => !!__game.mission.run), await objective());
  await E(() => { const g = __game; const van = g.vehicles.find(v => v.mission && v.key === 'furgo'); g.player.pos.set(van.pos.x, 0.2, van.pos.z + 2.5); g.enterExit(); g.step(30); });
  log('wanted after van', await E(() => __game.wantedLevel()), await objective());
  await E(() => { const g = __game; g.step(30 * 10); });
  const cops = await E(() => __game.vehicles.filter(v => v.driver === 'cop' && v.ai && v.ai.mode === 'cop').map(v => [Math.round(Math.hypot(v.pos.x - __game.player.pos.x, v.pos.z - __game.player.pos.z)), Math.round(v.speed)]));
  log('pursuing cops [dist,speed]', JSON.stringify(cops), 'player hp', await E(() => __game.player.health.toFixed(0)), 'van hp', await E(() => __game.player.car && __game.player.car.health.toFixed(0)));
  await p.screenshot({ path: path.join(__dirname, 'out', 'chase.png') });
  // pinta rapid test: teleport van to west garage
  await E(() => { const g = __game; const c = g.player.car; c.pos.set(-680, 0, -91); c.ty = 0; c.vx = c.vz = 0; c.heading = Math.PI; g.step(10); });
  await p.waitForTimeout(1200); await E(() => __game.step(5));
  log('wanted after Pinta Ràpid', await E(() => __game.wantedLevel()), 'money', await E(() => __game.player.money));
  await E(() => { const g = __game; const c = g.player.car; c.pos.set(246, 0, 412); c.ty = 0; c.vx = c.vz = 0; g.step(15); });
  log('after M5 idx', await E(() => __game.game.mission), await E(() => document.querySelector('#bigmsg b').textContent + ' / ' + document.querySelector('#bigmsg small').textContent), 'van', await E(() => __game.player.car ? __game.player.car.key + ' hp ' + Math.round(__game.player.car.health) : 'on foot'));
  // M6: chase Torrent — let AI drive, check it progresses along path
  await E(() => { const g = __game; if (g.player.car) g.enterExit(); g.step(90); g.player.pos.set(246, 0, 406); g.step(5); });
  log('M6 running', await E(() => !!__game.mission.run), await objective());
  const tr = await E(() => { const g = __game; const t = g.vehicles.find(v => v.mission && v.ai && v.ai.mode === 'path'); const out = []; for (let i = 0; i < 12; i++) { g.player.pos.set(t.pos.x + 30, g.groundH(t.pos.x + 30, t.pos.z) + 0.2, t.pos.z); g.step(150); out.push([Math.round(t.pos.x), Math.round(t.pos.z), Math.round(t.speed), t.ai ? t.ai.i : 'x']); if (!g.mission.run) break; } return out; });
  log('Torrent path [x,z,speed,wp]', JSON.stringify(tr));
  log('M6 result run?', await E(() => !!__game.mission.run), 'idx', await E(() => __game.game.mission), await E(() => document.querySelector('#bigmsg b').textContent));
  // explosion & map & pause
  await E(() => { const g = __game; const v = g.vehicles.find(v => !v.dead && v !== g.player.car); g.player.pos.set(v.pos.x + 20, 0.2, v.pos.z); v.damage(5000); g.step(200); });
  log('wrecks', await E(() => __game.vehicles.filter(v => v.dead).length), 'player hp', await E(() => __game.player.health.toFixed(0)));
  await E(() => __game.openMap()); await p.waitForTimeout(400); await p.screenshot({ path: path.join(__dirname, 'out', 'map.png') }); await E(() => __game.closeMap());
  await p.keyboard.press('KeyP'); await p.waitForTimeout(300); log('pause visible', await E(() => !document.getElementById('pause').hidden)); await p.keyboard.press('KeyP');
  log(errs.slice(0, 10).join('\n') || 'no errors');
  await b.close();
})();
