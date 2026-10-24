const { chromium, devices } = require('playwright'); const path = require('path'); const { mock } = require('./mock.js');
const TV = f => path.join(__dirname, 'tv', f);
async function open(b, o = {}) {
  const ctx = await b.newContext(o.mob ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(t => { window.FCS_STUDIO_TEST = t; }, o.test || {});
  if (o.member) await ctx.addInitScript(m => { localStorage.setItem('fcs-mitglied', JSON.stringify(m)); }, o.member);
  const m = mock(o.mock || {}); await m.attach(ctx);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', x => { if (x.type() === 'error') errs.push('console ' + x.text()); if (o.log && (x.type() === 'info' || x.type() === 'log')) console.log('  [page]', x.text().slice(0, 200)); });
  await page.goto('http://localhost:8800/filmen.html' + (o.q || ''));
  await page.waitForFunction(() => window.__fcsStudio, null, { timeout: 15000 });
  return { ctx, page, m, errs };
}
const clipState = page => page.evaluate(() => { const S = window.__fcsStudio.S; return S.clips.map(c => ({ name: c.name, state: c.state, mode: c.mode, ref: c.ref, tested: !!c.tested, el: c.elSamples.map(l => Math.round(l.max)).join('/'), draw: (c.lum.draw || []).map(l => l ? Math.round(l.max) : '-').join('/'), copy: (c.lum.copy || []).map(l => l ? Math.round(l.max) : '-').join('/'), w: c.w, h: c.h, ew: c.ew, eh: c.eh, dur: +(c.dur || 0).toFixed(2), fps: c.fps, msg: c.msg, info: c.info && c.info.ok ? { codec: c.info.codec, bits: c.info.bits, hdr: c.info.hdr, tr: c.info.transfer, rot: c.info.rot, vfr: c.info.vfr, canDecode: c.info.canDecode, audio: c.info.audio } : c.info })); });
async function waitClips(page, ms = 30000) { await page.waitForFunction(() => { const S = window.__fcsStudio.S; return S.clips.length && S.clips.every(c => c.demo || (c.state !== 'laden' && (c.tested || c.state === 'nicht' || !c.info || !c.info.canDecode))); }, null, { timeout: ms }); }
module.exports = { chromium, devices, open, TV, clipState, waitClips };
