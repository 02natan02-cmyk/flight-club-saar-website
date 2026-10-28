/* Flight Club Saar · Clip-Studio: WebGL-Compositor
   Ein Renderer für Vorschau UND Export, damit das fertige Video genau so aussieht wie die Vorschau.
   Macht: Bildausschnitt, Übergänge (Blende, Blitz, Zoom, Wisch, Whip-Pan, Glitch), Looks (Farbstimmungen) mit Stärke,
   DJI D-Log M → normal (Kurve und D-Gamut-Matrix aus DJIs D-Log-Whitepaper, ausgeglichen mit einer Filmkurve)
   und optional eine echte 3D-LUT (.cube), Ausblenden ins Schwarze am Ende.
   Quellen A und B: Video-Element, Canvas, ImageBitmap oder VideoFrame. */

export const LOOKS = {
  natur:    { n: 'Natürlich' },
  warm:     { n: 'Warm Cinematic', temp: .55, con: 1.12, sat: .9, lift: .025, sh: [-.02, .012, .03], hi: [.045, .018, -.03] },
  kraeftig: { n: 'Kräftig', con: 1.16, sat: 1.38, lift: 0, sh: [0, 0, .01], hi: [.01, .005, 0] },
  kuehl:    { n: 'Kühl', temp: -.5, con: 1.06, sat: .88, lift: .015, sh: [0, .01, .035], hi: [-.01, .005, .02] },
  sw:       { n: 'Schwarzweiß', con: 1.24, sat: 0, mono: 1, lift: .01 },
  dlogm:    { n: 'DJI D-Log M → normal', log: 1, sat: 1.06, con: 1.02 }
};
// Ersatz, falls WebGL auf einem Gerät nicht geht: CSS-Filter (nur Vorschau)
export function cssLook(id, k) {
  k = Math.max(0, Math.min(1, k == null ? 1 : k));
  const f = (a, b) => a + (b - a) * k;
  switch (id) {
    case 'warm': return `sepia(${f(0, .2)}) saturate(${f(1, .92)}) contrast(${f(1, 1.1)})`;
    case 'kraeftig': return `saturate(${f(1, 1.38)}) contrast(${f(1, 1.15)})`;
    case 'kuehl': return `hue-rotate(${f(0, -10)}deg) saturate(${f(1, .88)}) contrast(${f(1, 1.05)}) brightness(${f(1, 1.02)})`;
    case 'sw': return `grayscale(${k}) contrast(${f(1, 1.24)})`;
    case 'dlogm': return `contrast(${f(1, 1.5)}) saturate(${f(1, 1.55)}) brightness(${f(1, .97)})`;
    default: return 'none';
  }
}
export const TRANS = {
  schnitt: { n: 'Schnitt', d: 0 },
  blende:  { n: 'Blende', d: .7 },
  blitz:   { n: 'Blitz', d: .32 },
  zoom:    { n: 'Zoom', d: .42 },
  wisch:   { n: 'Wisch', d: .5 },
  whip:    { n: 'Whip-Pan', d: .36 },
  glitch:  { n: 'Glitch', d: .3 }
};
/* Übergänge ohne WebGL, mit 2D-Zeichnen (Export-Ersatz und Echtzeit-Weg). A/B: Quelle, ra/rb: [sx, sy, sw, sh] oder null,
   tr: {type, p, seed}, base: Canvas-Filter des Looks ('none' oder zum Beispiel 'contrast(1.1)') */
