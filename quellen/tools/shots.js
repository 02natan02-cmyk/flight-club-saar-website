// Aufruf: NODE_PATH=$(npm root -g) node tools/shots.js <url> <name> [w h] [anzahl] [mobile]
const { chromium, devices } = require('playwright');
(async () => {
  const [url, name, w = 1440, h = 900, n = 8, mob] = process.argv.slice(2);
  const out = '/tmp/claude-0/-home-claude/7a8f63d6-d747-5eb8-a717-2d586b09191f/scratchpad/shots';
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: !!mob, hasTouch: !!mob });
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  p.on('requestfailed', r => { if (!/formsubmit|instagram/.test(r.url())) errs.push('FAIL ' + r.url()); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'nointro', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  const steps = +n;
  for (let i = 0; i < steps; i++) {
    const y = Math.round((H - +h) * i / Math.max(1, steps - 1));
    await p.evaluate(y => { window.scrollTo(0, y); }, y);
    await p.waitForTimeout(1300);
    await p.screenshot({ path: `${out}/${name}_${String(i).padStart(2, '0')}.jpg`, quality: 55, type: 'jpeg' });
  }
  const sw = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, wide: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map(e => e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') ) }));
  console.log(JSON.stringify({ name, H, ...sw, errs: errs.slice(0, 15) }));
  await b.close();
})();
