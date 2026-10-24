/* Flight Club Saar – FPV-Wissen
   3D-Drohne (three.js), Schaltplan, Videosysteme, Kanäle, Weg zum ersten Flug, Checkliste, Glossar.
   Läuft als Modul. GSAP und Plugins kommen global aus fcs.js; wir warten auf „fcs:ready“.
   Stand 24.10.2026: kein Festkleben mehr beim Scrollen. Die Drohne wird per Regler zerlegt
   (und zerlegt sich beim ersten Sichtkontakt einmal von selbst). */
import * as THREE from '../lib/three.module.min.js';

const D = document, W = window;
const $ = (s, r = D) => r.querySelector(s);
const $$ = (s, r = D) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const has = (n) => typeof W[n] !== 'undefined';
const GS = () => has('gsap');
const el = (tag, attrs = {}, parent) => { const n = D.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const run = (name, fn) => { try { fn(); } catch (e) { console.warn('FPV-Wissen: ' + name, e); } };

/* Wartet auf fcs.js (Plugins registriert). Fallback: nach „load“. */
function whenReady(fn) {
  let done = false;
  const go = () => {
    if (done) return; done = true;
    if (GS()) { const p = ['ScrollTrigger', 'DrawSVGPlugin', 'Draggable', 'InertiaPlugin', 'MotionPathPlugin'].filter(has).map(n => W[n]); if (p.length) gsap.registerPlugin(...p); }
    fn();
  };
  D.addEventListener('fcs:ready', go, { once: true });
  if (D.readyState === 'complete') setTimeout(go, 0); else W.addEventListener('load', () => setTimeout(go, 0), { once: true });
}

/* Einmal beim ersten Sichtkontakt */
function firstSight(target, fn, threshold = 0.35) {
  if (!target) return;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold });
  io.observe(target);
}
/* Hinweis, der nach der ersten echten Interaktion verschwindet */
function makeHint(node) {
  let gone = false;
  return {
    show() { if (node && !gone) node.classList.add('on'); },
    done() { if (!node || gone) return; gone = true; node.classList.remove('on'); node.classList.add('gone'); },
    get gone() { return gone; }
  };
}
const scrollToY = (y) => { if (W.FCS && FCS.scrollTo) FCS.scrollTo(Math.round(y)); else W.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); };
/* CSS-Endlosanimationen anhalten, solange ein Abschnitt nicht zu sehen ist */
function pauseOffscreen() {
  const secs = $$('main > section'); if (!secs.length || !('IntersectionObserver' in W)) return;
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '80px 0px' });
  secs.forEach(s => io.observe(s));
}

/* =====================================================================
   01 · Drohne in 3D
   ===================================================================== */
const PARTS = [
  { id: 'rahmen', name: 'Rahmen', what: 'Der Rahmen aus Carbon trägt alle Teile. Bei einer 5-Zoll-Drohne sind die Arme so lang, dass Propeller mit 5 Zoll (12,7 cm) Durchmesser nebeneinander Platz haben. Die obere Platte schützt den Stack und trägt den Akku.', tip: 'Arme nach jedem Einschlag auf Risse prüfen. Schrauben mit Schraubensicherung sichern. Carbon leitet Strom: Kabel dürfen nicht an den Kanten scheuern.' },
  { id: 'motor', name: 'Motor', what: 'Vier bürstenlose Motoren. Die KV-Zahl gibt an, wie viele Umdrehungen pro Minute sie je Volt ohne Last machen. Für 6S nimmt man niedrigere KV als für 4S.', tip: 'Motorschrauben dürfen nicht zu lang sein, sonst berühren sie die Wicklung. Nach dem Flug kurz fühlen: Ein einzelner heißer Motor zeigt ein Problem an. Von Hand drehen und auf Kratzen hören.' },
  { id: 'prop', name: 'Propeller', what: 'Drei Blätter, 5 Zoll Durchmesser. Zwei Propeller drehen rechts herum, zwei links herum. In welche Richtung, legt die Einstellung im Flugcontroller fest (Props in oder Props out).', tip: 'Immer richtig herum montieren und die Muttern fest anziehen. Nach jedem Crash prüfen: Schon leicht verbogene Blätter erzeugen Vibrationen und heiße Motoren.' },
  { id: 'esc', name: '4in1-ESC', what: 'Vier Motorregler auf einer Platine, unten im Stack. Er bekommt den vollen Akkustrom und steuert jeden Motor nach den Befehlen des Flugcontrollers. Der Kondensator an den Akkupads fängt Spannungsspitzen ab.', tip: 'Kondensator nicht weglassen und richtig herum einlöten. Vor dem ersten Einstecken mit Smoke Stopper testen. Lötzinnreste zwischen den Pads sind Kurzschlüsse.' },
  { id: 'fc', name: 'Flugcontroller', what: 'Das Gehirn der Drohne: Ein Gyro misst Drehungen, der Prozessor rechnet mehrere tausend Mal pro Sekunde nach und sagt dem ESC, wie schnell jeder Motor drehen soll. Die Firmware ist meist Betaflight.', tip: 'Gummi-Dämpfer nicht zu fest anziehen. Der Pfeil auf der Platine zeigt nach vorne, sonst die Ausrichtung in Betaflight anpassen. Notier dir, welcher UART wofür belegt ist.' },
  { id: 'kamera', name: 'FPV-Kamera', what: 'Sie liefert das Live-Bild in deine Brille. Die Kamera ist nach oben geneigt, weil die Drohne im Vorwärtsflug nach vorne kippt. Je schneller du fliegst, desto steiler stellst du sie ein.', tip: 'In der Halle flacher, draußen steiler einstellen. Linse sauber halten und die Schrauben der Halterung prüfen, sonst verstellt sich der Winkel beim ersten Crash.' },
  { id: 'vtx', name: 'Videosender', what: 'Der Videosender (VTX) funkt das Kamerabild auf 5,8 GHz zu deiner Brille. Bei digitalen Systemen sitzt hier der digitale Sender, an dem auch die Kamera hängt.', tip: 'Nie ohne Antenne einschalten, der Sender kann sonst kaputtgehen. Kanal und Leistung mit den anderen absprechen. Für analoges Video gelten in Deutschland höchstens 25 mW.' },
  { id: 'rx', name: 'Empfänger', what: 'Er empfängt die Steuerbefehle deiner Funke, zum Beispiel mit ExpressLRS oder Crossfire, und gibt sie über einen UART an den Flugcontroller weiter.', tip: 'Antenne weg von Carbon und Propellern führen und mit Kabelbinder sichern. Vor dem ersten Flug den Failsafe testen: Funke aus, Motoren müssen stoppen. Test ohne Propeller.' },
  { id: 'akku', name: 'LiPo-Akku', what: 'Lithium-Polymer-Akku, bei 5 Zoll meist 4S oder 6S. Er liefert sehr hohe Ströme über den XT60-Stecker und ist das schwerste Teil der Drohne.', tip: 'Nicht zu tief entladen: Die meisten Piloten landen bei etwa 3,5 V pro Zelle. Aufgeblähte oder beschädigte Akkus nicht mehr benutzen. Laden nur unter Aufsicht, zum Lagern auf Lagerspannung bringen.' },
  { id: 'strap', name: 'Akku-Strap', what: 'Das Band hält den Akku auf der oberen Platte. Eine gummierte Unterlage verhindert, dass er verrutscht.', tip: 'Fest anziehen und ausgefranste Straps tauschen. Ein Akku, der im Flug verrutscht, verschiebt den Schwerpunkt. Das lose Ende darf nicht in die Propeller hängen.' }
];