export function tr2d(ctx, A, ra, B, rb, tr, W, H, base) {
  const d = (S, r, x, y, w, h) => { if (r) ctx.drawImage(S, r[0], r[1], r[2], r[3], x, y, w, h); else ctx.drawImage(S, x, y, w, h); };
  const f0 = base && base !== 'none' ? base : '', setF = extra => { if ('filter' in ctx) ctx.filter = (f0 + ' ' + (extra || '')).trim() || 'none'; };
  const p = Math.max(0, Math.min(1, tr.p)), e = p * p * (3 - 2 * p);
  setF(); ctx.globalAlpha = 1;
  switch (tr.type) {
    case 'blitz': d(B, rb, 0, 0, W, H); ctx.filter = 'none'; ctx.fillStyle = '#fff'; ctx.globalAlpha = Math.pow(1 - p, 2.2) * .95; ctx.fillRect(0, 0, W, H); break;
    case 'zoom': {
      const q = p < .5 ? p / .5 : (p - .5) / .5, s = p < .5 ? 1 + .45 * q * q : 1.3 - .3 * (1 - Math.pow(1 - q, 3));
      d(p < .5 ? A : B, p < .5 ? ra : rb, W * (1 - s) / 2, H * (1 - s) / 2, W * s, H * s); break;
    }
    case 'wisch': {
      d(A, ra, 0, 0, W, H);
      const k = e * 1.5 - .25, x0 = k / .8 * W, x1 = (k - .2) / .8 * W;
      ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x0, 0); ctx.lineTo(x1, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
      d(B, rb, 0, 0, W, H); ctx.restore(); setF(); break;
    }
    case 'whip': {
      setF(`blur(${(Math.sin(Math.PI * p) * W * .012).toFixed(1)}px)`);
      d(A, ra, -e * W, 0, W, H); d(B, rb, (1 - e) * W, 0, W, H); break;
    }
    case 'glitch': {
      const k = 1 - p; d(B, rb, 0, 0, W, H);
      const hs = n => { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); };
      for (let i = 0; i < 18; i++) {
        if (hs(i * 3.1 + tr.seed) < .55) continue;
        const sh = (hs(i + tr.seed) - .5) * .12 * k * W, y = i * H / 18, h = H / 18 + 1;
        const r = rb || [0, 0, B.videoWidth || B.width, B.videoHeight || B.height], sy = r[1] + r[3] * i / 18, sh2 = r[3] / 18;
        ctx.drawImage(B, r[0], sy, r[2], sh2, sh, y, W, h);
      }
      break;
    }
    case 'schnitt': d(B, rb, 0, 0, W, H); break;
    default: d(A, ra, 0, 0, W, H); ctx.globalAlpha = e; d(B, rb, 0, 0, W, H);
  }
  ctx.globalAlpha = 1; if ('filter' in ctx) ctx.filter = 'none';
}
const TYPE = { schnitt: 0, blende: 1, blitz: 2, zoom: 3, wisch: 4, whip: 5, glitch: 6 };

