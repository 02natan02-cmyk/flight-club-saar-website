const { chromium, open, TV, clipState, waitClips } = require('./h.js'); const fs = require('fs'); const { execSync } = require('child_process');
const cases = JSON.parse(process.argv[2] || '[{"f":"vp9_10bit_pq_hdr.webm","fmt":"orig","look":"warm","st":1}]');
(async () => {
  const b = await chromium.launch();
  const { page, errs } = await open(b, { log: true });
  await page.evaluate(() => document.querySelector('#studio').scrollIntoView());
  for (const c of cases) {
    console.log('> laden', c.f); await page.setInputFiles('#st-file', TV(c.f)); await waitClips(page, 40000); await page.waitForTimeout(800); console.log('> geladen');
    await page.evaluate(c => { const T = window.__fcsStudio; T.setStep(4, true); }, c);
    console.log('> schritt4');
    if (c.fmt && c.fmt !== 'orig') await page.click(`label.fmt:has(input[value="${c.fmt}"])`);
    if (c.look) await page.click(`label.lk:has(input[value="${c.look}"])`);
    if (c.st) { await page.click('#tray-top button[data-k="logo"]'); await page.waitForTimeout(1000); }
    if (c.q) { await page.evaluate(() => window.__fcsStudio.setStep(5, true)); await page.click(`label.fmt:has(input[name=st-q][value="${c.q}"])`); }
    if (c.trim) await page.evaluate(t => { const S = window.__fcsStudio.S; const k = S.clips[0]; k.a = t[0]; k.b = t[1]; window.__fcsStudio.rebuild(); }, c.trim);
    console.log('> schritt5'); await page.evaluate(() => window.__fcsStudio.setStep(5, true));
    console.log('> export'); const sum = await page.textContent('#st-sum');
    const t0 = Date.now();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }).catch(e => null), page.click('#st-dl')]);
    const ms = Date.now() - t0;
    const info = await page.textContent('#res-info').catch(() => '');
    const why = await page.textContent('#st-why');
    console.log(`\n== ${c.f} ${JSON.stringify(c)}\n  Zusammenfassung: ${sum}\n  Ergebnis: ${info} (${(ms / 1000).toFixed(1)} s)`);
    if (!dl) { console.log('  KEIN DOWNLOAD. why:', why); continue; }
    const out = 'out/' + c.f.replace(/\W/g, '_') + '_' + (c.fmt || 'orig').replace(':', 'x') + '.' + dl.suggestedFilename().split('.').pop();
    await dl.saveAs(out);
    console.log('  Datei:', dl.suggestedFilename(), fs.statSync(out).size, 'Bytes');
    console.log('  ffprobe:', execSync(`ffprobe -v error -show_entries format=duration,bit_rate:stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels -of compact ${out}`).toString().trim().replace(/\n/g, ' | '));
    execSync(`ffmpeg -v error -y -i ${out} -vf "fps=2,scale=320:-2,tile=4x1" -frames:v 1 ${out}.jpg`);
    console.log('  Kontakt:', out + '.jpg');
  }
  console.log('\nFehler:', errs.join(' | ') || 'keine');
  await b.close();
})();