function webgl2() { try { const c = D.createElement('canvas'); return !!(W.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }

function drone() {
  const sec = $('#drohne'); if (!sec) return;
  const stage = $('.wi-stage', sec), canvas = $('.wi-canvas', sec);
  const labs = $$('.wi-lab', sec), card = $('.wi-card', sec);
  const hint = makeHint($('.wi-hint-drag', sec));
  const ids = PARTS.map(p => p.id);
  let sel = -1, api = null;

  /* Infokarte (gilt für 3D und Fallback) */
  const cT = $('.wi-card-t', card), cW = $('.wi-card-what', card), cP = $('.wi-card-tip', card), cN = $('[data-wi-cn]', card);
  cT.setAttribute('tabindex', '-1');
  function open(i, focus) {
    sel = (i + PARTS.length) % PARTS.length;
    const p = PARTS[sel];
    cT.textContent = p.name; cW.textContent = p.what; cP.textContent = p.tip; cN.textContent = sel + 1;
    const was = card.hidden; card.hidden = false; sec.classList.add('card-open');
    labs.forEach((b, k) => b.setAttribute('aria-pressed', k === sel ? 'true' : 'false'));
    if (was && GS() && !RM) gsap.fromTo(card, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .55, ease: 'expo.out' });
    if (focus) cT.focus({ preventScroll: true });
    if (api) api.select(p.id);
  }
  function close() {
    sel = -1; card.hidden = true; sec.classList.remove('card-open');
    labs.forEach(b => b.setAttribute('aria-pressed', 'false'));
    if (api) api.select(null);
  }
  labs.forEach(b => { b.setAttribute('aria-pressed', 'false'); b.addEventListener('click', () => { hint.done(); open(ids.indexOf(b.dataset.part), false); }); });
  $$('[data-step]', card).forEach(b => b.addEventListener('click', () => open(sel + (+b.dataset.step), false)));
  $('.wi-card-x', card).addEventListener('click', () => { const s = sel; close(); const l = labs[s]; if (l && l.classList.contains('vis')) l.focus({ preventScroll: true }); });
  sec.addEventListener('keydown', e => { if (e.key === 'Escape' && !card.hidden) close(); });

  const lede = $('.wi-stage-lede', sec);
  const flat = () => { if (lede) lede.textContent = 'Eine typische 5-Zoll-Freestyle-Drohne. Tipp auf ein Bauteil: Du siehst, was es macht und worauf du achten musst.'; };
  if (!webgl2()) { sec.classList.add('no-3d'); flat(); return; }
  sec.classList.add('is-3d'); if (RM) sec.classList.add('rm');
  api = drone3d({ sec, stage, canvas, labs, hint, ids, onPick: (id) => { if (id) open(ids.indexOf(id), false); else if (sel >= 0) close(); } });
  if (!api) { sec.classList.remove('is-3d', 'rm'); sec.classList.add('no-3d'); flat(); }
}

function drone3d({ sec, stage, canvas, labs, hint, ids, onPick }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(W.devicePixelRatio || 1, FINE ? 2 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050b17, 80, 260);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 800);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene(), 0.04).texture;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x0a1426, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(20, 34, 26); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3fe0ff, 2.6); rim.position.set(-30, 12, -24); scene.add(rim);
  const warm = new THREE.DirectionalLight(0xffb020, 1.1); warm.position.set(28, -6, -10); scene.add(warm);

  const root = new THREE.Group(); scene.add(root);
  const model = new THREE.Group(); root.add(model);

  /* ---------- Texturen ---------- */
  const tex = (w, h, draw) => { const c = D.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const carbonT = tex(128, 128, (g) => {
    g.fillStyle = '#0c0e12'; g.fillRect(0, 0, 128, 128);
    const s = 16;
    for (let y = 0; y < 128; y += s) for (let x = 0; x < 128; x += s) {
      const odd = ((x + y) / s) % 2;
      const gr = odd ? g.createLinearGradient(x, y, x + s, y) : g.createLinearGradient(x, y, x, y + s);
      gr.addColorStop(0, '#14171c'); gr.addColorStop(.5, '#2b3039'); gr.addColorStop(1, '#101216');
      g.fillStyle = gr; g.fillRect(x + 1, y + 1, s - 2, s - 2);
    }
  });
  carbonT.wrapS = carbonT.wrapT = THREE.RepeatWrapping;
  const pcbT = (accent) => tex(256, 256, (g) => {
    g.fillStyle = '#0a1322'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(80,140,200,.35)'; g.lineWidth = 2;
    for (let i = 0; i < 18; i++) { g.beginPath(); const y = 20 + i * 12; g.moveTo(30, y); g.lineTo(110 + (i % 4) * 20, y); g.lineTo(130 + (i % 4) * 20, y + 14); g.lineTo(226, y + 14); g.stroke(); }
    g.fillStyle = '#d9b44a';
    for (let i = 0; i < 8; i++) { g.fillRect(8, 24 + i * 28, 16, 14); g.fillRect(232, 24 + i * 28, 16, 14); g.fillRect(24 + i * 28, 8, 14, 16); g.fillRect(24 + i * 28, 232, 14, 16); }
    for (const [x, y] of [[24, 24], [232, 24], [24, 232], [232, 232]]) { g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0a1322'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#d9b44a'; }
    g.fillStyle = accent; g.fillRect(118, 118, 20, 6);
  });
  const battT = tex(512, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1a2230'); gr.addColorStop(1, '#0d121b');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#ffb020'; g.fillRect(0, 200, 512, 14); g.fillRect(0, 42, 512, 4);
    g.fillStyle = '#eaf4ff'; g.font = '700 118px "Bebas Neue", "Chakra Petch", Impact, sans-serif'; g.textBaseline = 'middle';
    g.fillText('6S LIPO', 34, 128);
    g.font = '600 26px "Chakra Petch", monospace'; g.fillStyle = '#9db1cc'; g.fillText('FLIGHT CLUB SAAR', 34, 232);
  });
  const discT = tex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.2, 'rgba(255,255,255,.15)'); gr.addColorStop(.8, 'rgba(255,255,255,.55)'); gr.addColorStop(.97, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  const shadowT = tex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });

  /* ---------- Materialien und Formen ---------- */
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const carbon = (rx, ry) => { const t = carbonT.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return std({ map: t, roughness: .42, metalness: .35 }); };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (rt, rb, h, m, seg = 24) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 8, false), m);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };

  /* Teile-Verzeichnis: jedes Bauteil kann mehrere Knoten haben (4 Motoren …) */
  const parts = {}; const pick = [];
  ids.forEach(id => { parts[id] = { id, nodes: [], mats: new Set(), anchor: null }; });
  function add(id, obj, pos, ex, delay, anchorLocal) {
    obj.position.copy(pos); model.add(obj);
    const p = parts[id];
    p.nodes.push({ obj, base: pos.clone(), ex, delay });
    const cache = p.cache || (p.cache = new Map());
    const swap = (m) => { if (!cache.has(m)) { const c = m.clone(); c.userData.e0 = c.emissive ? c.emissive.getHex() : 0; c.userData.ei0 = c.emissiveIntensity || 0; cache.set(m, c); p.mats.add(c); } return cache.get(m); };
    obj.traverse(o => { if (!o.isMesh || o.userData.noPick) return; o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material); o.userData.part = id; pick.push(o); });
    if (anchorLocal && !p.anchor) { const a = new THREE.Object3D(); a.position.copy(anchorLocal); obj.add(a); p.anchor = a; }
    return obj;
  }

  const M = 7.8; // Motorabstand je Achse (cm), 5-Zoll-Rahmen
  const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]]; // x rechts, z vorne

  // Rahmen: Unterteil mit Armen
  const fr = new THREE.Group();
  const cArm = carbon(3, .5), cPlate = carbon(1.4, 2.4);
  corners.forEach(([sx, sz]) => {
    const mx = M * sx, mz = M * sz;
    const arm = box(11.4, .5, 1.75, cArm); arm.position.set(mx * .52, 0, mz * .52); arm.rotation.y = -Math.atan2(mz, mx); fr.add(arm);
    const pad = cyl(1.7, 1.7, .5, cArm, 32); pad.position.set(mx, 0, mz); fr.add(pad);
  });
  fr.add(box(5.6, .5, 9.6, cPlate));
  add('rahmen', fr, V(0, 0, 0), V(0, 0, 0), 0, V(-5.6, .3, -5.6));

  // Rahmen: obere Platte mit Abstandshaltern
  const top = new THREE.Group();
  top.add(at(box(4.4, .35, 9.6, carbon(1.2, 2.4)), 0, 3.35, 0));
  const alu = std({ color: 0x2f6fd0, metalness: .85, roughness: .3 });
  for (const [x, z] of [[-1.9, 4.1], [1.9, 4.1], [-1.9, -4.1], [1.9, -4.1]]) { const s = cyl(.28, .28, 2.9, alu, 12); s.position.set(x, 1.8, z); top.add(s); }
  add('rahmen', top, V(0, 0, 0), V(0, 7.6, 0), .12);

  // Motoren und Propeller
  const bellM = std({ color: 0x8a95a5, metalness: .92, roughness: .26 });
  const darkM = std({ color: 0x161c26, metalness: .7, roughness: .4 });
  const accM = std({ color: 0x3fe0ff, metalness: .6, roughness: .3, emissive: 0x0b4652, emissiveIntensity: .5 });
  const blade = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(.5, -.42); sh.bezierCurveTo(2.2, -1.02, 4.8, -.96, 6.15, -.3); sh.quadraticCurveTo(6.45, .05, 6.05, .32); sh.bezierCurveTo(4.4, .72, 2.2, .76, .5, .42); sh.lineTo(.5, -.42);
    const g = new THREE.ExtrudeGeometry(sh, { depth: .07, bevelEnabled: false, curveSegments: 12 });
    g.rotateX(-Math.PI / 2); g.rotateX(.26); return g;
  })();
  const discG = new THREE.RingGeometry(.65, 6.4, 64); discG.rotateX(-Math.PI / 2);
  const spinners = [];
  corners.forEach(([sx, sz], k) => {
    const mx = M * sx, mz = M * sz;
    const mo = new THREE.Group();
    mo.add(at(cyl(1.22, 1.28, .45, darkM, 28), 0, .22, 0));
    mo.add(at(cyl(1.38, 1.38, 1.25, bellM, 36), 0, 1.05, 0));
    mo.add(at(cyl(1.4, 1.4, .2, accM, 36), 0, 1.6, 0));
    mo.add(at(cyl(1.05, 1.32, .22, darkM, 36), 0, 1.8, 0));
    mo.add(at(cyl(.17, .17, 1.0, bellM, 12), 0, 2.3, 0));
    for (let i = 0; i < 6; i++) { const v = box(.22, .9, .08, darkM); const a = i / 6 * Math.PI * 2; v.position.set(Math.cos(a) * 1.39, 1.0, Math.sin(a) * 1.39); v.rotation.y = -a; mo.add(v); }
    // Motorkabel entlang des Arms
    const lead = box(3.6, .22, .55, std({ color: 0x0d0f14, roughness: .8 })); lead.position.set(-sx * 2.2 * .707 - sx * .3, .4, -sz * 2.2 * .707 - sz * .3); lead.rotation.y = -Math.atan2(mz, mx); mo.add(lead);
    add('motor', mo, V(mx, .25, mz), V(sx * 1.6, 3.4, sz * 1.6), .26, k === 0 ? V(-1.3, 1.1, 0) : null);

    const front = sz > 0;
    const pm = std({ color: front ? 0xffb020 : 0x3fe0ff, roughness: .32, metalness: .1, transparent: true, opacity: .9, side: THREE.DoubleSide });
    const pr = new THREE.Group(); const sp = new THREE.Group(); pr.add(sp);
    sp.add(at(cyl(.55, .62, .5, pm, 20), 0, .1, 0));
    sp.add(at(cyl(.42, .42, .5, bellM, 6), 0, .45, 0));
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(blade, pm); b.rotation.y = i * Math.PI * 2 / 3; sp.add(b); }
    const dir = sx * sz > 0 ? 1 : -1;
    if (dir < 0) sp.scale.z = -1;
    const disc = new THREE.Mesh(discG, new THREE.MeshBasicMaterial({ color: front ? 0xffb020 : 0x3fe0ff, map: discT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    disc.userData.noPick = true; disc.raycast = () => {}; disc.position.y = .1; pr.add(disc);
    add('prop', pr, V(mx, 2.55, mz), V(sx * 1.6, 8.6, sz * 1.6), .18, k === 1 ? V(.6, .5, 0) : null);
    spinners.push({ sp, disc, dir, blades: sp.children[0].material });
  });

  // 4in1-ESC mit Kondensator und Akku-Anschluss
  const esc = new THREE.Group();
  const escPcb = std({ map: pcbT('#3fe0ff'), roughness: .55, metalness: .2 });
  esc.add(at(box(3.8, .18, 3.8, escPcb), 0, .95, 0));
  for (let i = 0; i < 8; i++) { const f = box(.55, .2, .4, darkM); const a = i < 4; f.position.set(a ? -1.25 + (i % 4) * .83 : -1.25 + (i % 4) * .83, 1.12, a ? 1.35 : -1.35); esc.add(f); }
  const capM = std({ color: 0x1b1f29, metalness: .5, roughness: .35 });
  const cap = cyl(.5, .5, 1.8, capM, 20); cap.rotation.z = Math.PI / 2; cap.position.set(0, 1.25, -4.4); esc.add(cap);
  esc.add(at(cyl(.51, .51, .25, std({ color: 0x9db1cc, metalness: .3, roughness: .5 }), 20), -.62, 1.25, -4.4, 0, 0, Math.PI / 2));
  const redM = std({ color: 0xd9343f, roughness: .6 }), blkM = std({ color: 0x15181f, roughness: .6 });
  esc.add(tube([[.45, 1.0, -1.7], [.45, 1.0, -3.2], [.45, 1.2, -5.0], [.3, 1.35, -6.0]], .22, redM));
  esc.add(tube([[-.45, 1.0, -1.7], [-.45, 1.0, -3.2], [-.45, 1.2, -5.0], [-.3, 1.35, -6.0]], .22, blkM));
  const xtM = std({ color: 0xe8c21a, roughness: .45, metalness: .05 });
  esc.add(at(box(1.6, .85, 1.5, xtM), 0, 1.4, -6.5));
  add('esc', esc, V(0, 0, 0), V(0, -4.4, 0), .32, V(1.9, 1.0, 1.9));

  // Flugcontroller
  const fc = new THREE.Group();
  fc.add(at(box(3.6, .16, 3.6, std({ map: pcbT('#ffb020'), roughness: .55, metalness: .2 })), 0, 2.1, 0));
  fc.add(at(box(.95, .16, .95, std({ color: 0x0b0d12, roughness: .4 })), 0, 2.26, 0));
  fc.add(at(box(.45, .14, .45, std({ color: 0x20252f, roughness: .4 })), .9, 2.25, .9));
  fc.add(at(box(.75, .3, .55, std({ color: 0xc8d2de, metalness: .9, roughness: .25 })), 1.75, 2.25, 0));
  const grom = std({ color: 0x7a3cff, roughness: .7 });
  for (const [x, z] of [[-1.52, -1.52], [1.52, -1.52], [-1.52, 1.52], [1.52, 1.52]]) { const g = cyl(.24, .24, .34, grom, 12); g.position.set(x, 2.1, z); fc.add(g); }
  fc.add(at(box(.8, .5, .4, std({ color: 0xeeeeee, roughness: .6 })), -1.2, 1.65, -1.6));
  add('fc', fc, V(0, 0, 0), V(0, 4.8, 0), .3, V(-1.8, 2.2, 1.8));

  // Kamera mit Halterung, nach oben geneigt
  const camG = new THREE.Group();
  const tpu = std({ color: 0xff7a1a, roughness: .7 });
  for (const sx of [-1, 1]) { const p = box(.22, 2.6, 2.4, tpu); p.position.set(sx * 1.13, 0, 0); camG.add(p); }
  const tilt = new THREE.Group(); tilt.rotation.x = -.45; camG.add(tilt);
  tilt.add(box(1.9, 1.9, 1.6, std({ color: 0x22262e, metalness: .4, roughness: .45 })));
  const barrel = cyl(.78, .86, 1.0, std({ color: 0x0b0c0f, roughness: .5 }), 24); barrel.rotation.x = Math.PI / 2; barrel.position.z = 1.25; tilt.add(barrel);
  const glass = cyl(.6, .6, .06, std({ color: 0x0d3550, metalness: 1, roughness: .05, emissive: 0x0a2a3c, emissiveIntensity: .6 }), 24); glass.rotation.x = Math.PI / 2; glass.position.z = 1.76; tilt.add(glass);
  add('kamera', camG, V(0, 1.75, 4.15), V(0, 1.6, 6.8), .36, V(0, 1.1, .4));

  // Videosender mit Antenne
  const vtx = new THREE.Group();
  vtx.add(box(2.0, .16, 2.0, std({ map: pcbT('#ff4b5c'), roughness: .55, metalness: .2 })));
  vtx.add(at(box(1.55, .38, 1.4, std({ color: 0xb8c4d2, metalness: .9, roughness: .3 })), 0, .27, 0));
  const ant = new THREE.Group(); ant.position.set(0, .45, -1.3); ant.rotation.x = -.75; vtx.add(ant);
  ant.add(at(cyl(.32, .32, .9, std({ color: 0xd8b25a, metalness: .9, roughness: .3 }), 12), 0, .45, 0));
  ant.add(at(cyl(.18, .18, 3.2, std({ color: 0x111318, roughness: .6 }), 12), 0, 2.4, 0));
  const lolli = new THREE.Mesh(new THREE.SphereGeometry(.95, 24, 16), std({ color: 0x3fe0ff, roughness: .35, metalness: .1, transparent: true, opacity: .92 }));
  lolli.scale.set(1, .45, 1); lolli.position.y = 4.1; ant.add(lolli);
  add('vtx', vtx, V(0, 2.85, -3.3), V(0, 3.6, -6.4), .4, V(0, .3, 0));

  // Empfänger mit T-Antenne
  const rx = new THREE.Group();
  rx.add(box(1.1, .14, 1.4, std({ map: pcbT('#3ee08a'), roughness: .55 })));
  rx.add(at(box(.25, .1, .25, std({ color: 0x3ee08a, emissive: 0x3ee08a, emissiveIntensity: 1.2 })), .2, .1, .3));
  const coax = std({ color: 0x101217, roughness: .6 });
  rx.add(tube([[0, 0, -.7], [.5, -.25, -1.6], [1.7, -.6, -2.6], [2.7, -.75, -3.5]], .07, coax));
  const tA = new THREE.Group(); tA.position.set(2.7, -.75, -3.5); tA.rotation.y = Math.PI / 4; rx.add(tA);
  const tw = cyl(.07, .07, 2.6, coax, 8); tw.rotation.z = Math.PI / 2; tA.add(tw);
  tA.add(at(cyl(.13, .13, .55, std({ color: 0xeaf4ff, roughness: .5 }), 10), 0, 0, 0, 0, 0, Math.PI / 2));
  add('rx', rx, V(1.5, 1.35, -2.8), V(5.2, -2.2, -5.2), .44, V(0, .1, 0));

  // Akku mit Kabel und XT60
  const ak = new THREE.Group();
  const endM = std({ color: 0x0e131c, roughness: .55 });
  const sideM = std({ map: battT, roughness: .5, metalness: .05 });
  const topM = std({ color: 0x141a26, roughness: .5 });
  ak.add(new THREE.Mesh(new THREE.BoxGeometry(3.7, 3.5, 7.6), [sideM, sideM, topM, topM, endM, endM]));
  ak.add(tube([[.4, -1.3, -3.8], [.4, -1.7, -4.9], [.25, -2.4, -5.9], [.2, -2.6, -6.3]], .2, redM));
  ak.add(tube([[-.4, -1.3, -3.8], [-.4, -1.7, -4.9], [-.25, -2.4, -5.9], [-.2, -2.6, -6.3]], .2, blkM));
  ak.add(at(box(1.6, .9, 1.5, xtM), 0, -2.9, -6.3));
  ak.add(tube([[1.4, 1.2, -3.8], [1.6, 1.6, -4.6], [1.7, 1.2, -5.3]], .08, std({ color: 0xeaf4ff, roughness: .6 })));
  ak.add(at(box(.9, .35, .5, std({ color: 0xf2f2f2, roughness: .6 })), 1.7, 1.15, -5.5));
  add('akku', ak, V(0, 5.3, -.2), V(0, 15.6, 0), 0, V(1.85, 1.75, 2.4));

  // Strap
  const strapG = new THREE.Group();
  const ring = new THREE.Shape(); const rr = (s, w, h, r) => { s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); };
  rr(ring, 4.2, 4.3, .5); const hole = new THREE.Path(); rr(hole, 3.78, 3.88, .3); ring.holes.push(hole);
  const sg = new THREE.ExtrudeGeometry(ring, { depth: 1.3, bevelEnabled: false, curveSegments: 6 }); sg.translate(0, 0, -.65);
  strapG.add(new THREE.Mesh(sg, std({ color: 0xc8323c, roughness: .8 })));
  strapG.add(at(box(1.1, .28, 1.5, std({ color: 0x15181f, metalness: .4, roughness: .4 })), 0, 2.2, 0));
  add('strap', strapG, V(0, 5.15, 1.2), V(0, 11.6, 0), .05, V(0, 2.3, 0));

  // Boden: Raster und weicher Schatten
  const grid = new THREE.GridHelper(140, 70, 0x3fe0ff, 0x1f497d);
  grid.material.transparent = true; grid.material.opacity = .2; grid.material.depthWrite = false; root.add(grid);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false, opacity: .8 }));
  shadow.rotation.x = -Math.PI / 2; root.add(shadow);

  /* ---------- Zustand ---------- */
  let e = RM ? 1 : 0, target = RM ? 1 : 0;
  let yaw = -.62, vel = 0, pitch = 0, impulse = { v: 0 }, hovered = null, selected = null;
  let Wd = 1, Hd = 1, running = false, raf = 0, last = performance.now(), clock = 0;
  const region = { cx: .5, cy: .5, rw: 1, rh: 1 };
  const goalRegion = () => {
    const wide = Wd >= 900;
    if (wide) return { cx: .66, cy: .53, rw: .62, rh: .74 };
    if (sec.classList.contains('card-open')) return { cx: .5, cy: .3, rw: 1, rh: .42 };
    return { cx: .5, cy: .62, rw: 1, rh: .54 };
  };
  const tmp = new THREE.Vector3();
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const labMap = {}; labs.forEach(b => { labMap[b.dataset.part] = b; });
  const labW = {}, labH = {}; const measure = () => labs.forEach(b => { labW[b.dataset.part] = b.offsetWidth || 100; labH[b.dataset.part] = b.offsetHeight || 28; });
  const roYaw = $('[data-wi-yaw]', sec), roEx = $('[data-wi-ex]', sec), exRange = $('.wi-ex-range', sec), exBtns = $$('.wi-explode button', sec);
  let rangeHeld = false, rangeT = 0;

  function size() {
    Wd = stage.clientWidth || 1; Hd = stage.clientHeight || 1;
    renderer.setSize(Wd, Hd, false);
    cam.aspect = Wd / Hd;
    Object.assign(region, goalRegion());
    measure(); kick();
  }

  let camMoving = false;
  function layoutCamera() {
    const g = goalRegion(), k = RM ? 1 : .12;
    camMoving = Math.abs(g.cx - region.cx) + Math.abs(g.cy - region.cy) + Math.abs(g.rw - region.rw) + Math.abs(g.rh - region.rh) > .002;
    region.cx += (g.cx - region.cx) * k; region.cy += (g.cy - region.cy) * k; region.rw += (g.rw - region.rw) * k; region.rh += (g.rh - region.rh) * k;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const halfW = lerp(17.6, 19.6, e), halfH = lerp(6.5, 14.2, e);
    const dist = Math.max(halfW / (tanV * cam.aspect * region.rw), halfH / (tanV * region.rh)) * 1.04 + 6;
    const el = .42 + pitch, ty = lerp(2.4, 9.4, e);
    cam.position.set(0, ty + Math.sin(el) * dist, Math.cos(el) * dist);
    cam.lookAt(0, ty, 0);
    cam.setViewOffset(Wd, Hd, (.5 - region.cx) * Wd, (.5 - region.cy) * Hd, Wd, Hd);
    cam.near = Math.max(.5, dist - 80); cam.far = dist + 200; cam.updateProjectionMatrix();
    scene.fog.near = dist + 30; scene.fog.far = dist + 180;
  }

  function applyExplode(dt) {
    for (const id of ids) for (const n of parts[id].nodes) {
      const t = smooth(clamp((e - n.delay) / (1 - .44)));
      n.obj.position.set(n.base.x + n.ex.x * t, n.base.y + n.ex.y * t, n.base.z + n.ex.z * t);
    }
    const gy = lerp(-.3, -6.2, smooth(e)); grid.position.y = gy; shadow.position.y = gy + .02;
    shadow.material.opacity = lerp(.8, .35, e);
    const spin = RM ? 0 : lerp(48, 2.2, smooth(clamp(e * 1.6)));
    for (const s of spinners) { s.sp.rotation.y += s.dir * spin * dt; s.disc.material.opacity = clamp((spin - 12) / 40) * .32; s.blades.opacity = lerp(.9, .35, clamp((spin - 12) / 40)); }
  }

  function glow() {
    const pulse = .5 + .5 * Math.sin(clock * 4);
    for (const id of ids) {
      const on = id === selected, hov = id === hovered;
      for (const m of parts[id].mats) {
        if (!m.emissive) continue;
        if (on) { m.emissive.setHex(0x3fe0ff); m.emissiveIntensity = .25 + .3 * pulse; }
        else if (hov) { m.emissive.setHex(0x3fe0ff); m.emissiveIntensity = .22; }
        else { m.emissive.setHex(m.userData.e0 || 0); m.emissiveIntensity = m.userData.ei0 || 0; }
      }
    }
  }

  function placeLabels() {
    const vis = e > .12 || RM;
    const placed = [], pos = {};
    const order = ids.slice().sort((a, b) => (a === selected ? -1 : b === selected ? 1 : 0));
    if (vis) for (const id of order) {
      const p = parts[id]; if (!p.anchor) continue;
      p.anchor.getWorldPosition(tmp); tmp.project(cam);
      if (tmp.z > 1) continue;
      pos[id] = [clamp((tmp.x + 1) / 2 * Wd, 10, Wd - 10), clamp((1 - tmp.y) / 2 * Hd, 70, Hd - 70)];
    }
    for (const id of order) {
      const b = labMap[id], p = parts[id]; if (!b || !p.anchor) continue;
      if (!vis || !pos[id]) { if (b.classList.contains('vis') && D.activeElement === b) b.blur(); b.classList.remove('vis'); continue; }
      const [x, y] = pos[id];
      const w = labW[id] || 100;
      const dots = Object.keys(pos).filter(k => k !== id).map(k => ({ l: pos[k][0] - 9, r: pos[k][0] + 9, t: pos[k][1] - 9, b: pos[k][1] + 9 }));
      const rectR = { l: x + 8, r: x - 6 + w, t: y - 13, b: y + 13 }, rectL = { l: x - w + 6, r: x - 8, t: y - 13, b: y + 13 };
      const hit = (r) => r.l < 4 || r.r > Wd - 4 || placed.some(q => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t) || dots.some(q => r.l < q.r && r.r > q.l && r.t < q.b && r.b > q.t);
      let flip = x > Wd * .8, dot = false, rect = flip ? rectL : rectR;
      if (hit(rect)) { flip = !flip; rect = flip ? rectL : rectR; if (hit(rect)) dot = id !== selected; }
      if (!dot) placed.push(rect);
      b.classList.add('vis'); b.classList.toggle('flip', flip); b.classList.toggle('dot', dot); b.classList.toggle('hot', id === hovered);
      b.style.transform = `translate3d(${Math.round(flip ? x - w + 6 : x - 6)}px,${Math.round(y - (labH[id] || 28) / 2)}px,0)`;
    }
  }

  let lastYaw = -1, lastEx = -1;
  function readouts() {
    const deg = Math.round(((root.rotation.y * 180 / Math.PI) % 360 + 360) % 360), ex = Math.round(e * 100);
    if (deg !== lastYaw && roYaw) { roYaw.textContent = String(deg).padStart(3, '0'); lastYaw = deg; }
    if (ex !== lastEx) {
      if (roEx) roEx.textContent = ex;
      // Regler folgt der Animation, außer jemand hält ihn gerade fest
      if (exRange && !rangeHeld && performance.now() - rangeT > 500) { exRange.value = ex; }
      if (exRange) exRange.style.setProperty('--p', ex + '%');
      exBtns.forEach(b => b.classList.toggle('on', (+b.dataset.go === 1) === (e > .5)));
      lastEx = ex;
    }
  }

  function frame(now) {
    raf = 0; if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; clock += dt;
    e += (target - e) * (RM ? 1 : 1 - Math.pow(.004, dt));
    if (!drag) { yaw += vel; vel *= Math.pow(.05, dt); if (Math.abs(vel) < 1e-5) vel = 0; }
    root.rotation.y = yaw + impulse.v + (RM ? 0 : e * .8);
    applyExplode(dt); layoutCamera(); glow();
    renderer.render(scene, cam);
    placeLabels(); readouts();
    // Leerlauf: zerlegt, nichts bewegt sich, nichts gewählt. Dann ruht die Schleife (spart Akku, nichts ruckelt beim Scrollen)
    const busy = drag || rangeHeld || camMoving || target < .5 || Math.abs(target - e) > .002 || Math.abs(vel) > 1e-5 || selected || hovered || (GS() && gsap.isTweening(impulse));
    idleN = busy ? 0 : idleN + 1;
    if (idleN > 20) { idleN = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  let idleN = 0;
  function kick() { if (running && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function renderOnce() { applyExplode(0); layoutCamera(); renderer.render(scene, cam); placeLabels(); readouts(); }

  /* Nur rendern, wenn sichtbar */
  const io = new IntersectionObserver(es => { running = es.some(x => x.isIntersecting) && D.visibilityState !== 'hidden'; if (running) kick(); }, { rootMargin: '120px 0px' });
  io.observe(stage);
  D.addEventListener('visibilitychange', () => { if (D.visibilityState === 'hidden') running = false; else { const r = stage.getBoundingClientRect(); running = r.bottom > 0 && r.top < innerHeight; kick(); } });
  new ResizeObserver(size).observe(stage);
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => { battT.image.getContext('2d') && redrawBatt(); measure(); });
  function redrawBatt() {
    const c = battT.image, g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1a2230'); gr.addColorStop(1, '#0d121b');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#ffb020'; g.fillRect(0, 200, 512, 14); g.fillRect(0, 42, 512, 4);
    g.fillStyle = '#eaf4ff'; g.font = '400 132px "Bebas Neue", Impact, sans-serif'; g.textBaseline = 'middle'; g.fillText('6S LIPO', 34, 126);
    g.font = '600 26px "Chakra Petch", monospace'; g.fillStyle = '#9db1cc'; g.fillText('FLIGHT CLUB SAAR', 34, 232);
    battT.needsUpdate = true; kick();
  }

  /* ---------- Ziehen, Antippen, Hover ---------- */
  let drag = null;
  canvas.addEventListener('pointerdown', ev => {
    if (ev.button !== undefined && ev.button > 0) return;
    drag = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0, id: ev.pointerId, type: ev.pointerType };
    vel = 0; if (ev.pointerType === 'mouse') { try { canvas.setPointerCapture(ev.pointerId); } catch (x) {} }
    if (GS()) gsap.killTweensOf(impulse);
  });
  canvas.addEventListener('pointermove', ev => {
    if (drag && ev.pointerId === drag.id) {
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      yaw += dx * .009; vel = dx * .009 * .9;
      if (drag.type === 'mouse') pitch = clamp(pitch + dy * .004, -.32, .5);
      if (drag.moved > 10) { hint.done(); canvas.classList.add('grab'); }
      kick(); return;
    }
    if (FINE && ev.pointerType === 'mouse') { const id = pickAt(ev); if (id !== hovered) { hovered = id; canvas.classList.toggle('over', !!id); kick(); } }
  });
  const end = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const tap = drag.moved < 8 && performance.now() - drag.t < 600;
    drag = null; canvas.classList.remove('grab');
    if (tap && ev.type === 'pointerup') { const id = pickAt(ev); if (id) hint.done(); onPick(id); }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (hovered) { hovered = null; canvas.classList.remove('over'); kick(); } });
  function pickAt(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - r.left) / r.width * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(pick, false)[0];
    return hit ? hit.object.userData.part : null;
  }

  /* ---------- Zerlegen: Regler und Knöpfe (kein Festkleben beim Scrollen) ---------- */
  let touched = false, autoT = null;
  const user = () => { touched = true; if (autoT) { autoT.kill(); autoT = null; } };
  exBtns.forEach(b => b.addEventListener('click', () => {
    user(); target = +b.dataset.go; rangeT = 0; kick();
  }));
  if (exRange) {
    exRange.value = Math.round(target * 100);
    const set = () => { user(); rangeT = performance.now(); target = clamp(exRange.value / 100); exRange.style.setProperty('--p', exRange.value + '%'); kick(); };
    exRange.addEventListener('input', set);
    exRange.addEventListener('pointerdown', () => { rangeHeld = true; user(); });
    const rel = () => { rangeHeld = false; rangeT = performance.now(); };
    exRange.addEventListener('pointerup', rel); exRange.addEventListener('pointercancel', rel); exRange.addEventListener('change', rel);
  }

  /* ---------- Selbst-Impuls: dreht sich einmal und zerlegt sich von allein ---------- */
  firstSight(stage, () => {
    if (RM || !GS()) { if (!touched) { target = 1; kick(); } hint.show(); return; }
    autoT = gsap.timeline()
      .to(impulse, { v: 1.05, duration: 1.5, ease: 'power2.inOut', onUpdate: kick, onStart: kick })
      .add(() => { if (!touched) { target = 1; kick(); } }, .5)
      .to(impulse, { v: .45, duration: 1.2, ease: 'power2.inOut', onUpdate: kick })
      .add(() => hint.show(), 1.4);
  }, .4);

  size(); renderOnce();
  return { select(id) { selected = id; region && kick(); } };
}

