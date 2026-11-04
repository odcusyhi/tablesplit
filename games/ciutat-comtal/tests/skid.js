const { chromium } = require('playwright');
const path = require('path');
const G = path.resolve(__dirname, '..');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.route('**/*', r => { const u = r.request().url(); if (u.includes('three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' }); if (u.startsWith('file://')) return r.continue(); return r.abort(); });
  await p.goto('file://' + G + '/_test.html'); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.click('#b-new'); await p.waitForTimeout(300);
  console.log(await p.evaluate(() => { const g = __game; const c0 = new (g.vehicles[0].constructor)('delfi', -120, -160, 0); g.player.pos.set(c0.pos.x + 2.2, 0.2, c0.pos.z); g.enterExit(); const c = g.player.car;
    const k0 = g.skidCount(); g.keys.KeyW = true; g.step(40); g.keys.Space = true; g.keys.KeyD = true; g.step(30); g.keys.Space = false; g.keys.KeyD = false; g.keys.KeyW = false; g.step(10);
    return 'skid marks laid: ' + (g.skidCount() - k0); }));
  await b.close();
})();
