/* Flight Club Saar · Clip-Studio: Overlay-Zeichnung (OSD-Rahmen und Namens-Einblendung)
   Ein und derselbe Code läuft im Browser (Vorschau) und auf der Render-Station des Vereins (Node + Canvas),
   damit das fertige Video genau so aussieht wie die Vorschau.
   Browser: <script src="assets/js/studio-overlay.js"> → window.FCS_OVERLAY · Node: require('./studio-overlay.js') */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make(); else root.FCS_OVERLAY = make();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SIG = '#3fe0ff', AMBER = '#ffb020', RED = '#ff4b5c';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tS = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s - m * 60)).padStart(2, '0'); };

  /* Live-OSD wie in der FPV-Brille: Ecken, Fadenkreuz, Spannung mit Akkubalken, Flugzeit, REC. t = Sekunden im fertigen Video */
  function drawOSD(c, W, H, t) {
    const u = Math.min(W, H) / 100, m = 4.2 * u, L = 7 * u;
    c.save();
    c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 1.4 * u; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, .6 * u); c.lineCap = 'square';
    c.beginPath();
    c.moveTo(m, m + L); c.lineTo(m, m); c.lineTo(m + L, m);
    c.moveTo(W - m - L, m); c.lineTo(W - m, m); c.lineTo(W - m, m + L);
    c.moveTo(W - m, H - m - L); c.lineTo(W - m, H - m); c.lineTo(W - m - L, H - m);
    c.moveTo(m + L, H - m); c.lineTo(m, H - m); c.lineTo(m, H - m - L);
    const cx = W / 2, cy = H / 2, g = 2.6 * u, l = 2.6 * u;
    c.moveTo(cx - g - l, cy); c.lineTo(cx - g, cy); c.moveTo(cx + g, cy); c.lineTo(cx + g + l, cy);
    c.moveTo(cx, cy - g - l * .5); c.lineTo(cx, cy - g); c.moveTo(cx, cy + g); c.lineTo(cx, cy + g + l * .5);
    c.stroke();
    c.fillStyle = SIG; c.beginPath(); c.arc(cx, cy, .7 * u, 0, Math.PI * 2); c.fill();
    const fs = 3.3 * u, top = m + 3.4 * u, bot = H - m - 3.4 * u;
    c.font = `600 ${fs}px "Chakra Petch", ui-monospace, monospace`; c.textBaseline = 'middle';
    const v = Math.max(14, 16.4 - t * .012), lvl = (v - 14) / 2.6;
    c.fillStyle = '#fff'; c.textAlign = 'left'; const vt = v.toFixed(1) + 'V'; c.fillText(vt, m + 2.2 * u, top);
    const bx = m + 2.2 * u + c.measureText(vt).width + 1.6 * u, bw = 6.4 * u, bh = 2.8 * u;
    c.lineWidth = Math.max(1, .4 * u); c.strokeRect(bx, top - bh / 2, bw, bh); c.fillRect(bx + bw, top - bh / 4, .6 * u, bh / 2);
    c.fillStyle = lvl > .35 ? SIG : AMBER; c.fillRect(bx + .5 * u, top - bh / 2 + .5 * u, (bw - u) * clamp(lvl, .05, 1), bh - u);
    c.fillStyle = SIG; c.textAlign = 'right'; c.fillText(tS(t).padStart(5, '0'), W - m - 2.2 * u, top);
    if (Math.floor(t * 2) % 2 === 0) { c.fillStyle = RED; c.beginPath(); c.arc(m + 3 * u, bot, 1 * u, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText('REC', m + 4.9 * u, bot);
    c.globalAlpha = .88; c.textAlign = 'right'; c.font = `600 ${2.5 * u}px "Chakra Petch", ui-monospace, monospace`;
    c.fillText('FLIGHT CLUB SAAR', W - m - 2.2 * u, bot);
    c.restore();
  }

  /* Namens-Einblendung unten links. ln = { name, mode: 'start' (5 s) | 'all' (immer) | 'off' }, osd = OSD an (dann höher), force = ganz zeigen (Vorschau beim Tippen) */
  function drawLower(c, W, H, t, ln, osd, force) {
    const name = String(ln && ln.name || '').trim(); if (!name || !ln || ln.mode === 'off') return;
    let p = 1;
    if (!force) {
      if (ln.mode === 'start') { if (t < .3 || t > 5.6) return; p = Math.min(1, (t - .3) / .55, (5.6 - t) / .5); }
      else { p = clamp((t - .3) / .55, 0, 1); if (p <= 0) return; }
    }
    const e = 1 - Math.pow(1 - p, 3);
    const u = Math.min(W, H) / 100, x = 5 * u, yb = H - (osd ? 13.5 * u : 6 * u);
    const big = `400 ${7.6 * u}px "Bebas Neue", "Chakra Petch", sans-serif`, small = `600 ${2.2 * u}px "Chakra Petch", ui-monospace, monospace`;
    c.save();
    c.font = big; const nw = c.measureText(name.toUpperCase()).width;
    c.font = small; const sub = 'FLIGHT CLUB SAAR E. V.'; const sw = c.measureText(sub).width + 2.2 * u * .15 * sub.length;
    const bw = Math.max(nw, sw) + 6.5 * u, bh = 12.6 * u, y = yb - bh;
    c.fillStyle = SIG; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 2 * u; c.fillRect(x, y + bh * (1 - e), 1.1 * u, bh * e);
    c.shadowBlur = 0;
    c.beginPath(); c.rect(x + 1.1 * u, y, bw * e, bh); c.clip();
    c.fillStyle = 'rgba(4,9,18,.84)'; c.fillRect(x + 1.1 * u, y, bw, bh);
    c.fillStyle = 'rgba(63,224,255,.16)'; c.fillRect(x + 1.1 * u, y + bh - .5 * u, bw, .5 * u);
    const tx = x + 3.8 * u - (1 - e) * 4 * u;
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.font = big; c.fillStyle = '#fff'; c.fillText(name.toUpperCase(), tx, y + 7.9 * u);
    c.font = small; c.fillStyle = AMBER; if ('letterSpacing' in c) c.letterSpacing = (.3 * u) + 'px';
    c.fillText(sub, tx, y + 10.8 * u);
    c.restore();
  }

  /* Ändert sich das Overlay zwischen zwei Zeitpunkten? Schlüssel für gleiche Bilder (die Render-Station zeichnet jedes Bild nur einmal). */
  function frameKey(t, osd, ln) {
    const parts = [];
    if (osd) parts.push('osd', Math.floor(t), Math.floor(t * 2) % 2, Math.round(Math.max(14, 16.4 - t * .012) * 10));
    if (ln && ln.name && ln.mode !== 'off') {
      let p = 1;
      if (ln.mode === 'start') p = t < .3 || t > 5.6 ? 0 : Math.min(1, (t - .3) / .55, (5.6 - t) / .5);
      else p = clamp((t - .3) / .55, 0, 1);
      parts.push('ln', Math.round(p * 200));
    }
    return parts.join('|');
  }

  return { SIG, AMBER, RED, tS, clamp, drawOSD, drawLower, frameKey };
});