/* Kleine Lichtumgebung für Metall-Reflexe */
function envScene() {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(60, 32, 16);
  const pos = g.attributes.position, cols = [];
  const top = new THREE.Color(.55, .7, .95), mid = new THREE.Color(.12, .2, .34), bot = new THREE.Color(.02, .035, .07), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 60; if (y > 0) c.copy(mid).lerp(top, Math.pow(y, .7)); else c.copy(mid).lerp(bot, Math.pow(-y, .6)); cols.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, col, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  panel(40, 14, new THREE.Color(5, 5, 5), 10, 40, 30);
  panel(30, 10, new THREE.Color(.6, 2.6, 3.2), -40, 10, -20);
  panel(24, 8, new THREE.Color(3, 1.8, .4), 40, 0, -10);
  return s;
}

/* =====================================================================
   02 · Schaltplan
   ===================================================================== */
const SP_COL = { p: '#ff4b5c', n: '#6f7c90', s: '#3fe0ff', v: '#ffb020', ph: '#c78bff' };
const SP_LAYOUT = {
  wide: {
    vb: [1000, 600],
    c: { cam: [390, 22, 220, 66], fc: [360, 170, 280, 150], vid: [60, 170, 200, 150], rx: [740, 170, 200, 150], esc: [360, 400, 280, 110], xt: [222, 410, 64, 90], akku: [30, 395, 140, 120] },
    m: { y: 566, r: 25, x: [395, 465, 535, 605], top: 510 },
    p: {
      c5v: [430, 88, 'b'], cgnd: [470, 88, 'b'], cvid: [550, 88, 'b'], ccab: [390, 55, 'l'],
      f_c5v: [430, 170, 't'], f_cgnd: [470, 170, 't'], f_cvid: [550, 170, 't'],
      f_vpwr: [360, 200, 'l'], f_vgnd: [360, 225, 'l'], f_va: [360, 250, 'l'], f_vb: [360, 275, 'l'],
      f_r5v: [640, 200, 'r'], f_rgnd: [640, 225, 'r'], f_ra: [640, 250, 'r'], f_rb: [640, 275, 'r'],
      f_h1: [455, 320, 'b'], f_h2: [485, 320, 'b'], f_h3: [515, 320, 'b'], f_h4: [545, 320, 'b'],
      v_pwr: [260, 200, 'r'], v_gnd: [260, 225, 'r'], v_a: [260, 250, 'r'], v_b: [260, 275, 'r'], v_cam: [160, 170, 't'],
      r_5v: [740, 200, 'l'], r_gnd: [740, 225, 'l'], r_a: [740, 250, 'l'], r_b: [740, 275, 'l'],
      e_h1: [455, 400, 't'], e_h2: [485, 400, 't'], e_h3: [515, 400, 't'], e_h4: [545, 400, 't'],
      e_bp: [360, 430, 'l'], e_bn: [360, 475, 'l'],
      x_ip: [222, 430, 'l'], x_in: [222, 475, 'l'], x_op: [286, 430, 'r'], x_on: [286, 475, 'r'],
      a_p: [170, 430, 'r'], a_n: [170, 475, 'r']
    },
    cap: [323, 430, 475]
  },
  tall: {
    vb: [420, 640],
    c: { vid: [8, 16, 124, 92], cam: [150, 16, 120, 60], rx: [288, 16, 124, 92], fc: [8, 176, 404, 120], esc: [120, 372, 292, 100], xt: [14, 380, 56, 84], akku: [8, 530, 100, 96] },
    m: { y: 556, r: 25, x: [157, 230, 303, 376], top: 472 },
    p: {
      v_pwr: [24, 108, 'b'], v_gnd: [50, 108, 'b'], v_a: [76, 108, 'b'], v_b: [102, 108, 'b'], v_cam: [132, 46, 'r'],
      c5v: [170, 76, 'b'], cgnd: [196, 76, 'b'], cvid: [244, 76, 'b'], ccab: [150, 46, 'l'],
      r_5v: [304, 108, 'b'], r_gnd: [330, 108, 'b'], r_a: [356, 108, 'b'], r_b: [382, 108, 'b'],
      f_vpwr: [24, 176, 't'], f_vgnd: [50, 176, 't'], f_va: [76, 176, 't'], f_vb: [102, 176, 't'],
      f_c5v: [170, 176, 't'], f_cgnd: [196, 176, 't'], f_cvid: [244, 176, 't'],
      f_r5v: [304, 176, 't'], f_rgnd: [330, 176, 't'], f_ra: [356, 176, 't'], f_rb: [382, 176, 't'],
      f_h1: [225, 296, 'b'], f_h2: [255, 296, 'b'], f_h3: [285, 296, 'b'], f_h4: [315, 296, 'b'],
      e_h1: [225, 372, 't'], e_h2: [255, 372, 't'], e_h3: [285, 372, 't'], e_h4: [315, 372, 't'],
      e_bp: [120, 398, 'l'], e_bn: [120, 446, 'l'],
      x_op: [70, 398, 'r'], x_on: [70, 446, 'r'], x_ip: [28, 464, 'b'], x_in: [56, 464, 'b'],
      a_p: [28, 530, 't'], a_n: [56, 530, 't']
    },
    cap: [95, 398, 446]
  }
};
const SP_SYS = {
  analog: { vid: ['Videosender', 'analog 5,8 GHz'], cam: ['Kamera', 'analog'] },
  dji: { vid: ['Air Unit', 'DJI O4'], cam: ['Kamera', 'am Sender'] },
  walksnail: { vid: ['Videosender', 'Walksnail Avatar'], cam: ['Kamera', 'am Sender'] },
  hdzero: { vid: ['Videosender', 'HDZero'], cam: ['Kamera', 'am Sender'] }
};
const SP_COMP = {
  akku: () => ({ t: 'LiPo-Akku', x: 'Liefert den Strom für alles. Bei 5 Zoll meist 4S oder 6S, also vier oder sechs Zellen in Reihe.', e: 'Beschädigte oder aufgeblähte Akkus nicht mehr benutzen. Laden nur unter Aufsicht und in einer feuerfesten Tasche.' }),
  xt: () => ({ t: 'XT60-Stecker', x: 'Die Steckverbindung zwischen Akku und Drohne. Er hält hohe Ströme aus und lässt sich nur in einer Richtung zusammenstecken.', e: 'Lötkelch mit zu wenig Zinn: Das Kabel löst sich unter Last. Immer Schrumpfschlauch über die Lötstellen.' }),
  cap: () => ({ t: 'Kondensator', x: 'Ein Low-ESR-Kondensator direkt an den Akkupads. Er fängt Spannungsspitzen ab, die sonst ESC, FC und Videobild stören.', e: 'Falsch herum eingelötet: Er kann platzen. Der Streifen auf dem Kondensator markiert Minus.' }),
  esc: () => ({ t: '4in1-ESC', x: 'Vier Motorregler auf einer Platine. Er bekommt den Akkustrom und treibt die vier Motoren an.', e: 'Lötzinnreste zwischen den Motorpads. Vor dem ersten Einstecken mit Lupe prüfen und einen Smoke Stopper benutzen.' }),
  mot: () => ({ t: 'Motoren M1 bis M4', x: 'Bürstenlose Motoren mit je drei Phasen. Betaflight zählt sie von M1 bis M4.', e: 'Reihenfolge und Drehrichtung nicht geprüft. In Betaflight im Motoren-Tab jeden Motor einzeln testen, nur ohne Propeller.' }),
  fc: (m) => ({ t: 'Flugcontroller', x: m === 'analog' ? 'Das Gehirn mit Gyro und Prozessor. Bei analogem Video blendet sein OSD-Chip Spannung und Warnungen direkt ins Bild ein.' : 'Das Gehirn mit Gyro und Prozessor. Bei digitalem Video schickt er die OSD-Werte über einen UART an den Sender.', e: 'Pad abgerissen durch zu lange Hitze. Kurz und heiß löten und Flussmittel benutzen.' }),
  rx: (m, r) => r === 'elrs'
    ? { t: 'ExpressLRS-Empfänger', x: 'Empfängt die Steuerbefehle deiner Funke, meist auf 2,4 GHz. Mit dem FC spricht er über das CRSF-Protokoll.', e: 'Binding-Phrase in Funke und Empfänger unterschiedlich: Er bindet nicht. Vor dem ersten Flug den Failsafe testen.' }
    : { t: 'Crossfire-Empfänger', x: 'Empfängt die Steuerbefehle auf 868 MHz, mit großer Reichweite. Auch er spricht CRSF mit dem FC.', e: 'Beim Nano RX müssen die Ausgänge auf CRSF stehen: CH1 ist dann TX, CH2 ist RX. Sonst kommt am FC nichts an.' },
  vid: (m) => ({
    analog: { t: 'Analoger Videosender', x: 'Funkt das Bild auf 5,8 GHz. Jede analoge Brille kann es empfangen, wenn sie auf denselben Kanal eingestellt ist.', e: 'Ohne Antenne eingeschaltet: Der Sender kann kaputtgehen. Immer zuerst die Antenne anschrauben.' },
    dji: { t: 'DJI O4 Air Unit', x: 'Digitaler Sender mit eigener Kamera. Das Bild siehst du nur in passenden DJI-Brillen. Die OSD-Werte kommen per MSP DisplayPort vom FC.', e: 'Am Boden lange ohne Luftstrom laufen lassen: Die Air Unit wird sehr heiß. Nie ohne Antenne einschalten.' },
    walksnail: { t: 'Walksnail Avatar', x: 'Digitaler Sender mit Kamera. Das Bild siehst du in Walksnail-Brillen oder im Walksnail-Empfänger.', e: 'Am Boden lange ohne Luftstrom laufen lassen: Der Sender wird sehr heiß. Nie ohne Antenne einschalten.' },
    hdzero: { t: 'HDZero-Sender', x: 'Digitaler Sender mit Kamera und sehr geringer, fester Latenz. Das Bild siehst du in HDZero-Brillen oder im HDZero-Empfänger.', e: 'Kamerakabel verdreht eingesteckt oder geknickt: kein Bild. Nie ohne Antenne einschalten.' }
  })[m],
  cam: (m) => m === 'analog'
    ? { t: 'Analoge FPV-Kamera', x: 'Liefert das Bild als analoges Signal. Es läuft über den FC zum Videosender.', e: 'Linse nicht fest: Das Bild wird unscharf. Neigung passend zum Flugstil einstellen.' }
    : { t: 'Kamera am Sender', x: 'Die Kamera gehört zum digitalen System und hängt direkt am Sender, nicht am FC.', e: 'Kamera eines anderen Systems passt nicht. Kamera und Sender müssen zusammengehören.' }
};
function spWires(m, r) {
  const dig = m !== 'analog', cf = r === 'crsf';
  const L = [
    { id: 'bat_p', a: 'a_p', b: 'x_ip', c: 'p', t: 'Akku Plus zum XT60', p: 'Akku + → XT60 Plus', x: 'Hier fließt der gesamte Strom für alle vier Motoren. Deshalb sind Akkukabel dick und kurz.', e: 'Plus und Minus vertauscht: Der ESC kann beim Einstecken sofort durchbrennen. Vor dem ersten Einstecken mit dem Multimeter messen oder einen Smoke Stopper dazwischenstecken.' },
    { id: 'bat_n', a: 'a_n', b: 'x_in', c: 'n', t: 'Akku Minus zum XT60', p: 'Akku − → XT60 Minus', x: 'Die Masse, also der Rückweg des Stroms.', e: 'Kabel am Stecker halb abgerissen oder schlecht gelötet: Die Stelle wird heiß und die Spannung bricht bei Vollgas ein.' },
    { id: 'xt_p', a: 'x_op', b: 'e_bp', c: 'p', t: 'XT60 zum ESC (Plus)', p: 'XT60 Plus → ESC BAT+', x: 'Vom Stecker direkt auf die Akkupads des 4in1-ESC. Der Kondensator hängt mit an diesen Pads.', e: 'Kalte Lötstelle auf dem großen Pad. Das Pad braucht viel Wärme, also einen kräftigen Lötkolben.' },
    { id: 'xt_n', a: 'x_on', b: 'e_bn', c: 'n', t: 'XT60 zum ESC (Minus)', p: 'XT60 Minus → ESC BAT−', x: 'Die Masse der ganzen Drohne. Alle anderen GND-Pads hängen daran.', e: 'Kabel scheuert an der Carbon-Kante. Carbon leitet Strom, ein blanker Draht daran kann einen Kurzschluss auslösen.' },
    { id: 'mot', mot: true, c: 'ph', t: 'ESC zu den Motoren', p: 'Je drei Phasen pro Motor, M1 bis M4', x: 'Der ESC schaltet die drei Wicklungen jedes Motors sehr schnell nacheinander. Die Reihenfolge der drei Adern ist egal.', e: 'Ein Motor dreht falsch herum: zwei der drei Adern tauschen oder die Richtung per Software umstellen, zum Beispiel im ESC-Configurator.' },
    { id: 'harn', harn: true, c: 's', t: 'Kabelbaum ESC zu FC', p: 'VBAT, GND, Strommessung (CUR) und Motorsignale M1 bis M4', x: 'Über dieses Kabel bekommt der FC Strom und schickt die Motorsignale an den ESC, meist als DShot. Der Strommesser meldet, wie viel die Drohne zieht.', e: 'Stecker nicht eingerastet oder anders belegt. Nicht jeder Hersteller belegt die Pins gleich: Belegung von FC und ESC vergleichen, bevor du einsteckst.' },
    { id: 'rx_5v', a: 'f_r5v', b: 'r_5v', c: 'p', t: '5 V zum Empfänger', p: 'FC 5V → Empfänger 5V', x: 'Der Empfänger bekommt seine Spannung vom 5-V-Pad des FC.', e: 'Empfänger an VBAT gelötet: Er brennt sofort durch. Immer ein 5-V-Pad nehmen.' },
    { id: 'rx_gnd', a: 'f_rgnd', b: 'r_gnd', c: 'n', t: 'Masse zum Empfänger', p: 'FC GND → Empfänger GND', x: 'Gemeinsame Masse. Ohne sie kann der FC das Signal nicht lesen.', e: 'Lötbrücke zwischen GND und 5V: Kurzschluss, der FC startet nicht.' },
    { id: 'rx_tx', a: 'r_a', b: 'f_rb', c: 's', x2: true, t: 'Empfänger TX zu FC RX', p: cf ? 'Empfänger CH1 (TX) → FC RX2' : 'Empfänger TX → FC RX2', x: 'Die Steuerbefehle deiner Funke. Was der Empfänger sendet (TX), muss der FC empfangen (RX). Die Leitungen werden deshalb gekreuzt.', e: 'TX an TX gelötet: Im Receiver-Tab von Betaflight bewegt sich nichts. Außerdem muss im Ports-Tab bei UART2 „Serial RX“ an sein, als Protokoll CRSF.' },
    { id: 'rx_rx', a: 'f_ra', b: 'r_b', c: 's', x2: true, t: 'FC TX zu Empfänger RX', p: cf ? 'FC TX2 → Empfänger CH2 (RX)' : 'FC TX2 → Empfänger RX', x: 'Der Rückkanal: Der FC schickt Telemetrie zur Funke, zum Beispiel die Akkuspannung. Auch hier gilt TX an RX.', e: 'Leitung vergessen: Steuern klappt oft trotzdem, aber die Telemetrie fehlt. Bei ExpressLRS gehen ohne sie auch keine Updates über den FC.' }
  ];
  if (!dig) L.push(
    { id: 'cam_5v', a: 'f_c5v', b: 'c5v', c: 'p', t: 'Strom für die Kamera', p: 'FC 5V → Kamera 5V', x: 'Analoge Kameras laufen meist an 5 V. Viele vertragen auch mehr, das steht im Datenblatt.', e: 'Kamera an ein Pad mit zu hoher Spannung gelötet. Erst ins Datenblatt schauen, dann löten.' },
    { id: 'cam_gnd', a: 'f_cgnd', b: 'cgnd', c: 'n', t: 'Masse der Kamera', p: 'FC GND → Kamera GND', x: 'Die Masse für Strom und Videosignal.', e: 'Schlecht gelötete Masse: Streifen und Flackern im Bild.' },
    { id: 'cam_vid', a: 'cvid', b: 'f_cvid', c: 'v', t: 'Kamerabild zum FC', p: 'Kamera VIDEO → FC CAM', x: 'Das analoge Bild geht zuerst in den FC. Dort blendet der OSD-Chip Akkuspannung, Flugzeit und Warnungen ein.', e: 'Video an das VTX-Pad statt an CAM gelötet: Dann fehlt das OSD oder das Bild bleibt schwarz.' },
    { id: 'vtx_vid', a: 'f_va', b: 'v_a', c: 'v', t: 'Bild mit OSD zum Videosender', p: 'FC VTX → Videosender VIDEO', x: 'Vom FC geht das Bild samt Einblendungen in den Videosender und von dort per Funk in deine Brille.', e: 'Videoleitung lang und direkt neben den Motorkabeln: Störungen im Bild. Kurz halten und Abstand zu den Phasen lassen.' },
    { id: 'vtx_pwr', a: 'f_vpwr', b: 'v_pwr', c: 'p', t: 'Strom für den Videosender', p: 'FC VBAT oder 9-V-Pad → Videosender VIN', x: 'Viele analoge Sender nehmen direkt Akkuspannung, andere brauchen 5 V oder 9 V. Was deiner braucht, steht im Datenblatt.', e: 'Videosender am falschen Spannungspad: Ein 5-V-Sender an VBAT brennt durch, ein Sender, der mehr braucht, startet an 5 V nicht sauber.' },
    { id: 'vtx_gnd', a: 'f_vgnd', b: 'v_gnd', c: 'n', t: 'Masse des Videosenders', p: 'FC GND → Videosender GND', x: 'Gemeinsame Masse mit FC und Kamera.', e: 'Masse an einem weit entfernten Pad: Störstreifen im Bild. Masse dicht neben der Videoleitung führen.' },
    { id: 'vtx_sa', a: 'v_b', b: 'f_vb', c: 's', t: 'SmartAudio oder Tramp', p: 'Videosender SA → FC TX1', x: 'Eine einzelne Leitung, über die der FC Kanal und Leistung des Senders einstellt, direkt im OSD-Menü. In Betaflight im Ports-Tab bei UART1 „VTX (TBS SmartAudio)“ oder „VTX (IRC Tramp)“ wählen.', e: 'An ein RX-Pad gelötet: Dann reagiert der Sender nicht. SmartAudio und Tramp gehören an TX.' }
  );
  else L.push(
    { id: 'du_pwr', a: 'f_vpwr', b: 'v_pwr', c: 'p', t: 'Strom für den digitalen Sender', p: 'FC VBAT oder 9-V/10-V-Pad → Sender VIN', x: 'Digitale Sender brauchen deutlich mehr Strom als analoge. Je nach Modell kommen sie an VBAT oder an ein eigenes 9-V- oder 10-V-Pad, das steht in der Anleitung.', e: 'An ein 5-V-Pad gehängt: Der Sender startet ständig neu oder gar nicht.' },
    { id: 'du_gnd', a: 'f_vgnd', b: 'v_gnd', c: 'n', t: 'Masse des Senders', p: 'FC GND → Sender GND', x: 'Gemeinsame Masse für Strom und Daten.', e: 'Kabel am mitgelieferten Stecker anders belegt als gedacht. Nicht nach Farben gehen, sondern nach der Beschriftung.' },
    { id: 'du_tx', a: 'v_a', b: 'f_vb', c: 's', x2: true, t: 'Sender TX zu FC RX', p: 'Sender TX → FC RX1', x: 'Datenleitung für das OSD: Sender und FC sprechen über MSP DisplayPort miteinander. TX geht an RX, die Leitungen werden gekreuzt.', e: 'TX und RX vertauscht: kein OSD in der Brille. Im Ports-Tab muss bei UART1 „VTX (MSP + DisplayPort)“ eingeschaltet sein.' },
    { id: 'du_rx', a: 'f_va', b: 'v_b', c: 's', x2: true, t: 'FC TX zu Sender RX', p: 'FC TX1 → Sender RX', x: 'Über diese Leitung schickt der FC die OSD-Daten an den Sender, der sie ins Bild einblendet.', e: 'Leitung abgerissen: Bild da, aber keine Einblendungen. Die dünnen Kabel am Stecker brechen gern nach Crashs.' },
    { id: 'du_cam', a: 'ccab', b: 'v_cam', c: 'v', t: 'Kamera zum Sender', p: 'Kamerakabel → Sender', x: 'Bei digitalen Systemen hängt die Kamera direkt am Sender, über ein Flachbandkabel oder ein dünnes Koaxkabel. Der FC sieht das Bild gar nicht.', e: 'Kabel geknickt oder nicht ganz eingesteckt: kein Bild oder Aussetzer. Stecker nur bei abgestecktem Akku lösen.' }
  );
  return L;
}
function spPinLabels(m, r) {
  const dig = m !== 'analog', cf = r === 'crsf';
  return {
    c5v: '5V', cgnd: 'GND', cvid: 'VID', ccab: '',
    f_c5v: dig ? '' : '5V', f_cgnd: dig ? '' : 'GND', f_cvid: dig ? '' : 'CAM',
    f_vpwr: 'VBAT', f_vgnd: 'GND', f_va: dig ? 'TX1' : 'VTX', f_vb: dig ? 'RX1' : 'TX1',
    f_r5v: '5V', f_rgnd: 'GND', f_ra: 'TX2', f_rb: 'RX2',
    f_h1: 'BAT', f_h2: 'GND', f_h3: 'CUR', f_h4: 'M1-4', e_h1: 'BAT', e_h2: 'GND', e_h3: 'CUR', e_h4: 'M1-4',
    v_pwr: 'VIN', v_gnd: 'GND', v_a: dig ? 'TX' : 'VID', v_b: dig ? 'RX' : 'SA', v_cam: '',
    r_5v: '5V', r_gnd: 'GND', r_a: cf ? 'CH1' : 'TX', r_b: cf ? 'CH2' : 'RX',
    e_bp: 'BAT+', e_bn: 'BAT−', a_p: '+', a_n: '−', x_ip: '', x_in: '', x_op: '', x_on: ''
  };
}
function roundPath(pts, r = 8) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1, rr = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${(x1 - (x1 - x0) / l1 * rr).toFixed(1)} ${(y1 - (y1 - y0) / l1 * rr).toFixed(1)} Q${x1} ${y1} ${(x1 + (x2 - x1) / l2 * rr).toFixed(1)} ${(y1 + (y2 - y1) / l2 * rr).toFixed(1)}`;
  }
  const z = pts[pts.length - 1]; return d + ` L${z[0]} ${z[1]}`;
}
const DIRV = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
function route(A, B, cross) {
  const [ax, ay, as] = A, [bx, by, bs] = B, da = DIRV[as], db = DIRV[bs], s = 16;
  const a1 = [ax + da[0] * s, ay + da[1] * s], b1 = [bx + db[0] * s, by + db[1] * s];
  if (cross) return [[ax, ay], a1, b1, [bx, by]];
  if ((as === 'l' || as === 'r') && (bs === 'l' || bs === 'r')) { if (ay === by) return [[ax, ay], [bx, by]]; const mx = (a1[0] + b1[0]) / 2; return [[ax, ay], [mx, ay], [mx, by], [bx, by]]; }
  if ((as === 't' || as === 'b') && (bs === 't' || bs === 'b')) { if (ax === bx) return [[ax, ay], [bx, by]]; const my = (a1[1] + b1[1]) / 2; return [[ax, ay], [ax, my], [bx, my], [bx, by]]; }
  if (as === 'l' || as === 'r') return [[ax, ay], [bx, ay], [bx, by]];
  return [[ax, ay], [ax, by], [bx, by]];
}

function schaltplan() {
  const sec = $('#schaltplan'); if (!sec) return;
  const svg = $('.wi-sp-svg', sec), board = $('.wi-sp-board', sec), info = $('.wi-sp-info', sec);
  const hint = makeHint($('.wi-hint-sp', sec));
  const out = { k: $('[data-sp-k]', info), t: $('[data-sp-t]', info), p: $('[data-sp-p]', info), x: $('[data-sp-x]', info), e: $('[data-sp-e]', info), c: $('[data-sp-c]', info) };
  let mode = 'analog', rxm = 'elrs', lay = null, wires = [], cur = { kind: 'w', id: 'bat_p' }, drawn = false, seen = false;

  function txt(parent, x, y, s, cls, size, anchor = 'middle') { const t = el('text', { x, y, class: cls, 'font-size': size, 'text-anchor': anchor, 'dominant-baseline': 'middle' }, parent); t.textContent = s; return t; }

  function render(animate) {
    const L = SP_LAYOUT[lay], P = L.p, lbl = spPinLabels(mode, rxm), dig = mode !== 'analog', sys = SP_SYS[mode];
    const tall = lay === 'tall', fs = tall ? 12 : 14, ps = tall ? 9.5 : 10.5;
    svg.innerHTML = ''; svg.setAttribute('viewBox', `0 0 ${L.vb[0]} ${L.vb[1]}`);
    const gC = el('g', { class: 'sp-comps' }, svg), gW = el('g', { class: 'sp-wires' }, svg);
    const comp = (id, title, sub, extra) => {
      const [x, y, w, h] = L.c[id]; const g = el('g', { class: `sp-c ${id}`, 'data-c': id, tabindex: 0, role: 'button' }, gC);
      el('title', {}, g).textContent = `Bauteil: ${title}${sub ? ', ' + sub : ''}`;
      el('rect', { class: 'box', x, y, width: w, height: h, rx: 10 }, g);
      const cy = y + h / 2;
      txt(g, x + w / 2, sub ? cy - fs * .55 : cy, title, 't', fs);
      if (sub) txt(g, x + w / 2, cy + fs * .75, sub, 's', fs - 3);
      if (extra) extra(g, x, y, w, h);
      return g;
    };
    const pinsOf = (g0, keys) => keys.forEach(k => {
      let g = g0;
      if (!(k in P)) return; const [x, y, s] = P[k]; const lab = lbl[k];
      if (lab === '' && /^f_c/.test(k)) return;
      el('rect', { class: 'pin', x: x - 4, y: y - 4, width: 8, height: 8, rx: 2 }, g);
      if (!lab) return;
      const off = 13;
      const lg = el('g', { 'aria-hidden': 'true' }, g); g = lg;
      if (s === 't') txt(g, x, y + off, lab, 'pl', ps); else if (s === 'b') txt(g, x, y - off + 1, lab, 'pl', ps);
      else if (s === 'l') txt(g, x + 10, y, lab, 'pl', ps, 'start'); else txt(g, x - 10, y, lab, 'pl', ps, 'end');
    });

    // Bauteile
    pinsOf(comp('akku', 'Akku', 'LiPo 4S/6S', (g, x, y, w, h) => { for (let i = 1; i < 4; i++) el('line', { class: 'deco', x1: x + w * i / 4, y1: y + 10, x2: x + w * i / 4, y2: y + 20 }, g); }), ['a_p', 'a_n']);
    pinsOf(comp('xt', 'XT60', ''), ['x_ip', 'x_in', 'x_op', 'x_on']);
    pinsOf(comp('esc', '4in1-ESC', 'Motorregler'), ['e_h1', 'e_h2', 'e_h3', 'e_h4', 'e_bp', 'e_bn']);
    pinsOf(comp('fc', 'Flugcontroller', 'FC mit Gyro'), ['f_c5v', 'f_cgnd', 'f_cvid', 'f_vpwr', 'f_vgnd', 'f_va', 'f_vb', 'f_r5v', 'f_rgnd', 'f_ra', 'f_rb', 'f_h1', 'f_h2', 'f_h3', 'f_h4']);
    pinsOf(comp('rx', 'Empfänger', rxm === 'elrs' ? 'ELRS 2,4 GHz' : 'Crossfire 868 MHz', (g, x, y, w) => {
      const ax = x + w - 18, ay = y + 14;
      if (rxm === 'elrs') { el('path', { class: 'deco', d: `M${ax} ${ay + 18}V${ay + 4}M${ax - 9} ${ay + 4}H${ax + 9}` }, g); }
      else { el('path', { class: 'deco', d: `M${ax} ${ay + 22}V${ay}M${ax - 4} ${ay + 2}H${ax + 4}` }, g); el('circle', { class: 'deco f', cx: ax, cy: ay, r: 3 }, g); }
    }), ['r_5v', 'r_gnd', 'r_a', 'r_b']);
    pinsOf(comp('vid', sys.vid[0], sys.vid[1], (g, x, y) => { el('path', { class: 'deco', d: `M${x + 18} ${y + 30}V${y + 14}` }, g); el('ellipse', { class: 'deco f', cx: x + 18, cy: y + 11, rx: 8, ry: 4 }, g); }), ['v_pwr', 'v_gnd', 'v_a', 'v_b'].concat(dig ? ['v_cam'] : []));
    pinsOf(comp('cam', sys.cam[0], sys.cam[1], (g, x, y, w, h) => { el('circle', { class: 'deco', cx: x + w - 16, cy: y + h / 2, r: 8 }, g); el('circle', { class: 'deco f', cx: x + w - 16, cy: y + h / 2, r: 4 }, g); }), dig ? ['ccab'] : ['c5v', 'cgnd', 'cvid']);
    // Kondensator
    const [cx, cy1, cy2] = L.cap; const cg = el('g', { class: 'sp-c cap', 'data-c': 'cap', tabindex: 0, role: 'button' }, gC);
    el('title', {}, cg).textContent = 'Bauteil: Kondensator';
    el('rect', { class: 'box', x: cx - 10, y: cy1 + 9, width: 20, height: cy2 - cy1 - 18, rx: 5 }, cg);
    el('rect', { class: 'deco f', x: cx + 3, y: cy1 + 11, width: 5, height: cy2 - cy1 - 22, rx: 2 }, cg);
    el('path', { class: 'deco', d: `M${cx} ${cy1}v9M${cx} ${cy2}v-9` }, cg);
    // Motoren
    const mg = el('g', { class: 'sp-c mot', 'data-c': 'mot', tabindex: 0, role: 'button' }, gC);
    el('title', {}, mg).textContent = 'Bauteil: Motoren M1 bis M4';
    L.m.x.forEach((mx, k) => {
      el('circle', { class: 'box', cx: mx, cy: L.m.y, r: L.m.r }, mg);
      el('circle', { class: 'deco', cx: mx, cy: L.m.y, r: L.m.r - 8 }, mg);
      txt(mg, mx, L.m.y + 1, 'M' + (k + 1), 't', tall ? 11 : 12);
    });

    // Leitungen
    wires = spWires(mode, rxm);
    wires.forEach(w => {
      const g = el('g', { class: 'sp-w', 'data-w': w.id, tabindex: 0, role: 'button', 'aria-label': `Leitung: ${w.t}`, style: `color:${SP_COL[w.c]}` }, gW);
      const ds = [];
      if (w.mot) {
        L.m.x.forEach(mx => [-12, 0, 12].forEach(o => { const yTop = L.m.y - Math.sqrt(L.m.r * L.m.r - o * o); ds.push([roundPath([[mx + o, L.m.top], [mx + o, yTop]]), null]); }));
      } else if (w.harn) {
        ['p', 'n', 's', 's'].forEach((c, i) => { const a = P['f_h' + (i + 1)], b = P['e_h' + (i + 1)]; ds.push([roundPath([[a[0], a[1]], [b[0], b[1]]]), SP_COL[c]]); });
      } else {
        const A = P[w.a], B = P[w.b]; if (!A || !B) return;
        ds.push([roundPath(route(A, B, w.x2), 9), null]);
      }
      ds.forEach(([d]) => el('path', { class: 'sp-hit', d }, g));
      ds.forEach(([d, col]) => { const p = el('path', { class: 'sp-line', d }, g); if (col) p.style.stroke = col; });
      ds.forEach(([d]) => el('path', { class: 'sp-flow', d }, g));
    });
    if (!wires.some(w => w.id === cur.id) && cur.kind === 'w') cur = { kind: 'w', id: wires[0].id };
    show(cur, false);
    if (animate && GS() && !RM && has('DrawSVGPlugin')) {
      const lines = $$('.sp-line', svg);
      gsap.fromTo($$('.sp-c', svg), { opacity: 0, scale: .92, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: .6, stagger: .05, ease: 'expo.out', clearProps: 'transform,opacity' });
      gsap.fromTo(lines, { drawSVG: '0%' }, { drawSVG: '100%', duration: .7, ease: 'power2.inOut', stagger: .035, delay: .25 });
    }
  }

  function show(sel, scroll) {
    cur = sel;
    $$('.sp-w', svg).forEach(g => g.classList.toggle('on', sel.kind === 'w' && g.dataset.w === sel.id));
    $$('.sp-c', svg).forEach(g => g.classList.toggle('on', sel.kind === 'c' && g.dataset.c === sel.id));
    svg.classList.add('dim');
    let d;
    if (sel.kind === 'w') {
      const i = wires.findIndex(w => w.id === sel.id); d = wires[i];
      out.k.textContent = 'Leitung'; out.c.textContent = `${i + 1} / ${wires.length}`;
      out.p.textContent = d.p;
    } else {
      d = SP_COMP[sel.id](mode, rxm); out.k.textContent = 'Bauteil'; out.p.textContent = '';
      out.c.textContent = `${wires.length} Leitungen`;
    }
    out.t.textContent = d.t; out.x.textContent = d.x; out.e.textContent = d.e;
    out.p.hidden = !out.p.textContent;
    if (scroll && innerWidth < 981) { const r = info.getBoundingClientRect(); if (r.top > innerHeight - 140) scrollToY(scrollY + r.top - (innerHeight - Math.min(300, innerHeight * .4))); }
  }
  const user = () => { if (!hint.gone) hint.done(); };
  svg.addEventListener('click', ev => {
    const w = ev.target.closest('.sp-w'), c = ev.target.closest('.sp-c');
    if (w) { user(); show({ kind: 'w', id: w.dataset.w }, true); } else if (c) { user(); show({ kind: 'c', id: c.dataset.c }, true); }
  });
  svg.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const w = ev.target.closest('.sp-w'), c = ev.target.closest('.sp-c'); if (!w && !c) return;
    ev.preventDefault(); user(); show(w ? { kind: 'w', id: w.dataset.w } : { kind: 'c', id: c.dataset.c }, false);
  });
  if (FINE) {
    svg.addEventListener('pointerover', ev => { const w = ev.target.closest('.sp-w'); if (w && drawn) { user(); show({ kind: 'w', id: w.dataset.w }, false); } });
  }
  $$('[data-sp-step]', info).forEach(b => b.addEventListener('click', () => {
    user(); let i = cur.kind === 'w' ? wires.findIndex(w => w.id === cur.id) : -1;
    i = (i + (+b.dataset.spStep) + wires.length) % wires.length; show({ kind: 'w', id: wires[i].id }, false);
  }));
  $$('input[name=wi-video], input[name=wi-rx]', sec).forEach(inp => inp.addEventListener('change', () => {
    user();
    const v = $('input[name=wi-video]:checked', sec), r = $('input[name=wi-rx]:checked', sec);
    const changed = inp.name === 'wi-video' ? 'vid' : 'rx';
    mode = v ? v.value : 'analog'; rxm = r ? r.value : 'elrs';
    render(false);
    // Nur die geänderten Teile neu zeichnen
    if (GS() && !RM && has('DrawSVGPlugin')) {
      const ids = changed === 'vid' ? ['vid', 'cam'] : ['rx'];
      const comps = ids.map(i => $(`.sp-c[data-c=${i}]`, svg)).filter(Boolean);
      gsap.fromTo(comps, { opacity: 0, scale: .9, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: .55, ease: 'back.out(1.8)', clearProps: 'transform,opacity' });
      const ws = wires.filter(w => changed === 'vid' ? /^(cam|vtx|du)_/.test(w.id) : /^rx_/.test(w.id)).map(w => $(`.sp-w[data-w=${w.id}]`, svg));
      gsap.fromTo(ws.flatMap(g => $$('.sp-line', g)), { drawSVG: '0%' }, { drawSVG: '100%', duration: .6, stagger: .05, ease: 'power2.out' });
      const first = wires.find(w => changed === 'vid' ? /^(cam|vtx|du)_/.test(w.id) : /^rx_/.test(w.id));
      if (first) show({ kind: 'w', id: first.id }, false);
    } else {
      const first = wires.find(w => changed === 'vid' ? /^(cam|vtx|du)_/.test(w.id) : /^rx_/.test(w.id)); if (first) show({ kind: 'w', id: first.id }, false);
    }
  }));

  const hintEl = $('.wi-hint-sp', sec);
  function placeHint() {
    if (!hintEl) return;
    const L = SP_LAYOUT[lay], rs = svg.getBoundingClientRect(), rb = board.getBoundingClientRect(), k = rs.width / L.vb[0], ox = rs.left - rb.left, oy = rs.top - rb.top;
    if (lay === 'wide') { hintEl.style.left = (ox + 30 * k) + 'px'; hintEl.style.top = (oy + 40 * k) + 'px'; hintEl.style.translate = '0 0'; }
    else { hintEl.style.left = (ox + 412 * k) + 'px'; hintEl.style.top = (oy + 612 * k) + 'px'; hintEl.style.translate = '-100% -50%'; }
  }
  function relayout() {
    const want = board.clientWidth < 560 ? 'tall' : 'wide';
    board.classList.toggle('wide', want === 'wide');
    if (want !== lay) { lay = want; render(false); }
    placeHint();
  }
  new ResizeObserver(relayout).observe(board);
  relayout();
  // Selbst-Impuls: nach dem Zeichnen zeigt der Plan von allein drei Leitungen nacheinander
  const tour = ['bat_p', 'harn', 'rx_tx'];
  let tourT = 0;
  function runTour(i) {
    if (hint.gone || i >= tour.length) return;
    show({ kind: 'w', id: tour[i] }, false);
    if (i + 1 < tour.length) tourT = setTimeout(() => runTour(i + 1), 1900);
  }
  // Vor dem ersten Sichtkontakt unsichtbar, dann wird gezeichnet
  if (GS() && !RM && has('DrawSVGPlugin')) gsap.set($$('.sp-line', svg), { drawSVG: '0%' });
  firstSight(board, () => {
    if (seen) return; seen = true;
    if (GS() && !RM && has('DrawSVGPlugin')) {
      const lines = $$('.sp-line', svg);
      gsap.fromTo($$('.sp-c', svg), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .6, stagger: .05, ease: 'expo.out', clearProps: 'transform,opacity' });
      gsap.fromTo(lines, { drawSVG: '0%' }, { drawSVG: '100%', duration: .7, ease: 'power2.inOut', stagger: .03, delay: .3, onComplete: () => { drawn = true; } });
      gsap.delayedCall(.3 + lines.length * .03 + .5, () => { hint.show(); drawn = true; runTour(0); });
    } else { drawn = true; show({ kind: 'w', id: 'bat_p' }, false); hint.show(); }
  }, .3);
}

/* =====================================================================
   03 · Videosysteme
   ===================================================================== */
const VS = {
  analog: { name: 'Analog', tag: 'Analog', lat: 'SEHR DIREKT', rows: [['Latenz-Gefühl', 'Sehr direkt. Das Bild kommt ohne Umweg über Komprimierung in die Brille.'], ['Bild', 'Geringe Auflösung. Bei schwachem Signal Rauschen und Streifen.'], ['Bei schwachem Signal', 'Das Bild wird langsam schlechter, bleibt aber meist noch erkennbar.'], ['Kompatibilität', 'Jede analoge Brille, auch von verschiedenen Herstellern.'], ['Preis-Klasse', 'Günstigster Einstieg, gebraucht gut zu finden.']] },
  dji: { name: 'DJI O4', tag: 'Digital', lat: 'GERING', rows: [['Latenz-Gefühl', 'Gering. Für Freestyle und Filmaufnahmen weit verbreitet.'], ['Bild', 'Die höchste Bildqualität der vier Systeme, in HD.'], ['Bei schwachem Signal', 'Bleibt lange klar, dann ruckelt das Bild oder friert ein.'], ['Kompatibilität', 'Nur mit passenden DJI-Brillen.'], ['Preis-Klasse', 'Teurer als analog. Brille und Sender als Paket planen.']] },
  walksnail: { name: 'Walksnail Avatar', tag: 'Digital', lat: 'GERING', rows: [['Latenz-Gefühl', 'Gering.'], ['Bild', 'HD, scharfes Bild.'], ['Bei schwachem Signal', 'Bleibt lange klar, dann ruckelt das Bild oder friert ein.'], ['Kompatibilität', 'Nur mit Walksnail-Brillen oder dem Walksnail-Empfänger.'], ['Preis-Klasse', 'Teurer als analog. Brille und Sender als Paket planen.']] },
  hdzero: { name: 'HDZero', tag: 'Digital', lat: 'SEHR GERING, FEST', rows: [['Latenz-Gefühl', 'Sehr gering und immer gleich: Die Latenz ist fest.'], ['Bild', 'HD, klar. Beliebt bei Rennpiloten.'], ['Bei schwachem Signal', 'Eher Bildfehler als ein stehendes Bild.'], ['Kompatibilität', 'Nur mit HDZero-Brillen oder dem HDZero-Empfänger.'], ['Preis-Klasse', 'Teurer als analog. Brille und Sender als Paket planen.']] }
};
function videosysteme() {
  const sec = $('#video'); if (!sec) return;
  const view = $('.wi-viewer', sec), vid = $('.wi-vid', sec), cv = $('.wi-vfx', sec), ctx = cv.getContext('2d');
  const range = $('#wi-sig'), valEl = $('[data-v-val]', sec), bars = $$('[data-v-bars] i', sec), barsBox = $('[data-v-bars]', sec);
  const warn = $('.wi-v-warn', sec), nameEl = $('[data-v-name]', sec), latEl = $('[data-v-lat]', sec);
  const cards = $$('.wi-vcard', sec), dTag = $('[data-d-tag]', sec), dName = $('[data-d-name]', sec), dRows = $('[data-d-rows]', sec), fold = $('.wi-vs-detail', sec);
  if (fold && innerWidth >= 900) fold.open = true;
  const hint = makeHint($('.wi-hint-sig', sec));
  let sys = 'analog', sig = 1, visible = false, raf = 0, frozen = false, lastDraw = 0, flash = 0;
  const small = D.createElement('canvas'), sctx = small.getContext('2d');
  const noise = [0, 1, 2, 3].map(() => { const c = D.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d'); const im = g.createImageData(160, 90); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; });

  function detail() {
    const s = VS[sys];
    dTag.textContent = s.tag; dTag.className = 'tag ' + (s.tag === 'Analog' ? 'amber' : 'sig'); dName.textContent = s.name;
    dRows.innerHTML = ''; s.rows.forEach(([k, v]) => { const d = D.createElement('div'); const dt = D.createElement('dt'); dt.textContent = k; const dd = D.createElement('dd'); dd.textContent = v; d.append(dt, dd); dRows.appendChild(d); });
    if (GS() && !RM && (!fold || fold.open)) gsap.fromTo(dRows.children, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: .5, stagger: .05, ease: 'expo.out' });
  }
  function setSys(s) {
    sys = s; view.dataset.sys = s; frozen = false; flash = 1;
    cards.forEach(c => c.setAttribute('aria-pressed', c.dataset.sys === s ? 'true' : 'false'));
    nameEl.textContent = VS[s].name.toUpperCase(); latEl.textContent = VS[s].lat;
    detail(); hud(); loop();
  }
  function hud() {
    const n = Math.round(sig * 5);
    bars.forEach((b, i) => b.classList.toggle('on', i < Math.max(1, n)));
    barsBox.classList.toggle('low', sig < .35);
    warn.hidden = sig > .28;
    valEl.textContent = Math.round(sig * 100) + ' %';
  }
  function setSig(v, fromUser) { sig = clamp(v); if (fromUser) range.value = Math.round(sig * 100); hud(); loop(); }

  function draw(now) {
    raf = 0; if (!visible) return;
    const w = cv.clientWidth, h = cv.clientHeight; if (!w) { raf = requestAnimationFrame(draw); return; }
    const dpr = Math.min(W.devicePixelRatio || 1, 1.5); const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const ready = vid.readyState >= 2;
    ctx.clearRect(0, 0, cw, ch);
    const weak = 1 - sig;
    if (sys === 'analog') {
      const a = .05 + Math.pow(weak, 1.4) * .9;
      ctx.globalAlpha = a; ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = true;
      ctx.drawImage(noise[(Math.random() * 4) | 0], 0, 0, cw, ch);
      ctx.globalAlpha = 1;
      if (ready && weak > .35) { // Streifen und Verschiebungen
        const n = Math.round(weak * 10);
        for (let i = 0; i < n; i++) { const y = Math.random() * ch, hh = 4 + Math.random() * 18 * weak, dx = (Math.random() - .5) * 60 * weak; ctx.drawImage(vid, 0, y / ch * vid.videoHeight, vid.videoWidth, hh / ch * vid.videoHeight, dx, y, cw, hh); }
      }
      if (weak > .6) { ctx.fillStyle = `rgba(255,255,255,${(weak - .6) * .35 * Math.random()})`; ctx.fillRect(0, 0, cw, ch); }
    } else if (ready) {
      const block = sig < .55 ? Math.round(lerp(2, 26, clamp((.55 - sig) / .45))) : 1;
      const freeze = sys !== 'hdzero' && sig < .22;
      if (freeze) {
        if (!frozen || now - lastDraw > lerp(900, 300, clamp(sig / .22))) { drawPix(block); lastDraw = now; frozen = true; } else { ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, cw, ch); }
      } else if (block > 1) { frozen = false; drawPix(block); }
      else frozen = false;
      if (sys === 'hdzero' && sig < .5) { // Blockfehler statt Standbild
        const n = Math.round((.5 - sig) * 40);
        for (let i = 0; i < n; i++) { const bw = 20 + Math.random() * 80, bh = 10 + Math.random() * 30, x = Math.random() * cw, y = Math.random() * ch; ctx.drawImage(vid, x / cw * vid.videoWidth, y / ch * vid.videoHeight, bw / cw * vid.videoWidth, bh / ch * vid.videoHeight, x + (Math.random() - .5) * 30, y, bw, bh); if (Math.random() < .3) { ctx.fillStyle = 'rgba(120,120,120,.6)'; ctx.fillRect(x, y, bw, bh); } }
      }
      function drawPix(b) {
        const sw = Math.max(8, Math.round(cw / b)), sh = Math.max(5, Math.round(ch / b));
        if (small.width !== sw || small.height !== sh) { small.width = sw; small.height = sh; }
        sctx.imageSmoothingEnabled = true; sctx.drawImage(vid, 0, 0, sw, sh);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, sw, sh, 0, 0, cw, ch); ctx.imageSmoothingEnabled = true;
      }
    }
    if (flash > 0) { ctx.globalAlpha = flash; ctx.drawImage(noise[(Math.random() * 4) | 0], 0, 0, cw, ch); ctx.globalAlpha = 1; flash = Math.max(0, flash - .06); }
    // Digital bei gutem Signal: Bild ist sauber, nichts zu zeichnen. Schleife ruht bis zur nächsten Änderung.
    if (sys !== 'analog' && sig >= .55 && flash <= 0) return;
    raf = requestAnimationFrame(draw);
  }
  function loop() { if (visible && !raf) raf = requestAnimationFrame(draw); }

  cards.forEach(c => {
    c.addEventListener('click', () => { hint.done(); setSys(c.dataset.sys); });
    if (FINE && !RM) {
      c.addEventListener('pointermove', ev => { const r = c.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5; c.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(4px)`; });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    }
  });
  let auto = null;
  const stopAuto = () => { if (auto) { auto.kill(); auto = null; } };
  range.addEventListener('input', () => { stopAuto(); hint.done(); setSig(range.value / 100, false); });
  range.addEventListener('pointerdown', () => { stopAuto(); hint.done(); });

  const io = new IntersectionObserver(es => {
    visible = es.some(x => x.isIntersecting);
    if (visible) { if (!vid.src && vid.dataset.wiSrc) vid.src = vid.dataset.wiSrc; vid.muted = true; if (!RM) vid.play().catch(() => {}); loop(); } else vid.pause();
  }, { rootMargin: '150px 0px' });
  io.observe(view);
  setSys('analog');
  firstSight(view, () => {
    hint.show();
    if (RM || !GS()) return;
    const o = { v: 1 };
    auto = gsap.timeline({ delay: .8 }).to(o, { v: .18, duration: 2.4, ease: 'power1.inOut', onUpdate: () => setSig(o.v, true) }).to(o, { v: 1, duration: 1.6, ease: 'power2.inOut', delay: .6, onUpdate: () => setSig(o.v, true) });
  }, .5);
}

