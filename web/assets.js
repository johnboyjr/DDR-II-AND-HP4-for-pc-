// DDR II's own graphics and sounds, pulled from the game files through the local server.
// Everything is optional: if a piece can't be loaded, the game falls back to drawn shapes.
'use strict';

// A: everything loaded from the disc - A.img (pictures), A.tpl (texture files), A.sfx (sounds); A.ready once it's in
const A = { ready: false, tpl: {}, img: {}, sfx: {} };

(function () {
  const tplCache = new Map();
  async function tpl(f, p = '') {
    const key = f + ':' + p;
    if (!tplCache.has(key)) {
      tplCache.set(key, (async () => {
        const r = await fetch(`/api/res?f=${f}&p=${encodeURIComponent(p)}`);
        if (!r.ok) throw new Error('missing ' + key);
        return DDR.parseTPL(await r.arrayBuffer());
      })());
    }
    return tplCache.get(key);
  }
  A.tplOf = tpl;
  const HP4_NOW = () => typeof HP4 !== 'undefined' && HP4;
  async function img(f, p, i) {
    try { const t = await tpl(f, p); return t[i] ? t[i].canvas : null; } catch (e) { return null; }
  }
  async function imgs(f, p, idxs) {
    try { const t = await tpl(f, p); return idxs.map(i => t[i] ? t[i].canvas : null); } catch (e) { return idxs.map(() => null); }
  }
  function crop(c, x, y, w, h) {
    if (!c) return null;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    o.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
    return o;
  }
  A.crop = crop;
  // cut away the empty (transparent) border around a picture, e.g. a label's lettering
  function trim(c) {
    if (!c) return c;
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) {
      if (d[(y * c.width + k) * 4 + 3] > 24) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? c : crop(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
  A.trim = trim;
  A.loadTpl = tpl;

  // ------------------------------------------------------------- arrows
  // SSQ_CMN: 7 frames of grey arrows (C8, 512x320 = 8x5 cells of 64), a white mask/flash sheet,
  // freeze arrow heads + bodies. The game colours the grey arrows when drawing them.
  async function arrows() {
    let t;
    try { t = await tpl('ssq', '/0/0'); } catch (e) { return; }
    // (HP4's SSQ_CMN has one more sheet after the 7 arrow frames - 256 x 64 - so its mask, freeze and
    // lesson sheets are one later: 8, 9, 14 / 15; the rest are its Hyper Move markers)
    const k = typeof HP4 !== 'undefined' && HP4 ? 1 : 0;
    if (k) A.hyper = t.map(x => x && x.canvas);              // (HP4's sheets 16-52: the CHOREOGRAPH markers)
    if (!k && t[14]) A.barMark = t[14].canvas;
    if (!k && t[13]) A.barLine = t[13].canvas;        // (DDR II: GUIDELINE's measure line - fifo_ddr2_play2.dff)        // (DDR II: the TRAINING MENU's bar marker - fifo_ddr2_train.dff)
    const mask = t[7 + k] && t[7 + k].canvas;
    if (!mask) return;
    const frames = [];
    for (let f = 0; f < 7; f++) {
      if (!t[f]) continue;
      const dirs = [];
      for (let d = 0; d < 4; d++) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d');
        x.drawImage(t[f].canvas, d * 64, 0, 64, 64, 0, 0, 64, 64);     // grey shading
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(mask, d * 64, 0, 64, 64, 0, 0, 64, 64);            // shape from the mask
        dirs.push(c);
      }
      frames.push(dirs);
    }
    A.arrowGrey = frames;
    A.arrowMask = [0, 1, 2, 3].map(d => crop(mask, d * 64, 0, 64, 64));
    A.burst = [0, 1, 2, 3].map(d => crop(mask, d * 64, 64, 64, 64));
    const fz = (sheet, col) => sheet ? { head: crop(sheet.canvas, col * 64, 0, 64, 64), body: crop(sheet.canvas, col * 64, 64, 64, sheet.h - 64) } : null;
    // the lesson arrows (sheet 11 red = right foot, 12 blue = left foot, 256 x 448): row 0 the four arrows,
    // then each freeze arrow's head (64-128) and body down to its tail
    if (t[11 + 3 * k] && t[12 + 3 * k]) {
      A.lessonNote = [t[11 + 3 * k], t[12 + 3 * k]].map(sh => [0, 1, 2, 3].map(d => crop(sh.canvas, d * 64, 0, 64, 64)));
      A.lessonFreeze = [t[11 + 3 * k], t[12 + 3 * k]].map(sh => [0, 1, 2, 3].map(d => ({ head: crop(sh.canvas, d * 64, 64, 64, 64), body: crop(sh.canvas, d * 64, 128, 64, sh.h - 128) })));
    }
    if (t[8 + k]) {
      A.freezeOn = [0, 1, 2, 3].map(d => fz(t[8 + k], d));
      A.freezeOff = [0, 1, 2, 3].map(d => fz(t[8 + k], 4 + d));
      // the body's coloured fill, recoloured the way the real game shows it (measured from the
      // game): khaki yellow, green just under the head, bright yellow while it's held
      const fill = (src, rgb) => {
        const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        const x = c.getContext('2d'); x.drawImage(src, 0, 0);
        const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 8 || Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 40) continue;   // grey chevrons / outline stay
          const k = 1;                                                          // one flat colour (no bands)
          d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k); d[i + 2] = Math.min(255, rgb[2] * k);
        }
        x.putImageData(im, 0, 0);
        return c;
      };
      for (const f of A.freezeOn) {
        f.bodyY = fill(f.body, [193, 195, 84]); f.bodyG = fill(f.body, [118, 197, 78]); f.bodyH = fill(f.body, [236, 240, 72]);
        f.headH = fill(f.head, [246, 246, 60]);        // the head turns yellow while it's held
      }
    }
    A.tintCache = new Map();
  }
  // tinted arrow: grey arrow x colour, keeping the white highlights
  A.arrow = function (color, frame, dir) {
    if (!A.arrowGrey) return null;
    const key = color + '|' + frame + '|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      const src = A.arrowGrey[frame % A.arrowGrey.length][dir];
      c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, 64, 64);
      x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.25; x.drawImage(src, 0, 0); x.globalAlpha = 1;
      x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
      A.tintCache.set(key, c);
    }
    return c;
  };

  // ---- The game's own arrow palettes (worked out from Dolphin texture dumps of the real game).
  // The arrow sheets in SSQ_CMN are C8 (palette) textures. Each pixel's low 4 bits pick a palette
  // entry: 0 = clear, 1 = outline, 2-4 = the inner bar / chevron, 5-13 = the body, dark to light.
  // The game fills those entries per note colour while playing; here is what it puts there.
  A.NOTE_RAMPS = [      // body ramps (entries 5..13) for the four note colours, at the start of a song
    [0xce8429, 0xde9429, 0xe7b539, 0xf7de4a, 0xf7f75a, 0xffff73, 0xffff8c, 0xefffad, 0xefffce],
    [0x9c315a, 0xbd3952, 0xd64a52, 0xf75a4a, 0xff7b42, 0xff8c39, 0xffb542, 0xffd642, 0xfff742],
    [0x4242b5, 0x5a39bd, 0x6b39c6, 0x8c31c6, 0xad39bd, 0xc639b5, 0xef42b5, 0xff4aa5, 0xff5a8c],
    [0x299cb5, 0x299cd6, 0x319cef, 0x3194ff, 0x428cff, 0x4a84ff, 0x637bff, 0x736bff, 0x9c63ff],
  ];
  // the step zone: light outline, a see-through middle, a dark-grey band (and the lit version)
  const greyRamp = (a, step) => [...Array(9)].map((_, i) => { const v = a + step * i; return (v << 16) | (v << 8) | v; });
  A.ZONE = { dim: { outline: 0xe7e7e7, inner: [0x11, 0x11, 0x11, 36], body: greyRamp(0x4a, 8) },
             lit: { outline: 0xe7e7e7, inner: [0x11, 0x11, 0x11, 36], body: greyRamp(0xad, 8) } };
  A.c8 = null;          // [frame] -> Uint8Array(512*320) of palette indices
  async function loadC8() {
    try {
      const r = await fetch('/api/res?f=ssq&p=' + encodeURIComponent('/0/0'));
      if (!r.ok) return;
      const dv = new DataView(await r.arrayBuffer());
      const n = dv.getUint32(4), t = dv.getUint32(8), out = [];
      for (let i = 0; i < Math.min(7, n); i++) {
        const io = dv.getUint32(t + 8 * i), h = dv.getUint16(io), w = dv.getUint16(io + 2), f = dv.getUint32(io + 4), d = dv.getUint32(io + 8);
        if (f !== 9) return;            // not C8: keep the old way
        const px = new Uint8Array(w * h);
        let o = d;
        for (let by = 0; by < h; by += 4) for (let bx = 0; bx < w; bx += 8)
          for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++, o++) px[(by + y) * w + bx + x] = dv.getUint8(o);
        out.push({ w, h, px });
      }
      A.c8 = out;
    } catch (e) { A.c8 = null; }
  }
  A.loadC8 = loadC8;
  // HP4's thrust / swing / pointer sheet (SSQ_CMN image 7, C8 with a 256-entry RGB5A3 palette in 16-entry
  // banks). The game rewrites this palette every frame (0x800a9524 -> 0x8009c64c -> fill 0x8009fca4), from a
  // saved copy of the file's: entries 3..31 = the 29 colours at 0xa3.. turned by phase p1, 0x23..0x3f = 0xc3..
  // by p1, 0x43..0x5f = 0xe3.. by p2 (p1 = 28 - (frac(s) * 29 | 0) with s the song time in seconds - chart
  // +0x38c2dc << 10 / rate +0x10 - and p2 the same at twice the speed); with the flag ([0x1576]) set those
  // entries are 0xe739 instead. Then entry 0 of banks 0, 2, 4, 6, 7, 9 is cleared (see-through) and entries 1 / 2
  // of banks 0, 2, 4, 6 (0x71 / 0x72 also into 0x91 / 0x92) come back from the saved copy.
  let S7 = null;
  async function loadSheet7() {
    try {
      const r = await fetch('/api/res?f=ssq&p=' + encodeURIComponent('/0/0'));
      if (!r.ok) return;
      const dv = new DataView(await r.arrayBuffer());
      const t = dv.getUint32(8), io = dv.getUint32(t + 56), po = dv.getUint32(t + 60);
      const h = dv.getUint16(io), w = dv.getUint16(io + 2), f = dv.getUint32(io + 4), d = dv.getUint32(io + 8);
      if (f !== 9 || !po) return;
      const n = dv.getUint16(po), pf = dv.getUint32(po + 4), pd = dv.getUint32(po + 8);
      if (pf !== 2 || n < 256) return;
      const px = new Uint8Array(w * h);
      let o = d;
      for (let by = 0; by < h; by += 4) for (let bx = 0; bx < w; bx += 8)
        for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++, o++) px[(by + y) * w + bx + x] = dv.getUint8(o);
      const src = new Uint16Array(256);
      for (let i = 0; i < 256; i++) src[i] = dv.getUint16(pd + i * 2);
      S7 = { w, h, px, src, cache: new Map() };
    } catch (e) { S7 = null; }
  }
  A.loadSheet7 = loadSheet7;
  const rgba5a3 = v => v & 0x8000 ? [(v >> 10 & 31) * 255 / 31, (v >> 5 & 31) * 255 / 31, (v & 31) * 255 / 31, 255]
    : [(v >> 8 & 15) * 17, (v >> 4 & 15) * 17, (v & 15) * 17, (v >> 12 & 7) * 255 / 7];
  const phase = (sec, sh) => {
    const x = Math.trunc(sec * (1 << sh)), r = x % 1024, i = Math.trunc(r * 29 / 1024);
    return (((28 - i) % 29) + 29) % 29;
  };
  A.sheet7 = function (sec, flat) {
    if (!S7) return null;
    const p1 = phase(sec, 10), p2 = phase(sec, 11), key = flat ? 'f' : p1 + ',' + p2;
    let c = S7.cache.get(key);
    if (c) return c;
    const s = S7.src, pal = Array.from(s);
    for (let j = 0; j < 29; j++) {
      pal[3 + j] = flat ? 0xe739 : s[0xa3 + (p1 + j) % 29];
      pal[0x23 + j] = flat ? 0xe739 : s[0xc3 + (p1 + j) % 29];
      pal[0x43 + j] = flat ? 0xe739 : s[0xe3 + (p2 + j) % 29];
    }
    for (const b of [0, 0x20, 0x40, 0x60, 0x70, 0x90]) pal[b] = 0;
    for (const b of [0, 0x20, 0x40, 0x60]) { pal[b + 1] = s[b + 1]; pal[b + 2] = s[b + 2]; }
    pal[0x71] = pal[0x91] = s[0x71]; pal[0x72] = pal[0x92] = s[0x72];
    const lut = pal.map(rgba5a3);
    c = document.createElement('canvas'); c.width = S7.w; c.height = S7.h;
    const x = c.getContext('2d'), im = x.createImageData(S7.w, S7.h), d = im.data;
    for (let i = 0; i < S7.px.length; i++) { const e = lut[S7.px[i]]; d[i * 4] = e[0]; d[i * 4 + 1] = e[1]; d[i * 4 + 2] = e[2]; d[i * 4 + 3] = e[3]; }
    x.putImageData(im, 0, 0);
    S7.cache.set(key, c);
    return c;
  };
  // one 64x64 arrow from sheet `frame`, direction `dir`, cell row `row` (0 = notes, 2 = step zone),
  // coloured with pal = { outline, inner: [r,g,b,a] or 0xRRGGBB, body: [9 colours] }
  function c8Arrow(frame, dir, row, pal) {
    const sh = A.c8[frame % A.c8.length], c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), im = x.createImageData(64, 64), d = im.data;
    const rgb = v => [v >> 16 & 255, v >> 8 & 255, v & 255, 255];
    const lut = [[0, 0, 0, 0], rgb(pal.outline)];
    const inner = Array.isArray(pal.inner) ? pal.inner : rgb(pal.inner);
    lut.push(inner, inner, inner);
    for (let i = 0; i < 9; i++) lut.push(rgb(pal.body[i]));
    lut.push([0, 0, 0, 0], [0, 0, 0, 0]);
    for (let y = 0; y < 64; y++) for (let k = 0; k < 64; k++) {
      const e = lut[sh.px[(row * 64 + y) * sh.w + dir * 64 + k] & 15], o = (y * 64 + k) * 4;
      d[o] = e[0]; d[o + 1] = e[1]; d[o + 2] = e[2]; d[o + 3] = e[3];
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  // a note in colour group g (0-3), its hues turned by `shift` degrees (the rainbow drift)
  const rotHue = (v, deg) => {
    if (!deg) return v;
    let r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    let h = 0, s = 0;
    if (dd) { s = dd / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
    const [R, G, B] = hslRgb(h + deg, s, l);
    return (Math.round(R) << 16) | (Math.round(G) << 8) | Math.round(B);
  };
  // flash: the inner bar is white for a moment at the start of each beat, dark grey the rest of it
  A.noteC8 = function (group, shift, frame, dir, flash) {
    if (!A.c8) return null;
    shift = (Math.round(shift / 15) * 15) % 360;   // 24 steps round the wheel keeps the cache small
    const key = 'n' + group + '|' + shift + '|' + frame + '|' + dir + (flash ? 'f' : '');
    let c = A.tintCache.get(key);
    if (!c) {
      c = c8Arrow(frame, dir, 0, { outline: 0x080808, inner: flash ? 0xffffff : 0x525252, body: A.NOTE_RAMPS[group].map(v => rotHue(v, shift)) });
      A.tintCache.set(key, c);
      if (A.tintCache.size > 3200) A.tintCache.delete(A.tintCache.keys().next().value);
    }
    return c;
  };
  A.zoneC8 = function (dir, lit) {
    if (!A.c8) return null;
    const key = 'z' + dir + (lit ? 'L' : 'D');
    let c = A.tintCache.get(key);
    if (!c) { c = c8Arrow(0, dir, 2, lit ? A.ZONE.lit : A.ZONE.dim); A.tintCache.set(key, c); }
    return c;
  };

  // The grey arrows are a shading map: the game colours them through a palette. This does the same
  // per pixel: the light rim and inner chevron stay near-white, the body takes the colour, running
  // from `top` to `bottom` down the arrow (that's how the rainbow arrows look on the Wii).
  const hex = c => { const m = /^#?(..)(..)(..)$/.exec(c); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [255, 255, 255]; };
  const hslRgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360 / 360;
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  };
  A.hsl = hslRgb; A.hex = hex;
  function remap(src, fn) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const im = x.getImageData(0, 0, 64, 64), d = im.data, a0 = new Uint8Array(64 * 64);
    const l0 = new Uint8Array(64 * 64);
    for (let k = 0; k < a0.length; k++) { a0[k] = d[k * 4 + 3]; l0[k] = d[k * 4]; }
    const solid = (px, py) => px >= 0 && py >= 0 && px < 64 && py < 64 && a0[py * 64 + px] > 24;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = i >> 2, px = k & 63, py = k >> 6;
      let edge = 0;                         // 1..4 px from the outside (the arrow's outline), else 0
      for (let r = 1; r <= 4 && !edge; r++) if (!solid(px - r, py) || !solid(px + r, py) || !solid(px, py - r) || !solid(px, py + r)) edge = r;
      // the darkest neighbour (to find the outline of the inner shape)
      let nb = 255;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(px + dx, py + dy)) nb = Math.min(nb, l0[(py + dy) * 64 + px + dx]);
      const out = fn(d[i] / 255, py, edge, nb / 255);
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = Math.round(d[i + 3] * out[3]);
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  // top / bottom: [r, g, b]
  A.arrowCol = function (top, bottom, frame, dir) {
    if (!A.arrowGrey) return null;
    const key = 'c' + top.map(Math.round) + '|' + bottom.map(Math.round) + '|' + frame + '|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      c = remap(A.arrowGrey[frame % A.arrowGrey.length][dir], (L, y, edge) => {
        const k = Math.min(1, Math.max(0, (y - 6) / 52)), col = top.map((v, i) => v + (bottom[i] - v) * k);
        if (edge && edge <= 2 && L >= 0.8) return col.map(v => v * 0.28).concat(1);             // thin dark outline
        if (L >= 0.84) return [255, 255, 255, 1];                                  // shaft: white
        if (L >= 0.68) return col.map(v => v + (255 - v) * 0.78).concat(1);       // chevron / shaft: nearly white
        const b = 0.62 + 0.55 * (L - 0.29) / 0.39;                                 // body: the colour, lighter higher up the grey
        return col.map(v => Math.min(255, v * b)).concat(1);
      });
      A.tintCache.set(key, c);
      if (A.tintCache.size > 1500) A.tintCache.delete(A.tintCache.keys().next().value);
    }
    return c;
  };
  // the step zone: see-through arrows with a light rim, like the game's
  A.receptor = function (dir) {
    if (!A.arrowGrey) return null;
    const key = 'r|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      // like the game's: a thin white outline, a dark-grey band, a see-through middle, and the inner
      // bar drawn as a grey outline only
      c = remap(A.arrowGrey[0][dir], (L, y, edge, nb) => {
        const lift = 1.15 - 0.3 * y / 64;
        if (L >= 0.84 && edge) return [232, 235, 240, 1];                        // outline
        if (L < 0.6) { const v = 70 + 70 * L; return [v * lift, (v + 4) * lift, (v + 14) * lift, 1]; }   // the band
        if (L >= 0.84 && nb < 0.84) return [96 * lift, 100 * lift, 110 * lift, 1];   // inner bar outline
        if (L < 0.84 && nb < 0.6) return [96 * lift, 100 * lift, 110 * lift, 1];    // inner edge of the band
        return [10, 20, 60, 0.06];                                                   // see-through
      });
      A.tintCache.set(key, c);
    }
    return c;
  };

  // ------------------------------------------------------------- HUD + judgments
  async function hud() {
    const gui = await imgs('gui', '', [28, 54, 12, 13, 14, 29, 15, 0, 22]);
    const atlas = gui[0];
    if (atlas) {
      A.judge = {
        MARVELOUS: crop(atlas, 22, 282, 366, 53), PERFECT: crop(atlas, 96, 57, 319, 53),
        GREAT: crop(atlas, 26, 113, 229, 54), GOOD: crop(atlas, 308, 113, 180, 54),
        BOO: crop(atlas, 52, 170, 117, 53), ALMOST: crop(atlas, 243, 170, 218, 53),
        COMBO: crop(atlas, 20, 225, 195, 54), OK: crop(atlas, 228, 225, 116, 54), NG: crop(atlas, 356, 225, 118, 54),
      };
      A.comboDigits = [...Array(10).keys()].map(i => crop(atlas, i * 56, 0, 56, 53));
    }
    // DDR II's own judgment pictures: comAF_US.bin /11 (FIFO fifo_ddr2_play2.dff - MISS is texture 0, drawn
    // static at 0.6 scale, centred on the lanes 1.6 lane widths under the step zone). The others follow the
    // file's order (1 Almost, 2 GOOD, 3 GREAT!, 4 PERFECT!!, 5 MARVELOUS!!, 6 O.K., 7 NOT QUITE)
    if (!HP4_NOW()) {
      const jt = await imgs('af', '/11', [0, 1, 2, 3, 4, 5, 6, 7, 23, 24, 25, 26, 27]);
      if (jt[0]) A.judgeD2 = { BOO: jt[0], ALMOST: jt[1], GOOD: jt[2], GREAT: jt[3], PERFECT: jt[4], MARVELOUS: jt[5], OK: jt[6], NG: jt[7] };
      if (jt[12]) A.judgeLesson = jt.slice(8, 13);     // (the lessons' Awesome!! .. Try Harder!!)
      // combo sets: a 560 x 56 strip of 0-9 (56 each) + the word, per colour (fifo_ddr2_hits.dff: green
      // 17 / 18 drawn in the demo). By colour: 13/14 white, 15/16 blue, 17/18 green, 19/20 yellow, 21/22 white-blue
      const cs = await imgs('af', '/11', [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
      const set = (s, w) => s && w ? { digits: [...Array(10).keys()].map(i => crop(s, i * 56, 0, 56, 56)), word: w } : null;
      if (cs[0]) A.comboD2 = { white: set(cs[0], cs[1]), blue: set(cs[2], cs[3]), green: set(cs[4], cs[5]), yellow: set(cs[6], cs[7]), whiteBlue: set(cs[8], cs[9]) };
    }
    A.img.gaugeFrame = gui[1];
    A.img.diffSmall = { 4: gui[2], 1: gui[3], 2: gui[4] };
    A.img.failed = gui[5];
    A.img.danger = gui[8];
    const bn = ['ready', 'hereWeGo', 'fullComboG', 'fullComboY', 'fullComboB', 'finishG', 'finishY', 'finishB', 'tryAgain', null, 'finished', 'fullComboP', 'finishP'];   // (12/13: the dark blue pair - a GOOD full combo, Wii 2026-11-18)
    await Promise.all(bn.map(async (k, i) => { if (k) A.img[k] = await img('cmn', '/0/0/' + (i + 1), 0); }));
    // (DDR II's full-combo ending - fifo_ddr2_fullcombo.dff: the flare /0/0/10, the white glow over the lanes /7/1/0/0
    // (64 x 480) and the swirl /7/4/0/1)
    A.img.endFlare = await img('cmn', '/0/0/10', 0); A.img.stepFoot = await img('cmn', '/9', 1);   // (/9/1: the blue foot shown on the step zone as a song starts)
     A.img.fcGlow = await img('cmn', '/7/1/0/0', 0); A.img.fcSwirl = await img('cmn', '/7/4/0/1', 0);
    A.img.comboBreak = await img('cmn', '/1/0/0', 0);
    // footprints (where to stand): DDR II's SSQ_CMN /9 pictures 1 / 2 (blue / red). HP4's /9 holds other things
    // there (0 / 1 the Wii Remote and Nunchuk plates, 2 'The A or B Button is being pressed.', 4 AUTO-PLAY) and
    // one footprint, picture 3 - used for every player, untinted (Dolphin 2026-11-17: 2 players on CLASSIC, both
    // players' footprints the same blue)
    if (HP4_NOW()) { const f = await img('cmn', '/9', 3); A.img.feet = [f, f]; }
    // HP4 3 / 4 players: the see-through board behind each field and its lane lines (GAME_CMN_US.bin /0/8/5:
    // picture 0 back_board_whit, 32 x 64 IA8, white with its bottom fading out; picture 1 back_board_line, 16 x 16)
    if (HP4_NOW()) A.img.multiBoard = [await img('cmn', '/7/5/0/0', 0), await img('cmn', '/7/5/0/1', 0)];
    else A.img.feet = [await img('cmn', '/9', 1), await img('cmn', '/9', 2)];
    // DDR II: the board behind the arrows (/7/1: back_board_whit, back_board_line) and its scrolling light
    // (/7/4: back_board_grd0 the mask, effect_line01) - drawDdr2Board
    if (!HP4_NOW()) {
      A.img.board = [await img('cmn', '/7/1/0/0', 0), await img('cmn', '/7/1/0/1', 0)];
      A.img.boardFx = [await img('cmn', '/7/4/0/0', 0), await img('cmn', '/7/4/0/1', 0)];
    }
    A.digits = await imgs('af', '/0/0/0', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bgs = await imgs('bg', '', [0, 1]);
    A.img.playBg = bgs[0];
    A.img.stageBg = await img('pvbg', '', 0);       // the blue backdrop behind the arrows
  }

  // ------------------------------------------------------------- menus
  async function menus() {
    const res = await imgs('res', '/0/0/0/1', [0, 1]);
    A.img.resPanel = res[0];
    A.img.resTitle = await img('res', '/0/0/0/3', 0);
    A.img.jacketFrame = await img('res', '/0/0/0/0', 0);
    A.img.grades = {};
    const g1 = await imgs('res', '/0/3/0/0', [0, 1, 2, 3, 4]), g2 = await imgs('res', '/0/3/0/1', [0, 1]);
    Object.assign(A.img.grades, { A: g1[0], B: g1[1], C: g1[2], D: g1[3], E: g1[4], AAA: g2[0], AA: g2[1] });
    A.img.resFull = await imgs('res', '/0/4/0/0', [0, 1, 2, 3]);
    A.img.newRecord = await img('res', '/0/4/0/1', 0);
    A.img.diffLabel = await imgs('res', '/0/2/0/1', [0, 1, 2, 3, 4]);
    A.img.purple = await img('res', '/2', 0);
    A.img.lights = await img('sel', '/15/0/7', 0);
    A.img.rings = await img('sel', '/15/0/3', 0);
    A.img.ornament = await img('sel', '/15/0/1', 0);
    A.img.konami = await img('sel', '/12/0', 0);
    A.img.levelDigits = await imgs('mus', '/0/0/0/0', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);   // 1..10
    A.img.bpmLabel = await img('mus', '/0/0/0/1', 0);
    A.img.lenLabel = await img('mus', '/0/0/0/12', 0);
    A.img.selTitle = await img('mus', '/0/0/0/2', 0);
    A.img.diffBars = {};
    for (const [d, p] of [[4, 11], [1, 12], [2, 13], [3, 14], [6, 15]]) A.img.diffBars[d] = await imgs('mus', `/0/1/0/${p}`, [0, 1]);
    A.img.radarPanel = await imgs('mus', '/0/1/0/21', [0, 1, 2]);
    A.img.shortTag = await img('mus', '/0/1/0/23', 0);
    A.img.fullTag = await img('mus', '/0/1/0/24', 0);
    A.img.pointer = await img('mus', '/0/1/0/25', 0);
    A.img.bluePanel = await img('mus', '/0/12/0/0', 0);
    // the SELECT SONG LENGTH / SELECT DIFFICULTY pop-ups (selMusic groups 9-13)
    A.pop = {
      panel: await img('mus', '/0/12/0/0', 0), radar: await img('mus', '/0/13/0/7', 0),
      lenHead: await img('mus', '/0/12/0/1', 0), diffHead: await imgs('mus', '/0/13/0/1', [0, 1, 2]),
      cards: await imgs('mus', '/0/11/0/0', [0, 1]), cardOn: await img('mus', '/0/11/0/1', 0),
      shortTxt: await img('mus', '/0/11/0/2', 0), fullTxt: await img('mus', '/0/11/0/3', 0), box: await img('mus', '/0/11/0/4', 0), timeLbl: await img('mus', '/0/11/0/6', 0),
      diff: await imgs('mus', '/0/10/0/10', [0, 1, 2, 3, 4]), ok: await img('mus', '/0/10/0/11', 0),
      badge: await imgs('mus', '/0/10/0/0', [0]).then(async b => [b[0], (await imgs('mus', '/0/10/0/1', [0]))[0]]),
      confirm: await img('mus', '/0/9/0/0', 0), star: await img('mus', '/0/3/0/0', 0),
      curBack: await img('mus', '/0/3/0/3', 0), curFrame: await img('mus', '/0/3/0/1', 0), rainbow: await img('mus', '/0/13/0/12', 0),
    };
    A.img.radarNames = {};
    for (const [k, p] of [['AIR', 2], ['CHAOS', 3], ['FREEZE', 4], ['STREAM', 5], ['VOLTAGE', 6]]) A.img.radarNames[k] = await img('mus', `/0/13/0/${p}`, 0);
    A.img.optHeader = await img('af', '/6/0', 3);
    // the options screen (select_bin group 10): bars, buttons, CONFIRM, arrows and the option/row labels
    const sel = (p, i) => img('sel', p, i);
    A.opt = {      // (title picture 1 = WORKOUT MENU)
      header: await sel('/10/0/0/0', 0), title: trim(await sel('/10/0/0/1', 0)), wkTitle: trim(await sel('/10/0/0/1', 1)), tab: await sel('/10/0/0/2', 0), tabWin: await sel('/10/1/0/1', 0),     // (opt_wind04: the open option's tab)
      btn: await sel('/10/4/0/1', 0), btnOn: await sel('/10/4/0/2', 0),
      rowBar: await sel('/10/5/0/0', 0), valBar: await sel('/10/5/0/1', 0), rowSel: await sel('/10/5/0/3', 0),
      confirm: trim(await sel('/10/6/0/0', 0)), cyanBar: await sel('/10/6/0/1', 0), orangeBar: await sel('/10/6/0/2', 0),
      arrow: await sel('/10/7/0/1', 0),
      // ARROW ASSIST CONFIRM CREDIT CUT EVALUATION FREEZE-ARROW GAME-PLAY GRAPHIC GUIDELINE INDIVIDUAL-OPTIONS
      // JUMP ROTATE SAVE SCROLL SPEED USER-SUPPORT DANCE
      // (HP4's word lists are longer - GIMMICK, MY BACKUP DANCERS, PUNCH ACTION, SET DANCER ... - so its pictures
      // are picked by DDR II's order: the same words at other places)
      big: (await imgs('sel', '/10/8', HP4_NOW() ? [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20] : [...Array(18).keys()])).map(trim),
      // AUTO-SAVE COMBO-PERFORMANCE CONFIRM CUT FULL-COMBO-APPEAL GAME-LEVEL GAME-OVER GOAL HANDCLAP JUMP MARVELOUS
      // MENU METRONOME MOVIES MUSIC-SPEED PARTY PLAYER1-4 SAVE SONG TIMING TIMING-EVALUATION VOICE COMBO ...
      small: (await imgs('sel', '/10/9', HP4_NOW() ? [1, 2, 3, 4, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 26, 29, 31, 32, 33, 34, 35, 36, 37, 999]
        : [...Array(30).keys()])).map(trim),
    };
    // DDR II's keypad (select_bin group 5: NAME / WEIGHT / PASSWORD / HEIGHT INPUT) - traced from
    // fifo_ddr2_wkkey.dff / fifo_ddr2_wkheight.dff: keys 0-45 = 1-9 0, A-Z, the symbols row
    if (!HP4_NOW()) A.kpad = {
      head: await sel('/5/0/0/3', 0), title: await imgs('sel', '/5/0/0/1', [0, 1, 2, 3]), label: await imgs('sel', '/5/0/0/2', [0, 1, 2, 3]),
      field: await sel('/5/0/0/4', 0), tab: await imgs('sel', '/5/0/0/5', [0, 1, 2, 3]), word: await imgs('sel', '/5/0/0/6', [0, 1, 2, 3]),
      bar: await sel('/5/0/0/7', 0), unit: await imgs('sel', '/5/0/0/8', [0, 1, 2, 3]), ft: await sel('/5/0/0/9', 0), board: await sel('/5/0/0/10', 0),
      keys: await imgs('sel', '/5/1/0/0', [...Array(46).keys()]), keySel: await sel('/5/1/0/1', 0),
      side: await imgs('sel', '/5/2/0/0', [0, 1, 2, 3]), sideSel: await sel('/5/2/0/1', 0),
      conf: await sel('/5/3/0/0', 0), confSel: await sel('/5/3/0/1', 0),
    };
    // DDR II's workout PLAYER DATA (select_bin /9/4: the top buttons + profile cards, their numbers and frame; the
    // header /1/0/0/3 and its "PLAYER DATA" /9/0/0/4; the page arrow /2/2/0/4) - fifo_ddr2_wkdata.dff
    if (!HP4_NOW()) A.wkData = {
      head: await sel('/1/0/0/3', 0), title: await sel('/9/0/0/4', 0), btn: await imgs('sel', '/9/4/0/2', [0, 1, 2, 3]),
      frame: await sel('/9/4/0/3', 0), num: await imgs('sel', '/9/4/0/1', [0, 1, 2, 3, 4, 5, 6, 7, 8]), arrow: await sel('/2/2/0/4', 0), help: await sel('/3/0/0/1', 0),
    };
    // the WEIGHT / IDEAL WEIGHT / BMI panel after WEIGHT INPUT (select_bin /9/12/1/0 - fifo_ddr2_bmi.dff)
    if (!HP4_NOW()) A.wkBmi = {
      bmi: await sel('/9/12/1/0/1', 0), ideal: await sel('/9/12/1/0/2', 0), weight: await sel('/9/12/1/0/3', 0),
      unit: await imgs('sel', '/9/12/1/0/5', [0, 1]),
    };
    // the game's YES / NO window (fifo_ddr2_yesno.dff): the dim (select_bin /7/2/0/0 at alpha 127 over the whole
    // screen), the window comAF /4/1/0/0, YES / NO comAF /4/3/0/0 pictures 2 / 3 and the chosen one's frame /4/3/0/1
    if (!HP4_NOW()) A.yesno = {
      dim: await sel('/7/2/0/0', 0), win: await img('af', '/4/1/0/0', 0),
      btn: await imgs('af', '/4/3/0/0', [2, 3]), frame: await img('af', '/4/3/0/1', 0),
      // (the bigger button window /4/2/0/0 and every button: 0 CONFIRM, 1 CANCEL, 2 YES, 3 NO, 8 PLAY, 9 DELETE, 10 EDIT,
      // 11 DIARY, 13 NAME, 14 PASSWORD, 15 WEIGHT, 16 HEIGHT - fifo_ddr2_wkload / wkedit.dff)
      msgWin: await img('af', '/4/1/0/0', 1),      // (the message-only window: dark all over, CONFIRM's corner bottom right)
      win2: await img('af', '/4/2/0/0', 0), all: await imgs('af', '/4/3/0/0', [...Array(17).keys()]),
    };
    // WORKOUT's DIARY (select_bin group 9: /9/7 the totals and DIARY pages, /9/8 the graphs, /9/9 the tabs, /9/10 BMI TABLE)
    if (!HP4_NOW()) A.wkDiary = {
      nameBar: await sel('/9/7/0/2', 0), panel0: await sel('/9/7/0/3', 0), panel1: await sel('/9/7/0/0', 0), confirm: await sel('/9/6/0/0', 0),
      frame: await imgs('sel', '/9/8/0/8', [0, 1]), plate: await sel('/9/8/0/9', 0), unit: await imgs('sel', '/9/8/0/4', [0, 1]),
      time: await sel('/9/8/0/5', 0), box: await imgs('sel', '/9/8/0/6', [0, 1]), band: await imgs('sel', '/9/8/0/1', [0, 1, 2, 3, 4, 5, 6]),
      tab: await imgs('sel', '/9/9/0/1', [0, 1, 2]), month: await imgs('sel', '/9/9/0/2', [...Array(12).keys()]),
      table: await sel('/9/10/0/2', 0), tableBox: await sel('/9/10/0/1', 0),
      square: await sel('/9/8/0/0', 0), line: await sel('/9/8/0/10', 0), dot: await sel('/9/8/0/3', 0),
    };
    // SELECT MODE (select_bin group 0), SELECT NUMBER OF PLAYERS / SELECT STYLE (group 1), record data (group 9)
    A.menu = {
      modeCard: await imgs('sel', '/0/1/0/0', [0, 1, 2, 3]),                      // numbered gradient cards 1-4
      modeSil: await Promise.all([1, 2, 3, 4].map(k => img('sel', `/0/1/0/${k}`, 0))),  // the card's dancer shape
      modeCardName: await imgs('sel', '/0/1/0/5', [0, 1, 2, 3]),
      selectMode: trim(await img('sel', '/0/2/0/0', 0)),
      modeName: await imgs('sel', '/0/2/0/1', [0, 1, 2, 3]),
      modeHelp: await imgs('sel', '/0/2/0/2', [0, 1, 2, 3]),
      dancer: await Promise.all([3, 4, 5, 6].map(k => img('sel', `/0/${k}/0/0`, 0))),
      dancerSil: await Promise.all([3, 4, 5, 6].map(k => img('sel', `/0/${k}/0/1`, 0))),
      playersTitle: trim(await img('sel', '/1/0/0/0', 0)), helpWin: await img('sel', '/1/0/0/1', 0),
      helpWinS: await img('sel', '/13/0/0/1', 0), helpMask: await img('sel', '/1/0/0/2', 0),     // (mes_wind_S_01 / mirror_alp01)
      titleWin: await img('sel', '/1/0/0/3', 0),
      // 1 player, 2, 3, 4 players, SYNC. GUEST, NORMAL, FRIENDSHIP, SYNC, DOUBLE
      // (HP4: its own set of 13 in group 7 - /7/1/0/0: 0-4 the players cards, 5 NORMAL, 6 FRIENDSHIP, 7 SYNC,
      // 8 FAMILY, 9 TRAINING, 10 DANCE VIEW, 11 WORKOUT MODE, 12 Wii Balance Board; /1/1 is DDR II's 9)
      cards: HP4_NOW() ? await imgs('sel', '/7/1/0/0', [...Array(13).keys()]) : await imgs('sel', '/1/1/0/0', [0, 1, 2, 3, 4, 5, 6, 7, 8]),
      cardOn: await img('sel', HP4_NOW() ? '/7/1/0/1' : '/1/1/0/1', 0),
      styleTitle: trim(await img('sel', '/7/0/0/0', 0)),     // (SELECT STYLE: CAE 0x7b44a0 select_style_US, picture 0)
      dataTitle: trim(await img('sel', '/13/0/0/3', 0)), dataBtn: await imgs('sel', '/9/4/0/2', [0, 1]),
      // SELECT RECORD DATA (group 13): record button, GUEST / EDIT, the orange highlight frames, player badges
      recBtn: await img('sel', '/13/1/0/2', 0), recOn: await img('sel', '/13/1/0/3', 0),
      guestEdit: await imgs('sel', '/13/2/0/2', [0, 1]), geOn: await img('sel', '/13/2/0/3', 0),
      badges: await imgs('sel', '/13/1/0/0', [0, 1, 2, 3]), titleBar: await img('sel', '/11/1/0/0', 0),
    };
    // DDR SCHOOL's SELECT LESSON (select_bin group 11): lesson name plates, the teacher's six poses, his
    // speech windows (grey, step, choreograph, balance board), grades E-AAA, crowns, arrows, BEGIN LESSONS
    A.lesson = {
      names: await imgs('sel', '/11/0/0/0', [...Array(15).keys()]),
      teacher: (await imgs('sel', '/11/0/0/1', [0, 1, 2, 3, 4])).concat([await img('sel', '/11/0/0/2', 0)]),
      wind: await imgs('sel', '/11/0/0/3', [0, 1, 2, 3]),
      grades: await imgs('sel', '/11/0/0/4', [0, 1, 2, 3, 4, 5, 6]),
      arrow: await img('sel', '/11/0/0/5', 0), crowns: await imgs('sel', '/11/0/0/7', [0, 1, 2, 3]),
      titleBar: await img('sel', '/11/1/0/0', 0), title: trim(await img('sel', '/11/1/0/1', 0)),
      begin: await img('sel', '/11/3/0/0', 0), beginOn: await img('sel', '/11/3/0/1', 0),
    };
    // comAF: the italic number set (0-9, then ':' '.' '-' '/' ...) and the button-hint bar pictures
    A.num28 = await imgs('af', '/0/0/0', [...Array(28).keys()]);
    A.hints = await imgs('af', '/1/0/0', [...Array(54).keys()]);
    // song select (light blue screen) pieces
    A.img.bgShapes = await imgs('scm', '/0/1', [4, 5, 7, 8]);        // filled circle, ring, thick ring, striped circle
    A.img.bgGrad = await img('scm', '/0/1', 0);                       // (HP4: its pink backdrop strip, white to pink)
    A.img.headerBar = await img('mus', '/0/7/0/1', 0);
    A.img.magenta = await img('mus', '/0/5/0/0', 0);
    A.img.jacketHi = await img('mus', '/0/3/0/1', 0);
    A.img.diffPanel = await img('mus', '/0/1/0/22', 0);
    // SELECT DIFFICULTY player markers (sel_1p-4p, selMusic /0/10/0/4: player n's badge at slot n with its
    // coloured line back to the button)
    A.img.selMarks = await imgs('mus', '/0/10/0/4', [0, 1, 2, 3]);
    // the confirmed-player badges (1p-4p_box01, TPLs /0/10/0/0-3, 60 x 60)
    A.img.selBox = await Promise.all([0, 1, 2, 3].map(j => img('mus', '/0/10/0/' + j, 0)));
    A.img.gradeSmall = await imgs('mus', '/0/1/0/18', [0, 1, 2, 3, 4, 5, 6]);   // AAA AA A B C D E
    A.img.crowns = await imgs('mus', '/0/1/0/19', [0, 1, 2, 3]);
    // gameplay meter (top panel above the arrows)
    A.img.meterPanel = await img('mfm', '/0/4', 0);
    if (!HP4_NOW()) A.img.wkTimer = await img('mfm', '/0/3', 0);       // (DDR II WORKOUT: the play-time pill - fifo_ddr2_wkplay.dff)
    A.img.meterGauge = await img('mfm', '/0/5', 0);
    A.img.meterBadge = await img('mfm', '/0/10', 0);
    // DEMO PLAY's banner in place of the player's bar (METER_FM_US.bin parts 76 / 77 at the 1p_bar01 spot 343, 60:
    // demo_wind01 = picture 13 under demo_txt01_US = picture 12 - the Dolphin demo shows only this, no gauge / score)
    A.img.demoWin = await img('mfm', '/0/13', 0); A.img.demoTxt = await img('mfm', '/0/12', 0);
    A.img.meterBadge2 = await img('mfm', '/0/10', 1);
    // per player (METER_FM_US.bin): panels /0/4 (0 blue, 1 red, 2 / 3 green / yellow pills, 4 pink, 5 grey),
    // badges 1-4 /0/10, gauge frames /0/5 (0 blue, 1 red, 2 green, 3 yellow, 4 blue, 5 grey)
    A.img.meterPanels = await imgs('mfm', '/0/4', [0, 1, 2, 3, 4, 5]);
    A.img.meterBadges = await imgs('mfm', '/0/10', [0, 1, 2, 3]);
    A.img.meterGauges = await imgs('mfm', '/0/5', [0, 1, 2, 3, 4, 5]);
    // 3 / 4 players (game/METER_MULTI_US.bin: set /1 = 3 players, /2 = 4 players). Each set: /0/0 mode words
    // (NORMAL, SYNC, FRIENDSHIP), /0/1 STYLE plate, /0/4 panels (1 blue, 2 red, 3 green, 4 yellow), /0/5 gauge
    // frames, /0/6 difficulty words, /0/9 DANGER!!, /0/10 badges 1-4; its CAE block holds where each goes
    A.multi = {};
    try {
      const cj = await (await fetch('/api/cae/mmu')).json();
      for (const [n, set] of [[3, 1], [4, 2]]) {
        const P = '/' + set + '/0/';
        A.multi[n] = {
          words: await imgs('mmu', P + '0', [0, 1, 2]), plate: await img('mmu', P + '1', 0),
          panels: await imgs('mmu', P + '4', [0, 1, 2, 3]), gauges: await imgs('mmu', P + '5', [0, 1, 2, 3]),
          diffs: await imgs('mmu', P + '6', [0, 1, 2, 3, 4]), danger: await img('mmu', P + '9', 0),
          badges: await imgs('mmu', P + '10', [0, 1, 2, 3]), cae: cj.blocks[set] && cj.blocks[set].parts,
        };
      }
    } catch (e) { A.multi = {}; }
    // FRIENDSHIP / SYNC with 3 / 4 players (game/METER_FS2_US.bin, one shared field): /0/0 words (3 SYNC,
    // 4 FRIENDSHIP), /0/1 STYLE plate, /0/4 the pink group panel, /0/5 player panels, /0/6 group gauge,
    // /0/7 PLAYER 1-4, /0/8 difficulty words, /0/11 DANGER!!, /0/12 group badge, /0/13 PARTY; CAE block /1
    try {
      const cj = await (await fetch('/api/cae/fs2')).json();
      A.party = {
        words: await imgs('fs2', '/0/0', [0, 1, 2, 3, 4]), plate: await img('fs2', '/0/1', 0), bar: await img('fs2', '/0/4', 0),
        panels: await imgs('fs2', '/0/5', [0, 1, 2, 3]), gauge: await img('fs2', '/0/6', 0), tags: await imgs('fs2', '/0/7', [0, 1, 2, 3]),
        diffs: await imgs('fs2', '/0/8', [0, 1, 2, 3, 4]), danger: await img('fs2', '/0/11', 0), box: await img('fs2', '/0/12', 0),
        sticker: await img('fs2', '/0/13', 0), cae: cj.blocks[0] && cj.blocks[0].parts,
      };
    } catch (e) { A.party = null; }
    // DDR POINTS plate and COMPLETE!! (2Dcommon/comAF_US.bin /7/0/2 and /7/0/1)
    // the explanation screens (comAF_US.bin /5/4): 0 / 1 the side panels (107 x 480, left and right of the
    // 640 x 480 page on the 854 x 480 screen), 4 Arrow, 5-10 STEP LESSON 1-6, 11 Freeze Arrow
    A.img.explain = await imgs('af', '/5/4', [...Array(38).keys()]);     // (HP4 adds pages 15-37: CHOREOGRAPH, board, FAMILY ...)
    A.img.ptsPlate = await img('af', '/7/0/2', 0);
    // DDR II's MAX COMBO CHALLENGE window (comAF /6/0): 5 the window (title, COMBO, EXIT), 1 Start!! / KEEP
    // GOING!!, 2 End!!, 3 NORMAL / FRIENDSHIP / SYNC / DOUBLE STYLE, 4 NEW RECORD, 0 the dim leading zero
    A.img.mcc = { win: await img('af', '/6/0/5', 0), start: await img('af', '/6/0/1', 0), keep: await img('af', '/6/0/1', 1),
      end: await img('af', '/6/0/2', 0), styles: await imgs('af', '/6/0/3', [0, 1, 2, 3]), newRec: await img('af', '/6/0/4', 0),
      zero: await img('af', '/6/0/0', 0) };
    A.img.ptsComplete = await img('af', '/7/0/1', 0);
    A.img.meterStyle = await img('mfm', '/0/1', 0);
    A.img.meterNormal = await img('mfm', '/0/0', 0);
    A.img.meterDouble = await img('mfm', '/0/0', 6);
    A.img.meterDiff = await imgs('mfm', '/0/6', [0, 1, 2, 3, 4]);
    A.img.meterDanger = await img('mfm', '/0/8', 0);
    // results screen pieces
    A.img.resPanel1P = await img('res', '/0/0/0/1', 2);
    A.img.resPanel2P = await img('res', '/0/0/0/1', 0);     // VERSUS: 1P boxes left, 2P right
    A.img.resJacketFrame = await img('res', '/0/0/0/0', 0);
    // 3 / 4 player RESULTS (selResult /0/1 the screen, /0/2 a player's card): jacket frame, the judgment list
    // (multi), style words, cards (blue, red, green, yellow), PLAYER n, difficulty words, the count window
    A.img.resMany = {
      frame: await img('res', '/0/1/0/0', 0), list: await img('res', '/0/1/0/1', 2), titleBar: await img('res', '/0/1/0/2', 0),
      title: await img('res', '/0/1/0/3', 0), styles: await imgs('res', '/0/1/0/4', [0, 1, 2, 3, 4, 5, 6]),
      players: await imgs('res', '/0/2/0/0', [0, 1, 2, 3]), diffs: await imgs('res', '/0/2/0/1', [0, 1, 2, 3, 4]),
      counts: await img('res', '/0/2/0/2', 0), cards: await imgs('res', '/0/2/0/4', [0, 1, 2, 3]),
    };
    // DDR II with 1 / 2 players: the same file layout as HP4's - /0/0 the 1-2 player screen (frame, table in 12
    // versions, title bar, RESULTS, style words); its cards are /0/2's
    if (!(typeof HP4 !== 'undefined' && HP4)) A.img.resFew = {
      frame: await img('res', '/0/0/0/0', 0), titleBar: await img('res', '/0/0/0/2', 0), title: await img('res', '/0/0/0/3', 0),
      styles: await imgs('res', '/0/0/0/4', [0, 1, 2, 3, 4, 5, 6]), table: await imgs('res', '/0/0/0/1', [0, 1, 2, 3]),
      lessonTable: await img('res', '/0/0/0/1', 10),
      goalBox: await img('res', '/0/0/0/7', 0), goalKcal: await img('res', '/0/0/0/8', 0),     // (WORKOUT: TO REACH THE GOAL - fifo_ddr2_wkgoal.dff)      // (DDR II's lessons: Awesome!! .. Try Harder!! rows - fifo_ddr2_lessonres.dff)
      // WORKOUT's CALORIES BURNED table (picture 9) and the results' own digits /0/0/0/9 (fifo_ddr2_wkres.dff)
      calTable: await img('res', '/0/0/0/1', 9), digits: await imgs('res', '/0/0/0/9', [0]),
    };
    if (typeof HP4 !== 'undefined' && HP4) {
      // HP4's results (selResult_US.bin): /0/0 the 1-2 player screen (its table /0/0/0/1: 12 versions -
      // 0 with MARVELOUS, 1 without, 6-9 calories, 10 / 11 Hyper Move), /0/2 a player's card (players, the
      // dancers' names, difficulties, the counts window, the calories window, six card colours)
      Object.assign(A.img.resMany, {
        frame: await img('res', '/0/0/0/0', 0), titleBar: await img('res', '/0/0/0/2', 0), title: await img('res', '/0/0/0/3', 0),
        styles: await imgs('res', '/0/0/0/4', [0, 1, 2, 3, 4, 5]), table: await imgs('res', '/0/0/0/1', [0, 1, 2, 3]),
        players: await imgs('res', '/0/2/0/0', [0, 1, 2, 3]), diffs: await imgs('res', '/0/2/0/2', [0, 1, 2, 3]),
        counts: await img('res', '/0/2/0/3', 0), cards: await imgs('res', '/0/2/0/5', [0, 1, 2, 3]),
      });
    }
    A.img.card = await img('sel', '/2/4/0/1', 0);
    const strips = await imgs('af', '/11', [13, 15, 17, 19, 21]);
    const cut = s => s ? [...Array(10).keys()].map(i => crop(s, i * 56, 0, 56, 56)) : null;
    A.numbers = { white: cut(strips[0]), blue: cut(strips[1]), green: cut(strips[2]), gold: cut(strips[3]), sky: cut(strips[4]) };
    if (strips[0]) {   // the game's red digits aren't in this file; tint the white ones
      const red = document.createElement('canvas'); red.width = strips[0].width; red.height = strips[0].height;
      const x = red.getContext('2d');
      x.drawImage(strips[0], 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#ff2828'; x.fillRect(0, 0, red.width, red.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(strips[0], 0, 0);
      A.numbers.red = cut(red);
    }
    A.img.logo = await img('ttl', '/3/0/1', 0);
    A.img.logoGlow = await img('ttl', '/3/0/3', 0);
    A.img.copyright = await img('ttl', '/3/0/2', 0);
  }

  // ------------------------------------------------------------- sounds
  const sfxCache = new Map();
  // opts.loop: a looped sound (its own loop point) that plays until stopSfx(handle, fade seconds)
  A.playSfx = async function (name, gain = 1, opts = {}) {
    const handle = opts.handle || { srcs: [] };
    try {
      let notes = sfxCache.get(name);
      if (!notes || name.startsWith('VO_')) {   // announcer lines pick a random take each time
        const r = await fetch('/api/sfx?n=' + name);
        if (!r.ok) return;
        const buf = await r.arrayBuffer(), dv = new DataView(buf);
        const n = dv.getUint32(0);
        let p = 4;
        notes = [];
        for (let i = 0; i < n; i++) {
          const t = dv.getFloat32(p), ratio = dv.getFloat32(p + 4), vol = dv.getFloat32(p + 8), len = dv.getUint32(p + 12);
          const w = DDR.decodeRWAV(buf.slice(p + 16, p + 16 + len));
          notes.push({ t, ratio, vol, buf: toBuffer(w) });
          p += 16 + len;
        }
        sfxCache.set(name, notes);
      }
      const ctx = audio(), now = ctx.currentTime + 0.01;
      for (const nt of notes) {
        const src = ctx.createBufferSource(), gn = ctx.createGain();
        src.buffer = nt.buf; src.playbackRate.value = nt.ratio;
        if (opts.loop && nt.buf.loopFrom !== undefined) { src.loop = true; src.loopStart = nt.buf.loopFrom; src.loopEnd = nt.buf.duration; }
        gn.gain.value = Math.min(1.5, nt.vol * 1.6 * gain * (S.sfxVolume ?? 1));
        src.connect(gn).connect(ctx.destination);
        if (handle.stopped) return handle;
        src.start(now + nt.t);
        handle.srcs.push({ src, gn });
        handle.end = Math.max(handle.end || 0, now + nt.t + nt.buf.duration / (nt.ratio || 1));
      }
    } catch (e) { /* no sound */ }
    return handle;
  };
  // stop a sound started with playSfx (fading out over `fade` seconds)
  A.stopSfx = function (handle, fade = 0) {
    if (!handle) return;
    handle.stopped = true;
    const ctx = audio(), now = ctx.currentTime;
    for (const { src, gn } of handle.srcs) {
      try {
        gn.gain.cancelScheduledValues(now); gn.gain.setValueAtTime(gn.gain.value, now);
        gn.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fade)); src.stop(now + Math.max(0.01, fade) + 0.05);
      } catch (e) {}
    }
    handle.srcs = [];
  };

  // judgment-coloured hit flash
  A.burstTint = function (color, dir) {
    if (!A.burst) return null;
    const key = 'b' + color + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, 64, 64);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(A.burst[dir], 0, 0);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(A.burst[dir], 0, 0);
      A.tintCache.set(key, c);
    }
    return c;
  };

  A.loadTitle = async function () {
    A.img.logo = await img('ttl', '/3/0/1', 0);
    A.img.logoGlow = await img('ttl', '/3/0/3', 0);
    A.img.copyright = await img('ttl', '/3/0/2', 0);
  };
  // the start-up screens and the title (logo/logo_ENG.tpl, select/selTitle_US.bin, the WARNING window from
  // 2Dcommon/comAF_US.bin) and the game's font (font/font_us.bin: a 16 x 13 grid of 20 x 24 letters, then
  // ten ready-made banners - WARNING!, SONG CLEARED!! ...)
  A.loadIntro = async function () {
    if (A.intro) return A.intro;
    const [strap1, strap2, konami] = await imgs('logo', '', [0, 1, 2]);
    const T = n => img('ttl', n, 0);
    A.intro = {
      strap: [strap1, strap2], konami,
      dolby: await T('/1/0/0'), copy: await T('/1/0/1'), notice: await T('/1/0/2'), noticeText: await T('/1/0/3'),
      logo: await T('/3/0/1'), copy2: await T('/3/0/2'), flare: await T('/3/0/3'), shine: await T('/3/0/4'),
      arrow: await T('/3/0/5'), arrowGlow: await T('/3/0/6'), arrowSoft: await T('/3/0/7'),
      ripple: [await T('/3/0/8'), await T('/3/0/9'), await T('/3/0/10')],
      point: await T('/4/0/0'), letsDance: await T('/4/0/1'),
      mist: await T('/5/0/0'), nebula: await T('/5/0/1'), stars: await T('/5/0/2'),
      window: await img('af', '/4/1/0/0', 1),
      font: await img('font', '/0', 0), banners: await imgs('font', '/0', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    };
    if (A.intro.font) A.font = buildFont(A.intro.font);
    return A.intro;
  };
  // the game font: which letter is in which cell (row by row, 16 to a row; \0 = an empty cell), and each
  // letter's inked width measured from the picture
  const FONT_ROWS = ['0123456789*☆+−×→', '\0ABCDEFGHIJKLMNO', 'PQRSTUVWXYZ“‘[]/', '\0abcdefghijklmno',
    'pqrstuvwxyz:%·&~', '`°,。―._#@~ËЯ=', '\0ÄÖÜßÀÁÈÉÌÍÒÓÙÚÑ', 'ÂÊËÎÏÔÛŸÿ✱Ç', '', '”’!?\u0001\u0002¿¡{};©<>',
    '\0àâäçèéêëîïôöùûü', 'áìíòóúñŒœΦº♥$∀Δ‖', '()\0\0\0\0\0\0\0\0\0\0\0\0…▼'];
  const FONT_ALIAS = { '-': '−', '"': '”', "'": '’', '‘': '’', '“': '”', '—': '―', '–': '−' };
  function buildFont(atlas) {
    const c = document.createElement('canvas'); c.width = atlas.width; c.height = atlas.height;
    const x = c.getContext('2d'); x.drawImage(atlas, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data, glyphs = {};
    FONT_ROWS.forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === '\0') return;
      let lo = 20, hi = -1;
      for (let gx = 0; gx < 20; gx++) for (let gy = 0; gy < 24; gy++)
        if (px[((r * 24 + gy) * c.width + col * 20 + gx) * 4 + 3] > 60) { lo = Math.min(lo, gx); hi = Math.max(hi, gx); break; }
      if (hi >= lo) glyphs[ch] = { sx: col * 20 + lo, sy: r * 24, w: hi - lo + 1 };
    }));
    return { atlas: c, glyphs, alias: FONT_ALIAS, tints: {} };
  }

  A.load = async function () {
    await Promise.all([arrows(), loadC8(), loadSheet7(), hud(), menus(), A.loadIntro()].map(p => p.catch(e => console.warn(e))));
    A.ready = true;
  };
})();
