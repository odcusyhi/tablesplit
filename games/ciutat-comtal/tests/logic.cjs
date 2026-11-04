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
  const html = require('fs').readFileSync(G + '/index.html', 'utf8').replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  require('fs').writeFileSync(G + '/_test.html', '<!doctype html><html><head><meta charset="utf-8"></head><body>' + html + '</body></html>');
  await p.goto('file://' + G + '/_test.html');
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.click('#b-new'); await p.waitForTimeout(500);
  const E = (f, ...a) => p.evaluate(f, ...a);
  const log = (...a) => console.log(...a);
  // --- Mission 1 ---
  await E(() => { const g = __game; g.player.pos.set(-150, 0.18, 176); g.step(5); });
  log('M1 started:', await E(() => !!__game.mission.run), await E(() => document.getElementById('objective').textContent));
  await E(() => { const g = __game; const car = g.vehicles.find(v => v.mission); g.player.pos.set(car.pos.x - 2, 0.2, car.pos.z); g.enterExit(); g.step(3); });
  log('in car:', await E(() => __game.player.car && __game.player.car.t.name));
  // drive forward for 3s with W
  const before = await E(() => __game.player.car.pos.toArray());
  await E(() => { const g = __game; g.keys.KeyW = true; g.step(90); g.keys.KeyW = false; });
  const after = await E(() => ({ p: __game.player.car.pos.toArray(), sp: __game.player.car.speed, hp: __game.player.car.health }));
  log('drive: from', before.map(v=>v.toFixed(1)), 'to', after.p.map(v=>v.toFixed(1)), 'speed', after.sp.toFixed(1), 'hp', after.hp.toFixed(0));
  await p.screenshot({ path: path.join(__dirname, 'out', 'drive.png') , timeout: 120000 });
  // teleport car to bar
  await E(() => { const g = __game; const c = g.player.car; c.pos.set(246, 0, 412); c.vx = c.vz = 0; g.step(10); });
  log('after M1: mission idx', await E(() => __game.game.mission), 'money', await E(() => __game.player.money));
  // --- Mission 2: start at bar on foot ---
  await E(() => { const g = __game; g.enterExit(); g.step(60); g.player.pos.set(246, 0, 406); g.step(5); });
  log('M2 running:', await E(() => !!__game.mission.run), await E(() => document.getElementById('objective').textContent));
  for (const [x, z] of [[240, -279], [320, -441], [160, 117]]) await E(([x, z]) => { const g = __game; g.player.pos.set(x, 0.2, z); g.step(3); }, [x, z]);
  log('after M2: idx', await E(() => __game.game.mission), 'money', await E(() => __game.player.money));
  // --- Mission 3 ---
  await E(() => { const g = __game; g.step(60); g.player.pos.set(-160, 0.2, 300); g.step(5); });
  log('M3 running:', await E(() => !!__game.mission.run));
  await E(() => { const g = __game; g.step(120); const thief = g.vehicles.find(v => v.mission && v.key === 'scuter' && v.ai && v.ai.mode === 'flee'); window._th = thief; });
  log('thief moved to', await E(() => _th && _th.pos.toArray().map(v => v.toFixed(0))), 'speed', await E(() => _th && _th.speed.toFixed(1)));
  await E(() => { const g = __game; _th.damage(999); g.step(5); const bag = null; });
  await E(() => { const g = __game; const t = _th; g.player.pos.set(t.pos.x + 3, 0.2, t.pos.z); g.step(2); });
  await E(() => { const g = __game; for (let i = 0; i < 20 && g.mission.run; i++) { const pk = (window._pk = null); g.step(1); } });
  // find bag pickup by walking onto any bag location
  await E(() => { const g = __game; const scene = null; });
  log('M3 state run?', await E(() => !!__game.mission.run), 'obj', await E(() => document.getElementById('objective').textContent));
  log(errs.slice(0, 10).join('\n') || 'no errors so far');
  await b.close();
})();