/* =====================================================================
   04 · Kanäle und Frequenzen
   ===================================================================== */
const BANDS = {
  R: { n: 'Raceband', f: [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917] },
  F: { n: 'Fatshark', f: [5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880] },
  A: { n: 'Band A', f: [5865, 5845, 5825, 5805, 5785, 5765, 5745, 5725] },
  B: { n: 'Band B', f: [5733, 5752, 5771, 5790, 5809, 5828, 5847, 5866] },
  E: { n: 'Band E', f: [5705, 5685, 5665, 5645, 5885, 5905, 5925, 5945] }
};
const DE_LO = 5725, DE_HI = 5875, F0 = 5630, F1 = 5960;
// Vorschläge: möglichst großer Abstand, mit Luft zu den Rändern (vorab berechnet)
const PICKS = { 1: ['F4'], 2: ['F2', 'F6'], 3: ['F1', 'F4', 'F7'], 4: ['F1', 'F3', 'F5', 'F7'], 5: ['F1', 'A6', 'F4', 'A3', 'F7'], 6: ['R3', 'F2', 'A5', 'F5', 'R6', 'A1'] };
const chFreq = (c) => BANDS[c[0]].f[+c.slice(1) - 1];
const allowed = (f) => f >= DE_LO && f <= DE_HI;
function kanaele() {
  const sec = $('#kanaele'); if (!sec) return;
  const box = $('.wi-spec-box', sec), svg = $('.wi-spec-svg', sec), tip = $('.wi-spec-tip', sec);
  const nBtns = $$('.wi-pick-n button', sec), outL = $('.wi-pick-out', sec), title = $('[data-pick-t]', sec), note = $('[data-pick-note]', sec);
  const hint = makeHint($('.wi-hint-pick', sec));
  let n = 4, active = ['R', 'F', 'A', 'B', 'E'], selCh = null, shown = false, w = 0;
  const WORD = { 1: 'Ich fliege allein: welcher Kanal?', 2: 'Wir fliegen zu zweit: welche Kanäle?', 3: 'Wir fliegen zu dritt: welche Kanäle?', 4: 'Wir fliegen zu viert: welche Kanäle?', 5: 'Wir fliegen zu fünft: welche Kanäle?', 6: 'Wir fliegen zu sechst: welche Kanäle?' };

  function render() {
    w = Math.round(box.clientWidth); if (!w) return;
    const narrow = w < 560, padL = narrow ? 26 : 70, padR = 12, topH = narrow ? 86 : 96, rowH = narrow ? 40 : 46, axisH = 30;
    const H = topH + active.length * rowH + axisH + 8;
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('height', H); svg.innerHTML = '';
    const X = (f) => padL + (f - F0) / (F1 - F0) * (w - padL - padR);
    const yAxis = topH + active.length * rowH + 4;
    // erlaubter Bereich
    const zone = el('g', {}, svg);
    el('rect', { x: X(DE_LO), y: 26, width: X(DE_HI) - X(DE_LO), height: yAxis - 26, rx: 6, fill: 'rgba(62,224,138,.08)', stroke: 'rgba(62,224,138,.45)', 'stroke-dasharray': '4 5' }, zone);
    const zt = el('text', { x: (X(DE_LO) + X(DE_HI)) / 2, y: 14, 'text-anchor': 'middle', 'font-size': narrow ? 10 : 11.5, 'font-weight': 600, fill: '#3ee08a', 'letter-spacing': '.08em' }, zone);
    zt.textContent = narrow ? 'DE ERLAUBT · 25 mW' : 'IN DE ERLAUBT · 5725 BIS 5875 MHz · 25 mW EIRP';
    // Achse
    el('line', { x1: padL, x2: w - padR, y1: yAxis, y2: yAxis, stroke: 'rgba(158,196,255,.4)' }, svg);
    for (let f = 5640; f <= 5960; f += 20) {
      const major = f % (narrow ? 100 : 50) === 0;
      el('line', { x1: X(f), x2: X(f), y1: yAxis, y2: yAxis + (major ? 7 : 4), stroke: 'rgba(158,196,255,.5)' }, svg);
      if (major) { const t = el('text', { x: X(f), y: yAxis + 19, 'text-anchor': 'middle', 'font-size': narrow ? 9.5 : 11, fill: '#9db1cc' }, svg); t.textContent = f; }
    }
    const u = el('text', { x: w - padR, y: yAxis + 19, 'text-anchor': 'end', 'font-size': narrow ? 9 : 10.5, fill: '#9db1cc', opacity: narrow ? 0 : 1 }, svg); u.textContent = 'MHz';
    // Vorschlagskurven
    const pk = PICKS[n] || [];
    const gP = el('g', { class: 'picks' }, svg);
    pk.forEach((c, i) => {
      const f = chFreq(c), x = X(f), hw = X(f + 11) - x, base = topH - 6, hgt = topH - 50;
      el('path', { class: 'pk', d: `M${x - hw * 1.6} ${base} C${x - hw * .7} ${base} ${x - hw * .55} ${base - hgt} ${x} ${base - hgt} S${x + hw * .7} ${base} ${x + hw * 1.6} ${base}`, fill: 'rgba(255,176,32,.18)', stroke: '#ffb020', 'stroke-width': 1.8 }, gP);
      const t = el('text', { x, y: base - hgt - 7, 'text-anchor': 'middle', 'font-size': narrow ? 10 : 11.5, 'font-weight': 700, fill: '#ffb020' }, gP); t.textContent = 'P' + (i + 1);
      el('line', { x1: x, x2: x, y1: base, y2: yAxis, stroke: 'rgba(255,176,32,.45)', 'stroke-dasharray': '2 4' }, gP);
    });
    // Bänder
    active.forEach((b, r) => {
      const y0 = topH + r * rowH, g = el('g', { class: 'band' }, svg);
      const bl = el('text', { x: padL - 10, y: y0 + rowH / 2 + 4, 'text-anchor': 'end', 'font-size': narrow ? 11 : 12, 'font-weight': 700, fill: '#eaf4ff' }, g); bl.textContent = narrow ? b : BANDS[b].n.replace('Band ', '');
      el('line', { x1: padL, x2: w - padR, y1: y0 + rowH - 2, y2: y0 + rowH - 2, stroke: 'rgba(158,196,255,.08)' }, g);
      BANDS[b].f.forEach((f, i) => {
        const id = b + (i + 1), ok = allowed(f), isPick = pk.includes(id);
        const col = isPick ? '#ffb020' : ok ? '#3ee08a' : '#ff4b5c';
        const cg = el('g', { class: 'sp-ch' + (selCh === id ? ' on' : ''), 'data-ch': id, tabindex: 0, role: 'button', 'aria-label': `${id}, ${f} Megahertz, ${ok ? 'in Deutschland erlaubt' : 'in Deutschland nicht erlaubt'}${isPick ? ', Vorschlag' : ''}`, style: `color:${col}` }, g);
        const bw = narrow ? 5 : 7, bh = rowH - 22, x = X(f);
        el('rect', { x: x - 9, y: y0, width: 18, height: rowH - 2, fill: 'transparent' }, cg);
        el('rect', { class: 'bar', x: x - bw / 2, y: y0 + 16, width: bw, height: bh, rx: 2, fill: col, opacity: isPick ? 1 : ok ? .85 : .75 }, cg);
        const t = el('text', { class: 'lab', x, y: y0 + 9, 'text-anchor': 'middle', 'font-size': narrow ? 9 : 10.5 }, cg); t.textContent = id;
      });
    });
    if (!shown && GS() && !RM) gsap.set($$('.bar', svg), { scaleY: 0, transformOrigin: '50% 100%' });
  }
  function grow(all) {
    if (!GS() || RM) return;
    const bars = $$('.bar', svg);
    gsap.fromTo(bars, { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: .8, ease: 'expo.out', stagger: { each: all ? .012 : .004, from: 'start' } });
  }
  function pickAnim() { if (!GS() || RM) return; gsap.fromTo($$('.pk', svg), { scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, duration: .7, ease: 'back.out(1.6)', stagger: .07 }); }
  function info(id) {
    const b = id[0], f = chFreq(id), ok = allowed(f);
    const same = []; Object.keys(BANDS).forEach(k => BANDS[k].f.forEach((g, i) => { if (g === f && k + (i + 1) !== id) same.push(k + (i + 1)); }));
    tip.innerHTML = `<b>${id}</b> · ${f} MHz · ${BANDS[b].n} · <span class="${ok ? 'ok' : 'no'}">${ok ? 'in DE erlaubt' : 'in DE nicht erlaubt: liegt ' + (f < DE_LO ? 'unter 5725' : 'über 5875') + ' MHz'}</span>${same.length ? ' · gleiche Frequenz wie ' + same.join(', ') : ''}`;
  }
  function pickOut() {
    title.textContent = WORD[n];
    outL.innerHTML = '';
    (PICKS[n] || []).forEach((c, i) => { const li = D.createElement('li'); li.innerHTML = `<small>Pilot ${i + 1}</small><b>${c}</b><span>${chFreq(c)} MHz · ${BANDS[c[0]].n}</span>`; outL.appendChild(li); });
    note.textContent = n >= 5 ? 'Ab fünf Piloten wird es eng. Wenn sich die Bilder stören, fliegt lieber in zwei Gruppen nacheinander. Alle stellen ihren Kanal ein, bevor jemand den Akku einsteckt.' : 'Alle stellen ihren Kanal ein, bevor jemand den Akku einsteckt. Wer später dazukommt, fragt erst, welche Kanäle belegt sind.';
    nBtns.forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === n ? 'true' : 'false'));
    if (GS() && !RM) gsap.fromTo(outL.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .06, ease: 'expo.out' });
  }
  function setN(v, anim = true) { n = v; render(); pickOut(); if (anim) pickAnim(); }
  nBtns.forEach(b => b.addEventListener('click', () => { stopAuto(); hint.done(); setN(+b.dataset.n); }));
  $$('input[name=wi-band]', sec).forEach(i => i.addEventListener('change', () => { active = $$('input[name=wi-band]:checked', sec).map(x => x.value); render(); grow(false); }));
  svg.addEventListener('click', ev => { const g = ev.target.closest('.sp-ch'); if (!g) return; selCh = g.dataset.ch; $$('.sp-ch', svg).forEach(x => x.classList.toggle('on', x === g)); info(selCh); });
  svg.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('.sp-ch')) { ev.preventDefault(); ev.target.closest('.sp-ch').dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  if (FINE) svg.addEventListener('pointerover', ev => { const g = ev.target.closest('.sp-ch'); if (g) info(g.dataset.ch); });
  let lastW = 0; new ResizeObserver(() => { const nw = Math.round(box.clientWidth); if (nw && nw !== lastW) { lastW = nw; render(); } }).observe(box);
  render(); pickOut();
  let auto = null; const stopAuto = () => { if (auto) { auto.kill(); auto = null; } };
  firstSight(box, () => {
    shown = true; grow(true); hint.show();
    if (RM || !GS()) return;
    // Selbst-Impuls: kurz von 1 auf 4 hochzählen
    const seq = { v: 1 };
    auto = gsap.to(seq, { v: 4, duration: 1.6, delay: 1, ease: 'none', snap: { v: 1 }, onUpdate: () => { if (+seq.v !== n) setN(+seq.v); } });
  }, .3);
}