const VS = `
in vec2 p; out vec2 vUv;
void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
const FS = `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uA, uB;
uniform vec4 uRA, uRB;
uniform float uHasB, uP, uSeed, uFade;
uniform int uType;
uniform vec2 uRes;
uniform float uLog, uTemp, uCon, uSat, uLift, uMono, uK;
uniform vec3 uSh, uHi;
#ifdef LUT3D
uniform highp sampler3D uLut; uniform float uUseLut, uLutN;
#endif
vec3 tA(vec2 uv){ uv = clamp(uv, 0., 1.); return texture(uA, mix(uRA.xy, uRA.zw, uv)).rgb; }
vec3 tB(vec2 uv){ uv = clamp(uv, 0., 1.); return texture(uB, mix(uRB.xy, uRB.zw, uv)).rgb; }
float hash(float n){ return fract(sin(n) * 43758.5453); }
float dl(float x){ return x <= .14 ? (x - .0929) / 6.025 : (pow(10., 3.89616 * x - 2.27752) - .0108) / .9892; }
vec3 dlogm(vec3 c){
  vec3 l = vec3(dl(c.r), dl(c.g), dl(c.b));
  l = mat3(1.6746, -.0981, -.0410, -.5797, 1.3340, -.2430, -.0949, -.2359, 1.2840) * l;
  l = max(l, 0.) * .6;
  vec3 t = (l * (2.51 * l + .03)) / (l * (2.43 * l + .59) + .14);
  return pow(clamp(t, 0., 1.), vec3(1. / 2.2));
}
vec3 grade(vec3 c){
  vec3 g = c;
  if (uLog > .5) {
#ifdef LUT3D
    if (uUseLut > .5) g = texture(uLut, clamp(g, 0., 1.) * ((uLutN - 1.) / uLutN) + .5 / uLutN).rgb; else
#endif
    g = dlogm(g);
  }
  vec3 lin = pow(max(g, 0.), vec3(2.2));
  lin *= vec3(1. + .1 * uTemp, 1. + .01 * uTemp, 1. - .1 * uTemp);
  g = pow(lin, vec3(1. / 2.2));
  g = (g - .45) * uCon + .45;
  g += uLift * (1. - g);
  float L = dot(g, vec3(.2126, .7152, .0722));
  g = mix(vec3(L), g, uSat);
  g += uSh * (1. - smoothstep(0., .55, L)) + uHi * smoothstep(.45, 1., L);
  float m = clamp((L - .45) * 1.08 + .45, 0., 1.);
  g = mix(g, vec3(m), uMono);
  return mix(c, clamp(g, 0., 1.), uK);
}
vec3 zoomBlur(bool b, vec2 uv, float s, float amt){
  vec3 acc = vec3(0.); vec2 d = uv - .5;
  for (int i = 0; i < 8; i++) { float f = 1. - amt * float(i) / 8.; vec2 q = d / (s / f) + .5; acc += b ? tB(q) : tA(q); }
  return acc / 8.;
}
vec3 hBlur(bool b, vec2 uv, float amt){
  vec3 acc = vec3(0.);
  for (int i = 0; i < 12; i++) { vec2 q = uv + vec2((float(i) / 11. - .5) * amt, 0.); acc += b ? tB(q) : tA(q); }
  return acc / 12.;
}
void main(){
  vec2 uv = vUv; float p = clamp(uP, 0., 1.);
  vec3 c = tA(uv);
  if (uHasB > .5) {
    if (uType == 0) c = tB(uv);
    else if (uType == 1) { float e = smoothstep(0., 1., p); c = mix(tA(uv), tB(uv), e); }
    else if (uType == 2) { c = tB(uv); float w = pow(1. - p, 2.2) * .95; c = mix(c, vec3(1.), w); }
    else if (uType == 3) {
      if (p < .5) { float q = p / .5; c = zoomBlur(false, uv, 1. + .45 * q * q, .18 * q); }
      else { float q = (p - .5) / .5; c = zoomBlur(true, uv, 1.3 - .3 * (1. - pow(1. - q, 3.)), .18 * (1. - q)); }
    }
    else if (uType == 4) { float e = smoothstep(0., 1., p) * 1.5 - .25; float edge = (uv.x * .8 + uv.y * .2); float m = smoothstep(e - .08, e + .08, edge); c = mix(tB(uv), tA(uv), m); }
    else if (uType == 5) {
      float e = smoothstep(0., 1., p); float bl = sin(3.14159 * p) * .35;
      vec3 a = hBlur(false, uv + vec2(e, 0.), bl); vec3 b = hBlur(true, uv - vec2(1. - e, 0.), bl);
      c = (uv.x + e < 1.) ? a : b;
    }
    else if (uType == 6) {
      float k = 1. - p; float row = floor(uv.y * 18.); float sh = (hash(row + uSeed) - .5) * .12 * k * step(.55, hash(row * 3.1 + uSeed));
      vec2 q = uv + vec2(sh, 0.); float off = .012 * k;
      bool useA = p < .35 && hash(uSeed + 7.) > .5;
      vec3 r = useA ? vec3(tA(q + vec2(off, 0.)).r, tA(q).g, tA(q - vec2(off, 0.)).b) : vec3(tB(q + vec2(off, 0.)).r, tB(q).g, tB(q - vec2(off, 0.)).b);
      c = r;
    }
  }
  c = grade(c);
  c *= 1. - clamp(uFade, 0., 1.);
  o = vec4(c, 1.);
}`;

function src1(s) {
  // GLSL ES 3.00 → 1.00 für WebGL 1
  const r = s.replace(/\bin vec2 p;/, 'attribute vec2 p;').replace(/\bout vec2 vUv;/, 'varying vec2 vUv;').replace(/\bin vec2 vUv;/, 'varying vec2 vUv;')
    .replace(/out vec4 o;/, '').replace(/\bo = /g, 'gl_FragColor = ').replace(/\btexture\(/g, 'texture2D(');
  return r;
}

export function compositor(canvas) {
  if (typeof window !== 'undefined' && window.FCS_STUDIO_TEST && window.FCS_STUDIO_TEST.noGL) return { ok: false };
  const opt = { alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' };
  let gl = null, v2 = false;
  const T = typeof window !== 'undefined' && window.FCS_STUDIO_TEST || {};
  if (!T.gl1) { try { gl = canvas.getContext('webgl2', opt); v2 = !!gl; } catch (e) {} }
  if (!gl) { try { gl = canvas.getContext('webgl', opt) || canvas.getContext('experimental-webgl', opt); } catch (e) {} }
  if (!gl) return { ok: false };
  const sh = (type, s) => { const x = gl.createShader(type); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  let prog;
  try {
    const head = v2 ? '#version 300 es\n#define LUT3D 1\n' : '';
    const vs = v2 ? head + VS : src1(VS), fs = v2 ? head + FS : src1(FS);
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, 'p'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.info('Clip-Studio: WebGL-Shader nicht möglich', e && e.message); return { ok: false }; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uA', 'uB', 'uRA', 'uRB', 'uHasB', 'uP', 'uSeed', 'uFade', 'uType', 'uRes', 'uLog', 'uTemp', 'uCon', 'uSat', 'uLift', 'uMono', 'uK', 'uSh', 'uHi', 'uLut', 'uUseLut', 'uLutN'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
  const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); return t; };
  const tA = tex(), tB = tex();
  gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
  let lut = null, lutN = 0;
  if (v2 && U.uLut) gl.uniform1i(U.uLut, 2);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  try { gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL); } catch (e) {}
  let lost = false;
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });

  const upload = (t, unit, s) => {
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
  };
  const api = {
    ok: true, v2, canvas,
    get lost() { return lost || gl.isContextLost(); },
    size(w, h) { w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } gl.viewport(0, 0, w, h); },
    hasLut: () => !!lut,
    /* .cube-Datei (3D-LUT) laden, zum Beispiel die offizielle DJI-LUT. Nur WebGL 2. */
    lut(text) {
      if (!v2) return false;
      const lines = String(text).split(/\r?\n/); let n = 0; const vals = [];
      for (const l of lines) { const s = l.trim(); if (!s || s[0] === '#') continue; const m = s.match(/^LUT_3D_SIZE\s+(\d+)/i); if (m) { n = +m[1]; continue; } if (/^[A-Z_]/i.test(s)) continue; const p = s.split(/\s+/).map(Number); if (p.length >= 3 && p.every(isFinite)) vals.push(p[0], p[1], p[2]); }
      if (!n || vals.length < n * n * n * 3) return false;
      const data = new Uint8Array(n * n * n * 4);
      for (let i = 0; i < n * n * n; i++) { data[i * 4] = Math.round(Math.max(0, Math.min(1, vals[i * 3])) * 255); data[i * 4 + 1] = Math.round(Math.max(0, Math.min(1, vals[i * 3 + 1])) * 255); data[i * 4 + 2] = Math.round(Math.max(0, Math.min(1, vals[i * 3 + 2])) * 255); data[i * 4 + 3] = 255; }
      lut = gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, lut);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'TEXTURE_WRAP_R'].forEach(w => gl.texParameteri(gl.TEXTURE_3D, gl[w], gl.CLAMP_TO_EDGE));
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, n, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      lutN = n; return true;
    },
    /* A, B: Quellen; ra/rb: Ausschnitt [u0,v0,u1,v1] (0..1); tr: {type, p, seed}; look: {id, k}; fade: 0..1 */
    render({ A, B, ra, rb, tr, look, fade }) {
      if (api.lost) return false;
      // Testschalter: simuliert ein Handy, dessen WebGL nur eine leere lila Fläche liefert
      if (window.FCS_STUDIO_TEST && window.FCS_STUDIO_TEST.flatGL) { gl.clearColor(.184, .051, .2, 1); gl.clear(gl.COLOR_BUFFER_BIT); return true; }
      if (A) upload(tA, 0, A);
      const hasB = !!(B && tr && tr.type && tr.type !== 'schnitt');
      if (hasB) upload(tB, 1, B);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tA);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, hasB ? tB : tA);
      if (lut) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_3D, lut); }
      const r = ra || [0, 0, 1, 1], rr = rb || [0, 0, 1, 1];
      gl.uniform4f(U.uRA, r[0], r[1], r[2], r[3]); gl.uniform4f(U.uRB, rr[0], rr[1], rr[2], rr[3]);
      gl.uniform1f(U.uHasB, hasB ? 1 : 0); gl.uniform1i(U.uType, hasB ? TYPE[tr.type] || 0 : 0);
      gl.uniform1f(U.uP, tr ? tr.p : 0); gl.uniform1f(U.uSeed, tr && tr.seed || 0); gl.uniform1f(U.uFade, fade || 0);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      const L = LOOKS[look && look.id] || LOOKS.natur, k = look && look.id !== 'natur' ? (look.k == null ? 1 : look.k) : 0;
      gl.uniform1f(U.uLog, L.log ? 1 : 0); gl.uniform1f(U.uTemp, L.temp || 0); gl.uniform1f(U.uCon, L.con || 1); gl.uniform1f(U.uSat, L.sat == null ? 1 : L.sat);
      gl.uniform1f(U.uLift, L.lift || 0); gl.uniform1f(U.uMono, L.mono || 0); gl.uniform1f(U.uK, k);
      gl.uniform3fv(U.uSh, L.sh || [0, 0, 0]); gl.uniform3fv(U.uHi, L.hi || [0, 0, 0]);
      if (U.uUseLut) { gl.uniform1f(U.uUseLut, lut && L.log ? 1 : 0); gl.uniform1f(U.uLutN, lutN || 2); }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    },
    /* Helligkeit eines kleinen Rasters lesen (Selbsttest gegen schwarze oder einfarbige Bilder) */
    luma() {
      const w = canvas.width, h = canvas.height, px = new Uint8Array(4);
      let mx = 0, mn = 255, sum = 0, sq = 0, n = 0;
      for (let y = 1; y < 6; y++) for (let x = 1; x < 6; x++) {
        gl.readPixels(Math.floor(w * x / 6), Math.floor(h * y / 6), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const l = .2126 * px[0] + .7152 * px[1] + .0722 * px[2]; mx = Math.max(mx, l); mn = Math.min(mn, l); sum += l; sq += l * l; n++;
      }
      const m = sum / n;
      return { max: mx, min: mn, mean: m, std: Math.sqrt(Math.max(0, sq / n - m * m)), range: mx - mn };
    },
    destroy() { try { const e = gl.getExtension('WEBGL_lose_context'); if (e) e.loseContext(); } catch (e) {} }
  };
  return api;
}
