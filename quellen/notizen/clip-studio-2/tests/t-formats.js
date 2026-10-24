const { chromium, open, TV, clipState, waitClips } = require('./h.js');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['h264_high_4k60.mp4', 'hevc8.mp4', 'iphone_hevc10_hlg_hochkant.mov', 'hevc10_pq_hdr10.mp4', 'dji_o3_hevc10_dlogm.mp4', 'gopro_h264_mit_zusatzspur.mp4', 'h264_vfr.mp4', 'vp9_4k60.webm', 'vp9_10bit_pq_hdr.webm', 'av1_10bit_hlg_hochkant_rot.mp4', 'av1_hochkant_rot.mp4', 'av1_1080x1920.mp4', 'vp9_vfr.webm', 'vp9_dunkel_ohne_ton.webm', 'vp9_schwarz.webm'];
(async () => {
  const b = await chromium.launch();
  const { page, errs } = await open(b);
  await page.evaluate(() => document.querySelector('#studio').scrollIntoView());
  for (const f of files) {
    const t0 = Date.now();
    await page.setInputFiles('#st-file', TV(f));
    try { await waitClips(page, 40000); } catch (e) { console.log(f, 'TIMEOUT'); }
    await page.waitForTimeout(1500); // Vorschau läuft, Element-Proben
    const s = (await clipState(page))[0];
    // Ist auf der Bühne Bild zu sehen? Pixel aus dem sichtbaren Element/GL lesen
    const px = await page.evaluate(() => { const S = window.__fcsStudio.S, c = S.clips[0]; if (!c || !c.el) return null; const k = document.createElement('canvas'); k.width = k.height = 16; const x = k.getContext('2d'); try { x.drawImage(c.el, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let m = 0; for (let i = 0; i < d.length; i += 4) m = Math.max(m, d[i], d[i + 1], d[i + 2]); return { max: m, vis: getComputedStyle(c.el).opacity, ready: c.el.readyState, vw: c.el.videoWidth, vh: c.el.videoHeight }; } catch (e) { return { err: e.message }; } });
    console.log(`\n== ${f} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    console.log('  state', s.state, 'mode', s.mode, 'ref', s.ref, '| el', s.el, 'draw', s.draw, 'copy', s.copy, '| disp', s.w + 'x' + s.h, 'elem', s.ew + 'x' + s.eh, 'dur', s.dur, 'fps', s.fps);
    console.log('  info', JSON.stringify(s.info));
    if (s.msg) console.log('  msg', s.msg);
    console.log('  stage', JSON.stringify(px));
    const card = await page.$eval('#clips li', li => li.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '');
    console.log('  card', card);
  }
  console.log('\nFehler:', errs.join(' | ') || 'keine');
  await b.close();
})();