/* =====================================================================
   05 · Weg zum ersten Flug
   ===================================================================== */
function weg() {
  const sec = $('#weg'); if (!sec) return;
  const view = $('.wi-way-view', sec), trackEl = $('.wi-way-track', sec), steps = $$('.wi-step', sec);
  const svg = $('.wi-way-svg', sec), bg = $('.wi-way-bg', sec), fg = $('.wi-way-fg', sec), drone = $('.wi-way-drone', sec), counter = $('[data-way-c]', sec);
  const hint = makeHint($('.wi-hint-way', sec));
  let x = 0, maxX = 0, len = 1, idx = 0, drag = null, pts = [];
  const ps = { l: 0 };
  const drawPath = () => { fg.style.strokeDashoffset = len - ps.l; const p = fg.getPointAtLength(ps.l); drone.style.transform = `translate3d(${p.x - 20}px,${p.y - 20}px,0)`; };

  function measure() {
    const tw = trackEl.scrollWidth; maxX = Math.max(0, tw - view.clientWidth);
    svg.setAttribute('width', tw); svg.setAttribute('viewBox', `0 0 ${tw} 110`);
    pts = steps.map((s, i) => [s.offsetLeft + 32, i % 2 ? 76 : 44]);
    let d = `M${pts[0][0] - 30} 60`;
    pts.forEach((p, i) => { const prev = i ? pts[i - 1] : [pts[0][0] - 30, 60]; const mx = (prev[0] + p[0]) / 2; d += ` C${mx} ${prev[1]} ${mx} ${p[1]} ${p[0]} ${p[1]}`; });
    bg.setAttribute('d', d); fg.setAttribute('d', d);
    len = fg.getTotalLength(); fg.style.strokeDasharray = `${len} ${len}`;
    setX(clamp(x, -maxX, 0), true, true);
  }
  function stepX(i) { return clamp(-(steps[i].offsetLeft - (steps[0].offsetLeft)), -maxX, 0); }
  function progressAt(px) {
    // Fortschritt entlang der Strecke: Mitte des sichtbaren Bereichs
    const center = -px + view.clientWidth * (innerWidth < 700 ? .5 : .35);
    let best = 0; for (let i = 0; i < steps.length; i++) if (steps[i].offsetLeft <= center) best = i;
    return best;
  }
  function setX(v, instant, snap) {
    x = v; trackEl.style.transform = `translate3d(${x}px,0,0)`;
    const i = progressAt(x);
    // Linie bis zum aktuellen Wegpunkt, Drohne darauf
    const target = pts[i] ? pts[i][0] : 0;
    let lo = 0, hi = len; for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (fg.getPointAtLength(mid).x < target) lo = mid; else hi = mid; }
    const L = lo;
    if (snap || !GS() || RM) { if (GS()) gsap.killTweensOf(ps); ps.l = L; drawPath(); }
    else if (i !== idx) gsap.to(ps, { l: L, duration: .7, ease: 'power2.out', overwrite: true, onUpdate: drawPath });
    if (i !== idx || snap) { idx = i; steps.forEach((s, k) => s.classList.toggle('on', k === i)); counter.textContent = `WP ${i + 1} / ${steps.length}`; }
  }
  function goTo(i, dur = .8) {
    i = clamp(i, 0, steps.length - 1);
    const to = stepX(i);
    if (GS() && !RM) { const o = { v: x }; gsap.to(o, { v: to, duration: dur, ease: 'power3.inOut', overwrite: true, onUpdate: () => setX(o.v) }); } else setX(to);
  }

  // Ziehen (Maus und Finger), vertikales Scrollen bleibt frei
  view.addEventListener('pointerdown', ev => {
    if (ev.target.closest('a,button')) return;
    drag = { sx: ev.clientX, sy: ev.clientY, x0: x, on: false, id: ev.pointerId, vx: 0, lx: ev.clientX, lt: performance.now() };
    if (ev.pointerType === 'mouse') ev.preventDefault();
  });
  W.addEventListener('pointermove', ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; hint.done(); try { view.setPointerCapture(ev.pointerId); } catch (e) {} } else if (Math.abs(dy) > 10) { drag = null; return; } else return; }
    const now = performance.now(); drag.vx = (ev.clientX - drag.lx) / Math.max(1, now - drag.lt); drag.lx = ev.clientX; drag.lt = now;
    let nx = drag.x0 + dx; if (nx > 0) nx *= .35; if (nx < -maxX) nx = -maxX + (nx + maxX) * .35;
    setX(nx, true);
  });
  const up = () => {
    if (!drag) return; const was = drag.on, vx = drag.vx; drag = null; if (!was) return;
    const proj = x + vx * 260; let best = 0, bd = 1e9; steps.forEach((s, i) => { const d = Math.abs(stepX(i) - proj); if (d < bd) { bd = d; best = i; } });
    goTo(best, .7);
  };
  W.addEventListener('pointerup', up); W.addEventListener('pointercancel', up);
  $$('[data-way]', sec).forEach(b => b.addEventListener('click', () => { hint.done(); goTo(idx + (+b.dataset.way)); }));
  steps.forEach((s, i) => s.addEventListener('focusin', () => { const r = s.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth) goTo(i, .5); }));
  new ResizeObserver(measure).observe(view);
  measure();
  // Selbst-Impuls: Strecke kurz anschieben
  firstSight(view, () => {
    hint.show();
    if (GS()) gsap.fromTo(steps, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8, stagger: .08, ease: 'expo.out', clearProps: 'opacity,transform' });
    if (RM || !GS() || maxX < 40) return;
    const o = { v: 0 }, far = -Math.min(maxX, Math.max(160, view.clientWidth * .35));
    gsap.timeline({ delay: .9 }).to(o, { v: far, duration: 1.1, ease: 'power2.inOut', onUpdate: () => { if (!hint.gone) setX(o.v, true); } }).to(o, { v: 0, duration: 1, ease: 'power2.inOut', onUpdate: () => { if (!hint.gone) setX(o.v, true); } });
  }, .35);
}

