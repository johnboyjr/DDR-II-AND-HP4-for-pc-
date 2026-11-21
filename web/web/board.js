'use strict';
// The Wii Balance Board on PC (DDR HP4's Wii Balance Board MODE), read through WebHID (Chrome / Edge).
// Pair the board with Windows first (Bluetooth: press the red SYNC button under the battery cover; it
// shows up as "Nintendo RVL-WBC-01"), then choose it in the browser's device list.
//
// The board talks like a Wii Remote with an extension: output reports 0x11 (LEDs), 0x12 (report mode),
// 0x15 (status), 0x16 (write memory), 0x17 (read memory); input 0x20 (status), 0x21 (memory data), 0x22
// (ack), 0x32 (2 button bytes + 8 extension bytes). The extension is switched on by writing 0x55 to
// 0xa400f0 and 0x00 to 0xa400fb. Its 8 bytes are four big-endian sensors: top right, bottom right, top
// left, bottom left. Calibration (24 bytes at 0xa40024): each sensor's reading at 0, 17 and 34 kg.
//
// How DDR HP4 reads it (main.dol 0x80108b60, every frame, from the board's centre of weight x / y, -1..1,
// CzanWbc +0x1bc8 / +0x1bcc; nothing counts until the four sensors add up to more than 2 kg):
//  - 8 directions: past 0.35 one way with the other axis inside 0.35 (or both past 0.35 = a diagonal); a
//    second set at 0.25 for the hip roll.
//  - BUMP (lane 4 / 5): x past +0.45 = one side, past -0.45 = the other.
//  - HIP ROLL: with the centre more than 0.25 from the middle, the turn of its angle is added up each way
//    (atan2, wrapped to -pi..pi each frame). Turning one way feeds that way's timer by 2 x the frame time (up
//    to 0.4 s); each timer runs down by the frame time and, when it reaches 0, that way's total starts again.
//    A total of a full turn (2 pi) while the centre is out past 0.25 = the roll.
//  - every result is a timer: set to 0.1 s (+0x120..0x13c, all 0.1 from 0x8026dbe8, filled by 0x80108974)
//    on each frame its rule holds, run down by the frame time - so it stays pressed 0.1 s after the rule
//    stops holding.
//  - the arrows (lanes 0-3) stay on the keys / mat; the board's front button = Enter.
const Board = {
  dev: null, ok: false, msg: '', cal: null, kg: [0, 0, 0, 0], x: 0, y: 0, total: 0, at: 0,
  side: 0, held: false, btn: false, _readBuf: [], _readWant: 0, _readDone: null,
  supported() { return !!(navigator.hid && navigator.hid.requestDevice); },
  async connect() {
    if (!this.supported()) { this.msg = 'This browser can\'t reach the board (needs Chrome or Edge).'; return false; }
    try {
      let devs = await navigator.hid.getDevices();
      let dev = devs.find(d => d.vendorId === 0x057e && d.productId === 0x0306);
      if (!dev) {
        const pick = await navigator.hid.requestDevice({ filters: [{ vendorId: 0x057e, productId: 0x0306 }] });
        dev = pick && pick[0];
      }
      if (!dev) { this.msg = 'No board chosen.'; return false; }
      if (!dev.opened) await dev.open();
      this.dev = dev;
      dev.addEventListener('inputreport', e => this.report(e.reportId, new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength)));
      this.msg = 'Setting up the board...';
      await this.send(0x11, [0x10]);                                 // LED 1 on
      await this.write(0xa400f0, [0x55]);
      await this.write(0xa400fb, [0x00]);
      const c = await this.read(0xa40024, 24);
      if (c && c.length >= 24) {
        const u = k => c[2 * k] << 8 | c[2 * k + 1];
        this.cal = [0, 1, 2, 3].map(s => [u(s), u(4 + s), u(8 + s)]);
      }
      await this.send(0x12, [0x00, 0x32]);                           // buttons + 8 extension bytes
      this.ok = true; this.msg = this.cal ? 'Board connected.' : 'Board connected (no calibration read - weights are rough).';
      return true;
    } catch (e) {
      this.msg = 'Could not open the board: ' + (e && e.message || e);
      return false;
    }
  },
  async send(id, bytes) { if (this.dev) await this.dev.sendReport(id, new Uint8Array(bytes)); },
  async write(addr, data) {
    const b = new Array(21).fill(0);
    b[0] = 0x04; b[1] = addr >> 16 & 0xff; b[2] = addr >> 8 & 0xff; b[3] = addr & 0xff; b[4] = data.length;
    data.forEach((v, i) => { b[5 + i] = v; });
    await this.send(0x16, b);
    await new Promise(r => setTimeout(r, 50));
  },
  read(addr, size) {
    return new Promise(async res => {
      this._readBuf = []; this._readWant = size; this._readDone = res;
      setTimeout(() => { if (this._readDone === res) { this._readDone = null; res(null); } }, 1500);
      await this.send(0x17, [0x04, addr >> 16 & 0xff, addr >> 8 & 0xff, addr & 0xff, size >> 8, size & 0xff]);
    });
  },
  report(id, d) {
    if (id === 0x21 && this._readDone) {                              // memory data: 16 bytes a packet
      const n = (d[2] >> 4) + 1;
      for (let i = 0; i < n; i++) this._readBuf.push(d[5 + i]);
      if (this._readBuf.length >= this._readWant) { const f = this._readDone; this._readDone = null; f(this._readBuf.slice(0, this._readWant)); }
      return;
    }
    if (id === 0x20) { this.send(0x12, [0x00, 0x32]); return; }      // a status report resets the mode
    if (id !== 0x32 && id !== 0x34) return;
    const btn = !!(d[1] & 0x08), now = performance.now();
    if (btn !== this.btn) { this.btn = btn; input.raw({ t: 'board', k: 'A' }, btn, now); }
    const raw = [0, 1, 2, 3].map(s => d[2 + 2 * s] << 8 | d[3 + 2 * s]);  // TR, BR, TL, BL
    this.kg = raw.map((v, s) => {
      const c = this.cal && this.cal[s];
      if (!c) return v / 100;
      return v < c[1] ? 17 * (v - c[0]) / Math.max(1, c[1] - c[0]) : 17 + 17 * (v - c[1]) / Math.max(1, c[2] - c[1]);
    });
    const tot = this.kg.reduce((a, v) => a + Math.max(0, v), 0);
    // (CzanWbc 0x801713b0: a sensor at or below 0, or under 1 kg, counts as 1 kg; x = 2 (right / all - 0.5),
    // y = -2 (bottom / all - 0.5) - sensors TR, BR, TL, BL)
    const [tr, br, tl, bl] = this.kg.map(v => (v <= 0 || Math.abs(v) < 1) ? 1 : v), all = tr + br + tl + bl;
    const dt = this.at ? Math.min(0.1, (now - this.at) / 1000) : 0;
    this.total = tot; this.at = now;
    const on = tot > 2;
    this.x = on ? 2 * ((tr + br) / all - 0.5) : 0; this.y = on ? -2 * ((br + bl) / all - 0.5) : 0;
    const x = this.x, y = this.y;
    // the eight directions (0x80108b60): bit 0 front, 1 back, 2 left, 3 right, 4 front-left, 5 front-right,
    // 6 back-left, 7 back-right - one axis past the line with the other inside it, or both past (a diagonal)
    const dirs = th => {
      const fx = Math.abs(x) < th, fy = Math.abs(y) < th;
      return (y > th && fx ? 1 : 0) | (y < -th && fx ? 2 : 0) | (x < -th && fy ? 4 : 0) | (x > th && fy ? 8 : 0)
        | (y > th && x < -th ? 16 : 0) | (y > th && x > th ? 32 : 0) | (y < -th && x < -th ? 64 : 0) | (y < -th && x > th ? 128 : 0);
    };
    const d35 = on ? dirs(0.35) : 0, d25 = on ? dirs(0.25) : 0, fresh = d35 & ~(this.prevDir || 0);
    this.prevDir = d35;
    // the hip roll: the angle turned each way, kept while that way's timer lasts
    const R = this.roll || (this.roll = { a: 0, pos: 0, neg: 0, tp: 0, tn: 0 });
    R.tp -= dt; if (R.tp <= 0) { R.tp = 0; R.pos = 0; }
    R.tn -= dt; if (R.tn <= 0) { R.tn = 0; R.neg = 0; }
    let turn = 0;
    if (Math.hypot(x, y) > 0.25) {
      const a = Math.atan2(y, x);
      let d = a - R.a; while (d >= Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI;
      R.pos += d; R.neg -= d;
      if (R.last > 0 && d > 0) R.tp = Math.min(0.4, R.tp + 2 * dt);
      if (R.last < 0 && d < 0) R.tn = Math.min(0.4, R.tn + 2 * dt);
      R.a = a; R.last = d; turn = 1;
    } else R.last = 0;
    // the side: x past +0.45 = 0xa8 (the right-hand directions), past -0.45 = 0x54, between = all (0xff) with
    // someone on the board, none without
    const side = x > 0.45 ? 0xa8 : x < -0.45 ? 0x54 : on ? 0xff : 0;
    // the eight result words (timers per direction, 0.1 s each - 0x80108974): 0 = the 0.35 directions, 1 = those
    // just entered, 2 / 3 = a full roll one way / the other (in the 0.25 directions), 4 = 'RStepOff' (no 0xa8 in the
    // side), 5 = right foot on, 6 = 'LStepOff' (no 0x54 in the side), 7 = left foot on
    const T = this.tm || (this.tm = [...Array(8)].map(() => new Float32Array(8)));
    for (const w of T) for (let b = 0; b < 8; b++) w[b] = Math.max(0, w[b] - dt);
    for (let b = 0; b < 8; b++) {
      const m = 1 << b;
      if (d35 & m) T[0][b] = 0.1;
      if (fresh & m) T[1][b] = 0.1;
      if (turn && R.pos >= 2 * Math.PI && (d25 & m)) T[2][b] = 0.1;
      if (turn && R.neg >= 2 * Math.PI && (d25 & m)) T[3][b] = 0.1;
      if (m & 0xa8) T[side & 0xa8 ? 5 : 4][b] = 0.1;
      if (m & 0x54) T[side & 0x54 ? 7 : 6][b] = 0.1;
    }
    this.words = T.map(w => w.reduce((a, v, b) => a | (v > 0 ? 1 << b : 0), 0));
    this.move(this.words[6] && on ? 1 : this.words[4] && on ? -1 : 0, !!(this.words[2] || this.words[3]), now);
  },
  // a board code (0x8002fc50 - Dir 0-7: word 0 with the direction's mask, 8 / 9: words 7 / 5, LStepOff 10-17: word
  // 6, RStepOff 18-25: word 4, 0x1a: any of word 0, 0x1b / 0x1c: words 2 / 3)
  code(c) {
    const W = this.words; if (!W || !this.ok) return false;
    const DIR = [0x31, 0x29, 0xa8, 0x8a, 0xc2, 0x46, 0x54, 0x15];
    if (c >= 0 && c < 8) return !!(W[0] & DIR[c]);
    if (c === 8) return !!W[7]; if (c === 9) return !!W[5];
    if (c >= 10 && c < 18) return !!W[6]; if (c >= 18 && c < 26) return !!W[4];
    if (c === 0x1a) return !!W[0]; if (c === 0x1b) return !!W[2]; if (c === 0x1c) return !!W[3];
    return false;
  },
  // (the board's moves reach the game through board codes per note - Board.code / boardCode in game.js - not as keys)
  move() {},
};
