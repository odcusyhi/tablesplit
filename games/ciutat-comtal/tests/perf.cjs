const { chromium } = require('playwright');
const path = require('path');
const G = path.resolve(__dirname, '..');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }); if (u.startsWith('file://')) return r.continue(); return r.abort(); });
  await p.goto('file://' + G + '/_test.html'); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.click('#b-new'); await p.waitForTimeout(300);
  await p.evaluate(() => { const g = __game; const c0 = new (g.vehicles[0].constructor)('delfi', -120, -100, 0); g.player.pos.set(c0.pos.x + 2.2, 0.2, c0.pos.z); g.enterExit(); const c = g.player.car; c.vz = 30; g.keys.Space = true; g.keys.KeyD = true; g.step(30); g.keys.Space = false; g.keys.KeyD = false; c.vx = c.vz = 0; g.step(10); g.cam.yaw = c.heading + 2.4; g.cam.pitch = 0.5; g.cam.lastMouse = 1e12; });
  await p.keyboard.press('F3'); await p.waitForTimeout(300); console.log('perf hidden after F3:', await p.evaluate(() => document.getElementById('perf').hidden), 'state', await p.evaluate(() => __game.game.state)); await p.evaluate(() => { if (document.getElementById('perf').hidden) __game.togglePerf(); }); await p.waitForTimeout(4000);
  console.log('perf:', await p.evaluate(() => document.getElementById('perf').textContent));
  await p.screenshot({ path: path.join(__dirname, 'out', 'skids.png') , timeout: 120000 });
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