/* =====================================================================
   06 · Checkliste
   ===================================================================== */
function checkliste() {
  const sec = $('#check'); if (!sec) return;
  const boxes = $$('input[data-ck]', sec), ring = $('.wi-ring', sec), fgc = $('.wi-ring-fg', sec);
  const nEl = $('[data-ck-n]', sec), ofEl = $('[data-ck-of]', sec), stEl = $('[data-ck-state]', sec), msg = $('[data-ck-msg]', sec);
  const hint = makeHint($('.wi-hint-ck', sec));
  const KEY = 'fcs-wissen-check';
  let store = [];
  try { store = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(store)) store = []; } catch (e) { store = []; }
  boxes.forEach(b => { b.checked = store.includes(b.dataset.ck); });
  ofEl.textContent = boxes.length;
  let shownN = 0;
  function update(anim) {
    const done = boxes.filter(b => b.checked), n = done.length, all = n === boxes.length;
    const pct = n / boxes.length * 100;
    if (GS() && anim && !RM) { gsap.to(fgc, { strokeDashoffset: 100 - pct, duration: .7, ease: 'expo.out' }); const o = { v: shownN }; gsap.to(o, { v: n, duration: .5, snap: { v: 1 }, onUpdate: () => { nEl.textContent = o.v; } }); }
    else { fgc.style.strokeDashoffset = 100 - pct; nEl.textContent = n; }
    shownN = n;
    ring.classList.toggle('done', all);
    stEl.textContent = all ? 'BEREIT' : n ? 'PRÜFEN …' : 'DISARMED';
    msg.textContent = all ? 'Alles geprüft. Guten Flug! Nach der Landung zuerst disarmen, dann den Akku abstecken.' : n ? `Noch ${boxes.length - n} ${boxes.length - n === 1 ? 'Punkt' : 'Punkte'} offen.` : 'Hak ab, was du geprüft hast.';
    if (all && anim && GS() && !RM) gsap.fromTo(ring, { scale: .96 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.4)' });
    try { localStorage.setItem(KEY, JSON.stringify(done.map(b => b.dataset.ck))); } catch (e) {}
  }
  boxes.forEach(b => b.addEventListener('change', () => { hint.done(); update(true); }));
  $('.wi-ck-reset', sec).addEventListener('click', () => { boxes.forEach(b => { b.checked = false; }); update(true); });
  update(false);
  firstSight($('.wi-check-grid', sec), () => {
    if (!boxes.some(b => b.checked)) { hint.show(); const first = boxes[0].closest('.check'); first.classList.add('pulse'); setTimeout(() => first.classList.remove('pulse'), 3200); }
    if (RM || !GS()) return;
    // Systemcheck: Ring einmal füllen und zurück auf den echten Stand
    const real = 100 - boxes.filter(b => b.checked).length / boxes.length * 100;
    gsap.timeline().to(fgc, { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut' }).to(fgc, { strokeDashoffset: real, duration: .9, ease: 'power2.inOut' });
  }, .35);
}

/* =====================================================================
   07 · Glossar
   ===================================================================== */
function glossar() {
  const sec = $('#glossar'); if (!sec) return;
  const q = $('#wi-q'), terms = $$('.wi-term', sec), nEl = $('[data-gl-n]', sec), tEl = $('[data-gl-t]', sec), empty = $('.wi-gl-empty', sec);
  const more = $('.wi-gl-more', sec), foot = $('.wi-gl-foot', sec), allN = $('[data-gl-all]', sec);
  let full = false;
  if (allN) allN.textContent = terms.length;
  const hint = makeHint($('.wi-hint-gl', sec));
  terms.sort((a, b) => $('dt', a).textContent.localeCompare($('dt', b).textContent, 'de')).forEach(t => t.parentNode.appendChild(t));
  const orig = new Map(terms.map(t => [t, { dt: $('dt', t).textContent, dd: $('dd', t).textContent }]));
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const mark = (text, needle) => {
    if (!needle) return esc(text);
    const nt = norm(text), i = nt.indexOf(needle); if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + needle.length)) + '</mark>' + esc(text.slice(i + needle.length));
  };
  let cat = '';
  function apply(anim) {
    const needle = norm(q.value.trim()), filtered = !!(needle || cat), start = !filtered && !full;
    let n = 0; const vis = [];
    terms.forEach(t => {
      const o = orig.get(t), hay = norm(o.dt + ' ' + o.dd + ' ' + (t.dataset.alias || ''));
      const ok = start ? t.hasAttribute('data-start') : (!cat || t.dataset.cat === cat) && (!needle || hay.includes(needle));
      t.hidden = !ok; if (ok) { n++; vis.push(t); }
      $('dt', t).innerHTML = mark(o.dt, needle); $('dd', t).innerHTML = mark(o.dd, needle);
    });
    nEl.textContent = n; empty.hidden = n > 0;
    if (tEl) tEl.textContent = start ? 'Begriffe für den Anfang' : filtered ? (n === 1 ? 'Treffer' : 'Treffer') + ' von ' + terms.length : 'Begriffe von A bis Z';
    if (foot) foot.hidden = filtered;
    if (more) { more.setAttribute('aria-expanded', String(full)); more.innerHTML = full ? 'Nur die wichtigsten zeigen <span class="arr">↑</span>' : `Alle ${terms.length} Begriffe zeigen <span class="arr">↓</span>`; }
    if (anim && GS() && !RM) gsap.fromTo(vis.slice(0, 18), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .4, stagger: .02, ease: 'expo.out', overwrite: true });
  }
  q.addEventListener('input', () => { stopDemo(); hint.done(); apply(false); });
  if (more) more.addEventListener('click', () => {
    stopDemo(); hint.done(); full = !full; apply(full);
    if (!full) { const r = sec.getBoundingClientRect(); if (r.top < 0) scrollToY(scrollY + r.top - 60); }
  });
  q.addEventListener('focus', () => { stopDemo(); hint.done(); });
  $$('input[name=wi-cat]', sec).forEach(r => r.addEventListener('change', () => { stopDemo(); hint.done(); cat = r.value; apply(true); }));
  apply(false);
  // Selbst-Impuls: Platzhalter tippt Beispielbegriffe
  let demo = 0; const words = ['Failsafe', 'Turtle Mode', 'Prop wash', 'SmartAudio', 'Bando'], base = q.getAttribute('placeholder');
  function stopDemo() { if (demo) { clearTimeout(demo); demo = 0; q.setAttribute('placeholder', base); } }
  firstSight(sec.querySelector('.wi-gl-ctrl'), () => {
    hint.show();
    if (GS() && !RM) gsap.fromTo(terms.filter(t => !t.hidden).slice(0, 12), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .7, stagger: .03, ease: 'expo.out', clearProps: 'opacity,transform' });
    if (RM) return;
    let w = 0, c = 0, dir = 1;
    const tick = () => {
      if (D.activeElement === q || q.value) return;
      const word = words[w % words.length];
      c += dir; q.setAttribute('placeholder', 'Suche: ' + word.slice(0, c) + (dir > 0 ? '▍' : ''));
      if (c >= word.length) { dir = -1; demo = setTimeout(tick, 1300); return; }
      if (c <= 0) { dir = 1; w++; if (w >= words.length) { q.setAttribute('placeholder', base); demo = 0; return; } }
      demo = setTimeout(tick, dir > 0 ? 90 : 40);
    };
    demo = setTimeout(tick, 600);
  }, .5);
}

