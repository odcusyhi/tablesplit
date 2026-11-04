const { chromium } = require('playwright');
const path = require('path');
const G = path.resolve(__dirname, '..');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.type()+': '+m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  await p.route('**/*', r => {
    const u = r.request().url();
    if (u.includes('three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' });
    if (u.startsWith('file://')) return r.continue();
    return r.abort();
  });
  const html = require('fs').readFileSync(G + '/index.html', 'utf8').replace(/^[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, '');
  require('fs').writeFileSync(G + '/_test.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>');
  const t0 = Date.now();
  await p.goto('file://' + G + '/_test.html');
  await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  console.log('boot ms', Date.now() - t0);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(__dirname, 'out', 'title.png') , timeout: 120000 });
  await p.click('#b-new');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(__dirname, 'out', 'start.png') , timeout: 120000 });
  // walk forward
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
  const st = await p.evaluate(() => { const g = window.__game; return { pos: g.player.pos.toArray().map(v=>+v.toFixed(1)), veh: g.vehicles.length, peds: g.peds.length, mission: g.mission.run ? 'running' : 'none', state: g.game.state }; });
  console.log(JSON.stringify(st));
  // fps estimate
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); function f() { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else res(n / 2); } requestAnimationFrame(f); }));
  console.log('fps(swiftshader)', fps);
  console.log(errs.slice(0, 20).join('\n'));
  await b.close();
})();