/* =====================================================================
   Kopf-OSD, Abschluss
   ===================================================================== */
function kopf() {
  const v = $('[data-wi-volt]'); if (!v) return;
  let t = 0;
  const upd = () => { t = 0; const p = clamp(scrollY / Math.max(1, D.documentElement.scrollHeight - innerHeight)); v.textContent = (25.2 - p * 3.4).toFixed(1); };
  addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(upd); }, { passive: true }); upd();
}
function abschluss() {
  const s = $('.wi-cta'), h = $('.wi-horizon', s || D); if (!s || !h || RM) return;
  let tgt = 0;
  if (FINE) s.addEventListener('pointermove', ev => { const r = s.getBoundingClientRect(); tgt = ((ev.clientX - r.left) / r.width - .5) * 24; h.style.setProperty('--roll', tgt.toFixed(1) + 'deg'); });
  else if (GS() && getComputedStyle(h).display !== 'none') {
    const o = { v: -6 }, tw = gsap.to(o, { v: 6, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut', paused: true, onUpdate: () => h.style.setProperty('--roll', o.v.toFixed(1) + 'deg') });
    new IntersectionObserver(es => { es[0].isIntersecting ? tw.play() : tw.pause(); }).observe(s);
  }
}

whenReady(() => {
  run('Drohne', drone);
  run('Schaltplan', schaltplan);
  run('Videosysteme', videosysteme);
  run('Kanäle', kanaele);
  run('Weg', weg);
  run('Checkliste', checkliste);
  run('Glossar', glossar);
  run('Pausen', pauseOffscreen);
  run('Kopf', kopf);
  run('Abschluss', abschluss);
  if (has('ScrollTrigger')) { ScrollTrigger.refresh(); setTimeout(() => ScrollTrigger.refresh(), 600); }
});
