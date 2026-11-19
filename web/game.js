// DDR II PC - game. Screens: title, setup, select, options, controls, loading, play, results.
//
// HOW THIS FILE IS LAID OUT (search for the words in capitals or after "----" to jump to a part)
//   settings ................ S (the settings in use), DEFAULTS, saveSettings
//   records, DDR points ..... DATA / SAVE (save.json), unlocks, the challenge task, favourites
//   canvas, audio, images ... the screen, the sound output, pictures and arrow sprites
//   drawing helpers ......... text / gtext, panel, menuBackground, sfx, voice
//   scenes .................. go(scene) changes screen. A scene is an object with enter(), leave(),
//                             input(action, pressed), draw(seconds) and bgm (its music)
//   start-up ................ Boot, OpMovie, Title, DEMO PLAY, Setup, GameSel
//   menus ................... ModeSel, Players (record data), Style, BattleSel, CourseSel,
//                             WorkoutSet / WkPad / diary, TrainSet, story modes (GC...), LessonSel
//   song select ............. Select (the song list, SHORT / FULL, SELECT DIFFICULTY), MyChar
//   options ................. OPT_TOP / OPT_IND / OPT_PC (the lists), Options, CREDIT, Controls,
//                             custom songs, Explain, mat check
//   loading ................. Loading (reads the chart, music, stage and dancers for a song)
//   gameplay ................ timing windows and scoring, Dancer (one player), Play (the song screen),
//                             READY / HERE WE GO / FULL COMBO / FINISHED banners
//   results ................. Results
//   main loop ............... frame(): input -> scene.draw -> next frame; cabinet lights
// Words used everywhere: g = the canvas to draw on; A = things loaded from the disc (assets.js);
// HP4 = true when started as DDR HP4 PC; "0x800....." in a note = the address in the game's
// main.dol that the rule was read from; ASSUMED / measured = not traced from the game's code.
'use strict';

// the canvas: everything is drawn on a 1280 x 720 screen (W x H), scaled to the window
const W = 1280, H = 720;
// the page's <canvas>, its 2D drawing context (g) and the keyboard / mat / gamepad reader (input.js)
const cv = document.getElementById('screen');
const g = cv.getContext('2d');
const input = new Input();
// ---- the PC key next to each of the game's button hints (comAF /1/0/0, DDR II's 54 hint pictures): every time a
// hint picture is drawn, a small keycap with the PC key goes on its left and the picture moves over to make room.
// The keys are the PC's defaults for that command on the screens that use it (Enter / Esc / Tab / Space always
// work in menus). Hottest Party 4's hint set is numbered differently, so it's left alone.
// DDR II's boss songs (user's list, 2026-11-18): no results dancer after them
const D2_BOSS_SONGS = new Set(['pierce the sky', 'sakura sunrise', 'shiny world', 'possession', 'new decade', 'anti matter',
  'delta max', '888', 'unbelievable', 'london evolved', 'valkyrie dimension']);
// hint picture number -> the PC key shown beside it
const HINT_KEYS = { 0: 'Enter', 1: 'Enter', 2: 'Enter', 34: 'Enter', 3: 'Esc', 4: 'Arrows', 5: 'Arrows', 6: 'Arrows', 7: 'Arrows',
  8: 'Arrows', 12: 'Arrows', 9: '←→', 10: '←→', 11: '↑↓', 13: 'Space', 14: 'Space', 20: 'Space',
  16: 'Tab', 17: 'Tab', 19: 'Tab', 23: 'Tab', 26: '←→', 30: 'Tab', 18: 'Q', 32: 'Mouse', 33: 'Mouse' };
// the hint pictures found so far (picture -> its number) and the list they were read from
let HINT_MAP = null, HINT_SRC = null;
// the real drawImage, kept so the wrapper below can call it
const _drawImage = g.drawImage.bind(g);
g.drawImage = function (im, ...r) {
  const P = typeof A !== 'undefined' && A.hints;
  if (P && !HP4 && im && (r.length === 2 || r.length === 4)) {
    if (HINT_SRC !== P) { HINT_SRC = P; HINT_MAP = new Map(); P.forEach((h, k) => { if (h && HINT_KEYS[k]) HINT_MAP.set(h, HINT_KEYS[k]); }); }
    const key = HINT_MAP.get(im);
    if (key) {
      const [x, y] = r, w = r.length === 4 ? r[2] : im.width, h = r.length === 4 ? r[3] : im.height;
      const fs = Math.max(8, h * 0.5);
      g.save(); g.font = `bold ${fs}px "Segoe UI", Arial, sans-serif`;
      const bw = Math.ceil(g.measureText(key).width + h * 0.55);
      g.fillStyle = 'rgba(48,62,86,0.95)'; g.beginPath(); g.roundRect(x, y + 1, bw, h - 2, h * 0.22); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = Math.max(1, h / 18); g.stroke();
      g.fillStyle = '#ffe86a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(key, x + bw / 2, y + h / 2 + 0.5);
      g.restore();
      return _drawImage(im, x + bw + 2, y, Math.max(h, w - bw - 2), h);
    }
  }
  return _drawImage(im, ...r);
};
// ?auto in the address: every player plays itself (for testing)
const AUTO = new URLSearchParams(location.search).has('auto');
// auto players: 'player:lane' -> the time until which that lane is kept held (a freeze's end)
const AUTO_HELD = {};
// a player named DEMO plays itself, every step dead on time (freezes held to the end)
const isAuto = p => AUTO || /^demo$/i.test((p && p.name) || '');

// ---------------------------------------------------------------- settings
const DEFAULTS = {
  style: 'single', diff: 1, speed: 2, appearance: 'visible', turn: 'off', freezes: true,
  offset: 0, gauge: 'normal', marvelous: true, unlocks: 'off', menuMusic: true, short: false, videoSize: 'wii', screen: 'wide', voice: true, menuSounds: true, movies: true, colors: 'rainbow', bindings: null, sort: 'game', game: 'ddr2', dancer: true, hpStage: 'random', hp4Stage: 'random', boardBump: 25, boardHold: 10, hpDancer: '001', hands: 'right', punch: true, dancerCustom: false, dancerModel: '', ddr2Char: 'random', ddr2Stage3d: true, ngBreaksCombo: false, jump: true, cut: false, guideline: 'beginner', judgePos: 'normal', autoSave: true, evaluation: true, scroll: 'normal', timingColor: false, metronome: false, songOn: true, clap: false, cameraWork: 'default', comboPerf: '50', dancerLight: 'pc', fps: 'max', showFps: false, glFast: true, songProgress: false, earlyLate: false, ghost: false, teamTurn: 'auto', gameLevel: 'medium', freezeGuide: true, judgeModel: 'wii',
  custom: null,                     // DDR CUSTOM: which game each part comes from (see CUSTOM_PARTS)
  lights: true, lightMap: null,     // PAC Drive outputs (1-64) per panel; null = P1 L D U R on 1-4, P2 on 5-8, P3 9-12, P4 13-16
};
// S: the settings in use (DEFAULTS with settings.json on top)
let S = Object.assign({}, DEFAULTS);
// write the settings to settings.json a moment after the last change
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api('/api/settings', { pc: S }), 300);
  if (DATA.current) writeSave();       // keep the player's own options with their data
}

// ---------------------------------------------------------------- records, DDR points, unlocks
// Play points come from the game's table (0x8027a4ac): one row per difficulty, D..AAA (E/failed = 0).
const PLAY_POINTS = [[1000, 1500, 2000, 2500, 3500, 10000], [1500, 2000, 3000, 4000, 6000, 15000],
                     [2000, 3000, 4000, 5000, 7000, 20000], [3000, 4000, 5000, 7000, 10000, 25000],
                     [4000, 5000, 7000, 10000, 15000, 30000]];
// grades from worst to best (for comparing two grades)
const GRADE_ORDER = ['D', 'C', 'B', 'A', 'AA', 'AAA'];
// The "ANY SONG" challenge task shown by the game (bonus points for a cleared song)
const TASKS = [
  ['Clear on BEGINNER or higher', 500, r => !r.failed],
  ['Clear with the Dance Gauge at 60% or higher', 250, r => !r.failed && r.life >= 600],
  ['Clear with a MAX COMBO of 50 or higher', 500, r => !r.failed && r.maxCombo >= 50],
  ['Clear with RANK C or higher', 250, r => !r.failed && GRADE_ORDER.indexOf(r.grade) >= 1],
];
// DDR points unlock schedule. The game's own table (main.dol 0x8027bf38) replaces this list when the
// disc is read (applyDiscUnlocks); this copy (from RemyWiki) is only the fallback. Songs are by the
// game's song number. Outfits and Mii parts aren't in DDR II PC, but they still count as the "next" goal.
let UNLOCKS = [
  [15000, 'Diamond Night', [64]], [37500, 'Outfit "EMI"'], [60000, 'Summer Fairytale', [66]], [82500, 'Outfit "DISCO"'],
  [105000, 'Surrender (PureFocus remix)', [68]], [127500, 'Outfit "RUBY"'], [150000, 'Dance Partay', [72]],
  [172500, 'Outfit "YUNI"'], [195000, 'Tell Me What To Do', [74]], [217500, 'Outfit "RAGE"'],
  [240000, 'real-high-SPEED', [106]], [262500, 'Wings of an Angel (Fly With Me)', [84]], [285000, 'Mii Character'],
  [307500, 'Mii BODY A-6'], [330000, 'El ritmo te controla', [86]], [352000, 'Mii BODY B-6'],
  [375000, 'In The Air', [92]], [397500, 'Mii BODY D-3, E-3'], [420000, 'in love wit you', [104]],
  [442500, 'Mii BODY A-7'], [465000, 'Sky Is The Limit', [108]], [487500, 'Mii BODY B-7'], [510000, 'GOLD RUSH', [122]],
  [532500, 'Mii BODY C-10'], [555000, 'smooooch', [124]], [577500, 'Mii BODY D-4, E-4'],
  [600000, 'ZETA ~The World of Prime Numbers and the Transcendental Being~', [126]], [622500, 'Mii BODY A-8'],
  [645000, "I'm so Happy", [132]], [667500, 'Character "RENA"'], [690000, 'Theory of Eternity', [134]],
  [712500, 'Mii BODY B-8'], [735000, 'oarfish', [150]], [757500, 'Mii BODY C-11'], [780000, 'someday...', [200]],
  [802500, 'Mii BODY D-5, E-5'], [825000, 'aftershock!!', [156]], [847500, 'Outfit "RENA"'],
  [870000, 'dirty digital', [158]], [892500, 'Mii BODY A-9'], [915000, 'Dummy', [160]], [937500, 'Mii BODY B-9'],
  [960000, 'sakura storm', [162]], [982500, 'Mii BODY C-12'], [1005000, 'Your Angel', [164]], [1027500, 'Mii BODY A-10'],
  [1050000, 'All My Love', [166]], [1072500, 'Mii BODY B-10'], [1095000, 'Poseidon (kors k mix)', [168]],
  [1117500, 'Mii BODY C-13'], [1140000, 'CG Project', [170]], [1162500, 'Mii BODY C-14'],
  [1185000, 'KISS KISS KISS AKBK MIX', [174]], [1207500, 'Mii BODY C-15'], [1230000, 'Decade', [178]],
  [1252500, 'Mii BODY C-16'], [1297500, 'FIRE FIRE', [180]], [1320000, 'Mii BODY C-17'],
  [1365000, "Dazzlin' Darlin", [184]], [1387500, 'Mii BODY C-18'], [1410000, "Dazzlin' Darlin -AKBKmix-", [182]],
  [1432500, 'Mii BODY C-19'], [1455000, 'MEI', [186]], [1477500, 'Mii BODY C-20'], [1500000, 'Second Heaven', [188]],
  [1522500, 'Mii BODY C-21'], [1545000, 'VANESSA', [190]], [1567500, 'Mii BODY C-22'], [1590000, 'YELLOW CANDY', [192]],
  [1612500, 'Mii BODY C-23'], [1635000, 'She is my wife', [194]], [1657500, 'Mii BODY C-24'], [1680000, 'DROP', [196]],
  [1702500, 'Shiny World', [120]], [1725000, 'UNBELIEVABLE (Sparky remix)', [82]], [1747500, 'Sakura Sunrise', [112]],
  [1770000, 'Pierce The Sky', [114]], [1792500, 'DELTA MAX', [154]], [1815000, '888', [152]], [1837500, 'New Decade', [110]],
  [1860000, 'Anti-Matter', [172]], [1882500, 'POSSESSION', [118]], [1905000, 'London EVOLVED', [94, 96, 98]],
  [1927500, 'Valkyrie dimension', [116]], [1950000, 'HOTTEST PARTY', [144]], [1972500, 'HOTTEST PARTY 2', [146]],
  [1995000, 'HOTTEST PARTY 3', [148]], [2000000, 'DanceDanceRevolution', [136]],
];
// Replicant D-action: the game's boss folder, in the order the game adds its songs (game song numbers)
const RDA = [120, 112, 114, 152, 154, 110, 172, 118, [94, 96, 98], 116];
// which REPLICANT D-ACTION song this is (its place in RDA), or -1
function rdaIndex(song) { const s = song && (song.full || song.slot); return RDA.findIndex(r => Array.isArray(r) ? r.includes(s) : r === s); }
// favorite songs (the star), kept in each player's data
function favKey(song) { return String(song.full || song.slot); }
// favourites: is this song one of the player's, and add / remove it
function isFav(song, prof = SAVE) { return !!(prof && prof.favorites && prof.favorites.includes(favKey(song))); }
function toggleFav(song) {
  const f = SAVE.favorites = SAVE.favorites || [], k = favKey(song), i = f.indexOf(k);
  if (i >= 0) f.splice(i, 1); else f.push(k);
  writeSave();
  return i < 0;
}
// a five-pointed star (the favourite mark)
function drawStar(x, y, r, fill, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1.5, r * 0.14); g.strokeStyle = '#7a3a00'; g.stroke();
  g.restore();
}
// the unlock table built into this file, used when the disc's own can't be read
const UNLOCK_FALLBACK = UNLOCKS;
// song slot -> the DDR POINTS that unlock it
const UNLOCK_AT = {};
for (const [pts, , slots] of UNLOCKS) for (const sl of slots || []) UNLOCK_AT[sl] = pts;
// the disc's table -> UNLOCKS: [points, label, [full song slots]], one entry per points total
function applyDiscUnlocks(rows) {
  if (!rows || !rows.length) return;
  const OUTFIT = { 200: 'Outfit "EMI"', 201: 'Outfit "DISCO"', 202: 'Outfit "RUBY"', 203: 'Outfit "YUNI"', 204: 'Outfit "RAGE"' };
  const MII = { 82: 'A', 83: 'A', 86: 'B', 87: 'B', 88: 'C', 89: 'C', 84: 'D', 85: 'E' };
  const known = {};                                 // song names from the built-in list, if the song isn't here
  for (const [, label, slots] of UNLOCK_FALLBACK) if (slots && slots.length === 1) known[slots[0]] = label;
  const by = new Map();
  for (const [pts, type, id, , b, , name] of rows) {
    const e = by.get(pts) || { labels: [], slots: [] };
    if (HP4) {
      // HP4 (server Hp4Game.unlocks): one song per row (slot = id + 1, no pairs), labelled by the disc's
      // own unlock message
      if (type === 1 && !e.slots.includes(id + 1)) e.slots.push(id + 1);
      const so = type === 1 ? SONGS.find(x => x.slot === id + 1) : null;
      const nm = name || (so ? so.name : '');
      if (nm && !e.labels.includes(nm) && !nm.startsWith('Mii BODY')) e.labels.push(nm);
      else if (nm.startsWith('Mii BODY')) e.labels.push('Mii BODY ' + nm.replace(/^Mii BODY\s*/, ''));
    } else if (type === 1) {
      const slot = id + 1, full = slot % 2 ? slot + 1 : slot;
      if (!e.slots.includes(full)) {
        e.slots.push(full);
        const so = SONGS.find(x => (x.full || x.slot) === full || x.slot === slot);
        const nm = so ? so.name : known[full];
        if (nm && !e.labels.includes(nm)) e.labels.push(nm);
      }
    } else if (type === 2 && OUTFIT[id]) e.labels.push(OUTFIT[id]);
    else if (type === 2 && id === 205) e.labels.push(b ? 'Outfit "RENA"' : 'Character "RENA"');
    else if (type === 2 && MII[id]) { const l = MII[id] + '-' + (b + 1); if (!e.labels.some(x => x.endsWith(' ' + l) || x.includes(l))) e.labels.push('Mii BODY ' + l); }
    else if (type === 7) e.labels.push('Mii Character');
    by.set(pts, e);
  }
  const list = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([pts, e]) => {
    const mii = e.labels.filter(l => l.startsWith('Mii BODY ')), other = e.labels.filter(l => !l.startsWith('Mii BODY '));
    const label = other.concat(mii.length ? ['Mii BODY ' + mii.map(l => l.slice(9)).join(', ')] : []).join(' + ') || 'Song';
    return [pts, label, e.slots.length ? e.slots : undefined];
  });
  UNLOCKS = list;
  for (const k of Object.keys(UNLOCK_AT)) delete UNLOCK_AT[k];
  for (const [pts, , slots] of UNLOCKS) for (const sl of slots || []) UNLOCK_AT[sl] = pts;
  // HP4's courses and workouts (types 9 / 10, 0x800fbf14): each opens with the last of its songs
  if (HP4 && DDR2_COURSES && DDR2_COURSES.courses) {
    const add = (lists, names, word) => lists.forEach((sl, c) => {
      const at = courseUnlockAt(sl);
      if (!at) return;
      const label = names && names[c] ? (word === 'COURSE' ? 'Course "' + names[c] + '"' : names[c]) : word + ' ' + (c + 1);
      const u = UNLOCKS.find(x => x[0] === at);
      if (u) u[1] += ' + ' + label; else UNLOCKS.push([at, label, undefined]);
    });
    add(DDR2_COURSES.courses, DDR2_COURSES.names, 'COURSE');
    add(DDR2_COURSES.workouts || [], DDR2_COURSES.workoutNames, 'WORKOUT');
    UNLOCKS.sort((a, b) => a[0] - b[0]);
  }
}
// Player data, like the game's user data: each player has their own DDR points, records and
// play options (speed, style, turn...). Controls, audio offset and screen settings are shared.
// (GAME OVER and MARVELOUS are the whole game's settings in DDR II, not a player's)
const PROFILE_OPTS = ['style', 'diff', 'speed', 'appearance', 'turn', 'freezes', 'colors', 'lastSlot', 'short', 'ngBreaksCombo', 'jump', 'cut', 'guideline', 'evaluation', 'scroll', 'judgePos'];
// DATA: every saved player (save.json). SAVE: the one playing now
let DATA = { profiles: {}, current: null };
let SAVE = { points: 0, records: {} };          // the current player's data
// read save.json from the server
async function loadSave() {
  try {
    const s = await api('/api/save') || {};
    if (s.profiles) DATA = Object.assign({ profiles: {}, current: null }, s);
    else if (s.records || s.points) DATA = { profiles: { PLAYER: { points: s.points || 0, records: s.records || {}, opts: {} } }, current: 'PLAYER' };
  } catch (e) {}
  if (DATA.current && DATA.profiles[DATA.current]) usePlayer(DATA.current, false);
}
// make a saved player the current one (apply: also load their own options)
function usePlayer(name, apply = true) {
  const p = DATA.profiles[name];
  if (!p) return;
  p.points = p.points || 0; p.records = p.records || {}; p.opts = p.opts || {};
  DATA.current = name; SAVE = p;
  if (apply) for (const k of PROFILE_OPTS) if (k in p.opts) S[k] = p.opts[k];
}
// write save.json a moment after the last change
let saveDataTimer = 0;
// AUTO SAVE off (Options > SAVE): records are kept only when SAVE is chosen (force)
function writeSave(force) {
  if (S.autoSave === false && !force) return;
  if (DATA.current && DATA.profiles[DATA.current]) {
    const o = DATA.profiles[DATA.current].opts;
    for (const k of PROFILE_OPTS) if (S[k] !== undefined) o[k] = S[k];
  }
  clearTimeout(saveDataTimer);
  saveDataTimer = setTimeout(() => api('/api/save', DATA).catch(() => {}), 200);
}
function recKey(slot, style, diff, kind) { kind = kind || (HP4 && S.mode === 'board' ? 'board' : typeof CHOREO !== 'undefined' && CHOREO && HP4 ? 'choreo' : 'single'); return `${slot}:${style}${HP4 && kind !== 'single' ? ':' + kind : ''}:${diff}`; }   // (HP4: CHOREOGRAPH's records are its own)
// the saved record for a song on a difficulty and style (or null)
function recordOf(song, diff = S.diff, style = styleNow(), prof = SAVE) { return prof && prof.records ? prof.records[recKey(song.slot, style, diff)] || null : null; }
// is the song still locked (fewer DDR POINTS than its unlock needs; never when UNLOCKS is off)?
function isLocked(song, points = SAVE.points) {
  if (S.unlocks !== 'on') return false;
  const at = UNLOCK_AT[song.full || song.slot];
  return at !== undefined && points < at;
}
// the next goal after this many points: {at, label}
function nextUnlock(points = SAVE.points) {
  const u = UNLOCKS.find(([pts]) => pts > points);
  return u ? { at: u[0], label: u[1] } : null;
}
// what opened up between two point totals (songs that are on the disc, plus the other items by name)
function unlockedBetween(before, after) {
  return UNLOCKS.filter(([pts]) => pts > before && pts <= after)
    .map(([pts, label, slots]) => ({ label, songs: (slots || []).map(sl => SONGS.find(s => (s.full || s.slot) === sl)).filter(Boolean) }));
}

// ask the server: GET a path, or POST it a JSON body; returns the JSON answer
async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.headers.get('Content-Type').includes('json') ? r.json() : r.arrayBuffer();
}
// fetch a file from the server as raw bytes
async function bin(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.arrayBuffer();
}

// ---------------------------------------------------------------- canvas scaling
// 'wide' shows the 16:9 picture (with bars on a 4:3 monitor); '4:3' squeezes it to fill a 4:3 shape
// the way a Wii set to 16:9 looks on a 4:3 TV
function fit() {
  const aspect = S.screen === '4:3' ? 4 / 3 : W / H;
  const h = Math.min(innerHeight, innerWidth / aspect), w = h * aspect;
  cv.style.width = Math.floor(w) + 'px';
  cv.style.height = Math.floor(h) + 'px';
  cv.style.marginTop = Math.floor((innerHeight - h) / 2) + 'px';
}
addEventListener('resize', fit); fit();
// full screen on and off (F11, Alt+F, or the PC SETTINGS row)
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
addEventListener('keydown', e => { if (e.code === 'F11' || e.code === 'KeyF' && e.altKey) { e.preventDefault(); toggleFullscreen(); } });
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); S.showFps = !S.showFps; saveSettings(); } });

// ---------------------------------------------------------------- audio
let actx = null;
// the one Web Audio context, made on the first sound (browsers need a key press first)
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
// decoded sound (decode.js) -> a Web Audio buffer
function toBuffer(dec) {
  const ctx = audio();
  const b = ctx.createBuffer(dec.chans.length, dec.chans[0].length, dec.rate);
  dec.chans.forEach((c, i) => b.copyToChannel(c, i));
  if (dec.loop) b.loopFrom = dec.loopStart / dec.rate;     // looped sound: where its loop starts (s)
  return b;
}
// the sound card's delay in seconds (arrows are shifted by it so they match what you hear)
function outLatency() { return actx ? (actx.outputLatency || actx.baseLatency || 0) : 0; }
// map a performance.now() timestamp to the audio context clock
function ctxTimeAt(perf) {
  if (actx.getOutputTimestamp) {
    const ts = actx.getOutputTimestamp();
    if (ts.performanceTime) return ts.contextTime + (perf - ts.performanceTime) / 1000 + outLatency();
  }
  return actx.currentTime + (perf - performance.now()) / 1000;
}

// an original 256x256 design for a song with no art: colours, rays, rings and a dance-floor grid,
// all picked from the song's name
function genArt(x, name) {
  let h = 2166136261;
  for (const ch of name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  for (let i = 0; i < 4; i++) rnd();                 // stir, so similar names get different colours
  const hue = Math.floor(rnd() * 360), hue2 = (hue + 40 + Math.floor(rnd() * 80)) % 360, style = Math.floor(rnd() * 3);
  const gr = x.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, `hsl(${hue},85%,52%)`); gr.addColorStop(1, `hsl(${hue2},80%,28%)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const cx = 40 + rnd() * 176, cy = 40 + rnd() * 176;
  x.save();
  if (style === 0) {                                  // rays from a point
    const n = 10 + Math.floor(rnd() * 10);
    x.fillStyle = 'rgba(255,255,255,0.13)';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, b = a + Math.PI / n;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 400, cy + Math.sin(a) * 400); x.lineTo(cx + Math.cos(b) * 400, cy + Math.sin(b) * 400); x.fill();
    }
  } else if (style === 1) {                           // a floor grid in perspective
    x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(128 + i * 12, 120); x.lineTo(128 + i * 70, 256); x.stroke(); }
    for (let k = 0; k < 7; k++) { const y = 120 + 136 * Math.pow(k / 6, 1.8); x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
  } else {                                            // stripes
    x.translate(128, 128); x.rotate(rnd() * Math.PI);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = -8; i < 8; i += 2) x.fillRect(i * 24, -260, 24, 520);
  }
  x.restore();
  // rings
  for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 20 + rnd() * 70, 0, Math.PI * 2);
    x.lineWidth = 6 + rnd() * 14; x.strokeStyle = `hsla(${(hue + 180) % 360},90%,70%,0.35)`; x.stroke();
  }
  const sh = x.createRadialGradient(128, 128, 60, 128, 128, 190);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = sh; x.fillRect(0, 0, 256, 256);
}


// ---------------------------------------------------------------- images
const imgCache = new Map();
// custom song picture URL -> its background picture (for banners)
const ART_BG = {};
const ART_GEN = {};             // disc banner URL -> a name to make the tile's own design from (HP2)               // custom song picture URL -> its background picture (for banners)
function texture(kind, idx) {          // kind: jacket | title; idx can also be a picture's URL (custom songs)
  const key = kind + idx;
  if (imgCache.has(key)) return imgCache.get(key);
  const entry = { img: null };
  imgCache.set(key, entry);
  if (idx === null || idx === undefined) { entry.missing = true; return entry; }
  if (typeof idx === 'string' && idx.startsWith('/')) {
    const im = new Image();
    im.onload = () => {        // squared off like the game's jackets
      if (kind === 'raw') { entry.img = im; return; }       // (as it is: Hottest Party 2's name tabs)
      const c = document.createElement('canvas'), x = c.getContext('2d'), s = Math.min(im.width, im.height);
      c.width = c.height = 256;
      if (im.width / im.height > 1.6) {
        // a banner (no jacket): it goes across the middle of the song's background picture
        const banner = () => { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 128 - 128 * im.height / im.width - 6, 256, 256 * im.height / im.width + 12);
          x.drawImage(im, 0, 128 - 128 * im.height / im.width, 256, 256 * im.height / im.width); entry.img = c; };
        x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
        const bgUrl = ART_BG[idx];
        if (bgUrl === idx) {
          // a disc's own banner (Hottest Party): no blown-up copy of itself behind it (the text came out
          // twice); a backdrop in the banner's own colours, the banner across the middle, full width
          // behind it: the banner itself, blown up, heavily blurred and darkened (colours only, no text)
          if (ART_GEN[idx]) genArt(x, ART_GEN[idx]);
          else {
            x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
            x.save(); x.filter = 'blur(14px) brightness(0.55) saturate(1.3)';
            x.drawImage(im, (im.width - im.height) / 2, 0, im.height, im.height, -24, -24, 304, 304);
            x.restore();
          }
          const h = 256 * im.height / im.width, y = 128 - h / 2;
          x.fillStyle = '#000'; x.fillRect(0, y - 4, 256, h + 8);
          x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, y - 3, 256, 1); x.fillRect(0, y + h + 2, 256, 1);
          x.drawImage(im, 0, y, 256, h);
          entry.img = c;
          return;
        }
        if (bgUrl) {
          const bg = new Image();
          bg.onload = () => { const b = Math.min(bg.width, bg.height); x.drawImage(bg, (bg.width - b) / 2, (bg.height - b) / 2, b, b, 0, 0, 256, 256); banner(); };
          bg.onerror = banner; bg.src = bgUrl;
          return;
        }
        banner();
        return;
      }
      x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
      entry.img = c;
    };
    im.onerror = () => { entry.missing = true; };
    im.src = idx;
    return entry;
  }
  bin(`/api/${kind}/${idx}`).then(buf => {
    const t = DDR.decodeTexture(buf);
    const c = document.createElement('canvas');
    c.width = t.w; c.height = t.h;
    c.getContext('2d').putImageData(new ImageData(t.px, t.w, t.h), 0, 0);
    entry.img = c;
  }).catch(() => { entry.missing = true; });
  return entry;
}

// arrow sprites
// arrow colours by rhythm (quarter, eighth, sixteenth, ...), used to tint the game's grey arrows
const TINT = { 4: '#ff3838', 8: '#3c6cff', 16: '#ffd426', 12: '#c048ff', 24: '#ff5ac8', 32: '#2ee070', 0: '#30e0ff', flat: '#ff3838' };
// arrow colours by note length (NOTE colour option): [fill, highlight] for 4th, 8th, 16th ... notes
const NOTE_COLORS = {
  4: ['#ff4040', '#ffd0d0'], 8: ['#3a7bff', '#cfe0ff'], 16: ['#ffd000', '#fff4b0'],
  12: ['#c040ff', '#efd0ff'], 24: ['#ff60c0', '#ffd0ee'], 32: ['#30d060', '#d0ffe0'], 0: ['#40e0ff', '#d0f8ff'],
};
const ROT = [Math.PI / 2, 0, Math.PI, -Math.PI / 2];   // left, down, up, right (sprite points down)
// the outline of one arrow (pointing left) of size s on context c
function arrowPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * 0.46);
  c.lineTo(s * 0.46, 0);
  c.lineTo(s * 0.2, 0);
  c.lineTo(s * 0.2, -s * 0.44);
  c.lineTo(-s * 0.2, -s * 0.44);
  c.lineTo(-s * 0.2, 0);
  c.lineTo(-s * 0.46, 0);
  c.closePath();
}
// arrows already drawn, by kind and size
const spriteCache = new Map();
// one arrow picture (a small canvas) at a size, cached. kind: 'receptor', 'flash', or a note length (4, 8, 16 ...)
function sprite(kind, size) {
  const key = kind + size;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  if (kind === 'receptor' || kind === 'flash') {
    arrowPath(x, size * 0.92);
    x.lineWidth = size * 0.07;
    x.strokeStyle = kind === 'flash' ? '#ffffff' : '#9aa4b8';
    x.fillStyle = kind === 'flash' ? 'rgba(255,255,255,0.55)' : 'rgba(40,50,70,0.55)';
    x.fill(); x.stroke();
  } else {
    const [main, light] = NOTE_COLORS[kind] || NOTE_COLORS[0];
    const gr = x.createLinearGradient(0, -size / 2, 0, size / 2);
    gr.addColorStop(0, light); gr.addColorStop(0.55, main); gr.addColorStop(1, main);
    arrowPath(x, size * 0.92);
    x.fillStyle = gr; x.fill();
    x.lineWidth = size * 0.06; x.strokeStyle = '#ffffff'; x.stroke();
    x.lineWidth = size * 0.025; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.stroke();
  }
  spriteCache.set(key, c);
  return c;
}
// a step's note length from its place in the measure (1024 ticks a beat): 4, 8, 16 ...
function quant(off) {
  const r = ((off % 1024) + 1024) % 1024;
  if (r === 0) return 4;
  if (r % 512 === 0) return 8;
  if (r % 256 === 0) return 16;
  if (r % 128 === 0) return 32;
  if (Math.abs(r * 3 % 1024) < 2 || Math.abs(r * 3 % 1024 - 1024) < 2) return 12;
  if (Math.abs(r * 6 % 1024) < 3 || Math.abs(r * 6 % 1024 - 1024) < 3) return 24;
  return 0;
}

// ---------------------------------------------------------------- drawing helpers
function text(s, x, y, size = 24, color = '#fff', align = 'left', weight = 'bold') {
  g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(2, size / 8); g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
}
// Text in the game's own font (font/font_us.bin; A.font once A.loadIntro has run). size = the letters'
// cell height on screen; letters a little apart, like the game's. Falls back to text() without the font.
// sp = the gap after each letter, in the font's own pixels (24 to a line)
function gfontWidth(s, size, sp = 2) {
  const F = A.font; if (!F) return 0;
  const k = size / 24; let w = 0;
  for (const ch of s) { const gl = F.glyphs[F.alias[ch] || ch]; w += (gl ? gl.w + sp : 6 + sp) * k; }
  return w;
}
// text in the game's own font (the disc's letter pictures): s at (x, y), size px tall, tinted
function gtext(s, x, y, size = 24, color = '#fff', align = 'left', sp = 2, pitch = 1.25) {
  const F = A.font;
  if (!F) return text(s, x, y, size * 0.85, color, align);
  let atlas = F.atlas;
  if (color && color !== '#fff' && color !== '#ffffff') atlas = F.tints[color] || (F.tints[color] = tintImg(F.atlas, color));
  const k = size / 24;
  String(s).split('\n').forEach((ln, j) => {
    const w = gfontWidth(ln, size, sp);
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const cy = y - size / 2 + j * size * pitch;
    for (const ch of ln) {
      const gl = F.glyphs[F.alias[ch] || ch];
      if (gl) g.drawImage(atlas, gl.sx, gl.sy, gl.w, 24, cx, cy, gl.w * k, size);
      cx += (gl ? gl.w + sp : 6 + sp) * k;
    }
  });
}
// the biggest size (up to `size`) at which `s` fits in `maxW`
function fitSize(s, size, maxW, weight = 'bold') {
  for (; size > 8; size--) { g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`; if (g.measureText(s).width <= maxW) break; }
  return size;
}
// the game's blue window panel (or a plain dark box until the pictures are in)
function panel(x, y, w, h, a = 0.55) {
  if (A.img.bluePanel) { g.drawImage(A.img.bluePanel, x, y, w, h); return; }
  g.fillStyle = `rgba(10,20,45,${a})`;
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(120,170,255,0.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
// the song select / options look: light blue with white circles, rings and stripes (the game builds it the same way)
const BG_SHAPES = [
  [0, 120, 250, 330, 0.30], [1, 300, 120, 260, 0.45], [2, 1010, 80, 300, 0.40], [0, 1180, 330, 280, 0.25],
  [3, 820, 560, 300, 0.22], [1, 520, 600, 380, 0.30], [2, 120, 620, 220, 0.35], [0, 700, 200, 180, 0.22],
  [1, 1220, 640, 240, 0.40], [3, 380, 330, 200, 0.18],
];
// Behind the menus: big see-through blue silhouettes dancing (our own dancer, the disc's moves)
const MenuDancers = {
  state: 'idle', ch: null, tint: null,
  load() {
    if (this.state !== 'idle' || !window.Dancer3D || !SONGS.length) return;
    this.state = 'loading';
    const s = SONGS.find(x => !x.custom) || SONGS[0];
    api('/api/dance/' + danceNo(s)).then(d => { this.ch = d ? Dancer3D.prepare(d, 7) : null; this.state = this.ch ? 'ready' : 'none'; })
      .catch(() => { this.state = 'none'; });
  },
  draw(t, spots) {
    if (S.dancer === false) return;
    this.load();
    if (this.state !== 'ready') return;
    for (const [cx, bottom, h, a, lag, flip] of spots) {
      let cv;
      try { cv = Dancer3D.render(this.ch, 8 + (t * 2 + lag) % 120, 1e6, { builtIn: true }); } catch (e) { this.state = 'none'; return; }
      if (!cv) return;
      if (!this.tint) this.tint = document.createElement('canvas');
      const c = this.tint; c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d');
      x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#1b56b4'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over';
      const w = h * cv.width / cv.height;
      g.save(); g.globalAlpha = a; g.translate(cx, bottom - h);
      if (flip) { g.scale(-1, 1); }
      g.drawImage(c, -w / 2, 0, w, h); g.restore();
    }
  },
};
// Hottest Party's own menu background (the gridded sphere and turning circles from its disc),
// used on song select inside the HOTTEST PARTY folder and around a Hottest Party song
let HP_LOOK = false;
// loads and draws Hottest Party's menu background
const HPMenu = {
  st: null, busy: false, failed: false,
  get() {
    if (this.st || this.busy || this.failed || !window.HPStage) return this.st;
    this.busy = true;
    fetch('/api/hpmenu').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { this.failed = true; return; }
      const st = HPStage.fromData(d);
      st.fixedCam = { eye: [0, 0, 1250], at: [0, 0, 0], roll: 0, fov: 34, near: 10, far: 100000 };
      st.aspect = 4 / 3; st.layered = true;
      this.st = st;
    }).catch(() => { this.failed = true; }).finally(() => { this.busy = false; });
    return null;
  },
  draw() {
    const st = this.get();
    if (!st) return false;
    try { g.drawImage(st.render(performance.now() / 1000 * 60, 0, 0), 0, 0, W, H); return true; }
    catch (e) { console.error('hp menu', e); this.failed = true; this.st = null; return false; }
  },
};
// the moving background behind every menu (which one depends on the game and the screen)
function menuBackground(t) {
  if ((HP_LOOK && (scene === Select || scene === Loading || scene === Results || scene === Explain) ||
       look('menu') === 'hp' && scene !== Players && scene !== Title && scene !== Setup && scene !== GameSel ||
       scene === GameSel && GameSel.games[GameSel.i] && ['hp', 'hp2', 'hp3'].includes(GameSel.games[GameSel.i].id)) && HPMenu.draw()) return;
  // (DDR II too: its select_cmn.bin holds the same 3D scene - loader 0x800982a8 into the menu manager +0x28168;
  // Dolphin memory copy of DDR II's results screen: camera (400, 0, 0) -> (400, 0, -500), page 4)
  if (HP4BG.draw()) return;
  if (HP4 && A.img.bgGrad) return hp4MenuBackground(t);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#9eeafc'); gr.addColorStop(0.55, '#7fd8f6'); gr.addColorStop(1, '#5cc4ee');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // soft diagonal light bands in the lower half
  g.save();
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let k = 0; k < 7; k++) {
    const x = ((k * 230 + t * 20) % (W + 400)) - 200;
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + 60, H); g.lineTo(x + 360, 380); g.lineTo(x + 300, 380); g.fill();
  }
  g.restore();
  const shapes = A.img.bgShapes || [];
  BG_SHAPES.forEach(([k, x, y, size, a], i) => {
    const im = shapes[k];
    const dx = Math.sin(t * 0.3 + i) * 12, dy = Math.cos(t * 0.25 + i * 1.7) * 10;
    if (im) { g.globalAlpha = a; g.drawImage(im, x + dx - size / 2, y + dy - size / 2, size, size); g.globalAlpha = 1; }
    else {
      g.globalAlpha = a; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = size * 0.12;
      g.beginPath(); g.arc(x + dx, y + dy, size * 0.4, 0, Math.PI * 2);
      if (k === 0) g.fill(); else g.stroke();
      g.globalAlpha = 1;
    }
  });
}

// HP4's menu background: a 3D scene (select_cmn.bin /0, the menu manager +0x23794 - 0x80086020): models /0/0 (with
// its 1800-frame animation /0/2) and /0/3, seen by BG_Camera01 - eye (x, 0, 0) looking at (x, 0, -500), field of
// view 45 (34.52 high in 16:9), near 1, far 10000 (Dolphin memory copy of the results screen: x = 100, page 1).
// The camera sits at x = 100 x page; 0x80086c08 (next) plays move 2p (100p -> 100p + 100, 90 frames) and makes the
// page (p + 1) mod 5, 0x80086d6c (back) makes it (p + 4) mod 5 and plays move 2p + 1 (100p + 100 -> 100p, 60 frames);
// x = 500 looks the same as 0. The game calls them when its menu screens go forward / back - CselMode on leaving
// forward (0x8006727c), and CselPlayer, CselStyle, CselOption, CselDance, CselRecord ... ; here: MODE SELECT forward
// and back to it (the other screens' calls aren't wired up yet).
const HP4BG = {
  st: null, busy: false, failed: false, page: 0, move: null, moves: null,
  get() {
    if (this.st || this.busy || this.failed || !window.HPStage) return this.st;
    this.busy = true;
    fetch('/api/hp4menubg').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { this.failed = true; return; }
      this.moves = d.moves || [];
      this.st = HPStage.fromData(d);
    }).catch(() => { this.failed = true; }).finally(() => { this.busy = false; });
    return null;
  },
  next() { this.move = { i: this.page * 2, t0: performance.now() }; this.page = (this.page + 1) % 5; },
  back() { this.page = (this.page + 4) % 5; this.move = { i: this.page * 2 + 1, t0: performance.now() }; },
  camX() {
    const M = this.move, mv = M && this.moves && this.moves[M.i];
    if (!mv || !mv.x.length) return this.page * 100;
    const f = (performance.now() - M.t0) / 1000 * 60, k = mv.x;
    if (f >= k[k.length - 1][0]) { this.move = null; return this.page * 100; }
    let j = 0; while (j < k.length - 2 && k[j + 1][0] <= f) j++;
    const a = k[j], b = k[j + 1], u = b[0] > a[0] ? (f - a[0]) / (b[0] - a[0]) : 0;
    return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, u));
  },
  draw() {
    const st = this.get();
    if (!st) return false;
    const x = this.camX();
    st.fixedCam = { eye: [x, 0, 0], at: [x, 0, -500], roll: 0, fov: 2 * Math.atan(Math.tan(22.5 * Math.PI / 180) * 0.75) * 180 / Math.PI, near: 1, far: 10000 };
    try { g.drawImage(st.render(performance.now() / 1000 * 60, 0, 0), 0, 0, W, H); return true; }
    catch (e) { console.error('hp4 menu background', e); this.failed = true; this.st = null; return false; }
  },
};
// HP4's menu backdrop (Dolphin footage): pink, its pieces from select_cmn /0/1 (the white-to-pink strip, the
// dotted clouds, the arrow rings) on the upper part, and a floor below the horizon (about half way) that
// mirrors it, deepening to strong pink at the bottom. (Where the game puts each piece is set in its code and
// isn't traced: they keep DDR II PC's places.)
let HP4_BG_CV = null;
// HP4's menu background
function hp4MenuBackground(t) {
  const hz = Math.round(H * 0.48);
  if (!HP4_BG_CV) { HP4_BG_CV = document.createElement('canvas'); HP4_BG_CV.width = W; HP4_BG_CV.height = hz; }
  const c = HP4_BG_CV, q = c.getContext('2d');
  q.clearRect(0, 0, W, hz);
  q.drawImage(A.img.bgGrad, 0, 0, W, hz * 1.6);
  const shapes = A.img.bgShapes || [];
  BG_SHAPES.forEach(([k, x, y, size, a], i) => {
    const im = shapes[k];
    if (!im || k === 1 || k === 3) return;          // (HP4's: only its dotted clouds and arrow rings)
    const dx = Math.sin(t * 0.3 + i) * 12, dy = Math.cos(t * 0.25 + i * 1.7) * 10, yy = y * hz / H * 1.1;
    q.globalAlpha = Math.min(1, a * 1.8); q.drawImage(im, x + dx - size / 2, yy + dy - size / 2, size, size); q.globalAlpha = 1;
  });
  g.drawImage(c, 0, 0);
  // the floor: the upper part upside down, fading, over a pink that deepens to the bottom
  g.save(); g.translate(0, hz * 2); g.scale(1, -1); g.globalAlpha = 0.55; g.drawImage(c, 0, 0); g.restore();
  const fl = g.createLinearGradient(0, hz, 0, H);
  fl.addColorStop(0, 'rgba(255,150,210,0.55)'); fl.addColorStop(1, 'rgba(255,40,160,0.92)');
  g.fillStyle = fl; g.fillRect(0, hz, W, H - hz);
}
// a picture filled with one colour through its own alpha (cached)
const TINT_COPIES = new Map();
// (see above) the picture im filled with colour col
function tintCopy(im, col) {
  let per = TINT_COPIES.get(im); if (!per) TINT_COPIES.set(im, per = new Map());
  if (per.has(col)) return per.get(col);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const q = c.getContext('2d');
  q.drawImage(im, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, c.width, c.height);
  per.set(col, c); return c;
}
// draw an image centred at (x, y), scaled
function blit(img, x, y, scale = 1, alpha = 1) {
  if (!img) return false;
  g.globalAlpha = alpha;
  g.drawImage(img, x - img.width * scale / 2, y - img.height * scale / 2, img.width * scale, img.height * scale);
  g.globalAlpha = 1;
  return true;
}
// a number drawn with one of the game's digit sets (array of 10 images)
function digits(set, str, x, y, h, align = 'right', gap = -0.12) {
  if (!set || !set[0]) return false;
  const imgs = [...str].map(ch => set[+ch]);
  if (imgs.some(i => !i)) return false;
  const ws = imgs.map(i => i.width * h / i.height), total = ws.reduce((a, b) => a + b, 0) + gap * h * (imgs.length - 1);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  imgs.forEach((im, k) => { g.drawImage(im, cx, y - h / 2, ws[k], h); cx += ws[k] + gap * h; });
  return true;
}
// The announcer on the menus (main.dol 0x800cc894 says a line now; 0x800cc9a4 queues one to say after a
// pause - the card names on SELECT MODE / SELECT STYLE, so a quick scroll says nothing until you stop)
const VOICE = { pending: null };
// play one of the announcer's lines (the last one is cut off first)
function voice(name) {
  if (!A.ready || S.voice === false) return null;
  const h = { srcs: [], t0: performance.now() }; A.playSfx(name, 1, { handle: h }); return h;
}
function voiceBusy(h) {           // still talking (or still loading the line)
  if (!h) return false;
  if (h.end === undefined) return performance.now() - h.t0 < 1500;
  return audio().currentTime < h.end;
}
function voiceLater(name, delay = 1.0) {   // (the same line already queued keeps its time, like the game)
  if (VOICE.pending && VOICE.pending.name === name && VOICE.pending.scene === scene) return;
  VOICE.pending = name ? { name, at: performance.now() + delay * 1000, scene } : null;
}
// start the announcer line that was waiting for its sound to load
function voiceTick() {
  const v = VOICE.pending; if (!v) return;
  if (v.scene !== scene) { VOICE.pending = null; return; }
  if (performance.now() >= v.at) { VOICE.pending = null; voice(v.name); }
}
// play a sound effect by its name in the game's sound archive (SE_..., VO_...)
function sfx(name, gain) {
  if (!A.ready || (name.startsWith('VO_') && S.voice === false) || (name.startsWith('SE_') && S.menuSounds === false)) return;
  A.playSfx(name, gain);
}

// ---------------------------------------------------------------- scenes
let scene = null;
// change screen, letting the old screen play its exit animation first
function go(s) {
  // (a menu screen with the game's exit animation keeps showing while it plays; the change comes after)
  if (!LEAVE && scene && s !== scene && animatedScene(scene) && CAE.files.sel && S.menuAnim !== false) {
    LEAVE = { t0: performance.now(), next: s, from: scene, ok: LAST_ACTION === 'START' };
    return;
  }
  goNow(s);
}
// change screen at once: leave() the old scene, enter() the new one, start its music
function goNow(s) {
  LEAVE = null;
  // (HP4's menu background slides a page on: MODE SELECT forward, and back to it)
  if (HP4 && s !== scene) {
    if (scene === ModeSel && (s === PlayerNum || s === Players)) HP4BG.next();
    else if (s === ModeSel && (scene === PlayerNum || scene === Players)) HP4BG.back();
  }
  // (DDR II: each menu screen slides it on going forward and back going back (0x80098dfc / 0x80098eac, called by
  // the screens' own code). SELECT MODE -> NUMBER OF PLAYERS -> RECORD DATA -> STYLE -> MUSIC is four steps, which
  // puts the results screen on page 4, as in the Dolphin memory copy)
  if (!HP4 && s !== scene) {
    const CH = [ModeSel, PlayerNum, Players, Style, Select], a = CH.indexOf(scene), b = CH.indexOf(s);
    if (a >= 0 && b >= 0) { if (b > a) for (let k = a; k < b; k++) HP4BG.next(); else for (let k = b; k < a; k++) HP4BG.back(); }
  }
  if (scene && scene.leave) scene.leave();
  scene = s; SCENE_T0 = performance.now();
  if (s !== Select && s !== Loading && s !== Play && s !== Results && s !== Explain && s !== Points) HP_LOOK = hpLike() && s !== Players && s !== Title;
  if (s.enter) s.enter();
  Bgm.want(s.bgm || null);
}
// menu music (the game's MU_BGM_FREE loop on menu screens; song select uses the previews like the game)
const Bgm = {
  cur: null, src: null, gain: null, cache: new Map(),
  async want(name) {
    if (S.menuMusic === false) name = null;
    // Hottest Party's own menu music (and its results music)
    if (name && look('menu') === 'hp' && scene !== Players && scene !== Title && scene !== Setup) name = scene === Results ? 'HP009' : 'HP006';
    if (name === this.cur) return;
    this.cur = name;
    if (this.src) { const s = this.src, gn = this.gain; try { gn.gain.setTargetAtTime(0, actx.currentTime, 0.15); s.stop(actx.currentTime + 0.8); } catch (e) {} this.src = null; }
    if (!name || !actx) return;
    try {
      let buf = this.cache.get(name);
      if (!buf) { buf = toBuffer(DDR.decodeBRSTM(await bin(name.startsWith('HP') ? '/api/hpbgm/' + name.slice(2) : '/api/bgm/' + name))); this.cache.set(name, buf); }
      if (this.cur !== name || this.src) return;
      const src = actx.createBufferSource(), gn = actx.createGain();
      src.buffer = buf; src.loop = true;
      gn.gain.setValueAtTime(0, actx.currentTime); gn.gain.linearRampToValueAtTime(0.55, actx.currentTime + 0.6);
      src.connect(gn).connect(actx.destination); src.start();
      this.src = src; this.gain = gn;
    } catch (e) { /* no music */ }
  },
};

input.on((action, pressed, t, menuKey) => {
  if (LEAVE) return;                                // (no input while a screen plays its exit)
  if (pressed) LAST_ACTION = action;
  if (typeof YNASK !== 'undefined' && YNASK) { if (pressed) ynInput(action); return; }      // (a YES / NO question over the screen)
  if (typeof BTNASK !== 'undefined' && BTNASK) { if (pressed) btnInput(action); return; }   // (a window of buttons over the screen)
  if (typeof MSGASK !== 'undefined' && MSGASK) { if (pressed) msgInput(action); return; }
  if (scene && scene.input) scene.input(action, pressed, t, menuKey);
});
addEventListener('keydown', e => { if (scene && scene.key) scene.key(e); });

// SONGS: every song on the list. CUSTOM_FOLDERS: the names of your custom song folders
let SONGS = [];
let CUSTOM_FOLDERS = [];
// the game's songs, then your custom songs (Custom Songs folder), each marked with its folder
// DDR II's own unlock table, read once the songs are in (their names label the unlocks)
let DISC_UNLOCKS = null;
// read DDR II's unlock table from the disc and build UNLOCKS / UNLOCK_AT from it
async function loadDiscUnlocks() {
  try { if (!DISC_UNLOCKS) DISC_UNLOCKS = (await api('/api/ddr2unlocks')) || []; } catch (e) { DISC_UNLOCKS = []; }
  if (HP4) await loadDdr2Courses();
  applyDiscUnlocks(DISC_UNLOCKS);
  try { if (!CTASK) CTASK = (await api('/api/ddr2tasks')) || null; } catch (e) { CTASK = null; }
}

// ---- DDR II's challenge task (DDR2_SPEC.md "Challenge task"; main.dol 0x8011f920 / 0x8011fa98 and
// 0x80120334-0x801206b8, tables at 0x80291bc8). Each player keeps a task position: six indexes into the
// tables (task 0-19, song, difficulty, gauge, combo, rank). The tables used depend on the DDR points
// stored at the last step: up to 899,999, up to 1,679,999, or more. After each rewarded play the task
// steps on (not the very first time), every index by one; a specified-song task also steps its song on
// to the next one that is unlocked.
let CTASK = null;
// which third of the challenge-task list a DDR POINTS total is in (0, 1 or 2)
function ctRange(pts) {
  const [a, b] = (CTASK && CTASK.ranges) || [899999, 1679999];     // (HP4: 449,999 / 899,999)
  return pts <= a ? 0 : pts <= b ? 1 : 2;
}
// a player's challenge-task state (made the first time it's needed)
function ctState(prof) {
  if (!prof.ctask) prof.ctask = { on: 0, pts: 0, i: [0, Math.floor(wiiRandom() * 255), 0, 0, 0, 0] };
  return prof.ctask;
}
// the task now: { any, songId, rows: [{label, pts, test(r)}] } (null without the disc's tables)
function ctTask(prof) {
  const T = CTASK;
  if (!T || !prof) return null;
  const st = ctState(prof), r = ctRange(st.pts || 0), [i24, i25, i26, i27, i28, i29] = st.i;
  const any = T.kind[i24 % T.kind.length] !== 0;
  const songs = T.songs[r];
  const songId = any ? -1 : songs[i25 % songs.length];
  const dl = T.diff[r][i26 % T.diff[r].length], gv = T.gauge[r][i27 % T.gauge[r].length];
  const cv = T.combo[r][i28 % T.combo[r].length], rv = T.rank[r][i29 % T.rank[r].length];
  const DN = ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'], RN = ['', '', 'C', 'B', 'A', 'AA', 'AAA'];
  // the bonuses: DDR II's reader (0x80120334-0x801206b8), or the disc's own (HP4: T.pts, 0x8010e6fc-0x8010eb9c)
  const P = T.pts || { diff: [500, 750, 1000, 1500, 2000], gauge: { 60: 250, 75: 500, 90: 750, 100: 1000 },
                       combo: { 50: 500, 100: 750, 200: 1000, '-1': 1500 }, rank: { 2: 250, 3: 500, 4: 750, 5: 1000 } };
  const rows = [
    [dl >= 4 ? 'Clear on Challenge' : `Clear on ${DN[dl]} or higher`, P.diff[dl] || 0, x => x.level >= dl],
    [gv >= 100 ? 'Clear with the Dance Gauge at 100%' : `Clear with the Dance Gauge at ${gv}% or higher`,
     P.gauge[gv] || 0, x => x.gauge >= gv],
    [cv < 0 ? 'Clear with a FULL COMBO' : `Clear with a MAX COMBO of ${cv} or higher`,
     P.combo[cv < 0 ? -1 : cv] || 0, x => cv < 0 ? x.fc : x.maxCombo >= cv],
    [`Clear with RANK ${RN[rv]} or higher`, P.rank[rv] || 0, x => x.rank >= rv],
  ].map(([label, pts, test]) => ({ label, pts, test }));
  return { any, songId, rows, dl, gv, cv, rv };
}
// does a played song count for the task? (0x80120774: ANY SONG, or the song or its pair - id ^ 1)
function ctSongOk(task, slot) {
  if (task.any) return true;
  const id = slot - 1;
  if (CTASK && CTASK.pair === false) return id === task.songId;     // (HP4 0x8010e804: the very song)
  return id === task.songId || id === (task.songId % 2 ? task.songId - 1 : task.songId + 1);
}
// 0x8011fa98: step on after a rewarded play (pts = the DDR points before this play's)
function ctStep(prof, pts, unlockPts = pts) {
  const T = CTASK;
  if (!T) return;
  const st = ctState(prof), inc = st.on ? 1 : 0, r = ctRange(pts);
  st.on = 1; st.pts = pts;
  const n = [T.kind.length, 0, T.diff[r].length, T.gauge[r].length, T.combo[r].length, T.rank[r].length];
  for (const k of [0, 2, 3, 4, 5]) st.i[k] = (st.i[k] + inc) % n[k];
  if (T.kind[st.i[0]] !== 0 || !inc) return;
  // a specified song: the next one in this range's list that is unlocked, else (none left) the first
  // range's list
  const unl = id => { const sg = songForSlot(id + 1); return !!sg && !isLocked(sg, unlockPts); };
  const L = T.songs[r];
  for (let k = 0; k < L.length; k++) { st.i[1] = (st.i[1] + 1) % L.length; if (unl(L[st.i[1]])) return; }
  const L0 = T.songs[0];
  for (let k = 0; k < 256; k++) { st.i[1] = (st.i[1] + 1) % L0.length; if (unl(L0[st.i[1]])) return; }
}
// load the song list from the server: the game's songs, other discs' songs, then custom songs
async function loadSongs() {
  const game = await api('/api/songs');
  for (const s of game) if (s.disc && s.jacket) ART_BG[s.jacket] = s.jacket;     // a disc's banner, over a blow-up of itself
  // Hottest Party 2 has no song art on the disc (only a name tab), so its tiles get a design of their
  // own, made up from the song's name: the same song always gets the same one
  // (the song's picture comes from select_cmn.bin; if that can't be read, the tile gets a design of its own)
  for (const s of game) if (s.disc === 'hp2' && s.jacket && !s.jacket.startsWith('/api/hp2art/')) ART_GEN[s.jacket] = s.name || String(s.slot);
  let extra = [];
  try {
    const c = await api('/api/custom/songs');
    CUSTOM_FOLDERS = c.folders || [];
    for (const cs of c.songs || []) if (cs.jacket && cs.artBg) ART_BG[cs.jacket] = cs.artBg;
    extra = (c.songs || []).sort((a, b) => CUSTOM_FOLDERS.indexOf(a.folder) - CUSTOM_FOLDERS.indexOf(b.folder) || a.name.localeCompare(b.name));
  } catch (e) { CUSTOM_FOLDERS = []; }
  return game.concat(extra);
}
// which section of the song list a song is in: the game's songs, Replicant D-action, or a custom folder
// the RANDOM entry at the start of the song list: Enter picks a song for you
// MY CHARACTER (the Wii's song select: COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM, then the
// songs): the dancer picker, drawn here with the dancers' names in black boxes
// Their pictures are the disc's own tiles in comAF's jacket sheet (/9): 202 COURSE MUSIC, 204 RANDOM,
// 205 FAVORITE MUSIC, 206 OPTIONS, 267 MY CHARACTER (loaded from your disc like the song jackets)
const sysTile = (special, name, jk) => ({ folderTile: true, special, folder: name, slot: special, name, artist: '', count: 0, jk,
  bpm: ['---', '---'], length: 0, single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null });
// the tiles on the song list that aren't songs: MY CHARACTER, OPTIONS, COURSE MUSIC, FAVORITE MUSIC
const MYCHAR_TILE = Object.assign(sysTile('mychar', 'MY CHARACTER', 267), { myChar: true });
// the last tile of DDR II's song list (main.dol 0x80080a10 always ends it with 0xcf): MAX COMBO CHALLENGE.
// A on it opens the challenge window with the best total of the record style (no Start!! / End!! word);
// the Wii's 1 button cycles that style NORMAL / FRIENDSHIP / SYNC / DOUBLE (song select +0x2024, 0x8007abc8).
const MCC_TILE = sysTile('mcc', 'MAX COMBO CHALLENGE', 207);
// HP4's hand marker layers (0x8025cac8 .. 0x8025d188, 72 bytes each): [sheet, u, v, w, h, pivot x, pivot y,
// offset x, offset y, slot, parent (-1 = the marker), flags (2 animation offset, 8 animation scale, 0x20 / 0x40
// turned by this / the other hand's direction), condition on the pose's arm bits]
const HP4_HAND_LAYERS = {
  swing: [[7, 64, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0x28, 0]], swing8: [[7, 128, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0x28, 0]],
  thrust: [[7, 0, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0x2a, 0]],
  punchDir: [[28, 0, 0, 64, 64, 36, 32, 0, 0, 0, -1, 0x22, 0], [7, 192, 0, 32, 64, 2, 24, 0, 0, 1, 0, 8, 0]],
  punchL: [[30, 0, 0, 128, 64, 64, 32, 0, 0, 0, -1, 0xb, 0]], punchR: [[32, 0, 0, 128, 64, 64, 32, 0, 0, 0, -1, 0xb, 0]],
  poseL: [[18, 0, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0, 0], [24, 0, 0, 32, 64, 16, 33, -17, 0, 1, 0, 0x20, 1],
          [26, 0, 0, 32, 32, 17, 29, -17, 0, 1, 0, 0x20, 2], [26, 32, 0, -32, 32, 15, 29, -17, 0, 1, 0, 0x20, 4]],
  poseR: [[20, 0, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0, 0], [24, 0, 0, 32, 64, 17, 29, 16, 0, 1, 0, 0x20, 0x10000],
          [26, 32, 0, -32, 32, 15, 29, 16, 0, 1, 0, 0x20, 0x20000], [26, 0, 0, 32, 32, 17, 29, 16, 0, 1, 0, 0x20, 0x40000]],
  poseBoth: [[22, 0, 0, 64, 64, 32, 32, 0, 0, 0, -1, 0, 0], [24, 0, 0, 32, 64, 16, 33, -17, 0, 1, 0, 0x20, 1],
          [26, 0, 0, 32, 32, 17, 29, -17, 0, 1, 0, 0x20, 2], [26, 32, 0, -32, 32, 15, 29, -17, 0, 1, 0, 0x20, 4],
          [24, 0, 0, 32, 64, 16, 33, 16, 0, 2, 0, 0x40, 0x10000], [26, 32, 0, -32, 32, 15, 29, 16, 0, 2, 0, 0x40, 0x20000],
          [26, 0, 0, 32, 32, 17, 29, 16, 0, 2, 0, 0x40, 0x40000]],
};
// HP4's own tiles (CselMusic; their pictures are HP4's comAF jacket sheet cells = the tile ids): after the
// songs 0x84 RECORDS, 0x5b OPTIONS, 0x57 COURSE MUSIC, 0x56 DANCE STAGE, 0x98 MY DANCERS (0x800724c4; 0x83
// CHALLENGE TASK first while the DDR points are under 10,000,000: 0x800f00d0 -> 0x800f9f68, the points meter
// 0x800f9ea0 hides itself and marks 'full' at 10,000,000; A on it opens the task window, +0x1278 = 1). COURSE MUSIC (0x800728f8) lists the
// courses (cells 0x6f + n, your ORDER courses 0x8b + k) then RECORDS, OPTIONS, 0x5d ORDER EDIT, 0x58 FREE
// MUSIC (back to the songs), DANCE STAGE. A (0x8006c6cc): RECORDS -> exit 6 (SELECT RECORD), OPTIONS -> 2,
// DANCE STAGE -> 3, MY DANCERS -> 4, COURSE MUSIC -> list 4, FREE MUSIC -> list 0, ORDER EDIT -> list 1.
const HP4T = {
  records: sysTile('records', 'RECORDS', 132), options: sysTile('options', 'OPTIONS', 91), course: sysTile('course', 'COURSE MUSIC', 87),
  stage: sysTile('stage', 'DANCE STAGE', 86), dancers: Object.assign(sysTile('mychar', 'MY DANCERS', 152), { myChar: true }),
  orderEdit: sysTile('orderedit', 'ORDER EDIT', 93), free: sysTile('free', 'FREE MUSIC', 88),
  ctask: sysTile('ctask', 'CHALLENGE TASK', 131),
};
const OPTIONS_TILE = sysTile('options', 'OPTIONS', 206), COURSE_TILE = sysTile('course', 'COURSE MUSIC', 202), FAV_TILE = sysTile('fav', 'FAVORITE MUSIC', 205);
// the RANDOM tile
const RANDOM_SONG = { random: true, jk: 204, slot: 'random', name: 'RANDOM', artist: '', bpm: ['???', '???'], length: 0,
  single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null };
// the section of the song list a tile belongs to (for jumping between sections)
function sectionOf(song) { return !song ? '' : song.random ? 'random' : song.folderTile ? 'folders' : song.custom || song.disc ? 'folder:' + song.folder : rdaIndex(song) >= 0 ? 'rda' : 'game'; }
// the dance number (1-119) a song uses: its own slot, or one picked from the slot for custom / other-disc songs
function danceNo(song) { return song.custom ? parseInt(song.slot.slice(1, 7), 16) % 119 + 1 : song.disc ? (song.slot * 7) % 119 + 1 : song.slot; }
// difficulties: [the game's id, name, colour], easiest first
const DIFFS = [[4, 'BEGINNER', '#6cf'], [1, 'BASIC', '#fd4'], [2, 'DIFFICULT', '#f55'], [3, 'EXPERT', '#4e6'], [6, 'CHALLENGE', '#c6f']];
// Player 2 (VERSUS): joins on song select. null = one player. {name: their user data or null for a guest, diff}
let P2 = null;
// the grey meter panel (METER_FM_US.bin /0/4 #5) tinted for player 3 (green) / 4 (yellow)
const TINTED = {};
// (see above) the meter panel tinted for player idx
function tintedPanel(idx) {
  const base = A.img.meterPanels && A.img.meterPanels[5];
  if (!base) return null;
  if (!TINTED[idx]) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = idx === 2 ? '#20e040' : '#ffe020'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(base, 0, 0);
    TINTED[idx] = c;
  }
  return TINTED[idx];
}
// 3 / 4 players: the game's own meter layout (METER_MULTI_US.bin's CAE block for 3 or 4 players). Each part's
// first frame gives its place (x, y), pivot, scale and turn. Mapping to the 1280 x 720 screen, checked against
// Wii screenshots of both: each player's panel (1p_bar) sits 2 screen pixels a unit from the middle (520), and
// that player's other parts keep their distance from the panel at 1.5x, like y and the pictures.
// The fields (dummy01 / @dummy) sit on a 0-640 strip: 3 players at 110 / 320 / 530, 4 players at 93 / 244 / 397 / 547.
// HP4 3 / 4 players: the board behind each field (Dolphin FIFO log of a 4-player song, 2026-11-17). The game
// draws GAME_CMN_US.bin /0/8/5's layout once per player, its x scaled 0.55 about the player's middle (4 players:
// -303.167 / -101.833 / 101.833 / 302.167 from the middle of the 853.3-unit-wide screen): back_board_whit (32 x 64,
// pivot 16 / 32, scale 8 x 7.5 -> the full height, opacity 153) with its top corners and bottom corners given the
// player's colours, times the picture (white, fading out at the bottom); then back_board_line (16 x 16, pivot 8 / 8,
// scale y 30) at x -128 / 128 (scale x 1) and -64 / 0 / 64 (scale x 0.5). Alpha blended, no depth.
// 3 players (FIFO log of Free, 3 players): x scaled 0.7, middles -280.167 / -0.167 / 279.5, the same colours.
// It isn't drawn before HERE WE GO: it starts with HERE WE GO's first frame (fifo_3p_go2.dff frame 65) and plays
// its second track - opacity 153 x n / 10 (lines 255 x n / 10), n = 1..10, one step every 1/30 s.
const MULTI_BOARD_C4 = [-303.167, -101.833, 101.833, 302.167], MULTI_BOARD_C3 = [-280.167, -0.167, 279.5];
// the 3 / 4 player step zones: each player's [dark, light] colour, and the tinted pictures (cached)
const MULTI_BOARD_RGB = [[[0, 30, 255], [109, 226, 255]], [[255, 0, 0], [255, 157, 109]], [[0, 255, 18], [178, 255, 178]], [[255, 222, 0], [255, 253, 109]]];
const MULTI_BOARD_CACHE = new Map();
// draw the 3 / 4 player step-zone boards; k = how far they have faded in (0..1)
function drawMultiBoard(lay, k = 1) {
  const U = W / (640 * 4 / 3), [wh, ln] = A.img.multiBoard, n = lay.length;
  const at = lay.map((l, i) => n > 3 ? { cx: W / 2 + MULTI_BOARD_C4[i] * U, s: 0.55 } : n === 3 ? { cx: W / 2 + MULTI_BOARD_C3[i] * U, s: 0.7 } : { cx: l.x0 + 2 * l.lw, s: l.lw / (64 * U) });
  at.forEach((a, i) => {
    const bw = Math.round(32 * 8 * a.s * U), key = i + ':' + bw;
    let c = MULTI_BOARD_CACHE.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = bw; c.height = H;
      const x = c.getContext('2d'), [top, bot] = MULTI_BOARD_RGB[i];
      x.drawImage(wh, 0, 0, bw, H);
      const gr = x.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = gr; x.fillRect(0, 0, bw, H);
      MULTI_BOARD_CACHE.set(key, c);
    }
    g.globalAlpha = 153 / 255 * k; g.drawImage(c, a.cx - bw / 2, 0); g.globalAlpha = 1;
  });
  g.globalAlpha = k;
  if (ln) at.forEach(a => [[-128, 1], [128, 1], [-64, 0.5], [0, 0.5], [64, 0.5]].forEach(([dx, sx]) => {
    const w = 16 * sx * a.s * U;
    g.drawImage(ln, a.cx + dx * a.s * U - w / 2, 0, w, H);
  }));
  g.globalAlpha = 1;
}
// DDR II: the board behind the arrows - TRACED from a Dolphin FIFO log (fifo_ddr2_demo.dff, DEMONSTRATION, 1 player,
// 2026-11-18). In the 2D pass (ortho 853.3 x 480, centre origin), centred on the field (lanes 64 units wide):
// 1. GAME_CMN_US.bin /7/4 effect_line01 (picture /7/4/0/1, 256 x 256), twice at the same place - its two parts, the
//    second mirrored (scale x -1) - each a quad 256 x 1024 (scale 1 x 4 of 256 x 256) about the screen's middle,
//    colour white at opacity 102, times the picture, times picture /7/4/0/0 (back_board_grd0, 128 x 64 IA8, spread
//    over the whole quad - its alpha is the mask); blended src-alpha / ONE (added). Its texture coordinates scroll
//    (layout commands 54 / 55, a 600-frame loop): u0 = (128 - c54) / 256, v0 = (128 - c55) / 256 at the quad's top
//    left, +1 across it. Part 1: c54 = 128 + 256 n / 600, c55 = 384 - 256 n / 600; part 2: c54 = 250 + 256 n / 600,
//    c55 = -256 n / 600 (n = frame + 1).
// 2. /7/1 back_board_whit (picture 0, 64 x 480 IA8), pivot 32 / 240, scale 4 x 1 -> 256 x 480, opacity 153, its top
//    corners 001eff and bottom corners 6de2ff (TEV: texture x vertex colour; blend src-alpha / 1-src-alpha).
// 3. /7/1 back_board_line (picture 1, 16 x 16), pivot 8 / 8, scale y 30, at x -128 / 128 (scale x 1) and -64 / 0 /
//    64 (scale x 0.25), opacity 255.
// DOUBLE: the same layouts' other tracks - board scale 8 (512 wide), lines at -256 / 256 and 0 (scale 1) and
// -192 / -128 / -64 / 64 / 128 / 192 (0.25), the effect scale +-2.
// Timing: like HP4's (fifo_3p_go2.dff): from HERE WE GO the layout's fade-in track - board opacity 153 x n / 10, lines
// 255 x n / 10, n = 1..10 at 30 a second. Player 2's colours: HP4's table (the same engine; P2 not logged on DDR II).
const DDR2_BOARD_CACHE = new Map();
// draw the 1 / 2 player step-zone board (the dark lane behind the arrows) centred on cx
function drawDdr2Board(cx, s, lanes, pi, go) {
  const [wh, ln] = A.img.board, dbl = lanes === 8, k = Math.min(1, (1 + Math.floor(go * 30)) / 10), sy = H / 480;
  const fx = A.img.boardFx;
  if (fx && fx[0] && fx[1]) {
    const qs = dbl ? 2 : 1, bw = Math.ceil(256 * qs * s), key = 'fx:' + bw;
    let c = DDR2_BOARD_CACHE.get(key);
    if (!c) { c = { cv: document.createElement('canvas'), pat: null }; c.cv.width = bw; c.cv.height = H; DDR2_BOARD_CACHE.set(key, c); }
    const x = c.cv.getContext('2d');
    if (!c.pat) c.pat = x.createPattern(fx[1], 'repeat');
    const n = (Math.floor(go * 30) % 600) + 1, sx = qs * s, tw = fx[1].width, th = fx[1].height;
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, bw, H);
    x.globalAlpha = 102 / 255; x.fillStyle = c.pat;
    // texel (tx, ty) -> (sx (tx / tw - u0) 256, sy (1024 (ty / th - v0) - 272)); the second part mirrored
    [[(128 - (128 + 256 * n / 600)) / 256, (128 - (384 - 256 * n / 600)) / 256, false],
     [(128 - (250 + 256 * n / 600)) / 256, (128 + 256 * n / 600) / 256, true]].forEach(([u0, v0, mir]) => {
      const a = 256 * sx / tw, d = 1024 * sy / th, e = -256 * sx * u0, f = sy * (-1024 * v0 - 272);
      c.pat.setTransform(mir ? new DOMMatrix([-a, 0, 0, d, bw - e, f]) : new DOMMatrix([a, 0, 0, d, e, f]));
      x.fillRect(0, 0, bw, H);
    });
    x.globalAlpha = 1; x.globalCompositeOperation = 'destination-in';
    x.drawImage(fx[0], 0, -272 * sy, bw, 1024 * sy);
    x.globalCompositeOperation = 'source-over';
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(c.cv, cx - bw / 2, 0); g.restore();
  }
  const bw = Math.round(64 * (dbl ? 8 : 4) * s), key = pi + ':' + bw;
  let c = DDR2_BOARD_CACHE.get(key);
  if (!c) {
    c = document.createElement('canvas'); c.width = bw; c.height = H;
    const x = c.getContext('2d'), [top, bot] = MULTI_BOARD_RGB[pi % 4];
    x.drawImage(wh, 0, 0, bw, H);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, `rgb(${top})`); gr.addColorStop(1, `rgb(${bot})`);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = gr; x.fillRect(0, 0, bw, H);
    DDR2_BOARD_CACHE.set(key, c);
  }
  g.globalAlpha = 153 / 255 * k; g.drawImage(c, cx - bw / 2, 0);
  g.globalAlpha = k;
  if (ln) (dbl ? [[-256, 1], [256, 1], [0, 1], [-192, 0.25], [-128, 0.25], [-64, 0.25], [64, 0.25], [128, 0.25], [192, 0.25]]
    : [[-128, 1], [128, 1], [-64, 0.25], [0, 0.25], [64, 0.25]]).forEach(([dx, w]) => {
    const pw = 16 * w * s;
    g.drawImage(ln, cx + dx * s - pw / 2, 0, pw, H);
  });
  g.globalAlpha = 1;
}
// where each player's lane and panel go with n players (worked out once from the game's layout)
const MULTI_LAY = {};
function multiLayout(n) {
  if (MULTI_LAY[n] !== undefined) return MULTI_LAY[n];
  const M = A.multi && A.multi[n];
  if (!M || !M.cae) return null;
  const first = p => {
    const o = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255 };
    const sc = p.tracks && p.tracks[0] ? p.tracks[0].script : [];
    for (const [t, k, v] of sc) { if (t > 0) break; if (k in o) o[k] = v; }
    return o;
  };
  const by = {};
  M.cae.forEach(p => { if (p.name === '@dummy') return; (by[p.sprite] = by[p.sprite] || []).push(first(p)); });
  Object.values(by).forEach(a => a.sort((u, v) => u.x - v.x));
  const bars = by[4] || [];
  if (bars.length !== n) return (MULTI_LAY[n] = null);
  const cells = Array.from({ length: n }, () => []);
  (by[7] || []).forEach(c => { let b = 0; bars.forEach((q, i) => { if (Math.abs(q.x - c.x) < Math.abs(bars[b].x - c.x)) b = i; }); cells[b].push(c); });
  const fields = (by[8] || []).filter((f, i, a) => a.findIndex(q => q.x === f.x) === i);
  return (MULTI_LAY[n] = { plate: (by[1] || [])[0], word: (by[0] || [])[0], bars, gauges: by[5] || [], diffs: by[6] || [],
    nums: (by[2] || []).filter(q => q.y > 80), danger: by[9] || [], badges: by[10] || [], cells, fields });
}
// FRIENDSHIP / SYNC with 3 / 4 players (Wii screenshot, 3 players FRIENDSHIP): one shared field in the middle
// (the CAE's field mark at 320 on the 0-640 strip, full size) under the pink group panel, the STYLE plate top
// left, and a PLAYER n tag per player (game/METER_FS2_US.bin's CAE: 1p_bar03 at 0.85 x 0.45 with PLAYER n on it,
// at (319, 120) (730, 120) (319, 297) (729, 297)). Same screen mapping as the 3 / 4 player meters (the group
// panel's parts keep their distance from it at 1.5x).
let PARTY_LAY;
// (see above) the 2-player panel's parts, read once from the game's layout
function partyLayout() {
  if (PARTY_LAY !== undefined) return PARTY_LAY;
  if (!A.party || !A.party.cae) return null;
  const by = {};
  A.party.cae.forEach(p => {
    if (p.name === '@dummy') return;
    const o = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255 };
    for (const [t, k, v] of (p.tracks && p.tracks[0] ? p.tracks[0].script : [])) { if (t > 0) break; if (k in o) o[k] = v; }
    (by[p.sprite] = by[p.sprite] || []).push(o);
  });
  const tagOrder = a => (a || []).slice().sort((u, v) => (u.y - v.y) || (u.x - v.x));    // P1 top left, P2 top right, P3 / P4 under
  return (PARTY_LAY = { word: (by[0] || [])[0], plate: (by[1] || [])[0], bar: (by[4] || [])[0], panels: tagOrder(by[5]), gauge: (by[6] || [])[0],
    tags: tagOrder(by[7]), diff: (by[8] || [])[0], cells: (by[9] || []).sort((u, v) => u.x - v.x), score: (by[2] || []).find(q => q.y > 60),
    danger: (by[11] || [])[0], box: (by[12] || [])[0], sticker: (by[13] || [])[0] });
}
// draw the shared gauge / score panel of FRIENDSHIP and SYNC
function drawParty(ps, t, plateDx = 0) {
  const L = partyLayout(), P = A.party;
  if (!L || !L.bar) return false;
  const ax = L.bar.x, p = ps[0], life = p.life / 1000, di = DIFFS.findIndex(d => d[0] === p.diff);
  // the style plate and word (their own place: no group offset)
  g.save(); g.translate(plateDx, 0);
  mspr(P.plate, L.plate, L.plate && L.plate.x); mspr(P.words[GROUP === 'sync' ? 3 : 4], L.word, L.plate && L.plate.x);
  g.restore();
  // each player's tag
  ps.forEach((q, i) => { const o = L.panels[i], tg = L.tags[i]; if (o) { mspr(P.panels[i], o, o.x); mspr(P.tags[i], tg, o.x); } });
  // the group panel: panel, gauge, difficulty, pills, score, badge with PARTY
  mspr(P.bar, L.bar, ax); mspr(P.gauge, L.gauge, ax); mspr(P.diffs[di], L.diff, ax);
  const cs = L.cells, N = cs.length, units = life * N;
  cs.forEach((c, k) => {
    const part = Math.max(0, Math.min(1, units - k)); if (part <= 0) return;
    const x = MX(c.x, ax) + (4 - c.px) * c.sx * 1.5, y = MY(c.y) + (7 - c.py) * c.sy * 1.5, rx = 3.1 * c.sx * 1.5, ry = 5.2 * c.sy * 1.5;
    g.save(); g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
    g.fillStyle = life >= 1 ? `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)` : 'rgb(48,214,122)';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
  });
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) mspr(P.danger, L.danger, ax);
  mspr(P.box, L.box, ax); mspr(P.sticker, L.sticker, ax);
  const nm = L.score;
  if (nm) {
    const dw = 28 * nm.sx * 1.5, h = 28 * nm.sy * 1.5, adv = dw * 0.66, right = MX(nm.x, ax) + adv / 2, y = MY(nm.y);
    const str = String(p.score).padStart(Play.scoreDigits || 7, '0'), set = A.numbers && A.numbers.white;
    [...str].forEach((ch, k) => { const im = set && set[+ch], cx = right - adv * (str.length - k - 0.5);
      if (im) { const w = im.width * h / im.height; g.drawImage(im, cx - w / 2, y - h / 2, w, h); } else text(ch, cx, y, h, '#fff', 'center'); });
  }
  return true;
}
// 3 / 4 player layout units -> screen pixels (ax = the part's anchor x)
const MX = (x, ax = 520) => 640 + (ax - 520) * 2 + (x - ax) * 1.5, MY = y => y * 1.5;
// draw one layout part (picture im, placed and turned as o says)
function mspr(im, o, ax = 520) {
  if (!im || !o) return false;
  g.save(); g.globalAlpha *= o.alpha / 255; g.translate(MX(o.x, ax), MY(o.y)); g.rotate(o.rot * Math.PI / 180);
  g.scale(o.sx * 1.5, o.sy * 1.5); g.drawImage(im, -o.px, -o.py); g.restore();
  return true;
}
// Players 3 and 4 (SELECT NUMBER OF PLAYERS 3 / 4): the same {name, diff} as P2, in order
let PX = [];
function styleNow() { return S.style; }            // VERSUS follows the Style option: Single (2 mats) or Double (4 mats)
// a song's five difficulty levels in the style being played
function levelsOf(song) {
  if (boardNow()) return song.board || [0, 0, 0, 0, 0];
  if (CHOREO && HP4) return (song.choreo || [0, 0, 0, 0, 0]).map((v, i) => GROUP !== 'family' || (song.choreoFamily && song.choreoFamily[i]) ? v : 0);
  if (GROUP === 'family') return (song.single || []).map((v, i) => song.family && song.family[i] ? v : 0);   // (HP4 FAMILY: songs with the split charts)
  return styleNow() === 'double' ? song.double : song.single;
}
// HP4 FAMILY: the two sides' charts (0x24 / 0x34 - together the single chart). 2 players: player 1 the
// first, player 2 the second; 3 / 4 players: players 1-2 share the first, players 3-4 the second
// (0x80046948: the member's party is its index with 2 players, else 0 for indexes 0-1 and 1 for 2-3)
function familySide(i, n) { return n <= 2 ? i : i < 2 ? 0 : 1; }
// the chart numbers inside a song file: (difficulty << 8) | chart type
function familyKey(diff, side) { return (diff << 8) | (CHOREO && HP4 ? (side ? 0x3a : 0x2a) : (side ? 0x34 : 0x24)); }
function chartKey(diff) { return (diff << 8) | (boardNow() ? 0x4a : styleNow() === 'double' ? 0x18 : CHOREO && HP4 ? 0x1a : 0x14); }
// HP4's Wii Balance Board MODE: the 0x?4a charts - on a PC the arrows are the arrow keys (the game: lean /
// hop that way) and the hip moves and punches in lanes 4 / 5 go to the hand keys (or auto, CHOREOGRAPH HANDS)
function boardNow() { return HP4 && S.mode === 'board'; }
// HP4 Wii Balance Board MODE: what the board must show for a note (0x80036bfc, codes read by 0x8002fc50 - see
// board.js). Arrows (lanes 0-3, kind 12 in this mode) = the centre of weight toward that side (Dir 6 / 4 / 0 / 2:
// left, back, front, right), pressed and held; gimmick 7 = 'LStepOff' (x past +0.45, or nobody on), or with
// its parameter 8 the left foot on (code 8); gimmick 6 = 'RStepOff' / the right foot on (9); a hip roll (5) is
// pressed by any lean (0x1a) and held by full turns one way (0x1b) or, parameter >= 100, the other (0x1c)
function boardCode(n, hold) {
  if (!n.gk) return n.lane < 4 ? [6, 4, 0, 2][n.lane] : -1;
  if (n.gk === 7) return hold ? -1 : (n.gp || 0) < 8 ? 10 + (n.gp || 0) : 8;
  if (n.gk === 6) return hold ? -1 : (n.gp || 0) < 8 ? 18 + (n.gp || 0) : 9;
  if (n.gk === 5) return hold ? ((n.gp || 0) >= 100 ? 0x1c : 0x1b) : 0x1a;
  return -1;
}
// (a Wii Balance Board lesson, 12-15, plays in board style too - the game's +0xcc = 2 for lessons 11-14 0-based)
let BOARD_LESSON = false;
// is a Wii Balance Board in use and connected?
const boardLive = () => (boardNow() || BOARD_LESSON) && typeof Board !== 'undefined' && Board.ok;
// player 2's saved profile (null for a guest)
function p2Profile() { return P2 && P2.name ? DATA.profiles[P2.name] || null : null; }
// player 2 plays with their own saved options (a guest uses player 1's)
function p2Opts() { return pOpts(P2); }
// a joined player's options: their saved ones (a guest uses player 1's), then any changed for them
function pOpts(P) {
  const prof = P && P.name ? DATA.profiles[P.name] || null : null, o = Object.assign({}, S);
  if (prof && prof.opts) for (const k of PROFILE_OPTS) if (k in prof.opts) o[k] = prof.opts[k];
  if (P && P.opts) Object.assign(o, P.opts);              // changed for that player on the options screen
  return o;
}

// ---- title
// ---- DEMO PLAY (the game's attract mode, main.dol): left on the title screen, the game plays its demo
// table (16 entries at 0x8027b878, in turn) as game mode 8: one dancer playing by itself, the
// 1,000,000-point scoring (0x80037dd4 mode 1), and any button goes back to the title.
// Song code 1000 = any song (0x8004c0f4); a slot code gets 0, 2 or 4 added at random (0x8004be98).
// The entry's type is the play style (+0xd4, 0x80049f28): 0 SINGLE, 6 DOUBLE (Dolphin 2026-11-18: a type-6 demo
// on 8 lanes). Stage (0x80049ea4): song 1000 or type 6 -> a random stage (0x8004c0f4), else stage 18 - the only
// such entry is id 136, "lesson by dj", whose own record says 18 too. The entry's last value is the difficulty index (0 BEGINNER, 1 BASIC):
// it goes to each player's +16 (0x800288d8), which the player setup uses to index the song's level bytes
// (0x800339f4); the 9 stored beside it is the play-option flags 0x1|0x8, the auto-play judging path (0x8002d484).
// Before the song, the explanation window (scene 0x1d) as before any song, but on its own: the demo asks for it
// with flag 0x40000 (0x800457c8: game mode +0xc4 == 8 -> 0x40004), which sets the window's +0x7c, and its state 5
// (0x8010476c) then closes it by itself once its timer has counted 60 (1 s) and the song has loaded - no button
// hint. The page: 4 (Arrow) when the top difficulty is BEGINNER, else 11 (Freeze Arrow) (0x80105548, the same
// list as HP4's). (Dolphin 2026-11-18: "Explanation of Arrow" before the BEGINNER demo, then DEMONSTRATION.)
// The title waits 1200 frames (20 s at 60 fps: its timer at +328 against 1200.0, 0x800e1988), then
// fades out and leaves for the demo (state 16).
const DEMO_IDLE = 20;
// DEMO PLAY's state: on or off, which demo is next, the game's table, the settings to put back after
const DEMO = { on: false, i: 0, table: null, saved: null };
// start the next demo song from the game's demo table
async function startDemo() {
  if (!DEMO.table) {
    try { DEMO.table = (await api('/api/ddr2demo')).demos || []; } catch (e) { DEMO.table = []; }
  }
  if (!DEMO.table.length || !SONGS.length) return false;
  const disc = SONGS.filter(x => !x.disc && !x.custom && !isLocked(x));
  for (let tries = 0; tries < 16; tries++) {
    const e = DEMO.table[DEMO.i]; DEMO.i = (DEMO.i + 1) % DEMO.table.length;
    let song = null;
    // (the entry's song is a game id: slot = id + 1. The +0 / 2 / 4 at random of 0x8004be98 is only for id 92,
    // London EVOLVED, which isn't in the demo table. Id 136 is "lesson by dj", left out of SELECT MUSIC - the
    // server sends it along with the table)
    if (e.song === 1000) song = disc[Math.floor(wiiRandom() * disc.length)];
    else song = songForSlot(e.slot || e.song + 1) || e.songInfo || null;
    if (!song) continue;
    const want = e.b4 === 1 ? 1 : 4;
    const dbl = e.type === 6, lv = (dbl ? song.double : song.single) || [];
    const has = d => lv[DIFFS.findIndex(x => x[0] === d)] > 0;
    const diff = has(want) ? want : [4, 1, 2, 3].find(has);
    if (!diff) continue;
    DEMO.saved = { diff: S.diff, style: S.style, p2: P2 };
    S.diff = diff; S.style = dbl ? 'double' : 'single'; P2 = null;
    DEMO.on = true; DEMO.type = e.type;
    go(Loading.with(song));
    return true;
  }
  return false;
}
// After the demo (ended or cut short with a button) the game goes to scene 12, the opening movie, then the title:
// 0x800452b0 sets the next scene to 0xc when the finished game's mode (0x80027ffc) is 8, else 0 (Dolphin
// 2026-11-18: A in the demo -> black, OP.thp with its sound, then the title; A / + didn't cut the movie short)
function endDemo() {
  if (!DEMO.on) return;
  DEMO.on = false;
  if (DEMO.saved) { S.diff = DEMO.saved.diff; S.style = DEMO.saved.style; P2 = DEMO.saved.p2; DEMO.saved = null; }
  if (HP4) return go(Title);
  go(OpMovie);
}
// the opening movie (after the start-up screens, before the title)
const OpMovie = {
  movie: null, snd: null, at: 0,
  enter() {
    this.at = performance.now(); this.started = false; this.movie = null;
    api('/api/menumovie').then(m => { if (scene === this && m && m.file) this.movie = new Movie(m.file, { audio: true }); else if (scene === this) go(Title); }).catch(() => { if (scene === this) go(Title); });
  },
  leave() { if (this.snd) { try { this.snd.stop(); } catch (e) {} this.snd = null; } if (this.movie) { this.movie.close(); this.movie = null; } },
  update() {
    const mv = this.movie;
    if (mv && mv.failed) return go(Title);
    if (mv && mv.info && !this.started) {
      this.started = true; this.movieAt = performance.now();
      const au = mv.audio;
      if (au) try {
        const ctx = audio(), b = ctx.createBuffer(au.chans.length, au.chans[0].length, au.rate);
        au.chans.forEach((c, k) => b.copyToChannel(c, k));
        const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); this.snd = src;
      } catch (e) {}
    }
    if (this.started && (performance.now() - this.movieAt) / 1000 > mv.duration) go(Title);
    else if (!this.started && performance.now() - this.at > 15000) go(Title);     // (the movie never came)
  },
  input() {},
  draw() {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const fr = this.started && this.movie && this.movie.frameAt((performance.now() - this.movieAt) / 1000);
    if (fr) { g.save(); g.translate(0, H); g.rotate(-Math.PI / 2); g.drawImage(fr, 0, 0, H, W); g.restore(); }   // (stored turned a quarter clockwise)
  },
};

// ---- start-up, as on the Wii (timed from a recording of the real game): the wrist-strap screens (3 s and
// 3.5 s), KONAMI (fades in 0.5 s, 3 s, fades out), the WARNING "Loading." window over the darkened menu
// background while the game loads, NOTICE (0.5 s fades, 3 s), a white flash, the opening movie
// (movie/select/OP.thp, stored on its side), then the title. Enter / a click skips a step (the
// warning stays until loading is done). Pictures: logo/logo_ENG.tpl, select/selTitle_US.bin, comAF_US.bin.
let HP4 = false;
// HP4's on-screen wording (its text file), by message number
let HP4_TEXT = {};
const HP4_STAGE_LIST = [8, 0, 1, 2, 3, 4, 5, 6, 7];     // SELECT STAGE's list (0x8005d7d8): RANDOM, then stages 0-7
// everything loaded while the start-up screens show: server status, pictures, sounds, songs, saves
async function bootLoad() {
  const st = await api('/api/status');
  // Hottest Party 4 ("Play DDR HP4 PC.bat"): its own settings and save, stages, dancers and dances (server
  // Hp4Game) and its DDR POINTS unlocks and challenge tasks (Hp4Game.unlocks / tasks); its courses aren't decoded yet
  HP4 = !!st.hp4;
  if (!HP4) { const bi = OPT_PC.findIndex(pg => pg.hp4only); if (bi >= 0) OPT_PC.splice(bi, 1); }   // (the Balance Board page: HP4 only)
  if (HP4) document.title = 'DDR HP4 PC';
  const set = await api('/api/settings');
  if (set.pc) S = Object.assign({}, DEFAULTS, set.pc);
  if (HP4) {
    // USER SUPPORT's HOTTEST PARTY 3 item (text_eng 4550): the game reads an HP3 save from the Wii's memory
    // and unlocks HP3's songs, stages and gear. There's no Wii memory here, so it does what the game does
    // without one: 382 (loading), then 377 (no HOTTEST PARTY 3 save data found).
    try { HP4_TEXT = await api('/api/hp4text?ids=377,382,4550,4472,4473'); } catch (e) { HP4_TEXT = {}; }
    const us = OPT_TOP.find(pg => pg.name === 'USER SUPPORT');
    if (us && !us.rows.some(r => r.action === 'hp3import'))
      us.rows.push({ name: 'HOTTEST PARTY 3', action: 'hp3import', fmt: () => '',
                     help: (HP4_TEXT['4550'] || 'Unlocks all songs, gear, and stages from HOTTEST PARTY 3.').replace(/\s+/g, ' ') });
    // the DANCE options: HP4's stage and its 15 playable dancers (files CHR61-75)
    for (const pg of OPT_TOP) for (const r of pg.rows || []) {
      if (r.key === 'ddr2Stage3d') { r.name = 'STAGE'; r.help = 'HP4\'s 3D stages behind the dancer.'; }
      if (r.key === 'ddr2Char') {
        r.name = 'DANCER'; r.values = ['random'].concat([...Array(15).keys()].map(k => String(61 + k)), ['builtin']);
        r.fmt = v => v === 'random' ? 'RANDOM' : v === 'builtin' ? 'BUILT-IN' : 'DANCER ' + (+v - 60);
        r.skip = null;
        if (!r.values.includes(S.ddr2Char)) S.ddr2Char = 'random';
      }
    }
    // HP4's GIMMICK setting (text_eng 4482 "In-game GIMMICK settings", 4491): PUNCH MARKER - OFF shows the
    // regular arrows only (CHOREOGRAPH's and the Balance Board's markers are left out)
    if (!OPT_IND.some(r => r.player && r.player.key === 'punch')) {
      const fi = OPT_IND.findIndex(r => r.player && r.player.key === 'freezes');
      OPT_IND.splice(fi + 1, 0, { name: 'PUNCH MARKER', help: 'Sets whether to use punch markers. By setting to "OFF", only the regular arrows will be displayed.', player: { key: 'punch', values: ON_OFF, fmt: yesNo } });
      IND_KEYS.push('punch');
    }
    // HP4's MUSIC SPEED (text_eng 971 "Set the song playback speed.", x0.5 - x1.0: 212-217; the play's +0xe4
    // indexes 0x80254050) - used by TRAINING MODE
    if (!OPT_IND.some(r => r.player && r.player.key === 'musicSpeed')) {
      const si = OPT_IND.findIndex(r => r.player && r.player.key === 'speed');
      OPT_IND.splice(si + 1, 0, { name: 'MUSIC SPEED', help: 'Set the song playback speed.', player: { key: 'musicSpeed', values: [0.5, 0.6, 0.7, 0.8, 0.9, 1], fmt: v => 'x' + (+v || 1).toFixed(1) } });
      IND_KEYS.push('musicSpeed');
    }
    // CHOREOGRAPH's hand markers on a PC: keys (Controls: P1 Left hand / Right hand) or played for you
    const dpg = OPT_TOP.find(pg => pg.name === 'DANCE');
    if (dpg && !dpg.rows.some(r => r.key === 'hands')) dpg.rows.push({ name: 'CHOREOGRAPH HANDS', key: 'hands', values: ['right', 'keys', 'auto'],
      fmt: v => v === 'keys' ? 'BOTH BY KEY' : v === 'auto' ? 'AUTO' : 'RIGHT BY KEY',
      helps: { right: 'The right hand (Wii Remote) by key; the left hand\'s notes (Nunchuk) are auto-played, as in the game without a Nunchuk.',
        keys: 'Both hands by key (Controls: P1 Left hand / P1 Right hand).', auto: 'Both hands\' notes are auto-played.' } });
  }
  if (S.colorsV !== 2) { S.colors = 'rainbow'; S.colorsV = 2; }   // VIVID is the game's default
  input.setBindings(S.bindings);
  if (S.dancerCustom && S.dancerModel && window.Dancer3D) Dancer3D.useModel('/api/dancermodel');
  let su = null;
  try { su = await api('/api/setup'); } catch (e) {}
  if (!st.ok || (su && !su.ffmpegOk && !su.ffmpegSkip)) return st.ok ? '' : (st.error || 'no game folder');
  SONGS = await loadSongs(); await loadDiscUnlocks();
  await loadSave();
  if (!A.ready) await A.load();
  return null;
}
const BOOT = [                                   // [step, seconds]
  ['strap0', 3.0], ['strap1', 3.5], ['konami', 4.0], ['white', 0.5], ['dim', 0.75], ['warning', 1.5],
  ['dim2', 1.5], ['notice', 4.0], ['bright', 1.25], ['flash', 0.5], ['movie', 0], ['done', 0]];
// the start-up screens, one after another (the BOOT list), loading in the background
const Boot = {
  step: 0, at: 0, load: null, loaded: false, err: null, movie: null, snd: null,
  enter() {
    this.step = 0; this.at = performance.now(); this.loaded = false; this.err = null;
    A.loadIntro().catch(() => {});
    this.load = bootLoad().then(e => { this.err = e; this.loaded = true; }).catch(e => { this.err = String(e); this.loaded = true; });
    api('/api/menumovie').then(m => { if (m && m.file) this.movie = new Movie(m.file, { audio: true }); }).catch(() => {});
  },
  leave() { this.stopMovie(); },
  stopMovie() { if (this.snd) { try { this.snd.stop(); } catch (e) {} this.snd = null; } if (this.movie) { this.movie.close(); this.movie = null; } },
  name() { return BOOT[this.step][0]; },
  next() {
    if (this.loaded && this.err !== null) return go(Setup.with(this.err));
    this.step++; this.at = performance.now();
    if (this.name() === 'movie') {
      if (!this.movie || this.movie.failed) return this.next();
      this.movieAt = performance.now();
      const au = this.movie.audio;
      if (au) try {
        const ctx = audio(), b = ctx.createBuffer(au.chans.length, au.chans[0].length, au.rate);
        au.chans.forEach((c, k) => b.copyToChannel(c, k));
        const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); this.snd = src;
      } catch (e) {}
    }
    if (this.name() === 'done') { this.stopMovie(); go(Title); }
  },
  update() {
    const [nm, dur] = BOOT[this.step], el = (performance.now() - this.at) / 1000;
    if (nm === 'warning' && !this.loaded) return;           // stays up while the game loads
    if (nm === 'movie') { if (this.movie && this.movie.info && el > this.movie.duration) this.next(); return; }
    if (nm === 'dim2' && !this.loaded) return;
    if (dur && el >= dur) this.next();
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    audio();
    const nm = this.name();
    if (nm === 'warning' || nm === 'dim2' && !this.loaded) return;
    if (nm === 'movie' || nm === 'flash' || nm === 'bright') { this.step = BOOT.length - 2; return this.next(); }
    this.next();
  },
  click() { this.input('START', true); },
  draw(t) {
    const I = A.intro || {}, nm = this.name(), el = (performance.now() - this.at) / 1000;
    const full = im => { if (im) g.drawImage(im, (W - H * 4 / 3) / 2, 0, H * 4 / 3, H); };   // a 4:3 Wii picture
    if (nm === 'strap0' || nm === 'strap1') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); full(I.strap && I.strap[nm === 'strap0' ? 0 : 1]); return;
    }
    if (nm === 'konami' || nm === 'white') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const a = nm === 'white' ? 0 : Math.min(clamp(el / 0.5), clamp((4.0 - el) / 0.5));
      if (I.konami) { g.globalAlpha = a; g.drawImage(I.konami, W / 2 - 384, H / 2 - 96 - 20, 768, 192); g.globalAlpha = 1; }
      return;
    }
    if (nm === 'movie') {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const fr = this.movie && this.movie.frameAt((performance.now() - this.movieAt) / 1000);
      if (fr) {                                    // stored turned a quarter clockwise: turn it back
        g.save(); g.translate(0, H); g.rotate(-Math.PI / 2); g.drawImage(fr, 0, 0, H, W); g.restore();
      }
      return;
    }
    if (nm === 'flash') { g.fillStyle = el < 0.25 ? '#fff' : '#000'; g.fillRect(0, 0, W, H); return; }
    // the menu background, darkened (brightening again before the movie)
    menuBackground(t);
    let dark = 0.62;
    if (nm === 'dim') { g.fillStyle = '#fff'; g.globalAlpha = 1 - clamp(el / 0.75); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (nm === 'bright') dark = 0.62 * (1 - clamp(el / 1.25));
    g.fillStyle = `rgba(0,20,30,${dark})`; g.fillRect(0, 0, W, H);
    if (nm === 'bright' && el > 0.9) { g.fillStyle = `rgba(255,255,255,${clamp((el - 0.9) / 0.35)})`; g.fillRect(0, 0, W, H); }
    if (nm === 'warning') {
      // comAF's window (554 x 320 Wii pixels) with the font's WARNING! banner and the game's text
      if (I.window) g.drawImage(I.window, W / 2 - 396, H / 2 - 229 - 6, 792, 457);
      const bn = I.banners && I.banners[0];
      if (bn) g.drawImage(bn, W / 2 - bn.width * 0.75, 182 - bn.height * 0.75, bn.width * 1.5, bn.height * 1.5);
      gtext('Loading.', W / 2, 218, 30, '#fff', 'center');
      gtext('Please do not touch\nthe Power Button\nor RESET.', W / 2, 296, 30, '#fff', 'center');
    }
    if (nm === 'notice') {
      const a = Math.min(clamp(el / 0.5), clamp((4.0 - el) / 0.5));
      g.globalAlpha = a;
      // selTitle's NOTICE layout (Wii 640 x 480): title (320,76), text (320,203), DOLBY (320,354), (C) (320,417)
      const P = (im, x, y, px, py) => { if (im) g.drawImage(im, W / 2 + (x - 320 - px) * 1.5, y * 1.5 - py * 1.5, im.width * 1.5, im.height * 1.5); };
      P(I.notice, 320, 76, 100, 25); P(I.noticeText, 320, 203, 300, 100); P(I.dolby, 320, 354, 89, 38); P(I.copy, 320, 417, 180, 17);
      g.globalAlpha = 1;
    }
    if (this.err && this.loaded && (nm === 'dim2' || nm === 'notice')) text(this.err, W / 2, H - 30, 16, '#fff', 'center', 'normal');
  },
};

// ---- the title (selTitle_US.bin): the dark starry sky with mist, ripples floating at the bottom, the
// arrow emblem flying together, the DanceDanceRevolution II logo, "Let's dance!" (gently rocking) and
// (C) 2011 Konami Digital Entertainment. Layout in Wii pixels: logo (320,172), button (320,336),
// (C) (320,417), emblem about (240,240).
const Title = {
  t0: 0, busy: false,
  enter() { this.t0 = this.idle = performance.now(); if (!A.intro && A.loadIntro) A.loadIntro().catch(() => {}); },
  draw(t) {
    if (SONGS.length && A.ready && !this.busy && !DEMO.on && performance.now() - this.idle > DEMO_IDLE * 1000) {
      this.idle = performance.now(); startDemo();
    }
    if (HP4 && this.drawHp4()) return;
    const I = A.intro || {}, el = (performance.now() - this.t0) / 1000;
    // the sky
    g.fillStyle = '#04192b'; g.fillRect(0, 0, W, H);
    if (I.nebula) { g.globalAlpha = 0.9; g.drawImage(I.nebula, W / 2 - 600, H / 2 - 520, 1200, 1040); g.globalAlpha = 1; }
    if (I.mist) { g.globalAlpha = 0.35; g.drawImage(I.mist, -100 + Math.sin(t * 0.1) * 40, 0, 900, 720); g.drawImage(I.mist, 600 - Math.sin(t * 0.13) * 40, -80, 900, 720); g.globalAlpha = 1; }
    if (I.stars) for (let k = 0; k < 6; k++) { g.globalAlpha = 0.8; g.drawImage(I.stars, (k % 3) * 430 - 20, Math.floor(k / 3) * 360 + ((t * 6 + k * 50) % 360) - 360, 430, 430); g.drawImage(I.stars, (k % 3) * 430 - 20, Math.floor(k / 3) * 360 + ((t * 6 + k * 50) % 360), 430, 430); g.globalAlpha = 1; }
    // ripples on the floor
    const rp = I.ripple || [];
    [[170, 575, 2.2, 0], [470, 600, 1.4, 2], [800, 640, 1.8, 1], [1080, 560, 1.5, 0], [1190, 640, 1.9, 2], [80, 690, 2.4, 1], [620, 700, 2.1, 0]].forEach(([x, y, s, k], i) => {
      const im = rp[k]; if (!im) return;
      const pulse = 1 + 0.03 * Math.sin(t * 1.5 + i), sw = im.width * s * pulse, sh = sw * 0.32;
      g.globalAlpha = 0.85; g.drawImage(im, x - sw / 2, y - sh / 2, sw, sh); g.globalAlpha = 1;
    });
    // the arrow emblem: four arrows flying in to point at its middle, cut square
    const k = clamp((el - 0.2) / 0.9), ek = 1 - Math.pow(1 - k, 3), cx = 480, cy = 360, half = 134;
    if (I.arrow) {
      if (!this.emb) {                            // the arrow in the emblem's blue -> cyan
        const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x2 = c.getContext('2d');
        x2.drawImage(I.arrow, 0, 0); x2.globalCompositeOperation = 'source-in';
        const gr = x2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d6ff0'); gr.addColorStop(1, '#2fe0ff');
        x2.fillStyle = gr; x2.fillRect(0, 0, 256, 256); this.emb = c;
      }
      g.save(); g.globalAlpha = ek;
      g.beginPath(); const ch = 14;                // the emblem's square with clipped corners
      g.moveTo(cx - half + ch, cy - half); g.lineTo(cx + half - ch, cy - half); g.lineTo(cx + half, cy - half + ch); g.lineTo(cx + half, cy + half - ch);
      g.lineTo(cx + half - ch, cy + half); g.lineTo(cx - half + ch, cy + half); g.lineTo(cx - half, cy + half - ch); g.lineTo(cx - half, cy - half + ch); g.closePath(); g.clip();
      [[-1, -1, 135], [1, -1, 225], [-1, 1, 45], [1, 1, -45]].forEach(([sx, sy, rot]) => {
        const fly = (1 - ek) * 420, d = 70;
        g.save(); g.translate(cx + sx * (d + fly), cy + sy * (d + fly)); g.rotate(rot * Math.PI / 180);
        g.drawImage(this.emb, -95, -95, 190, 190); g.restore();
      });
      g.restore();
    }
    // the logo (with a flash as the emblem lands), the button, (C)
    const lk = clamp((el - 0.9) / 0.4);
    if (I.logo) { g.globalAlpha = lk; g.drawImage(I.logo, W / 2 - 365, 264 - 91, 730, 182); g.globalAlpha = 1; }
    else text('DANCE DANCE REVOLUTION II', W / 2, 258, 58, '#fff', 'center');
    if (I.flare && el > 0.9 && el < 1.8) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - clamp((el - 0.9) / 0.9); g.drawImage(I.flare, W / 2 - 600, 258 - 150, 1200, 300); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    const bk = clamp((el - 1.4) / 0.3);
    if (I.letsDance) {
      g.save(); g.globalAlpha = bk; g.translate(W / 2, 517);
      const wob = Math.sin(t * 3); g.rotate(wob * 1.4 * Math.PI / 180); g.scale(1.03 + 0.01 * wob, 1.03 + 0.01 * wob);
      g.drawImage(I.letsDance, -219, -58, 438, 116); g.restore();
    } else if ((t * 2 | 0) % 2 === 0) text("Let's dance!", W / 2, 504, 40, '#fff', 'center');
    if (I.copy2 || I.copy) { const im = I.copy2 || I.copy; g.globalAlpha = bk; g.drawImage(im, W / 2 - im.width * 0.75, 634 - im.height * 0.75, im.width * 1.5, im.height * 1.5); g.globalAlpha = 1; }
    text('F11: full screen', W - 20, 706, 12, '#9ab', 'right', 'normal');
  },
  // HP4's title (select/selTitle_US.bin): block 3 = the logo with the big white arrows turning round it on
  // white (one 141-frame track: in, then frames 101-141 again), block 4 = the prompt - part 0 "Point at the
  // screen" (the Wii pointer; not on a PC), part 1 the "Let's dance!" button on its track 3 (41 frames, again)
  drawHp4() {
    if (!CAE.block('ttl', 3)) return false;
    const f = (performance.now() - this.t0) / 1000 * 30, n = CAE.len('ttl', 3, 0) || 141;
    const fl = f < n ? f : 101 + (f - n) % Math.max(1, n - 101);
    // (white underneath: the pink horizontal stripes and the half-screens sliding in are block 3's '@dummy' parts
    // 20-37 - plain 860 x 480 quads in their corner colours, see CAE.draw3d)
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    // (drawn the game's way: block 3's masked parts and block 4's 3D ones - CAE.draw3d)
    CAE.draw3d('ttl', 3, 0, fl);
    if (f > 60) CAE.draw3d('ttl', 4, 3, (f - 60) % (CAE.len('ttl', 4, 3) || 41), { only: [1] });
    this.hp4Fx(f);
    text('F11: full screen', W - 20, 706, 12, '#9ab', 'right', 'normal');
    return true;
  },
  // the particle burst: CselTitle (0x800d3a1c, state 0xd) counts 60ths of a second from the title's start and at
  // 200 starts effect 0 of effect bank 4 (select_cmn.bin entry 2; 0x8007b99c -> 0x800f2a6c) in its own little
  // scene - camera eye (40, -15, 170) looking at (40, -15, 0), up (0, 1, 0), 45 degrees, 16:9 (0x800d356c /
  // 0x800f28ac), near 1, far 10000 - drawn by the effect manager over the title (0x800f29c4)
  hp4Fx(f) {
    const X = this.fx4 || (this.fx4 = { t: 0 });
    if (!X.req && window.TebFx) {
      X.req = true;
      api('/api/hp4bank4').then(j => {
        if (!j || !j.bank4) return;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const gl = c.getContext('webgl', { premultipliedAlpha: false, alpha: true });
        if (!gl) return;
        X.cv = c; X.gl = gl; X.fx = TebFx.create(gl, { bank4: j.bank4 });
      }).catch(() => {});
    }
    if (!X.fx) return;
    const now = performance.now(), dt = X.last ? (now - X.last) / 1000 : 0; X.last = now;
    if (f / 30 * 60 < 200) { X.started = false; X.fx.clear(); return; }
    if (!X.started) { X.started = true; X.fx.clear(); X.fx.play(4, 0, null, { tag: 'title' }); }
    X.fx.update(Math.min(dt, 0.1));
    const gl = X.gl, eye = [40, -15, 170], at = [40, -15, 0];
    const t = 1 / Math.tan(45 * Math.PI / 360), asp = 16 / 9, n = 1, fa = 10000;
    const P = [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    const z = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]].map((v, i, a) => v / Math.hypot(...a));
    const x = [z[2], 0, -z[0]].map((v, i, a) => v / (Math.hypot(...a) || 1)), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
    const V = [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1];
    const VP = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) VP[c * 4 + r] = P[r] * V[c * 4] + P[4 + r] * V[c * 4 + 1] + P[8 + r] * V[c * 4 + 2] + P[12 + r] * V[c * 4 + 3];
    // (the blended particles over the title as they are; the added ones on black, added to the title)
    for (const [pass, clr, op] of [['blend', 0, 'source-over'], ['add', 1, 'lighter']]) {
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, clr); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      try { X.fx.draw(VP, V, pass); } catch (e) { console.error('title effect', e); X.fx = null; return; }
      g.save(); g.globalCompositeOperation = op; g.drawImage(X.cv, 0, 0); g.restore();
    }
  },
  async begin() {
    if (this.busy) return;
    this.busy = true; audio();
    try {
      if (!SONGS.length || !A.ready) { const e = await bootLoad(); if (e !== null) { this.busy = false; return go(Setup.with(e)); } }
      sfx('SE_SYS_DECIDE01');
      // (no SELECT GAME screen: straight to DDR II's own mode select, like the real game)
      if (S.game !== 'ddr2') { S.game = 'ddr2'; saveSettings(); HP_LOOK = hpLike(); Bgm.cur = undefined; }
      Select.inFolder = null;
      go(ModeSel);
    } catch (e) { go(Setup.with(String(e))); }
    this.busy = false;
  },
  input(a, p) { this.idle = performance.now(); if (p && a === 'START') this.begin(); },
  click() { this.begin(); },
};

// ---- players (user data)
// ---- which game you're playing: DDR II, or Hottest Party (when its disc is added). Picked after
// your profile; the menus, music, song list and gameplay follow the game you pick.
function hpAvailable() { return SONGS.some(s => s.disc === 'hp'); }
// DDR II's own dancers (read from your disc as a .glb, see ddr2char.py): one per song, or the one you
// picked in Options > DANCE. Your own model (DANCER MODEL) still comes first; BUILT-IN = the mannequin.
let DDR2_CHARS = null;
// force: a dancer's file id that must be used (lessons: always DISCO, '202' - the teacher, as on the Wii)
async function ddr2Dancer(force) {
  if (!window.Dancer3D) return;
  if (!force) {
    if (S.dancerCustom && S.dancerModel) { if (Dancer3D.useExtras) Dancer3D.useExtras([]); return; }
    if (S.ddr2Char === 'builtin') { if (Dancer3D.useExtras) Dancer3D.useExtras([]); }
    if (S.ddr2Char === 'builtin') { if (Dancer3D.customFor && Dancer3D.customFor.startsWith('/api/ddr2char/')) await Dancer3D.useModel(''); return; }
  }
  if (!DDR2_CHARS) { try { DDR2_CHARS = await api('/api/ddr2chars'); } catch (e) { DDR2_CHARS = []; } }
  if (!DDR2_CHARS.length) return;
  if (force) {
    const c = DDR2_CHARS.find(x => x.id === force);
    if (c) { if (Dancer3D.useExtras) Dancer3D.useExtras([]); const url = '/api/ddr2char/' + c.id + '/' + c.outfits[0]; if (Dancer3D.customFor !== url) await Dancer3D.useModel(url); return; }
  }
  // The game's own rule (CSelect::setPlayerChr, main.dol 0x8004a728): RANDOM draws from the 9 dancers
  // (ids 200-208 = files CHR201-209) that are unlocked, then outfit = rand % 2 - but outfit 1 only
  // once that dancer's second outfit is unlocked (the disc's unlock table, type 2), otherwise outfit 0.
  const lockedAt = ddr2CharLockedAt;
  const gameId = c => +c.id - 1;
  // (HP4: the playable dancers are ids 60-74 = files CHR61-75; 81-90 and 101 are other characters)
  const open = HP4 ? DDR2_CHARS.filter(c => gameId(c) >= 60 && gameId(c) <= 74)
    : DDR2_CHARS.filter(c => gameId(c) >= 200 && gameId(c) <= 208 && !lockedAt(gameId(c), 0));
  const pool = open.length ? open : DDR2_CHARS;
  // (a chosen dancer who is still locked - EARN THEM on, not enough DDR POINTS - is not used)
  const chosen = DDR2_CHARS.find(c => c.id === S.ddr2Char);
  // MY CHARACTER's RANDOM (girls) / RANDOM (boys): the open dancers of that sex (character flags)
  const sexPool = S.ddr2Char === 'randomF' ? pool.filter(c => c.sex === 1) : S.ddr2Char === 'randomM' ? pool.filter(c => c.sex === 2) : pool;
  const from = sexPool.length ? sexPool : pool;
  const pick = chosen && !lockedAt(gameId(chosen), 0) ? chosen : from[Math.floor(wiiRandom() * from.length)];
  let outfit = pick.outfits.length > 1 ? pick.outfits[Math.floor(wiiRandom() * 2) % pick.outfits.length] : pick.outfits[0];
  if (lockedAt(gameId(pick), 1)) outfit = pick.outfits[0];
  // (HP4: with a CHOREOGRAPH player - and in DANCE VIEW - every dancer wears accessory mask 0x188: the dance
  // mat under its feet and a light bar in each hand, accessory/trans_DDR_Mat.bin + Acc?Hand_LightBar.bin from
  // the disc; main.dol 0x8003c988 / 0x80107734, Dolphin 2026-11-17 set-up record +0x30 = 0x188)
  const acc = HP4 && (PCHOREO.some(x => x) || (typeof TRAIN !== 'undefined' && TRAIN.view && S.mode === 'training')) ? '?acc=392' : '';
  const url = '/api/ddr2char/' + pick.id + '/' + outfit + acc;
  if (Dancer3D.customFor !== url) await Dancer3D.useModel(url);
}
// the DDR POINTS a dancer (game id 200-208) or its second outfit (b = 1) still needs: the disc's unlock
// table, type 2 rows [points, 2, id, ?, outfit]; 0 = open (or SONG UNLOCKS is ALL OPEN). Only RENA (id
// 205) has her first outfit locked (690,000); every dancer's second outfit is locked at first.
function ddr2CharLockedAt(id, b) {
  if (S.unlocks !== 'on') return 0;
  const r = (DISC_UNLOCKS || []).find(x => x[1] === 2 && x[2] === id && x[4] === b);
  return r && SAVE.points < r[0] ? r[0] : 0;
}
// is that Hottest Party disc added (any of its songs on the list)?
function hp2Available() { return SONGS.some(s => s.disc === 'hp2'); }
function hp3Available() { return SONGS.some(s => s.disc === 'hp3'); }
// the game being played right now: 'ddr2', 'hp', 'hp2' or 'hp3'
function gameNow() { return S.game === 'hp' && hpAvailable() ? 'hp' : S.game === 'hp2' && hp2Available() ? 'hp2' : S.game === 'hp3' && hp3Available() ? 'hp3' : S.game === 'custom' ? 'custom' : 'ddr2'; }
// DDR CUSTOM: every part of the game can come from DDR II or Hottest Party
const CUSTOM_PARTS = [
  { key: 'select', name: 'SONG SELECT', help: 'The song selection screen: DDR II or Hottest Party 1, 2 or 3.', values: ['ddr2', 'hp', 'hp2', 'hp3'] },
  { key: 'menu', name: 'MENUS & MUSIC', help: 'Menu backgrounds and menu music.' },
  { key: 'arrows', name: 'ARROWS', help: 'Arrows, step zone and freeze arrows.' },
  { key: 'board', name: 'PLAY BOARD', help: 'DDR II: the blue lane panel. Hottest Party: open lanes on the left.' },
  { key: 'hud', name: 'LIFE BAR & SCORE', help: 'The life gauge and score panel.' },
  { key: 'judge', name: 'JUDGMENTS & COMBO', help: 'MARVELOUS / PERFECT ... and the combo count.' },
  { key: 'banners', name: 'READY / GO / CLEARED', help: 'The start and end banners.' },
  { key: 'stage', name: 'BACKGROUND', help: 'DDR II: song videos / its background. Hottest Party: a 3D stage.' },
  { key: 'dancer', name: 'DANCER', help: 'DDR II\'s dancer, Hottest Party\'s dancers, Hottest Party 2\'s dancers, or none.', values: ['ddr2', 'hp', 'hp2', 'off'] },
  { key: 'score', name: 'TIMING & SCORING', help: 'DDR II: its timing windows and 1,000,000-point score. Hottest Party: its wider windows and step-number score (9 digits).' },
];
// the saved CUSTOM choice for one part (arrows, board, stage ...)
function customOf(key) { const c = S.custom || {}; return c[key] || (key === 'board' || key === 'stage' ? 'hp' : 'hp'); }
// which game a part looks like right now: 'ddr2' or 'hp' (or 'off' for the dancer)
function look(part) {
  const gm = gameNow();
  if (gm === 'custom') {
    const v = customOf(part);
    if (v === 'hp2' && part === 'select') return hp2Available() ? 'hp2' : hpAvailable() ? 'hp' : 'ddr2';
    if (v === 'hp3' && part === 'select') return hp3Available() ? 'hp3' : 'ddr2';
    return v === 'hp' && !hpAvailable() && part !== 'dancer' ? (part === 'select' || part === 'menu' ? 'ddr2' : v) : v;
  }
  if (gm === 'hp2' && part === 'select') return 'hp2';
  // Hottest Party 3 (same engine as HP2; its own menu pictures aren't read yet): HP2's look if that disc is here
  if (gm === 'hp3' && part === 'select') return 'hp3';
  return gm === 'ddr2' ? 'ddr2' : 'hp';
}
// Hottest Party style menus and song select
function hpLike() { const v = look('select'); return v === 'hp' || v === 'hp2'; }
// the songs of the game being played (DDR II also has your custom songs; DDR CUSTOM has everything)
function gameSongs() { const gm = gameNow(); return gm === 'custom' ? SONGS : gm === 'ddr2' ? SONGS.filter(s => !s.disc) : SONGS.filter(s => s.disc === gm); }
// the styles the current game has (Hottest Party has no DOUBLE)
function stylesNow() { const gm = gameNow(); return gm === 'hp' || gm === 'hp2' || gm === 'hp3' ? STYLES.filter(st => st.style !== 'double') : STYLES; }
// the folder a song sits in when it's not one of the game's own
function folderOf(s) { return s.custom || s.disc ? s.folder : 'DANCE DANCE REVOLUTION II'; }
// SELECT GAME: DDR II or one of the added Hottest Party discs
const GameSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, logo: null,
  all: [{ id: 'ddr2', name: 'DANCE DANCE REVOLUTION II', sub: 'Wii (2011)' }, { id: 'hp', name: 'HOTTEST PARTY', sub: 'Wii (2007)' },
        { id: 'hp2', name: 'HOTTEST PARTY 2', sub: 'Wii (2008)' }, { id: 'hp3', name: 'HOTTEST PARTY 3', sub: 'Wii (2009)' },
        { id: 'custom', name: 'DDR CUSTOM', sub: 'mix and match' }],
  games: [],
  enter() {
    this.games = this.all.filter(gm => gm.id === 'ddr2' || gm.id === 'custom' || SONGS.some(s => s.disc === gm.id));
    this.i = Math.max(0, this.games.findIndex(gm => gm.id === S.game)); this.at = performance.now();
    if (!this.logo) { const im = new Image(); im.onload = () => { this.logo = im; }; im.src = '/api/hpimg/logo'; }
  },
  input(a, p) {
    if (!p) return;
    if (/^P[1-4][LU]$/.test(a)) { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (/^P[1-4][RD]$/.test(a)) { if (this.i < this.games.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      S.game = this.games[this.i].id; saveSettings();
      sfx('SE_SYS_DECIDE01');
      Select.inFolder = null; Select.idx = 0;
      HP_LOOK = hpLike();
      Bgm.cur = undefined; go(S.game === 'custom' ? CustomSel : ModeSel);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Title); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SELECT GAME', 210, 44, 34, '#fff', 'center');
    const N = this.games.length, k = clamp((performance.now() - this.at) / 250), gap = N > 4 ? 14 : N > 3 ? 20 : N > 2 ? 30 : 50, w = N > 4 ? 230 : N > 3 ? 285 : N > 2 ? 370 : 470, h = 380;
    const x0 = 640 - (N * w + (N - 1) * gap) / 2;
    this.games.forEach((gm, i) => {
      const on = this.i === i, x = x0 + i * (w + gap), y = 160 + (1 - k) * 40;
      const n = gm.id === 'custom' ? SONGS.length : gm.id === 'ddr2' ? SONGS.filter(s => !s.disc).length : SONGS.filter(s => s.disc === gm.id).length;
      g.save(); g.globalAlpha = k;
      if (on) { g.fillStyle = `rgba(255,138,30,${0.75 + 0.25 * Math.sin(t * 6)})`; g.fillRect(x - 10, y - 10, w + 20, h + 20); }
      const gr = g.createLinearGradient(0, y, 0, y + h);
      if (gm.id === 'hp') { gr.addColorStop(0, '#ffd23c'); gr.addColorStop(1, '#ff6a10'); }
      else if (gm.id === 'hp2') { gr.addColorStop(0, '#ff7ad8'); gr.addColorStop(1, '#8a2be2'); }
      else if (gm.id === 'hp3') { gr.addColorStop(0, '#36d1ff'); gr.addColorStop(1, '#1b3fd1'); }
      else if (gm.id === 'custom') { gr.addColorStop(0, '#5df0c0'); gr.addColorStop(1, '#127a6a'); } else { gr.addColorStop(0, on ? '#3aa0ff' : '#2a6cc0'); gr.addColorStop(1, on ? '#1446b0' : '#123a80'); }
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      const logo = gm.id === 'hp' ? this.logo : gm.id === 'hp2' || gm.id === 'hp3' || gm.id === 'custom' ? null : A.img.logo;
      if (logo) { const sc = Math.min((w - 40) / logo.width, 210 / logo.height); g.drawImage(logo, x + w / 2 - logo.width * sc / 2, y + 130 - logo.height * sc / 2, logo.width * sc, logo.height * sc); }
      else text(gm.name, x + w / 2, y + 130, fitSize(gm.name, 30, w - 24), '#fff', 'center');
      text(gm.name, x + w / 2, y + 270, fitSize(gm.name, N > 3 ? 19 : 24, w - 20), on ? '#fff' : '#eef', 'center');
      text(gm.sub + '   ' + n + ' songs', x + w / 2, y + 310, 18, '#fff', 'center', 'normal');
      if (gm.id === 'ddr2') text('+ your custom songs', x + w / 2, y + 340, 15, '#e6f2ff', 'center', 'normal');
      g.restore();
    });
    text('Left/Right: choose    Enter: OK    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// DDR CUSTOM: pick which game each part of the game comes from
const CustomSel = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  enter() { this.i = 0; if (!S.custom) S.custom = {}; },
  rows() { return CUSTOM_PARTS.concat([{ key: 'go', name: 'START' }]); },
  vals(r) { return r.values || ['ddr2', 'hp']; },
  label(v) { return v === 'ddr2' ? 'DDR II' : v === 'hp' ? 'HOTTEST PARTY' : v === 'hp2' ? 'HOTTEST PARTY 2' : v === 'hp3' ? 'HOTTEST PARTY 3' : 'OFF'; },
  input(a, p) {
    if (!p) return;
    const rows = this.rows(), r = rows[this.i];
    if (/^P[1-4]U$/.test(a)) { this.i = (this.i + rows.length - 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[1-4]D$/.test(a)) { this.i = (this.i + 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[1-4][LR]$/.test(a) && r.key !== 'go') {
      const v = this.vals(r), k = v.indexOf(customOf(r.key)), d = a.endsWith('R') ? 1 : -1;
      S.custom = Object.assign({}, S.custom, { [r.key]: v[(k + d + v.length) % v.length] }); saveSettings();
      HP_LOOK = hpLike(); Bgm.cur = undefined;
      sfx('SE_SYS_SELECT02');
    } else if (a === 'START') {
      if (r.key !== 'go') { this.i = rows.length - 1; sfx('SE_SYS_SELECT01'); return; }
      sfx('SE_SYS_DECIDE01'); HP_LOOK = hpLike(); Bgm.cur = undefined; go(ModeSel);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(GameSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('DDR CUSTOM', 210, 44, 34, '#fff', 'center');
    const rows = this.rows(), x = 240, w = 800, rh = 46, y0 = 110;
    rows.forEach((r, i) => {
      const y = y0 + i * rh, on = this.i === i;
      g.fillStyle = on ? 'rgba(255,138,30,0.92)' : 'rgba(10,40,90,0.72)'; g.fillRect(x, y, w, rh - 6);
      if (r.key === 'go') { text('START  ▶', x + w / 2, y + rh / 2 - 3, 24, '#fff', 'center'); return; }
      text(r.name, x + 20, y + rh / 2 - 3, 20, '#fff', 'left');
      const v = customOf(r.key);
      text((on ? '◀  ' : '') + this.label(v) + (on ? '  ▶' : ''), x + w - 20, y + rh / 2 - 3, 20, v === 'hp' ? '#ffd23c' : v === 'off' ? '#bbb' : '#8fd0ff', 'right');
    });
    const r = rows[this.i];
    if (r.help) text(r.help, W / 2, y0 + rows.length * rh + 18, 17, '#0d3770', 'center', 'normal');
    if (!hpAvailable() && rows.some(r2 => r2.key !== 'go' && customOf(r2.key) === 'hp'))
      text('Hottest Party parts need your Hottest Party disc (added in Setup).', W / 2, y0 + rows.length * rh + 44, 15, '#a01010', 'center', 'normal');
    text('Up/Down: part    Left/Right: which game    Enter: start    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// ---- setup: where the Wii disc and ffmpeg are (asked at start until both are set)
const Setup = {
  msg: '', i: 0, st: null, polling: false,
  with(m) { this.msg = m || ''; this.refresh(); return this; },
  async refresh() {
    try { this.st = await api('/api/setup'); } catch (e) { this.st = null; }
    if (this.st && this.st.msg) this.msg = this.st.msg;
    if (this.st && this.st.busy && !this.polling) {
      this.polling = true;
      const tick = async () => { await this.refresh(); if (this.st && this.st.busy && scene === this) setTimeout(tick, 1000); else this.polling = false; };
      setTimeout(tick, 1000);
    }
  },
  rows() {
    const st = this.st || {}, hp4 = !!st.hp4Mode;
    const short = (f, n) => f ? (n ? n + ' songs - ' : '') + f : '';
    const R = [
      { key: 'iso', sec: 'REQUIRED', label: hp4 ? 'Wii disc: Dance Dance Revolution (USA)' : 'Wii disc: Dance Dance Revolution II (USA)',
        value: st.gameOk ? 'reading from ' + (st.folder || '') : st.iso || 'not set - pick the disc image (.iso, .wbfs, .rvz...)', ok: st.gameOk ? true : false, tag: 'NEEDED' },
      { key: 'folder', label: '...or the same game as an extracted folder', value: 'only if you already extracted it', ok: null, small: true },
      { key: 'ffmpeg', sec: 'OPTIONAL', label: 'ffmpeg.exe', value: st.ffmpegOk ? st.ffmpeg : st.ffmpegSkip ? 'skipped - needed to add custom songs' : 'needed to add custom songs (their videos and pictures)',
        ok: st.ffmpegOk ? true : null, tag: 'FOR CUSTOM SONGS' },
    ];
    if (!hp4) R.push(
      { key: 'hp1', label: 'Hottest Party (USA)', value: st.hpOk ? short(st.hpFolder, st.hpSongs) : st.hpFolder ? 'could not read ' + st.hpFolder : 'not added - its songs join the song list',
        ok: st.hpOk ? true : st.hpFolder ? false : null, tag: st.hpFolder ? 'ERROR' : 'OPTIONAL', hp: 'hp' },
      { key: 'hp2', label: 'Hottest Party 2 (USA)', value: st.hp2Ok ? short(st.hp2Folder, st.hp2Songs) : st.hp2Folder ? 'could not read ' + st.hp2Folder : 'not added - pick its extracted folder',
        ok: st.hp2Ok ? true : st.hp2Folder ? false : null, tag: st.hp2Folder ? 'ERROR' : 'OPTIONAL', hp: 'hp2' },
      { key: 'hp3', label: 'Hottest Party 3 (USA)', value: st.hp3Ok ? short(st.hp3Folder, st.hp3Songs) : st.hp3Folder ? 'could not read ' + st.hp3Folder : 'not added - pick its extracted folder',
        ok: st.hp3Ok ? true : st.hp3Folder ? false : null, tag: st.hp3Folder ? 'ERROR' : 'OPTIONAL', hp: 'hp3' },
      { key: 'hp4', label: 'Hottest Party 4 (USA)', value: st.hp4Folder ? 'its own game - ' + st.hp4Folder : 'its own game: set it up in "Play DDR HP4 PC"',
        ok: st.hp4Folder ? true : null, tag: 'OPTIONAL' });
    R.push({ key: 'go', label: 'START', value: st.gameOk ? '' : 'pick the disc first', ok: null });
    return R;
  },
  draw(t) {
    menuBackground(t);
    if (A.img && A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SETUP', 210, 44, 34, '#fff', 'center');
    const rows = this.rows(), st = this.st || {}, X0 = 200, PW = 880;
    // the panel: a dark navy card with a light rim
    const py = 96, ph = 548;
    g.save(); g.fillStyle = 'rgba(8,24,64,0.82)'; g.beginPath(); g.roundRect(X0, py, PW, ph, 18); g.fill();
    g.strokeStyle = 'rgba(140,200,255,0.7)'; g.lineWidth = 2; g.stroke(); g.restore();
    text('Where are your files?', 640, py + 40, 32, '#fff', 'center');
    text('Discs are only read, never changed. Their files are copied out once.', 640, py + 70, 15, '#a9c8f0', 'center', 'normal');
    let y = py + 92;
    rows.forEach((r, k) => {
      if (r.sec) { text(r.sec, X0 + 30, y + 12, 14, r.sec === 'REQUIRED' ? '#ffb070' : '#8fd0ff', 'left'); y += 20; }
      const on = this.i === k, h = r.small ? 34 : r.key === 'go' ? 46 : 44, x = X0 + 24, w = PW - 48;
      g.save(); g.beginPath(); g.roundRect(x, y, w, h, 9);
      if (r.key === 'go') g.fillStyle = st.gameOk ? (on ? '#ff8a1e' : 'rgba(255,138,30,0.55)') : 'rgba(60,70,100,0.6)';
      else g.fillStyle = on ? 'rgba(255,150,40,0.30)' : r.small ? 'rgba(0,16,50,0.35)' : 'rgba(20,50,110,0.65)';
      g.fill();
      if (on) { g.strokeStyle = '#ffa030'; g.lineWidth = 3; g.stroke(); }
      g.restore();
      if (r.key === 'go') { text(st.gameOk ? 'START  ▶' : 'START - ' + r.value, 640, y + h / 2 + 1, 22, st.gameOk ? '#fff' : '#99a', 'center'); y += h + 6; return; }
      // the status pill on the right
      const pill = r.ok === true ? ['OK', '#2fae5a'] : r.ok === false ? [r.tag || 'NEEDED', r.tag === 'NEEDED' ? '#d0424a' : '#c06a1a'] : r.tag ? [r.tag, 'rgba(120,150,200,0.45)'] : null;
      if (pill) {
        g.save(); g.font = 'bold 13px "Segoe UI", Arial, sans-serif'; const pw = g.measureText(pill[0]).width + 22;
        g.fillStyle = pill[1]; g.beginPath(); g.roundRect(x + w - pw - 12, y + h / 2 - 12, pw, 24, 12); g.fill(); g.restore();
        text(pill[0], x + w - pw / 2 - 12, y + h / 2 + 1, 13, '#fff', 'center');
      }
      if (r.small) text(r.label + (r.value ? '   (' + r.value + ')' : ''), x + 18, y + h / 2 + 1, 15, '#c4d6f2', 'left', 'normal');
      else {
        text(r.label, x + 18, y + 16, 19, '#fff', 'left');
        const v = r.value || '';
        text(v.length > 92 ? '...' + v.slice(-89) : v, x + 18, y + 34, 13, r.ok === false && r.tag !== 'NEEDED' ? '#ffb08a' : '#a9c0e0', 'left', 'normal');
      }
      y += h + 6;
    });
    if (st.busy) text('Working' + '.'.repeat(1 + ((t * 2) | 0) % 3), 640, py + ph + 18, 18, '#ffd23c', 'center');
    else if (this.msg) text(this.msg.slice(0, 120), 640, py + ph + 18, 16, '#0d3770', 'center', 'normal');
    const r = rows[this.i] || {};
    const help = r.key === 'ffmpeg' ? 'Unzip the ffmpeg download first, then pick bin\\ffmpeg.exe inside it.   K: skip'
      : r.key === 'hp1' ? 'Enter: pick the disc image   H: pick an extracted folder instead   X: remove'
      : r.key === 'hp2' || r.key === 'hp3' ? 'Enter: pick the extracted game folder   X: remove'
      : r.key === 'hp4' ? 'Hottest Party 4 is played as its own game: start "Play DDR HP4 PC" and pick its disc there.'
      : 'Up/Down choose   Enter pick   D: pick DolphinTool.exe (needed to read disc images)';
    text(help, 640, 690, 15, '#0d3770', 'center', 'normal');
  },
  async act(what) {
    if (this.st && this.st.busy) return;
    if (what === 'go') {
      if (!(this.st && this.st.gameOk)) { this.msg = 'Pick your Wii disc first.'; return; }
      if (!this.st.ffmpegOk && !this.st.ffmpegSkip) { await api('/api/setup', { pick: 'skipffmpeg' }); }
      sfx('SE_SYS_DECIDE01');
      SONGS = await loadSongs(); await loadSave(); await loadDiscUnlocks();
      if (!A.ready) await A.load();
      if (S.game !== 'ddr2') { S.game = 'ddr2'; saveSettings(); HP_LOOK = hpLike(); }
      return go(ModeSel);
    }
    if (what === 'hp4') { this.msg = 'Hottest Party 4 is its own game: start "Play DDR HP4 PC" and pick its disc there.'; return; }
    if (what === 'hp1') what = 'hpiso'; else if (what === 'hp2') what = 'hp2folder'; else if (what === 'hp3') what = 'hp3folder';
    this.msg = what === 'folder' || what === 'hpfolder' || what === 'hp2folder' || what === 'hp3folder' ? 'A folder window should open (it may be behind the browser)...' : 'A file window should open (it may be behind the browser)...';
    try { this.st = await api('/api/setup', { pick: what }); } catch (e) { this.msg = String(e); return; }
    this.msg = this.st.msg || '';
    if (this.st.busy) this.refresh();
    if (what === 'iso' && this.st.gameOk && !this.st.ffmpegOk && !this.st.ffmpegSkip) this.i = 2;
    else if (this.st.gameOk && (this.st.ffmpegOk || this.st.ffmpegSkip) && !/^hp/.test(what)) this.i = this.rows().length - 1;
  },
  input(a, p) {
    if (!p) return;
    const n = this.rows().length;
    if (a === 'P1U' || a === 'P2U') { this.i = (this.i + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D' || a === 'P2D') { this.i = (this.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') this.act(this.rows()[this.i].key);
  },
  key(e) {
    if (e.code === 'KeyK') { api('/api/setup', { pick: 'skipffmpeg' }).then(() => this.refresh()); this.msg = 'ffmpeg skipped (custom-song videos in old formats will not play).'; }
    if (e.code === 'KeyD') this.act('dolphintool');
    if (e.code === 'KeyH') this.act('hpfolder');
    if (e.code === 'KeyX') { const r = this.rows()[this.i] || {}; if (r.hp) this.act(r.hp + 'remove'); else this.msg = 'X removes the Hottest Party disc on the chosen row.'; }
  },
  click() { this.act(this.rows()[this.i].key); },
};

// does the song have DOUBLE charts?
function hasDouble(s) { return (s.double || []).some(v => v > 0) || !!(s.alt && (s.alt.double || []).some(v => v > 0)); }

// ---- style select, before the song list: SINGLE, DOUBLE, 2 PLAYERS (one mat each) or
// 2 PLAYERS DOUBLE (two mats each, four in all)
// ---- game modes (SELECT MODE): every game gets them all, named the way that game names them.
// RELAXED: you can't fail (DDR II / HP3's RELAXED MODE). MAX COMBO CHALLENGE: song after song until the
// combo breaks; the combo carries over from song to song (HP1's MAX CONTINUOUS COMBO, HP3's challenge).
const MODES = [
  // the game's own four (SELECT MODE cards 1-4, select_bin group 0)
  // (hp4: the card on HP4's SELECT MODE - its five: DANCE, WORKOUT, Wii Balance Board, TRAINING, DDR SCHOOL)
  { id: 'free', card: 0, hp4: 0, name: { ddr2: 'DANCE MODE', hp: 'FREE PLAY MODE', hp2: 'FREE PLAY', hp3: 'FREE PLAY' }, help: 'The main mode for music fitness.' },
  { id: 'workout', card: 1, hp4: 1, name: { all: 'WORKOUT MODE' }, help: 'Exercise with DDR to burn calories!' },
  { id: 'board', hp4: 2, only: ['hp4'], name: { all: 'Wii Balance Board MODE' }, help: 'Play using the Wii Balance Board.' },
  { id: 'training', card: 2, hp4: 3, name: { all: 'TRAINING MODE' }, help: 'Practice difficult songs.' },
  { id: 'lesson', card: 3, hp4: 4, name: { hp: 'LESSON', all: 'DDR SCHOOL' }, help: 'Learn the basics of DDR.' },
  // more modes (after the game's four)
  { id: 'relaxed', name: { all: 'RELAXED MODE' }, help: 'Dance at your own pace: the Dance Gauge never runs out, so you can\'t fail.' },
  { id: 'course', name: { ddr2: 'COURSE MODE', hp3: 'DANCE ORDER', all: 'COURSE' }, help: 'Several songs in a row with one Dance Gauge. Or make your own course with ORDER EDIT.' },
  { id: 'online', name: { all: 'ONLINE VERSUS' }, help: 'Play a friend over the internet: swap two codes, then dance the same song side by side. Both need their own disc.' },
  // (DDR II's TOURNAMENT - rebuilt from data left unused on its disc - is not offered: it isn't a mode of the
  // real game. Its code stays below, and the README says how it was found.)
  { id: 'gc', only: ['hp', 'hp2'], name: { hp: 'GROOVE CIRCUIT', hp2: 'GROOVE ARENA', ddr2: 'TOURNAMENT MODE' }, help: 'Tour the venues, clear the crowd\'s dance requests and win the dance battles.' },
];
// a mode's name in the current game, and the modes that game has
function modeName(m, gm = gameNow()) { return (HP4 && m.name.hp4) || m.name[gm] || m.name.all || m.name.ddr2; }
function modesNow() { return MODES.filter(m => HP4 ? !m.only || m.only.includes('hp4') : !m.only || m.only.includes(gameNow())); }
// modes two players can play together (they go through SELECT NUMBER OF PLAYERS)
const TWO_P_MODES = ['free', 'relaxed'];
// where a mode goes once the players have picked their record data
function modeNext() { return S.mode === 'board' ? Select : S.mode === 'course' ? CourseSel : S.mode === 'workout' ? (HP4 ? WorkoutSet : Style) : S.mode === 'lesson' ? LessonSel : S.mode === 'gc' ? GCSel : S.mode === 'online' ? OnlineSetup : Style; }

// ---- the game's menus are laid out on the Wii's 640 x 480 screen (select_bin's CAE layouts). The layout
// camera (HP4 main.dol 0x80158240) looks at the layout from 888.9 in front of (320, 240) with 480 units
// filling the height; in 16:9 its aspect is (4 / 3 x 39.6) / 30.22 = 1.7472, so the screen's width shows
// 838.7 layout units around x = 320: x -> 640 + (x - 320) x 1.5262 on a 1280 x 720 screen, y -> y x 1.5
// (footage agrees: SELECT LESSON's arrows, 281 Wii pixels apart, are 430 apart = 1.530). Sizes use 1.5.
const WX = x => 640 + (x - 320) * (1280 / (480 * 4 / 3 * 39.6 / 30.22)), WY = y => y * 1.5, WS = 1.5;
// a picture at a layout point: (px, py) = its pivot in the picture, sx/sy its scale (negative = mirrored)
// SELECT MODE's dancer shadow (DDR II and HP4: the mode's shape picture): dark, see-through, turned upside down
// from the dancer's soles (Dolphin footage) - the dancer drawn by wspr at (x, y) with its pivot (100, 120)
const FLOOR_SHADOW = new Map();
// HP4's thrust arrow (SSQ_CMN sheet 7, cell 0): magenta keyed out, the grey multiplied green (the
// footage's colour: the chevrons and ring come out bright green, their dark outlines stay)
// HP4's rand(): the shared wiiRand() (decode.js) - the same code as DDR II's
const hp4Rand = () => wiiRand();
// sprite sheets multiplied by a colour (cached per sheet and colour)
const KEYED = new Map();
function keyedSheet(sheet, mul) {
  if (!sheet) return null;
  const key = mul.join(','), m = KEYED.get(sheet) || (KEYED.set(sheet, new Map()), KEYED.get(sheet));
  if (m.has(key)) return m.get(key);
  const c = document.createElement('canvas'); c.width = sheet.width; c.height = sheet.height;
  const x = c.getContext('2d'); x.drawImage(sheet, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 200 && d[i + 2] > 200 && d[i + 1] < 60) { d[i + 3] = 0; continue; }
    d[i] = d[i] * mul[0] / 255; d[i + 1] = d[i + 1] * mul[1] / 255; d[i + 2] = d[i + 2] * mul[2] / 255;
  }
  x.putImageData(im, 0, 0); m.set(key, c);
  return c;
}
// a dancer silhouette's soft shadow on the floor (made once per picture)
function floorShadow(sil, dp, x, y, a = 1) {
  if (!sil || !dp) return;
  let e = FLOOR_SHADOW.get(sil);
  if (!e || e.dp !== dp) {
    const bottom = im => {                   // a picture's lowest non-transparent row
      try { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const q = c.getContext('2d'); q.drawImage(im, 0, 0);
        const px = q.getImageData(0, 0, c.width, c.height).data; let r = c.height - 1;
        for (; r > 0; r--) { let hit = false; for (let k = 3; k < c.width * 4; k += 4) if (px[r * c.width * 4 + k] > 32) { hit = true; break; } if (hit) break; }
        return r + 1; } catch (err) { return im.height; }
    };
    const c = document.createElement('canvas'); c.width = sil.width; c.height = sil.height; const q = c.getContext('2d');
    q.drawImage(sil, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = '#000'; q.fillRect(0, 0, c.width, c.height);
    e = { dp, dark: c, feet: bottom(dp), base: bottom(sil) }; FLOOR_SHADOW.set(sil, e);
  }
  const foot = y - 120 + e.feet;
  g.save(); g.globalAlpha *= a * 0.35; g.translate(WX(x), WY(foot)); g.scale(WS, -WS);
  g.drawImage(e.dark, -100, -e.base); g.restore();
}
// draw a picture at Wii-screen position (x, y) with its pivot (px, py), scale and alpha
function wspr(im, x, y, px, py, sx = 1, sy = 1, a = 1) {
  if (!im) return false;
  g.save(); g.globalAlpha *= a; g.translate(WX(x), WY(y)); g.scale(sx * WS, sy * WS); g.drawImage(im, -px, -py); g.restore();
  return true;
}
// the song-start screen: comAF's speaker ring (CAE block 0x13aa40: en_a01 the "DDR" disc, en_b01-03 the
// ring's three layers as top halves + their 180-degree copies, neji the screws; pictures /5/0/0/0-5).
// Each part has three tracks: 0 a short close-in (16 frames), 1 the opening (16 frames: the disc fades
// as the ring layers scale out from 1.35 to 2.3 and uncover the stage), 2 the long close-in (61 frames,
// with the shake at the end). Commands per frame at 30 fps (cae.py): x / y the pivot's place on the Wii
// screen, px / py the pivot in the picture, sx / sy scale (negative = turned round), rot degrees,
// alpha 0-255. Seen in the real game (Unbelievable footage): after the explanation screen the ring
// closes in, then opens out round the song's stage.
const RING = { parts: null, tex: null, loading: null };
// load the ring's animation and pictures (once)
function loadRing() {
  if (!RING.loading) RING.loading = (async () => {
    const j = await (await fetch('/api/cae/af')).json();
    const b = (j.blocks || []).find(x => x.at === 0x13aa40);
    if (!b || !b.parts || !A.tplOf) return;
    RING.tex = await Promise.all([0, 1, 2, 3, 4, 5].map(i => A.tplOf('af', '/5/0/0/' + i).then(t => t[0] && t[0].canvas).catch(() => null)));
    RING.parts = b.parts;
  })().catch(() => {});
  return RING.loading;
}
// the ring: how many frames a track runs, and draw frame f of it
function ringLen(track) { return RING.parts ? Math.max(...RING.parts.map(p => (p.tracks[track] || {}).count || 0)) : 0; }
function drawRing(track, f) {
  if (!RING.parts || !RING.tex) return false;
  const list = [];
  for (const p of RING.parts) {
    const tr = p.tracks[track], im = RING.tex[p.sprite];
    if (!tr || !im) continue;
    const s = { x: 320, y: 240, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255, cell: 0 };
    for (const [t, k, v] of tr.script) { if (t > f) break; if (k in s) s[k] = v; }
    if (s.alpha > 0) list.push([s, im]);
  }
  // command 1 is the depth: higher numbers lie further back (the outer ring 5/4 over the screws 7-18,
  // over the gold ring 20/19, over the inner ring 23/22; the DDR disc 2 in front) - as in the footage
  list.sort((a, b) => b[0].cell - a[0].cell);
  for (const [s, im] of list) {
    g.save(); g.globalAlpha *= s.alpha / 255; g.translate(WX(s.x), WY(s.y)); g.rotate(s.rot * Math.PI / 180);
    g.scale(s.sx * WS, s.sy * WS); g.drawImage(im, -s.px, -s.py); g.restore();
  }
  return true;
}
// The combo performance (COMBO PERFORMANCE, main.dol 0x800fcdc8 / 0x800fd1d0): motions from
// game/GAME_APL_MOT01.bin (types 0-4 x 2, +1 for dancers flagged in 0x8026e898 / 0x802b8824) and camera
// moves from GAME_APL_CAM0n (n = the song record's +24 style + 1), loaded per style
const APL = {};
// (see above) load a style's camera moves, once
function loadAppeal(style) {
  if (!APL[style]) APL[style] = api('/api/appeal?' + (String(style).startsWith('slot:') ? 'slot=' + String(style).slice(5) : 'style=' + style)).catch(() => null);
  return APL[style];
}
// the game's message window (mes_wind_L, centre (319, 350) on the Wii screen) with its help text
// (measured on real-game footage: the window 837 x 192 on a 1280 screen, the words in the game's font,
// 12 px in from its left edge, the first line 25 px down, a line every 30 px)
// (each menu screen's entrance, select_bin CAE: part 0 the title bar - in from 100 to the right over
// frames 0-10, fading up - and part 2 the message window - the same from frame 3 to 12, or later on
// some screens; both read from the screen's own block, MENU_ANIM)
let SCENE_T0 = 0;
// leaving a menu screen: the game plays the screen's exit tracks before the next one opens (the title
// bar's and message window's out parts run 15 frames), so the change waits LEAVE_FRAMES
const LEAVE_FRAMES = 16;
// LEAVE: the exit animation playing now ({ from, to, t0, ok }). LAST_ACTION: the last button pressed
let LEAVE = null, LAST_ACTION = null;
// each screen's title (and message window) parts in its select_bin CAE block: [in part, in track, out part, out track]
function menuSpec(sc) {
  // (msg: the window itself is part 1 - part 2 is its reflection, at half opacity)
  if (sc === PlayerNum) return { at: 0x16a080, title: [0, 0, 1, 0], msg: [1, 0, 1, 1] };
  if (sc === Players) return { at: 0xc887a0, title: [0, 0, 1, 0], msg: [1, 0, 1, 1] };
  if (sc === Style || sc === BattleSel) return { at: 0x7b44a0, title: [0, 0, 1, 0], msg: [1, 0, 1, 1] };
  if (sc === LessonSel) return { at: 0xc1e760, title: [0, 0, 0, 1] };
  if (sc === MyChar) return { at: 0x2478c0, title: [2, 0, 2, 1] };
  if (sc === Options) return { at: 0x9e5860, title: [0, 0, 1, 0] };
  return null;
}
// does this screen have the game's own enter / exit animation?
const animatedScene = sc => sc === ModeSel || menuSpec(sc) != null;
// the resting values of a track (its first or last keys)
function caeRest(part, n, last) {
  const sc = part && part.tracks && part.tracks[n] && part.tracks[n].script, o = {};
  if (!sc) return o;
  if (last) { for (const [, nm, v] of sc) o[nm] = v; }
  else { for (const [t, nm, v] of sc) { if (t > 0) break; o[nm] = v; } }
  return o;
}
// the title's / message window's offset and alpha now: the entrance, or the exit while leaving
// (both measured from where the entrance comes to rest)
function menuIn(kind) {
  const sp = menuSpec(scene), q = sp && sp[kind];
  if (!q) return null;
  CAE.load('sel');
  const pin = CAE.part('sel', sp.at, q[0]), rest = caeRest(pin, q[1], true);
  const leaving = LEAVE && LEAVE.from === scene;
  const st = leaving ? CAE.at(CAE.part('sel', sp.at, q[2]), q[3], caeFrame(LEAVE.t0)) : CAE.at(pin, q[1], caeFrame(SCENE_T0));
  if (!st || rest.x === undefined) return null;
  return { dx: (st.x - rest.x) * WS, a: st.alpha / 255 };
}
// run a drawing function slid and faded by the screen's enter / exit animation
function withMenuIn(kind, fn) {
  const an = menuIn(kind);
  if (an) { g.save(); g.globalAlpha *= an.a; g.translate(an.dx, 0); }
  fn();
  if (an) g.restore();
}
// a card that has just become the chosen one grows into place (select_bin's card blocks, e.g. 0x1ca040
// sele_wind_1p_US track 1: scale 0.7 -> 0.897 -> 0.967 -> 0.986 -> 0.994 -> 1.0 over 5 frames), and the
// chosen card gives a little bounce when confirmed (track 2: 1.0 -> 1.027 -> 1.053 -> 1.08 -> 1.04 -> 1.0)
function cardGrow(obj) {
  if (obj._popI !== obj.i) { obj._popI = obj.i; obj._popAt = performance.now(); }
  const st = CAE.at(CAE.part('sel', 0x1ca040, 0), 1, caeFrame(obj._popAt));
  return st ? clamp((st.sx - 0.7) / 0.3) : 1;
}
// how big the chosen card is drawn while it bounces on OK
function cardBounce() {
  if (!LEAVE || LEAVE.from !== scene || !LEAVE.ok) return 1;
  const st = CAE.at(CAE.part('sel', 0x1ca040, 0), 2, caeFrame(LEAVE.t0));
  return st ? st.sx : 1;
}
// The message window (select_bin mes_wind_L_01 570 x 136, or mes_wind_S_01 570 x 98 on SELECT RECORD DATA) and
// its reflection: the layouts' second mes_wind part, 131 (L) / 93 (S) layout units lower, turned upside down, at
// opacity 127, times mirror_alp01 (64 x 64 IA8) spread over it - FIFO log of SELECT NUMBER OF PLAYERS (draws
// 2194-2195: the mirrored copy with the mask as texture 1, then the window at full opacity)
const HELP_REFL = new Map();
function helpWindow(msg, x = 319, y = 350, small = false) {     // (x, y: the window's place in the layout - mes_wind at (319, 350) / (319, 381))
  const M = A.menu || {}, an = menuIn('msg');
  if (an) { g.save(); g.globalAlpha *= an.a; g.translate(an.dx, 0); }
  const win = small && M.helpWinS ? M.helpWinS : M.helpWin, wh = win ? 838 * win.height / win.width : 200;
  const cx = WX(x), cy = WY(y), L = cx - 419, T = cy - wh / 2;
  if (win && M.helpMask) {
    let r = HELP_REFL.get(win);
    if (!r) {
      r = document.createElement('canvas'); r.width = win.width; r.height = win.height;
      const q = r.getContext('2d'); q.drawImage(win, 0, 0); q.globalCompositeOperation = 'destination-in'; q.drawImage(M.helpMask, 0, 0, r.width, r.height);
      HELP_REFL.set(win, r);
    }
    const dy = (win === M.helpWinS ? 93 : 131) * 1.5;
    g.save(); g.globalAlpha *= 127 / 255; g.translate(0, T + wh / 2 + dy); g.scale(1, -1); g.drawImage(r, L, -wh / 2, 838, wh); g.restore();
  }
  if (win) g.drawImage(win, L, T, 838, wh); else { g.fillStyle = 'rgba(20,80,190,0.85)'; g.fillRect(L, T, 838, 192); }
  if (A.font) String(msg || '').split('\n').forEach((ln, i) => gtext(ln, L + 12, T + 25 + i * 30, 27, '#fff', 'left', 3.6, 1));
  else String(msg || '').split('\n').forEach((ln, i) => text(ln, L + 14, T + 25 + i * 30, 24, '#fff', 'left', 'bold'));
  if (an) g.restore();
}
// a menu title in the game's title bar (select_bin title_wind, top left)
// (the bar centred at the top, its title in the middle - as in real-game footage)
function menuTitle(img, name) {
  const M = A.menu || {};
  withMenuIn('title', () => menuTitleBar(img, name, M));
}
// the blue title bar across the top of a menu, with the screen's name picture
function menuTitleBar(img, name, M) {
  if (!wspr(M.titleBar, 320, 30, 215, 40)) { g.fillStyle = '#2a7fd6'; g.fillRect(WX(320) - 322, 0, 645, 105); }
  if (img) { const h = 36, w = img.width * h / img.height; g.drawImage(img, WX(320) - w / 2, 54 - h / 2, w, h); }
  else {
    g.font = 'bold 36px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText(name, WX(320), 54); g.fillStyle = '#111'; g.fillText(name, WX(320), 54);
  }
}
// the button hints at the bottom right: the game's hint pictures (comAF group 1: 0 CONFIRM, 3 BACK,
// 4 SELECT, 32 Pointer:SELECT ...), placed as in real-game footage; text when they aren't loaded
function keyHints(s, ids = [0, 3, 4], pointer = true) {
  const P = A.hints;
  if (!P || !P[0]) { text(s, W - 24, 698, 15, '#0d3770', 'right', 'normal'); return; }
  ids.forEach((id, k) => { const im = P[id]; if (im) g.drawImage(im, 1125 - (ids.length - 1 - k) * 155 - 75, 651, 150, 24); });
  if (pointer && P[32]) g.drawImage(P[32], 1125 - 75, 677, 150, 24);
}
// DDR POINTS, bottom left of the song select (comAF_US.bin CAE block 0x2e2840, laid out on the 854 x 480
// widescreen screen, so 1.5x straight across; Wii screenshots): the DDR POINTS plate (/7/0/2) at (74.45,
// 432.85), tilted -3 degrees, and under it the points (Num_00 at (125.45, 445.95), 0.7x) or, once every
// unlock is earned, COMPLETE!! (/7/0/1) at (100.38, 449.52) tilted -3.25 degrees
function drawPointsPlate() {
  if (!A.img.ptsPlate) return false;
  const spr = (im, x, y, px, py, rot, sc = 1) => { if (!im) return; g.save(); g.translate(x * 1.5, y * 1.5); g.rotate(rot * Math.PI / 180); g.scale(sc * 1.5, sc * 1.5); g.drawImage(im, -px, -py); g.restore(); };
  spr(A.img.ptsPlate, 74.45, 432.85, 52, 12, -3);
  // (COMPLETE!! = nothing left to unlock: every unlock earned, or SONG UNLOCKS set to ALL OPEN)
  if ((S.unlocks !== 'on' || !nextUnlock(SAVE.points)) && A.img.ptsComplete) spr(A.img.ptsComplete, 100.38, 449.52, 70, 15, -3.25);
  else {          // (how the game lines the digits up on that point is not decoded: centred here)
    g.save(); g.translate(125.45 * 1.5, 445.95 * 1.5); g.rotate(-3 * Math.PI / 180);
    num28(String(SAVE.points).padStart(7, '0'), 0, 0, 28 * 0.7 * 1.5, 'center');
    g.restore();
  }
  return true;
}
// numbers in the game's italic number set (comAF 28 x 28: 0-9, 20 ':', 21 '.', 22 '-', 23 '/')
function num28(s, x, y, h, align = 'center', step = 0.72) {
  const P = A.num28; if (!P || !P[0]) return text(s, x, y, h * 0.8, '#fff', align);
  const map = { ':': 20, '.': 21, '-': 22, '/': 23 }, adv = h * step;
  const w = [...s].length * adv; let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of s) { const im = P[ch >= '0' && ch <= '9' ? +ch : map[ch]]; if (im) g.drawImage(im, cx - (h - adv) / 2, y - h / 2, h, h); cx += adv; }
}

// FRIENDSHIP / SYNC (SELECT STYLE, 2 players): 'friend' | 'sync' | null
let GROUP = null;
// DDR HP4's SELECT DANCE: CLASSIC (the arrows) or CHOREOGRAPH (the 0x?1a charts: arrows + hand markers)
let CHOREO = false;
let PCHOREO = [false, false, false, false];     // (each player's own choice; CHOREO = player 1's)
// a CHOREOGRAPH hand played for you: the HANDS option - 'keys' both by hand, 'right' the right hand only
// (the left auto-played, as the game does with no Nunchuk), 'auto' both
function handAuto(p, lane) { const v = S.hands || 'right'; return v === 'auto' || (v === 'right' && lane === 4); }
// The group styles' judging (text_eng help): each step is judged for every player, then everyone gets the
// best of those judgments (FRIENDSHIP) or the worst (SYNC, where a MISS or an Almost fails the whole group).
// The step is settled once every player has been judged on it (hit, or missed when its window closes).
class GroupJudge {
  constructor(mode, ps) { this.mode = mode; this.ps = ps; this.pend = new Map(); }
  report(p, row, j) {
    let e = this.pend.get(row.off);
    if (!e) this.pend.set(row.off, e = []);
    e.push([p, row, j]);
    const need = this.ps.filter(q => (q.rowOffs || (q.rowOffs = new Set(q.rows.map(r => r.off)))).has(row.off)).length;
    if (e.length < need) return;
    this.pend.delete(row.off);
    const js = e.map(x => x[2]), gj = this.mode === 'friend' ? Math.max(...js) : Math.min(...js);
    for (const [q, r] of e) { q.groupApply = true; q.judgeRow(r, gj); q.groupApply = false; }
    if (this.mode === 'sync' && gj <= 1)
      for (const q of this.ps) if (!q.failed && q.o.gauge !== 'no fail') { q.failed = true; q.failAt = q.o.gauge === 'end' ? Infinity : q.now(); }
  }
}
let BATTLE = null;                                 // BATTLE MODE: { level } (0-3: the opponent profile group)
// DDR II's own MAX COMBO CHALLENGE (Wii footage): in DANCE MODE a full-combo song starts it (Start!!); the
// next songs add their combo to it while it holds (KEEP GOING!!); the first break ends it (End!!) with the
// total so far. On screen each song's combo still counts from 1; the break shows COMBO BREAK.
let MCC = null;                                    // { total, style }
let MC = null;                                     // a MAX COMBO CHALLENGE run: { totals: [p1, p2], songs }
// ---- the menus' own animations: CAE_WII track scripts (cae.py) - per-frame keys at 30 a second
// (x, y, alpha 0-255, scale ...); a track is sampled at a frame, between frames in a straight line
const CAE = {
  files: {}, loading: {},
  load(k) {
    if (this.files[k] || this.loading[k]) return;
    this.loading[k] = fetch('/api/cae/' + k).then(r => r.ok ? r.json() : null).then(j => { if (j) this.files[k] = j.blocks || []; }).catch(() => {});
  },
  part(k, at, i) {
    const b = (this.files[k] || []).find(x => x.at === at);
    return b && b.parts ? b.parts[i] || null : null;
  },
  // the part's state on track n at frame f: {x, y, alpha, sx, sy, ...}; null without the data
  at(part, n, f) {
    const tr = part && part.tracks && part.tracks[n], sc = tr && tr.script;
    if (!sc) return null;
    const upto = fr => { const o = {}; for (const [t, nm, v] of sc) { if (t > fr) break; o[nm] = v; } return o; };
    const f0 = Math.max(0, Math.floor(f)), a = upto(f0), b = upto(f0 + 1), u = Math.max(0, f - f0);
    for (const nm in b) if (typeof a[nm] === 'number' && typeof b[nm] === 'number') a[nm] = a[nm] + (b[nm] - a[nm]) * u;
    a.end = sc.length ? sc[sc.length - 1][0] : 0;
    return a;
  },
  // a whole layout block drawn as the game lays it out (the generic player: HP4's menus are drawn from
  // their files this way). b = block index in the file (or its offset), n = track, f = frame (30 fps).
  // Pictures: the block's WII node entry 0, picture = the part's sprite (server /api/cae 'node').
  // Each part: x / y on the Wii's 640 x 480 screen (a child's relative to its parent's), px / py its pivot in
  // the picture, sx / sy scale, rot degrees, alpha 0-255, command 1 depth (higher = further back).
  // o: {only: [part indices], skip: Set, pic: (i, part) => canvas to draw instead (null = default),
  //     after: (i, part, state) => called inside the part's transform, to draw text or digits on it,
  //     state: (i, part, state) => change a part's state (x, y ...) before it is drawn}
  tex: {},
  block(k, b) {
    const bl = this.files[k];
    if (!bl) { this.load(k); return null; }
    return b < bl.length ? bl[b] : bl.find(x => x.at === b) || null;
  },
  pic(k, node, sprite) {
    const key = k + node + '/0/' + sprite;
    if (!(key in this.tex)) {
      this.tex[key] = null;
      if (A.tplOf) A.tplOf(k, node + '/0/' + sprite).then(t => { this.tex[key] = t[0] ? t[0].canvas : null; }).catch(() => {});
    }
    return this.tex[key];
  },
  len(k, b, n) {
    const bl = this.block(k, b);
    return bl && bl.parts ? Math.max(0, ...bl.parts.map(p => { const sc = p.tracks[n] && p.tracks[n].script; return sc && sc.length ? sc[sc.length - 1][0] : 0; })) : 0;
  },
  draw(k, b, n, f, o = {}) {
    const bl = this.block(k, b);
    if (!bl || !bl.parts || bl.node == null) return false;
    const st = bl.parts.map(p => {
      const tr = p.tracks[Math.min(n, p.tracks.length - 1)], s = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255, cell: 0 };
      if (tr) for (const [t, nm, v] of tr.script) { if (t > f) break; if (nm === 'scale') s.sx = s.sy = v; else if (nm in s) s[nm] = v;
        else if (typeof nm === 'number' && nm >= 40 && nm <= 51) (s.col || (s.col = Array(12).fill(255)))[nm - 40] = v;
        else if (nm === 'angle' || nm === 34 || nm === 35 || nm === 36) s['r' + nm] = v; }
      return s;
    });
    if (o.state) st.forEach((s, i) => o.state(i, bl.parts[i], s));
    const order = bl.parts.map((p, i) => i).filter(i => (!o.only || o.only.includes(i)) && !(o.skip && o.skip.has(i)));
    order.sort((i, j) => st[j].cell - st[i].cell || i - j);
    // (positions are on the screen, not relative to the 'parent' part: DDR II's meters and menus line up with
    // the Wii that way - a part's parent is the one it copies, e.g. the off-screen copies at x - 496)
    for (const i of order) {
      const p = bl.parts[i], s = st[i], alpha = s.alpha / 255;
      if (alpha <= 0 || p.name === '@dummy') continue;
      let im = (o.pic && o.pic(i, p)) || this.pic(k, bl.node, p.sprite);
      if (im && s.col) im = caeTint(im, s.col);
      g.save(); g.globalAlpha *= alpha; g.translate(WX(s.x), WY(s.y)); g.scale(WS, WS);
      // (o.rot3d - HP4's song card: commands 34 / 35 / 36 are turns about X / Y / Z in degrees, 'angle' (18)
      // about Y as well; drawn flat (no perspective): Z turns it, Y narrows it by cos, X flattens it by cos -
      // the stand lies on the floor at X 281)
      if (o.rot3d) {
        const D = Math.PI / 180, rz = (s.rot || 0) + (s.r36 || 0), ry = (s.rangle || 0) + (s.r35 || 0), rx = s.r34 || 0;
        if (rz) g.rotate(rz * D);
        g.scale(Math.cos(ry * D), Math.cos(rx * D));
      } else if (s.rot) g.rotate(s.rot * Math.PI / 180);
      g.scale(s.sx, s.sy);
      if (im) g.drawImage(im, -s.px, -s.py);
      if (o.after) o.after(i, p, st[i]);
      g.restore();
    }
    return true;
  },
};
// ---- HP4's 3D layout parts (a track's header byte 2 bit 0, main.dol 0x80159c50): such a part is drawn
// through the layout camera (0x80158240: eye 888.9 in front of the middle of the screen, looking at the layout's
// plane, its field of view making that plane 1:1 - so depth (command 12) and turns about X / Y (17 / 18, and the
// second set 34 / 35 / 36) show in perspective). Matrix (0x80156e64): move x, y, z  * turn X * turn Y * turn Z *
// second turns * scale x, y, z. A part whose track kind has low bits 1 is masked by the part numbered one below
// it (command 1), whose picture's alpha it takes (the reflections' fades); the masks aren't drawn by themselves.
// The turn directions are set by the Wii screenshots (the stand's near edge wider, the jacket's right edge nearer).
const CAE3D_D = 888.9;
// HP4's 3D parts: a corner (u, v) of a part turned in 3D -> its place on the screen
function cae3dPoint(s, u, v) {
  const D = Math.PI / 180;
  let x = u * s.sx, y = v * s.sy, z = 0;
  const rx = (a) => { if (!a) return; const c = Math.cos(a * D), n = Math.sin(a * D), y2 = y * c - z * n; z = y * n + z * c; y = y2; };
  const ry = (a) => { if (!a) return; const c = Math.cos(a * D), n = Math.sin(a * D), x2 = x * c + z * n; z = -x * n + z * c; x = x2; };
  const rz = (a) => { if (!a) return; const c = Math.cos(a * D), n = Math.sin(a * D), x2 = x * c - y * n; y = x * n + y * c; x = x2; };
  rz(s.r36 || 0); ry(s.r35 || 0); rx(s.r34 || 0);           // the second turns (about the part's own axes)
  rz(s.rot || 0); ry(s.rangle || 0); rx(-(s.r17 || 0));
  x += s.x + (s.ox || 0); y += s.y + (s.oy || 0); z += s.cell2 || 0;   // (ox / oy: a layout's position offset, 0x8015c380)
  const k = CAE3D_D / Math.max(1, CAE3D_D + z);
  return [320 + (x - 320) * k, 240 + (y - 240) * k];
}
// draw picture im (w x h, pivot px, py) warped onto the projected shape: a grid of affine triangles
function cae3dWarp(q, im, s, N = 8) {
  const w = im.width, h = im.height, P = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const [X, Y] = cae3dPoint(s, i / N * w - s.px, j / N * h - s.py);
    P.push([WX(X) + (s.dx || 0), WY(Y)]);
  }
  const tri = (a, b, c, ua, va, ub, vb, uc, vc) => {
    const [x0, y0] = a, [x1, y1] = b, [x2, y2] = c;
    const den = (ub - ua) * (vc - va) - (uc - ua) * (vb - va);
    if (!den) return;
    const m11 = ((x1 - x0) * (vc - va) - (x2 - x0) * (vb - va)) / den, m12 = ((x2 - x0) * (ub - ua) - (x1 - x0) * (uc - ua)) / den;
    const m21 = ((y1 - y0) * (vc - va) - (y2 - y0) * (vb - va)) / den, m22 = ((y2 - y0) * (ub - ua) - (y1 - y0) * (uc - ua)) / den;
    q.save(); q.beginPath();
    // (each triangle grown by half a pixel so the seams don't show)
    const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3, g2 = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.6, p[1] + dy / l * 0.6]; };
    const A2 = g2(a), B2 = g2(b), C2 = g2(c);
    q.moveTo(A2[0], A2[1]); q.lineTo(B2[0], B2[1]); q.lineTo(C2[0], C2[1]); q.closePath(); q.clip();
    q.transform(m11, m21, m12, m22, x0 - m11 * ua - m12 * va, y0 - m21 * ua - m22 * va);
    q.drawImage(im, 0, 0); q.restore();
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = P[j * (N + 1) + i], b = P[j * (N + 1) + i + 1], c = P[(j + 1) * (N + 1) + i], d = P[(j + 1) * (N + 1) + i + 1];
    const u0 = i / N * w, u1 = (i + 1) / N * w, v0 = j / N * h, v1 = (j + 1) / N * h;
    tri(a, b, c, u0, v0, u1, v0, u0, v1); tri(b, d, c, u1, v0, u1, v1, u0, v1);
  }
}
// a plain white picture of a size (for layout parts that are only a colour)
const CAE_PLAIN = new Map();
function caePlain(w, h) {
  w = Math.max(1, Math.round(w || 0)); h = Math.max(1, Math.round(h || 0));
  const key = w + 'x' + h; let c = CAE_PLAIN.get(key);
  if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, w, h); CAE_PLAIN.set(key, c); }
  return c;
}
// two spare full-screen canvases for drawing 3D parts
let CAE3D_BUF = null;
function cae3dBuf(i) {
  if (!CAE3D_BUF) CAE3D_BUF = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });
  const c = CAE3D_BUF[i], q = c.getContext('2d'); q.setTransform(1, 0, 0, 1, 0, 0); q.clearRect(0, 0, W, H); return [c, q];
}
// a whole block drawn the 3D way (its parts' states from CAE.draw's reader). o: as CAE.draw (pic, state)
CAE.draw3d = function (k, b, n, f, o = {}) {
  const bl = this.block(k, b);
  if (!bl || !bl.parts || bl.node == null) return false;
  const st = bl.parts.map(p => {
    const tr = p.tracks[Math.min(n, p.tracks.length - 1)], s = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255, cell: 0, cell2: 0 };
    if (tr) for (const [t, nm, v] of tr.script) { if (t > f) break;
      if (nm === 'scale') {} else if (nm in s) s[nm] = v;
      else if (typeof nm === 'number' && nm >= 40 && nm <= 51) (s.col || (s.col = Array(12).fill(255)))[nm - 40] = v;
      else if (nm === 'angle' || nm === 17 || nm === 34 || nm === 35 || nm === 36) s['r' + nm] = v;
      else if (nm === 65) s.w = v; else if (nm === 66) s.h = v; }
    s.masked = tr ? (tr.kind & 0xf) === 1 : false;
    return s;
  });
  if (o.state) st.forEach((s, i) => o.state(i, bl.parts[i], s));
  // an '@dummy' part has no picture: the player draws it as a plain quad of its size (commands 65 / 66) in its
  // corner colours (40-51, white when unset) - HP4's title stripes and the pink half-screens that slide in
  const pic = (i) => { const p = bl.parts[i]; let im = (o.pic && o.pic(i, p)) || (p.name === '@dummy' ? caePlain(st[i].w, st[i].h) : this.pic(k, bl.node, p.sprite)); if (im && st[i].col) im = caeTint(im, st[i].col); return im; };
  const maskOf = i => st[i].masked ? st.findIndex((s, j) => j !== i && s.cell === st[i].cell - 1) : -1;
  const masks = new Set(st.map((s, i) => maskOf(i)).filter(j => j >= 0));
  // draw order: the layout manager draws the parts sorted by priority (command 1, quicksort 0x8015bce8 lowest
  // first), but each part's depth (command 12) carries the same number and the Wii's depth test keeps the nearer
  // one - so a higher number always ends up behind. Here: drawn highest first (the song card's jacket and name in
  // front of its stand, SELECT STAGE's title and stage name in front of their windows).
  // (a part used as a mask isn't drawn by itself: drawing them leaves the title's white panels over its logo,
  // which the Wii footage never shows once the logo is up. How the intro's white / pink half-screens come from the
  // masked arrows isn't worked out yet.)
  const order = st.map((s, i) => i).filter(i => !masks.has(i) && (bl.parts[i].name !== '@dummy' || st[i].w > 0) && st[i].alpha > 0 &&
    (!o.only || o.only.includes(i)) && !(o.skip && o.skip.has(i)));
  order.sort((i, j) => st[j].cell - st[i].cell || i - j);
  for (const i of order) {
    const s = st[i], im = pic(i);
    if (!im) continue;
    const mi = maskOf(i);
    if (mi >= 0) {
      const mim = pic(mi);
      if (!mim) continue;
      const [c0, q0] = cae3dBuf(0);
      q0.globalAlpha = s.alpha / 255; cae3dWarp(q0, im, s);
      const [c1, q1] = cae3dBuf(1);
      q1.globalAlpha = st[mi].alpha / 255; cae3dWarp(q1, mim, st[mi]);
      q0.globalAlpha = 1; q0.globalCompositeOperation = 'destination-in'; q0.drawImage(c1, 0, 0); q0.globalCompositeOperation = 'source-over';
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(c0, 0, 0); g.restore();
    } else {
      g.save(); g.globalAlpha *= s.alpha / 255; cae3dWarp(g, im, s); g.restore();
    }
  }
  return true;
};
// seconds since t0 -> animation frames (30 a second)
const caeFrame = t0 => (performance.now() - t0) / 1000 * 30;
// a part's colour (layout commands 40-51: red / green / blue of its four corners - top left, top right,
// bottom left, bottom right - 0-255, multiplied into the picture; HP4's white arrows on its title are tinted
// pink this way, light at the top to deep at the bottom)
const CAE_TINT = new Map();
// (see above) the picture im multiplied by the four corner colours col
function caeTint(im, col) {
  if (col.every(v => v === 255)) return im;
  let per = CAE_TINT.get(im); if (!per) CAE_TINT.set(im, per = new Map());
  const key = col.join(',');
  if (per.has(key)) return per.get(key);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const q = c.getContext('2d');
  const rgb = k => `rgb(${col[k]},${col[k + 1]},${col[k + 2]})`;
  // the four corners: two rows (top, bottom) each blended left to right, then the rows blended top to bottom
  const row = (y, a, b) => { const gr = q.createLinearGradient(0, 0, c.width, 0); gr.addColorStop(0, rgb(a)); gr.addColorStop(1, rgb(b)); return gr; };
  q.fillStyle = row(0, 0, 3); q.fillRect(0, 0, c.width, c.height);
  const lo = document.createElement('canvas'); lo.width = c.width; lo.height = c.height; const lq = lo.getContext('2d');
  lq.fillStyle = (() => { const gr = lq.createLinearGradient(0, 0, c.width, 0); gr.addColorStop(0, rgb(6)); gr.addColorStop(1, rgb(9)); return gr; })();
  lq.fillRect(0, 0, c.width, c.height);
  lq.globalCompositeOperation = 'destination-in';
  const vm = lq.createLinearGradient(0, 0, 0, c.height); vm.addColorStop(0, 'rgba(0,0,0,0)'); vm.addColorStop(1, 'rgba(0,0,0,1)');
  lq.fillStyle = vm; lq.fillRect(0, 0, c.width, c.height);
  q.drawImage(lo, 0, 0);
  q.globalCompositeOperation = 'multiply'; q.drawImage(im, 0, 0);
  q.globalCompositeOperation = 'destination-in'; q.drawImage(im, 0, 0);
  per.set(key, c);
  return c;
}

// ---- SELECT MODE: the game's numbered picture cards (two rows, staggered), the mode's dancer on the left,
// its name and help, and "SELECT MODE" with a reflection (select_bin group 0, layout blocks 0-2)
const MODE_SPOTS = [[324, 103], [468, 103], [394, 254], [538, 254]];
// SELECT MODE screen
const ModeSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, moved: 0,
  enter() { if (S.mode === 'maxcombo') S.mode = 'free';          // (the old PC-made mode is gone: DANCE MODE has the real one)
    this.i = Math.max(0, modesNow().findIndex(m => m.id === (S.mode || 'free'))); this.at = this.moved = performance.now(); MC = null; MCC = null; COURSE = null; WK = null; GC = null; BATTLE = null; CHOREO = false; PCHOREO = [false, false, false, false];
    this.intro = voice('VO_NAR_INTROGENELIC'); this.prev = null; CAE.load('sel'); },          // (0x8006eac8: once the screen has opened)
  // a card's name (table 0x802723e0), said after the pause - only once the intro line has finished
  sayCard() {
    const m = modesNow()[this.i], nm = m && m.card !== undefined ? ['VO_NAR_DANCE', 'VO_NAR_WORKOUT', 'VO_NAR_TRAINING', 'VO_NAR_DDRSCHOOL'][m.card] : null;
    if (voiceBusy(this.intro)) return;
    this.intro = null; voiceLater(nm);
  },
  input(a, p) {
    if (!p) return;
    const n = modesNow().length, d = /^P[1-4]([LDUR])$/.exec(a), was = this.i;
    if (d) {
      // (HP4: five cards, two on top and three under - up / down go to the card above / below)
      const k = d[1] === 'L' ? -1 : d[1] === 'R' ? 1 : HP4 ? (this.i % 5 < 2 ? (d[1] === 'D' ? 3 : 0) : (d[1] === 'U' ? (this.i % 5 === 2 ? -2 : -3) : 0)) : d[1] === 'U' ? -2 : 2;
      this.i = Math.max(0, Math.min(n - 1, this.i + k));
      if (this.i !== was) { sfx('SE_SYS_SELECT01'); this.prev = was; this.moved = performance.now(); this.sayCard(); }
    } else if (a === 'START') {
      S.mode = modesNow()[this.i].id; saveSettings(); sfx('SE_SYS_DECIDE01');
      MC = S.mode === 'maxcombo' ? { totals: [0, 0], songs: 0 } : null;
      if (TWO_P_MODES.includes(S.mode)) go(PlayerNum);
      else { PlayerNum.n = 1; P2 = null; go(Players.with(modeNext(), ModeSel)); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Title); }
  },
  click() { this.input('START', true); },
  // one card: the numbered gradient card with the mode's dancer shape in black and its name
  card(m, k, x, y, sc, on, t) {
    const M = A.menu || {}, ci = m.card !== undefined ? m.card : k % 4;
    const im = M.modeCard && M.modeCard[ci];
    g.save(); g.translate(WX(x), WY(y)); g.scale(sc * WS, sc * WS);
    if (on) { g.shadowColor = 'rgba(255,170,40,0.9)'; g.shadowBlur = 18 + 8 * Math.sin(t * 6); }
    if (im) g.drawImage(im, -78, -88); else { g.fillStyle = '#c050f0'; g.fillRect(-78, -88, 156, 176); }
    g.shadowBlur = 0;
    const sil = M.modeSil && M.modeSil[ci];
    if (sil) {                                     // the shape, in black, inside the card's colour panel
      if (!this.dark) this.dark = [];
      if (!this.dark[ci]) {
        const c = document.createElement('canvas'); c.width = sil.width; c.height = sil.height;
        const x2 = c.getContext('2d'); x2.drawImage(sil, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#000'; x2.fillRect(0, 0, c.width, c.height);
        this.dark[ci] = c;
      }
      // DDR II (Dolphin 2026-11-18): the chosen card shows the mode's name turned 45 degrees, half see-through,
      // instead of the shape - the same as HP4's (part 7, track 1): the shape fades out over 11 frames
      const nm2 = on && m.card !== undefined && gameNow() === 'ddr2' && M.modeCardName ? M.modeCardName[m.card] : null;
      const fSel = nm2 ? clamp(caeFrame(this.moved) / 11) : 0;
      g.save(); g.beginPath(); g.rect(-66, -54, 132, 136); g.clip();
      if (fSel < 1) {
        g.save(); g.globalAlpha *= 1 - fSel;
        g.drawImage(this.dark[ci], -sil.width * 0.36, -48, sil.width * 0.72, sil.height * 0.72);
        g.restore();
      }
      if (nm2 && fSel > 0) { g.save(); g.globalAlpha *= 0.5 * fSel; g.translate(4, 54.5); g.rotate(45 * Math.PI / 180); g.drawImage(nm2, -nm2.width / 2, -nm2.height / 2); g.restore(); }
      g.restore();
    }
    if (m.card === undefined) {                   // our extra modes: their own number on the card's badge
      g.fillStyle = '#fff'; g.fillRect(-76, -86, 30, 30);
      g.font = 'bold 24px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#7a2bd0'; g.fillText(String(k + 1), -61, -71);
    }
    const nm = m.card !== undefined && gameNow() === 'ddr2' && M.modeCardName ? M.modeCardName[m.card] : null;
    if (nm) {                                      // the name, dark, on the card's white top strip
      if (!this.darkName) this.darkName = [];
      if (!this.darkName[m.card]) {
        const c = document.createElement('canvas'); c.width = nm.width; c.height = nm.height;
        const x2 = c.getContext('2d'); x2.drawImage(nm, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#2a2a3a'; x2.fillRect(0, 0, c.width, c.height);
        this.darkName[m.card] = c;
      }
      g.drawImage(this.darkName[m.card], -42, -86, 96, 32);
    }
    else {
      const words = modeName(m).split(' '), half = Math.ceil(words.length / 2);
      [words.slice(0, half).join(' '), words.slice(half).join(' ')].forEach((s, j) => {
        g.font = `bold ${fitSize(s, 15, 108)}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(s, -38, -76 + j * 16); g.fillStyle = '#222'; g.fillText(s, -38, -76 + j * 16);
      });
    }
    g.restore();
  },
  // HP4's SELECT MODE (select_bin group 0): block 0's dummies hold the places - 0 the chosen mode's dancer
  // (big, on the left, with its white shape behind: groups 3-7; dummies 1-5 not traced), 6-10 the five cards (two on top, three
  // under), 11-15 their reflections (alpha 64, upside down); tracks 0 in / 1 out. A card = the numbered
  // gradient card (/0/1/0/0), the mode's dancer in colour inside it (/0/1/0/1-5), its name (/0/1/0/6) on
  // the white top strip. Block 2: "SELECT MODE" and the mode's name and line (tracks 0 in, 1 out, 2 change).
  drawHp4(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      H4.cards = await one('/0/1/0/0'); H4.inCard = await Promise.all([1, 2, 3, 4, 5].map(k => one('/0/1/0/' + k).then(x => x[0])));
      H4.cardName = await one('/0/1/0/6'); H4.title = (await one('/0/2/0/0'))[0];
      H4.name = await one('/0/2/0/1'); H4.help = await one('/0/2/0/2');
      H4.dancer = await Promise.all([3, 4, 5, 6, 7].map(k => one('/0/' + k + '/0/0').then(x => x[0])));
      H4.sil = await Promise.all([3, 4, 5, 6, 7].map(k => one('/0/' + k + '/0/1').then(x => x[0])));
      H4.ok = true;
    })();
    if (!H4.ok || !CAE.block('sel', 0)) return false;
    menuBackground(t);
    const L = modesNow(), m = L[this.i], page = Math.floor(this.i / 5);
    const out = LEAVE && LEAVE.from === this, tk = out ? 1 : 0, fIn = out ? caeFrame(LEAVE.t0) : caeFrame(this.at), fMv = caeFrame(this.moved);
    const P = i => CAE.part('sel', 0x140, i), at = (i, n, f) => CAE.at(P(i), n, f);
    const ci = q => q && q.hp4 !== undefined ? q.hp4 : null;
    // the chosen mode's dancer and its white shape (slides in again when the choice changes)
    const di = ci(m);
    if (di !== null) {
      // (dummy 0's place for every mode's dancer: the other dummies' places don't fit the pictures - not traced)
      const ds = out ? at(0, 1, fIn) : at(0, 0, Math.min(fMv * 2 + 20, 31)), dx = ds ? ds.x : 108, dy = ds ? ds.y : 213, da = ds ? ds.alpha / 255 : 1;
      // its shape (/0/k/0/1) is the dancer's shadow on the floor: turned upside down at the soles and dark,
      // see-through (Dolphin footage of the real SELECT MODE) - not a white shape behind
      const sil = H4.sil[di], dp = H4.dancer[di];
      floorShadow(sil, dp, dx, dy, da);
      wspr(dp, dx, dy, 100, 120, 1, 1, da);
    }
    L.slice(page * 5, page * 5 + 5).forEach((q, j) => {
      const i = page * 5 + j, on = i === this.i, cs = at(6 + j, tk, fIn), rs = at(11 + j, tk, fIn);
      if (!cs) return;
      const sc = on ? 1 : 0.7, c = ci(q);
      const card = (x, y, sy, a) => {
        g.save(); g.globalAlpha *= a; g.translate(WX(x), WY(y)); g.scale(sc * WS, sy * sc * WS);
        if (on && sy > 0) { g.shadowColor = 'rgba(255,170,40,0.9)'; g.shadowBlur = 18 + 8 * Math.sin(t * 6); }
        const im = H4.cards[c !== null ? c : j];
        if (im) g.drawImage(im, -78, -88);
        g.shadowBlur = 0;
        // inside the card (block 1, Dolphin footage): the mode's dancer as a black silhouette (its track kind
        // 0x21), and on the chosen card the dancer fades out over 11 frames as the mode's name, turned 45
        // degrees, fades up to half see-through (part 7, track 1)
        const ch = c !== null ? H4.inCard[c] : null, fSel = on ? clamp(fMv / 11) : 0;
        g.save(); g.beginPath(); g.rect(-66, -54, 132, 136); g.clip();
        if (ch && fSel < 1) { g.globalAlpha *= 1 - fSel; g.drawImage(tintCopy(ch, '#000'), -ch.width * 0.36, -48, ch.width * 0.72, ch.height * 0.72); g.globalAlpha /= 1 - fSel || 1; }
        const nmp = c !== null ? H4.cardName[c] : null;
        if (nmp && fSel > 0) { g.save(); g.globalAlpha *= 0.5 * fSel; g.translate(16 - 12, 34.5 + 20); g.rotate(45 * Math.PI / 180); g.drawImage(nmp, -nmp.width / 2, -nmp.height / 2); g.restore(); }
        g.restore();
        const nm = c !== null ? H4.cardName[c] : null;
        if (nm) {
          if (!H4.dark) H4.dark = [];
          if (!H4.dark[c]) { const cv = document.createElement('canvas'); cv.width = nm.width; cv.height = nm.height; const x2 = cv.getContext('2d'); x2.drawImage(nm, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#2a2a3a'; x2.fillRect(0, 0, cv.width, cv.height); H4.dark[c] = cv; }
          g.drawImage(H4.dark[c], -42, -86, 96, 32);
        } else { g.font = 'bold 15px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#222'; g.fillText(modeName(q), -40, -72); }
        g.restore();
      };
      if (rs && rs.alpha > 0) card(rs.x, rs.y - (sc < 1 ? 176 * (1 - sc) : 0), -1, rs.alpha / 255);
      card(cs.x, cs.y, 1, cs.alpha / 255);
    });
    if (L.length > 5) {
      const pages = Math.ceil(L.length / 5);
      for (let q = 0; q < pages; q++) { g.fillStyle = q === page ? '#ff3ca0' : 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(WX(600) + q * 26, WY(22), 7, 0, Math.PI * 2); g.fill(); }
    }
    // "SELECT MODE" and the mode's name and line (block 2: parts 0 / 1 the title and its reflection, 2 / 3 the
    // name, 4 / 5 the line)
    const B2 = 0xa0260, p2 = i => CAE.part('sel', B2, i);
    const nameHelp = (q, n, f, fall) => {
      const c = ci(q);
      [[2, H4.name], [3, H4.name], [4, H4.help], [5, H4.help]].forEach(([pi, set]) => {
        const s2 = n === null ? CAE.at(p2(pi), 2, 99) : CAE.at(p2(pi), n, f);
        if (!s2) return;
        const im0 = c !== null ? set[c] : null, im = im0 ? tintCopy(im0, '#000') : null, a = (n === null ? fall : 1) * s2.alpha / 255;
        if (im) wspr(im, s2.x, s2.y, s2.px, s2.py, s2.sx, s2.sy, a);      // (black on HP4's pink: footage)
        else if (s2.sy > 0) { g.globalAlpha = a; text(pi < 4 ? modeName(q) : q.help, WX(s2.x - s2.px * s2.sx), WY(s2.y), pi < 4 ? 26 : fitSize(q.help, 20, WX(560), 'bold'), '#fff', 'left'); g.globalAlpha = 1; }
      });
    };
    if (out) nameHelp(m, 1, fIn);
    else {
      if (this.prev != null && L[this.prev] && fMv < 15) nameHelp(L[this.prev], 1, fMv);
      nameHelp(m, 2, this.prev != null ? fMv : fIn);          // (track 0 keeps the name hidden: track 2 brings it in)
    }
    [0, 1].forEach(pi => { const s2 = CAE.at(p2(pi), tk, fIn); if (s2) wspr(H4.title, s2.x, s2.y, s2.px, s2.py, s2.sx, s2.sy, s2.alpha / 255); });
    if (this.note && performance.now() - this.noteAt < 2500) text(this.note, W / 2, WY(330), 24, '#fff', 'center');
    keyHints('Arrows: select    Enter: confirm    Esc: back');
    return true;
  },
  draw(t) {
    if (HP4) {
      if (this.drawHp4(t)) return;
      // (still reading the screen's pictures / layout from the disc - only on the first visit: just the
      // background, and the build-in starts once they're in, rather than DDR II's plain screen for a moment
      // and then HP4's coming in over it)
      CAE.load('sel'); this.at = this.moved = performance.now(); menuBackground(t); return;
    }
    menuBackground(t);
    const M = A.menu || {}, L = modesNow(), m = L[this.i], k = clamp((performance.now() - this.at) / 300);
    const page = Math.floor(this.i / 4), mk = clamp((performance.now() - this.moved) / 250);
    // the dancer of the mode on the left: its white shape a little behind, then the dancer
    const di = m.card !== undefined ? m.card : this.i % 4;
    // (leaving: select_bin CAE 0x140 parts 0-3, track 1 - the dancer slides 200 to the left and fades)
    const dOut = LEAVE && LEAVE.from === this ? CAE.at(CAE.part('sel', 0x140, Math.min(3, di)), 1, caeFrame(LEAVE.t0)) : null;
    const dr = dOut ? caeRest(CAE.part('sel', 0x140, Math.min(3, di)), 1, false) : null;
    const dx = dOut ? dOut.x - dr.x : (1 - mk) * -30, dA = dOut ? dOut.alpha / 255 : 1;
    floorShadow(M.dancerSil && M.dancerSil[di], M.dancer && M.dancer[di], 180 + dx, 216, mk * dA);
    g.globalAlpha = mk * dA; wspr(M.dancer && M.dancer[di], 180 + dx, 216, 100, 120); g.globalAlpha = 1;
    // the cards of this page (4 to a page), the chosen one full size, the others at 0.7, each with its reflection
    // (their entrance: select_bin CAE 0x140 parts 4-7, track 0 - each slides 62 in from the left and fades
    // up over 8 frames, one after another; parts 8-11 their reflections, up to alpha 64)
    // (leaving: every part's track 1 - the cards, their reflections, the dancer, the name / help and SELECT
    // MODE slide 100 to the left and fade out over 10 frames)
    const out = LEAVE && LEAVE.from === this, fIn = out ? caeFrame(LEAVE.t0) : caeFrame(this.at), tk = out ? 1 : 0;
    L.slice(page * 4, page * 4 + 4).forEach((md, j) => {
      const i = page * 4 + j, on = i === this.i, [x, y] = MODE_SPOTS[j];
      const cs = CAE.at(CAE.part('sel', 0x140, 4 + j), tk, fIn), rs = CAE.at(CAE.part('sel', 0x140, 8 + j), tk, fIn);
      const ox = cs ? cs.x - x : (1 - k) * 26, ca = cs ? cs.alpha / 255 : k, ra = rs ? rs.alpha / 255 : k * 0.22;
      g.globalAlpha = ca;
      const sc = on ? 1 : 0.7;
      if (j >= 2) { const yr = y + 176 * sc + 2; g.save(); g.globalAlpha = ra; g.translate(0, WY(yr) * 2); g.scale(1, -1); this.card(md, i, x + ox, yr, sc, false, t); g.restore(); }
      this.card(md, i, x + ox, y, sc, on, t);
      g.globalAlpha = 1;
    });
    if (L.length > 4) {                           // more modes on the next page
      const pages = Math.ceil(L.length / 4);
      for (let q = 0; q < pages; q++) { g.fillStyle = q === page ? '#ff3ca0' : 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(WX(600) + q * 26, WY(22), 7, 0, Math.PI * 2); g.fill(); }
    }
    // the mode's name and help (the game's pictures for its four), then SELECT MODE, both mirrored below
    // (select_bin CAE 0xc1c20: part 2 the mode's name, 4 its help - on a change the old ones slide out to
    // the left (track 1, 10 frames) while the new ones rise into place (track 2, 12 frames); part 0 SELECT
    // MODE slides in from the right on entry (track 0, 10 frames))
    const fMv = caeFrame(this.moved), cardOf = q => q && q.card !== undefined && gameNow() === 'ddr2' ? q.card : null;
    const drawNameHelp = (q, ns, hs, fall) => {
      const c = cardOf(q), nameImg = c !== null && M.modeName ? M.modeName[c] : null, helpImg = c !== null && M.modeHelp ? M.modeHelp[c] : null;
      const nx = ns ? ns.x : 128, ny = ns ? ns.y : 351, na = ns ? ns.alpha / 255 : fall;
      const hx = hs ? hs.x : 331, hy = hs ? hs.y : 378, ha = hs ? hs.alpha / 255 : fall;
      if (!wspr(nameImg, nx, ny, 96, 32, 0.75, 0.675, na)) { g.globalAlpha = na; text(modeName(q), WX(nx - 98), WY(ny), 30, '#fff', 'left'); g.globalAlpha = 1; }
      if (helpImg) { wspr(helpImg, hx, hy, 280, 13, 1, 0.9, ha); wspr(helpImg, hx, hy + 80, 280, 13, 1, -0.9, ha * 0.4); }
      else { g.globalAlpha = ha; text(q.help, WX(hx - 279), WY(hy), fitSize(q.help, 22, WX(560), 'bold'), '#fff', 'left'); g.globalAlpha = 1; }
    };
    const pN = CAE.part('sel', 0xc1c20, 2), pH = CAE.part('sel', 0xc1c20, 4);
    if (out && pN) drawNameHelp(m, CAE.at(pN, 1, fIn), CAE.at(pH, 1, fIn), 0);
    else {
      if (this.prev != null && L[this.prev] && pN && fMv < 11) drawNameHelp(L[this.prev], CAE.at(pN, 1, fMv), CAE.at(pH, 1, fMv), 0);
      const moving = this.prev != null && pN && fMv < 13;
      drawNameHelp(m, moving ? CAE.at(pN, 2, fMv) : null, moving ? CAE.at(pH, 2, fMv) : null, mk);
    }
    const hd = CAE.at(CAE.part('sel', 0xc1c20, 0), tk, fIn), hx = hd ? hd.x : 216, ha = hd ? hd.alpha / 255 : k;
    if (M.selectMode) { wspr(M.selectMode, hx, 405, M.selectMode.width / 2, M.selectMode.height / 2, 1, 0.9, ha); wspr(M.selectMode, hx, 436, M.selectMode.width / 2, M.selectMode.height / 2, 1, -0.9, ha * 0.5); }
    else { g.globalAlpha = ha; text('SELECT MODE', WX(hx), WY(405), 40, '#fff', 'center'); g.globalAlpha = 1; }
    const best = m.id === 'maxcombo' && SAVE.modeRecords && SAVE.modeRecords.maxcombo;
    if (best) text('BEST ' + Object.entries(best).map(([st, n]) => st.toUpperCase() + ' ' + n).join('   '), WX(331), WY(330), 18, '#ffe86a', 'center');
    keyHints('Arrows: select    Enter: confirm    Esc: back');
  },
};

// ---- SELECT NUMBER OF PLAYERS (select_bin group 1): five picture cards; 3, 4 players and SYNC. GUEST
// (adding Wii Remotes) aren't in this version, so they're shown greyed
const PlayerNum = {
  bgm: 'MU_BGM_FREE',
  i: 0, n: 1, at: 0,
  cards: [{ n: 1, help: 'Play with 1 player.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' }, { n: 2, help: 'Play with 2 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' },
          { n: 3, help: 'Play with 3 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' }, { n: 4, help: 'Play with 4 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' },
          { n: 0, off: true, help: 'To add Wii Remotes,\nselect SYNCHRONIZE GUEST.\n(Not used on PC: every mat and pad is already on.)' }],
  enter() { this.i = Math.max(0, Math.min(3, this.n - 1)); this.at = performance.now(); voice('VO_NAR_SELECTNUMPLY'); },   // (0x8008c5e4)
  input(a, p) {
    if (!p) return;
    const d = /^P[1-4]([LR])$/.exec(a);
    if (d) { const j = Math.max(0, Math.min(4, this.i + (d[1] === 'L' ? -1 : 1))); if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const c = this.cards[this.i];
      if (c.off) { sfx('SE_SYS_CANCEL'); return; }
      this.n = c.n; if (c.n === 1) P2 = null; if (c.n < 3) PX = [];
      // (3 and 4 players: the modes that take 2 players, NORMAL / FRIENDSHIP / SYNC)
      sfx('SE_SYS_DECIDE01'); go(Players.with(modeNext(), PlayerNum));
    } else if (a === 'BACK') {
      const m = !HP4 && modesNow().find(x => x.id === (S.mode || 'free'));
      if (m) askYesNo('Exit ' + modeName(m) + '?', false, () => go(ModeSel));        // (DDR II asks first, YES chosen - Wii)
      else { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
    }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300);
    menuTitle(M.playersTitle, 'SELECT NUMBER OF PLAYERS');
    // the layout's card anchors (CAE 0x16a080 @dummy: x 100 / 210 / 320 / 430 / 540, y 186), spread for 16:9 - on the
    // Wii screen they sit 220 px apart about the middle (Dolphin 2026-11-18); each card sele_wind at scale 0.7, the
    // chosen one growing to 1.0 (0x1ca040 track 1)
    const AXL = cx => 320 + (cx - 320) * 2 / 1.5262;
    this.cards.forEach((c, i) => {
      const on = i === this.i, x = AXL([100, 210, 320, 430, 540][i]) + (1 - k) * 20, y = 186, sc = on ? (0.7 + 0.3 * cardGrow(this)) * cardBounce() : 0.7;
      g.save(); g.globalAlpha = k;     // (SYNC. GUEST looks as on the Wii, though the PC has no use for it)
      if (on) wspr(M.cardOn, x, y, 76, 94, sc, sc, 0.75 + 0.25 * Math.sin(t * 6));
      if (!wspr(M.cards && M.cards[i], x, y, 66, 84, sc, sc)) { g.fillStyle = '#29a8f0'; g.fillRect(WX(x) - 67, WY(y) - 86, 134, 172); text(c.n ? c.n + 'P' : 'SYNC', WX(x), WY(y), 30, '#fff', 'center'); }
      g.restore();
    });
    helpWindow(this.cards[this.i].help);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};

// ---- SELECT RECORD DATA (select_bin group 9, layout: a 3 x 2 grid of record windows): the game has
// RECORD A-D, GUEST and EDIT. Here the records are your players (as many as you like, 4 shown at a time;
// "New Entry" makes one), GUEST plays without saving, EDIT deletes a record. With 2 players, each picks.
// real game: RECORD A-D in a row, GUEST and EDIT under them
// (the layout's anchors - CAE 0xc887a0 @dummy: RECORD A-D at x 107 / 249 / 391 / 533, y 158; GUEST (199, 268), EDIT
// (442, 268); on the Wii screen 1.5 px a unit about the middle - Dolphin screenshot 2026-11-18)
const REC_SPOTS = [[107, 158], [249, 158], [391, 158], [533, 158], [199, 268], [442, 268]];
// SELECT RECORD DATA screen: pick RECORD A-D or GUEST, make / edit / delete a player
const Players = {
  bgm: 'MU_BGM_FREE',
  i: 0, top: 0, typing: null, ask: null, edit: false, msg: '', who: 0, next: null, back: null,
  names() { return Object.keys(DATA.profiles); },
  with(next, back) { this.next = next; this.back = back; if (next !== Select) this.recMode = false; return this; },
  recs() { return this.names().concat(['']); },                 // '' = New Entry
  enter() {
    const n = this.names();
    this.who = 0; this.edit = false; this.ask = null; this.msg = '';
    const k = Math.max(0, n.indexOf(DATA.current));
    this.top = Math.max(0, k - 3); this.i = k - this.top;
    this.typing = n.length ? null : '';
    this.at = performance.now();
    voice('VO_NAR_SELECTRECDATA');                          // (0x8011bec0, SELECT RECORD DATA opening)
  },
  two() { return !this.recMode && PlayerNum.n >= 2 && TWO_P_MODES.includes(S.mode) && this.next === Style; },
  count() { return this.two() ? PlayerNum.n : 1; },
  // a player's record is picked (null = GUEST)
  choose(name) {
    if (this.who === 0) {
      if (name) { usePlayer(name); fit(); writeSave(true); saveSettings(); }
      else { DATA.current = null; SAVE = { points: 0, records: {} }; }
      sfx('SE_SYS_DECIDE01');
      if (this.two()) { this.who = 1; this.edit = false; this.msg = ''; P2 = null; PX = []; return; }
    } else {
      // (each record can be used by one player at a time)
      const taken = [DATA.current, P2 && P2.name, ...PX.map(x => x && x.name)].slice(0, this.who);
      const by = name ? taken.indexOf(name) : -1;
      if (by >= 0) { this.msg = 'This data is already in use by Player ' + (by + 1) + '.'; sfx('SE_SYS_CANCEL'); return; }
      const prof = name && DATA.profiles[name];
      const P = { name, diff: prof && prof.opts && prof.opts.diff !== undefined ? prof.opts.diff : S.diff };
      if (this.who === 1) P2 = P; else PX[this.who - 2] = P;
      sfx('SE_SYS_DECIDE01');
      if (this.who + 1 < this.count()) { this.who++; this.edit = false; this.msg = ''; PX.length = Math.max(0, this.who - 2); return; }
    }
    if (this.recMode) { this.recMode = false; Select.records = true; Select.recView = 2; Select.recStyle = Select.recStyle || 0; go(Select); return; }
    go(this.next || ModeSel);
  },
  slot(j) {                                                     // grid slot -> {kind, name}
    if (this.recMode && (j >= 4 || !this.recs()[this.top + j])) return { kind: 'none' };
    if (j === 4) return { kind: 'guest' };
    if (j === 5) return { kind: 'edit' };
    const r = this.recs(), k = this.top + j;
    return k < r.length ? { kind: r[k] ? 'rec' : 'new', name: r[k] } : { kind: 'none' };
  },
  input(a, p) {
    if (!p || this.typing !== null) return;
    if (this.ask) {
      const q = this.ask; this.ask = null;
      if (a !== 'START') { sfx('SE_SYS_WINDOWOUT'); return; }
      if (q.kind === 'del') {
        delete DATA.profiles[q.name];
        if (DATA.current === q.name) { DATA.current = null; SAVE = { points: 0, records: {} }; }
        api('/api/save', DATA).catch(() => {});
        this.msg = 'Deleted ' + q.name + '.'; this.top = 0; this.i = 0; this.edit = false;
      } else if (q.kind === 'guest') this.choose(null);
      return;
    }
    const d = /^P[1-4]([LDUR])$/.exec(a);
    if (d) {
      const r = this.recs(), was = this.i + 100 * this.top;
      if (d[1] === 'L') { if (this.i === 0 && this.top > 0) this.top--; else if (this.i > 0) this.i--; }
      else if (d[1] === 'R') { if (this.i === 3 && this.top + 4 < r.length) this.top++; else if (this.i < 5) this.i++; }
      else if (d[1] === 'U') { if (this.i >= 3) this.i -= 3; else if (this.top > 0) this.top--; }
      else if (d[1] === 'D') { if (this.i < 3) this.i += 3; else if (this.i === 3 && this.top + 4 < r.length) this.top++; }
      while (this.i < 4 && this.slot(this.i).kind === 'none' && this.i > 0) this.i--;
      if (this.i + 100 * this.top !== was) sfx('SE_SYS_SELECT01');
      return;
    }
    if (a === 'START') {
      const s = this.slot(this.i);
      if (s.kind === 'edit') { this.edit = !this.edit; this.msg = ''; sfx('SE_SYS_DECIDE02'); if (this.edit) this.i = 0; return; }
      if (this.edit) {
        if (s.kind === 'rec') { this.ask = { kind: 'del', name: s.name }; sfx('SE_SYS_WINDOWIN'); }
        return;
      }
      if (s.kind === 'rec') this.choose(s.name);
      else if (s.kind === 'new') { this.typing = ''; sfx('SE_SYS_DECIDE02'); }
      else if (s.kind === 'guest') { this.ask = { kind: 'guest' }; sfx('SE_SYS_WINDOWIN'); }
    } else if (a === 'OPTIONS' && !this.recMode) { const s = this.slot(this.i); if (s.kind === 'rec') { this.ask = { kind: 'del', name: s.name }; sfx('SE_SYS_WINDOWIN'); } }
    else if (a === 'BACK') {
      if (this.edit) { this.edit = false; sfx('SE_SYS_WINDOWOUT'); return; }
      if (this.who >= 1) { this.who--; sfx('SE_SYS_WINDOWOUT'); return; }
      if (this.recMode) { sfx('SE_SYS_WINDOWOUT'); this.recMode = false; Select.records = false; Select.recView = 0; go(Select); return; }
      // (DDR II: a one-player mode that skips SELECT NUMBER OF PLAYERS asks here instead - "Exit TRAINING MODE?",
      // YES chosen - Wii 2026-11-18)
      const m = !HP4 && (this.back || ModeSel) === ModeSel && modesNow().find(x => x.id === (S.mode || 'free'));
      if (m) { askYesNo('Exit ' + modeName(m) + '?', false, () => go(ModeSel)); return; }
      sfx('SE_SYS_WINDOWOUT');
      go(this.back || ModeSel);
    }
  },
  key(e) {
    if (this.typing === null) return;
    e.preventDefault();
    if (e.code === 'Escape') { this.typing = this.names().length ? null : ''; if (this.typing === '' ) go(this.back || ModeSel); return; }
    if (e.code === 'Backspace') { this.typing = this.typing.slice(0, -1); return; }
    if (e.code === 'Enter') {
      const name = this.typing.trim();
      if (!name) return;
      if (DATA.profiles[name]) { this.msg = name + ' already exists.'; return; }
      DATA.profiles[name] = { points: 0, records: {}, opts: {} };
      this.typing = null;
      this.choose(name);
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 .!?\\-]/.test(e.key) && this.typing.length < 8) this.typing += e.key.toUpperCase();
  },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300);
    menuTitle(M.dataTitle, 'SELECT RECORD DATA');
    if (this.two()) text('PLAYER ' + (this.who + 1), W - 40, 60, 30, ['#3aa0ff', '#ff5aa0', '#3cc060', '#f0a020'][this.who], 'right');
    for (let j = 0; j < 6; j++) {
      const s = this.slot(j), [x, y] = REC_SPOTS[j], on = j === this.i && this.typing === null;
      if (s.kind === 'none') continue;
      const big = j >= 4, cx = 640 + (x - 320) * 1.5, cy = WY(y), sc = on ? (1 + (big ? 0.22 : 0.12) * cardGrow(this)) * cardBounce() : 1;     // (the chosen GUEST / EDIT 1.22x - Dolphin screenshot)
      const bw = (big ? 225 : 165) * sc, bh = 95 * sc;
      g.save(); g.globalAlpha = k * (this.edit && s.kind !== 'rec' && s.kind !== 'edit' ? 0.4 : 1);
      const frame = big ? M.geOn : M.recOn;
      if (on && frame) { const fw = bw * 1.12, fh = bh * 1.16; g.globalAlpha *= 0.85 + 0.15 * Math.sin(t * 6); g.drawImage(frame, cx - fw / 2, cy - fh / 2, fw, fh); g.globalAlpha = k; }
      const im = big ? (M.guestEdit && M.guestEdit[j - 4]) : M.recBtn;
      if (im) g.drawImage(im, cx - bw / 2, cy - bh / 2, bw, bh); else { g.fillStyle = '#7fe0ff'; g.fillRect(cx - bw / 2, cy - bh / 2, bw, bh); }
      if (s.kind === 'rec' || s.kind === 'new') {
        // the name in the dark label at the top, the record's points below
        const nm = s.kind === 'rec' ? s.name : 'NEW ENTRY';
        gtext(nm, cx, cy - bh * 0.27, Math.min(26, 26 * 120 / Math.max(1, gfontWidth(nm, 26, 2))) * sc, '#fff', 'center', 2, 1);
        if (s.kind === 'rec') {
          const pr = DATA.profiles[s.name] || {};
          gtext((pr.points || 0) + ' pts', cx, cy + bh * 0.2, 18 * sc, '#14306e', 'center', 2, 1);
        }
        if (this.who >= 1 && s.name === DATA.current && M.badges && M.badges[0]) g.drawImage(M.badges[0], cx - bw / 2 - 8, cy - bh / 2 - 22, 40, 40);
        else if (on && M.badges && M.badges[this.who]) g.drawImage(M.badges[this.who], cx - bw / 2 - 8, cy - bh / 2 - 22, 40, 40);
        else if (on && this.who >= 2) { g.fillStyle = this.who === 2 ? '#3cc060' : '#f0a020'; g.beginPath(); g.arc(cx - bw / 2 + 12, cy - bh / 2 - 2, 18, 0, Math.PI * 2); g.fill(); text(String(this.who + 1), cx - bw / 2 + 12, cy - bh / 2 - 1, 20, '#fff', 'center'); }
      }
      if (s.kind === 'edit' && this.edit) gtext('DONE', cx, cy + 20, 20, '#14306e', 'center', 2, 1);
      g.restore();
    }
    const n = this.recs().length;
    if (this.top > 0) text('◀', WX(28), WY(163), 40, '#ff3ca0', 'center');
    if (this.top + 4 < n) text('▶', WX(612), WY(163), 40, '#ff3ca0', 'center');
    const help = this.ask ? (this.ask.kind === 'del' ? 'Are you sure you want to delete\nthis record data?   (' + this.ask.name + ')\nEnter: YES    Esc: NO'
                                                     : 'Game play results will not be\nsaved. Is this okay?\nEnter: YES    Esc: NO')
      : this.msg ? this.msg
      : this.edit ? 'Select the record data\nyou want to delete.'
      : this.recMode ? 'Select the record data\nyou want to view.'
      : this.who >= 1 ? 'Select player data for Player ' + (this.who + 1) + '.\nSelecting "GUEST" will not\nsave any record data.'
      : 'Select the record data you want\nto use. Selecting "GUEST" will not\nsave any record data.';
    helpWindow(help, 319, 381, true);
    if (this.typing !== null) {
      g.fillStyle = 'rgba(0,30,90,0.75)'; g.fillRect(0, 0, W, H);
      helpWindow('Type a name (up to 8 letters),\nthen press Enter.', 319, 300);
      g.fillStyle = 'rgba(0,20,70,0.92)'; g.fillRect(420, 250, 440, 70);
      text(this.typing + ((t * 2 | 0) % 2 ? '_' : ' '), 640, 285, 40, '#fff', 'center');
      text('NAME', 640, 225, 28, '#ffd23c', 'center');
    }
    keyHints(this.typing !== null ? 'Enter: OK    Esc: cancel' : 'Arrows: select    Enter: confirm    Tab: delete    Esc: back');
  },
};

// ---- SELECT STYLE (select_bin group 1 cards: NORMAL, FRIENDSHIP, SYNC, DOUBLE). 1 player: NORMAL or DOUBLE;
// 2 players: NORMAL (each scored on their own), FRIENDSHIP and SYNC (shared judgments: not in this version
// yet, greyed), and 2 PLAYERS DOUBLE (two mats each, a PC extra)
function styleCards() {
  const two = PlayerNum.n >= 2 && TWO_P_MODES.includes(S.mode), many = two && PlayerNum.n > 2, hasD = !many && stylesNow().some(st => st.style === 'double');
  const L = two ? [
    { card: 5, name: 'NORMAL', style: 'single', two: true, help: 'For 2 player. Normal gameplay.' },
    { card: 6, name: 'FRIENDSHIP', style: 'single', two: true, group: 'friend', help: 'For 2 or more players. The highest\njudgment in the group for each arrow\nis awarded to all players.' },
    { card: 7, name: 'SYNC', style: 'single', two: true, group: 'sync', help: 'For 2 or more players. Group judgment\nis based on the lowest accuracy. A "MISS"\nor "NOT QUITE" score will fail the game!' },
    { card: 8, name: '2P DOUBLE', style: 'double', two: true, badge: '2P', help: 'For 2 players with 2 DDR Controllers each\n(4 mats in all).' },
  ].concat(PlayerNum.n === 2 && S.mode === 'free' ? [{ card: -1, name: 'TEAM', style: 'single', two: true, group: 'team', team: true,
    help: 'For 2 players, one chart. Take turns: the song\nswitches between you, with one life bar and\none score. Watch for GET READY!' }] : []) : [                                        // (the real game shows all four, the group styles greyed)
    { card: 5, name: 'NORMAL', style: 'single', two: false, help: 'For 1 player. Normal gameplay.' },
    { card: 6, name: 'FRIENDSHIP', off: true, help: 'For 2 or more players. The highest\njudgment in the group for each arrow\nis awarded to all players.' },
    // (PC: in DANCE MODE, SYNC's place - it needs 2 players - is the battle against the computer)
    S.mode === 'free' ? { card: -1, name: 'BATTLE CPU', style: 'single', two: false, battle: true, help: 'For 1 player. Dance against a\ncomputer opponent, 2 player VERSUS style.\nBeat its score to win!' }
      : { card: 7, name: 'SYNC', off: true, help: 'For 2 or more players. Group judgment\nis based on the lowest accuracy. A "MISS"\nor "NOT QUITE" score will fail the game!' },
    { card: 8, name: 'DOUBLE', style: 'double', two: false, help: 'For 1 player only. This style is\nplayable with 2 DDR Controllers.' },
  ];
  // HP4 TRAINING MODE: SELECT STYLE shows two cards instead (0x800853e8: layout 0 for scene kind 0x17, cards
  // 9 TRAINING and 10 DANCE VIEW from 0x802b6ee0, voices 0x1e8 VO_NAR_TRTRAIN / 0x1e9 VO_NAR_TRDANCEVIEW).
  // The screen is titled SELECT MODE there, with the help lines text_eng 4472 / 4473 (seen on the Wii).
  if (HP4 && S.mode === 'training') return [
    { card: 9, name: 'TRAINING', style: 'single', two: false, train: 'step', help: HP4_TEXT['4472'] || 'Practice dancing on your own.\nUse the assist feature to focus\non the difficult areas,\nor enjoy your favorite parts!' },
    { card: 10, name: 'DANCE VIEW', style: 'single', two: false, train: 'view', help: HP4_TEXT['4473'] || 'View the dances from different angles. Beat\nmore levels in the game to unlock more viewable\ndances!' }];
  // HP4: no DOUBLE; its card 8 is FAMILY (text_eng 4648), 2+ players: the single chart split in two
  // (charts 0x24 / 0x34), one half per side (familySide)
  if (HP4) return L.filter(c => c.style !== 'double').concat([Object.assign({ card: 8, name: 'FAMILY',
    help: 'In this style, 2 or more players\nsplit the left and right notes between\nthemselves. Help each other out!' },
    two ? { style: 'single', two: true, group: 'family' } : { off: true })]);
  // DDR II TRAINING MODE: only NORMAL and DOUBLE (Wii, Dolphin 2026-11-18)
  if (S.mode === 'training') return L.filter(c => c.name === 'NORMAL' || (c.style === 'double' && hasD));
  return L.filter(c => c.style !== 'double' || hasD);
}
// ---- DDR HP4's SELECT DANCE (select_bin group 14): CLASSIC (the arrows only) or CHOREOGRAPH (the arrows and
// the hand markers - the 0x?1a charts). Block /14/0's dummies hold the places: (320, 208) one panel for
// everyone ("PLAYER 1" / "ALL PLAYERS", /14/2) - the game's per-player panels (/14/1 at x 99 / 246 / 395 / 543)
// with 2-4 players each has their own small panel (PLAYER n, /14/1) at slot n, with the small buttons (/14/3).
// A panel's two buttons (CLASSIC, CHOREOGRAPH) at its dummies (0, -18) and (0, +70); tracks 0 idle (x0.8),
// 1 chosen (x1.0, the green window under it and OK); choosing CHOREOGRAPH shows its explanation (/14/5) on
// the dimmed screen (/14/6: black at alpha 127, the picture sliding down to the middle).
const DanceSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, pop: 0, joinAfter: false,
  n() { return 1 + (P2 ? 1 : 0) + (P2 ? PX.filter(Boolean).length : 0); },
  enter() { this.sel = PCHOREO.map(v => v ? 1 : 0); this.i = this.sel[0]; this.at = performance.now(); this.pop = 0; this.ok = 0; },
  input(a, p) {
    if (!p) return;
    if (this.pop) {
      if (a === 'START') { sfx('SE_SYS_DECIDE01'); this.done(); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.pop = 0; }
      return;
    }
    const m = /^P([1-4])([UD])$/.exec(a);
    if (m) {
      const who = this.n() > 1 ? +m[1] - 1 : 0, j = m[2] === 'U' ? 0 : 1;
      if (who < this.n() && j !== this.sel[who]) { this.sel[who] = j; if (!who) this.i = j; sfx('SE_SYS_SELECT01'); }
    }
    else if (a === 'START') {
      sfx('SE_SYS_DECIDE01'); this.ok = performance.now();
      if (this.sel.slice(0, this.n()).some(v => v)) { this.pop = performance.now(); sfx('SE_SYS_WINDOWIN'); } else this.done();
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Style); }
  },
  done() {
    PCHOREO = [0, 1, 2, 3].map(k => k < this.n() && this.sel[k] === 1);
    // (FAMILY: one chart split between the players - their split charts are one style, player 1's)
    if (GROUP === 'family') PCHOREO = PCHOREO.map(() => PCHOREO[0]);
    CHOREO = PCHOREO[0];
    if (!HP4 && S.mode === 'workout') { go(WkData); return; }     // DDR II WORKOUT: its setup comes after the style (Wii)
    go(Select); sfx('VO_NAR_SELECTMUSIC');
    if (this.joinAfter && !P2) { Select.openJoin(); Select.join.fromStyle = true; Select.join.list = Select.join.list.filter(x => x !== '1 PLAYER ONLY'); }
  },
  click() { this.input('START', true); },
  draw(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.win, H4.title, H4.titleWin, H4.panel, H4.btn, H4.btnSel, H4.okPic, H4.expl, H4.panelS, H4.btnS, H4.btnSelS, H4.okS] = await Promise.all(
        ['/14/0/0/1', '/14/0/0/3', '/14/0/0/4', '/14/2/0/1', '/14/4/0/0', '/14/4/0/1', '/14/4/0/2', '/14/5/0/0', '/14/1/0/1', '/14/3/0/0', '/14/3/0/1', '/14/3/0/2'].map(one));
      H4.ok = true;
    })();
    menuBackground(t);
    if (!H4.ok) return;
    const k = clamp((performance.now() - this.at) / 300), n = this.n();
    wspr(H4.titleWin[0], 174, 65, 233.5, 82, 1, 1, 217 / 255 * k); wspr(H4.title[0], 174, 35, 150, 25, 1, 1, k);
    const py = 208, okA = this.ok ? clamp((performance.now() - this.ok) / 150) : 0;
    if (n === 1) {
      const px = 320 + (1 - k) * 100;
      wspr(H4.panel[1] || H4.panel[0], px, py, 126, 125, 1, 1, k);
      [0, 1].forEach(j => {
        const on = j === this.sel[0], y = py + (j ? 70 : -18), sc = on ? 1 : 0.8;
        if (on) wspr(H4.btnSel[0], px, y, 105, 43, 1, 1, k * (0.75 + 0.25 * Math.sin(t * 6)));
        wspr(H4.btn[j], px, y, 105, 43, sc, sc, k);
        if (on && okA) wspr(H4.okPic[0], px + 52, y + 20, 34, 17, 1, 1, okA);
      });
    } else {
      [99, 246, 395, 543].slice(0, n).forEach((sx, who) => {
        const px = sx + (1 - k) * 100;
        wspr(H4.panelS[who], px, py, 80, 125, 1, 1, k);
        [0, 1].forEach(j => {
          const on = j === this.sel[who], y = py + (j ? 70 : -18), sc = on ? 1 : 0.8;
          if (on) wspr(H4.btnSelS[0], px, y, 67, 43, 1, 1, k * (0.75 + 0.25 * Math.sin(t * 6)));
          wspr(H4.btnS[j], px, y, 70, 43, sc, sc, k);
          if (on && okA) wspr(H4.okS[0], px + 32, y + 20.2, 34, 17, 1, 1, okA);
        });
      });
    }
    if (this.pop) {
      const f = clamp((performance.now() - this.pop) / 300);
      g.fillStyle = `rgba(0,0,0,${0.5 * f})`; g.fillRect(0, 0, W, H);
      wspr(H4.expl[0], 320, -255 + (240 + 255) * (1 - Math.pow(1 - f, 3)), 277, 202);
      keyHints('Enter: OK    Esc: back');
    } else keyHints('Up/Down: choose    Enter: OK    Esc: back');
  },
};
// SELECT STYLE screen
const Style = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0,
  enter() {
    if (hpLike() && S.style === 'double') S.style = 'single';
    BATTLE = null;
    voice('VO_NAR_SELECTSTYLE');                            // (0x80097414: the screen's name as it opens)
    const L = styleCards();
    this.i = Math.max(0, L.findIndex(c => !c.off && c.style === S.style && (c.group || null) === GROUP));
    this.at = performance.now();
  },
  input(a, p) {
    if (!p) return;
    const L = styleCards(), d = /^P[1-4]([LR])$/.exec(a);
    if (d) { const j = Math.max(0, Math.min(L.length - 1, this.i + (d[1] === 'L' ? -1 : 1))); if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01');
      // the style's name after the pause (0x80097414: NORMAL 685, FRIENDSHIP 680, SYNC 681, DOUBLE 684)
      voiceLater({ NORMAL: 'VO_NAR_STANDARDSTYLE', FRIENDSHIP: 'VO_NAR_FRIENDSHIPSTYLE', SYNC: 'VO_NAR_SYNCSTYLE', DOUBLE: 'VO_NAR_DOUBLESTYLE', '2P DOUBLE': 'VO_NAR_DOUBLESTYLE', FAMILY: 'VO_NAR_FAMILYSTYLE', TRAINING: 'VO_NAR_TRTRAIN', 'DANCE VIEW': 'VO_NAR_TRDANCEVIEW' }[L[j].name] || null); } }
    else if (a === 'START') {
      const st = L[this.i];
      if (st.off) { sfx('SE_SYS_CANCEL'); return; }
      if (st.battle) { sfx('SE_SYS_DECIDE01'); S.style = 'single'; saveSettings(); GROUP = null; P2 = null; PX = []; go(BattleSel); return; }
      TRAIN.view = st.train === 'view';               // (HP4 training: TRAINING or DANCE VIEW)
      S.style = st.style; saveSettings(); GROUP = st.group || null;
      if (GROUP && P2) P2.diff = S.diff;
      if (GROUP) PX.forEach(x => { if (x) x.diff = S.diff; });
      sfx('SE_SYS_DECIDE01');
      Select.query = '';
      if (!st.two) { P2 = null; PX = []; }
      CHOREO = false; PCHOREO = [false, false, false, false];
      if (HP4 && (S.mode || 'free') === 'free') { DanceSel.joinAfter = st.two && !P2; go(DanceSel); return; }   // HP4: SELECT DANCE, then the songs
      if (!HP4 && S.mode === 'workout') { go(WkData); return; }     // DDR II WORKOUT: its setup comes after the style (Wii)
      go(Select); sfx('VO_NAR_SELECTMUSIC');
      if (st.two && !P2) { Select.openJoin(); Select.join.fromStyle = true; Select.join.list = Select.join.list.filter(x => x !== '1 PLAYER ONLY'); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Players); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300), L = styleCards();
    menuTitle(HP4 ? null : M.styleTitle, HP4 && S.mode === 'training' ? 'SELECT MODE' : 'SELECT STYLE');
    // the layout's card anchors (CAE 0x7b44a0 @dummy: x 140 / 260 / 380 / 500, y 186 - 120 apart about the middle),
    // 2 px a unit on the Wii screen like SELECT NUMBER OF PLAYERS (Dolphin 2026-11-18: 240 px apart); scale 0.7,
    // the chosen one 1.0. (More cards than the game's four - the PC's extras - keep the same spacing.)
    L.forEach((c, i) => {
      const on = i === this.i, x = 320 + (i - (L.length - 1) / 2) * 120 * 2 / 1.5262 + (1 - k) * 20, y = 186, sc = on ? (0.7 + 0.3 * cardGrow(this)) * cardBounce() : 0.7;
      // (a style that can't be played now is darkened to half, not faded - Dolphin screenshot, 1 player: FRIENDSHIP /
      // SYNC at 0.5 of their colours)
      g.save(); g.globalAlpha = k; if (c.off) g.filter = 'brightness(0.5)';
      if (on) wspr(M.cardOn, x, y, 76, 94, sc, sc, 0.75 + 0.25 * Math.sin(t * 6));
      if (c.battle || c.team) {                        // our own cards (the game has none for them)
        const w = 132 * sc * WS, h = 168 * sc * WS, X = WX(x) - w / 2, Y = WY(y) - h / 2;
        g.fillStyle = '#f0a818'; g.fillRect(X, Y, w, h);
        const gr = g.createLinearGradient(X, Y, X + w, Y + h); gr.addColorStop(0, '#2a7dff'); gr.addColorStop(0.5, '#7a3cff'); gr.addColorStop(1, '#ff3c6a');
        g.fillStyle = gr; g.fillRect(X + 8 * sc, Y + 8 * sc, w - 16 * sc, h * 0.7);
        text(c.team ? 'P1+P2' : 'VS', WX(x), Y + h * 0.36, Math.round((c.team ? 40 : 64) * sc), '#ffe86a', 'center');
        text(c.team ? 'TAKE TURNS' : '1P  \u2194  CPU', WX(x), Y + h * 0.6, Math.round(18 * sc), '#fff', 'center');
        text(c.team ? 'TEAM' : 'BATTLE CPU', WX(x), Y + h * 0.88, Math.round(22 * sc), '#7a3a00', 'center');
      } else if (!wspr(M.cards && M.cards[c.card], x, y, 66, 84, sc, sc)) { g.fillStyle = '#f0b020'; g.fillRect(WX(x) - 67, WY(y) - 86, 134, 172); text(c.name, WX(x), WY(y), 24, '#fff', 'center'); }
      if (c.badge) { g.fillStyle = '#ff3ca0'; g.fillRect(WX(x) + 30, WY(y) - 86, 44, 26); text(c.badge, WX(x) + 52, WY(y) - 73, 18, '#fff', 'center'); }
      g.restore();
    });
    helpWindow(L[this.i].help);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};

// the MAX COMBO CHALLENGE result: the run's combo, and your best
const MCResult = {
  bgm: 'MU_BGM_FREE',
  with(totals, songs) { this.totals = totals; this.songs = songs; this.at = performance.now(); return this; },
  enter() {
    const st = S.style + (P2 ? '2p' : '');
    SAVE.modeRecords = SAVE.modeRecords || {}; SAVE.modeRecords.maxcombo = SAVE.modeRecords.maxcombo || {};
    const best = Math.max(...this.totals);
    this.newBest = best > (SAVE.modeRecords.maxcombo[st] || 0);
    if (this.newBest) { SAVE.modeRecords.maxcombo[st] = best; writeSave(); }
    this.best = SAVE.modeRecords.maxcombo[st] || 0;
    sfx('VO_NAR_GAMEOVER');
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); MC = null; go(ModeSel); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const k = clamp((performance.now() - this.at) / 400);
    g.globalAlpha = k;
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(290, 130, 700, 440); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(290, 130, 700, 440);
    text(modeName(MODES[2]), 640, 185, 38, '#ffe86a', 'center');
    text((S.style === 'double' ? 'DOUBLE' : 'SINGLE') + ' STYLE', 640, 235, 22, '#fff', 'center');
    this.totals.slice(0, P2 ? 2 : 1).forEach((n, i, arr) => {
      const x = arr.length > 1 ? 470 + i * 340 : 640;
      if (arr.length > 1) text('PLAYER ' + (i + 1), x, 300, 20, '#bfe0ff', 'center');
      text(String(n), x, 370, 90, '#fff', 'center'); text('COMBOS', x, 440, 24, '#ffd23c', 'center');
    });
    text(this.songs + (this.songs === 1 ? ' song' : ' songs') + '   BEST ' + this.best + (this.newBest ? '   NEW RECORD!' : ''), 640, 510, 20, this.newBest ? '#ffe86a' : '#fff', 'center');
    g.globalAlpha = 1;
    text('Enter: back to SELECT MODE', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- BATTLE MODE: you against a computer opponent (Hottest Party 2's battle opponent, decoded) on the same
// chart, on the 2 player VERSUS screen (no second dancer). Its four strengths are HP2's four profile groups.
const BATTLE_LEVELS = [
  { name: 'LEVEL 1', who: 'ROOKIE', help: 'Hottest Party 2\'s first dance battles.\nMostly GREAT, with some BOO and ALMOST.' },
  { name: 'LEVEL 2', who: 'CHALLENGER', help: 'A burning arena\'s opponent in Hottest Party 2.\nA few more PERFECTs, fewer misses.' },
  { name: 'LEVEL 3', who: 'RIVAL', help: 'Hottest Party 2\'s ROUND 2 opponent.\nPERFECT as often as GREAT, rare misses.' },
  { name: 'LEVEL 4', who: 'CHAMPION', help: 'A burning ROUND 2 arena\'s opponent.\nMostly PERFECT and MARVELOUS, almost never misses.' },
];
// BATTLE screen: pick the computer opponent's level
const BattleSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0,
  enter() { this.i = Math.max(0, Math.min(3, (SAVE.battle && SAVE.battle.last) || 0)); this.at = performance.now(); GROUP = null; PX = []; P2 = null; },
  input(a, p) {
    if (!p) return;
    const d = /^P[1-4]([LDUR])$/.exec(a);
    if (d) {
      const j = Math.max(0, Math.min(3, this.i + (d[1] === 'L' || d[1] === 'U' ? -1 : 1)));
      if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01'); }
    } else if (a === 'START') {
      sfx('SE_SYS_DECIDE01'); BATTLE = { level: this.i };
      SAVE.battle = SAVE.battle || {}; SAVE.battle.last = this.i; writeSave();
      // like 2 player VERSUS (single style): no SELECT STYLE, straight to the songs
      S.style = 'single'; GROUP = null; P2 = null; PX = []; Select.query = '';
      go(Select); sfx('VO_NAR_SELECTMUSIC');
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); BATTLE = null; go(Style); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    menuTitle(null, 'SELECT OPPONENT');
    const k = clamp((performance.now() - this.at) / 300), rec = (SAVE.battle && SAVE.battle.rec) || {};
    g.save(); g.globalAlpha = k;
    BATTLE_LEVELS.forEach((L, i) => {
      const on = i === this.i, x = 640 + (i - 1.5) * 250, y = 330, w = on ? 220 : 196, h = on ? 230 : 204;
      g.fillStyle = on ? 'rgba(200,40,120,0.92)' : 'rgba(20,40,110,0.85)'; g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = on ? '#ffe86a' : '#fff'; g.lineWidth = on ? 5 : 3; g.strokeRect(x - w / 2, y - h / 2, w, h);
      text(L.name, x, y - 70, on ? 30 : 26, '#ffe86a', 'center');
      text(L.who, x, y - 25, on ? 24 : 20, '#fff', 'center');
      for (let s = 0; s <= i; s++) text('\u2605', x - 15 * i + 30 * s, y + 20, 26, '#ffd23c', 'center');
      const r = rec[i] || { w: 0, l: 0 };
      text('WIN ' + r.w + '   LOSE ' + r.l, x, y + 70, 17, '#bfe0ff', 'center', 'normal');
    });
    g.restore();
    helpWindow(BATTLE_LEVELS[this.i].help, 319, 380);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};
// after each song: who won, then back to the song list for the next battle
const BattleResult = {
  bgm: 'MU_BGM_FREE',
  with(ps) { this.ps = ps; this.at = performance.now(); return this; },
  enter() {
    const me = this.ps[0], com = this.ps.find(p => p.com !== undefined) || this.ps[1];
    this.me = me.failed ? 0 : me.score; this.com = com.score;
    this.res = me.failed || this.me < this.com ? 'lose' : this.me > this.com ? 'win' : 'draw';
    const lv = BATTLE ? BATTLE.level : 0;
    SAVE.battle = SAVE.battle || {}; SAVE.battle.rec = SAVE.battle.rec || {};
    const r = SAVE.battle.rec[lv] = SAVE.battle.rec[lv] || { w: 0, l: 0 };
    if (this.res === 'win') r.w++; else if (this.res === 'lose') r.l++;
    writeSave();
    sfx(this.res === 'win' ? 'SE_DDR_FULLCOMBO' : 'SE_SYS_WINDOWOUT');
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); go(Select); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const k = clamp((performance.now() - this.at) / 400), lv = BATTLE ? BATTLE.level : 0;
    g.globalAlpha = k;
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(240, 120, 800, 460); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(240, 120, 800, 460);
    text('BATTLE  ' + BATTLE_LEVELS[lv].name + '  ' + BATTLE_LEVELS[lv].who, 640, 170, 26, '#bfe0ff', 'center');
    const big = { win: ['YOU WIN!', '#7dff9a'], lose: ['YOU LOSE', '#ff8a8a'], draw: ['DRAW', '#ffe86a'] }[this.res];
    text(big[0], 640, 250, 72, big[1], 'center');
    const dg = this.ps[0].hpRules ? 9 : 7;
    [['YOU', this.me, this.ps[0].failed ? 'FAILED' : ''], ['COM', this.com, '']].forEach(([who, sc, note], i) => {
      const x = 450 + i * 380;
      text(who, x, 350, 26, i ? '#ff9ad5' : '#5ad0ff', 'center');
      text(String(sc).padStart(dg, '0'), x, 420, 48, '#fff', 'center');
      if (note) text(note, x, 470, 22, '#ff8a8a', 'center');
    });
    const r = (SAVE.battle.rec || {})[lv] || { w: 0, l: 0 };
    text('WIN ' + r.w + '   LOSE ' + r.l, 640, 540, 20, '#fff', 'center', 'normal');
    g.globalAlpha = 1;
    keyHints('Enter: next song');
  },
};
// ONLINE VERSUS: the options that change which steps a chart has (so both sides count the same rows)
function onlineOpts() { return { turn: S.turn, cut: S.cut, jump: S.jump, freezes: S.freezes, gauge: S.gauge, marvelous: S.marvelous }; }
// the ghost for this song at your current difficulty and style (your best scoring play), when GHOST is on
function ghostFor(song) {
  if (!S.ghost || DEMO.on || (S.mode || 'free') !== 'free' || P2 || BATTLE || COURSE || WK || GC || GROUP || !song || song.lesson) return null;
  const prof = DATA.profiles[DATA.current]; if (!prof || !prof.ghosts) return null;
  return prof.ghosts[recKey(song.slot, styleNow(), S.diff)] || null;
}
// replay: each judgment when its step reaches the arrows (a let-go freeze at the moment it was let go)
function ghostStep(p, t) {
  const q = p.netQueue || (p.netQueue = []);
  while (p.ghostEv.length) {
    const e = p.ghostEv[0];
    const at = e[0] === 'n' ? e[2] : (p.rows[e[0]] ? p.rows[e[0]].t : -1);
    if (at > t) break;
    p.ghostEv.shift();
    q.push(e[0] === 'n' ? { t: 'ng', n: e[1] } : { t: 'j', r: e[0], j: e[1] });
  }
}
// TEAM turns (PC extra): split the chart's steps (a jump = one step) into turns of about TEAM TURN steps,
// each switch moved within 4 steps to the best spot (the longest pause before the step, a measure's first
// beat preferred, never while a freeze arrow is held), a too-short last turn joined to the one before.
function teamTurns(p) {
  const rows = p.rows, n = rows.length; if (n < 4) return { cuts: [] };
  const size = S.teamTurn && S.teamTurn !== 'auto' ? +S.teamTurn : Math.max(8, Math.min(64, Math.round(n / 8)));
  const busyUntil = []; let end = -1;                  // the latest freeze end before each step
  for (let i = 0; i < n; i++) { busyUntil[i] = end; for (const nt of rows[i].notes) if (nt.endT !== undefined) end = Math.max(end, nt.endT); }
  const cuts = []; let prev = 0;
  for (let c = size; c < n; c += size) {
    let best = -1, bestScore = -Infinity;
    for (let i = Math.max(prev + Math.ceil(size / 2), c - 4); i <= Math.min(n - 1, c + 4); i++) {
      if (busyUntil[i] > rows[i].t - 0.05) continue;    // a freeze arrow still held
      const gap = rows[i].t - Math.max(rows[i - 1].t, busyUntil[i]);
      const sc2 = gap + ((rows[i].off % 4096) === 0 ? 0.25 : 0) - Math.abs(i - c) * 0.01;
      if (sc2 > bestScore) { bestScore = sc2; best = i; }
    }
    if (best > 0) { cuts.push(best); prev = best; c = best; }
  }
  if (cuts.length && n - cuts[cuts.length - 1] < size / 2) cuts.pop();
  let owner = 0, k = 0;
  for (let i = 0; i < n; i++) { if (k < cuts.length && i === cuts[k]) { owner = 1 - owner; k++; } rows[i].owner = owner; }
  return { cuts };
}
// MAX COMBO CHALLENGE: the record style being played (0 NORMAL, 1 FRIENDSHIP, 2 SYNC, 3 DOUBLE, 4 family)
function mccStyle() { return styleNow() === 'double' ? 3 : GROUP === 'friend' ? 1 : GROUP === 'sync' ? 2 : GROUP === 'family' ? 4 : 0; }
// after a DANCE MODE song: the challenge's window, if any (DDR II main.dol 0x800eb078 / 0x800eb2b0, shown by
// the results' state 0x17 through 0x80106e44). There is ONE streak: NORMAL and DOUBLE use player 1's play
// (2 players in NORMAL = VERSUS: still player 1's), FRIENDSHIP and SYNC the pair's shared play (player
// struct 5). The running total is kept with its style (0x800f3c54); a total from another style counts as none.
//  - none running: a full combo (and not failed) = Start!!, total = the song's max combo; else nothing
//  - running + a full combo = KEEP GOING!!, total += the song's max combo
//  - running, no full combo = End!!, total += the combo before the first break; the streak is cleared
// NEW RECORD on any of the three when the total beats that style's best, which is then saved at once
// (0x800e9374). Style picture: 0 NORMAL, 1 FRIENDSHIP, 2 SYNC, 3 DOUBLE (the game's styles 0 / 4 / 3 / 6).
function mccOne(full, combo, broke, finalAt, failed) {
  const st = mccStyle(), cur = MCC && MCC.style === st ? MCC.total : null;
  let w = null;
  if (cur === null || cur === undefined || cur === 0) {
    MCC = null;
    if (full && !failed && combo > 0) { MCC = { style: st, total: combo }; w = { kind: 'start', total: combo, style: st }; }
  } else if (full && !failed) {
    MCC.total = cur + combo; w = { kind: 'keep', total: MCC.total, style: st };
  } else {
    const total = broke ? finalAt : cur; MCC = null; w = { kind: 'end', total, style: st };
  }
  if (w) {
    SAVE.mccBest = SAVE.mccBest || {}; w.rec = w.total > (SAVE.mccBest[st] || 0);
    if (w.rec) { SAVE.mccBest[st] = w.total; writeSave(); }
  }
  return w;
}
// (see above) add the song just played to the challenge; returns the windows to show
function mccAfterSong(ps) {
  const me = ps.filter(p => !p.remote && p.com === undefined);
  if (!me.length) return [];
  let w;
  if ((GROUP === 'sync' || GROUP === 'friend') && me.length > 1) {
    const ended = me.filter(p => p.mccEnd), fin = ended.length ? Math.min(...ended.map(p => p.mccFinal)) : 0;
    const full = me.every(p => p.fullCombo && p.fullCombo() > 0);
    w = mccOne(full, Math.min(...me.map(p => p.combo)), ended.length > 0, fin, me.some(p => p.failed));
  } else {
    const p = me[0];
    w = mccOne(p.fullCombo && p.fullCombo() > 0, p.combo, !!p.mccEnd, p.mccFinal, p.failed);
  }
  return w ? [w] : [];
}
// the window (comAF /6/0/5, 500 x 282, centred; laid out from the Wii footage)
const MCCWin = {
  bgm: 'MU_BGM_FREE',
  with(list, next) { this.list = list; this.w = list[0]; this.next = next; this.at = performance.now(); return this; },
  input(a, p) {
    if (!p || !(a === 'START' || a === 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    if (this.list.length > 1) { this.list = this.list.slice(1); this.w = this.list[0]; this.at = performance.now(); }   // the next player's window
    else go(this.next);
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const M = A.img.mcc || {}, sc = 1.436, k = clamp((performance.now() - this.at) / 250);
    const X = x => 640 + (x - 250) * sc, Y = y => 360 + (y - 141) * sc;
    g.save(); g.globalAlpha = k;
    if (M.win) g.drawImage(M.win, X(0), Y(0), 500 * sc, 282 * sc);
    else { g.fillStyle = '#1d5fc8'; g.fillRect(X(0), Y(0), 500 * sc, 282 * sc); text('MAX COMBO CHALLENGE', X(20), Y(22), 26, '#fff', 'left'); }
    const word = this.w.kind === 'record' ? null : this.w.kind === 'start' ? M.start : this.w.kind === 'keep' ? M.keep : M.end;
    const pulse = 1 + 0.05 * Math.sin(t * 6);
    if (word) { const w2 = 230 * sc * pulse, h2 = 46 * sc * pulse; g.drawImage(word, X(388) - w2 / 2, Y(66) - h2 / 2, w2, h2); }
    else if (this.w.kind !== 'record') text({ start: 'Start!!', keep: 'KEEP GOING!!', end: 'End!!' }[this.w.kind], X(388), Y(66), 30, '#ff60c0', 'center');
    const st = M.styles && M.styles[this.w.style];
    if (st) g.drawImage(st, X(148) - 127 * sc, Y(115) - 18 * sc, 254 * sc, 36 * sc);
    // nine digits: the leading zeros dim (/6/0/0), the number in the game's number set
    const s9 = String(Math.min(999999999, this.w.total)).padStart(9, '0'), lead = s9.length - String(this.w.total).length;
    const dw = 37.5 * sc, dh = 46 * sc;
    for (let i = 0; i < 9; i++) {
      const cx = X(79) + (i + 0.5) * dw, cy = Y(161);
      if (i < lead) { if (M.zero) { g.save(); g.globalAlpha = k * 0.45; g.drawImage(M.zero, cx - dw / 2, cy - dh / 2, dw, dh); g.restore(); } }
      else num28(s9[i], cx, cy, dh * 1.1, 'center', 1);
    }
    if (this.w.rec && M.newRec) g.drawImage(M.newRec, X(250) - 100 * sc, Y(250) - 15 * sc, 200 * sc, 30 * sc);
    if (this.w.label) text(this.w.label, 640, Y(0) - 26, 28, '#ffe86a', 'center');      // (2 players: whose challenge)
    g.restore();
    keyHints('Enter: exit');
  },
};
// TEAM results: who got what (drawn over the 1-player results)
function teamStatsPanel(play) {
  const st = play.ps[0].teamStats; if (!st) return;
  const x = 860, y = 120, w = 390;
  g.fillStyle = 'rgba(10,25,80,0.88)'; g.fillRect(x, y, w, 250); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, w, 250);
  text('TEAM', x + w / 2, y + 22, 22, '#ffe86a', 'center');
  text('PLAYER 1', x + 225, y + 52, 16, '#5ab8ff', 'center'); text('PLAYER 2', x + 325, y + 52, 16, '#ff6a8a', 'center');
  [['MARVELOUS', 5], ['PERFECT', 4], ['GREAT', 3], ['GOOD', 2], ['ALMOST', 1], ['BOO', 0], ['BEST STREAK', 'best']].forEach(([nm, k], i) => {
    const yy = y + 80 + i * 24;
    text(nm, x + 16, yy, 15, '#fff', 'left', 'normal');
    text(String(st[0][k] || 0), x + 225, yy, 16, '#fff', 'center'); text(String(st[1][k] || 0), x + 325, yy, 16, '#fff', 'center');
  });
}
// ---- COURSES: songs in a row on one Dance Gauge (it carries over; it running out ends the course).
// Every game gets ten courses made from its own songs, from easy to hard, plus up to six of your own
// (ORDER EDIT, kept in your player data). (The games' own course lists aren't read from the discs yet.)
let COURSE = null;                                  // the course being played: { name, slots, diff, i, life: [], scores: [], failed }
// a song slot from the game's tables -> the song to play (a cut slot plays the song's SHORT version)
// London EVOLVED's three songs (Ver.A / B / C, each its own chart and dance) are one entry in song select;
// starting it picks one of the three at random (main.dol 0x8004be98: id 92 + 2 x (rand() % 3))
function songVersion(song, v) { return v ? Object.assign({}, song, v, { versions: null, versionOf: song.slot }) : song; }
// a song with several versions (London EVOLVED): pick one at random
function pickVersion(song) {
  if (!song || !song.versions || !song.versions.length) return song;
  return songVersion(song, song.versions[Math.floor(wiiRandom() * song.versions.length)]);
}
// the song for a slot number (also finds the full or short version of a song)
function songForSlot(sl) {
  const s = SONGS.find(s2 => s2.slot === sl);
  if (s) return s;
  const f = SONGS.find(s2 => s2.alt && s2.alt.slot === sl);
  if (f) return Object.assign({}, f, f.alt, { isShort: true, movie: f.movie });
  const g = SONGS.find(s2 => s2.versions && s2.versions.some(v => v.slot === sl));
  if (g) return songVersion(g, g.versions.find(v => v.slot === sl));
  return SONGS.find(s2 => s2.full === sl || s2.cut === sl) || (HP4 && TOUR && TOUR.songs ? TOUR.songs.find(s2 => s2.slot === sl) || null : null);
}
let DDR2_COURSES = null;           // DDR II's own COURSE 1-10 / WORKOUT 1-10 lists (main.dol)
// read DDR II's own course lists from the server (once)
async function loadDdr2Courses() {
  if (DDR2_COURSES) return DDR2_COURSES;
  try { DDR2_COURSES = (await api('/api/ddr2courses')) || {}; } catch (e) { DDR2_COURSES = {}; }
  return DDR2_COURSES;
}
// HP4 (0x800fbf14): a course or workout opens once every one of its songs is unlocked - the DDR POINTS of
// its last song (0 = open from the start)
function courseUnlockAt(slots) { return Math.max(0, ...(slots || []).map(sl => UNLOCK_AT[sl] || 0)); }
// the courses offered: the game's own, or ones made up from the song list
function builtInCourses() {
  if (gameNow() === 'ddr2' && DDR2_COURSES && DDR2_COURSES.courses) {  // the game's own courses
    const N = DDR2_COURSES.names || [], WN = DDR2_COURSES.workoutNames || [];
    const open = c => !HP4 || S.unlocks !== 'on' || SAVE.points >= courseUnlockAt(c.all);
    return DDR2_COURSES.courses.map((sl, c) => ({ name: HP4 && N[c] ? N[c].toUpperCase() : 'COURSE ' + (c + 1), all: sl, slots: sl.filter(x => songForSlot(x)) }))
      .concat((DDR2_COURSES.workouts || []).map((sl, c) => ({ name: HP4 && WN[c] ? WN[c].toUpperCase() : 'WORKOUT ' + (c + 1), all: sl, slots: sl.filter(x => songForSlot(x)) })))
      .filter(c => c.slots.length && open(c));
  }
  // Hottest Party 2's own 20 courses (main.dol, the ones its GROOVE ARENA asks for: 3 or 4 songs each)
  if (gameNow() === 'hp2' && GAD && GAD.courses)
    return GAD.courses.map((sl, c) => ({ name: 'COURSE ' + (c + 1), slots: sl.map(x => 2000 + x).filter(x => songForSlot(x)) })).filter(c => c.slots.length);
  return builtInCoursesMade();
}
// courses made from the song list by level (for games whose own courses aren't decoded)
function builtInCoursesMade() {
  const songs = gameSongs().filter(s => !s.random && !s.folderTile && !isLocked(s) && s.single && s.single[1] > 0);
  const lvl = s => s.single[1] || 0;                  // by the BASIC level
  const sorted = songs.slice().sort((a, b) => lvl(a) - lvl(b) || a.slot - b.slot);
  const out = [];
  for (let c = 0; c < 10 && sorted.length >= 4; c++) {
    const from = Math.floor((sorted.length - 4) * c / 9), pick = [];
    for (let k = 0; pick.length < 4 && from + k * 3 < sorted.length + 12; k++) {
      const s2 = sorted[Math.min(sorted.length - 1, from + ((k * 3 + c) % Math.max(1, sorted.length - from)))];
      if (!pick.includes(s2)) pick.push(s2);
    }
    while (pick.length < 4) { const s2 = sorted[(from + pick.length * 7) % sorted.length]; if (!pick.includes(s2)) pick.push(s2); else break; }
    out.push({ name: 'COURSE ' + (c + 1), slots: pick.map(s2 => s2.slot) });
  }
  return out;
}
// the player's own courses (ORDER EDIT)
function myOrders() { SAVE.orders = SAVE.orders || []; return SAVE.orders; }
// COURSE SELECT screen
const CourseSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, list: [],
  async enter() {
    await loadDdr2Courses();
    if (gameNow() === 'hp2') await GC_HP2.load();
    this.list = builtInCourses().concat(myOrders().map((o, k) => ({ name: 'ORDER ' + (k + 1), slots: o, mine: k })));
    this.list.push({ name: 'ORDER EDIT', edit: true });
    this.i = Math.min(this.i, this.list.length - 1); this.at = performance.now();
    if (![4, 1, 2, 3].includes(S.diff)) S.diff = 1;
  },
  input(a, p) {
    if (!p) return;
    const c = this.list[this.i];
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < this.list.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1L' || a === 'P1R') {               // the difficulty for the whole course
      const order = [4, 1, 2, 3], k = order.indexOf(S.diff);
      S.diff = order[Math.max(0, Math.min(3, k + (a === 'P1R' ? 1 : -1)))]; sfx('SE_SYS_SELECT02');
    } else if (a === 'START') {
      sfx('SE_SYS_DECIDE01');
      if (c.edit) { OrderEdit.back = null; go(OrderEdit.with(null)); return; }
      const songs = c.slots.map(sl => songForSlot(sl)).filter(Boolean);
      if (!songs.length) return;
      S.style = 'single'; P2 = null;
      COURSE = { name: c.name, slots: c.slots.filter(sl => songForSlot(sl)), diff: S.diff, i: 0, life: [], scores: [], failed: false };
      startCourseSong();
    } else if (a === 'OPTIONS' && c.mine !== undefined) { OrderEdit.back = null; go(OrderEdit.with(c.mine)); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); if (this.fromSelect) { this.fromSelect = false; go(Select); } else go(ModeSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SELECT COURSE', 210, 44, 34, '#fff', 'center');
    const di = DIFFS.findIndex(x => x[0] === S.diff);
    text('◀  ' + DIFFS[di][1] + '  ▶', 1000, 44, 26, DIFFS[di][2], 'center');
    const top = Math.max(0, Math.min(this.i - 4, this.list.length - 9));
    this.list.slice(top, top + 9).forEach((c, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 62;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : c.edit ? 'rgba(20,120,80,0.85)' : c.mine !== undefined ? 'rgba(120,40,140,0.85)' : 'rgba(20,60,140,0.85)';
      g.fillRect(80, y, 420, 52); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(80, y, 420, 52);
      text(c.name, 100, y + 27, 24, '#fff', 'left');
      if (c.slots) {
        const best = SAVE.modeRecords && SAVE.modeRecords.course && SAVE.modeRecords.course[S.game + ':' + c.name + ':' + S.diff];
        if (best) text(String(best).padStart(7, '0'), 480, y + 27, 18, '#ffe86a', 'right');
      }
    });
    const c = this.list[this.i];
    if (!c) return;                                   // (the course list is still loading)
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(540, 100, 660, 550); g.strokeStyle = '#fff'; g.strokeRect(540, 100, 660, 550);
    if (c.edit) {
      text('ORDER EDIT', 870, 150, 30, '#ffe86a', 'center');
      text('Make your own course: up to 6 songs in the order you want.', 870, 200, 18, '#fff', 'center', 'normal');
      text('Your courses show up here as ORDER 1, ORDER 2 ...', 870, 230, 18, '#fff', 'center', 'normal');
    } else {
      text(c.name, 870, 145, 30, '#ffe86a', 'center');
      c.slots.forEach((sl, k) => {
        const s2 = SONGS.find(x => x.slot === sl); if (!s2) return;
        const lv = (levelsOf(s2) || [])[DIFFS.findIndex(x => x[0] === S.diff)] || 0;
        text((k + 1) + '. ' + s2.name, 570, 200 + k * 60, fitSize(s2.name, 22, 520), '#fff', 'left');
        text((s2.artist || '') + (lv ? '   level ' + lv : '   (no chart at this difficulty)'), 600, 226 + k * 60, 15, lv ? '#bfe0ff' : '#ff9a9a', 'left', 'normal');
      });
      if (c.mine !== undefined) text('Tab: edit this order', 870, 620, 16, '#ffd23c', 'center', 'normal');
    }
    text('Up/Down: course   Left/Right: difficulty   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// start the next song of the course being played
function startCourseSong() {
  const song = songForSlot(COURSE.slots[COURSE.i]);
  S.diff = COURSE.diff;
  const di = DIFFS.findIndex(x => x[0] === S.diff);
  if (!song || !((levelsOf(song) || [])[di] > 0)) {        // no chart at this difficulty: the nearest one it has
    const lv = levelsOf(song) || [];
    const alt = [1, 2, 4, 3].find(d => lv[DIFFS.findIndex(x => x[0] === d)] > 0);
    if (!song || !alt) { COURSE.scores.push(0); COURSE.i++; if (COURSE.i < COURSE.slots.length) startCourseSong(); else go(CourseResult); return; }
    S.diff = alt;
  }
  go(Loading.with(song));
}
// ORDER EDIT: pick songs for your own course
const OrderEdit = {
  bgm: 'MU_BGM_FREE',
  with(k) { this.k = k; this.picked = k === null ? [] : myOrders()[k].slice(); this.i = 0; return this; },
  enter() { this.songs = gameSongs().filter(s2 => !s2.random && !s2.folderTile && !isLocked(s2)); },
  input(a, p) {
    if (!p) return;
    const n = this.songs.length;
    if (a === 'P1U') { this.i = (this.i - 1 + n) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D') { this.i = (this.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1L') { this.i = Math.max(0, this.i - 10); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1R') { this.i = Math.min(n - 1, this.i + 10); sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') {
      if (this.picked.length < 6) { this.picked.push(this.songs[this.i].slot); sfx('SE_SYS_DECIDE01'); }
      if (this.picked.length >= 6) this.finish();
    } else if (a === 'OPTIONS') this.finish();
    else if (a === 'BACK') {
      if (this.picked.length) { this.picked.pop(); sfx('SE_SYS_WINDOWOUT'); } else go(this.back || CourseSel);
    }
  },
  finish() {
    if (this.picked.length < 2) { sfx('SE_SYS_WINDOWOUT'); return; }       // (the games want at least 2 songs)
    const o = myOrders();
    if (this.k === null) { if (o.length >= 6) o.shift(); o.push(this.picked); } else o[this.k] = this.picked;
    writeSave(); sfx('SE_SYS_DECIDE01'); go(this.back || CourseSel);
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('ORDER EDIT', 210, 44, 34, '#fff', 'center');
    const n = this.songs.length, top = Math.max(0, Math.min(this.i - 5, n - 11));
    this.songs.slice(top, top + 11).forEach((s2, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 50;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : 'rgba(20,60,140,0.8)'; g.fillRect(60, y, 560, 44);
      text(s2.name, 76, y + 22, fitSize(s2.name, 20, 520), '#fff', 'left');
      if (this.picked.includes(s2.slot)) text('✓', 600, y + 22, 20, '#7dff9a', 'right');
    });
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(660, 100, 560, 540); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(660, 100, 560, 540);
    text('YOUR COURSE  (' + this.picked.length + ' / 6)', 940, 140, 24, '#ffe86a', 'center');
    this.picked.forEach((sl, k) => { const s2 = SONGS.find(x => x.slot === sl); if (s2) text((k + 1) + '. ' + s2.name, 690, 190 + k * 56, fitSize(s2.name, 22, 500), '#fff', 'left'); });
    text('Enter: add   Esc: remove last / back   Tab: save (2 songs or more)', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the end of a course: every song's score and the total
const CourseResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now();
    this.total = COURSE.scores.reduce((a, b) => a + b, 0);
    this.cleared = !COURSE.failed && COURSE.scores.length >= COURSE.slots.length;
    SAVE.modeRecords = SAVE.modeRecords || {}; SAVE.modeRecords.course = SAVE.modeRecords.course || {};
    const key = S.game + ':' + COURSE.name + ':' + COURSE.diff;
    this.newBest = this.total > (SAVE.modeRecords.course[key] || 0);
    if (this.newBest) { SAVE.modeRecords.course[key] = this.total; writeSave(); }
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); COURSE = null; go(CourseSel); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const c = COURSE; if (!c) return;
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(240, 90, 800, 540); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(240, 90, 800, 540);
    text(c.name + '  ' + DIFFS[DIFFS.findIndex(x => x[0] === c.diff)][1], 640, 140, 32, '#ffe86a', 'center');
    text(this.cleared ? 'COURSE CLEARED!' : 'COURSE FAILED', 640, 190, 28, this.cleared ? '#7dff9a' : '#ff8a8a', 'center');
    c.slots.forEach((sl, k) => {
      const s2 = SONGS.find(x => x.slot === sl), y = 250 + k * 48;
      text((k + 1) + '. ' + (s2 ? s2.name : '?'), 290, y, fitSize(s2 ? s2.name : '?', 22, 520), k < c.scores.length ? '#fff' : '#889', 'left');
      text(k < c.scores.length ? String(c.scores[k]).padStart(7, '0') : '-------', 990, y, 22, '#fff', 'right');
    });
    text('TOTAL  ' + String(this.total).padStart(8, '0') + (this.newBest ? '   NEW RECORD!' : ''), 640, 580, 28, this.newBest ? '#ffe86a' : '#fff', 'center');
    text('Enter: back to SELECT COURSE', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- WORKOUT MODE: the games' workout menu: your weight, a target (PLAY TIME, CALORIES BURNED or NO
// SETTING), then songs as usual with the calories counted up on screen. Leaving (Esc on the song
// select) or reaching the target ends the workout; each workout goes in your log (player data).
// Calories are an estimate from your weight, the time danced and the steps you hit (the games don't
// say how they count theirs): about 0.0004 kcal per kg per step plus 1.5 kcal per kg per hour
// (a busy 2-minute song for someone of 60 kg comes to about 13 kcal: 6-7 kcal a minute).
let WK = null;                                      // { target: 'none'|'time'|'kcal', goal, kcal, secs, songs }
// DDR II's own calorie rule (0x80038d58, run for each step judged): the song's calories are
//   0.165 x 1.05 x weight(kg) x MET x (song length in hours), MET 3.1 on BASIC and 3.5 otherwise,
// shared out evenly over the chart's steps (kept in thousandths of a kcal; shown here in kcal).
// your weight as the US games keep it - in pounds (the calorie rules use this number as it is). An older
// save's kg weight is turned into pounds once.
function weightLb() {
  if (!SAVE.weightLb) SAVE.weightLb = SAVE.weight ? Math.round(SAVE.weight * 2.2046) : 132;
  return SAVE.weightLb;
}
// calories for a play by a simple estimate: weight x a MET value x the song's time x the share of steps judged
function workoutKcal(p, secs) {
  const kg = weightLb();
  const judged = Object.entries(p.counts || {}).filter(([k]) => k !== 'NG' && k !== 'OK').reduce((a, [, b]) => a + b, 0);
  const total = Math.max(1, (p.rows && p.rows.length) || judged || 1);
  const songSecs = (typeof Play !== 'undefined' && Play.endT) || secs;
  const met = p.slot === 1 ? 3.1 : 3.5;
  return 0.33 * 0.5 * 1.05 * kg * met * (songSecs / 3600) * Math.min(1, judged / total);
}
// The games' step calories on a dance mat (DDR II 0x80038374's main branch, the same table in HP4 at
// 0x8026f848 / 0x802b68bc): each move you make on the mat - whatever the arrows are - is sorted out and worth
// (BPM x a / 20 + weight x b / 60) thousandths of a kcal (0x80029e7c), with (a, b) for:
//   0 a first step  1 stepping on the panel a foot is already on  2 onto that panel's partner (Left-Down,
//   Up-Right)  3 any other step  4 / 5 a step after both feet were up (4: onto a partner pair)  6 a jump onto
//   the same two panels as before  7 a jump onto two others  8 a hand move (the Wii Remote / Nunchuk lanes)
// Presses within 2 frames of the first one make a single move (two panels = a jump). A foot whose panel has
// been let go for over half a second counts as lifted. BPM = the song's tempo (0x8003088c, at its start).
const KCAL_AB = [[1, 31], [1, 26], [4, 19], [3, 23], [2, 120], [4, 116], [0, 124], [6, 112], [1, 26]];
const KCAL_PART = [255, 2, 1, 4, 3, 8, 7, 6, 5];               // a panel's partner (ids 1-8)
const KCAL_ID = [1, 2, 3, 4, 7, 6, 5, 8];                      // the game's panel ids for lanes 0-7 (L D U R, 2P L D U R)
// the game's calorie units for one step: by weight, step type and BPM
function kcalUnits(kg, cat, bpm) { const [a, b] = KCAL_AB[cat]; return Math.trunc(bpm * a / 20) + (kg > 0 ? Math.trunc(kg * b / 60) : 0); }
// counts calories step by step the way the game does (presses, jumps, holds and hand moves)
class StepKcal {
  constructor() { this.f = [0, 0]; this.m = [0, 0]; this.rel = [null, null]; this.cur = []; this.win = null; this.held = new Set(); this.milli = 0; this.hands = 0; }
  press(id, t) { this.held.add(id); if (this.cur.length < 2 && !this.cur.includes(id)) this.cur.push(id); if (this.win === null) this.win = t; }
  release(id) { this.held.delete(id); }
  hand(kg, bpm) { this.hands += kcalUnits(kg, 8, bpm); }
  kcal() { return (this.milli + this.hands) / 1000; }
  tick(t, kg, bpm) {
    for (let i = 0; i < 2; i++) {                               // a foot let go: lifted; over 0.5 s: off the panel
      const f = this.f[i];
      if (f && !this.held.has(f)) { this.m[i] = 1; if (this.rel[i] === null) this.rel[i] = t; if (t - this.rel[i] > 0.5) { this.f[i] = 0; this.m[i] = 0; this.rel[i] = null; } }
      else this.rel[i] = null;
    }
    if (!this.cur.length || t - this.win < 2 / 60) return;
    const P = KCAL_PART, f1 = this.f[0], f2 = this.f[1], m1 = this.m[0], m2 = this.m[1], c0 = this.cur[0], c1 = this.cur[1] || 0;
    const pairOf = (x, y, lo) => (x === lo || x === lo + 1) && y === P[x];
    let cat;
    if (this.cur.length === 1) {
      let a = m1, b = m2;
      if (!a && !b) { if (f1 === 0) a = 1; else if (f2 === 0) b = 1; else a = 1; }
      if (a) { this.f[0] = c0; if (b) this.f[1] = 0; }
      if (b) { this.f[1] = c0; if (a) this.f[0] = 0; }
      if (!m1 || !m2) {
        if (f1 === 0 && f2 === 0) cat = 0;
        else if (f1 === c0 || f2 === c0) cat = 1;
        else if (f1 === P[c0] || f2 === P[c1]) cat = 2;
        else cat = 3;
      } else cat = pairOf(f1, f2, 3) || pairOf(f1, f2, 11) ? 4 : 5;
    } else {
      this.f[0] = c0; this.f[1] = c1;
      if (f1 === 0 || f2 === 0) {
        if (pairOf(c0, c1, 3) || pairOf(c0, c1, 11)) cat = 4;
        else if (f1 === 1 || f1 === 2 || f2 === 1 || f2 === 2) cat = pairOf(c0, c1, 1) ? 4 : 5;
        else if (f1 === 9 || f1 === 10 || f2 === 9 || f2 === 10) cat = pairOf(c0, c1, 9) ? 4 : 5;
        else cat = 5;
      } else cat = (f1 === c0 && f2 === c1) || (f1 === c1 && f2 === c0) ? 6 : 7;
    }
    this.milli += kcalUnits(kg, cat, bpm);
    this.cur = []; this.win = null; this.m = [0, 0]; this.rel = [null, null];
  }
}
// WORKOUT MODE's menu screen
const WorkoutSet = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  enter() {
    this.at = performance.now(); weightLb(); S.wkTarget = S.wkTarget || 'none'; S.wkTime = S.wkTime || 20; S.wkKcal = S.wkKcal || 100;
    if (!HP4) { this.sub = null; this.d2Init(); this.i = 0; }      // (the Wii opens on MENU - Dolphin 2026-11-18, twice)
  },
  rows() { return ['WEIGHT', 'TARGET', S.wkTarget === 'time' ? 'PLAY TIME' : S.wkTarget === 'kcal' ? 'CALORIES BURNED' : null, 'START', 'WORKOUT LOG'].filter(Boolean); },
  input(a, p) {
    if (!p) return;
    if (!HP4) return this.inputD2(a);
    const rows = this.rows(), r = rows[this.i];
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < rows.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1L' || a === 'P1R') {
      const d = a === 'P1R' ? 1 : -1;
      if (r === 'WEIGHT') SAVE.weightLb = Math.max(44, Math.min(440, weightLb() + d));
      else if (r === 'TARGET') { const T = ['none', 'time', 'kcal']; S.wkTarget = T[(T.indexOf(S.wkTarget) + d + 3) % 3]; }
      else if (r === 'PLAY TIME') S.wkTime = Math.max(5, Math.min(180, S.wkTime + 5 * d));
      else if (r === 'CALORIES BURNED') S.wkKcal = Math.max(10, Math.min(2000, S.wkKcal + 10 * d));
      sfx('SE_SYS_SELECT02'); saveSettings();
    } else if (a === 'START') {
      if (r === 'START') {
        writeSave(); sfx('SE_SYS_DECIDE01');
        WK = { target: S.wkTarget, goal: S.wkTarget === 'time' ? S.wkTime * 60 : S.wkTarget === 'kcal' ? S.wkKcal : 0, kcal: 0, secs: 0, songs: 0 };
        go(Style);
      } else if (r === 'WORKOUT LOG') { sfx('SE_SYS_DECIDE01'); go(WorkoutLog); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); writeSave(); go(ModeSel); }
  },
  click() { this.input('START', true); },
  // ---- DDR II's WORKOUT MENU (Wii, Dolphin 2026-11-18). After SELECT STYLE (and the player data / height /
  // weight screens). The options page's look (select_bin group 10): header opt_wind + "WORKOUT MENU" (/10/0/0/1
  // picture 1); rows at y 84 + 45n. MENU and GOAL are setting rows (label, value box, arrows); CUT, JUMP and
  // CONFIRM are buttons at x -119 like the options' CONFIRM. CUT / JUMP open a page of PLAYER 1-4 + PARTY
  // ON / OFF with the open one's word in the tab. MENU: PLAY TIME / CALORIES BURNED / NO SETTINGS (the GOAL
  // then shows minutes, Kcal, or dashes); default 15 min. CONFIRM goes to SELECT MUSIC.
  // Row labels: /10/9 MENU 11, GOAL 7, CUT 3, JUMP 9, PLAYER 1-4 16-19, PARTY 15; tab words /10/8 CUT 4, JUMP 11.
  // (Help lines are the PC's own wording of the game's.)
  d2Rows() { return this.sub ? [16, 17, 18, 19, 15] : ['menu', 'goal', 'cut', 'jump']; },
  d2Val(r) {
    if (this.sub) { const k = [16, 17, 18, 19, 15].indexOf(r), arr = this.sub === 'cut' ? S.wkCut : S.wkJump; return arr[k] ? 'ON' : 'OFF'; }
    if (r === 'menu') return { time: 'PLAY TIME', kcal: 'CALORIES BURNED', none: 'NO SETTINGS' }[S.wkTarget] || 'NO SETTINGS';
    if (r === 'goal') return S.wkTarget === 'time' ? S.wkTime + ' min' : S.wkTarget === 'kcal' ? S.wkKcal + ' Kcal' : '- - - - - - - - -';
    return '';
  },
  d2Help(r, cOn) {
    if (cOn) return this.sub ? 'Keep these settings and go back.' : 'Start the workout.';
    if (this.sub === 'cut' || r === 'cut') return 'With CUT ON, steps shorter than a quarter note are left out.';
    if (this.sub === 'jump' || r === 'jump') return 'With JUMP OFF, arrows that come at the same time are not shown.';
    if (r === 'menu') return 'Set workout targets by goal: Play Time, Calories Burned or No Settings.';      // (the Wii's words)
    if (r === 'goal') return S.wkTarget === 'time' ? 'Input total workout time.' : S.wkTarget === 'kcal' ? 'Enter the number of calories to burn.' : 'No goal is set.';
    return '';
  },
  d2Init() {
    if (!Array.isArray(S.wkCut)) S.wkCut = [!!S.cut, false, false, false, false];
    if (!Array.isArray(S.wkJump)) S.wkJump = [S.jump !== false, true, true, true, true];
    if (!['time', 'kcal', 'none'].includes(S.wkTarget)) S.wkTarget = 'time';
    if (!(S.wkTime > 0)) S.wkTime = 15;
    if (!(S.wkKcal > 0)) S.wkKcal = 100;
  },
  inputD2(a) {
    this.d2Init();
    const rows = this.d2Rows(), n = rows.length, r = rows[this.i];
    if (a === 'P1U') { this.i = (this.i + n) % (n + 1); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D') { this.i = (this.i + 1) % (n + 1); sfx('SE_SYS_SELECT01'); }
    else if ((a === 'P1L' || a === 'P1R') && this.i < n) {
      const d = a === 'P1R' ? 1 : -1;
      if (this.sub) { const arr = this.sub === 'cut' ? S.wkCut : S.wkJump; arr[this.i] = !arr[this.i]; }
      else if (r === 'menu') { const T = ['time', 'kcal', 'none']; S.wkTarget = T[(T.indexOf(S.wkTarget) - d + 3) % 3]; }   // (the Wii: Left steps PLAY TIME -> CALORIES BURNED -> NO SETTINGS)
      else if (r === 'goal' && S.wkTarget === 'time') S.wkTime = Math.max(1, Math.min(999, S.wkTime + d));
      else if (r === 'goal' && S.wkTarget === 'kcal') S.wkKcal = Math.max(10, Math.min(9990, S.wkKcal + 10 * d));
      else return;
      sfx('SE_SYS_SELECT02'); saveSettings();
    } else if (a === 'START') {
      if (this.i < n && !this.sub && (r === 'cut' || r === 'jump')) { sfx('SE_SYS_DECIDE01'); this.sub = r; this.subFrom = this.i; this.i = 0; return; }
      if (this.i === n) {
        sfx('SE_SYS_DECIDE01');
        if (this.sub) { this.i = this.subFrom || 0; this.sub = null; saveSettings(); return; }
        // each player's CUT / JUMP (PARTY for the group styles), as the options would set them
        const party = GROUP && GROUP !== 'team';
        S.cut = !!S.wkCut[party ? 4 : 0]; S.jump = !!S.wkJump[party ? 4 : 0];
        if (P2) P2.opts = Object.assign(P2.opts || {}, { cut: !!S.wkCut[party ? 4 : 1], jump: !!S.wkJump[party ? 4 : 1] });
        PX.forEach((x, j) => { if (x) x.opts = Object.assign(x.opts || {}, { cut: !!S.wkCut[party ? 4 : j + 2], jump: !!S.wkJump[party ? 4 : j + 2] }); });
        saveSettings(); writeSave();
        WK = { target: S.wkTarget, goal: S.wkTarget === 'time' ? S.wkTime * 60 : S.wkTarget === 'kcal' ? S.wkKcal : 0, kcal: 0, secs: 0, songs: 0 };
        go(Select); sfx('VO_NAR_SELECTMUSIC');
      }
    } else if (a === 'BACK') {
      sfx('SE_SYS_WINDOWOUT');
      if (this.sub) { this.i = this.subFrom || 0; this.sub = null; return; }
      writeSave(); go(WkData);           // (the Wii: B goes back to PLAYER DATA)
    } else if (a === 'OPTIONS') {          // DEFAULT (Tab / the - button)
      if (this.sub) (this.sub === 'cut' ? S.wkCut : S.wkJump).fill(this.sub === 'jump');
      else { S.wkTarget = 'time'; S.wkTime = 15; }
      sfx('SE_SYS_SELECT02'); saveSettings();
    }
  },
  drawD2(t) {
    this.d2Init();
    const O = A.opt || {}, U = 1.5, RX = d => 640 + d * U, RY = n => (84 + 45 * n) * U;
    menuBackground(t);
    // header: opt_wind + WORKOUT MENU (the options' header place, CAE 0x9e5860)
    withMenuIn('title', () => {
      if (O.header) g.drawImage(O.header, RX(193 - 320) - 215 * U, 30 * U - 40 * U, O.header.width * U, O.header.height * U);
      const ti = O.wkTitle;
      if (ti) g.drawImage(ti, RX(193 - 320) - ti.width * 0.75, 35 * U - ti.height * 0.75, ti.width * U, ti.height * U);
      else Options.label(null, 'WORKOUT MENU', 450, 52, 24, '#fff');
    });
    if (this.sub && O.tabWin) {                      // the open page's tab (opt_wind04 + its word)
      g.drawImage(O.tabWin, RX(497 - 320) - 105 * U, 11 * U - 52 * U, 210 * U, 104 * U);
      const wim = O.big && O.big[this.sub === 'cut' ? 4 : 11];
      Options.label(wim, this.sub.toUpperCase(), RX(494 - 320), 34 * U, wim ? wim.height * U : 18);
    }
    const rows = this.d2Rows(), n = rows.length;
    const button = (cy, on, im, name, col) => {
      if (on && O.orangeBar) g.drawImage(O.orangeBar, RX(-119) - 156 * U, cy - 30 * U, 312 * U, 60 * U);
      if (O.cyanBar) g.drawImage(O.cyanBar, RX(-119) - 146 * U, cy - 21 * U, 292 * U, 42 * U);
      Options.label(im, name, RX(-128.5) + 9 * U, cy, im ? im.height * U : 22, col);
    };
    rows.forEach((r, k) => {
      const cy = RY(k), on = k === this.i;
      if (!this.sub && (r === 'cut' || r === 'jump')) { const im = O.small && O.small[r === 'cut' ? 3 : 9]; button(cy, on, im, r.toUpperCase(), '#fff'); return; }
      if (on && O.rowSel) g.drawImage(O.rowSel, RX(0) - 274 * U, cy - 30 * U, 548 * U, 60 * U);
      if (O.valBar) g.drawImage(O.valBar, RX(125.5) - 128.4 * U, cy - 16 * U, 256.8 * U, 32 * U);     // (behind the bar: fifo_ddr2_wkmenu.dff)
      if (O.rowBar) g.drawImage(O.rowBar, RX(0) - 265 * U, cy - 21 * U, 530 * U, 42 * U);
      const sim = O.small && O.small[typeof r === 'number' ? r : r === 'menu' ? 11 : 7];
      const nm = typeof r === 'number' ? (r === 15 ? 'PARTY' : 'PLAYER ' + (r - 15)) : r.toUpperCase();
      Options.label(sim, nm, RX(-129), cy, sim ? sim.height * U : 18, '#fff');
      // (the value white on every row, in the game's font - Wii screenshot; the box centred on +126)
      const v = this.d2Val(r);
      if (A.font) gtext(v, RX(128), cy + 1, 25, '#fff', 'center', 2, 1);
      else { g.save(); g.font = `bold ${fitSize(v, 26, 300)}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(v, RX(128), cy + 1); g.restore(); }
      if (on && O.arrow) {
        const bob = Math.sin(t * 8) * 2, s2 = 32 * U / O.arrow.height * 0.95;
        g.save(); g.translate(RX(20) - bob, cy); g.scale(-s2, s2); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
        g.save(); g.translate(RX(235) + bob, cy); g.scale(s2, s2); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
      }
    });
    button(RY(n), this.i === n, O.confirm, 'CONFIRM', '#ff3ca0');
    Options.helpBox(this.d2Help(rows[this.i], this.i === n));
    // hints (comAF): on a setting row BACK / SELECT / DEFAULT; on a button CONFIRM / BACK / SELECT then DEFAULT;
    // Pointer:SELECT under them (Wii screenshots). The CUT / JUMP page: BACK / SELECT / Pointer:SELECT
    const btn = this.i === n || (!this.sub && (rows[this.i] === 'cut' || rows[this.i] === 'jump'));
    const row1 = this.sub ? [3, 4, 32] : btn ? [0, 3, 4] : [3, 4, 17], row2 = this.sub ? [] : btn ? [17, 32] : [32];
    if (A.hints && A.hints[3]) {
      row1.forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24));
      row2.forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 1050 - (row2.length - 1 - j) * 155, 677, 150, 24));
    }
  },
  // HP4's WORKOUT MENU (select_bin group 15): block 90 "WORKOUT MENU" (193, 35) on its window (193, 19), block
  // 92 the rows' places (x 320, y 84 + 45n), block 94 a setting row (530 x 42 bar, its name at -129, the value
  // box at +126 with arrows at +20 / +235; /15/4/0/2: VOICE, MENU, GOAL, PLAYER 1-4, PARTY), block 93 the
  // CONFIRM button (at -119). WEIGHT, PLAY TIME / CALORIES and the log are this version's (named in text).
  drawHp4(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.title, H4.win, H4.bar, H4.barSel, H4.names, H4.cBar, H4.cSel, H4.cWords] = await Promise.all(
        ['/15/0/0/0', '/15/0/0/1', '/15/4/0/0', '/15/4/0/1', '/15/4/0/2', '/15/3/0/0', '/15/3/0/1', '/15/3/0/2'].map(one));
      H4.ok = true;
    })();
    if (!H4.ok) return false;
    menuBackground(t);
    wspr(H4.win[0], 193, 19, 215, 40, 1, 1, 217 / 255); wspr(H4.title[0], 193, 35, 140, 25);
    const val = r => r === 'WEIGHT' ? weightLb() + ' lbs'
      : r === 'TARGET' ? { none: 'NO SETTING', time: 'PLAY TIME', kcal: 'CALORIES' }[S.wkTarget]
      : r === 'PLAY TIME' ? S.wkTime + ' min' : r === 'CALORIES BURNED' ? S.wkKcal + ' kcal' : '';
    this.rows().forEach((r, i) => {
      const on = i === this.i, y = 84 + i * 45;
      if (r === 'START' || r === 'WORKOUT LOG') {
        const x = 320 - 119 + (r === 'WORKOUT LOG' ? 0 : 0);
        if (on) wspr(H4.cSel[0], x, y, 156, 30, 0.9, 0.7);
        wspr(H4.cBar[0], x, y, 146, 21);
        if (r === 'START') wspr(H4.cWords[0], x, y, 118, 16); else text('WORKOUT LOG', WX(x), WY(y), 20, '#14306e', 'center');
        return;
      }
      if (on) wspr(H4.barSel[0], 320, y, 274, 30, 0.9, 0.6);
      wspr(H4.bar[0], 320, y, 265, 21);
      if (r === 'TARGET') wspr(H4.names[2], 320 - 129, y, 118, 16);
      else text(r, WX(320 - 129), WY(y), 20, '#14306e', 'center');
      const v = val(r);
      text(v, WX(320 + 126), WY(y), fitSize(v, 20, 200), '#fff', 'center');
      if (on) { text('\u25c0', WX(320 + 20), WY(y), 20, '#ff3ca0', 'center'); text('\u25b6', WX(320 + 235), WY(y), 20, '#ff3ca0', 'center'); }
    });
    keyHints('Up/Down: choose    Left/Right: change    Enter: OK    Esc: back');
    return true;
  },
  draw(t) {
    if (!HP4) return this.drawD2(t);
    if (HP4) { if (this.drawHp4(t)) return; this.at = performance.now(); menuBackground(t); return; }   // (first visit: just the background while the disc's pictures load, not DDR II's screen for a moment)
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('WORKOUT MENU', 210, 44, 34, '#fff', 'center');
    const val = r => r === 'WEIGHT' ? weightLb() + ' lbs'
      : r === 'TARGET' ? { none: 'NO SETTING', time: 'PLAY TIME', kcal: 'CALORIES BURNED' }[S.wkTarget]
      : r === 'PLAY TIME' ? S.wkTime + ' min' : r === 'CALORIES BURNED' ? S.wkKcal + ' kcal' : '';
    this.rows().forEach((r, i) => {
      const on = i === this.i, y = 150 + i * 90, x = 300, w = 680;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : r === 'START' ? 'rgba(20,130,80,0.9)' : 'rgba(20,60,140,0.85)';
      g.fillRect(x, y, w, 70); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, 70);
      text(r, x + 30, y + 35, 26, '#fff', 'left');
      const v = val(r); if (v) text((on ? '◀  ' : '') + v + (on ? '  ▶' : ''), x + w - 24, y + 35, 22, '#ffe86a', 'right');
    });
    text('Up/Down: choose   Left/Right: change   Enter: OK   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- DDR II's keypad: NAME / HEIGHT / WEIGHT INPUT (select_bin group 5; Wii, Dolphin 2026-11-18). Laid out from
// fifo_ddr2_wkkey.dff / fifo_ddr2_wkheight.dff in 854 x 480 units round the middle (1.5 px a unit): header
// (-84, -210) with its title (-84, -205); the player's tab (218, -207) at 1.25 with PLAYER n (217, -205); the
// field (0, -126) with its label (-181, -129); the board (1, 41); 46 keys at 0.7 on a 42.1 x 44 grid from
// (-257, -49) - 1-9 0, A-J, K-T, U-Z, symbols - the chosen one at 1.0 over the orange key frame; the side
// buttons at x 213 (a/A/a or Unit, back, Space at y -48.5 / -5 / 39) and CONFIRM (213, 104.5), 0.7 - 0.8 when
// chosen, over their frames. Number pads draw the keys they don't take at half colour (vertex 128) and skip
// them. HEIGHT: one digit of feet, then inches (the cursor jumps to CONFIRM once nothing more fits); 'ft' at
// x 106.5 and 'in' at 220; WEIGHT: 'lbs' at 220 and '.' allowed. Unit swaps to cm / kg. Hints CONFIRM / BACK /
// SELECT, then Backspace (comAF 0, 3, 4 / 19).
// Not traced: the a/A/a faces (lower case and accents - keys 46-120) - NAME types capitals only here; Unit's
// metric limits; the name's length (8 here).
const KP_CHARS = '1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '・?!&+-/[].';
// the keypad's row heights
const KP_ROWY = [-49, -5, 39, 82, 126];
// the game's YES / NO window (fifo_ddr2_yesno.dff, 854 x 480 units round the middle): the screen dimmed (alpha
// 127), the window (554 x 320) in the middle, YES at y 12 and NO at y 82 - the chosen one at 1.0 over its frame
// (254 x 88), the other at 0.9; the question in the game's font at the window's top (placed from the Wii screen)
const YesNo = {
  draw(msg, i, t) {
    const Y2 = A.yesno || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h, a = 1) => { if (!im) return false; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); return true; };
    if (!put(Y2.dim, 0, 0, 1024, 640, 127 / 255)) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
    if (!put(Y2.win, 0, 0, 554, 320)) { g.fillStyle = 'rgba(20,70,170,0.95)'; g.fillRect(X(-277), Y(-160), 554 * U, 320 * U); }
    String(msg || '').split('\n').forEach((ln, k) => { if (A.font) gtext(ln, X(-242), Y(-126 + k * 25), 27, '#fff', 'left', 3.6, 1); else text(ln, X(-242), Y(-126 + k * 25), 24, '#fff', 'left'); });
    [[0, 12], [1, 82]].forEach(([k, v]) => {
      const im = Y2.btn && Y2.btn[k];
      if (k === i) { put(Y2.frame, 0, v, 254, 88); if (!put(im, 0, v, 242, 76)) text(k ? 'NO' : 'YES', X(0), Y(v), 30, '#14306e', 'center'); }
      else if (!put(im, 0, v, 217.8, 68.4)) text(k ? 'NO' : 'YES', X(0), Y(v), 26, '#14306e', 'center');
    });
  },
};
// a YES / NO question over whatever screen is up (DDR II asks these: leaving a mode, leaving WORKOUT's song select)
let YNASK = null;
// open the YES / NO window; and its buttons
function askYesNo(msg, noFirst, yes, no) { YNASK = { msg, i: noFirst ? 1 : 0, yes, no }; sfx('SE_SYS_WINDOWIN'); }
function ynInput(a) {
  const q = YNASK;
  if (a === 'P1U' || a === 'P1D') { q.i = 1 - q.i; sfx('SE_SYS_SELECT01'); }
  else if (a === 'START') { YNASK = null; if (q.i === 0) { sfx('SE_SYS_DECIDE01'); q.yes && q.yes(); } else { sfx('SE_SYS_WINDOWOUT'); q.no && q.no(); } }
  else if (a === 'BACK') { YNASK = null; sfx('SE_SYS_WINDOWOUT'); q.no && q.no(); }
}
// ---- a window of buttons over the screen (DDR II's "Load <name> data?" / "Select info to edit." - fifo_ddr2_wkload.dff,
// fifo_ddr2_wkedit.dff): the dim, comAF /4/2/0/0 (554 x 404) in the middle, the message top left (as the YES / NO
// window's, 42 units higher), buttons comAF /4/3/0/0 at 0.9 - the chosen one 1.0 over the frame /4/3/0/1
// a message with CONFIRM only (IMPORT SELECTED's "data was found"): the YES / NO window without its buttons, the
// lines centred (y -98, 26 apart), CONFIRM's hint inside it bottom right (203, 132) - measured on the Wii screenshot
let MSGASK = null;
// a message window with only OK: open it, its button, and draw it
function showMsg(msg, then) { MSGASK = { msg, then }; sfx('SE_SYS_WINDOWIN'); }
function msgInput(a) { if (a === 'START' || a === 'BACK') { const q = MSGASK; MSGASK = null; sfx(a === 'START' ? 'SE_SYS_DECIDE01' : 'SE_SYS_WINDOWOUT'); if (a === 'START' && q.then) q.then(); } }
function drawMsg(q) {
  const Y2 = A.yesno || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
  if (Y2.dim) { g.save(); g.globalAlpha = 127 / 255; g.drawImage(Y2.dim, X(-512), Y(-320), 1024 * U, 640 * U); g.restore(); } else { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
  const mw = Y2.msgWin || Y2.win;
  if (mw) g.drawImage(mw, X(-277), Y(-160), 554 * U, 320 * U); else { g.fillStyle = 'rgba(20,70,170,0.95)'; g.fillRect(X(-277), Y(-160), 554 * U, 320 * U); }
  String(q.msg || '').split('\n').forEach((ln, k) => { if (A.font) gtext(ln, X(0), Y(-98 + k * 26), 27, '#fff', 'center', 3.6, 1); else text(ln, X(0), Y(-98 + k * 26), 24, '#fff', 'center'); });
  const h = A.hints && A.hints[0]; if (h) g.drawImage(h, X(203) - 75, Y(132) - 12, 150, 24);
}
// the window of buttons that is open now (null = none); open one; its buttons
let BTNASK = null;
function askButtons(msg, btns, i, back) { BTNASK = { msg, btns, i: i || 0, back }; sfx('SE_SYS_WINDOWIN'); }
function btnInput(a) {
  const q = BTNASK, cur = q.btns[q.i];
  const d = { P1L: [-1, 0], P1R: [1, 0], P1U: [0, -1], P1D: [0, 1] }[a];
  if (d) {
    let best = -1, bd = 1e9;
    q.btns.forEach((b, k) => {
      if (k === q.i) return;
      const vx = b.u - cur.u, vy = b.v - cur.v, along = vx * d[0] + vy * d[1];
      if (along <= 1) return;
      const dd = along + Math.abs(vx * d[1] - vy * d[0]) * 2.2;
      if (dd < bd) { bd = dd; best = k; }
    });
    if (best >= 0) { q.i = best; sfx('SE_SYS_SELECT01'); }
  } else if (a === 'START') { BTNASK = null; sfx('SE_SYS_DECIDE01'); cur.fn && cur.fn(); }
  else if (a === 'BACK') { BTNASK = null; sfx('SE_SYS_WINDOWOUT'); q.back && q.back(); }
}
// draws the window of buttons
const BtnWin = {
  draw(q, t) {
    const Y2 = A.yesno || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h, a = 1) => { if (!im) return false; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); return true; };
    if (!put(Y2.dim, 0, 0, 1024, 640, 127 / 255)) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
    if (!put(Y2.win2, 0, 0, 554, 404)) { g.fillStyle = 'rgba(20,70,170,0.95)'; g.fillRect(X(-277), Y(-202), 554 * U, 404 * U); }
    String(q.msg || '').split('\n').forEach((ln, k) => { if (A.font) gtext(ln, X(-242), Y(-168 + k * 25), 27, '#fff', 'left', 3.6, 1); else text(ln, X(-242), Y(-168 + k * 25), 24, '#fff', 'left'); });
    q.btns.forEach((b, k) => {
      const im = Y2.all && Y2.all[b.pic];
      if (k === q.i) { put(Y2.frame, b.u, b.v, 254, 88); put(im, b.u, b.v, 242, 76); }
      else put(im, b.u, b.v, 217.8, 68.4);
    });
  },
};
// a date as 'YYYY-MM-DD' (today if none given) - the diary's key
function dayKey(d) { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
// a profile's weight on a day (one record a day, the last one kept) - the DIARY's WEIGHT / BMI GRAPH
function wkLogWeight(prof) {
  if (!prof || !(prof.weightLb > 0)) return;
  const L = prof.weights || (prof.weights = []), k = dayKey(), e = L.find(x => x.d === k);
  if (e) e.lb = prof.weightLb; else L.push({ d: k, lb: prof.weightLb });
  L.sort((a, b) => a.d < b.d ? -1 : 1); if (L.length > 400) L.splice(0, L.length - 400);
}
// a workout ends (the WORKOUT MENU again, or its result): the DIARY's last five (the Wii lists 0.000 ones too)
function wkSessionEnd() {
  if (HP4 || !WK || !WK_PROFILE || !WK.songs || WK.logged) return;
  WK.logged = true;
  const L = WK_PROFILE.sessions || (WK_PROFILE.sessions = []); L.unshift(+(WK.kcal || 0)); L.length = Math.min(L.length, 5); writeSave();
}
// ---- DIARY (Wii 2026-11-18; fifo_ddr2_wkdiary / wkdiary2 / wkgraph / wkbmigraph / wkbmitable / wkyear.dff), over PLAYER
// DATA dimmed (alpha 127), 854 x 480 units round the middle. Left / Right turn the 5 pages round: the totals (name bar
// select_bin /9/7/0/2 at (2.5, -175), panel /9/7/0/3 at 0.9; CUMULATIVE CALORIES BURNED, NUMBER OF SONGS PLAYED,
// AVERAGE CALORIES BURNED in comAF digits at 0.9, 16.2 apart, leading zeros grey at half alpha), DIARY (bar at -149,
// panel /9/7/0/0: the last 5 workouts' calories), WEIGHT GRAPH, BMI GRAPH (frame /9/8/0/8 pictures 0 / 1, four value
// plates /9/8/0/9, date tabs /9/9/0/1 with comAF digits at 0.65 - the last five weeks; + turns YEAR DISPLAY: the last
// twelve months, the graph green, three month tabs /9/9/0/2), BMI TABLE (/9/10/0/2). Values are masked ('*') as the Wii
// shows them; View info (Tab here) shows them - PC only (the Wii didn't, for any button). A / B: back to the profile's window. Under the
// pages: the arrows (y 150) and CONFIRM /9/6/0/0 (-0.5, 155) at 0.9.
// The graphs: the line (cyan 0,226,255) runs from the graph's left edge to today (x -156 -> 218 by days, 11 a day;
// year: -133 -> 219, 32 a month); its height: the value's middle plate gap (y -37) - the plates' values and spacing are
// ASSUMED (the Wii kept them masked): centred on the value rounded, 10 lbs / 5 kg / 2 BMI a plate apart.
const WkDiary = {
  bgm: 'MU_BGM_FREE',
  with(prof) { this.prof = prof; return this; },
  enter() { this.page = 0; this.year = false; this.reveal = false; },
  input(a, p) {
    if (!p) return;
    if (a === 'P1L' || a === 'P1R') { this.page = (this.page + (a === 'P1R' ? 1 : 4)) % 5; sfx('SE_SYS_SELECT01'); }
    else if (a === 'SWITCH' && (this.page === 2 || this.page === 3)) { this.year = !this.year; sfx('SE_SYS_SELECT02'); }
    else if (a === 'OPTIONS' && this.page >= 2) { this.reveal = !this.reveal; sfx('SE_SYS_SELECT02'); }   // (Tab: show the hidden numbers - PC only, the user's choice; the Wii showed nothing)
    else if (a === 'START' || a === 'BACK') { sfx(a === 'START' ? 'SE_SYS_DECIDE01' : 'SE_SYS_WINDOWOUT'); const pr = this.prof; go(WkData); WkData.loadMenu(pr); }
  },
  click() { this.input('START', true); },
  bmiOf(lb) { const h = this.prof.heightIn || SAVE.heightIn || 0; return h > 0 && lb > 0 ? 703 * lb / (h * h) : 0; },
  // the profile's weight on a day: the last record on or before it (before the first: the first)
  weightOn(day) {
    const L = this.prof.weights || [];
    if (!L.length) return this.prof.weightLb || 0;
    let v = L[0].lb; for (const e of L) { if (e.d <= day) v = e.lb; else break; }
    return v;
  },
  draw(t) {
    WkData.draw(t);
    const D = A.wkDiary || {}, Y2 = A.yesno || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U, pr = this.prof || {};
    const put = (im, u, v, w, h, a = 1) => { if (!im) return; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); };
    if (Y2.dim) put(Y2.dim, 0, 0, 1024, 640, 127 / 255); else { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
    const N = A.num28 || [], ch = c => N[c === '.' ? 21 : c === ':' ? 20 : c === '/' ? 23 : c === '*' ? 25 : +c];
    // a string set from the right: each char `step` apart, leading zeros (before `firm` chars from the right) grey
    const nums = (str, right, v, sz, step, greyLead) => {
      const n = str.length; let lead = true;
      [...str].forEach((c, k) => {
        if (c === ' ') return;
        const fromR = n - 1 - k, isLead = greyLead && lead && c === '0' && fromR >= greyLead;
        if (c !== '0' || fromR < greyLead) lead = false;
        const im = ch(c); if (!im) return;
        put(isLead ? tintImg(im, 'rgb(128,128,128)') : im, right - step * fromR, v, sz, sz, isLead ? 0.5 : 1);
      });
    };
    const hints = (L, v, w, h) => L.forEach(([id, u]) => put(A.hints && A.hints[id], u, v, w, h));
    const fmt53 = x => { const [a, b] = Math.min(99999.999, Math.max(0, x)).toFixed(3).split('.'); return a.padStart(5, '0') + '.' + b; };
    const name = (v) => { put(D.nameBar, 2.5, v, 540, 72); if (A.font) gtext(pr.name || '', X(84), Y(v - 1), 40, '#fff', 'center', 3, 1); else text(pr.name || '', X(84), Y(v - 1), 32, '#fff', 'center'); };
    const pg = this.page;
    if (pg === 0) {
      put(D.panel0, 3.1, 0.4, 475.2, 261.9); name(-175);
      hints([[1, -10.4], [9, 85], [32, 180.4]], 110.2, 90, 14.4);
      const tot = pr.kcalTotal || 0, n = pr.songs || 0;
      nums(fmt53(tot), 165.1, -76.1, 25.2, 16.2, 5);
      nums(String(Math.min(999999999, n)).padStart(9, '0'), 129.1, 0.4, 25.2, 16.2, 1);
      nums(fmt53(n ? tot / n : 0), 165.1, 76.9, 25.2, 16.2, 5);
    } else if (pg === 1) {
      put(D.panel1, 3.1, 23.5, 475.2, 216); name(-149);
      hints([[1, -10.4], [9, 85], [32, 180.4]], 111.7, 90, 14.4);
      const S5 = pr.sessions || [];
      for (let k = 0; k < 5; k++) nums(fmt53(S5[k] || 0), 162.4, -27.8 + 27 * k, 25.2, 16.2, 5);
    } else if (pg === 2 || pg === 3) {
      const bmiP = pg === 3, yr = this.year, metric = !!SAVE.metric;
      // the grid (fifo_ddr2_wkgraph / wkyear.dff): /9/8/0/0 448 x 288 at (45.5, -46) in (0,58,73) - green (0,84,30) by
      // year; /9/8/0/10 lines in white at alpha 64: across at y 77 - 28n (9), down (320 high, y -45.5) every day from
      // x -156.5 (11 apart, each 7th from the first - and today's - orange 255,150,56 and 32 wide) or every month from
      // -133.5 (32 apart)
      const sq = D.square, ln = D.line, tint = (im, c) => im && tintImg(im, c);
      if (sq) put(tint(sq, yr ? 'rgb(0,84,30)' : 'rgb(0,58,73)'), 45.5, -46, 448, 288); else { g.fillStyle = yr ? 'rgb(0,84,30)' : 'rgb(0,58,73)'; g.fillRect(X(45.5 - 224), Y(-46 - 144), 448 * U, 288 * U); }
      if (ln) {
        for (let k = 0; k < 9; k++) put(ln, 51.5, 77 - 28 * k, 448, 16, 64 / 255);
        // (the down lines are the same picture turned a quarter round)
        const down = (im, u, w, a) => { g.save(); g.globalAlpha *= a; g.translate(X(u), Y(-45.5)); g.rotate(Math.PI / 2); g.drawImage(im, -160 * U, -w * U / 2, 320 * U, w * U); g.restore(); };
        if (!yr) for (let k = 0; k <= 34; k++) { const or = k % 7 === 0 || k === 34; down(or ? tint(ln, 'rgb(255,150,56)') : ln, -156.5 + 11 * k, or ? 32 : 16, or ? 1 : 64 / 255); }
        else for (let m = 0; m < 12; m++) down(ln, -133.5 + 32 * m, 16, 64 / 255);
      }
      put(D.frame && D.frame[bmiP ? 1 : 0], -0.5, 3, 592, 444);
      // the series: by day (last five weeks) or by month (last twelve)
      const now = new Date(), pts = [];
      const val = day => { const w = this.weightOn(day); return bmiP ? this.bmiOf(w) : metric ? w / 2.2046 : w; };
      if (!yr) for (let d = -34; d <= 0; d++) { const x = new Date(now); x.setDate(now.getDate() + d); pts.push([-156 + 11 * (d + 34), val(dayKey(x))]); }
      else for (let m = 0; m < 12; m++) { const x = m === 11 ? now : new Date(now.getFullYear(), now.getMonth() - 11 + m + 1, 0); pts.push([-133 + 32 * m, val(dayKey(x))]); }
      const cur = pts[pts.length - 1][1], stepV = bmiP ? 2 : metric ? 5 : 10, c = Math.round(cur), yOf = v => -37 - (v - c) * 56 / stepV;
      const has = (pr.weights && pr.weights.length) || pr.weightLb;
      if (has && cur > 0) {
        g.save(); g.beginPath(); g.rect(X(-178), Y(-190), 448 * U, 288 * U); g.clip();
        g.strokeStyle = 'rgb(0,226,255)'; g.lineWidth = 2; g.beginPath();
        // (straight runs drawn as one: the Wii drew a single line for an unchanging weight)
        pts.forEach(([u, v], k) => { if (k === 0) g.moveTo(X(u), Y(yOf(v))); else g.lineTo(X(u), Y(yOf(v))); }); g.stroke();
        g.restore();
        // today's point: /9/8/0/3 (16 x 16) in the line's colour
        const [lu, lv] = pts[pts.length - 1];
        if (D.dot) put(tintImg(D.dot, 'rgb(0,226,255)'), lu - 0.5, yOf(lv) + 0.7, 16, 16); else { g.fillStyle = 'rgb(0,226,255)'; g.beginPath(); g.arc(X(lu), Y(yOf(lv)), 4, 0, Math.PI * 2); g.fill(); }
      }
      // the four plates (bottom to top: c - 1.5 steps .. c + 1.5 steps)
      const len = bmiP ? 4 : 5, show = v => this.reveal && has ? v.toFixed(1).slice(-len).padStart(len, ' ') : '*'.repeat(len);
      [47, -9, -65, -121].forEach((v, k) => { put(D.plate, -223.5, v, 120, 50); nums(show(c + (k - 1.5) * stepV), -194.5, v - 2, 25.2, 16.2, 0); });
      if (!bmiP) put(D.unit && D.unit[metric ? 0 : 1], -189.5, -156, 100, 33);
      put(D.time, 231.5, 61, 100, 33);
      // the tabs
      if (!yr) for (let k = 0; k < 6; k++) {
        const x = new Date(now); x.setDate(now.getDate() + (k < 5 ? -34 + 7 * k : 0));
        const u = -158.5 + 77 * k; put(D.tab && D.tab[k < 5 ? 1 : 2], u, 106, 86, 44);
        const s2 = String(x.getMonth() + 1).padStart(2, ' ') + '/' + String(x.getDate()).padStart(2, ' ');
        [...s2].forEach((cc, j) => { if (cc !== ' ') put(ch(cc), u - 23.8 + 11.7 * j, 106, 18.2, 18.2); });
      } else [[0, -133.5], [5, 26.5], [11, 217.5]].forEach(([m, u]) => { put(D.tab && D.tab[0], u, 106, 132, 44); put(D.month && D.month[(now.getMonth() - 11 + m + 12) % 12], u, 106.5, 110, 33); });
      // the box top right: IDEAL WEIGHT (BMI 22, as the BMI panel - ASSUMED) / CURRENT BMI with its band
      if (!bmiP) {
        put(D.box && D.box[0], 194.5, -185, 206, 70); put(D.unit && D.unit[metric ? 0 : 1], 255.5, -173, 100, 33);
        const h = pr.heightIn || SAVE.heightIn || 0, ideal = h ? 22 * h * h / 703 : 0;
        nums(this.reveal && ideal ? (metric ? ideal / 2.2046 : ideal).toFixed(1).slice(-5).padStart(5, ' ') : '*****', 223.5, -176, 28, 18, 0);
      } else this.bmiBox(D.box && D.box[1], put, nums);
      hints([[1, -199.5], [9, -95.5], [32, 8.5], [yr ? 14 : 13, 112.5], [23, 215.5]], 198, 100, 16.2);
    } else {
      put(D.table, -0.5, 3, 592, 444);
      this.bmiBox(D.tableBox, put, nums);
      hints([[1, -94.5], [9, 9.5], [32, 113.5], [23, 216.5]], 198, 100, 16.2);
    }
    // under the pages: the arrows and CONFIRM
    const ar = A.img.magenta;
    if (ar) [[-243.5, -1], [242.5, 1]].forEach(([u, d]) => { g.save(); g.translate(X(u), Y(150)); g.scale(d * 63 / ar.width, 63 / ar.height); g.drawImage(ar, -ar.width / 2, -ar.height / 2); g.restore(); });
    put(D.confirm, -0.5, 155, 162, 37.8);
  },
  // CURRENT BMI: the box, its band (/9/8/0/1: 0 AVERAGE WEIGHT, 1-4 Obesity index 1-4, 5 LIGHTWEIGHT, 6 masked) and value
  bmiBox(box, put, nums) {
    const b = this.bmiOf(this.prof.weightLb || 0), D = A.wkDiary || {};
    put(box, 194.5, -185, 206, 70);
    const band = !this.reveal || !b ? 6 : b < 18.5 ? 5 : b < 25 ? 0 : b < 30 ? 1 : b < 35 ? 2 : b < 40 ? 3 : 4;
    put(D.band && D.band[band], 194.5, -176, 188, 36);
    nums(this.reveal && b ? b.toFixed(1).slice(-4).padStart(4, ' ') : '****', 270.5, -203, 28, 18, 0);
  },
};
let WK_PROFILE = null;        // (the workout PLAYER DATA in use; null = GUEST)
// ---- DDR II's WORKOUT PLAYER DATA (Wii, Dolphin 2026-11-18; fifo_ddr2_wkdata.dff matched to select_bin by texture
// bytes). 854 x 480 units round the middle: header /1/0/0/3 (-0.5, -210) + "PLAYER DATA" /9/0/0/4 (-0.5, -205);
// top row GUEST / IMPORT ALL / IMPORT SELECTED (/9/4/0/2 pictures 1 / 2 / 3) at x -155.5 / -0.5 / 154.5, y -105,
// 0.63 - the chosen one 0.9 over its frame /9/4/0/3; three profile cards (/9/4/0/2 picture 0) at the same x,
// y 26, numbered by /9/4/0/1 (1-9) at (card - 41.6, 3.3), the profile's name on the card in the game's font
// ("New Entry" for an empty one); the page arrows /2/2/0/4 at x -243.5 / 242.5, y -44 (0.6); the help window
// at y 381 of the layout. Profiles keep a name, height and weight (SAVE.wkProfiles, 9 at most: 3 pages).
// GUEST asks first (results won't be saved); New Entry takes a name, then height and weight; a saved profile
// goes straight to the WORKOUT MENU with its height and weight. IMPORT ALL / IMPORT SELECTED (not traced: what
// the Wii imports from is not known here) make profiles from the PC's players.
const WkData = {
  i: 0, page: 0, ask: null, msg: '',
  enter() { this.at = performance.now(); this.ask = null; this.msg = this.pend || ''; this.pend = ''; if (!Array.isArray(SAVE.wkProfiles)) SAVE.wkProfiles = []; },
  // a saved profile (Wii 2026-11-18): "Record new weight?" (NO chosen; YES = WEIGHT INPUT with the old weight, then the
  // BMI panel), then the "Load <name> data?" window - PLAY / EDIT / DIARY / DELETE / CANCEL. A profile with a password
  // asks for it first (ASSUMED - the Wii's ALEX had none)
  pickProfile(prof) {
    const back = () => { go(WkData); this.loadMenu(prof); };
    const ask = () => askYesNo('Record new weight?', true, () => {
      if (prof.heightIn) SAVE.heightIn = prof.heightIn;
      go(WkPad.with('weight', () => { prof.weightLb = SAVE.weightLb || prof.weightLb; wkLogWeight(prof); writeSave(); back(); }, back, false, prof.weightLb ? String(prof.weightLb) : ''));
    }, () => this.loadMenu(prof));
    if (prof.password) go(WkPad.with('password', pw => { if (pw === prof.password) { go(WkData); ask(); } else { this.pend = 'The password is not correct.'; go(WkData); } }, () => go(WkData)));
    else ask();
  },
  loadMenu(prof, at) {
    // (the cursor comes back on the button that was used - Wii: DIARY, DELETE's NO)
    const k0 = at !== undefined ? at : prof === this.lastProf ? this.lastAt || 0 : 0;
    this.lastProf = prof;
    const keep = k => () => { this.lastAt = k; };
    askButtons('Load ' + prof.name + ' data?', [
      { pic: 8, u: -120, v: -23, fn: () => { WK_PROFILE = prof; if (prof.heightIn) SAVE.heightIn = prof.heightIn; if (prof.weightLb) SAVE.weightLb = prof.weightLb; go(WorkoutSet); } },
      { pic: 10, u: 120, v: -23, fn: () => { keep(1)(); this.editMenu(prof); } },
      { pic: 11, u: -120, v: 46, fn: () => { keep(2)(); go(WkDiary.with(prof)); } },
      // (DELETE: "Delete this user?", YES chosen - Wii; NO comes back here on DELETE)
      { pic: 9, u: 120, v: 46, fn: () => { keep(3)(); askYesNo('Delete this user?', false, () => { const L = this.profs(), k = L.indexOf(prof); if (k >= 0) L.splice(k, 1); this.lastProf = null; writeSave(); }, () => this.loadMenu(prof)); } },
      { pic: 1, u: -120, v: 115, fn: () => { this.lastAt = 0; } },
    ], k0, () => { this.lastAt = 0; });
  },
  // EDIT: "Select info to edit." - NAME / PASSWORD / WEIGHT / HEIGHT / CONFIRM / CANCEL (fifo_ddr2_wkedit.dff: comAF /4/3/0/0
  // pictures 13 / 14 / 15 / 16 / 0 / 1). The changes are kept until CONFIRM (ASSUMED: what CONFIRM / CANCEL lead to)
  editMenu(prof, draft) {
    const d = draft || Object.assign({}, prof), again = () => { go(WkData); this.editMenu(prof, d); };
    askButtons('Select info to edit.', [
      { pic: 13, u: -120, v: -23, fn: () => go(WkPad.with('name', nm => { if (nm) d.name = nm.toUpperCase(); again(); }, again, false, d.name)) },
      { pic: 14, u: 120, v: -23, fn: () => go(WkPad.with('password', pw => { d.password = pw; again(); }, again)) },
      { pic: 15, u: -120, v: 46, fn: () => { if (d.heightIn) SAVE.heightIn = d.heightIn; go(WkPad.with('weight', () => { d.weightLb = SAVE.weightLb; again(); }, again, false, d.weightLb ? String(d.weightLb) : '')); } },
      { pic: 16, u: 120, v: 46, fn: () => go(WkPad.with('height', () => { d.heightIn = SAVE.heightIn; again(); }, again, true)) },
      { pic: 0, u: -120, v: 115, fn: () => { const w = d.weightLb !== prof.weightLb; Object.assign(prof, d); if (w) wkLogWeight(prof); writeSave(); this.loadMenu(prof); } },
      { pic: 1, u: 120, v: 115, fn: () => this.loadMenu(prof) },
    ], 0, () => this.loadMenu(prof));
  },
  profs() { return SAVE.wkProfiles || []; },
  // cursor: 0-2 the top row, 3-5 the cards on this page
  card(k) { const n = this.page * 3 + k, p = this.profs()[n]; return { n, p, empty: !p }; },
  help() {
    if (this.ask) return this.ask.msg;
    if (this.msg) return this.msg;
    // (the Wii's words, Dolphin 2026-11-18; here "DanceDanceRevolution player data" is this PC's players)
    if (this.pick) return 'Select which data to import.';
    if (this.i === 0) return 'Select player data for Player 1.\nPlay without saving.';
    if (this.i === 1) return 'Imports all DanceDanceRevolution\nplayer data.';
    if (this.i === 2) return 'Imports selected data from\nDanceDanceRevolution\nplayer data.';
    return 'Select player data for Player 1.';            // (New Entry too - Wii)
  },
  // IMPORT ALL (Wii: the YES / NO question, NO chosen; "Existing player data will be overwritten") - the PC's players
  // replace the list (ASSUMED: what carries over - the name; height and weight as now set)
  importAll() {
    const names = Object.keys(DATA.profiles || {}).slice(0, 9);
    SAVE.wkProfiles = names.map(nm => ({ name: nm.slice(0, 8).toUpperCase(), heightIn: SAVE.heightIn || 0, weightLb: SAVE.weightLb || 0 }));
    writeSave(); this.page = 0;
  },
  // IMPORT SELECTED (fifo_ddr2_wkimport.dff): "DanceDanceRevolution data was found. Select which data to import." (a
  // message with CONFIRM), then six cards (/9/4/0/2 picture 0, x -155.5 / -0.5 / 154.5, y -105 / 26) with their numbers,
  // empty ones "No Data" in grey (181); the chosen one 0.9 over the frame. The picked one is added (ASSUMED: to the
  // first free place)
  pickNames() { return Object.keys(DATA.profiles || {}); },
  importNames(names) {
    const L = this.profs(); let added = 0;
    for (const nm of names) {
      if (!nm || L.length >= 9 || L.some(p => p.name === nm)) continue;
      L.push({ name: nm.slice(0, 8).toUpperCase(), heightIn: SAVE.heightIn || 0, weightLb: SAVE.weightLb || 0 }); added++;
    }
    writeSave(); this.msg = added ? added + ' player data added.' : 'No new player data to add.';
  },
  usePad(prof) {
    // height, then weight, then the WORKOUT MENU; a profile keeps what was typed
    const done = () => { if (prof) { prof.heightIn = SAVE.heightIn || 0; prof.weightLb = SAVE.weightLb || 0; wkLogWeight(prof); writeSave(); } go(WorkoutSet); };
    go(WkPad.with('height', done, () => go(WkData)));
  },
  pickInput(a) {
    const P = this.pick, L = this.pickNames(), col = P.i % 3, row = (P.i / 3) | 0, pages = Math.max(1, Math.ceil(L.length / 6));
    if (a === 'P1L' || a === 'P1R') {
      const d = a === 'P1R' ? 1 : -1;
      if (col + d < 0 || col + d > 2) { if (pages > 1) { P.page = (P.page + d + pages) % pages; P.i = row * 3 + (d > 0 ? 0 : 2); } }
      else P.i += d;
      sfx('SE_SYS_SELECT01');
    } else if (a === 'P1U' || a === 'P1D') { P.i = (P.i + 3) % 6; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') {
      const nm = L[P.page * 6 + P.i];
      if (!nm) { sfx('SE_SYS_CANCEL'); return; }
      sfx('SE_SYS_DECIDE01'); this.pick = null; this.importNames([nm]);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.pick = null; }
  },
  input(a, p) {
    if (!p) return;
    if (this.pick) return this.pickInput(a);
    if (this.ask) {
      if (a === 'P1U' || a === 'P1D') { this.ask.i = 1 - this.ask.i; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') { const yes = this.ask.i === 0; this.ask = null; sfx(yes ? 'SE_SYS_DECIDE01' : 'SE_SYS_WINDOWOUT'); if (yes) { WK_PROFILE = null; this.usePad(null); } }
      else if (a === 'BACK') { this.ask = null; sfx('SE_SYS_WINDOWOUT'); }
      return;
    }
    const top = this.i < 3, col = top ? this.i : this.i - 3;
    if (a === 'P1L' || a === 'P1R') {
      const d = a === 'P1R' ? 1 : -1;
      if (!top && ((d < 0 && col === 0 && this.page > 0) || (d > 0 && col === 2 && this.page < 2))) { this.page += d; this.i = d > 0 ? 3 : 5; }
      else this.i = (top ? 0 : 3) + Math.max(0, Math.min(2, col + d));
      this.msg = ''; sfx('SE_SYS_SELECT01');
    } else if (a === 'P1U' || a === 'P1D') { this.i = top ? 3 + col : col; this.msg = ''; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') {
      sfx('SE_SYS_DECIDE01'); this.msg = '';
      if (this.i === 0) { this.ask = { i: 0, msg: 'Game play results will not be\nsaved. Is this okay?' }; sfx('SE_SYS_WINDOWIN'); }      // (the Wii's words, YES chosen)
      else if (this.i === 1) askYesNo('Importing all DanceDanceRevolution\nplayer data.\nExisting player data will be overwritten.\nAre you sure?', true, () => this.importAll());
      else if (this.i === 2) {
        if (this.pickNames().length) showMsg('DanceDanceRevolution\ndata was found.\nSelect which data to import.', () => { this.pick = { i: 0, page: 0 }; });
        else showMsg('No DanceDanceRevolution\ndata was found.');          // (ASSUMED wording)
      }
      else {
        const c = this.card(col);
        if (c.empty) {
          if (c.n > this.profs().length) { this.msg = 'Fill the slots in order.'; return; }
          go(WkPad.with('name', nm => {
            if (!nm) return go(WkData);
            const prof = { name: nm.toUpperCase(), heightIn: 0, weightLb: 0 }; this.profs().push(prof); writeSave();
            WK_PROFILE = prof; this.usePad(prof);
          }, () => go(WkData)));
        } else this.pickProfile(c.p);
      }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Style); }
  },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, W2 = A.wkData || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h, a = 1) => { if (!im) return; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); };
    withMenuIn('title', () => { put(W2.head, -0.5, -210, 430, 80); put(W2.title, -0.5, -205, 300, 50); });
    const XS = [-155.5, -0.5, 154.5];
    const btn = (im, k, v, on) => { if (on) { put(W2.frame, XS[k], v, 199.8, 125.1); put(im, XS[k], v, 198, 118.8); } else put(im, XS[k], v, 138.6, 83.2); };
    if (this.pick) {
      const L = this.pickNames(), P = this.pick, grey = im => im && tintImg(im, 'rgb(181,181,181)');
      for (let k = 0; k < 6; k++) {
        const n = P.page * 6 + k, nm = L[n], on = P.i === k, v = k < 3 ? -105 : 26, u = XS[k % 3], sc = on ? 0.9 / 0.63 : 1;
        const card = nm ? W2.btn && W2.btn[0] : grey(W2.btn && W2.btn[0]);
        if (on) { put(W2.frame, u, v, 199.8, 125.1); put(card, u, v, 198, 118.8); } else put(card, u, v, 138.6, 83.2);
        const num = W2.num && W2.num[n % 9]; put(nm ? num : grey(num), u - 41.6 * sc, v - 22.7 * sc, 25.2 * sc, 25.2 * sc);
        const label = nm ? nm.slice(0, 8).toUpperCase() : 'No Data';
        if (A.font) gtext(label, X(u), Y(v + 4), (nm ? 26 : 19) * sc, '#fff', 'center', 2, 1); else text(label, X(u), Y(v + 4), 18 * sc, '#fff', 'center');
      }
    } else {
    [1, 2, 3].forEach((pi, k) => btn(W2.btn && W2.btn[pi], k, -105, !this.ask && this.i === k));
    for (let k = 0; k < 3; k++) {
      const c = this.card(k), on = !this.ask && this.i === 3 + k, sc = on ? 0.9 / 0.63 : 1;
      btn(W2.btn && W2.btn[0], k, 26, on);
      put(W2.num && W2.num[c.n], XS[k] - 41.6 * sc, 26 - 22.7 * sc, 25.2 * sc, 25.2 * sc);
      const nm = c.empty ? 'New Entry' : c.p.name, sz = c.empty ? 19 : 26;
      if (A.font) gtext(nm, X(XS[k]), Y(30), sz * sc, c.empty ? '#ffffff' : '#ffffff', 'center', 2, 1);
      else text(nm, X(XS[k]), Y(30), sz * sc * 0.85, '#fff', 'center');
    }
    }
    // the page arrows (pink, either side)
    // (Wii, fifo_ddr2_wkload.dff: SELECT MUSIC's magenta arrow mus /0/5/0/0, 70 x 70 drawn 42 x 42, still - not /2/2/0/4)
    const ar = A.img.magenta || W2.arrow;
    if (ar) {
      g.save(); g.translate(X(-243.5), Y(-44)); g.scale(-0.6 * U * 70 / ar.width, 0.6 * U * 70 / ar.height); g.drawImage(ar, -ar.width / 2, -ar.height / 2); g.restore();
      g.save(); g.translate(X(242.5), Y(-44)); g.scale(0.6 * U * 70 / ar.width, 0.6 * U * 70 / ar.height); g.drawImage(ar, -ar.width / 2, -ar.height / 2); g.restore();
    }
    // the help window: /3/0/0/1 (570 x 98) at (-0.5, 141), its mirror at (-1.5, 234) at alpha 127 (FIFO)
    if (W2.help) {
      const r = (() => { let c = HELP_REFL.get(W2.help); if (!c && M.helpMask) { c = document.createElement('canvas'); c.width = W2.help.width; c.height = W2.help.height; const q = c.getContext('2d'); q.drawImage(W2.help, 0, 0); q.globalCompositeOperation = 'destination-in'; q.drawImage(M.helpMask, 0, 0, c.width, c.height); HELP_REFL.set(W2.help, c); } return c; })();
      if (r) { g.save(); g.globalAlpha *= 127 / 255; g.translate(X(-1.5), Y(234)); g.scale(1, -1); g.drawImage(r, -570 * U / 2, -98 * U / 2, 570 * U, 98 * U); g.restore(); }
      put(W2.help, -0.5, 141, 570, 98);
      String(this.help()).split('\n').forEach((ln, k) => { if (A.font) gtext(ln, X(-262), Y(118 + k * 21), 27, '#fff', 'left', 3.6, 1); else text(ln, X(-262), Y(118 + k * 21), 22, '#fff', 'left'); });
    } else helpWindow(this.help(), 320, 381);
    if (this.ask) this.drawAsk(t);
    if (A.hints && A.hints[0]) { [0, 3, 4].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24)); if (A.hints[32]) g.drawImage(A.hints[32], 1050, 677, 150, 24); }
  },
  drawAsk(t) { YesNo.draw(this.ask.msg, this.ask.i, t); },
  click() { this.input('START', true); },
};
// the HEIGHT / WEIGHT keypad of WORKOUT PLAYER DATA
const WkPad = {
  mode: 'height', i: 0, then: null, back: null,
  // single: HEIGHT alone (EDIT), not followed by WEIGHT; pre: what the field opens with (an existing profile's weight -
  // the Wii showed it masked when recording a new weight)
  with(mode, then, back, single, pre) { this.mode = mode; this.then = then || null; this.back = back || null; this.single = !!single; this.pre = pre || ''; return this; },
  enter() {
    this.at = performance.now();
    // (the Wii opens the pad empty - GUEST and a new profile; an empty CONFIRM keeps what was there)
    this.val = this.pre || ''; this.ft = ''; this.inch = ''; this.metric = !!SAVE.metric; this.panel = false; this.panelDone = false; this.reveal = false;
    this.i = 'conf';                                         // (the Wii opens on CONFIRM)
  },
  number() { return this.mode !== 'name' && this.mode !== 'password'; },
  // every place the cursor can stop: [id, x, y]
  spots() {
    const L = [];
    for (let k = 0; k < 46; k++) {
      const r = k < 10 ? 0 : k < 20 ? 1 : k < 30 ? 2 : k < 36 ? 3 : 4, c = k < 30 ? k % 10 : k < 36 ? k - 30 : k - 36;
      L.push([k, -257 + 42.1 * c, KP_ROWY[r]]);
    }
    L.push(['s0', 213, -48.5], ['s1', 213, -5], ['s2', 213, 39], ['conf', 213, 104.5]);
    return L;
  },
  enabled(id) {
    if (!this.number()) return true;
    if (id === 's2') return false;                           // (no Space)
    if (typeof id !== 'number') return true;
    return id < 10 || (this.mode === 'weight' && id === 45);   // digits; '.' on WEIGHT
  },
  move(dx, dy) {
    const S2 = this.spots(), cur = S2.find(s => s[0] === this.i) || S2[S2.length - 1];
    let best = null, bd = 1e9;
    for (const s of S2) {
      if (s[0] === this.i || !this.enabled(s[0])) continue;
      const vx = s[1] - cur[1], vy = s[2] - cur[2], along = vx * dx + vy * dy;
      if (along <= 1) continue;
      const side = Math.abs(vx * dy - vy * dx), d = along + side * 2.2;   // (the nearest one that way; off-line costs more)
      if (d < bd) { bd = d; best = s; }
    }
    if (best) { this.i = best[0]; sfx('SE_SYS_SELECT01'); }
  },
  full() {
    if (this.mode === 'height') return this.metric ? this.val && this.val.length >= 3 : this.ft !== '' && (this.inch.length >= 2 || (this.inch !== '' && +this.inch >= 2));
    if (this.mode === 'weight') { const v = this.val || ''; return v.includes('.') && v.split('.')[1].length >= 1; }
    return (this.val || '').length >= 8;
  },
  type(ch) {
    if (!this.number()) { if ((this.val || '').length < 8) this.val = (this.val || '') + ch; return; }
    if (this.mode === 'height' && !this.metric) {
      if (this.ft === '') { if (ch !== '0') this.ft = ch; }
      else if (this.inch.length < 2 && +(this.inch + ch) <= 11) this.inch += ch;
    } else {
      const v = this.val || '';
      if (ch === '.') { if (this.mode === 'weight' && v && !v.includes('.')) this.val = v + '.'; }
      else if (v.includes('.')) { if (v.split('.')[1].length < 1) this.val = v + ch; }
      else if (v.length < 3 && !(v === '' && ch === '0')) this.val = v + ch;
    }
    if (this.full()) this.i = 'conf';                         // (nothing more fits: the cursor jumps to CONFIRM)
  },
  backspace() {
    if (this.mode === 'height' && !this.metric) { if (this.inch) this.inch = this.inch.slice(0, -1); else this.ft = ''; }
    else this.val = (this.val || '').slice(0, -1);
  },
  confirm() {
    if (this.mode === 'height') {
      if (this.metric) { const cm = +this.val; if (cm > 0) SAVE.heightIn = Math.round(cm / 2.54); }
      else if (this.ft !== '') SAVE.heightIn = +this.ft * 12 + (+this.inch || 0);
    } else if (this.mode === 'weight') {
      // (the Wii won't take an empty weight; after it, the WEIGHT / IDEAL WEIGHT / BMI panel)
      const v = parseFloat(this.val);
      if (!(v > 0)) { sfx('SE_SYS_WINDOWOUT'); return; }
      SAVE.weightLb = Math.max(44, Math.min(440, Math.round(this.metric ? v * 2.2046 : v)));
      if (!this.panelDone) { SAVE.metric = !!this.metric; writeSave(); sfx('SE_SYS_WINDOWIN'); this.panel = true; this.panelDone = true; this.reveal = false; return; }
    }
    SAVE.metric = !!this.metric; writeSave();
    sfx('SE_SYS_DECIDE01');
    if (!this.number() && this.then) return this.then(this.val || '');
    if (this.mode === 'height' && !this.single) return go(WkPad.with('weight', this.then, () => go(WkPad.with('height', this.then, this.back))));
    if (typeof this.then === 'function') this.then(); else go(WorkoutSet);
  },
  input(a, p) {
    if (!p) return;
    if (this.panel) {                        // the BMI panel: EXIT (A or B), Unit (Space), View info (Tab)
      if (a === 'START' || a === 'BACK') { this.panel = false; return this.confirm(); }
      if (a === 'SWITCH') { this.metric = !this.metric; SAVE.metric = this.metric; sfx('SE_SYS_SELECT02'); }
      if (a === 'OPTIONS') { this.reveal = !this.reveal; sfx('SE_SYS_SELECT02'); }   // (Tab: show the hidden numbers - PC only)
      return;
    }
    if ((a === 'SWITCH' || a === 'OPTIONS') && this.mode === 'weight') { this.reveal = !this.reveal; sfx('SE_SYS_SELECT02'); return; }   // (View info: Tab or Space shows the weight - PC only)
    if (a === 'P1L') this.move(-1, 0); else if (a === 'P1R') this.move(1, 0);
    else if (a === 'P1U') this.move(0, -1); else if (a === 'P1D') this.move(0, 1);
    else if (a === 'START') {
      const id = this.i;
      if (id === 'conf') return this.confirm();
      if (!this.enabled(id)) return;
      sfx('SE_SYS_DECIDE01');
      if (id === 's1') this.backspace();
      else if (id === 's2') this.type(' ');
      else if (id === 's0') { if (this.number()) { this.metric = !this.metric; this.val = ''; this.ft = ''; this.inch = ''; } }
      else this.type(KP_CHARS[id]);
    } else if (a === 'OPTIONS') { sfx('SE_SYS_SELECT02'); this.backspace(); }      // (the - button: Backspace)
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); if (typeof this.back === 'function') this.back(); else go(Style); }
  },
  draw(t) {
    menuBackground(t);
    const K = A.kpad || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h, a = 1) => { if (!im) return; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); };
    const grey = im => im && tintImg(im, 'rgb(128,128,128)');
    const ti = { name: 0, weight: 1, password: 2, height: 3 }[this.mode];
    put(K.head, -84, -210, 430, 80); put(K.title && K.title[ti], -84, -205, 380, 30);
    put(K.tab && K.tab[0], 218, -207, 167.5, 80); put(K.word && K.word[0], 217, -205, 120, 30);
    put(K.field, 0, -126, 540, 72); put(K.label && K.label[ti], -181, -129, 172, 46);
    // the typed value, white in the game's font, before each unit
    const val = (s, u, al = 'right') => { if (!s) return; if (A.font) gtext(s, X(u), Y(-129), 42, '#fff', al, 2, 1); else text(s, X(u), Y(-129), 34, '#fff', al); };
    let curX;
    if (this.mode === 'height' && !this.metric) {
      put(K.ft, 106.5, -129, 64, 42); put(K.unit && K.unit[3], 220, -129, 64, 42);
      // (Dolphin: the feet digit just before 'ft', the inches straight after it)
      val(this.ft, 70); val(this.inch, 142, 'left');
      curX = this.ft === '' ? 50.5 : 142 + this.inch.length * 15;
    } else if (this.number()) {
      put(K.unit && K.unit[this.mode === 'weight' ? (this.metric ? 1 : 0) : 2], 220, -129, 64, 42);
      val(this.mode === 'weight' && !this.reveal ? '*'.repeat((this.val || '').length) : this.val, 182); curX = 186;     // (the Wii hides the weight: View info shows it)
    } else {
      const sv = this.mode === 'password' ? '*'.repeat((this.val || '').length) : this.val;      // (PASSWORD shown as '*': ASSUMED)
      if (sv) { if (A.font) gtext(sv, X(-61), Y(-129), 42, '#fff', 'left', 2, 1); else text(sv, X(-61), Y(-129), 34, '#fff', 'left'); }
      g.save(); g.font = '30px sans-serif'; curX = -61 + (this.val ? this.val.length * 15 : 0); g.restore();
    }
    if (((t * 2) | 0) % 2 === 0) put(K.bar, curX, -129, 4, 36);       // (the text cursor, blinking)
    put(K.board, 1, 41, 584, 252);
    // keys (the chosen one last, bigger, over the orange frame)
    let chosen = null;
    this.spots().forEach(([id, u, v]) => {
      const on = id === this.i, ok = this.enabled(id);
      if (typeof id === 'number') {
        const im = K.keys && K.keys[id];
        if (on) { chosen = () => { put(K.keySel, u, v, 75, 75); put(im, u, v, 76, 76); }; return; }
        put(ok ? im : grey(im), u, v, 53.2, 53.2);
      } else if (id === 'conf') {
        if (on) { put(K.confSel, u, v, 152.8, 107.2); put(K.conf, u, v, 145.6, 97.6); } else put(K.conf, u, v, 127.4, 85.4);
      } else {
        const im = K.side && K.side[id === 's0' ? (this.number() ? 3 : 0) : id === 's1' ? 1 : 2];
        if (on) { put(K.sideSel, u, v, 154.4, 61.6); put(im, u, v, 145.6, 52.8); } else put(ok ? im : grey(im), u, v, 127.4, 46.2);
      }
    });
    if (chosen) chosen();
    if (A.hints && A.hints[0]) {
      [0, 3, 4].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24));
      if (this.mode === 'weight') { if (A.hints[19]) g.drawImage(A.hints[19], 895, 677, 150, 24); if (A.hints[23]) g.drawImage(A.hints[23], 1050, 677, 150, 24); }
      else if (A.hints[19]) g.drawImage(A.hints[19], 1050, 677, 150, 24);
    }
    if (this.panel) this.drawPanel(t);
  },
  // the WEIGHT / IDEAL WEIGHT / BMI panel (fifo_ddr2_bmi.dff, 854 x 480 units): the screen dimmed (alpha 127); WEIGHT
  // /9/12/1/0/3 (-0.5, -151), IDEAL WEIGHT /2 (-0.5, -56), BMI /1 (-0.5, 97) with its line under it; the unit
  // /9/12/1/0/5 (0 kg, 1 lbs) at (197.5, -152 / -57); the values in comAF's 28-px numbers, the last at x 160.5,
  // 18 apart (y -154 / -59 / 38) - hidden as '*' until View info; EXIT / Unit / View info (comAF hints 1, 20, 23)
  // at (-35.5 / 70.5 / 176.5, 169). Not traced: what View info shows (here the weight, BMI = 703 lb / in^2 and an
  // ideal weight of BMI 22 - an assumption) and the line under the BMI (here the PC's own words).
  drawPanel(t) {
    const B = A.wkBmi || {}, Y2 = A.yesno || {}, U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h, a = 1) => { if (!im) return false; g.save(); g.globalAlpha *= a; g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); g.restore(); return true; };
    if (!put(Y2.dim, -0.5, 0, 1152, 640, 127 / 255)) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); }
    put(B.weight, -0.5, -151, 498, 80); put(B.ideal, -0.5, -56, 498, 80); put(B.bmi, -0.5, 97, 498, 196);
    const un = B.unit && B.unit[this.metric ? 0 : 1];      // (/9/12/1/0/5: 0 kg, 1 lbs - the recording, taken on lbs, drew 1)
    put(un, 197.5, -152, 64, 42); put(un, 197.5, -57, 64, 42);
    const lb = SAVE.weightLb || 0, hin = SAVE.heightIn || 0, bmi = hin ? 703 * lb / (hin * hin) : 0;
    const idealLb = hin ? 22 * hin * hin / 703 : 0;
    const wt = v => (this.metric ? v / 2.2046 : v).toFixed(1);
    const num = (str, v, n) => {
      const s2 = this.reveal ? str : '*'.repeat(n), P = A.num28, map = { '.': 21, '*': 25 };
      [...s2].forEach((ch, k) => { const im = P && P[ch >= '0' && ch <= '9' ? +ch : map[ch]]; put(im, 160.5 - 18 * (s2.length - 1 - k), v, 28, 28); });
    };
    num(wt(lb), -154, 5); num(hin ? wt(idealLb) : '', -59, 5); num(hin ? bmi.toFixed(1) : '', 38, 4);
    const line = !this.reveal ? '*** *** *** *** *** ***.' : !hin ? '' : bmi < 18.5 ? 'Below the normal range.' : bmi < 25 ? 'In the normal range.' : bmi < 30 ? 'Above the normal range.' : 'Well above the normal range.';
    if (line) { if (A.font) gtext(line, X(-228), Y(84), 27, '#fff', 'left', 3.6, 1); else text(line, X(-228), Y(84), 22, '#fff', 'left'); }
    [[1, -35.5], [20, 70.5], [23, 176.5]].forEach(([id, u]) => put(A.hints && A.hints[id], u, 169, 100, 16));
  },
  click() { this.input('START', true); },
};
// the workout log (older, plain list of days) - PC screen
const WorkoutLog = {
  bgm: 'MU_BGM_FREE',
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_WINDOWOUT'); go(WorkoutSet); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('WORKOUT LOG', 210, 44, 34, '#fff', 'center');
    const log = (SAVE.workoutLog || []).slice(-10).reverse();
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(240, 110, 800, 540);
    if (!log.length) text('No workouts yet.', 640, 380, 24, '#fff', 'center');
    log.forEach((w, k) => {
      const y = 150 + k * 48;
      text(w.date, 280, y, 20, '#bfe0ff', 'left', 'normal');
      text(w.songs + (w.songs === 1 ? ' song' : ' songs'), 600, y, 20, '#fff', 'left', 'normal');
      text(Math.round(w.secs / 60) + ' min', 790, y, 20, '#fff', 'right', 'normal');
      text(w.kcal.toFixed(1) + ' kcal', 1000, y, 22, '#ffe86a', 'right');
    });
    const all = (SAVE.workoutLog || []).reduce((a, w) => a + w.kcal, 0);
    text('TOTAL ' + all.toFixed(1) + ' kcal', 640, 625, 22, '#7dff9a', 'center');
  },
};
// the end of a workout
const WorkoutResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now(); this.w = WK; wkSessionEnd();
    if (WK && WK.songs) {
      SAVE.workoutLog = SAVE.workoutLog || [];
      SAVE.workoutLog.push({ date: new Date().toLocaleDateString(), kcal: WK.kcal, secs: WK.secs, songs: WK.songs });
      if (SAVE.workoutLog.length > 200) SAVE.workoutLog.shift();
      writeSave();
    }
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); WK = null; go(WorkoutSet); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const w = this.w || { kcal: 0, secs: 0, songs: 0, target: 'none' };
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(290, 130, 700, 440); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(290, 130, 700, 440);
    text('WORKOUT RESULTS', 640, 185, 36, '#ffe86a', 'center');
    if (w.target !== 'none') text(w.done ? 'TARGET REACHED!' : 'Target: ' + (w.target === 'time' ? Math.round(w.goal / 60) + ' min' : w.goal + ' kcal'), 640, 235, 24, w.done ? '#7dff9a' : '#fff', 'center');
    text(w.kcal.toFixed(1), 640, 330, 90, '#fff', 'center'); text('kcal burned', 640, 400, 24, '#ffd23c', 'center');
    text(Math.floor(w.secs / 60) + ' min ' + Math.round(w.secs % 60) + ' s  -  ' + w.songs + (w.songs === 1 ? ' song' : ' songs'), 640, 470, 22, '#fff', 'center');
    text('(from your weight, ' + weightLb() + ' lbs)', 640, 520, 16, '#bfe0ff', 'center', 'normal');
    text('Enter: back to the WORKOUT MENU', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the calorie counter while you dance, and the workout's progress on the song select
function workoutBar(kcal, secs) {
  const w = WK; if (!w) return;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - 170, 6, 340, 34);
  let msg = kcal.toFixed(1) + ' kcal   ' + Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0');
  if (w.target === 'kcal') msg += '   / ' + w.goal + ' kcal'; else if (w.target === 'time') msg += '   / ' + Math.round(w.goal / 60) + ' min';
  text(msg, W / 2, 23, 18, '#ffe86a', 'center');
}
// DDR II WORKOUT's play time (fifo_ddr2_wkplay.dff, 854 x 480 units round the middle): METER_FM /0/3 (148 x 36) at
// 0.9, centred (-0.5, 188.2) under the video; the time HH:MM:SS in comAF's 28-px numbers (':' = 20) at 0.63,
// 11.35 apart from x -41.2. Seen with MENU = NO SETTINGS; with a time or calorie goal it may show something
// else (not traced).
function wkTimer(secs) {
  const U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U, im = A.img.wkTimer;
  if (im) g.drawImage(im, X(-0.5) - 66.6 * U, Y(188.2) - 16.2 * U, 133.2 * U, 32.4 * U);
  const t = Math.floor(secs), str = [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map(n => String(n).padStart(2, '0')).join(':');
  const P = A.num28, sz = 17.6 * U;
  [...str].forEach((ch, k) => { const d = P && P[ch === ':' ? 20 : +ch]; if (d) g.drawImage(d, X(-41.2 + 11.35 * k) - sz / 2, Y(188.2) - sz / 2, sz, sz); else text(ch, X(-41.2 + 11.35 * k), Y(188.2), 18, '#fff', 'center'); });
}
// ---- TRAINING MODE (HP2 / HP3 / DDR II): after picking a song, its settings: SPEED (the music and
// arrows slowed down or sped up), SECTION (from measure A to measure B), REPEAT (the section starts
// again by itself until you press Esc) and ASSIST TICK (a click on every step). You can't fail.
const TRAIN = { speed: 100, from: 1, to: 0, repeat: true, tick: true };   // to 0 = the end of the song
// TRAINING MODE's settings screen
const TrainSet = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  enter() { this.leaving = null; if (this.pv) this.pv.cur = TRAIN.from - 1; },
  with(next, measures) { this.next = next; this.pv = null; this.measures = Math.max(1, measures); if (TRAIN.to > this.measures || TRAIN.to < TRAIN.from) TRAIN.to = 0; if (TRAIN.from > this.measures) TRAIN.from = 1; return this; },
  rows: ['SPEED', 'FROM MEASURE', 'TO MEASURE', 'REPEAT', 'ASSIST TICK', 'START'],
  // HP4 (TRAINING MENU, main.dol 0x800e6864): START BAR, END BAR, PLAY, OPTIONS; Up / Down wrap round.
  // START BAR is a measure index 0..N-1 (shown + 1), END BAR 1..N (N = the song's end marker in measures);
  // raising START past END pushes END to START + 1, lowering END below it pushes START to END - 1; a step
  // past the ends plays sound 0xf5 instead of 0xf0. PLAY starts (scene 8), OPTIONS opens the options
  // (scene 0x1d, MUSIC SPEED / METRONOME / SONG there), B goes back to the song select.
  get rowsNow() { return HP4 ? (TRAIN.view ? ['FROM MEASURE', 'TO MEASURE', 'START'] : ['FROM MEASURE', 'TO MEASURE', 'START', 'OPTIONS']) : ['FROM MEASURE', 'TO MEASURE', 'OPTIONS', 'START']; },   // (DDR II: OPTIONS above PLAY - Wii)
  // HP4's menu shows the chart itself on the left (0x800e77d8): the play field at its play place, scrolled
  // to START BAR. The shown measure (+0x4e8) eases to it every frame by dt x (4 x the distance + 2.4)
  // measures, never past it; leaving the menu slides the field out to the left (x -> -427 of 854 in 0.05
  // steps a frame). Here: the whole chart as a player built for the preview.
  previewPlayer() {
    const A2 = this.args;
    if (!A2) return null;
    if (this.pv && this.pv.args === A2) return this.pv.p;
    const keep = [TRAIN.from, TRAIN.to];
    TRAIN.from = 1; TRAIN.to = 0; Play.marks = A2.marks;
    let p = null, lay = null;
    try { const pl = Play.with(A2.song, A2.charts.map(c => Object.assign({}, c)), A2.music, A2.dance); pl.stage = A2.stage; p = pl.ps[0]; lay = pl.layout()[0]; } catch (e) { console.error('training preview', e); }
    [TRAIN.from, TRAIN.to] = keep;
    this.pv = { args: A2, p, lay, cur: TRAIN.from - 1, last: performance.now() };
    return p;
  },
  // DANCE VIEW MENU: the song's dancers (from the disc, as in play) dancing START BAR to END BAR over and over,
  // drawn as black shapes on the left (0x800e83e8 runs them each frame, their shine off while it does)
  drawDancers(t) {
    const A2 = this.args;
    if (!A2 || !A2.dance || !window.Dancer3D || S.dancer === false) return;
    const D = this.dv || (this.dv = {});
    if (D.args !== A2) { D.args = A2; D.t0 = performance.now(); try { D.ch = Dancer3D.prepare(A2.dance, A2.song.slot); } catch (e) { D.ch = null; } }
    if (!D.ch) return;
    const tm = A2.charts[0] && A2.charts[0].built && A2.charts[0].built.timing;
    if (!tm) return;
    const to = TRAIN.to || this.measures, a = timeAtOff(tm, (TRAIN.from - 1) * 4096), b = Math.max(a + 0.5, timeAtOff(tm, to * 4096));
    const secs = a + ((performance.now() - D.t0) / 1000) % (b - a), beat = tm.offAt(secs) / 1024;
    // the three dancers in black, as on the Wii (Dolphin DANCE VIEW MENU frames): the lead in front and the two
    // backups (CHR74 / CHR75 - the play's dancer list) either side, a little smaller and higher, standing further
    // back; no dance mats under them here. (Their exact place / size isn't traced - measured from the footage:
    // backups 85 layout units either side of the lead, 0.9 of its height, feet 10% of it higher.)
    const lead = (Dancer3D.customFor || '').replace(/\?acc=\d+/, '');
    const want = lead ? [lead, ...hp4Backups(A2.song.slot).map(b => '/api/ddr2char/' + b)] : null;
    if (want && scene === this && !this.leaving && Dancer3D.extrasFor !== want.join('|') && !D.loading) { D.loading = true; Dancer3D.useExtras(want).finally(() => { D.loading = false; }); }
    const set = want && Dancer3D.extrasFor === want.join('|') && Dancer3D.extras.length === 3 ? Dancer3D.extras : null;
    const sil = (custom, slot) => {
      const keep = Dancer3D.custom;
      if (custom) Dancer3D.custom = custom;
      let cv = null;
      try { cv = Dancer3D.render(D.ch, beat, 1e6, {}); } catch (e) { console.error('dance view', e); } finally { Dancer3D.custom = keep; }
      if (!cv) return null;
      const ks = D.ks || (D.ks = []), k = ks[slot] || (ks[slot] = document.createElement('canvas'));
      if (k.width !== cv.width || k.height !== cv.height) { k.width = cv.width; k.height = cv.height; }
      const x = k.getContext('2d');
      x.globalCompositeOperation = 'copy'; x.drawImage(cv, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = '#000'; x.fillRect(0, 0, k.width, k.height);
      x.globalCompositeOperation = 'source-over';
      return k;
    };
    const h = H * 0.62, cx = WX(175), top = WY(118);
    if (set) [[1, -1], [2, 1]].forEach(([i, side]) => {
      const k = sil(set[i].custom, i);
      if (!k) return;
      const hb = h * 0.9, wb = hb * k.width / k.height, feet = top + h - h * 0.1;
      g.drawImage(k, WX(175 + side * 85) - wb / 2, feet - hb, wb, hb);
    });
    // (wait for all three before drawing, so it doesn't show one dancer and then three - up to 3 s)
    if (want && !set && performance.now() - D.t0 < 3000) return;
    const k = sil(set ? set[0].custom : null, 0);
    if (!k) { D.ch = D.ch || null; return; }
    const w = h * k.width / k.height;
    g.drawImage(k, cx - w / 2, top, w, h);
  },
  drawPreview(t) {
    const p = this.previewPlayer(), P = this.pv;
    if (!p || !P.lay) return;
    const now = performance.now(), dt = Math.min(0.1, (now - P.last) / 1000); P.last = now;
    const target = TRAIN.from - 1;
    let step = dt * 4 * (target - P.cur);
    if (step > 0) step = Math.min(step + 2.4 * dt, target - P.cur);
    else if (step < 0) step = Math.max(step - 2.4 * dt, target - P.cur);
    P.cur += step;
    const out = this.leaving ? Math.min(1, (now - this.leaving.at) / 1000 * 60 * 0.05) : 0;
    const tm = p.timing || (this.args.charts[0].built && this.args.charts[0].built.timing);
    const time = tm ? timeAtOff(tm, P.cur * 4096) : 0;
    g.save(); g.translate(-640 * out, 0);
    try { p.draw(time, P.lay.x0, P.lay.lw, 156, () => false, null); } catch (e) { console.error('preview draw', e); this.pv.lay = null; }
    g.restore();
  },
  // leaving the menu: the field slides out first (state 3 -> 4, 20 frames), then the next screen
  leave(next) { this.leaving = { at: performance.now(), next }; },
  // the play made again with the settings as they are now (Play.with reads TRAIN when it sets up the section)
  fresh() {
    const A2 = this.args;
    // (DDR II's TRAINING plays the section once at normal speed, then RESULTS - Wii; its own assist is in OPTIONS)
    if (!HP4) { TRAIN.repeat = false; TRAIN.speed = 100; }
    if (!A2) return this.next;
    Play.marks = A2.marks;
    const pl = Play.with(A2.song, A2.charts.map(c => Object.assign({}, c)), A2.music, A2.dance);
    pl.stage = A2.stage; this.next = pl;
    return pl;
  },
  hp4Input(a) {
    if (this.leaving) return;
    const rows = this.rowsNow, r = rows[this.i], N = this.measures;
    if (TRAIN.to === 0 || TRAIN.to > N) TRAIN.to = N;
    if (a === 'P1U' || a === 'P1D') { this.i = (this.i + (a === 'P1D' ? 1 : rows.length - 1)) % rows.length; sfx('SE_SYS_SELECT01'); return; }
    const d = a === 'P1R' ? 1 : a === 'P1L' ? -1 : 0;
    if (d && (r === 'FROM MEASURE' || r === 'TO MEASURE')) {
      let st = TRAIN.from - 1, en = TRAIN.to, hit = false;
      if (r === 'FROM MEASURE') { st += d; if (st < 0) { st = 0; hit = true; } if (st > N - 1) { st = N - 1; hit = true; } if (en <= st) en = st + 1; }
      else { en += d; if (en < 1) { en = 1; hit = true; } if (en > N) { en = N; hit = true; } if (en <= st) st = en - 1; }
      TRAIN.from = st + 1; TRAIN.to = en; sfx(hit ? 'SE_SYS_ERROR' : 'SE_SYS_SELECT02'); return;
    }
    if (a === 'START' && r === 'START') { sfx('SE_SYS_DECIDE01'); this.leave(() => go(this.fresh())); }
    else if (a === 'START' && r === 'OPTIONS') { sfx('SE_SYS_DECIDE01'); this.leave(() => { Options.keep = false; Options.from = TrainSet; go(Options); }); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.leave(() => go(Select)); }
  },
  input(a, p) {
    if (!p) return;
    return this.hp4Input(a);          // (DDR II's TRAINING MENU works as HP4's: START BAR / END BAR / OPTIONS / PLAY)
  },
  click() { this.input('START', true); },
  // HP4's TRAINING MENU (select_bin group 8): block 48 - "TRAINING MENU" (174, 35) on its title window, the
  // song's panel (475, 97) with its name (475, 83.5) and difficulty (475, 125.8), the rows' places at x 476:
  // START BAR 210, END BAR 289, then PLAY 348 and OPTIONS 389; block 49 a bar row (START BAR / END BAR with
  // the measure number at (22, 14.5) and arrows at +-100), block 50 a button (PLAY / OPTIONS). The game keeps
  // speed and the rest under OPTIONS: here they're the rows under it.
  drawHp4(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.diffs, H4.panel, H4.title, H4.titleWin, H4.bars, H4.barSel, H4.btns, H4.btnSel] = await Promise.all(
        ['/8/0/0/0', '/8/0/0/1', '/8/0/0/3', '/8/0/0/4', '/8/1/0/0', '/8/1/0/2', '/8/2/0/0', '/8/2/0/1'].map(one));
      H4.ok = true;
    })();
    if (!H4.ok) return false;
    menuBackground(t);
    if (TRAIN.view) this.drawDancers(t); else this.drawPreview(t);   // (the chart, or DANCE VIEW's dancers, under the windows)
    const song = this.next && this.next.song, ch = this.next && this.next.ps && this.next.ps[0];
    wspr(H4.titleWin[0], 174, 65, 233.5, 82, 1, 1, 217 / 255); wspr(H4.title[TRAIN.view ? 1 : 0] || H4.title[0], 174, 35, 150, 25);
    wspr(H4.panel[0], 475, 97, 136, 58, 0.9, 0.9);
    if (song) {
      const ti = texture('title', song.title);
      if (ti.img) { const w = Math.min(330, ti.img.width * 1.2), h = ti.img.height * w / ti.img.width; g.drawImage(ti.img, WX(475) - w / 2, WY(83.5) - h / 2, w, h); }
      else text(song.name.slice(0, 24), WX(475), WY(83.5), 22, '#fff', 'center');
    }
    const di = ch ? [4, 1, 2, 3].indexOf(ch.diff) : -1;
    if (di >= 0) wspr(H4.diffs[di], 475, 125.8, 60, 11);
    const rowsY = { 'FROM MEASURE': 210, 'TO MEASURE': 289, START: 348, OPTIONS: 389 };
    if (!TRAIN.to || TRAIN.to > this.measures) TRAIN.to = this.measures;
    if (this.leaving && performance.now() - this.leaving.at > 1000 / 3) { const nx = this.leaving.next; this.leaving = null; nx(); return true; }
    this.rowsNow.forEach((r, i) => {
      const on = i === this.i;
      if (r === 'FROM MEASURE' || r === 'TO MEASURE') {
        // (shown: START BAR + 1 and END BAR + 1, 0x800eebc4 with +0x4d0 + 1 / +0x4d4 + 1)
        const y = rowsY[r], v = r === 'FROM MEASURE' ? String(TRAIN.from) : String((TRAIN.to || this.measures) + 1);
        if (on) wspr(H4.barSel[0], 476, y, 135, 54, 0.75, 0.75);
        wspr(H4.bars[r === 'FROM MEASURE' ? 0 : 1], 476, y, 124, 42);
        text(v, WX(476 + 22), WY(y + 14.5), 30, '#fff', 'center');
        if (on) { text('\u25c0', WX(476 - 100), WY(y + 15), 26, '#ff3ca0', 'center'); text('\u25b6', WX(476 + 100), WY(y + 15), 26, '#ff3ca0', 'center'); }
      } else {                                       // PLAY (block 50 cell 0) / OPTIONS (cell 1)
        const y = rowsY[r];
        if (on) wspr(H4.btnSel[0], 476, y + 1, 140, 35, 0.75, 0.75);
        wspr(H4.btns[r === 'START' ? 0 : 1], 476, y + 1, 124, 28);
      }
    });
    keyHints('Up/Down: choose    Left/Right: change    Enter: start    Esc: back');
    return true;
  },
  // ---- DDR II's TRAINING MENU (fifo_ddr2_train.dff matched by texture bytes; 640 x 480 layout): header selMusic
  // /0/7/0/1 (125.3, 30) + "TRAINING MENU" /8/0/0/3 (125.3, 35); the song panel /8/0/0/1 at 0.9 (526.7, 101) with
  // the title (526.7, 80.5), the SHORT SONG band /8/0/0/5 (526.2, 118.3) and the difficulty /8/0/0/0 (526.7,
  // 138.3); START BAR (528, 210) / END BAR (528, 289) = /8/1/0/0 pictures 0 / 1, the chosen one in /8/1/0/2 -
  // the bar number in comAF's 28-px numbers, the last at +22, 18 apart, 14.5 down, leading zeros grey half
  // alpha; selMusic's arrow /0/5/0/0 at 0.6 either side (x -103 / +103, y +15), grey (100) at a limit; OPTIONS
  // (528, 349) / PLAY (528, 390) = /8/2/0/0 pictures 1 / 0, the chosen one in /8/2/0/1. On the left the chart
  // at its play place (step zone y 120, lanes from x 112) with the bar markers, dimmed while the cursor is on
  // OPTIONS / PLAY (seen on the Wii). The band's second picture is taken as FULL SONG (not seen).
  drawD2(t) {
    const H4 = this.d2 || (this.d2 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = (f, p) => A.tplOf(f, p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.diffs, H4.panel, H4.title, H4.band, H4.bars, H4.barSel, H4.btns, H4.btnSel, H4.head, H4.arrow] = await Promise.all(
        [['sel', '/8/0/0/0'], ['sel', '/8/0/0/1'], ['sel', '/8/0/0/3'], ['sel', '/8/0/0/5'], ['sel', '/8/1/0/0'], ['sel', '/8/1/0/2'], ['sel', '/8/2/0/0'], ['sel', '/8/2/0/1'], ['mus', '/0/7/0/1'], ['mus', '/0/5/0/0']].map(([f, p]) => one(f, p)));
      H4.ok = true;
    })();
    if (!H4.ok) return false;
    menuBackground(t);
    const rows = this.rowsNow, onBar = rows[this.i] === 'FROM MEASURE' || rows[this.i] === 'TO MEASURE';
    const N0 = this.measures;
    // the chart on the left (dimmed off the bar rows)
    const p = this.previewPlayer(), P = this.pv;
    if (p && P && P.lay) {
      const now = performance.now(), dt = Math.min(0.1, (now - P.last) / 1000); P.last = now;
      const target = TRAIN.from - 1; let step = dt * 4 * (target - P.cur);
      if (step > 0) step = Math.min(step + 2.4 * dt, target - P.cur); else if (step < 0) step = Math.max(step - 2.4 * dt, target - P.cur);
      P.cur += step;
      const tm = p.timing || (this.args.charts[0].built && this.args.charts[0].built.timing), time = tm ? timeAtOff(tm, P.cur * 4096) : 0;
      g.save(); if (!onBar) g.filter = 'brightness(0.55)';
      Play.noBoard = true;                       // (the Wii's preview has no lane board - only the step zone and the arrows)
      try { p.draw(time, 112 * 1.5, 64 * 1.5, 120 * 1.5, () => false, null); } catch (e) { console.error('preview draw', e); this.pv.lay = null; }
      Play.noBoard = false;
      // the bar markers (SSQ_CMN /0/0 picture 13, 334 x 36 drawn 32 high) centred x 275.2, the bar's line at the
      // step zone's top (y 88) one measure (256) apart, the bar number on its pill (x ~400, measured on the Wii)
      if (A.barMark) for (let k = Math.floor(P.cur); k < Math.floor(P.cur) + 3; k++) {
        const y = 88 + 256 * (k - P.cur);
        if (y < -40 || y > 520 || k < 0 || k >= N0) continue;
        g.drawImage(A.barMark, (275.2 - 167) * 1.5, (y - 16) * 1.5, 334 * 1.5, 32 * 1.5);      // (the play field's space: x 1.5)
        const str = String(k + 1).padStart(3, '0'), D = A.num28, sz = 15 * 1.5;
        [...str].forEach((c2, j) => { const im = D && D[+c2]; if (im) g.drawImage(im, (400 + (j - 1) * 10) * 1.5 - sz / 2, y * 1.5 - sz / 2, sz, sz); });
      }
      g.restore();
    }
    wspr(H4.head[0], 125.3, 30, 215, 40); wspr(H4.title[0], 125.3, 35, 150, 25);
    const song = this.next && this.next.song, ch = this.next && this.next.ps && this.next.ps[0];
    wspr(H4.panel[0], 526.7, 101, 136, 65, 0.9, 0.9);
    if (song) {
      const ti = texture('title', song.title);
      if (ti.img) { const w = Math.min(232 * 0.9 * 1.5, ti.img.width * 1.2), h = ti.img.height * w / ti.img.width; g.drawImage(ti.img, WX(526.7) - w / 2, WY(80.5) - h / 2, w, h); }
      else text(song.name.slice(0, 24), WX(526.7), WY(80.5), 22, '#fff', 'center');
    }
    wspr(H4.band[S.short === false ? 1 : 0] || H4.band[0], 526.2, 118.3, 136, 15);
    const di = ch ? [4, 1, 2, 3].indexOf(ch.diff) : -1;
    if (di >= 0) wspr(H4.diffs[di], 526.7, 138.3, 60, 11);
    const N = this.measures;
    if (!TRAIN.to || TRAIN.to > N) TRAIN.to = N;
    if (this.leaving && performance.now() - this.leaving.at > 1000 / 3) { const nx = this.leaving.next; this.leaving = null; nx(); return true; }
    const Y = { 'FROM MEASURE': 210, 'TO MEASURE': 289, OPTIONS: 349, START: 390 };
    rows.forEach((r, i) => {
      const on = i === this.i, y = Y[r];
      if (r === 'FROM MEASURE' || r === 'TO MEASURE') {
        if (on) wspr(H4.barSel[0], 528, y, 135, 54);
        wspr(H4.bars[r === 'FROM MEASURE' ? 0 : 1], 528, y, 124, 42);
        const v = r === 'FROM MEASURE' ? TRAIN.from : TRAIN.to, str = String(v).padStart(3, '0'), lead = 3 - String(v).length, P2 = A.num28;
        [...str].forEach((c2, k) => { const im = P2 && P2[+c2]; if (!im) return; g.save(); if (k < lead) g.globalAlpha = 0.5; const sz = 28 * 1.5, x = WX(550 - 18 * (2 - k)); g.drawImage(k < lead ? tintImg(im, 'rgb(128,128,128)') : im, x - sz / 2, WY(y + 14.5) - sz / 2, sz, sz); g.restore(); });
        const lo = r === 'FROM MEASURE' ? TRAIN.from <= 1 : TRAIN.to <= TRAIN.from, hi = r === 'FROM MEASURE' ? TRAIN.from >= N : TRAIN.to >= N;
        const ar = H4.arrow[0];
        if (ar) [[-103, lo, -1], [103, hi, 1]].forEach(([dx, dim, sx]) => { const im = dim ? tintImg(ar, 'rgb(100,100,100)') : ar; g.save(); g.translate(WX(528 + dx), WY(y + 15)); g.scale(sx * 0.6 * 1.5, 0.6 * 1.5); g.drawImage(im, -35, -35); g.restore(); });
      } else {
        if (on) wspr(H4.btnSel[0], 528, y, 140, 35);
        wspr(H4.btns[r === 'START' ? 0 : 1], 528, y, 124, 28);
      }
    });
    if (A.hints && A.hints[0]) { [0, 3, 4].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24)); if (A.hints[32]) g.drawImage(A.hints[32], 1050, 677, 150, 24); }
    return true;
  },
  draw(t) {
    if (!HP4) { if (this.drawD2(t)) return; this.at = performance.now(); menuBackground(t); return; }
    if (HP4) { if (this.drawHp4(t)) return; this.at = performance.now(); menuBackground(t); return; }   // (first visit: just the background while the disc's pictures load, not DDR II's screen for a moment)
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('TRAINING', 210, 44, 34, '#fff', 'center');
    const v = { SPEED: TRAIN.speed + '%', 'FROM MEASURE': String(TRAIN.from), 'TO MEASURE': TRAIN.to ? String(TRAIN.to) : 'END (' + this.measures + ')',
      REPEAT: TRAIN.repeat ? 'ON' : 'OFF', 'ASSIST TICK': TRAIN.tick ? 'ON' : 'OFF', START: '' };
    this.rows.forEach((r, i) => {
      const on = i === this.i, y = 130 + i * 82, x = 300, w = 680;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : r === 'START' ? 'rgba(20,130,80,0.9)' : 'rgba(20,60,140,0.85)';
      g.fillRect(x, y, w, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, 64);
      text(r, x + 30, y + 32, 24, '#fff', 'left');
      if (v[r]) text((on ? '◀  ' : '') + v[r] + (on ? '  ▶' : ''), x + w - 24, y + 32, 22, '#ffe86a', 'right');
    });
    text('Up/Down: choose   Left/Right: change   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// seconds where a chart position (1024 units a beat) is reached: offAt run backwards
function timeAtOff(tm, off) {
  let lo = -10, hi = 2000;
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (tm.offAt(mid) < off) lo = mid; else hi = mid; }
  return hi;
}
// ASSIST TICK: one short click at an exact audio time
function trainTick(ctx, when) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.frequency.value = 1760; gn.gain.setValueAtTime(0.0001, when); gn.gain.exponentialRampToValueAtTime(0.25, when + 0.002); gn.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(gn).connect(ctx.destination); o.start(when); o.stop(when + 0.06);
  return o;
}
// ---- GROOVE CIRCUIT (Hottest Party) and GROOVE ARENA (Hottest Party 2): the story modes. Venues full of
// the crowd's dance requests, ending in battles. The requests' wording comes from each disc (HP1:
// mess/messdata_eng.bin, HP2: text/text_eng.bin) and the rules are read from that wording: how many
// songs, which difficulty, the grade, combo, score, gauge, GREAT/PERFECT or 'Boo' limit.
// Hottest Party: the request table in sys/main.dol gives each request's songs and limits (hp.py gc_table);
// GC_SONGS1 / GC_POOL2 below are only used if that table can't be read. Venues open like the game.
const GC_VENUES = ['INCEPTION', 'GENESIS', 'TECTONIC', 'HALLUMINATION', 'ERU', 'SYSTRONIX', 'STARGAZE', 'U-MATIC', 'EV'];
// round 1: [designated songs, Venue Master's song] per venue (slot numbers of Hottest Party's songs)
const GC_SONGS1 = [[['L']], [[1039], [1035]], [[1045], [1028]], [[1041], [1038]], [[1043, 1036], [1027]],
  [[1047, 1048], [1030]], [[1044, 1040], [1037]], [[1042, 1034], [1033]], [[1029, 1032, 1031], [1046]]];
// Hottest Party 2's GROOVE ARENA: its song pool, and each round's master song
const GC_POOL2 = [1007, 1024, 1014, 1012, 1023, 1018, 1015, 1006, 1003, 1009, 1005, 1021, 1004, 1000, 1001, 1002, 1008,
  1010, 1011, 1013, 1016, 1017, 1019, 1020, 1022, 1025, 1012, 1014, 1024, 1007, 1023, 1018, 1015];
const GC_MASTER2 = [null, 1035, 1028, 1038, 1027, 1030, 1037, 1033, 1049];
// what clearing each venue of GROOVE CIRCUIT unlocks (the game's wording, shown after the result)
const GC_REWARDS1 = [
  ['Song "Lesson by DJ", stage DDR; venues GENESIS, TECTONIC, HALLUMINATION and ERU open'],
  ['Stages Oscillator and Cyberium', 'Song "Heavens and the Earth", stage Ampliture', 'Song "little steps", stage Illuminix, new gear for Harmony'],
  ['Stages Ion and Red Modus', 'Song "THE REASON", stage Substance', 'Song "BRE∀K DOWN! (World Version)", stage Blue Modus, new gear for Root'],
  ['Stages Lost Future and Delight', 'Song "Here I Go Again", stage Essential', 'Song "We Will Live Together", stage Dream Cell, new gear for Gaku'],
  ['Stages Sakura and Safety', 'Songs "Beautiful Inside" and "Touchin\'", stage Momiji', 'Song "LOVE SHINE", stage Culture, new gear for Rena'],
  ['Stages Sensor and Metrio', 'Songs "Such A Feeling" and "Hold Tight", stage IntroVex', 'Song "CANDY (UFO mix)", stage Scope, new gear for Domi'],
  ['Stages Reversion and Libre', 'Songs "Mess With My Emotions" and "Moving On", stage Retroversion', 'Song "I\'m Flying Away", stage Conceptia, new gear for Danca'],
  ['Stages 7th Key and Emergence', 'Songs "the beat" and "will", stage Lens', 'Song "let it out", stage Deviate, new gear for Chordia'],
  ['Stages Propel and Air', 'Songs "1998", "Confession" and "B4U", stage Sunshine', 'Song "SUPER SAMURAI", stage Moon, new gear for U.G., backup dancers'],
];
// Hottest Party 2's arenas: 11 per round. Which request is in which arena, its songs, courses, limits and
// opponents all come from the game's own tables in sys/main.dol (hp2.py ga_rounds / ga_courses); the names
// are the arena name plates in select/select_bin.bin, in the same order.
const GA_NAMES = ['INCEPTION ARENA', 'GET-A-GO-GO', 'ARENA SHIFT', 'FUNKTION JUNCTION', 'GROOVE BY GROOVE', 'WONDERLAND', 'DANCETERIA',
  'PINNACLE', 'EXPOSURE', 'OVER-EXPOSURE 1', 'OVER-EXPOSURE 2'];
let GCD = null;            // HP1's request texts { round1: [25], round2: [25], lesson, lessonSong }
let GAD = null;            // HP2's { requests: [58], unlocks: [song names] }
let GC = null;             // the request being played { cfg, round, v, r, req, i, results: [], diff, share, vname }
function gcRank(diff) { return [4, 1, 2, 3].indexOf(diff); }      // BEGINNER 0, BASIC 1, DIFFICULT 2, EXPERT 3
// read a request's wording into a rule: { n songs, lowest difficulty, grade, Boo limit, combo, score, gauge ... }
function gcParse(t) {
  const num = re => { const m = re.exec(t); return m ? +m[1].replace(/,/g, '') : null; };
  const n = num(/Clear (\d+)/), g = /(?:an? (AA|A|B|C) score|grade of (AA|A|B|C) or higher)/.exec(t);
  const course = /course/.test(t);
  const q = {
    text: t, master: /Venue Master|Beat (1 dancer|the dance group)/.test(t), group: /dance group/.test(t),
    designated: /designated/.test(t), course, n: course ? 3 : n || 1,
    minDiff: /expert/i.test(t) ? 3 : /difficult/i.test(t) ? 2 : /basic/i.test(t) ? 1 : 0,
    grade: g ? g[1] || g[2] : null, boo: num(/(\d+) or fewer '?Boo/), combo: num(/over (\d+) Combos/),
    score: num(/over ([\d,]+) (?:points|scores)/), gauge: num(/(\d+)% (?:or better )?on (?:the )?dance gauge/),
    great: num(/over (\d+) GREAT/), perfect: num(/over (\d+) PERFECT/),
  };
  if (q.boo === null && /any 'Boo'/.test(t)) q.boo = 0;
  if (q.master && !course) q.n = 1;
  return q;
}
// ---- the two modes' rules
const GC_HP1 = {
  game: 'hp', disc: 'hp', key: 'gc', title: 'GROOVE CIRCUIT', master: 'VENUE MASTER',
  ready() { return GCD && !GCD.missing; },
  async load() { if (!GCD) { try { GCD = await api('/api/hp1gc'); } catch (e) { GCD = null; } if (!GCD) GCD = { missing: true }; } return GCD.lessonSong || null; },
  save() { SAVE.gc = SAVE.gc || { round: 1, done: {}, rounds: 0 }; return SAVE.gc; },
  rounds() { return [this.save().round]; },
  names(round) { return GC_VENUES; },
  requests(round, v) {
    const T = GCD && GCD['round' + round]; if (!T) return [];
    const texts = v === 0 ? [T[0]] : T.slice(1 + 3 * (v - 1), 4 + 3 * (v - 1));
    let pool = 0;                                           // round 2: designated songs dealt out in venue order
    if (round === 2) for (let u = 0; u < v; u++) {
      const tt = u === 0 ? [T[0]] : T.slice(1 + 3 * (u - 1), 4 + 3 * (u - 1));
      tt.forEach(x => { const q = gcParse(x); if (q.designated && !q.master) pool += q.n; });
    }
    const tab = GCD.table && GCD.table[round - 1] && GCD.table[round - 1][v];
    if (tab && tab.length === texts.length) {               // the game's own table (main.dol): exact rules and songs
      return texts.map((t, r) => {
        const e = tab[r], q = gcParse(t);
        Object.assign(q, { minDiff: e.diff, master: !!e.master, designated: !!e.songs, n: e.n,
          score: e.score || null, boo: e.boo === null || e.boo === undefined ? null : e.boo, combo: e.combo || null, grade: e.grade || null,
          songs: e.songs ? e.songs.map(x => 1000 + x) : null });
        q.reward = round === 1 ? (GC_REWARDS1[v] || [])[r] : null;
        return q;
      });
    }
    return texts.map((t, r) => {
      const q = gcParse(t);
      if (round === 1) {
        const S1 = GC_SONGS1[v];
        q.songs = q.master ? S1[1] : q.designated ? S1[0] : null;
        if (q.songs) q.songs = q.songs.map(x => x === 'L' ? (GCD.lesson || 1039) : x);
      } else q.songs = q.master ? [GC_MASTER2[v]] : q.designated ? GC_POOL2.slice(pool, pool + q.n) : null;
      q.reward = round === 1 ? (GC_REWARDS1[v] || [])[r] : null;
      return q;
    });
  },
  open(round, v) {
    if (v === 0) return true;
    const n = GC_VENUES.filter((x, u) => u < 8 && gcVenueCleared(this, round, u)).length;
    if (v <= 4) return gcVenueCleared(this, round, 0);
    if (v <= 7) return n >= 4;
    return n >= 8;                                          // EV: every other venue
  },
  hidden(round, v) { return v === 8 && !this.open(round, v); },
  lockedWhy(round, v) { return v <= 4 ? 'Clear INCEPTION to open this venue.' : v <= 7 ? 'Clear four venues to open this one.' : ''; },
  share(round, v, q) { return round === 1 ? 0.55 + 0.04 * v : 0.76 + 0.025 * v; },
  // a request cleared for the first time: the whole circuit done? -> the next round
  cleared(c) {
    const sv = this.save();
    if (c.v === 8 && gcVenueCleared(this, c.round, 8)) {
      sv.rounds = (sv.rounds || 0) + 1;
      if (sv.round === 1) sv.round = 2; else { sv.round = 1; sv.done = {}; }   // round 2 done: the circuit starts over
      return c.round === 1 ? 'GROOVE CIRCUIT CLEARED!  Round 2 begins: harder requests.' : 'GROOVE CIRCUIT CLEARED AGAIN!  The circuit starts over.';
    }
    return null;
  },
  status() { const sv = this.save(); return 'ROUND ' + sv.round + (sv.rounds ? '   (circuit cleared ' + sv.rounds + 'x)' : ''); },
};
// GROOVE ARENA (Hottest Party 2): the same set of functions as GC_HP1 above
const GC_HP2 = {
  game: 'hp2', disc: 'hp2', key: 'ga', title: 'GROOVE ARENA', master: 'DANCE BATTLE',
  ready() { return GAD && !GAD.missing && GAD.rounds; },
  async load() {
    if (!GAD) { try { GAD = await api('/api/hp2ga'); } catch (e) { GAD = null; } if (!GAD) GAD = { missing: true }; }
    return null;
  },
  save() { SAVE.ga = SAVE.ga || { done: {}, round2: false, rounds: 0 }; if (SAVE.ga.v !== 2) { SAVE.ga = { done: {}, round2: false, rounds: 0, v: 2 }; } return SAVE.ga; },
  rounds() { return this.save().round2 ? [1, 2] : [1]; },
  names(round) { return GA_NAMES; },
  // a course by its number: its songs come from the game's course table (main.dol)
  course(id) { return ((GAD.courses || [])[id] || []).map(x => 2000 + x); },
  courseName(id) { return 'COURSE ' + (id + 1); },
  requests(round, v) {
    const A = GAD && GAD.rounds && GAD.rounds[round - 1] && GAD.rounds[round - 1][v]; if (!A) return [];
    return A.map(r => {
      const q = { text: r.text, minDiff: r.diff, grade: r.grade || null, boo: r.boo !== undefined ? r.boo : null, combo: r.combo || null,
        score: r.score || null, gauge: r.gauge || null, great: r.great || null, perfect: r.perfect || null,
        master: r.kind === 5 || r.kind === 6, course: r.kind === 2 || r.kind === 4 || r.kind === 6, designated: r.kind >= 3,
        dancers: r.dancers || null };
      q.group = !!(r.dancers && r.dancers.length > 1) || /dance group/.test(r.text);
      if (r.kind === 1 || r.kind === 7) { q.n = r.n || 1; q.songs = null; }
      else if (r.kind === 2) {                             // pick a course: the five the game never designates in this round
        q.pick = round === 1 ? [0, 1, 2, 3, 4] : [10, 11, 12, 13, 14];
        q.songs = this.course(q.pick[0]); q.n = q.songs.length; q.courseId = q.pick[0];
      }
      else if (r.kind === 3 || r.kind === 5) { q.songs = r.songs.map(x => 2000 + x); q.n = q.songs.length; }
      else { q.songs = this.course(r.course); q.n = q.songs.length; q.courseId = r.course; }
      // a dancer number is outfit*1000 + character (the game uses it to pick the dancer's model and costume)
      q.outfits = r.dancers ? r.dancers.map(x => Math.floor(x / 1000)) : null;
      q.level = null;
      return q;
    });
  },
  open(round, v) {
    const C = u => gcVenueCleared(this, round, u);
    if (v === 0) return true;
    if (v <= 3) return C(0);
    if (v <= 6) return C(1) && C(2) && C(3);
    if (v === 7) return [4, 5, 6].every(C);
    if (v === 8) return C(7);
    return C(8);                                            // the hidden venues: once EXPOSURE's dance group is beaten
  },
  hidden(round, v) { return v >= 8 && !this.open(round, v); },
  lockedWhy(round, v) { return v <= 3 ? 'Clear INCEPTION ARENA to open this arena.' : v <= 6 ? 'Clear GET-A-GO-GO, ARENA SHIFT and FUNKTION JUNCTION.' : 'Clear every arena before PINNACLE.'; },
  // how high the opponent's score climbs: an estimate that rises arena by arena (the game's own rule for
  // its dancers' scores isn't decoded)
  share(round, v, q) { return (round === 1 ? 0.5 + 0.03 * v : 0.72 + 0.02 * v) + (q.group ? 0.03 : 0); },
  // the opponent's profile group (HP2 0x80034860): +1 once the arena is burning, +2 in round 2
  comGroup(round, v) { return (gcVenueCleared(this, round, v) ? 1 : 0) + (round === 2 ? 2 : 0); },
  cleared(c) {
    const sv = this.save();
    if (c.v === 8 && gcVenueCleared(this, c.round, 8)) {
      sv.rounds = (sv.rounds || 0) + 1;
      if (c.round === 1 && !sv.round2) { sv.round2 = true; return 'ALL ARENAS BURNING!  Hidden venues appear, and ROUND 2 opens (Left/Right on the arena list).'; }
      return 'ALL ARENAS BURNING!  Hidden venues appear.';
    }
    return null;
  },
  status() { return this.save().round2 ? 'Left/Right: ROUND 1 / ROUND 2' : 'ROUND 1'; },
};
// DDR II's TOURNAMENT MODE: 4 stages of 8 requests, read from the game's own table (main.dol 0x80279560)
// and its wording (text_eng.bin): songs of your choice, specified songs, dancer battles and a final.
let TOUR = null;
// TOURNAMENT (DDR II): the same set of functions
const GC_DDR2 = {
  game: 'ddr2', disc: undefined, key: 'tour', title: 'TOURNAMENT', master: 'DANCE BATTLE',
  ready() { return TOUR && TOUR.rows; },
  async load() { if (!TOUR) { try { TOUR = (await api('/api/ddr2tour')) || {}; } catch (e) { TOUR = {}; } } return null; },
  save() { SAVE.tour = SAVE.tour || { done: {}, rounds: 0 }; return SAVE.tour; },
  rounds() { return [1]; },
  names() { return ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4']; },
  requests(round, v) {
    if (!TOUR || !TOUR.rows) return [];
    const play = sl => songForSlot(sl), pools = TOUR.pools || [];
    return TOUR.rows.slice(v * 8, v * 8 + 8).map((r, k) => {
      const i = v * 8 + k;
      const q = { text: (TOUR.texts || [])[i] || '', minDiff: r.diff, grade: null, boo: null, combo: null, score: null, gauge: null, great: null, perfect: null,
        master: r.kind === 8 || r.kind === 9, group: false, designated: false, course: false };
      if (r.cond === 1) q.grade = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'AA' }[r.value] || 'C';
      else if (r.cond === 2) q.combo = r.value - 1;                 // "at least N": the check is "over"
      else if (r.cond === 5) q.gauge = r.value;
      else if (r.cond === 6) q.perfect = r.value - 1;
      else if (r.cond === 7) q.great = r.value - 1;
      else if (r.cond === 10) q.boo = r.value;
      if (r.kind === 1) { q.n = r.n; q.songs = null; }
      else if (r.kind === 3 || r.kind === 10) {
        const ok = r.songs.filter(play), need = r.kind === 10 ? 1 : r.n;
        q.designated = true;
        if (ok.length > need) { q.pickFrom = ok; q.need = need; q.n = need; q.songs = null; }
        else { q.songs = ok; q.n = need; }                       // (songs this copy can't play become your choice)
      } else if (r.kind === 8) {                                   // a dancer's song (the game: list stage*4 + battle), then one of yours
        const pool = (pools[v * 4 + Math.max(0, k - 5)] || []).filter(play);
        q.songs = pool.length ? [pool[Math.floor(wiiRandom() * pool.length)]] : []; q.n = 2;
      } else if (r.kind === 9) {                                   // the final: the opponent's song (list stage*4+2), 2 competition songs (list stage*4+3), 1 of yours
        const opp = (pools[v * 4 + 2] || []).filter(play), comp = (pools[v * 4 + 3] || []).filter(play), pick = [];
        if (opp.length) pick.push(opp[Math.floor(wiiRandom() * opp.length)]);
        while (pick.length < 3 && comp.length) { const x = comp.splice(Math.floor(wiiRandom() * comp.length), 1)[0]; if (!pick.includes(x)) pick.push(x); }
        q.songs = pick; q.n = 4;
      }
      return q;
    });
  },
  open(round, v) { return v === 0 || gcCleared(this, round, v - 1, 7); },
  hidden() { return false; },
  lockedWhy(round, v) { return 'Win STAGE ' + v + "'s final to open this stage."; },
  share(round, v, q) { return 0.55 + 0.08 * v + (q.n === 4 ? 0.05 : 0); },
  // DDR II keeps HP2's opponent table unused (0x8026F0F4); its one round takes HP2's rule: +1 once the stage is cleared
  comGroup(round, v) { return gcVenueCleared(this, round, v) ? 1 : 0; },
  cleared(c) {
    if (c.v === 3 && c.r === 7) { const sv = this.save(); sv.rounds = (sv.rounds || 0) + 1; return 'TOURNAMENT CHAMPION!'; }
    return null;
  },
  status() { return 'TOURNAMENT'; },
};
// HP4's GROOVE CIRCUIT ("GCM" in its code: CselGCMOpening, CgmDataManager, CgmLocation, CgmEvent; voices
// VO_NAR_SELECTVENUE, VO_NAR_GCMVENUECLEAR / FAIL): DDR II's tournament table and texts carried over
// (server Hp4Game: 0x8025eb90, 4 venues x 8 events, song lists 0x8025ea50) and run by the same rules.
// The game's own menus never reach it, so DDR HP4 PC doesn't offer it either (kept for reference only).
const GC_HP4 = Object.assign({}, GC_DDR2, {
  key: 'gcm4', title: 'GROOVE CIRCUIT', master: 'DANCE BATTLE',
  save() { SAVE.gcm = SAVE.gcm || { done: {}, rounds: 0 }; return SAVE.gcm; },
  names() { return ['VENUE 1', 'VENUE 2', 'VENUE 3', 'VENUE 4']; },
  lockedWhy(round, v) { return 'Win VENUE ' + v + "'s final to open this venue."; },
  cleared(c) {
    if (gcVenueCleared(this, c.round, c.v)) voiceLater('VO_NAR_GCMVENUECLEAR');
    if (c.v === 3 && c.r === 7) { const sv = this.save(); sv.rounds = (sv.rounds || 0) + 1; return 'GROOVE CIRCUIT CLEARED!'; }
    return null;
  },
  status() { return 'GROOVE CIRCUIT'; },
});
// the story mode of the game being played; cleared requests / venues; a play's top score
function gcCfg() { return HP4 ? GC_HP4 : gameNow() === 'hp2' ? GC_HP2 : gameNow() === 'ddr2' ? GC_DDR2 : GC_HP1; }
function gcCleared(cfg, round, v, r) { return !!cfg.save().done[round + ':' + v + ':' + r]; }
function gcVenueCleared(cfg, round, v) { const R = cfg.requests(round, v); return R.length > 0 && R.every((q, r) => gcCleared(cfg, round, v, r)); }
function gcMaxScore(p) { return p && p.hpRules ? p.hpM * 10 : 1000000; }
// The battle opponent (COM), decoded from Hottest Party 2 (and DDR II's shared engine, 0x80034cc8).
// A profile is 18 bytes: weights for BOO, ALMOST, GOOD, GREAT, PERFECT, MARVELOUS, then the chance (%)
// that a second panel of a jump is played (byte 6). Table [group][row], row = the chart's difficulty
// (BEGINNER..EXPERT; CHALLENGE takes EXPERT's), group = the arena's state (see comGroup).
// HP2 0x801d80f0 (every arena has the same 4 x 4), DDR II 0x8026F0F4 (the same numbers, unused there).
const COM_TABLE = [
  [[4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30]],
  [[3, 3, 4, 40, 30, 20, 40], [3, 3, 4, 40, 30, 20, 30], [3, 3, 4, 40, 30, 20, 25], [3, 3, 4, 40, 30, 20, 25]],
  [[2, 2, 2, 40, 40, 20, 65], [2, 2, 2, 40, 40, 20, 60], [2, 2, 2, 40, 40, 20, 55], [2, 2, 2, 40, 40, 20, 55]],
  [[0, 0, 2, 34, 48, 25, 85], [0, 0, 2, 34, 48, 25, 75], [0, 0, 2, 34, 48, 25, 70], [0, 0, 2, 34, 48, 25, 70]],
];
// a random whole number below n, from the game's own random number maker
const comRnd = n => Math.floor(wiiRandom() * n);
// the judgments for n steps (0x80034cc8): each weight gets a small random lift, the steps are shared out
// by the weights (the rest to the first weighted judgment), then the list is shuffled (10n swaps)
function comJudgments(w, n) {
  const total = w.slice(0, 6).reduce((a, b) => a + b, 0); if (total <= 0 || n <= 0) return [];
  const plain = w.slice(0, 6).every(x => x === 0 || x === 255);
  const adj = w.slice(0, 6).map(x => { const j = x && !plain ? Math.trunc(2 * comRnd(total) / 100) : 0; return Math.max(0, x + j - Math.trunc(j / 4)); });
  const sum = adj.reduce((a, b) => a + b, 0); if (sum <= 0) return [];
  const per = Math.fround(n / sum), cnt = adj.map(a => Math.trunc(Math.fround(a * per)));
  const left = n - cnt.reduce((a, b) => a + b, 0);
  if (left > 0) { const k = w.findIndex((x, i) => i < 6 && x); if (k >= 0) cnt[k] += left; }
  const out = []; cnt.forEach((c, j) => { for (let i = 0; i < c && out.length < n; i++) out.push(j); });
  for (let k = 0; k < 10 * out.length; k++) { const i = k % out.length, j = comRnd(out.length); const x = out[i]; out[i] = out[j]; out[j] = x; }
  return out;
}
// the opponent's whole song: its score at every judgment, scored by the same rules as the player
function comRival(p, w) {
  const notes = p.notes.slice().sort((a, b) => a.t - b.t), cat = comJudgments(w, notes.length);
  const of = new Map(); notes.forEach((n, i) => of.set(n, cat[i] ?? 5));
  const ev = [];
  for (const row of p.rows) {
    // a jump is judged by its later press; each press is early or late at random, so either panel's judgment
    const j = of.get(row.notes[comRnd(row.notes.length)]);
    ev.push({ t: row.t, j });
    row.notes.forEach((n, k) => {
      if (n.endT === undefined) return;
      // held through when its step is GOOD or better - the Wii's all-GOOD autoplay held every freeze (O.K.),
      // 2026-11-18; my first reading of 0x8002dac8 said GREAT. A jump's other panel only by byte 6's chance
      const ok = of.get(n) >= 2 && (k === 0 || comRnd(100) < w[6]);
      ev.push({ t: n.endT, ok });
    });
  }
  ev.sort((a, b) => a.t - b.t);
  const jc = [0, 0, 0, 0, 0, 0]; let okN = 0, score = 0, hk = 0;
  const T = p.hpRules ? p.hpT : 0;
  const tl = [];
  for (const e of ev) {
    if (p.hpRules) {
      // (HP4: a BOO or an N.G. doesn't move the count on)
      if (p.hp4 && (e.j === 0 || (e.j === undefined && !e.ok))) { tl.push([e.t, score]); continue; }
      hk = Math.min(T, hk + 1);
      const v = hk === T ? p.hpM - (T * (T - 1) / 2) * p.hpUnit : hk * p.hpUnit;
      const wv = e.j !== undefined ? hpWeight(p, e.j) : (e.ok ? 10 : 0);
      score = Math.min(999999999, score + wv * v);
    } else {
      if (e.j !== undefined) jc[e.j]++; else if (e.ok) okN++;
      let num = SCORE_FREEZE_OK * okN;
      for (let k = 0; k < 6; k++) num += SCORE_W[k] * jc[k];
      score = Math.max(0, Math.floor(100000 * num / p.den) - jc[3] - jc[4]) * 10;
    }
    tl.push([e.t, score]);
  }
  return { tl, score };
}
// the computer opponent for this play: its judgment timeline and final score (made once per play)
function gcOpp(p, play) {
  if (!GC || GC.comGroup === null || GC.comGroup === undefined) return null;
  if (!play._com) {
    const row = Math.min(3, p.slot ?? 1);
    play._com = comRival(p, COM_TABLE[Math.min(3, GC.comGroup)][row]);
  }
  return play._com;
}
// BATTLE MODE's opponent, played as player 2: each row is judged when it reaches the step zone with the
// judgment the profile drew for it (as the game's simulated presses land), freezes held by the same rule
function comStep(p, t) {
  if (!p.comCat) {
    const w = COM_TABLE[Math.max(0, Math.min(3, p.com))][Math.min(3, p.slot ?? 1)];
    const notes = p.notes.slice().sort((a, b) => a.t - b.t), cat = comJudgments(w, notes.length);
    p.comW = w; p.comCat = new Map(); notes.forEach((n, i) => p.comCat.set(n, cat[i] ?? 5));
  }
  for (const row of p.rows) {
    if (row.t > t) break;
    if (row.judged || row.comDone) continue;
    row.comDone = true; row.hit = row.notes.length; row.dt = 0;
    row.notes.forEach((n, k) => {
      n.done = true; n.hitT = row.t; p.flash[n.lane] = t;
      if (n.endT !== undefined) {
        const ok = p.comCat.get(n) >= 3 && (k === 0 || comRnd(100) < p.comW[6]);
        n.holding = true; n.comHold = ok ? n.endT + 1 : row.t; p.holding.push(n);
      }
    });
    p.judgeRow(row, p.comCat.get(row.notes[comRnd(row.notes.length)]));
  }
}
// the opponent's final score (Hottest Party's GROOVE CIRCUIT keeps the estimate: its own system isn't decoded)
function gcOppFinal(p, play) { const c = gcOpp(p, play); return c ? c.score : Math.floor(gcMaxScore(p) * GC.share); }
// the opponent's score at song time t
function gcOppNow(p, play, t) {
  const c = gcOpp(p, play);
  if (!c) return Math.floor(gcMaxScore(p) * GC.share * clamp(Math.max(0, t) / Math.max(1, play.endT)));
  let s = 0; for (const [et, sc] of c.tl) { if (et > t) break; s = sc; }
  return s;
}
// does one song meet the request?
function gcCheck(q, p, play) {
  const why = [];
  if (p.failed) why.push('FAILED');
  if (gcRank(p.diff) < q.minDiff) why.push(['', 'BASIC', 'DIFFICULT', 'EXPERT'][q.minDiff] + ' OR HIGHER');
  if (q.grade && GRADE_ORDER.indexOf(p.gr) < GRADE_ORDER.indexOf(q.grade)) why.push(q.grade + ' OR BETTER');
  const boo = (p.counts.BOO || 0) + (p.counts.ALMOST || 0);
  if (q.boo !== null && boo > q.boo) why.push(q.boo ? q.boo + ' OR FEWER BOO' : 'NO BOO');
  if (q.combo !== null && !(p.maxCombo > q.combo)) why.push('OVER ' + q.combo + ' COMBO');
  if (q.score !== null && !(p.score > q.score)) why.push('OVER ' + q.score.toLocaleString('en-US') + ' POINTS');
  if (q.gauge !== null && !(p.life >= q.gauge * 10)) why.push(q.gauge + '% GAUGE');
  if (q.great !== null && !((p.counts.GREAT || 0) > q.great)) why.push('OVER ' + q.great + ' GREAT');
  if (q.perfect !== null && !((p.counts.PERFECT || 0) + (p.counts.MARVELOUS || 0) > q.perfect)) why.push('OVER ' + q.perfect + ' PERFECT');
  if (q.master && !(p.score > gcOppFinal(p, play))) why.push('BEAT THE ' + (q.group ? 'DANCE GROUP' : GC.cfg.master === 'VENUE MASTER' ? 'VENUE MASTER' : 'DANCER'));
  return { ok: !why.length, why, boo };
}
// start the next song of the request being played
function gcStartSong() {
  const q = GC.req, slot = q.songs[GC.i];
  const song = SONGS.find(s2 => s2.slot === slot) || (GC.extra && GC.extra.slot === slot ? GC.extra : null) || (HP4 ? songForSlot(slot) : null);
  if (!song) { GC.results.push({ name: 'song ' + slot + ' missing', ok: false, why: ['NOT FOUND'] }); go(GCResult); return; }
  const lv = levelsOf(song) || [];
  const want = [4, 1, 2, 3][GC.diff];
  S.diff = lv[DIFFS.findIndex(x => x[0] === want)] > 0 ? want
    : [4, 1, 2, 3].slice(q.minDiff).find(d => lv[DIFFS.findIndex(x => x[0] === d)] > 0) || want;
  go(Loading.with(song));
}
// a song of the request is over (from the results screen)
function gcSongDone(p, play) {
  const q = GC.req;
  if (GC.i >= (q.songs || []).length && play.song.disc !== GC.cfg.disc) { GC.note = 'Only ' + ({ hp: 'Hottest Party', hp2: 'Hottest Party 2' }[GC.cfg.disc] || 'DDR II') + ' songs count in ' + GC.cfg.title + '.'; go(Select); return; }
  const c = gcCheck(q, p, play);
  GC.results.push({ name: play.song.name, gr: p.gr, combo: p.maxCombo, boo: c.boo, score: p.score,
    master: q.master ? gcOppFinal(p, play) : null, ok: c.ok, why: c.why });
  GC.note = null;
  if (!c.ok) { go(GCResult); return; }
  GC.i++;
  if (GC.i >= q.n) { go(GCResult); return; }
  if (q.songs && GC.i < q.songs.length) gcStartSong(); else go(Select);
}
// small drawing helpers for the story-mode screens: a framed box, wrapped text, the opponent's title
function gcBox(x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, w, h); }
function gcWrap(str, x, y, size, maxW, color, lh) {
  g.font = size + 'px "Segoe UI", Arial, sans-serif';
  let line = '';
  for (const w of String(str).split(' ')) {
    const t2 = line ? line + ' ' + w : w;
    if (g.measureText(t2).width > maxW && line) { text(line, x, y, size, color, 'left', 'normal'); y += lh; line = w; } else line = t2;
  }
  if (line) text(line, x, y, size, color, 'left', 'normal');
  return y + lh;
}
function gcWho(q, cfg) { return q.group ? 'DANCE GROUP' : cfg.master === 'VENUE MASTER' ? 'VENUE MASTER' : 'DANCER'; }
// while dancing: the request and, in a battle, the opponent's score climbing through the song
function gcPlayBar(play) {
  const q = GC.req, p = play.ps && play.ps[0]; if (!q || !p) return;
  const x = 860, y = 96, w = 390;
  gcBox(x, y, w, q.master ? 78 : 44, 'rgba(10,20,60,0.75)');
  text(GC.vname + '  ' + (q.n > 1 ? 'SONG ' + (GC.i + 1) + ' / ' + q.n : 'REQUEST'), x + 12, y + 22, fitSize(GC.vname + '  SONG 1 / 1', 18, w - 24), '#ffe86a', 'left');
  if (q.master) {
    const vm = gcOppNow(p, play, play.now());
    text(gcWho(q, GC.cfg), x + 12, y + 56, 16, '#ff9ad5', 'left');
    text(String(vm).padStart(9, '0'), x + w - 12, y + 56, 22, p.score >= vm ? '#7dff9a' : '#ff8a8a', 'right');
  }
}
// on the song select during a request whose songs you pick
function gcSelectBar() {
  const q = GC.req; if (!q) return;
  gcBox(16, 636, 610, 64, 'rgba(10,20,60,0.88)');
  text(GC.cfg.title + '  ' + GC.vname + '   SONG ' + (GC.i + 1) + ' / ' + q.n, 321, 656, fitSize(GC.cfg.title + '  ' + GC.vname + '   SONG 1 / 1', 18, 590), '#ffe86a', 'center');
  text(GC.note || q.text, 321, 684, fitSize(GC.note || q.text, 15, 590, 'normal'), '#fff', 'center', 'normal');
}
// the story mode's venue / request select screen
const GCSel = {
  bgm: 'MU_BGM_FREE',
  v: 0, r: 0, focus: 'venue', diff: 1, at: 0, round: 1, cfg: null,
  async enter() {
    this.at = performance.now(); GC = null; this.focus = 'venue';
    this.cfg = gcCfg(); this.loading = true;
    if (HP4) voice('VO_NAR_SELECTVENUE');
    this.extra = await this.cfg.load();
    this.loading = false;
    const R = this.cfg.rounds(); if (!R.includes(this.round)) this.round = R[R.length - 1];
    if (this.v >= this.cfg.names(this.round).length) this.v = 0;
  },
  venues() {
    const c = this.cfg, R = this.round;
    return c.names(R).map((n, v) => ({ v, name: n, open: c.open(R, v), cleared: gcVenueCleared(c, R, v) })).filter(x => !c.hidden(R, x.v));
  },
  input(a, p) {
    const c = this.cfg;
    if (!p || !c || !c.ready()) { if (p && a === 'BACK') go(ModeSel); return; }
    const R = this.round, V = this.venues(), reqs = c.requests(R, this.v);
    const up = /^P[1-4]U$/.test(a), dn = /^P[1-4]D$/.test(a), lf = /^P[1-4]L$/.test(a), rt = /^P[1-4]R$/.test(a);
    if (this.focus === 'venue') {
      const k = V.findIndex(x => x.v === this.v), rounds = c.rounds();
      if (up && k > 0) { this.v = V[k - 1].v; sfx('SE_SYS_SELECT01'); }
      else if (dn && k < V.length - 1) { this.v = V[k + 1].v; sfx('SE_SYS_SELECT01'); }
      else if ((lf || rt) && rounds.length > 1) {
        const j = rounds.indexOf(R) + (rt ? 1 : -1);
        if (j >= 0 && j < rounds.length) { this.round = rounds[j]; this.v = 0; sfx('SE_SYS_SELECT01'); }
      } else if (a === 'START') {
        if (!c.open(R, this.v)) { sfx('SE_SYS_WINDOWOUT'); return; }
        sfx('SE_SYS_DECIDE01'); this.focus = 'req';
        this.r = Math.max(0, reqs.findIndex((q, r) => !gcCleared(c, R, this.v, r)));
        this.diff = Math.max(reqs[this.r] ? reqs[this.r].minDiff : 0, R === 2 ? 2 : 1);
      } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
      return;
    }
    const q = reqs[this.r];
    if (this.focus === 'songs') {                           // pick n of the specified songs
      const L = q.pickFrom;
      if (up && this.si > 0) { this.si--; sfx('SE_SYS_SELECT01'); }
      else if (dn && this.si < L.length - 1) { this.si++; sfx('SE_SYS_SELECT01'); }
      else if (lf && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
      else if (rt && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'req'; }
      else if (a === 'START') {
        const sl = L[this.si], k = this.picked.indexOf(sl);
        if (k >= 0) this.picked.splice(k, 1); else if (this.picked.length < q.need) this.picked.push(sl);
        sfx('SE_SYS_DECIDE01');
        if (this.picked.length === q.need) {
          S.style = 'single'; P2 = null;
          const qq = Object.assign({}, q, { songs: this.picked.slice(), pickFrom: null });
          GC = { cfg: c, round: R, v: this.v, r: this.r, req: qq, i: 0, results: [], diff: this.diff, extra: this.extra,
            share: c.share(R, this.v, qq), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
          this.focus = 'req'; gcStartSong();
        }
      }
      return;
    }
    if (this.focus === 'course') {                          // choose which course to dance
      if (up && this.ci > 0) { this.ci--; sfx('SE_SYS_SELECT01'); }
      else if (dn && this.ci < q.pick.length - 1) { this.ci++; sfx('SE_SYS_SELECT01'); }
      else if (lf && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
      else if (rt && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'req'; }
      else if (a === 'START') {
        sfx('SE_SYS_DECIDE01'); S.style = 'single'; P2 = null;
        const id = q.pick[this.ci], qq = Object.assign({}, q, { songs: c.course(id), courseId: id });
        qq.n = qq.songs.length;
        GC = { cfg: c, round: R, v: this.v, r: this.r, req: qq, i: 0, results: [], diff: this.diff, extra: this.extra,
          share: c.share(R, this.v, qq), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
        this.focus = 'req'; gcStartSong();
      }
      return;
    }
    if (up && this.r > 0) { this.r--; sfx('SE_SYS_SELECT01'); this.diff = Math.max(this.diff, reqs[this.r].minDiff); }
    else if (dn && this.r < reqs.length - 1) { this.r++; sfx('SE_SYS_SELECT01'); this.diff = Math.max(this.diff, reqs[this.r].minDiff); }
    else if (a === 'START' && q && q.pick && this.focus === 'req') { sfx('SE_SYS_DECIDE01'); this.focus = 'course'; this.ci = this.ci || 0; }
    else if (lf && q && q.songs && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
    else if (rt && q && q.songs && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'venue'; }
    else if (a === 'START' && q) {
      sfx('SE_SYS_DECIDE01');
      S.style = 'single'; P2 = null;
      GC = { cfg: c, round: R, v: this.v, r: this.r, req: q, i: 0, results: [], diff: this.diff, extra: this.extra,
        share: c.share(R, this.v, q), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
      if (q.pickFrom) { this.focus = 'songs'; this.picked = []; this.si = 0; GC = null; return; }
      if (q.songs && q.songs.length) gcStartSong(); else go(Select);
    }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const c = this.cfg || gcCfg();
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(c.title, 210, 44, 32, '#fff', 'center');
    if (this.loading) { text('Loading...', 640, 360, 22, '#fff', 'center'); return; }
    if (!c.ready()) { text(c.title + ' needs the ' + (c.disc === 'hp' ? 'Hottest Party' : 'Hottest Party 2') + ' disc: add it in Setup.', 640, 360, 22, '#fff', 'center'); return; }
    const R = this.round, V = this.venues();
    text((c.rounds().length > 1 ? 'ROUND ' + R + '   ' : '') + c.status(), 1240, 44, 18, '#ffe86a', 'right');
    const step = Math.min(60, 530 / Math.max(1, V.length));
    V.forEach((x, k) => {
      const y = 100 + k * step, on = x.v === this.v, h = step - 8;
      gcBox(60, y, 360, h, on ? (this.focus === 'venue' ? 'rgba(255,138,30,0.95)' : 'rgba(200,110,30,0.9)') : x.open ? 'rgba(20,60,140,0.85)' : 'rgba(40,40,60,0.75)');
      text(x.open ? x.name : '? ? ?', 80, y + h / 2, Math.min(22, h * 0.5), x.open ? '#fff' : '#99a', 'left');
      if (x.cleared) text('CLEARED', 405, y + h / 2, 14, '#7dff9a', 'right');
    });
    const reqs = c.requests(R, this.v), open = c.open(R, this.v);
    gcBox(460, 100, 780, 530, 'rgba(10,30,90,0.88)');
    text(open ? c.names(R)[this.v] : '? ? ?', 850, 135, 30, '#ffe86a', 'center');
    if (!open) { text(c.lockedWhy(R, this.v), 850, 300, 20, '#fff', 'center', 'normal'); }
    else {
      // fit the requests in the panel (up to six)
      const rh = Math.min(138, (460 - (reqs.length - 1) * 8) / Math.max(1, reqs.length)), compact = rh < 110;
      reqs.forEach((q, r) => {
        const y = 165 + r * (rh + 8), on = this.focus === 'req' && r === this.r, done = gcCleared(c, R, this.v, r);
        gcBox(480, y, 740, rh, on ? 'rgba(255,138,30,0.9)' : q.master ? 'rgba(120,30,90,0.85)' : 'rgba(20,60,140,0.85)');
        text((q.master ? (q.group ? 'DANCE GROUP BATTLE' : c.master) : 'REQUEST ' + (r + 1)) + (q.level !== null && q.level !== undefined ? '   COM LV ' + (q.level + 1) : ''), 495, y + 16, 14, '#ffe86a', 'left');
        if (done) text('CLEARED', 1205, y + 16, 14, '#7dff9a', 'right');
        let yy = gcWrap(q.text, 495, y + (compact ? 36 : 44), compact ? 15 : 18, 710, '#fff', compact ? 18 : 24);
        if (q.songs) {
          const names = q.songs.map(sl => { const so = SONGS.find(s2 => s2.slot === sl) || (this.extra && this.extra.slot === sl ? this.extra : null); return so ? so.name : '?'; });
          const line = q.pick ? 'Pick one of ' + q.pick.length + ' courses' : (q.course ? (c.courseName && q.courseId !== undefined ? c.courseName(q.courseId) + ': ' : 'Course: ') : 'Song' + (names.length > 1 ? 's' : '') + ': ') + names.join(' / ');
          if (compact) text(line, 495, yy, fitSize(line, 13, 560, 'normal'), '#cfe3ff', 'left', 'normal');
          else yy = gcWrap(line, 495, yy, 15, 710, '#cfe3ff', 20);
        }
        if (q.reward && !compact) gcWrap('Unlocks: ' + q.reward, 495, yy, 14, 710, '#ffd23c', 19);
        if (on && q.songs) text('◀ ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' ▶', 1205, y + rh - 16, compact ? 15 : 18, '#fff', 'right');
      });
    }
    if (this.focus === 'songs' && reqs[this.r] && reqs[this.r].pickFrom) {
      const q = reqs[this.r];
      gcBox(380, 150, 520, 440, 'rgba(10,20,60,0.96)');
      text('PICK ' + q.need + ' OF THESE SONGS', 640, 185, 22, '#ffe86a', 'center');
      q.pickFrom.forEach((sl, k) => {
        const y = 215 + k * 66, on = k === this.si, got = this.picked.includes(sl), so = songForSlot(sl);
        gcBox(400, y, 480, 58, on ? 'rgba(255,138,30,0.95)' : got ? 'rgba(20,120,60,0.9)' : 'rgba(20,60,140,0.9)');
        text((got ? '\u2714 ' : '') + (so ? so.name : 'song ' + sl), 415, y + 29, fitSize(so ? so.name : 'x', 18, 440), '#fff', 'left');
      });
      text('\u25C0 ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' \u25B6', 640, 570, 18, '#fff', 'center');
    }
    if (this.focus === 'course' && reqs[this.r] && reqs[this.r].pick) {
      const q = reqs[this.r];
      gcBox(380, 150, 520, 440, 'rgba(10,20,60,0.96)');
      text('PICK A COURSE', 640, 185, 24, '#ffe86a', 'center');
      q.pick.forEach((id, k) => {
        const y = 215 + k * 66, on = k === this.ci;
        gcBox(400, y, 480, 58, on ? 'rgba(255,138,30,0.95)' : 'rgba(20,60,140,0.9)');
        text(c.courseName(id), 415, y + 18, 17, '#fff', 'left');
        const nm = c.course(id).map(sl => (SONGS.find(s2 => s2.slot === sl) || {}).name || '?').join(' / ');
        text(nm, 415, y + 42, fitSize(nm, 13, 450, 'normal'), '#cfe3ff', 'left', 'normal');
      });
      text('\u25C0 ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' \u25B6', 640, 570, 18, '#fff', 'center');
    }
    if (this.focus === 'songs') text('Up/Down: song   Enter: pick / unpick   Left/Right: difficulty   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
    else text(this.focus === 'course' ? 'Up/Down: course   Left/Right: difficulty   Enter: start   Esc: back' : this.focus === 'venue' ? 'Up/Down: ' + (c.key === 'ga' ? 'arena' : 'venue') + (c.rounds().length > 1 ? '   Left/Right: round' : '') + '   Enter: OK   Esc: back'
      : 'Up/Down: request   Left/Right: difficulty   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the story mode's result screen: request cleared or failed, and what it unlocked
const GCResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now();
    const c = GC; this.ok = c.results.length >= c.req.n && c.results.every(x => x.ok);
    this.first = false; this.msg = null; this.venueDone = false;
    if (this.ok) {
      const sv = c.cfg.save(), key = c.round + ':' + c.v + ':' + c.r;
      this.first = !sv.done[key]; sv.done[key] = true;
      this.venueDone = gcVenueCleared(c.cfg, c.round, c.v);
      if (this.first) this.msg = c.cfg.cleared(c);
      writeSave();
    }
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01'); GC = null; go(GCSel);
  },
  draw(t) {
    menuBackground(t);
    const c = GC; if (!c) return;
    gcBox(190, 70, 900, 590, 'rgba(10,30,90,0.9)');
    text(c.vname + (c.req.master ? '  ' + (c.req.group ? 'DANCE GROUP BATTLE' : c.cfg.master) : '  REQUEST ' + (c.r + 1)), 640, 110, fitSize(c.vname + '  DANCE GROUP BATTLE', 28, 860), '#ffe86a', 'center');
    gcWrap(c.req.text, 230, 150, 18, 820, '#fff', 24);
    const rowH = c.results.length > 6 ? 44 : 58;
    c.results.forEach((x, k) => {
      const y = 215 + k * rowH;
      gcBox(230, y, 820, rowH - 8, x.ok ? 'rgba(20,110,60,0.85)' : 'rgba(130,30,40,0.85)');
      text(x.name, 245, y + 15, 16, '#fff', 'left');
      if (x.gr) text(x.gr + '   COMBO ' + x.combo + '   BOO ' + x.boo + '   ' + String(x.score).padStart(9, '0') + (x.master !== null ? '   VS ' + String(x.master).padStart(9, '0') : ''), 245, y + rowH - 22, 13, '#dfe', 'left', 'normal');
      text(x.ok ? 'OK' : x.why.join(', '), 1035, y + (rowH - 8) / 2, x.ok ? 20 : fitSize(x.why.join(', '), 14, 360, 'normal'), x.ok ? '#7dff9a' : '#ffd0d0', 'right');
    });
    const y = 225 + Math.max(1, c.results.length) * rowH;
    if (this.ok) {
      text(c.req.master ? (c.req.group ? 'DANCE GROUP BEATEN!' : c.cfg.master === 'VENUE MASTER' ? 'VENUE MASTER BEATEN!' : 'DANCER BEATEN!') : 'REQUEST CLEARED!', 640, y + 20, 32, '#7dff9a', 'center');
      if (this.first && c.req.reward) text('Unlocked: ' + c.req.reward, 640, y + 62, fitSize('Unlocked: ' + c.req.reward, 18, 820, 'normal'), '#ffd23c', 'center', 'normal');
      if (this.msg) text(this.msg, 640, y + 100, fitSize(this.msg, 20, 860), '#fff', 'center');
      else if (this.venueDone) text((c.cfg.key === 'ga' ? 'ARENA' : 'VENUE') + ' CLEARED!  All requests cleared!', 640, y + 100, 20, '#fff', 'center');
    } else {
      text('REQUEST FAILED', 640, y + 20, 32, '#ff8a8a', 'center');
      text('Pick it again to try again.', 640, y + 60, 18, '#fff', 'center', 'normal');
    }
    text('Enter: back to the ' + (c.cfg.key === 'ga' ? 'arenas' : 'venues'), 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- DDR SCHOOL: Hottest Party 3's 18 lessons (6 STEP, 7 GIMMICK, 5 HAND), each a short chart over the
// lesson music, with the teacher's words from the disc shown first. You can't fail; clearing one marks
// it. (Gimmick and hand arrows play as normal arrows for now.)
let LESSONS = null;
// ---- DDR SCHOOL. DDR II's own (select_bin group 11, layout block 12605088 on the Wii screen): one lesson at
// a time - its name plate, best grade and crown at the top, the teacher on the left, his words in a speech
// window, arrows to change lesson and BEGIN LESSONS. 6 STEP LESSONS (played here), 5 CHOREOGRAPH and 4 Wii
// Balance Board lessons (need the Wii Remote / balance board: listed, not playable). Other games: Hottest
// Party 3's lessons, in a list.
const GRADE_RANK = ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'];
// the save key for a lesson's best grade
function lessonKey(song) { return song.disc ? song.lesson : 'ddr2-' + song.lesson; }
// DDR SCHOOL's lesson list screen
const LessonSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, intro: null, at: 0, moved: 0, msg: '',
  ddr2() { return gameNow() !== 'hp3' && gameNow() !== 'hp' && gameNow() !== 'hp2'; },
  async enter() {
    this.intro = null; this.msg = ''; this.at = this.moved = performance.now();
    if (this.ddr2()) voice('VO_NAR_SELECTLESSON');          // (0x801035e4 as SELECT LESSON opens)
    if (!A.font && A.loadIntro) await A.loadIntro().catch(() => {});      // the game's font
    const want = this.ddr2() ? 'ddr2' : 'hp3';
    if (!LESSONS || LESSONS.of !== want) {
      try { LESSONS = await api(want === 'ddr2' ? '/api/lessons?game=ddr2' : '/api/lessons'); } catch (e) { LESSONS = []; }
      // DDR II's SELECT LESSON (classic play) holds the 6 STEP LESSONS ("1/6" in the real game); the
      // CHOREOGRAPH and balance board lessons belong to the motion play that isn't in this version
      // (HP4: its SELECT LESSON has all 15 - the lesson names /11/0/0/0 are numbered 1-15)
      if (want === 'ddr2' && !HP4) LESSONS = LESSONS.filter(l => l.playable);
      LESSONS.of = want;
      if (want === 'ddr2' && !LESSONS.length) { try { LESSONS = await api('/api/lessons'); LESSONS.of = want; } catch (e) {} }
    }
    if (this.i >= LESSONS.length) this.i = 0;
  },
  start(l) {
    sfx('SE_SYS_DECIDE01'); S.style = 'single'; P2 = null; S.diff = 4;
    if (this.ddr2()) voice('VO_NAR_LETSLESSON');            // (0x801035e4 when a lesson is picked)
    go(Loading.with(l));
  },
  input(a, p) {
    if (!p) return;
    const L = LESSONS || [];
    if (this.ddr2() && L.length && L[0].playable !== undefined) {
      const d = /^P[1-4]([LDUR])$/.exec(a), was = this.i;
      if (d && (d[1] === 'L' || d[1] === 'U')) this.i = (this.i + L.length - 1) % L.length;      // (wraps round, like the game)
      else if (d) this.i = (this.i + 1) % L.length;
      if (this.i !== was) { sfx('SE_SYS_SELECT01'); this.moved = performance.now(); this.msg = ''; }
      if (a === 'START' && L[this.i]) {
        if (L[this.i].playable) this.start(L[this.i]);
        else { sfx('SE_SYS_CANCEL'); this.msg = 'This lesson is played in DDR Hottest Party 4 mode.'; }
      } else if (a === 'BACK') {
        // (DDR II asks first: "Exit DDR SCHOOL?", YES chosen - Wii 2026-11-18)
        if (!HP4) { const m = modesNow().find(x => x.id === 'lesson'); askYesNo('Exit ' + (m ? modeName(m) : 'DDR SCHOOL') + '?', false, () => go(ModeSel)); }
        else { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
      }
      return;
    }
    if (this.intro) {                                   // the teacher's words, then the lesson
      if (a === 'START') this.start(this.intro);
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.intro = null; }
      return;
    }
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < L.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START' && L[this.i]) { sfx('SE_SYS_DECIDE01'); this.intro = L[this.i]; }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
  },
  click() { this.input('START', true); },
  // HP4's SELECT LESSON (select_bin group 11): block 75 the title, block 74 the screen - the lesson's name
  // (338, 98; /11/0/0/0: 15 names), its grade (462.8, 98), the teacher (the six STEP lessons: jun /11/0/0/1
  // poses 0-4 at (62, 312) and /11/0/0/2 at (193, 312) for the sixth; CHOREOGRAPH: /11/0/0/3 poses 0-4,
  // Balance Board: poses 5-8, at (122, 312)), the teacher's words in the window (399, 248; /11/0/0/4 by
  // kind: pink STEP, green CHOREOGRAPH, blue Balance Board), the arrows (278 / 559, 387). (The pose of each
  // lesson is our pick: one picture per lesson, in order.)
  drawHp4(t, L) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.names, H4.jun, H4.jun2, H4.boys, H4.wins, H4.grades] = await Promise.all(['/11/0/0/0', '/11/0/0/1', '/11/0/0/2', '/11/0/0/3', '/11/0/0/4', '/11/0/0/5'].map(one));
      H4.ok = true;
    })();
    if (!H4.ok || !CAE.block('sel', 74)) { CAE.load('sel'); return false; }
    menuBackground(t);
    const l = L[this.i], n = l.n || l.lesson || this.i + 1, out = LEAVE && LEAVE.from === this, tk = out ? 1 : 0;
    const f = out ? caeFrame(LEAVE.t0) : Math.min(caeFrame(this.at), 31);
    const kind = n <= 6 ? 0 : n <= 11 ? 1 : 2;
    const teacherPart = n <= 5 ? 1 : n === 6 ? 2 : 3;
    const teacher = n <= 5 ? H4.jun[n - 1] : n === 6 ? H4.jun2[0] : H4.boys[n <= 11 ? n - 7 : n - 12 + 5];
    const rec = (SAVE.lessons || {})[lessonKey(l)];
    const gi = rec ? ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(rec) : -1;
    CAE.draw('sel', 74, tk, f, {
      only: [0, teacherPart, 4, gi >= 0 ? 5 : -1, 6, 7],
      pic: (i, p) => i === 0 ? H4.names[n - 1] : i === teacherPart ? teacher : i === 4 ? H4.wins[1 + kind] : i === 5 ? H4.grades[gi] : null,
      after: (i, p, st) => {
        if (i !== 4) return;
        // the window (420 x 360): the lesson number in its white box (262, 30), the count in the dark one
        // (352, 30), the teacher's words in the big box (15-405, 60-307)
        g.textBaseline = 'middle'; g.textAlign = 'center';
        g.font = 'bold 22px "Segoe UI", Arial, sans-serif'; g.fillStyle = '#333'; g.fillText(String(this.i + 1), -st.px + 262, -st.py + 30);
        g.fillStyle = '#fff'; g.fillText('/ ' + L.length, -st.px + 352, -st.py + 30);
        if (!l.words) return;
        g.font = 'bold 21px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top';
        l.words.split('\n').forEach((ln, k) => g.fillText(ln, -st.px + 56, -st.py + 76 + k * 30));
      },
    });
    CAE.draw('sel', 75, tk, f);
    if (this.msg) { g.fillStyle = 'rgba(0,0,0,0.65)'; g.fillRect(140, 600, 1000, 40); text(this.msg, W / 2, 620, 18, '#fff', 'center'); }
    keyHints('Left/Right: lesson    Enter: start    Esc: back');
    return true;
  },
  draw(t) {
    const L = LESSONS || [];
    if (HP4 && L.length && L[0].playable !== undefined && this.drawHp4(t, L)) return;
    if (this.ddr2() && L.length && L[0].playable !== undefined) return this.drawDDR2(t, L);
    return this.drawList(t, L);
  },
  drawDDR2(t, L) {
    menuBackground(t);
    const M = A.lesson || {}, l = L[this.i], k = clamp((performance.now() - this.moved) / 250), k0 = clamp((performance.now() - this.at) / 300);
    // title: SELECT LESSON on its bar
    withMenuIn('title', () => {
      if (!wspr(M.titleBar, 320, 30, 215, 40)) { g.fillStyle = '#2a7fd6'; g.fillRect(WX(320) - 322, 0, 645, 105); }
      if (!wspr(M.title, 320, 35, M.title ? M.title.width / 2 : 0, M.title ? M.title.height / 2 : 0)) text('SELECT LESSON', WX(320), WY(35), 30, '#fff', 'center');
    });
    // the teacher, a pose per lesson, in order (lessons 1 and 3 checked against the real game)
    const key = lessonKey(l), gr = (SAVE.lessons || {})[key], fc = (SAVE.lessonFc || {})[key];
    g.globalAlpha = k0; wspr(M.teacher && M.teacher[this.i % 6], 190 - (1 - k) * 12, 312, 200, 245); g.globalAlpha = 1;
    // his speech window: dark blue, light blue once the lesson is cleared (seen in the real game)
    const wi = !l.playable ? 0 : l.kind !== 'STEP' ? 2 : gr ? 3 : 1;
    if (!wspr(M.wind && M.wind[wi], 399, 248, 210, 180)) { g.fillStyle = 'rgba(20,50,120,0.9)'; g.fillRect(WX(399) - 315, WY(248) - 270, 630, 540); }
    // the teacher's words in the game's font, set like the real game (Step Lesson 1's first line fills 80%
    // of the dark panel's width; left edge 3% in, first line 9% down, a line every 10% of its height)
    const ox = WX(399) - 798, lines = (this.msg || l.words || '').split('\n'), pl = 560 + ox, pr = 1092 + ox, pt = 184, pb = 524, pw = pr - pl, ph = pb - pt;
    const fs = ph * 0.102 / 1.05;
    if (A.font && this.sp === undefined) this.sp = (pw * 0.8 / (fs / 24) - gfontWidth("Let's try Step Lesson 1!", 24, 0)) / [..."Let's try Step Lesson 1!"].length;
    lines.forEach((ln, j) => gtext(ln, pl + pw * 0.028, pt + ph * 0.087 + j * ph * 0.102, fs, '#fff', 'left', this.sp ?? 3, 1));
    // the lesson's name plate, best grade and crown, and which lesson of how many ("3/6") in the dark box
    const plate = M.names && l.kind === 'STEP' ? M.names[l.n - 1] : null;      // (the disc's other plates are in German)
    if (!wspr(plate, 338, 98, 92, 23)) {
      g.fillStyle = l.kind === 'STEP' ? '#2a62d6' : l.kind === 'CHOREOGRAPH' ? '#1e9a44' : '#2a9ad6'; g.fillRect(WX(338) - 138, WY(98) - 34, 276, 69);
      text(l.name.replace(' LESSON', '').replace('Wii Balance Board', 'BALANCE BOARD'), WX(338), WY(98) - 10, fitSize(l.name, 22, 260), '#fff', 'center');
      text('LESSON', WX(338), WY(98) + 16, 18, '#fff', 'center');
    }
    if (gr) wspr(M.grades && M.grades[GRADE_RANK.indexOf(gr)], 460, 98, 25, 16);
    if (fc && M.crowns) wspr(M.crowns[fc === 5 ? 2 : fc === 4 ? 0 : fc === 3 ? 1 : 3], 441, 92, 24, 21, 0.7, 0.7);
    // arrows to change lesson, BEGIN LESSONS between them, and where we are (n / 15)
    // (Wii, fifo_ddr2_lesson.dff: music select's magenta arrow mus /0/5/0/0, 70 x 70 drawn 42 x 42, at x -45.5 /
    // 241.5, y 147 in 854 x 480 units round the middle - not select_bin's /11/0/0/5)
    const ar = A.img.magenta || M.arrow;
    if (L.length > 1) [[-45.5, -1], [241.5, 1]].forEach(([u, d]) => {
      if (!ar) return text(d < 0 ? '◀' : '▶', 640 + u * 1.5, 580.5, 40, '#ff3ca0', 'center');
      g.save(); g.translate(640 + u * 1.5, 360 + 147 * 1.5); g.scale(d * 63 / ar.width, 63 / ar.height); g.drawImage(ar, -ar.width / 2, -ar.height / 2); g.restore();
    });
    g.save(); g.globalAlpha = l.playable ? 1 : 0.45;
    // (confirming: select_bin CAE 0xc27c60 bn_lesson track 2 - a bounce to 1.1 and back)
    const bb = LEAVE && LEAVE.from === this && LEAVE.ok ? CAE.at(CAE.part('sel', 0xc27c60, 0), 2, caeFrame(LEAVE.t0)) : null, bk = bb ? bb.sx : 1;
    if (!wspr(M.begin, 418, 387, 90, 21, 0.88 * bk, 0.88 * bk)) { g.fillStyle = '#ff3ca0'; g.fillRect(WX(418) - 135, WY(387) - 32, 270, 63); text('Begin Lessons', WX(418), WY(387), 26, '#fff', 'center'); }
    g.restore();
    num28((this.i + 1) + '/' + L.length, WX(558.7), WY(98), 42, 'center', 0.66);      // (Wii: centre x 242.8 units)
    keyHints('Left/Right: lesson    Enter: begin    Esc: back');
  },
  drawList(t, L) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(modeName(MODES.find(m => m.id === 'lesson')), 210, 44, 34, '#fff', 'center');
    if (!L.length) { text(LESSONS ? 'No lessons found on your disc.' : 'Loading...', 640, 360, 22, '#fff', 'center'); return; }
    const done = SAVE.lessons || {};
    const top = Math.max(0, Math.min(this.i - 4, L.length - 10));
    L.slice(top, top + 10).forEach((l, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 56;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : l.kind === 'STEP LESSON' ? 'rgba(20,60,140,0.85)' : l.kind === 'GIMMICK LESSON' ? 'rgba(120,40,140,0.85)' : 'rgba(20,120,90,0.85)';
      g.fillRect(80, y, 440, 48); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(80, y, 440, 48);
      text(l.name, 100, y + 24, 22, '#fff', 'left');
      if (done[lessonKey(l)]) text('CLEAR ' + done[lessonKey(l)], 500, y + 24, 16, '#7dff9a', 'right');
    });
    const l = this.intro || L[this.i];
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(560, 100, 660, 540); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(560, 100, 660, 540);
    text(l.name, 890, 145, 30, '#ffe86a', 'center');
    // the teacher's words (from the disc), wrapped
    const words = (l.words || '').replace(/\s+/g, ' ').trim().split(' ');
    let line = '', y = 205;
    g.font = '20px "Segoe UI", Arial, sans-serif';
    for (const w of words) {
      const tryL = line ? line + ' ' + w : w;
      if (g.measureText(tryL).width > 600 && line) { text(line, 590, y, 20, '#fff', 'left', 'normal'); y += 32; line = w; } else line = tryL;
    }
    if (line) text(line, 590, y, 20, '#fff', 'left', 'normal');
    if (l.kind !== 'STEP LESSON') text('(' + (l.kind === 'GIMMICK LESSON' ? 'gimmick' : 'hand') + ' arrows play as normal arrows for now)', 890, 600, 15, '#ffd23c', 'center', 'normal');
    text(this.intro ? 'Enter: start the lesson   Esc: back' : 'Up/Down: lesson   Enter: OK   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the styles: name, help line, chart type, 2 players or not, and which mats they use
const STYLES = [
  { name: 'SINGLE', sub: '1 player - 1 mat', style: 'single', two: false, mats: [1] },
  { name: 'DOUBLE', sub: '1 player - 2 mats', style: 'double', two: false, mats: [2] },
  { name: '2 PLAYERS', sub: '1 mat each', style: 'single', two: true, mats: [1, 1] },
  { name: '2 PLAYERS DOUBLE', sub: '2 mats each - 4 mats', style: 'double', two: true, mats: [2, 2] },
];
// ---- song select
// Hottest Party's menu pictures, loaded from its disc the first time they're needed
let HP_UI = null;
// (see above) Hottest Party 1's menu pictures
function hpUI() {
  if (HP_UI) return HP_UI;
  const L = (f, i) => { const im = new Image(); im.src = `/api/hpui/${f}/${i}`; return im; };
  const titles = {};
  for (let k = 0; k < 52; k++) titles[k] = L('ddrmodesel', 206 + Math.min(k, 49));
  HP_UI = { header: L('ddrmodesel', 170), curve: L('ddrmodesel', 174), frame: L('ddrmodesel', 183), tile: L('ddrmodesel', 189),
    diff: [195, 196, 197, 198].map(i => L('ddrmodesel', i)), foot: L('ddrmodesel', 199), p1: L('ddrmodesel', 201),
    up: L('ddrmodesel', 43), down: L('ddrmodesel', 44), track: L('ddrmodesel', 193), thumb: L('ddrmodesel', 194),
    sel: L('selcom', 74), grades: [1, 2, 3, 4, 5, 6, 7].map(i => L('selcom', i)), titles };
  return HP_UI;
}
// Hottest Party 2's song select pictures (files/select/selMusic.bin), the same parts as hpUI()
let HP2_UI = null;
// (see above) Hottest Party 2's song select pictures
function hp2SelUI() {
  if (HP2_UI) return HP2_UI;
  const L = i => { const im = new Image(); im.src = '/api/hp2sel/' + i; return im; };
  HP2_UI = { hp2: true, header: L(12), curve: L(16), frame: L(7), tile: L(13), tileOn: L(15),
    diff: [19, 18, 20, 21].map(L), foot: L(22), p1: L(8), sel: L(23), thumb: L(45),
    grades: [31, 30, 29, 28, 25, 26, 27].map(L), info: L(32), titles: {} };
  return HP2_UI;
}
// Hottest Party 3's song select pictures (files/select/selMusic_us.bin; names are entry paths, see hp3.py)
let HP3_UI = null;
// (see above) Hottest Party 3's song select pictures
function hp3SelUI() {
  if (HP3_UI) return HP3_UI;
  const L = p => { const im = new Image(); im.src = '/api/hp3sel/' + p; return im; };
  HP3_UI = { panel: L('0.0.4.0'), arrow: L('0.0.5.0'), logo: L('0.0.7.0'), bubble: L('0.0.8.0'), stage: L('0.0.3.0'),
    sort: L('0.0.9.0'), sortName: L('0.0.10.0'), thumb: L('0.0.11.0'), bigFrame: L('1.0.1'), smallFrame: L('1.1.1'),
    grades: [0, 1, 2, 3, 4, 5, 6].map(i => L('2.0.1.' + i)), feet: [0, 1, 2, 3, 4].map(i => L('2.0.2.' + i)), p1: L('2.0.3.0'),
    bars: [7, 8, 9, 10].map(i => L('2.0.' + i + '.0')), radar: L('3.0.1.0'),
    labels: { AIR: L('3.0.2.0'), CHAOS: L('3.0.3.0'), FREEZE: L('3.0.4.0'), STREAM: L('3.0.5.0'), VOLTAGE: L('3.0.6.0') }, clouds: L('4.0.0.0') };
  return HP3_UI;
}
// the song select looks like Hottest Party 2's
function hp2Sel() { return look('select') === 'hp2'; }
// the foot icon in a colour (cached per colour)
function tintFoot(img, col) {
  if (!tintFoot.cv) tintFoot.cv = document.createElement('canvas');
  if (tintFoot.col === col && tintFoot.src === img) return;
  const c = tintFoot.cv, x = c.getContext('2d');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over';
  tintFoot.col = col; tintFoot.src = img;
}
// Hottest Party's gameplay pictures (data/arrow.bin, gamemes.bin), read from its disc and cut up
// once they've loaded: the arrows (grey arrows on a colour key, coloured the way the key says),
// step zone, freeze arrows, judgments and combo digits, the gauge, style badge and score panel
// the colours Hottest Party writes into the arrows' palette as it plays (read from a Dolphin texture
// dump of the real game): 48 steps round its colour cycle; each step holds the four note colours
// (beat, 8th, 16th, other), 9 shades each from the arrow's edge inwards
const HP_ARROW_PAL = [
  'c66b29de8429ef9c31ffbd39ffe742ffff5affff73ffff84ffffad8c2973a5296bc63963de4a5aff5a52ff734aff944affb542ffce423952c6424ace5a42d67342de8c42dea539d6ce42d6ef42c6ff42b531adad31b5c631b5e731b5ff39adff429cff5294ff5a84ff7373ff',
  'c67329de8c29efad31ffce39ffef4affff63ffff7bffff9cffffb5942963ad3163ce425ae74a52ff6b4aff8442ffa542ffbd42ffe742394ac64a42ce6339ce7b39d69439ceb539cede42c6ff42b5ff52a531adb529a5ce31ade731a5ff399cff428cff5a8cff6b73ff846bff',
  'ce8429de9429e7b539f7de4af7f75affff73ffff8cefffadefffce9c315abd3952d64a52f75a4aff7b42ff8c39ffb542ffd642fff7424242b55a39bd6b39c68c31c6ad39bdc639b5ef42b5ff4aa5ff5a8c299cb5299cd6319cef3194ff428cff4a84ff637bff736bff9c63ff',
  'c68c29d6ad39e7ce42e7e752efff6be7ff84e7ffadd6ffc6c6ffefad394ace4a42e75a42ff7339ff8c39ffad39ffce42ffef42ffff525231ad6b31b58431b59c31adbd39ade7399cff4a94ff5a84ff7373298cc6298cde3184ef397bff4a7bff636bff7b63ff9452ffb552ff',
  'c6a531cebd42cede52d6f76bd6ff84ceff9cc6ffc6b5ffe7adffffb54239d65239ef6b39ff8c31ffa539ffc639ffef42ffff4affff6363319c7b299c9c319cb53194de398cff4a84ff5a7bff6b6bff8463297bc63173de396bef4a6bff5a5aff7b52ff9452ffb54affd642ff',
  'b5ad39bdce4ac6e763bdff7bbdff9cb5ffb5adffde9cffff8cffffc65231de6331ef8431ff9c31ffbd39ffde39ffff4affff5affff7373298c94298cad318cce3984ef427bff5273ff6b6bff845affa552316bce3963de4263ef5a52ff734aff844affad4affce42f7f742f7',
  'adbd4aa5d663adef84a5ff949cffb58cffde8cffff73ffff6bffffc66329de8429ef9c31ffb531ffde42ffff4affff63ffff73ffff9c8c297ba52973c6396bde4a6bff5a5aff7352ff8c52ffad4affce42395ac64a4ad65a4ae77342e78c42efad39e7d642e7ef42d6ff42c6',
  '94c66394de7b8cf79c8cffb57bffd673ffff6bffff5affff5affffc67b29de9429e7b539f7d642f7ef4affff63f7ff84efff9ce7ffbd9c3163bd3963de4a52f75a4aff7342ff8c42ffad42ffce42fff7424a42bd5a39ce7339ce9431cead39cece39c6f742bdff4ab5ff5aa5',
  '8cc6638cde8484ef9c84ffbd7bffde73ffff63ffff5affff52ffffc68429de9c29e7bd39efde42eff752f7ff6befff84e7ffa5d6ffc6a5315abd395ade4a52ff634aff7b42ff9442ffb542ffd642ffff424a39bd6339c67b39ce9431c6b539c6d639bdff42b5ff4aadff5a9c',
  '84ce7384de947befad73ffce6bffef63ffff5affff4affff42f7ffc68c29d6a531dece39dee74ae7ff63e7ff7bdeff9cceffbdbdffd6ad3152ce424ae7524aff7342ff8442ffa539ffce42ffef42ffff425a31b57331bd8431bda531b5c639b5ef39a5ff4aa5ff5294ff6b84',
  '73ce8473de9c6be7bd63f7de5af7f752ffff4affff42efff42e7ffc69c31ceb539d6d64adeef5ad6ff73ceff84ceffadbdffceadfff7b5394ace4a42ef6339ff7b39ff9c39ffb539ffde42ffff42ffff526331ad7b29ad9c31b5b531add639a5f74294ff5294ff637bff7b73',
  '6bc68c63d6a563e7c652e7e74aefff4aefff4aefff42deff42ceffbda531c6bd39cede52ceff63c6ff7bbdff9cb5ffbdadffde9cffffbd4a39d65a39ef6b39ff8c31ffad39ffce39ffef42ffff4affff5a6b29a58429a5a5319cc6319ce74294ff4a84ff5a84ff6b6bff8c63',
  '63c68c63d6ad5ae7ce52e7e74aefff42e7ff42e7ff42d6ff42c6ffb5ad31bdc642c6e752c6ff6bbdff84b5ff9cb5ffc6a5ffe78cffffc64a39de6339ef7339ff9431ffb539ffd639fff742ffff4affff6373299c8c299cad319cc63194ef428cff4a84ff637bff736bff9c63',
  '5ac69c52cebd52d6d64adef742deff39d6ff42d6ff42c6ff42b5ffb5ad39bdce4ab5e763b5ff73b5ff94a5ffb59cffd694fff77bffffc65231de6b31f78431ff9c31ffbd39ffe739ffff4affff5affff6b7b2994942994b5318cd6398cef427bff5a73ff736bff845affad5a',
  '5ac6a54acebd4acede42d6f742d6ff39ceff42c6ff42b5ff42adffadb539b5ce4ab5e76badff7badff9c9cffbd94ffe784ffff73ffffc65a31de7329f78c31ffad31ffc639ffef42ffff52ffff5affff7384298c9c298cbd3184de397bf74a7bff636bff7b63ff9452ffb552',
  '52bda54acebd42cede42ceff42ceff39c6ff42bdff42b5ff42a5ffadb542adce52adef6badff84a5ffa594ffc68cffef7bffff73ffffc65a31de7329ef9431ffad31ffce39fff742ffff52ffff63ffff7b8c298ca52984c63984de4273ff4a73ff6363ff845aff9c52ffbd52',
  '52bda54acebd42cede42ceff42ceff39c6ff42bdff42b5ff42a5ffadb542adce52adef6badff84a5ffa594ffc68cffef7bffff73ffffc65a31de7329ef9431ffad31ffce39fff742ffff52ffff63ffff7b8c298ca52984c63984de4273ff4a73ff6363ff845aff9c52ffbd52',
  '4abdad4ac6c642cee739c6ff39c6ff39bdff42b5ff42adff529cffa5b54aa5d65aa5ef73a5ff8c9cffad8cffce84ffef73ffff6bffffc66331de7b29ef9c31ffb531ffd639fff742ffff5affff6bffff848c2984a52984ce397be74273ff526bff6b63ff845affa54affc642',
  '4ab5ad42bdce39c6e739bdff39bdff39b5ff42adff429cff528cff9cbd4aa5d6639cef7b94ff9494ffb584ffd67bffff6bffff63ffffc66329de8429ef9c31ffbd31ffde42ffff4affff63ffff73ffff8c94297bad297bce3973ef4a6bff5a63ff735aff9452ffad4affce42',
  '42b5b539bdce39bde731b5ff39b5ff39a5ff42a5ff4a94ff5a84ff9cc65294de639cef8494ff9c84ffbd84ffde73ffff63ffff5affffce7329de8429efa531f7c631ffe742ffff52ffff6bf7ff7befff9c9c2973b53173d6396bef4a63ff635aff7b52ff9c4affbd42ffd642',
  '39adb539b5ce39b5e731b5ff39adff39a5ff429cff4a84ff5a7bff94c65a94de6b94f7848cffa57bffc67bffe76bffff5affff5affffce7329de8c29e7ad31f7ce31f7ef42ffff52ffff6befff7be7ffa59c2973bd316bd6426bf74a5aff6b52ff844affa54affbd42ffe742',
  '39adbd31a5d631adef31a5ff399cff398cff4a8cff5273ff6b6bff8cc66384de7384ef947bffb573ffd66bfff763ffff52ffff52ffffc68429d69c29e7b531efde39eff74aefff63efff7bdeff94ceffb5ad3163c63963e74a5aff5a52ff7b4aff8c42ffb542ffd642fff742',
  '319cc62994de319cf73194ff3984ff427bff5273ff6363ff7b5aff7bce7373de8c73efa56bffc663ffe75affff52ffff4affff42f7ffc68c29cea529d6ce39dee74adeff5ad6ff73d6ff94c6ffadb5ffceb5315ace4252e7524aff734aff8442ffa539ffce42ffef42ffff42',
  '298cc6298cde3184ef3184ff427bff4a73ff6363ff735aff8c52ff73ce7b6bde9463e7b55af7d652f7ef4affff4affff42efff42e7ffbd9c29ceb531ced642ceef52ceff6bc6ff84bdffa5b5ffc6a5ffe7bd394ad64a4aef6342ff7b39ff9c39ffb539ffde42ffff42ffff52',
  '298cc62984de3184ef3173ff4273ff5263ff6b5aff7b52ff9c52ff63c68463de9c5ae7bd52efde4aeff74af7ff42efff42e7ff42d6ffbd9c31c6bd39cede4ac6f75ac6ff73bdff8cb5ffada5ffce9cfff7bd424ade5242ef6b39ff8439ffa539ffc639ffef42ffff42ffff52',
  '2973ce2973de316be74263f74a5af76352ff7b4aff9c42efbd42e75ac69452cead4adece4adeef42deff39deff42d6ff42c6ff42b5ffadad31b5ce42b5e752b5ff73adff849cffa59cffce84ffef7bffffc65239de6339f78439ff9c31ffbd39ffde39ffff42ffff52ffff63',
  '2963c6315ace4252de4a4ade6b42e78442dea542d6bd42cee742bd42b5ad39bdc639c6e739c6ff39bdff39b5ff42adff42a5ff5a8cff9cbd429cd65a9cef6b94ff8c8cffad84ffc67bffef63ffff63ffffce6331de8429ef9c31ffb531ffde39ffff42ffff5affff63f7ff84',
  '314ab54242c65242ce6b39c68439bd9c39bdc642b5e742a5ff529c31adb531add631adef31a5ff39a5ff3994ff4a8cff5a7bff6b73ff84c65a84de7384f78c73ffa573ffc663ffef5affff52ffff52ffffc67b29d69429e7b531e7d639efef42efff5ae7ff73d6ff84c6ffad',
  '3942b54a39bd5a39bd7331b59439b5ad39a5d642a5f74a94ff5a84319cbd29a5de319cef3194ff398cff4284ff527bff636bff7b63ff7bc66373de7b73ef9c6bffb563ffd65affff52ffff4affff42ffffc68c29cea529d6c631dede42deff4adeff63d6ff7bc6ff9cb5ffbd',
  '4239ad5a31a56b31ad8c31a5ad399cce398cef4a8cff5273ff6b6b298cc62994de318cf73184ff427bff4a73ff636bff735aff9c52ff6bce7363de8c63e7ad52f7c64af7ef4affff4affff42efff42efffbd9c29c6b531cece39ceef4ac6ff5abdff7bbdff94adffb59cffd6',
  '52319c6b299484319c9c3194bd3984e7427bff5273ff6363ff7b5a2984c6297bde317bef3973ff4a6bff5a5aff7b5aff944affb542ff5ac68452d69c52e7bd4ae7de42eff739efff42e7ff42d6ff42ceffb5a531bdc639b5de4ab5ff5ab5ff73a5ff8ca5ffad94ffce84fff7',
  '63298c73298c943184b5317bce427bf74a6bff6363ff7352ff8c522973ce2973de396be74a63f7525aff7352ff8c4affad42f7c642ef52c68c4acead42d6ce42dee742deff39d6ff42ceff42c6ff52b5ffadad31adce42ade752a5ff6b9cff8494ff9c8cffc67bffe76bffff',
  '63298c7b29849c3184b53173d64273ff5263ff6b5aff7b52ff9c522973c6296bde3963e74a5af75a52f7734aff944af7b542efce42e74ac6944acead42d6ce39d6ef39d6ff39ceff42ceff42bdff52adffa5b531a5ce42a5e7529cff739cff848cffa584ffce73ffef6bffff',
  '6b298484297b9c317bbd3973de426bff5a5aff735aff844affad422963c63163de395ae74a52ef634aef7b42f79c42efbd42e7e742d64abd9c42cebd39ced639cef739ceff39c6ff42bdff42adff52a5ff9cb539a5d64a9cef5a94ff738cff9484ffad7bffd66bfff763ffff',
  '732973942973ad316bce4263ef4a5aff6352ff7b4aff9c42ffbd42315ac6395ad64a52de5a4ade7342e78c42e7ad42dece42cef742c639b5a539bdbd39c6de31bdff39bdff39b5ff42adff4a9cff638cff94bd4294d65294ef6b8cff847bffa57bffc66bffe75affff5affff',
  '84296b9c2963b53963de4a52f75a4aff734aff8c4affad42ffce423152c6394ace524ad66342de7b42d69c39d6bd42cede42bdff42ad39adad31b5ce31b5e731b5ff39adff39a5ff4a9cff5284ff6b7bff8cc64a84de6384f77b7bff9473ffb56bffd663fff752ffff52ffff',
  '8c2963a5315ac63952de4a4aff6342ff8442ff9c42ffbd42ffe742394abd4242ce5a42ce7339ce8c39cea539c6ce42bdef42adff52a531adb529adce31ade731a5ff39a5ff4294ff528cff5a7bff7373ff84c6527bde6b7bf78473ff9c6bffbd5affe75affff4affff42ffff',
  '8c295aad3952ce4252e7524aff6b42ff8439ffad42ffc642ffef42394ab54a42c66339c67339c69439bdb539bdde42b5f742a5ff5a8c31a5b529a5d631a5ef319cff3994ff428cff5284ff6373ff7b6bff7bc65a73de736bef8c6bffad5affc652ffef52ffff4affff42ffff',
  '94315ab5394ace4a4aef5a42ff7b42ff8c39ffb542ffd642fff7423942b55239bd6b39bd8431bd9c39b5bd39ade742a5ff4a9cff5a84319cbd299cd6319cef3194ff428cff4a84ff5a7bff6b6bff8c63ff73c66373de736bef9463ffb552ffd652fff74affff42ffff42ffff',
  '9c314abd394ad65242f76342ff7b39ff9439ffbd42ffde42ffff524239b55a39b56b39b58c31b5ad39b5c639a5ef429cff4a94ff637b299cc62994de3194ef318cff4284ff4a7bff6373ff7363ff9c5aff6bce6363de8463ef9c5affb552ffde4affff4affff42ffff42f7ff',
  '9c314abd4242de5242f76b39ff8439ff9c39ffc642ffe742ffff524a39ad5a31b57331b59431b5b539adce399cf74a94ff5284ff6b732994c62994de318cef3184ff427bff5273ff6b6bff7b5affa55aff63ce6b63de845ae79c52f7bd4affe742ffff42ffff42f7ff42efff',
  'ad394ac64a42e75a39ff7339ff8c39ffad39ffce42ffef42ffff5a4a31ad6331ad7b31ad9431a5b5399cde3994ff4a8cff5a7bff736b298cc6298cde3184f7397bff427bff5a6bff7363ff8452ffad52ff63c6735ade8c52e7ad4af7c642f7ef42ffff42f7ff42efff42e7ff',
  'ad3942ce4a39e76339ff7331ff9439ffb539ffde42fff74affff5a5231a56b29a58431a5a5319cbd3994e74284ff5284ff5a73ff7b632984c62984de3184f73973ff4a6bff6363ff7b5aff9452ffb542ff5ac67352de9452e7b54aefce42efef39efff42efff42deff42ceff',
  'b53939ce5239e76b39ff8431ff9c39ffbd39ffe742ffff4affff635a319c73299c8c319cad3194ce398cef4284ff5a7bff636bff84632984c6297bde3973ef4273ff5263ff6b5aff8452ffa54affbd42ff52c6844ad6944ae7b542e7de42eff739e7ff42e7ff42d6ff42c6ff',
  'b54239ce5a31e76b31ff8c31ffad39ffce39ffef4affff52ffff6b6329947b2994943194b5318cd6427bf74a7bff5a73ff6b63ff8c5a2973c62973de396bef4a63ff5a5aff7352ff8c52ffad42ffce42ff4ac6844acea542debd42dede39e7ff39deff42d6ff42ceff52bdff',
  'bd4a31d66329ef8431ff9431ffb539ffde42ffff52ffff5affff7b6b298c84298ca53184bd317be74273ff526bff6b63ff7b52ffa552296bce316bde3963e74a5af76352f7844aff9c4affbd42f7e742ef42c68c39cead39cece39d6e739d6ff39ceff42c6ff42b5ff5aadff',
  'c65a31de7329ef8c31ffad31ffc639ffef4affff5affff6bffff8473298494297bb5317bce3973ef4a63ff635aff7b5aff944affb5423163c6395ade4a52e75a4aef7342ef8c42f7b542efce42def742d639b59c39c6bd39c6d631c6f739bdff39bdff42b5ff4aa5ff639cff',
  'c66329de7b29f79c31ffb531ffd642ffff52ffff6bffff7bffff9c8429739c2973bd396bde4263f7525aff6b52ff8c4affa542ffc642315ac63952d6524ade6b4ade7b42e79c39e7c642dee742ceff42bd31b5a531bdbd31bdde31b5ff39b5ff39a5ff4aa5ff5294ff6b84ff'];
// Hottest Party 1's play-screen pictures (arrows, step zone, judgments, gauge ...), loaded once
let HP_HUD = null;
function hpHud() {
  if (HP_HUD) return HP_HUD;
  const L = (f, i) => { const im = new Image(); im.src = `/api/hpui/${f}/${i}`; return im; };
  const H2 = HP_HUD = { src: { notes: L('arrow', 0), idx: (() => { const im = new Image(); im.src = '/api/hpidx/arrow/0'; return im; })(), zone: L('arrow', 1), freeze: L('arrow', 33), judge: L('gamemes', 3) },
    gauge: L('arrow', 2), fill: L('arrow', 16), p: [19, 20, 21, 22].map(i => L('arrow', i)), ball: [23, 24, 25, 26].map(i => L('arrow', i)),
    style: L('arrow', 8), single: L('arrow', 11), battle: L('arrow', 12), diff: [3, 4, 5, 6].map(i => L('arrow', i)),
    scoreBox: L('arrow', 10), field: L('arrow', 7), danger: L('arrow', 28),
    ready: L('gamemes', 4), hereWeGo: L('gamemes', 5), cleared: L('gamemes', 6), failed: L('gamemes', 7),
    finished: L('gamemes', 8), gameOver: L('gamemes', 9), go: L('gamemes', 10), ok: false };
  const cut = (img, x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return c; };
  const pixels = (c, fn) => { const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height); fn(d.data, c.width, c.height); x.putImageData(d, 0, 0); return c; };
  const build = () => {
    const S2 = H2.src;
    if (!S2.notes.naturalWidth || !S2.idx.naturalWidth || !S2.zone.naturalWidth || !S2.freeze.naturalWidth || !S2.judge.naturalWidth) return;
    // arrows: 64x64 frames, 8 to a row. Each set of four (left, down, up, right) sits on its own colour;
    // that colour is the arrow's: dark greys take it, light greys go to white, the key itself is see-through
    H2.notes = [];
    for (let set = 0; set < 7; set++) {
      const row = set >> 1, col0 = (set & 1) * 4;
      H2.notes.push([0, 1, 2, 3].map(d => pixels(cut(S2.notes, (col0 + d) * 64, row * 64, 64, 64), (p, w, h) => {
        const k = [p[4 + 4 * w], p[5 + 4 * w], p[6 + 4 * w]];
        for (let i = 0; i < p.length; i += 4) {
          if (p[i] === k[0] && p[i + 1] === k[1] && p[i + 2] === k[2]) { p[i + 3] = 0; continue; }
          const v = p[i] / 255;
          for (let c = 0; c < 3; c++) p[i + c] = k[c] * (1 - v) + 255 * v;
        }
      })));
    }
    // step zone: the plain grey arrows (the first set, without its colour); pressing lights the white shape
    // the arrows' palette numbers: each set of four uses its own 16 colours (set k = colours 16k..16k+15)
    H2.ix = [];
    for (let set = 0; set < 6; set++) {
      const row = set >> 1, col0 = (set & 1) * 4;
      H2.ix.push([0, 1, 2, 3].map(d => { const c = cut(S2.idx, (col0 + d) * 64, row * 64, 64, 64), p = c.getContext('2d').getImageData(0, 0, 64, 64).data, a = new Uint8Array(4096); for (let i = 0; i < 4096; i++) a[i] = p[i * 4] & 15; return a; }));
    }
    // step zone: the game's grey set (edge light grey, see-through middle, greys 74..140); lit: the lighter greys
    const greys = (lo, edge) => { const t = [null, [edge, edge, edge], null, null, null]; for (let i = 0; i < 9; i++) t.push([lo + 8 * i, lo + 8 * i, lo + 8 * i]); return t; };
    H2.zone = [0, 1, 2, 3].map(d => hpPaint(H2.ix[4][d], greys(74, 231)));
    H2.zoneOn = [0, 1, 2, 3].map(d => hpPaint(H2.ix[5][d], greys(173, 231)));
    H2.zoneLit = [0, 1, 2, 3].map(d => cut(S2.zone, d * 64, 0, 64, 64));
    // freeze arrows: four 64-wide columns, the head on top, then the body down to its tail; black is see-through
    const clear = (p) => { for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]); if (m < 40) p[i + 3] = m * 6; } };
    H2.frzHead = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 0, 64, 64), clear));
    H2.frzBody = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 128, 64, 256), clear));
    H2.frzTail = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 384, 64, 64), clear));
    // judgments and digits (the sheet's own rectangles)
    const J = S2.judge;
    H2.digits = [...Array(10)].map((_, i) => cut(J, i * 56, 0, 56, 56));
    H2.judge = { MARVELOUS: cut(J, 0, 280, 412, 56), PERFECT: cut(J, 0, 56, 512, 56), GREAT: cut(J, 0, 112, 280, 56),
      GOOD: cut(J, 283, 112, 224, 56), ALMOST: cut(J, 224, 168, 250, 56), BOO: cut(J, 0, 168, 224, 56),
      COMBO: cut(J, 0, 224, 224, 56), OK: cut(J, 224, 224, 128, 56), NG: cut(J, 352, 224, 128, 56) };
    H2.ok = true;
  };
  for (const k in H2.src) H2.src[k].addEventListener('load', build);
  return H2;
}
// one 64x64 arrow from its palette numbers and a 16-colour table ([r,g,b] or null = see-through)
function hpPaint(ix, tab, into) {
  const c = into || document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), d = x.createImageData(64, 64), p = d.data;
  for (let i = 0; i < 4096; i++) { const col = tab[ix[i]]; if (col) { p[4 * i] = col[0]; p[4 * i + 1] = col[1]; p[4 * i + 2] = col[2]; p[4 * i + 3] = 255; } }
  x.putImageData(d, 0, 0);
  return c;
}
// the note arrows as they look now: the colour cycle goes round once a measure, and the white bar in
// the middle lights up in three steps (all, two, one, none) through each beat
function hpNotes(hp, measurePhase, beat) {
  const N = HP_ARROW_PAL.length, step = Math.floor((1 - measurePhase) * N + N) % N, flash = Math.min(3, Math.floor(beat * 4));
  const key = step * 4 + flash;
  if (hp.notesKey === key) return hp.notesNow;
  const row = HP_ARROW_PAL[step], W8 = [255, 255, 255], G8 = [82, 82, 82];
  const lit = [[1, 1, 1], [1, 1, 0], [1, 0, 0], [0, 0, 0]][flash];
  if (!hp.notesNow) hp.notesNow = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => document.createElement('canvas')));
  for (let b = 0; b < 4; b++) {
    const tab = [null, [8, 8, 8], lit[0] ? W8 : G8, lit[1] ? W8 : G8, lit[2] ? W8 : G8];
    for (let i = 0; i < 9; i++) { const o = (b * 9 + i) * 6; tab.push([parseInt(row.substr(o, 2), 16), parseInt(row.substr(o + 2, 2), 16), parseInt(row.substr(o + 4, 2), 16)]); }
    for (let d = 0; d < 4; d++) hpPaint(hp.ix[b][d], tab, hp.notesNow[b][d]);
  }
  hp.notesKey = key;
  return hp.notesNow;
}
// Hottest Party 2's gameplay screen (files/game/gui.tpl): the gold gauge, STYLE badge and score panel,
// its judgments, combo digits and banners (its arrows look like Hottest Party 1's, which are used)
let HP2_HUD = null;
// (see above) Hottest Party 2's play-screen pictures
function hp2Hud() {
  if (HP2_HUD) return HP2_HUD;
  const L = i => { const im = new Image(); im.src = '/api/hp2gui/' + i; return im; };
  const H2 = HP2_HUD = { gauge: L(0), score: L(15), style: L(20), single: L(19), diff: [11, 12, 13, 14].map(L),
    ball: [23, 24, 25, 26].map(L), danger: L(22), ready: L(32), hereWeGo: L(31), finished: L(30), failed: L(29),
    cleared: L(30), go: L(31), sheet: L(28), ok: false };
  H2.sheet.addEventListener('load', () => {
    const J = H2.sheet, cut = (x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(J, x, y, w, h, 0, 0, w, h); return c; };
    H2.digits = [...Array(10)].map((_, i) => cut(i * 56, 0, 56, 56));
    H2.judge = { PERFECT: cut(99, 56, 318, 56), GREAT: cut(28, 112, 228, 56), GOOD: cut(310, 112, 178, 56),
      BOO: cut(52, 168, 121, 56), ALMOST: cut(243, 168, 220, 56), COMBO: cut(18, 224, 202, 56),
      OK: cut(227, 224, 123, 56), NG: cut(354, 224, 125, 56), MARVELOUS: cut(7, 280, 400, 56) };
    H2.ok = true;
  });
  return H2;
}
// a colour cycling through the rainbow with time
function rainbowAt(t) { return `hsl(${(t * 120) % 360},100%,60%)`; }
// the dancers' names (the disc's name plates, select_bin_us.bin /2/2/0/0) by file id (CHR201-209 = game ids
// 200-208, the order the unlock table gives their outfits: EMI 200, DISCO 201, RUBY 202, YUNI 203, RAGE 204)
const DDR2_CHAR_NAMES = { '201': 'EMI', '202': 'DISCO', '203': 'RUBY', '204': 'YUNI', '205': 'RAGE', '206': 'Rena', '207': 'NAOKI', '208': 'jun', '209': 'U1' };
// MY CHARACTER: the Wii's 3 x 3 pages (Wii footage): page 1 = RANDOM ALL / RANDOM girls / RANDOM boys,
// Mii, EMI, DISCO, YUNI, RAGE, RUBY; page 2 = Rena, NAOKI, jun, U1, then empty slots. Locked dancers
// show ???. DDR II PC has no Mii, so that slot can't be picked. Each dancer is a black box with the
// name (no portraits, and no 3D dancer on the left).
const MYCHAR_PAGES = [['random', 'randomF', 'randomM', 'mii', '201', '202', '204', '205', '203'], ['206', '207', '208', '209', null, null, null, null, null]];
// HP4's SELECT CHARACTER (select_bin group 2): its 16 faces (/2/3/0/0: Rena, Chordia, Dyna, Bridget, Ceja, U1,
// jun, NAOKI, U.G., Root, Harmony, Mii, Bossa, Nova, Hip, Hop, then RANDOM ALL / female / male) with the names
// /2/1/0/3 in the same order, 12 to a board (3 x 4). The faces' order is taken as the dancers' file order
// (face 0 = Rena = CHR61 - checked; the rest follow, Mii left out: an assumption, not traced in main.dol).
const HP4_NAMES = ['Rena', 'Chordia', 'Dyna', 'Bridget', 'Ceja', 'U1', 'jun', 'NAOKI', 'U.G.', 'Root', 'Harmony', 'Mii', 'Bossa', 'Nova', 'Hip', 'Hop', 'RANDOM ALL', 'RANDOM \u2640', 'RANDOM \u2642'];
// HP4's MY CHARACTER faces in order (the character's file number), split over two pages
const HP4_FACES = ['61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', 'mii', '72', '73', '74', '75', 'random', 'randomF', 'randomM'];
const HP4_MYCHAR_PAGES = [HP4_FACES.slice(0, 12), HP4_FACES.slice(12).concat([null, null, null, null, null])];
// MY CHARACTER screen: pick your dancer
const MyChar = {
  bgm: 'MU_BGM_FREE',
  pages() { return HP4 ? HP4_MYCHAR_PAGES : MYCHAR_PAGES; },
  enter() {
    this.page = 0; this.cur = 0; this.at = performance.now(); if (HP4) CAE.load('sel');
    const at = this.pages().findIndex(p => p.includes(S.ddr2Char));
    if (at >= 0) { this.page = at; this.cur = this.pages()[at].indexOf(S.ddr2Char); }
    if (!DDR2_CHARS) api('/api/ddr2chars').then(c => { DDR2_CHARS = c || []; }).catch(() => { DDR2_CHARS = []; });
  },
  item(k) { return this.pages()[this.page][k]; },
  locked(v) { return /^\d+$/.test(v || '') && ddr2CharLockedAt(+v - 1, 0) > 0; },
  usable(v) { return !!v && v !== 'mii' && !this.locked(v) && (!/^\d+$/.test(v) || !DDR2_CHARS || DDR2_CHARS.some(c => c.id === v)); },
  label(v) {
    if (!v) return '';
    if (v === 'random') return 'RANDOM ALL';
    if (v === 'randomF') return 'RANDOM ♀';
    if (v === 'randomM') return 'RANDOM ♂';
    if (v === 'mii') return 'Mii';
    if (HP4) return HP4_NAMES[HP4_FACES.indexOf(v)] || v;
    return this.locked(v) ? '???' : DDR2_CHAR_NAMES[v] || v;
  },
  input(a, p) {
    if (!p) return;                                   // (key releases come here too: only presses move)
    const r = Math.floor(this.cur / 3), c = this.cur % 3, rows = HP4 ? 4 : 3, PG = this.pages();
    if (a === 'P1L' || a === 'P2L') {
      if (c > 0) this.cur--; else if (this.page > 0) { this.page--; this.cur = r * 3 + 2; } else return;
      sfx('SE_SYS_SELECT01');
    } else if (a === 'P1R' || a === 'P2R') {
      if (c < 2) this.cur++; else if (this.page < PG.length - 1) { this.page++; this.cur = r * 3; } else return;
      sfx('SE_SYS_SELECT01');
    } else if (a === 'P1U' || a === 'P2U') { if (r > 0) { this.cur -= 3; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D' || a === 'P2D') { if (r < rows - 1) { this.cur += 3; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const v = this.item(this.cur);
      if (!this.usable(v)) { sfx('SE_SYS_ERROR'); return; }
      sfx('SE_SYS_DECIDE01');
      S.ddr2Char = v; saveSettings();
      Promise.resolve().then(() => ddr2Dancer()).catch(() => {});
      go(Select);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Select); }
  },
  // HP4: block 12 the screen (title, "DANCER" plate (160, 374) with the name (160, 404), page arrows (254 / 575,
  // 240)), block 14 the board (282 x 360, its 12 places 85 apart around the middle), block 13 one face in its
  // frame. (The board's own place isn't in the layouts: put between the arrows, at (414, 250).)
  drawHp4(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.faces, H4.names, H4.board, H4.frame] = await Promise.all(['/2/3/0/0', '/2/1/0/3', '/2/4/0/1', '/2/3/0/1'].map(one));
      H4.ok = true;
    })();
    if (!H4.ok || !CAE.block('sel', 12) || !CAE.block('sel', 14)) { CAE.load('sel'); return false; }
    menuBackground(t);
    const f = Math.min(caeFrame(this.at || 0), 31), v = this.item(this.cur), fi = HP4_FACES.indexOf(v);
    CAE.draw('sel', 12, 0, f, { skip: new Set([this.page > 0 ? -1 : 5, this.page < this.pages().length - 1 ? -1 : 6]),
      pic: (i, p) => i === 1 ? (fi >= 0 ? H4.names[fi < 16 ? fi : fi] : null) : null });
    const BX = 414, BY = 250;
    wspr(H4.board[0], BX, BY, 141, 180);
    for (let k = 0; k < 12; k++) {
      const w = this.item(k), x = BX + (k % 3 - 1) * 85, y = BY + [-128, -43, 42, 127][Math.floor(k / 3)];
      if (!w) continue;
      const on = k === this.cur, sc = on ? 1 : 0.85, face = H4.faces[HP4_FACES.indexOf(w)];
      // (the chosen face's green frame lies behind it: block 13 depth 4 vs the face's 3)
      if (on) wspr(H4.frame[0], x, y, 50, 50, 0.95 + 0.04 * Math.sin(t * 6), 0.95 + 0.04 * Math.sin(t * 6));
      wspr(face, x, y, 40, 40, sc, sc);
    }
    keyHints('Arrows: select    Enter: confirm    Esc: back');
    return true;
  },
  draw(t) {
    if (HP4) { if (this.drawHp4(t)) return; this.at = performance.now(); menuBackground(t); return; }   // (first visit: just the background while the disc's pictures load, not DDR II's screen for a moment)
    menuBackground(t);
    // title bar
    withMenuIn('title', () => {
      g.fillStyle = '#1f6fd0'; g.fillRect(400, 10, 480, 64);
      g.fillStyle = '#3b8ff0'; g.fillRect(406, 14, 468, 56);
      text('MY CHARACTER', 640, 44, 34, '#fff', 'center');
    });
    // the grid: a blue panel, 3 x 3 boxes, the cursor's in an orange frame
    const gx = 690, gy = 150, cs = 132, gap = 12, pw = 3 * cs + 4 * gap;
    g.fillStyle = '#2a6fd0'; g.fillRect(gx - gap, gy - gap, pw, pw);
    for (let k = 0; k < 9; k++) {
      const v = this.item(k), x = gx + (k % 3) * (cs + gap), y = gy + Math.floor(k / 3) * (cs + gap);
      if (!v) { g.fillStyle = '#b8c4cc'; g.fillRect(x, y, cs, cs); g.fillStyle = '#dfe6ea'; g.fillRect(x + 14, y + 14, cs - 28, cs - 28); continue; }
      const rnd = v === 'random' || v === 'randomF' || v === 'randomM';
      g.fillStyle = v === 'random' ? '#2bb7a4' : v === 'randomF' ? '#e86ab8' : v === 'randomM' ? '#2b7fe0' : v === 'mii' ? '#1a8a78' : '#000';
      g.fillRect(x, y, cs, cs);
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      const lb = this.label(v);
      text(lb, x + cs / 2, y + cs / 2, fitSize(lb, rnd ? 20 : 24, cs - 16), v === 'mii' ? 'rgba(255,255,255,0.45)' : '#fff', 'center');
      if (k === this.cur) { g.strokeStyle = '#ff6a10'; g.lineWidth = 8; g.strokeRect(x - 6, y - 6, cs + 12, cs + 12); }
    }
    // the pink page arrows either side of the panel
    const ay = gy + pw / 2 - gap;
    const tri = (x, dir) => { g.fillStyle = '#ff28c8'; g.beginPath(); g.moveTo(x, ay); g.lineTo(x - dir * 34, ay - 30); g.lineTo(x - dir * 34, ay + 30); g.closePath(); g.fill(); };
    if (this.page > 0) tri(gx - gap - 54, -1);
    if (this.page < MYCHAR_PAGES.length - 1) tri(gx - gap + pw + 54, 1);
    // the name box (bottom left)
    const v = this.item(this.cur), nm = this.label(v);
    g.fillStyle = '#1f6fd0'; g.fillRect(290, 560, 260, 70); g.fillStyle = '#3b8ff0'; g.fillRect(296, 566, 248, 58);
    if (nm) text(nm, 420, 596, fitSize(nm, 30, 230), '#fff', 'center');
    // the buttons
    text('Enter CONFIRM    Esc BACK    Arrows SELECT', 1240, 690, 18, '#fff', 'right');
  },
};

// SELECT MUSIC: the song list, SHORT / FULL, SELECT DIFFICULTY and everything opened from it
const Select = {
  idx: 0, moved: 0, previewFor: -1, previewSrc: null, previewGain: null, previewCache: new Map(),
  // hold left / right (keys or a mat panel) to keep scrolling: a pause, then faster and faster
  held: 0, heldSince: 0, nextRep: 0, reps: 0,
  update() {
    const now = performance.now();
    if (this.okAt && now - this.okAt > 450) { this.launch(); return; }
    if (this.stage || this.join || this.typing !== null || !this.order || this.order.length < 2) { this.held = 0; return; }
    const hpm = hpLike();
    const key = { L: hpm ? 'Up' : 'Left', R: hpm ? 'Down' : 'Right' }, pad = { L: hpm ? 'U' : 'L', R: hpm ? 'D' : 'R' };
    const side = d => ['P1', 'P2', 'P3', 'P4'].some(p => input.isDown(p + pad[d])) || !!input.down['k:Arrow' + key[d]];
    const d = side('L') && !side('R') ? -1 : side('R') && !side('L') ? 1 : 0;
    if (d !== this.held) { this.held = d; this.heldSince = now; this.nextRep = now + 380; this.reps = 0; return; }
    if (d && now >= this.nextRep) {
      this.move(d); sfx('SE_SYS_SELECT01');
      this.reps++; this.nextRep = now + (this.reps < 6 ? 110 : 65);
    }
  },
  enter() {
    this.okAt = 0; this.slot = 4; this.enteredAt = performance.now();
    if (HP4) CAE.load('mus');
    if (!SONGS.length) return;
    // a custom song played last time: come back inside its folder
    const last = S.lastSlot && SONGS.find(s => (s.custom || s.disc) && s.slot === S.lastSlot);
    if (last && this.inFolder === undefined) this.inFolder = last.folder;
    this.buildOrder();
    this.order = this.filtered(this.query);
    if (!this.order.length) { this.query = ''; this.order = this.fullOrder; }   // the songs changed under the search
    this.typing = null; this.stage = null;
    this.idx = Math.min(this.idx, this.order.length - 1);
    if (S.lastSlot) { const i = this.order.findIndex(s => s.slot === S.lastSlot || s.full === S.lastSlot || (s.alt && s.alt.slot === S.lastSlot)); if (i >= 0) this.idx = i; }
    // otherwise start on the game's first song, not on RANDOM or another game's folder
    if (this.order[this.idx] && (this.order[this.idx].folderTile || this.order[this.idx].random) && !this.inFolder) {
      const i = this.order.findIndex(s => !s.folderTile && !s.random); if (i >= 0) this.idx = i;
    }
    this.fixDiff();
    this.moved = performance.now();
  },
  leave() { this.stopPreview(); this.typing = null; },
  // the list: RANDOM, then a tile for each of your custom folders, then the game's songs
  // (Replicant D-action together at the end, in the game's order). Inside a folder: just its songs.
  inFolder: undefined,
  buildOrder() {
    // in Double, songs with no Double charts are left out
    const ok = s => !isLocked(s) && (styleNow() !== 'double' || hasDouble(s));
    const all = SONGS.filter(ok), gm = gameNow();
    // the game's own songs straight in the list; every other game's songs and your custom songs each
    // get a folder (DDR II, HOTTEST PARTY, HOTTEST PARTY 2, then your folders)
    const homeDisc = gm === 'hp' || gm === 'hp2' || gm === 'hp3' ? gm : null;
    let home = all.filter(s => !s.custom && (homeDisc ? s.disc === homeDisc : !s.disc));
    if (!homeDisc) home = home.filter(s => rdaIndex(s) < 0).concat(home.filter(s => rdaIndex(s) >= 0).sort((a, b) => rdaIndex(a) - rdaIndex(b)));
    const away = all.filter(s => !home.includes(s));
    const groups = ['DANCE DANCE REVOLUTION II', 'HOTTEST PARTY', 'HOTTEST PARTY 2', 'HOTTEST PARTY 3'].filter(f => away.some(s => folderOf(s) === f))
      .concat([...new Set(away.filter(s => s.disc).map(s => s.folder))].filter(f => !['HOTTEST PARTY', 'HOTTEST PARTY 2', 'HOTTEST PARTY 3'].includes(f)), CUSTOM_FOLDERS);
    this.allSongs = home.concat(away);                  // what a search looks through
    if (this.inFolder) {
      this.fullOrder = away.filter(s => folderOf(s) === this.inFolder);
      if (!this.fullOrder.length) this.inFolder = null;
      else return;
    }
    const tiles = [...new Set(groups)].map(f => ({ folderTile: true, folder: f, disc: away.some(s => !s.custom && folderOf(s) === f), slot: 'folder:' + f, name: f, artist: '',
      count: away.filter(s => folderOf(s) === f).length, bpm: ['---', '---'], length: 0,
      single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null }));
    if (HP4 && !this.inFolder) {
      if (this.hp4List === 'course') {                 // COURSE MUSIC's list: the courses, then its tiles
        // (the ten courses only - the workouts, 0x79 + n, are WORKOUT MODE's list - each opened one at its own cell)
        const D = DDR2_COURSES || {}, N = D.names || [];
        const cs = (D.courses || []).map((sl, n) => ({ n, c: { name: N[n] ? N[n].toUpperCase() : 'COURSE ' + (n + 1), all: sl, slots: sl.filter(x => songForSlot(x)) } }))
          .filter(({ c }) => c.slots.length && (S.unlocks !== 'on' || SAVE.points >= courseUnlockAt(c.all)))
          .map(({ n, c }) => Object.assign(sysTile('hp4course', c.name, 0x6f + n), { course: c }))
          .concat(myOrders().map((o, k) => Object.assign(sysTile('hp4course', 'ORDER ' + (k + 1), 0x8b + k), { course: { name: 'ORDER ' + (k + 1), slots: o, mine: k } })));
        this.fullOrder = cs.concat([HP4T.records, HP4T.options, HP4T.orderEdit, HP4T.free, HP4T.stage]);
      } else this.fullOrder = (home.length ? home : away).concat(tiles, SAVE && (SAVE.points || 0) < 10000000 ? [HP4T.ctask] : [], [HP4T.records, HP4T.options], S.mode === 'free' && !BATTLE && !P2 ? [HP4T.course] : [], [HP4T.stage], window.Dancer3D ? [HP4T.dancers] : []);
      return;
    }
    // DDR II's own row before the songs (Wii): OPTIONS, COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM
    const sys = hpLike() ? [] : [OPTIONS_TILE].concat(S.mode === 'free' && !BATTLE && !GC && styleNow() !== 'double' && !P2 ? [COURSE_TILE] : [],
      window.Dancer3D ? [MYCHAR_TILE] : [], [FAV_TILE]);
    this.fullOrder = sys.concat([RANDOM_SONG], tiles, home.length ? home : away, hpLike() || HP4 ? [] : [MCC_TILE]);
  },
  // HP4's list switches (COURSE MUSIC <-> FREE MUSIC): the new list, cursor on its first entry
  hp4Switch(list) {
    sfx('SE_SYS_DECIDE01'); this.hp4List = list; this.query = ''; this.favOnly = false; this.recView = 0;
    this.buildOrder(); this.order = this.fullOrder; this.idx = 0; this.slot = 0; this.scrolled = true;
    this.moved = performance.now(); this.stopPreview && this.stopPreview(); this.fixDiff();
  },
  openFolder(tile) {
    if (HP4 && tile.special === 'course') { loadDdr2Courses().then(() => this.hp4Switch('course')); return; }
    if (HP4 && tile.special === 'free') { this.hp4Switch(null); return; }
    if (HP4 && tile.special === 'orderedit') { sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview(); OrderEdit.back = Select; go(OrderEdit.with(null)); return; }
    if (HP4 && tile.special === 'stage') {
      const i = HP4_STAGE_LIST.indexOf(S.hp4Stage === 'random' ? 8 : +S.hp4Stage);
      this.stgPick = { i: i < 0 ? 0 : i, at: performance.now() }; sfx('SE_SYS_WINDOWIN'); return;
    }
    if (HP4 && tile.special === 'ctask') { sfx('SE_SYS_WINDOWIN'); this.taskWin = performance.now(); return; }
    // RECORDS (exit 6): first the player select in its record mode (0x8010a35c with +0x8e0 = 1: one player, only
    // the record slots - no GUEST / EDIT - and its own help line), then the song select as SELECT RECORD (mode
    // data +0x71c = 1); B there goes back to the songs without it (+0x71c = 0). On again: back to the songs.
    if (HP4 && tile.special === 'records') {
      sfx('SE_SYS_DECIDE01');
      if (this.records) { this.records = false; this.recView = 0; return; }
      this.stopPreview && this.stopPreview(); Players.recMode = true; go(Players.with(Select, Select)); return;
    }
    if (HP4 && tile.special === 'hp4course') {
      const c = tile.course, songs = c.slots.map(sl => songForSlot(sl)).filter(Boolean);
      if (!songs.length) { sfx('SE_SYS_ERROR'); return; }
      sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview();
      S.style = 'single'; P2 = null;
      COURSE = { name: c.name, slots: c.slots.filter(sl => songForSlot(sl)), diff: S.diff, i: 0, life: [], scores: [], failed: false };
      startCourseSong(); return;
    }
    if (tile.myChar) { sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview(); go(MyChar); return; }
    if (tile.special === 'options') { sfx('SE_SYS_WINDOWIN'); this.stopPreview && this.stopPreview(); Options.keep = false; Options.from = Select; go(Options); return; }
    if (tile.special === 'mcc') {                         // the best total of the record style (PC: Up / Down = the Wii's 1 button)
      const st = this.mccSt || 0, best = ((SAVE.mccBest || {})[st]) || 0;
      sfx('SE_SYS_WINDOWIN'); this.stopPreview && this.stopPreview(); go(MCCWin.with([{ kind: 'record', total: best, style: st }], Select)); return;
    }
    if (tile.special === 'course') { sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview(); CourseSel.fromSelect = true; go(CourseSel); return; }
    if (tile.special === 'fav') {                         // your favorite songs only (BACK: the whole list again)
      if (!this.fullOrder.some(s => isFav(s))) { this.note = 'No favorites yet - press Q to star a song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
      sfx('SE_SYS_DECIDE01'); this.favOnly = true; this.order = this.filtered(this.query = ''); this.idx = 0;
      this.moved = performance.now(); this.stopPreview && this.stopPreview(); this.fixDiff(); return;
    }
    if (!tile.count) { this.note = 'The folder "' + tile.folder + '" is empty - import songs into it from Custom Songs'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
    sfx('SE_SYS_DECIDE01');
    this.inFolder = tile.folder; this.query = ''; this.favOnly = false;
    this.buildOrder(); this.order = this.fullOrder;
    this.idx = 0; this.slot = 0; this.lastDir = 1; this.scrolled = false;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  closeFolder() {
    const f = this.inFolder;
    sfx('SE_SYS_WINDOWOUT');
    this.inFolder = null; this.query = ''; this.favOnly = false;
    this.buildOrder(); this.order = this.fullOrder;
    const i = this.order.findIndex(s => s.folderTile && s.folder === f);
    this.idx = i >= 0 ? i : 0; this.slot = Math.min(4, this.idx); this.lastDir = -1; this.scrolled = true;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  // ---- search: song name, artist, or custom folder; every word typed has to match
  query: '', typing: null,
  hay(s) {
    if (!s._hay) s._hay = [s.name, s.artist, s.folder, s.alt && s.alt.name].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return s._hay;
  },
  filtered(q) {
    const words = (q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    // favorites and searches look through every song, folders included
    const every = this.inFolder ? this.fullOrder : (this.allSongs || this.fullOrder);
    const base = this.favOnly ? every.filter(s => isFav(s)) : words.length ? every : this.fullOrder;
    if (!words.length) return base;
    return base.filter(s => { const h = this.hay(s), hs = h.replace(/ /g, ''); return words.every(w => h.includes(w) || hs.includes(w)); });
  },
  applySearch(q) {
    const cur = this.order && this.order[this.idx];
    const list = this.filtered(q);
    if (!list.length) { this.noMatch = true; return; }        // keep showing the last results
    this.noMatch = false;
    this.query = q; this.order = list;
    const i = cur ? list.indexOf(cur) : -1;
    this.idx = i >= 0 ? i : 0;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  // the selected song in the chosen version (SHORT tab = the game's cut version)
  song() {
    const s = this.order[this.idx];
    if (!s) return s;
    // (in Double only the versions with Double charts count: a song whose short or full version has none
    // shows the other one)
    const dbl = v => (v.double || []).some(x => x > 0), dblOnly = styleNow() === 'double' && s.alt && !s.folderTile;
    let short = !!(S.short && s.alt);
    if (dblOnly && !dbl(short ? s.alt : s)) short = !short;
    if (short) return Object.assign({}, s, s.alt, { isShort: true, movie: s.movie });   // the short version keeps the song's video
    return Object.assign({}, s, { isShort: !!s.short });
  },
  hasBoth() {
    const s = this.order[this.idx];
    if (!(s && s.alt)) return false;
    if (styleNow() !== 'double') return true;
    const dbl = v => (v.double || []).some(x => x > 0);
    return dbl(s) && dbl(s.alt);
  },
  validDiff(diff) {
    const lv = levelsOf(this.song());
    if (lv[DIFFS.findIndex(d => d[0] === diff)]) return diff;
    const ok = DIFFS.find((d, i) => lv[i]);
    return ok ? ok[0] : diff;
  },
  fixDiff() {
    S.diff = this.validDiff(S.diff);
    if (P2) P2.diff = this.validDiff(P2.diff);
  },
  lastDir: 0,
  // like the game, the cursor walks along the row of jackets; the row only scrolls at its ends
  slot: 4,
  move(d) {
    this.lastDir = d;
    const ns = this.slot + d;
    this.scrolled = ns < 0 || ns > 8;
    this.slot = Math.max(0, Math.min(8, ns));
    this.idx = (this.idx + d + this.order.length) % this.order.length;
    this.moved = performance.now();
    this.stopPreview();
    this.fixDiff();
  },
  stepDiff(cur, d) {
    const lv = levelsOf(this.song());
    let i = DIFFS.findIndex(x => x[0] === cur);
    for (let k = 0; k < DIFFS.length; k++) { i = Math.max(0, Math.min(DIFFS.length - 1, i + d)); if (lv[i]) break; }
    return lv[i] ? DIFFS[i][0] : cur;
  },
  changeDiff(d, who = 0) {
    if (who === 1 && P2 && !GROUP) { P2.diff = this.stepDiff(P2.diff, d); return; }
    if (who >= 2 && PX[who - 2] && !GROUP) { PX[who - 2].diff = this.stepDiff(PX[who - 2].diff, d); return; }
    const n = this.stepDiff(S.diff, d);
    if (n !== S.diff) { S.diff = n; saveSettings(); }
    if (GROUP && P2) P2.diff = S.diff;            // FRIENDSHIP / SYNC: everyone dances the same chart
    if (GROUP) PX.forEach(x => { if (x) x.diff = S.diff; });
  },
  // player 2 joins (or changes who they are / leaves): a small list of user data
  openJoin() {
    if (BATTLE) return;          // BATTLE MODE: player 2 is the computer
    const names = Object.keys(DATA.profiles).filter(n => n !== DATA.current);
    const list = ['GUEST', ...names];
    if (P2) list.push('1 PLAYER ONLY');
    this.join = { list, i: Math.max(0, P2 ? list.indexOf(P2.name || 'GUEST') : 0) };
    sfx('SE_SYS_WINDOWIN');
  },
  joinInput(a) {
    const j = this.join, n = j.list.length;
    if (/^P[12]U$/.test(a)) { j.i = (j.i + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (/^P[12]D$/.test(a)) { j.i = (j.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START' || a === 'P2START') {
      const pick = j.list[j.i];
      if (pick === '1 PLAYER ONLY') P2 = null;
      else {
        const name = pick === 'GUEST' ? null : pick, prof = name && DATA.profiles[name];
        const want = prof && prof.opts && prof.opts.diff !== undefined ? prof.opts.diff : (P2 ? P2.diff : S.diff);
        P2 = { name, diff: want };
      }
      this.join = null; this.fixDiff(); sfx('SE_SYS_DECIDE01');
    } else if (a === 'BACK') { const back = this.join.fromStyle && !P2; this.join = null; sfx('SE_SYS_WINDOWOUT'); if (back) go(Style); }
  },
  key(e) {
    if (this.typing !== null) {                          // typing a search
      e.preventDefault();
      if (e.code === 'Escape') { this.typing = null; this.noMatch = false; this.applySearch(''); sfx('SE_SYS_WINDOWOUT'); return; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.typing = null; this.noMatch = false; sfx('SE_SYS_DECIDE01'); return; }
      if (e.code === 'Backspace') this.typing = this.typing.slice(0, -1);
      else if (e.key.length === 1 && this.typing.length < 30) this.typing += e.key;
      else return;
      this.applySearch(this.typing);
      return;
    }
    if (this.stage) return;
    if (e.code === 'KeyQ' && !e.repeat && !this.join) {        // star / unstar this song
      const s = this.order[this.idx];
      if (!s || s.random || s.folderTile) return;
      const on = toggleFav(s);
      sfx(on ? 'SE_SYS_DECIDE02' : 'SE_SYS_WINDOWOUT');
      this.note = on ? '★ Added to your favorites' : 'Removed from your favorites'; this.noteAt = performance.now();
      if (this.favOnly && !on) { const list = this.filtered(this.query); if (list.length) { this.order = list; this.idx = Math.min(this.idx, list.length - 1); this.fixDiff(); } else { this.favOnly = false; this.applySearch(this.query); } }
      return;
    }
    if (e.code === 'KeyW' && !e.repeat && !this.join) {        // favorites only, and back
      const want = !this.favOnly;
      if (want && !this.fullOrder.some(s => isFav(s))) { this.note = 'No favorites yet - press Q to star a song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
      this.favOnly = want; const cur = this.order[this.idx];
      let list = this.filtered(this.query);
      if (!list.length) { this.query = ''; list = this.filtered(''); }
      this.order = list; const i = list.indexOf(cur); this.idx = i >= 0 ? i : 0;
      this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02');
      return;
    }
    if ((e.key === '/' || e.code === 'KeyS') && !e.repeat && !this.join) { e.preventDefault(); this.typing = this.query || ''; this.noMatch = false; sfx('SE_SYS_WINDOWIN'); return; }
    if (e.code === 'Digit2' && !e.repeat && !this.join) { this.openJoin(); }
    // HP4's MINUS (M here): in COURSE MUSIC, on a course, the lower half flips radar <-> the course's songs; in
    // SELECT RECORD (RECORDS), record window <-> the course's songs (0x8006c6cc / 0x80070620: +4148 0 <-> 1,
    // 2 <-> 1). The 1 Button (1 here) cycles SELECT RECORD's style (+0x1284, 0-6); its dance (+0x1288) follows
    // the CLASSIC / Wii Balance Board / CHOREOGRAPH play the records are from (PC: 1 cycles the style, Shift+1 the dance)
    if (HP4 && e.code === 'KeyM' && !e.repeat && !this.join) {
      const cur = this.order[this.idx], onCourse = cur && cur.special === 'hp4course';
      if (this.records) { if (onCourse) { this.recView = this.recView === 1 ? 2 : 1; sfx('SE_SYS_SELECT02'); } return; }
      if (this.hp4List === 'course' && onCourse) { this.recView = this.recView === 1 ? 0 : 1; sfx('SE_SYS_SELECT02'); }
      return;
    }
    if (HP4 && e.code === 'Digit1' && !e.repeat && !this.join && this.records) {
      if (e.shiftKey) this.recDance = ((this.recDance || 0) + 1) % 3; else this.recStyle = ((this.recStyle || 0) + 1) % 7;
      sfx('SE_SYS_SELECT01'); return;
    }
    // HP4's "2 STAGE" (the Wii Remote's 2 Button; T here): its SELECT STAGE window (class CselStage)
    if (HP4 && e.code === 'KeyT' && !e.repeat && !this.join && !this.stgPick) {
      const i = HP4_STAGE_LIST.indexOf(S.hp4Stage === 'random' ? 8 : +S.hp4Stage);
      this.stgPick = { i: i < 0 ? 0 : i, at: performance.now() }; sfx('SE_SYS_WINDOWIN'); return;
    }
    if (e.code === 'KeyF' && !e.repeat && !this.join) {      // jump to the next section (game songs, Replicant D-action, your folders)
      const cur = sectionOf(this.order[this.idx]);
      let i = this.order.findIndex((s, k) => k > this.idx && sectionOf(s) !== cur);
      if (i < 0) i = 0;
      if (i !== this.idx) { this.lastDir = 1; this.idx = i; this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02'); }
    }
    if (e.code === 'KeyR' && !e.repeat && !this.join) {      // jump to Replicant D-action and back
      const inRda = rdaIndex(this.order[this.idx]) >= 0;
      const i = inRda ? 0 : this.order.findIndex(s => rdaIndex(s) >= 0);
      if (i >= 0 && i !== this.idx) { this.lastDir = inRda ? -1 : 1; this.idx = i; this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02'); }
    }
  },
  stopPreview() {
    if (this.previewSrc) {
      const src = this.previewSrc, gn = this.previewGain;
      try { gn.gain.setTargetAtTime(0, actx.currentTime, 0.05); src.stop(actx.currentTime + 0.3); } catch (e) {}
    }
    this.previewSrc = null; this.previewFor = -1;
  },
  async startPreview(song) {
    this.previewFor = song.slot;
    try {
      let buf = this.previewCache.get(song.slot);
      if (!buf) {
        buf = song.custom ? await customPreview(song) : toBuffer(DDR.decodeBRSTM(await bin('/api/preview/' + song.slot)));
        this.previewCache.set(song.slot, buf);
        if (this.previewCache.size > 12) this.previewCache.delete(this.previewCache.keys().next().value);
      }
      if (this.previewFor !== song.slot || scene !== this) return;
      const ctx = audio(), src = ctx.createBufferSource(), gn = ctx.createGain();
      src.buffer = buf; src.loop = true;
      gn.gain.setValueAtTime(0, ctx.currentTime); gn.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.4);
      src.connect(gn).connect(ctx.destination); src.start();
      this.previewSrc = src; this.previewGain = gn;
    } catch (e) { /* no preview */ }
  },
  input(a, p) {
    if (!p) return;
    if (this.typing !== null) return;                   // keys go to the search box
    if (this.join) { this.joinInput(a); return; }
    if (this.taskWin) { if (a === 'START' || a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.taskWin = 0; } return; }
    if (this.stgPick) {                                  // HP4's SELECT STAGE window
      const q = this.stgPick, n = HP4_STAGE_LIST.length;
      if (q.decided) return;                             // (the chosen picture's zoom is playing)
      if (/^P[1-4]L$/.test(a)) { q.i = (q.i + n - 1) % n; q.moved = performance.now(); q.dir = -1; sfx('SE_SYS_SELECT01'); }
      else if (/^P[1-4]R$/.test(a)) { q.i = (q.i + 1) % n; q.moved = performance.now(); q.dir = 1; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') { const v = HP4_STAGE_LIST[q.i]; S.hp4Stage = v === 8 ? 'random' : String(v); saveSettings(); q.decided = performance.now(); sfx('SE_SYS_DECIDE01'); }
      else if (a === 'BACK') { this.stgPick = null; sfx('SE_SYS_WINDOWOUT'); }
      return;
    }
    if (this.stage === 'go') return;
    if (this.stage) { this.stageInput(a); return; }
    if (a === 'BACK' && this.query) { this.applySearch(''); sfx('SE_SYS_WINDOWOUT'); return; }
    if (a === 'BACK' && HP4 && this.records) { this.records = false; this.recView = 0; sfx('SE_SYS_WINDOWOUT'); return; }
    if (a === 'BACK' && HP4 && this.hp4List === 'course') { this.hp4Switch(null); return; }
    if (HP4 && this.records && a === 'START' && !(this.order[this.idx] && this.order[this.idx].folderTile && this.order[this.idx].special !== 'hp4course')) { sfx('SE_SYS_ERROR'); return; }   // (SELECT RECORD only shows records)
    if (a === 'BACK' && this.inFolder && !this.favOnly) { this.closeFolder(); return; }
    if (a === 'BACK' && !this.favOnly) { sfx('SE_SYS_WINDOWOUT'); this.stopPreview(); go(BATTLE ? BattleSel : Style); return; }
    // in VERSUS each player picks their own difficulty: player 2 is the P2 side (Single) or P3/P4 (Double)
    let who = 0;
    const pm = /^P([1-4])([LDUR])$/.exec(a);
    if (pm) {
      const n = +pm[1];
      if (P2) who = styleNow() === 'double' ? (n >= 3 ? 1 : 0) : n >= 3 ? (PX[n - 3] ? n - 1 : 0) : (n === 2 ? 1 : 0);
      a = 'P1' + pm[2];
    }
    // Hottest Party: the list goes up and down, left / right picks the difficulty, Enter starts
    if (hpLike()) {
      const swap = { P1L: 'P1U', P1R: 'P1D', P1U: 'P1L', P1D: 'P1R' };
      if (swap[a]) a = swap[a];
      if (a === 'START' && this.order[this.idx] && this.order[this.idx].folderTile) { this.openFolder(this.order[this.idx]); return; }
      if (a === 'START' && this.order[this.idx] && !this.order[this.idx].random) {
        if (!levelsOf(this.song()).some(v => v > 0)) { sfx('SE_SYS_ERROR'); return; }
        if (this.okAt) return;
        sfx('SE_SYS_DECIDE01'); this.stage = 'go'; this.okAt = performance.now(); return;
      }
    }
    if (a === 'P1L' || a === 'P2L') { this.move(-1); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1R' || a === 'P2R') { this.move(1); sfx('SE_SYS_SELECT01'); }
    else if ((a === 'P1U' || a === 'P1D') && this.order[this.idx] === MCC_TILE) { this.mccSt = ((this.mccSt || 0) + (a === 'P1D' ? 1 : 3)) % 4; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1U' || a === 'P2U') { this.changeDiff(-1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'P1D' || a === 'P2D') { this.changeDiff(1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'P2START') this.openJoin();
    else if (a === 'START' && this.order[this.idx] && this.order[this.idx].folderTile) { this.openFolder(this.order[this.idx]); return; }
    else if (a === 'START' && this.order[this.idx] && this.order[this.idx].random) {
      const pool = this.order.map((s2, i) => i).filter(i => !this.order[i].random && (levelsOf(this.order[i]).some(v => v > 0) || (this.order[i].alt && levelsOf(Object.assign({}, this.order[i], this.order[i].alt)).some(v => v > 0))));
      if (!pool.length) { sfx('SE_SYS_ERROR'); return; }
      this.idx = pool[Math.floor(wiiRandom() * pool.length)];
      this.lastDir = 1; this.scrolled = true; this.moved = performance.now(); this.stopPreview(); this.fixDiff();
      sfx('SE_SYS_DECIDE01');
      this.note = 'RANDOM picked: ' + this.order[this.idx].name; this.noteAt = performance.now();
      return;
    }
    else if (a === 'START') {
      if (!levelsOf(this.song()).some(v => v > 0) && !(this.hasBoth() && levelsOf(Object.assign({}, this.order[this.idx], this.order[this.idx].alt)).some(v => v > 0))) {
        this.note = 'No ' + styleNow() + ' charts for this song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return;
      }
      sfx('SE_SYS_DECIDE01');
      // like the game: songs with two versions ask SHORT / FULL first, then the difficulty
      // (0x8007241c: each window says its name as it opens - SELECT SONG LENGTH 738, SELECT DIFFICULTY 737)
      // (HP4 has no SELECT DIFFICULTY window: the difficulty is picked with Up / Down on the song list
      // itself, and the song starts at once)
      if (HP4 && !this.hasBoth()) { this.okAt = performance.now(); return; }
      if (this.hasBoth()) { this.stage = 'length'; this.lenPick = S.short ? 0 : 1; if (!hpLike()) voice('VO_NAR_SNGLEN'); }
      else { this.stage = 'diff'; if (!hpLike()) voice('VO_NAR_SELDIFF'); }
      this.stageAt = performance.now();
    }
    else if (a === 'OPTIONS') { sfx('SE_SYS_WINDOWIN'); Options.keep = false; go(Options); }
    else if (a === 'SWITCH' && HP4 && !this.stgPick) {
      // HP4: the Wii Remote's 2 button on the song list opens SELECT STAGE (the DANCE STAGE tile's window)
      this.openFolder({ special: 'stage' });
    }
    else if (a === 'SWITCH') {
      if (!this.hasBoth()) return;
      S.short = !S.short; saveSettings(); sfx('SE_SYS_SELECT02');
      this.stopPreview(); this.moved = performance.now(); this.fixDiff();
    }
  },
  // after a song is picked: 'length' (SHORT / FULL pop-up) then 'diff' (choose the difficulty, Enter starts)
  stage: null,
  stageInput(a) {
    let who = 0;
    const pm = /^P([1-4])([LDUR])$/.exec(a);
    if (pm) { const n = +pm[1]; if (P2) who = styleNow() === 'double' ? (n >= 3 ? 1 : 0) : n >= 3 ? (PX[n - 3] ? n - 1 : 0) : (n === 2 ? 1 : 0); a = 'P1' + pm[2]; }
    if (this.stage === 'length') {
      if (/^P1[LRUD]$/.test(a) || a === 'SWITCH') { this.lenPick = 1 - this.lenPick; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') {
        const short = this.lenPick === 0;
        if (S.short !== short) { S.short = short; saveSettings(); this.stopPreview(); this.moved = performance.now(); }
        this.fixDiff();
        if (!levelsOf(this.song()).some(v => v > 0)) { this.note = 'No ' + styleNow() + ' charts for this version'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
        sfx('SE_SYS_DECIDE01'); this.stage = 'diff'; this.stageAt = performance.now(); if (!hpLike()) voice('VO_NAR_SELDIFF');
      } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.stage = null; }
      return;
    }
    // choosing the difficulty. Each player confirms their own pick: their badge then moves onto the
    // button (selMusic 1p-4p_box01) with OK, and the song starts once everyone has confirmed.
    // Enter (shared by keyboard and mats) confirms everyone still choosing; P2 Start confirms player 2 alone.
    const done = this.confirmed(), all = this.players();
    if (a === 'P1U' || a === 'P1D') {
      if (this.okAt || (GROUP ? done.length : done.includes(who))) return;     // (a confirmed player's pick is locked)
      this.changeDiff(a === 'P1U' ? -1 : 1, who); sfx('SE_SYS_SELECT02');
    } else if (a === 'START' || (a === 'P2START' && P2 && all.includes(1))) {
      if (this.okAt) return;
      const add = a === 'START' ? all : [1];
      add.forEach(k => { if (!done.includes(k)) done.push(k); });
      sfx('SE_SYS_DECIDE01');
      if (all.every(k => done.includes(k))) this.okAt = performance.now();
    } else if (a === 'BACK' && !this.okAt && done.length) { sfx('SE_SYS_WINDOWOUT'); done.length = 0; }   // undo the confirmations first
    else if (a === 'BACK' && !this.okAt && !(window.NET && NET.pendingSong)) { sfx('SE_SYS_WINDOWOUT'); this.stage = this.hasBoth() ? 'length' : null; this.stageAt = performance.now(); }
  },
  // the players choosing here (the computer in BATTLE CPU and a friend online pick elsewhere)
  players() {
    if (BATTLE || S.mode === 'online') return [0];
    return [0, ...(P2 ? [1] : []), ...PX.map((x, k) => x ? k + 2 : -1).filter(k => k >= 0)];
  },
  // who has confirmed on this opening of SELECT DIFFICULTY (cleared each time the window opens)
  confirmed() {
    if (this.doneAt !== this.stageAt) { this.doneAt = this.stageAt; this.done = []; }
    return this.done;
  },
  launch() {
    if (S.mode === 'online' && window.NET) {            // ONLINE VERSUS: the host's pick goes to the friend first
      this.okAt = 0; this.stage = null;
      if (!NET.open) { this.note = 'Not connected'; this.noteAt = performance.now(); return; }
      if (!NET.host && NET.pendingSong) {              // the guest's difficulty for the host's song
        const m = NET.pendingSong; NET.pendingSong = null;
        NET.peerDiff = m.diff; NET.peerOpts = m.o;
        NET.send({ t: 'songok', diff: S.diff, o: onlineOpts() });
        go(Loading.with(this.song())); return;
      }
      if (!NET.host) { this.note = 'The host picks the song'; this.noteAt = performance.now(); return; }
      const song = this.song();
      NET.handlers.songok = m => { NET.peerDiff = m.diff; NET.peerOpts = m.o; go(Loading.with(song)); };
      NET.handlers.nosong = () => { this.note = (NET.peerName || 'Your friend') + ' does not have this song'; this.noteAt = performance.now(); };
      NET.send({ t: 'song', slot: song.slot, diff: S.diff, o: onlineOpts() });
      this.note = 'Waiting for ' + (NET.peerName || 'your friend') + '...'; this.noteAt = performance.now();
      return;
    }
    {
      this.okAt = 0;
      this.stage = null;
      S.lastSlot = this.song().slot; saveSettings();
      const next = Loading.with(this.song());
      // before a VERSUS game on dance mats, make sure each mat is the right player (once, or after a mat is plugged in)
      go(P2 && input.padCount() >= 2 && (!input.matsChecked || input.padsChanged) && MatCheck.rolesFor(true).length >= 2 ? MatCheck.with(next, true) : next);
    }
  },
  drawStage(t) {
    const k = clamp((performance.now() - this.stageAt) / 150), P = A.pop || {};
    const pw = 624, ph = 468, px = W / 2 - pw / 2, py = H / 2 - ph / 2 + 6;
    const mmss = v => { const n = Math.round(v || 0); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
    const pulse = 0.75 + 0.25 * Math.sin(t * 7);
    g.fillStyle = `rgba(0,10,40,${0.7 * k})`; g.fillRect(0, 0, W, H);
    g.save();
    // the game's pop-ups: its 624 x 468 boards at 1.5 px a unit about the screen's middle (selMusic CAE 0x27fbc0 /
    // 0x212100 sele_brd_*; the Wii screen matches)
    g.translate(W / 2, H / 2); g.scale(1.5, 1.5); g.translate(-W / 2, -H / 2 - 6);
    const back = this.stage === 'diff' ? P.radar : null;      // (SELECT SONG LENGTH draws its own board below)
    if (back) g.drawImage(back, px, py, pw, ph);
    else if (this.stage === 'diff') { g.fillStyle = '#1d5fc8'; g.fillRect(px, py, pw, ph); }
    const head = (im, label) => { if (!blit(im, W / 2, py + 34, 1)) text(label, W / 2, py + 34, 26, '#fff', 'center'); };
    const footer = items => items.forEach(([key, label], i) => {
      const x = px + pw / 2 + (i - (items.length - 1) / 2) * 170, y = py + ph - 36;
      text(key, x - 8, y, 12, '#ffe86a', 'right'); text(label, x - 2, y, 13, '#fff');
    });
    if (this.stage === 'length') {
      // SELECT SONG LENGTH (selMusic CAE 0x212100 the board, 0x1e6d20 a button; 1.5 px a unit about the screen's
      // middle - the Wii screen matches): the board sele_brd_song01 (624 x 468) with its title sele_song_US at (7, -183),
      // the buttons at (-2, -67) SHORT and (-2, 92) FULL - sele_btn_song01 at 0.9, the chosen one at 1.0 inside
      // sele_dancebtn_w; on a button (chosen / not): the words at x +-65 / +-58.5, the time label song_time01 at
      // (-7 / -6.3, 49 / 44.1) for SHORT and (-132 / -118.8, ...) for FULL, its box brd_time01 at (96 / 86.4) and
      // (-29 / -26.1); the hints on the board's anchors (-84 / 22 / 128 / 234, 199)
      g.restore(); g.save();
      const s = this.order[this.idx], U = 1.5, OX = W / 2, OY = H / 2;
      const S2 = (im, x, y, px, py, sc = 1) => { if (!im) return false; g.drawImage(im, OX + (x - px * sc) * U, OY + (y - py * sc) * U, im.width * sc * U, im.height * sc * U); return true; };
      g.globalAlpha = k;
      if (!S2(P.panel, 0, 0, 312, 234)) { g.fillStyle = '#1d5fc8'; g.fillRect(OX - 468, OY - 351, 936, 702); }
      if (!S2(P.lenHead, 7, -183, 154, 18)) text('SELECT SONG LENGTH', OX + 7 * U, OY - 183 * U, 30, '#fff', 'center');
      [[s.alt.length, P.shortTxt, 'SHORT SONG', -67, 1], [s.length, P.fullTxt, 'FULL SONG', 92, -1]].forEach(([len, nm, label, by, side], i) => {
        const on = this.lenPick === i, sc = on ? 1 : 0.9, bx = -2;
        if (on) { g.save(); g.globalAlpha = k * pulse; S2(P.cardOn, bx, by, 250, 86); g.restore(); }
        if (!S2(P.cards && P.cards[i], bx, by, 240, 76, sc)) { g.fillStyle = '#e4f3ff'; g.fillRect(OX + (bx - 240 * sc) * U, OY + (by - 76 * sc) * U, 480 * sc * U, 152 * sc * U); }
        if (!S2(nm, bx + side * 65 * sc, by, 165, 31, sc)) text(label, OX + (bx + side * 65 * sc) * U, OY + by * U, 30, '#334', 'center');
        const lx = side > 0 ? -7 : -132, tx = side > 0 ? 96 : -29;
        if (!S2(P.timeLbl, bx + lx * sc, by + 49 * sc, 54, 10, sc)) text('Song Length', OX + (bx + lx * sc) * U, OY + (by + 49 * sc) * U, 15, '#14306e', 'center');
        if (!S2(P.box, bx + tx * sc, by + 49 * sc, 65, 14, sc)) { g.fillStyle = '#3a4250'; g.fillRect(OX + (bx + (tx - 65) * sc) * U, OY + (by + 35 * sc) * U, 130 * sc * U, 28 * sc * U); }
        num28(mmss(len), OX + (bx + tx * sc) * U, OY + (by + 49 * sc) * U, 28 * 0.7 * sc * U, 'center');
      });
      // the hints: CONFIRM, BACK, SELECT, Pointer:SELECT (comAF 0, 3, 4, 32)
      [0, 3, 4, 32].forEach((id, j) => { const im = A.hints && A.hints[id]; if (im) g.drawImage(im, OX + [-84, 22, 128, 234][j] * U - 75, OY + 199 * U - 12, 150, 24); });
    } else {
      // SELECT DIFFICULTY: the song on the left with its radar, big difficulty buttons on the right
      const song = this.song(), lv = levelsOf(song), both = this.hasBoth();
      head(P.diffHead && P.diffHead[both ? (song.isShort ? 1 : 2) : 0], 'SELECT DIFFICULTY');
      const ti = texture('title', song.title), lx = px + 157;
      if (ti.img) { const sc = Math.min(1.05, 280 / ti.img.width, 48 / ti.img.height); g.drawImage(ti.img, lx - ti.img.width * sc / 2, py + 102 - ti.img.height * sc / 2, ti.img.width * sc, ti.img.height * sc); }
      else { text(song.name.slice(0, 26), lx, py + 108, 18, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 32), lx, py + 128, 13, '#dff', 'center', 'normal'); }
      const bpm = song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
      // BPM and length: the labels, then the value in a grey box, in a heavy outlined lettering like the game's
      const outl = (str, x, y, size, col, align, italic) => {
        g.font = `${italic ? 'italic ' : ''}900 ${size}px Georgia, 'Times New Roman', serif`; g.textAlign = align; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = size / 4.5; g.strokeText(str, x, y);
        g.fillStyle = col; g.fillText(str, x, y);
      };
      [[A.img.bpmLabel, 'BPM', bpm, 148, false], [A.img.lenLabel, 'Song Length', mmss(song.length), 178, true]].forEach(([im, label, val, y, it]) => {
        // the game's label picture already has its grey box on the right
        if (im) { const sc = 266 / im.width; g.drawImage(im, px + 24, py + y - im.height * sc / 2, im.width * sc, im.height * sc); }
        else {
          outl(label, px + 92, py + y, 16, '#fff', 'center');
          g.fillStyle = '#41444c'; g.fillRect(px + 159, py + y - 12, 132, 24);
        }
        outl(val, px + 280, py + y + 1, 19, '#fff', 'right', it);
      });
      if (P.radar) this.drawRadar(song, px + 168, py + 331, 1, [[168, 246], [275, 296], [243, 402], [94, 402], [62, 296]].map(([x, y]) => [px + x, py + y]));
      else this.drawRadar(song, lx, py + 322, 1.05);
      // the buttons, with the level on each; the chosen one gets an orange frame, the player's badge
      // beside it, and "OK" once it's confirmed
      // only the difficulties the song has, centred in the column; the chosen one is a little bigger with
      // a glowing orange frame and the player's badge beside it, and shows "OK" once confirmed
      // (the buttons on the board's anchors, CAE 0x27fbc0: x 148 from the board's middle, rows 66.5 apart - y -86 ..
      // 113.5 for four, -118 .. 148 for five; checked on the Wii screen)
      const rows = DIFFS.map((x, i) => i).filter(i => lv[i] > 0), step = 66.5;
      const top = py + 234 + 14.75 - step * (rows.length - 1) / 2 - 28;
      rows.forEach((i, r) => {
        const [d, name] = DIFFS[i], on = S.diff === d, on2 = P2 && P2.diff === d;
        // every player's pick: P1 S.diff, P2 P2.diff, P3 / P4 PX (FRIENDSHIP / SYNC: all share S.diff)
        const picks = [S.diff, P2 && (GROUP ? S.diff : P2.diff), ...PX.map(x => x && (GROUP ? S.diff : x.diff))];
        const done = this.confirmed(), active = this.players();
        const here = picks.map((pd, k) => pd === d && active.includes(k) ? k : -1).filter(k => k >= 0), marks = A.img.selMarks && A.img.selMarks[0];
        const okHere = here.filter(k => done.includes(k)), waiting = here.filter(k => !done.includes(k));
        const sc = on || here.length ? 1.12 : 1, bw = 156 * sc, bh = 57 * sc, cx = px + 312 + 148, cy = top + r * step + 28;
        const bx = cx - bw / 2, by = cy - bh / 2;
        if (on || here.length) {          // (Wii 3 / 4 player screenshots: every picked button gets the orange frame)
          g.save(); g.shadowColor = '#ff8a10'; g.shadowBlur = 14;
          g.strokeStyle = `rgba(255,${this.okAt ? 120 : 110 + 40 * pulse},20,1)`; g.lineWidth = 5;
          g.beginPath(); g.roundRect ? g.roundRect(bx - 5, by - 5, bw + 10, bh + 10, 10) : g.rect(bx - 5, by - 5, bw + 10, bh + 10); g.stroke();
          g.restore();
        }
        if (P.diff && P.diff[i]) g.drawImage(P.diff[i], bx, by, bw, bh); else { g.fillStyle = DIFFS[i][2]; g.fillRect(bx, by, bw, bh); text(name, bx + 10, by + 16, 15, '#fff'); }
        const str = String(lv[i]).padStart(2, '0'), ny = by + bh * 0.3, fs = 19 * sc;
        outl(str[0], bx + bw * 0.845, ny, fs, str[0] === '0' ? 'rgba(255,255,255,0.35)' : '#fff', 'center');
        outl(str[1], bx + bw * 0.935, ny, fs, '#fff', 'center');
        if (okHere.length) {
          if (!blit(P.ok, bx + bw - 30, by + bh - 15, 1)) text('OK', bx + bw - 30, by + bh - 15, 18, '#ffe14d', 'center');
          // the confirmed players' badges on the button (CAE 0x178ae0 1p-4p_box01: x -26 / -3.7 / 18.7 / 41,
          // y 10.5, rot -10, 0.55x). Their layer sits 33 units left of the button's middle: measured on a Wii
          // screenshot (player 2 confirmed on BASIC), which also matches the y and the size.
          const u = 156 / (180 * 0.9) * sc, BX = [-26, -3.7, 18.7, 41];
          okHere.forEach(pi => {
            const im = A.img.selBox && A.img.selBox[pi], x = cx + (BX[pi] - 33) * u, y = cy + 10.5 * u, s2 = 60 * 0.55 * u;
            g.save(); g.translate(x, y); g.rotate(-10 * Math.PI / 180);
            if (im) g.drawImage(im, -s2 / 2, -s2 / 2, s2, s2);
            else { g.fillStyle = ['#2a70ff', '#ff3a30', '#20b040', '#f0c020'][pi]; g.fillRect(-s2 / 2, -s2 / 2, s2, s2); text(String(pi + 1), 0, 1, 20 * sc, '#fff', 'center'); }
            g.restore();
          });
        }
        if (marks) {
          // the game's markers (selMusic CAE 0x178ae0, sel_1p-4p): drawn at (133, -1) from the button's middle,
          // pivot (60, 21); player n's badge sits n-1 slots out, so players sharing a button line up 1 2 3 4
          // (drawn farthest first, so each nearer badge covers the longer lines behind it).
          // Sized to this window's buttons (the game's button: 180 x 0.9).
          const k = 156 / (180 * 0.9);          // (game units -> this window's pixels)
          waiting.slice().reverse().forEach(pi => { const m = A.img.selMarks[pi]; if (m) g.drawImage(m, cx + (133 - 60) * k, cy + (-1 - 21) * k, m.width * k, m.height * k); });
        } else {
          if (on && !done.includes(0) && !blit(P.badge && P.badge[0], bx + bw + 24, cy, 0.5)) text('1', bx + bw + 24, cy, 18, '#fff', 'center');
          if (on2 && !done.includes(1) && !blit(P.badge && P.badge[1], bx - 24, cy, 0.5)) text('2', bx - 24, cy, 18, '#fff', 'center');
        }
      });
      // the hints on the board's anchors (-84 / 22 / 128 / 234, 199): CONFIRM, BACK, SELECT, Pointer:SELECT
      if (A.hints && A.hints[0]) [0, 3, 4, 32].forEach((id, j) => { const im = A.hints[id]; if (im) g.drawImage(im, W / 2 + [-84, 22, 128, 234][j] - 50, H / 2 + 6 + 199 - 8, 100, 16); });
      else footer([['Up/Down', 'DIFFICULTY'], ['Enter', 'START'], ['Esc', 'BACK']]);
    }
    g.restore();
  },
  draw(t) {
    { const cur = this.order && this.order[this.idx];
      HP_LOOK = hpLike() || !!((this.inFolder && SONGS.some(s => s.disc && s.folder === this.inFolder)) || (cur && (cur.disc || (cur.folderTile && cur.disc)))); }
    if (HP4 && this.order && this.order.length && this.drawHP4(t)) return;
    if (hpLike() && !this.join && this.order && this.order.length) { if (hp2Sel()) this.drawHP2(t); else this.drawHP(t); return; }
    if (look('select') === 'hp3' && !this.join && this.order && this.order.length) { this.drawHP3(t); return; }
    menuBackground(t);
    if (!this.order || !this.order.length) { text('No songs found in the game folder.', W / 2, H / 2, 30, '#fff', 'center'); return; }
    const song = this.song(), rda = rdaIndex(song);
    if (rda >= 0) {                 // the boss folder: a darker, red-tinted screen
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(40,0,25,0.78)'); gr.addColorStop(1, 'rgba(110,0,30,0.62)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (performance.now() - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    // header tab
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    else { g.fillStyle = '#2a7fd6'; g.fillRect(0, 0, 440, 78); }
    if (rda >= 0) { g.fillStyle = 'rgba(120,0,30,0.55)'; g.fillRect(0, 0, 432, 74); text('REPLICANT D-ACTION', 216, 44, 30, '#ffd6e0', 'center'); }
    else if (this.inFolder || song.custom || song.disc) { const f = this.inFolder || song.folder; g.fillStyle = 'rgba(10,60,40,0.5)'; g.fillRect(0, 0, 432, 74); text(f.toUpperCase(), 216, 38, 30, '#e8fff4', 'center'); const dsc = SONGS.some(s => s.disc && s.folder === f); text(dsc ? (this.inFolder ? 'FROM YOUR DISC   Esc: back to all songs' : 'FROM YOUR DISC') : this.inFolder ? 'YOUR FOLDER   Esc: back to all songs' : 'CUSTOM SONGS', 216, 64, 13, '#bfffe0', 'center', 'normal'); }
    else if (!blit(A.img.selTitle, 222, 50, 1.45)) text('SELECT MUSIC', 222, 50, 34, '#fff', 'center');
    // title + BPM / length (top right)
    const ti = texture('title', song.title);
    if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.85, 30, ti.img.width * 1.7, ti.img.height * 1.7);
    else { text(song.name.slice(0, 40), 640, song.artist ? 50 : 66, Math.min(28, Math.round(440 / (0.56 * Math.max(1, song.name.slice(0, 40).length)))), '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 44), 640, 86, 18, '#dff', 'center'); }
    const bpm = song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    const len = Math.round(song.length);
    const info = [[A.img.bpmLabel, 'BPM', bpm, 58], [A.img.lenLabel, 'Song Length', song.random ? '??:??' : song.folderTile ? '--:--' : `${String(Math.floor(len / 60)).padStart(2, '0')}:${String(len % 60).padStart(2, '0')}`, 92]];
    for (const [im, label, val, y] of info) {
      const sc = 1.32, x = 820;
      if (im) g.drawImage(im, x, y - 11 * sc, im.width * sc, im.height * sc);
      else text(label, x, y, 20, '#124');
      text(val, x + 186 * sc, y + 1, 24, '#fff', 'right');
    }
    this.jacketRow(t, song);
    // pink arrows and the position bar under the row
    const bob = 0;
    if (A.img.magenta) {
      g.save(); g.translate(282 - bob, 335); g.scale(-0.55, 0.55); blit(A.img.magenta, 0, 0); g.restore();
      blit(A.img.magenta, 1003 + bob, 335, 0.55);
    }
    g.fillStyle = 'rgba(70,80,95,0.7)'; g.fillRect(341, 360, 604, 4);
    const n = this.order.length, pos = n > 1 ? this.idx / (n - 1) : 0;
    g.fillStyle = '#ff6a1a'; g.fillRect(341 + pos * (604 - 44), 359, 44, 6);
    // radar with the SHORT / FULL tabs, and the difficulty panel beside it
    // (the bottom half from selMusic CAE 0x9d8e0, 1.5 px a unit about the middle - checked on the Wii screen: the radar
    // panel musi_panel_musi at (192, 338) pivot (125, 90), the difficulty panel at (439, 338) pivot (133, 90), the
    // SHORT / FULL tabs musi_panel_song at (132, 263) / (252, 263) pivot (62, 13), rows win_beg..cha at (439, 292 +
    // 28 n) pivot (117, 16), levels Num02_00 at x 536, the cursor select_diff_arr at (576.5, row) pivot (27, 19))
    const LX = x => 640 + (x - 320) * 1.5, LY = y => y * 1.5;
    const isCut = !!song.isShort, both = this.hasBoth();
    if (both && A.img.shortTag && A.img.fullTag) {      // only songs with both versions show the tabs
      g.globalAlpha = isCut ? 1 : 0.55; g.drawImage(A.img.shortTag, LX(132) - 93, LY(263) - 19.5, 186, 39);
      g.globalAlpha = !isCut ? 1 : 0.55; g.drawImage(A.img.fullTag, LX(252) - 93, LY(263) - 19.5, 186, 39);
      g.globalAlpha = 1;
    }
    this.drawRadar(song, LX(192), LY(338), 1.5);
    // SORT tab above the difficulties (the song order: DEFAULT is the game's own order)
    if (this.stage !== 'diff') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(686, 388, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#14306e'; g.fillRect(680, 386, 12, 4);
      text('SORT', 721, 388, 15, '#14306e', 'center');
      g.fillStyle = '#2b2f38'; g.fillRect(762, 374, 182, 28);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.strokeRect(762, 374, 182, 28);
      text(this.favOnly ? 'FAVORITE' : this.query ? 'SEARCH' : 'DEFAULT', 853, 388, 15, '#fff', 'center');
    }
    const PX = LX(439) - 133 * 1.5, PY = LY(338) - 90 * 1.5, PW = 266 * 1.5, PH = 180 * 1.5;
    if (A.img.diffPanel) g.drawImage(A.img.diffPanel, PX, PY, PW, PH);
    else panel(PX, PY, PW, PH);
    const rowW = 234 * 1.5, rowX = LX(439) - 117 * 1.5, rowY = LY(292) - 16 * 1.5;
    const lv = levelsOf(song);
    // like the game, only the difficulties the song has, from the top
    const shown = DIFFS.map((x, i) => i).filter(i => lv[i] > 0);
    DIFFS.forEach(([d, name, col], i) => {
      const row = shown.indexOf(i);
      if (row < 0) return;
      const y = rowY + row * 28 * 1.5, x = rowX, w = rowW, h = 32 * 1.5, on = S.diff === d, has = true;
      const bars = A.img.diffBars && A.img.diffBars[d];
      if (bars && bars[0]) g.drawImage(has ? bars[0] : bars[1], x, y, w, h);
      else { g.fillStyle = has ? '#0b2470' : '#335'; g.fillRect(x, y, w, h); text(name, x + 120, y + h / 2, 22, col, 'center'); }
      if (has) {                                   // the level with a dim leading zero, like the game's
        const str = String(lv[i]).padStart(2, '0'), dx = LX(536);
        text(str[1], dx, y + h / 2 + 1, 32, '#ffffff', 'center');
        text(str[0], dx - 20, y + h / 2 + 1, 32, str[0] === '0' ? 'rgba(255,255,255,0.35)' : '#ffffff', 'center');
      }
      const rec = has ? recordOf(song, d) : null;
      if (rec && rec.grade) {
        const gi = ['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(rec.grade);
        if (rec.fc && A.img.crowns) blit(A.img.crowns[rec.fc === 5 ? 2 : rec.fc === 4 ? 0 : rec.fc === 3 ? 1 : 3], x + 4, y + h / 2 - 6, 0.7);
        if (!blit(A.img.gradeSmall && A.img.gradeSmall[gi], x + 44, y + h / 2 + 2, 0.8)) text(rec.grade, x + 40, y + h / 2, 20, '#4fb4ff', 'center');
      }
      if (on) {
        // the game's difficulty cursor (select_diff_arr) at the row's right end
        if (A.img.pointer) g.drawImage(A.img.pointer, LX(576.5) - 27 * 1.5, y + h / 2 - 19 * 1.5, 54 * 1.5, 38 * 1.5);
        else { g.strokeStyle = `rgba(255,255,255,${0.75 + 0.25 * Math.sin(t * 8)})`; g.lineWidth = 4; g.strokeRect(x - 3, y - 2, w + 6, h + 4); }
        if (P2) text('1P', x - 20, y + h / 2, 14, '#fff', 'center');
      }
      if (P2 && P2.diff === d) {                   // player 2's cursor on the right
        g.strokeStyle = `rgba(255,120,170,${0.75 + 0.25 * Math.sin(t * 8 + 1)})`; g.lineWidth = 3;
        g.strokeRect(x - 7, y - 5, w + 14, h + 10);
        g.fillStyle = '#ff5c9a'; g.beginPath(); g.moveTo(x + w + 30 - bob, y + h / 2 - 11); g.lineTo(x + w + 13 - bob, y + h / 2); g.lineTo(x + w + 30 - bob, y + h / 2 + 11); g.fill();
      }
    });
    // DDR points (bottom left, like the game)
    if (!drawPointsPlate()) {
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(28, 636, 150, 22);
      text('DDR POINTS', 103, 647, 15, '#fff', 'center');
      text(String(SAVE.points).padStart(7, '0') + ' pts', 28, 678, 24, '#ffe86a');
    }
    // help: two rows of four buttons, like the game's - its own pictures (comAF hints 0 CONFIRM, 3 BACK, 10 MUSIC,
    // 18 FAVORITE, 30 OPTIONS) where the PC has the same command, the PC's own keys for the rest
    const HP_ = A.hints;
    const help = [[[null, 0], [null, 3], [null, 10], [null, 18]],
                  [[null, 30], ['S', 'SEARCH'], ['F', 'FOLDER'], ['2', P2 ? 'PLAYER 2' : '2P JOIN']]];
    help.forEach((row, r) => row.forEach(([k, v], i) => {
      const x = 590 + i * 154, y = 652 + r * 27;
      if (k === null) { const im = HP_ && HP_[v]; if (im) { g.drawImage(im, x, y - 12, 150, 24); return; } k = ''; v = ['CONFIRM', '', '', 'BACK', '', '', '', '', '', '', 'MUSIC'][v] || (v === 18 ? 'FAVORITE' : 'OPTIONS'); }
      g.fillStyle = 'rgba(48,62,86,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 12, 148, 24, 5) : g.rect(x, y - 12, 148, 24); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke();
      text(k, x + 22, y, 11, '#ffe86a', 'center');
      text(v, x + 92, y, 14, '#fff', 'center');
    }));
    if (this.note && performance.now() - this.noteAt < 2000) text(this.note, 400, 620, 18, '#c00030', 'center');
    if (this.favOnly && this.typing === null && !this.query) {
      g.fillStyle = 'rgba(80,50,0,0.78)'; g.fillRect(212, 646, 368, 40);
      g.strokeStyle = '#ffd23c'; g.lineWidth = 2; g.strokeRect(212, 646, 368, 40);
      drawStar(234, 666, 11, '#ffd23c');
      text('FAVORITES', 254, 666, 20, '#fff');
      text(`${this.order.length} song${this.order.length === 1 ? '' : 's'}   W: show all`, 570, 666, 13, '#ffe9b0', 'right', 'normal');
    }
    if (this.typing !== null || this.query) {
      const on = this.typing !== null, q = on ? this.typing : this.query;
      g.fillStyle = on ? 'rgba(10,30,80,0.92)' : 'rgba(10,30,80,0.75)'; g.fillRect(212, 646, 368, 40);
      g.strokeStyle = on ? '#ffd23c' : 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.strokeRect(212, 646, 368, 40);
      text('SEARCH', 226, 666, 14, '#9fd8ff');
      text(q + (on && (t * 2 | 0) % 2 ? '_' : ''), 292, 666, 20, '#fff');
      const info = this.noMatch ? 'no match' : `${this.order.length} song${this.order.length === 1 ? '' : 's'}`;
      text(info, 570, 659, 13, this.noMatch ? '#ff9090' : '#cfe', 'right', 'normal');
      text(on ? 'Enter: done  Esc: clear' : 'S: change  Esc: clear', 570, 676, 11, '#9fb8d8', 'right', 'normal');
    }
    if (this.stage) this.drawStage(t);
    if (this.join) {
      const j = this.join, bh = 120 + j.list.length * 44;
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ff7aa8'; g.fillRect(440, 300 - bh / 2 - 8, 400, bh + 16);
      g.fillStyle = '#16307a'; g.fillRect(448, 300 - bh / 2, 384, bh);
      text('PLAYER 2', 640, 300 - bh / 2 + 36, 30, '#ffc0d8', 'center');
      j.list.forEach((name, i) => {
        const y = 300 - bh / 2 + 84 + i * 44, on = i === j.i;
        if (on) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(470, y - 19, 340, 38); }
        let label = name;
        if (name !== 'GUEST' && name !== '1 PLAYER ONLY') label += `   ${DATA.profiles[name].points || 0} pts`;
        text(label, 640, y, 22, on ? '#ffd23c' : '#fff', 'center');
      });
      text('Enter: choose    Esc: cancel', 640, 300 + bh / 2 - 22, 15, '#cfe', 'center', 'normal');
    }
  },
  // HP4's SELECT MUSIC (select/selMusic_us.bin), drawn from its two layout blocks (tracks 0 in, 1 out):
  // block 0 (0xa24e0) the top - "SELECT MUSIC" in its pink tab (101, 44), the song's name box (320, 52), BPM
  // (520, 54) with its digits (600, 53), the stage number (408, 52), the big panel behind the jackets (860 x
  // 260 around 320, 142: cyan, green, yellow or blue), SORT (213, 237) with its order word, the scroll bar
  // ends (135 / 505, 254) and the arrows (80 / 560, 236); block 1 (0xc50a0) the lower half - the radar (160,
  // 356; axes 48 long: STREAM up, then CHAOS, FREEZE, AIR, VOLTAGE clockwise), the four difficulty bars
  // (405, 298 / 333 / 368 / 403) with the level as up to 10 feet (442 + 8n) in the difficulty's colour, the
  // grade (314) and full-combo crown (290), and each player's marker (570.5). Its parts 0-5 / 32-43 are the
  // course list (not on this screen).
  drawHP4(t) {
    const H4 = this.h4 || (this.h4 = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('mus', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.stageNo, H4.titles, H4.sorts, H4.panels, H4.feet, H4.grades, H4.crowns, H4.radarLbl] = await Promise.all(
        ['/0/0/0/0', '/0/0/0/4', '/0/0/0/7', '/0/0/0/3', '/0/1/0/24', '/0/1/0/22', '/0/1/0/23', '/0/1/0/7'].map(one));
      // SELECT STAGE (select_bin group 3): the names (/3/0/0/7: stages 0-7, 8 RANDOM), the title, the
      // pictures (/3/1/0/0, the same order) and the chosen one's window (/3/1/0/1)
      const sel = p => A.tplOf('sel', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.stgNames, H4.stgTitle, H4.stgPics, H4.stgWin, H4.stgBar] = await Promise.all(['/3/0/0/7', '/3/0/0/6', '/3/1/0/0', '/3/1/0/1', '/3/0/0/0'].map(sel));
      H4.ok = true;
    })();
    // (still reading the screen's pictures / layout from the disc - only on the first visit: just the
    // background, and the build-in starts once they're in, rather than the plain layout for a moment)
    if (!H4.ok || !CAE.block('mus', 0) || !CAE.block('mus', 1)) { CAE.load('mus'); this.enteredAt = performance.now(); menuBackground(t); return true; }
    menuBackground(t);
    const song = this.song();
    if (performance.now() - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const out = LEAVE && LEAVE.from === this, tk = out ? 1 : 0, f = out ? caeFrame(LEAVE.t0) : caeFrame(this.enteredAt || 0);
    const bpm = song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    // block 0: everything but the dummies; the name box shows the song's title, the digits the BPM
    const n = this.order.length, pos = n > 1 ? this.idx / (n - 1) : 0;
    if (!H4.blank) { H4.blank = document.createElement('canvas'); H4.blank.width = H4.blank.height = 1; }
    // (part 5 is a copy of the title, 0 mo_num_01 a number badge this screen doesn't use; the name box and
    // the BPM digit are placeholders the game writes over; handle 11 is the scroll thumb, 9 / 10 the ends)
    CAE.draw('mus', 0, tk, f, {
      skip: new Set([0, 5, 16]),
      state: (i, p, st) => { if (i === 11) st.x += pos * 370; },
      pic: (i, p) => p.name === 'musi_panel_musi' ? H4.panels[0] : p.name === 'sele_musi_title' ? H4.titles[this.favOnly ? 1 : 0]
        : p.name === 'sort_def01_US' ? H4.sorts[0] : p.name === 'music_name01' || p.name === 'Num_00' || i === 17 ? H4.blank : null,
      after: (i, p) => {
        if (i === 17) {                     // the STAGE box: the chosen stage's name (CselStage's choice)
          const v = S.hp4Stage === 'random' ? 8 : +S.hp4Stage, im = H4.stgNames && H4.stgNames[v];
          if (im) { const sc = Math.min(1, 150 / im.width, 26 / im.height); g.drawImage(im, -im.width * sc / 2, -im.height * sc / 2, im.width * sc, im.height * sc); }
        }
        if (p.name === 'music_name01') {
          const ti = texture('title', song.title);
          g.fillStyle = 'rgba(0,0,0,0.0)';
          if (ti.img) { const w = Math.min(220, ti.img.width), h = ti.img.height * w / ti.img.width; g.drawImage(ti.img, -w / 2, -h / 2, w, h); }
          else { g.font = 'bold 16px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(song.name.slice(0, 26), 0, -5); g.font = '11px "Segoe UI", Arial, sans-serif'; g.fillText((song.artist || '').slice(0, 34), 0, 11); }
        }
        if (p.name === 'Num_00') { g.font = 'bold 34px "Segoe UI", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(song.random ? '???' : bpm, 14, 1); }
      },
    });
    this.jacketRowHP4(t, song, tk, f);
    // block 1: the radar, its labels, the difficulty bars, feet, grade, crown and markers
    const lv = levelsOf(song), rowOf = d => [4, 1, 2, 3].indexOf(d), myRow = rowOf(S.diff);
    const show = new Set([6, 7, 8, 9, 10, 11]);
    [12, 13, 14, 15].forEach((pi, r) => { if (lv[r] > 0) show.add(pi); });
    const feetN = {}, recs = {};
    [0, 1, 2, 3].forEach(r => {
      if (!(lv[r] > 0)) return;
      for (let q = 0; q < 10; q++) { show.add(52 + r * 10 + q); feetN[52 + r * 10 + q] = q < Math.min(10, lv[r]) ? r + 1 : 0; }
      const rec = recordOf(song, [4, 1, 2, 3][r]);
      if (rec && rec.grade) { show.add(44 + r); recs[44 + r] = rec; if (rec.fc) { show.add(48 + r); recs[48 + r] = rec; } }
    });
    if (myRow >= 0 && lv[myRow] > 0) show.add(16 + myRow);
    if (P2) { const r2 = rowOf(P2.diff); if (r2 >= 0 && lv[r2] > 0) show.add(20 + r2); }
    // the lower half's views (0x80076c60): 0 radar + bars, 1 a course's six songs (parts 0-5 numbers,
    // 32-37 names, 38-43 panels - nothing else), 2 SELECT RECORD's record window (no radar parts 6-11;
    // block 6 drawn over it)
    const cur = this.order[this.idx], cSongs = cur && cur.special === 'hp4course' ? cur.course.slots.map(sl => songForSlot(sl)).filter(Boolean) : [];
    const view = this.recView === 1 && cSongs.length ? 1 : this.records ? 2 : 0;
    if (view === 2) for (let q = 6; q < 12; q++) show.delete(q);
    if (view === 1) { show.clear(); cSongs.slice(0, 6).forEach((s2, k) => { show.add(k); show.add(32 + k); show.add(38 + k); }); }
    CAE.draw('mus', 1, tk, f, {
      only: [...show],
      pic: (i, p) => {
        if (view === 1 && i >= 32 && i < 38) { const ti = texture('title', cSongs[i - 32].title); return ti.img || null; }
        if (i >= 52 && i <= 91) return H4.feet[feetN[i]] || null;
        if (i >= 44 && i <= 47) return H4.grades[['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(recs[i].grade)] || null;
        if (i >= 48 && i <= 51) { const fc = recs[i].fc; return H4.crowns[fc === 5 ? 0 : fc === 4 ? 1 : fc === 3 ? 2 : 3] || null; }
        return null;
      },
      after: (i, p, st) => {
        if (i !== 6) return;
        // the radar's shape for each difficulty the song has (selected one filled), on its 48-long axes
        const RCOL = { 4: '#40e0ff', 1: '#ffe040', 2: '#ff50c8', 3: '#40f070' };
        const ox = st.px - 83 + 0, oy = 0;
        DIFFS.slice(0, 4).forEach(([d], r) => {
          const rv = (song.radar || [])[r];
          if (!rv || !(lv[r] > 0)) return;
          const vals = [rv[1], rv[0], rv[4], rv[3], rv[2]];
          g.beginPath();
          vals.forEach((v, k) => { const ang = -Math.PI / 2 + k * 2 * Math.PI / 5, rr = 48 * Math.min(1, Math.max(0.03, v / 100)); const x = ox + Math.cos(ang) * rr, y = oy + Math.sin(ang) * rr; if (k) g.lineTo(x, y); else g.moveTo(x, y); });
          g.closePath();
          if (d === S.diff) { g.fillStyle = RCOL[d] + '77'; g.fill(); g.lineWidth = 2; } else g.lineWidth = 1;
          g.strokeStyle = RCOL[d]; g.stroke();
        });
      },
    });
    if (view === 2) this.drawRecordWindow(song, tk, f, H4);
    if (this.taskWin) this.drawTaskWin();
    if (!drawPointsPlate()) text(String(SAVE.points).padStart(7, '0') + ' pts', 28, 678, 24, '#ffe86a');
    keyHints(this.records ? 'Left/Right: music    Up/Down: difficulty    1: style    Shift+1: dance    M: course songs    Esc: back'
      : 'Left/Right: music    Up/Down: difficulty    Enter: confirm    Esc: back    Tab: options    S: search    Q: favorite    T: stage' + (this.hp4List === 'course' ? '    M: course songs' : ''));
    if (this.stgPick) this.drawStagePick(t, H4);
    if (this.note && performance.now() - this.noteAt < 2000) text(this.note, 400, 620, 18, '#c00030', 'center');
    if (this.typing !== null || this.query) {
      const on = this.typing !== null, q = on ? this.typing : this.query;
      g.fillStyle = 'rgba(10,30,80,0.9)'; g.fillRect(212, 646, 368, 40);
      text('SEARCH', 226, 666, 14, '#9fd8ff'); text(q + (on && (t * 2 | 0) % 2 ? '_' : ''), 292, 666, 20, '#fff');
    }
    if (this.stage) this.drawStage(t);
    return !this.join;
  },
  // HP4's SELECT STAGE window (class CselStage, main.dol 0x8005bdec-; select_bin group 3). Its list
  // (0x8005d7d8) is RANDOM, then stages 0-7 (Night Cruising ... Infernal White = STG001-008); choosing
  // writes the stage (RANDOM -> code 1000: the draw among stages 0-5), 0x8005d184. Songs with their own
  // stage keep it. The pictures and names are the disc's; where the game places them on this window is
  // set in its code (the layout block has no tracks for them) and isn't traced: they are laid out in a row.
  // HP4's SELECT STAGE (select_bin_us.bin /3, drawn the game's 3D way - CAE.draw3d): block 23 (/3/0) the window -
  // title, message window, the chosen stage's name (sprite 7, one picture a stage), arrows; block 25 (/3/2) ten
  // places 80 apart at y 161 (place 4 = the middle, the chosen stage; track 0 in over 31 frames, 2 still, 4 one
  // step on over 6 frames); block 24 (/3/1) a stage in a place - its picture (sprite 0, one a stage) and the
  // selection window: track 0 the chosen one (facing front, x1, turning to it over 4 frames), 1 left of it and 2
  // right of it (turned -40 / +40 about Y, x0.8 - the carousel look through the layout camera), 3 the chosen one
  // when picked (x1.4, turning 10, fading out over 21 frames).
  // SELECT RECORD's record window (selMusic block /0/6, filled by 0x80077c10): part 6 = the style (+0x1284:
  // NORMAL, PARTY (FRIENDSHIP), PARTY (SYNC), FAMILY A / B ...), 5 = the dance (+0x1288: CLASSIC, Wii Balance
  // Board, CHOREOGRAPH), 3 = the grade (cell = [6,5,4,3,2,1,0][rank], hidden with no record), 2 = the best max
  // combo (3 digits), 1 = the best score (9 digits). Part 0 = the crown (below), 7-9 the no-Nunchuk marks. Tiles that aren't songs show it empty.
  // CHALLENGE TASK's window (the tile 0x83; class 0x8010eda4 / 0x8010f984, from your disc): comAF_US.bin /8/0 -
  // part 0 the heading, 1 the panel, 2 the song's title picture (the title sheet, cell = the song, 0x88 = ANY
  // SONG), 3 its message (picture 0 a specified song, 1 any song), 6 + the number at 9 = your DDR points (parts
  // 4 / 5 / 7 / 8 and their numbers only after a play); the /8/1 CLEARED / TRY AGAIN
  // stamps on parts 14-17 play only on the results' task card (0x8010f178 state 2); on parts 10-13 the conditions' lines (text_eng group 15: 0-3 difficulty, 4-7 gauge, 8-11
  // combo, 12-16 rank), each with its bonus for the %s
  drawTaskWin() {
    const T = this.tw || (this.tw = {});
    if (!T.req) {
      T.req = true; CAE.load('af');
      const pics = n => A.tplOf('af', n).then(x => x.map(q => q.canvas)).catch(() => []);
      Promise.all([api('/api/hp4tasktext').catch(() => null), pics('/8/0/0/0'), pics('/8/0/0/1'), pics('/8/0/0/3'), pics('/8/0/0/6'), pics('/8/1/0/0')])
        .then(([tx, p0, p1, p3, p6, rw]) => { Object.assign(T, { lines: (tx && tx.lines) || [], p0, p1, p3, p6, row: rw, ok: true }); });
    }
    if (!A.font && A.loadIntro && !T.fontReq) { T.fontReq = true; A.loadIntro().catch(() => {}); }   // (the game's font)
    const MB = 0x722a60, RB = 0x734e20;
    g.save(); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, W, H); g.restore();
    const k = ctTask(SAVE);
    if (!T.ok || !k || !CAE.block('af', MB) || !CAE.block('af', RB)) return;
    const f = Math.min(CAE.len('af', MB, 0), (performance.now() - this.taskWin) / 1000 * 30);
    const song = k.songId >= 0 ? songForSlot(k.songId + 1) : null;
    const tp = texture('title', song ? song.title : 0x88);
    const blank = this.twBlank || (this.twBlank = document.createElement('canvas'));
    const main = CAE.block('af', MB);
    CAE.draw('af', MB, 0, f, {
      only: [0, 1, 2, 3, 6, 9],
      pic: (i, p) => i === 0 ? (T.p0 && T.p0[0]) || null : i === 1 ? (T.p1 && T.p1[0]) || null
        : i === 2 ? (tp && tp.img) || blank : i === 3 ? (T.p3 && T.p3[song ? 0 : 1]) || null
        : i === 6 ? (T.p6 && T.p6[0]) || null : i === 9 ? blank : null,
      after: (i, p) => { if (i === 9) num28(String(Math.min(SAVE.points || 0, 9999999)), 0, 0, 26, 'right'); },
    });
    // the four conditions: index into the window's lines (0x8010f984) and the bonus each would give
    const idx = [k.dl <= 3 ? k.dl : 3, { 60: 4, 75: 5, 90: 6, 100: 7 }[k.gv], k.cv < 0 ? 11 : { 50: 8, 100: 9, 200: 10 }[k.cv], { 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 }[k.rv]];
    for (let r = 0; r < 4; r++) {
      const at = CAE.at(main.parts[10 + r], 0, f), ln = T.lines[idx[r]], row = k.rows[r];
      // (printf: %s = the bonus, %% = a percent sign; the line breaks are in the text. Drawn in the game's font
      // (font_us.bin) at the text object's size: letters 20 high, lines 24 apart (0x800ed284: +0xa8 / +0xac),
      // no extra gap, times the part's scale (0x800ed720 -> 0x800ab9c4), its top-left at the part)
      if (at && ln && row && (at.alpha === undefined || at.alpha > 0)) {
        const sz = 20 * (at.sx || 1) * WS;
        gtext(ln.replace('%s', String(row.pts)).replace(/%%/g, '%'), WX(at.x), WY(at.y) + sz / 2, sz, '#fff', 'left', 0, 24 / 20);
      }
    }
  },
  drawRecordWindow(song, tk, f, H4) {
    const RW = this.rw || (this.rw = {});
    if (!RW.req) { RW.req = true; Promise.all([2, 4, 5, 0].map(sp => A.tplOf('mus', '/0/6/0/' + sp).then(x => x.map(q => q.canvas)).catch(() => []))).then(([gr, dn, st, cr]) => { RW.grades = gr; RW.dances = dn; RW.styles = st; RW.crowns = cr; RW.ok = true; }); }
    if (!RW.ok || !CAE.block('mus', 6)) return;
    const style = this.recStyle || 0, dance = this.recDance || 0;
    const kind = ['single', 'board', 'choreo'][dance];
    const rec = song && !song.folderTile && !song.random && style === 0 && song.slot !== undefined && SAVE.records ? SAVE.records[recKey(song.slot, styleNow(), S.diff, kind)] || null : null;
    const rank = rec && rec.grade ? ['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(rec.grade) : -1;
    // the crown (part 0): the best full combo - the save's clear byte 1-4 (GOOD / GREAT / PERFECT / MARVELOUS full
    // combo, 0x8008b9c8 from the play's full-combo tier) through the cell table 0x80257f58 [-, 3, 1, 0, 2]. Parts 7-9
    // are the no-Nunchuk marks (save flag bits 8 / 2|4 / 1: that best was set with no Nunchuk, step flag
    // +0x5792c from 0x800330cc) - never on the PC, whose hand markers are always bound
    const crown = rec && rec.fc >= 2 ? { 5: 2, 4: 0, 3: 1, 2: 3 }[rec.fc] : -1;
    const show = [1, 2, 4, 5, 6]; if (rank >= 0) show.push(3); if (crown >= 0) show.push(0);
    CAE.draw('mus', 6, tk, f, {
      only: show,
      pic: (i, p) => i === 0 ? (RW.crowns && RW.crowns[crown]) || null : i === 3 ? RW.grades[rank] || null : i === 5 ? RW.dances[dance] || null : i === 6 ? RW.styles[style] || null : null,
      after: (i, p, st) => {
        if (p.name !== 'Num_00') return;
        const v = i === 1 ? (rec ? rec.score || 0 : 0) : (rec ? rec.maxCombo || 0 : 0), n = i === 1 ? 9 : 3;
        num28(String(Math.min(v, 10 ** n - 1)).padStart(n, ' '), 0, 0, 26, 'right');
      },
    });
  },
  drawStagePick(t, H4) {
    const q = this.stgPick, L = HP4_STAGE_LIST, n = L.length, now = performance.now();
    if (!CAE.block('sel', 23) || !CAE.block('sel', 24) || !CAE.block('sel', 25)) return;
    const f0 = (now - q.at) / 1000 * 30, since = (now - (q.moved || 0)) / 1000 * 30;
    const dec = q.decided ? (now - q.decided) / 1000 * 30 : -1;
    if (dec > 21) { this.stgPick = null; return; }
    const nm = H4.stgNames && H4.stgNames[L[q.i]];
    CAE.draw3d('sel', 23, 0, Math.min(f0, 31), { pic: (i, p) => p.sprite === 7 ? nm : null });
    const slide = since < 6 ? (1 - since / 6) * 80 * (q.dir || 1) : 0;
    const B25 = CAE.block('sel', 25);
    for (let k = 0; k < 10; k++) {
      const pl = CAE.at(B25.parts[k], f0 < 31 ? 0 : 2, f0 < 31 ? f0 : 0);
      if (!pl || pl.alpha <= 0 && f0 >= 31) continue;
      const rel = k - 4, v = L[((q.i + rel) % n + n) % n], im = H4.stgPics && H4.stgPics[v];
      if (rel > 4 || rel < -4) continue;
      const tr = dec >= 0 && rel === 0 ? 3 : rel === 0 ? 0 : rel < 0 ? 1 : 2;
      const ff = tr === 3 ? dec : tr === 0 ? Math.min(since, 4) : 0;
      const px = pl.x + slide, py = pl.y, ps = pl.sx || 0.9, pa = (pl.alpha === undefined ? 255 : pl.alpha) / 255;
      CAE.draw3d('sel', 24, tr, ff, {
        pic: (i, p) => p.sprite === 0 ? im : null,
        state: (i, p, st) => { st.x = (st.x || 0) * ps + px; st.y = (st.y || 0) * ps + py; st.sx *= ps; st.sy *= ps; st.alpha *= pa; },
      });
    }
  },
  // HP4's jacket row (selMusic_us.bin): block /0/4 (0x11c440) = 10 places 80 apart at y 151 (x 0-720; place
  // 4 = the middle, the chosen song: the row turns round it), each scaled 0.52; tracks 0 in (alpha 0-255 over
  // 31 frames), 1 out, 2 still, 4 one step on (every place moves 80 left over 6 frames). In each place block
  // /0/3 (0x119ee0, around the place): the green window (sele_wind_muwak, /0/3/0/3), the jacket (256 x 256,
  // where z3_cmn_jks_fift stands), its frame (/0/3/0/1: 0 yellow for the chosen song, 1 grey), the favourite
  // star (-70, -68) and the "Specified Song" sticker (48.6, 63.6, rotated -19, x2); its tracks 1 / 2 = a song
  // not chosen (x0.8), 0 = becoming the chosen one (0.8 -> 1 over 4 frames), 4 = chosen.
  jacketRowHP4(t, song, tk, f) {
    const H4 = this.h4j || (this.h4j = {});
    if (!H4.loading && A.tplOf) H4.loading = (async () => {
      const one = p => A.tplOf('mus', p).then(x => x.map(q => q.canvas)).catch(() => []);
      [H4.star, H4.frame, H4.win, H4.spec] = await Promise.all(['/0/3/0/0', '/0/3/0/1', '/0/3/0/3', '/0/3/0/4'].map(one));
      H4.ok = true;
    })();
    const PL = 0x11c440, JK = 0x119ee0, n = this.order.length;
    if (!H4.ok || !CAE.block('mus', PL) || !CAE.block('mus', JK)) { CAE.load('mus'); return; }     // (first visit: nothing until HP4's own pieces are in - not DDR II's plain jacket row for a moment)
    const since = (performance.now() - this.moved) / 1000 * 30;            // frames since the last move (30 a second)
    const slide = since < 6 && n > 1 ? (1 - since / 6) * 80 * (this.lastDir || 1) : 0;
    const at = q => this.order[((this.idx + q - 4) % n + n) % n];
    const ctk = SAVE ? ctTask(SAVE) : null;
    // a real song's jacket goes through the game's 3D way (CAE.draw3d): block /0/3 in the place, track 0 /
    // 4 chosen (facing), 1 left of it and 2 right of it (turned -40 / +40 about Y, set back / forward - the
    // carousel look through the layout camera). (RANDOM and the folders keep the flat drawing below.)
    const jackCv = s2 => {
      const jk = texture('jacket', s2.jacket); if (!jk.img) return null;
      const m = this.jackCache || (this.jackCache = new Map()), key = s2.jacket;
      if (m.has(key) && m.get(key).src === jk.img) return m.get(key).c;
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256); x.drawImage(jk.img, 8, 8, 240, 240);
      m.set(key, { src: jk.img, c }); return c;
    };
    const place3d = (q, sel, rel) => {
      const st = CAE.at(CAE.part('mus', PL, q), tk ? 1 : 0, f);
      if (!st) return false;
      const s2 = at(q);
      if (s2.random || s2.folderTile) return false;
      const jc = jackCv(s2); if (!jc) return false;
      const x = st.x + slide, y = st.y, ps = st.sx || 0.52, pa = (st.alpha ?? 255) / 255;
      if (x < -80 || x > 720) return true;
      const jt = sel ? (since < 4 ? 0 : 4) : rel < 0 ? 1 : 2, jf = sel ? (since < 4 ? since : 0) : 0;
      const spec = sel && ctk && !ctk.any && s2.slot && ctSongOk(ctk, s2.slot);
      const skip = new Set([...(isFav(s2) ? [] : [0]), ...(sel ? [] : [3]), ...(spec ? [] : [4])]);
      CAE.draw3d('mus', JK, jt, jf, {
        skip,
        pic: (i, p) => p.sprite === 2 ? jc : p.sprite === 1 ? H4.frame[sel ? 0 : 1] : p.sprite === 3 ? H4.win[0] : p.sprite === 0 ? H4.star[0] : p.sprite === 4 ? H4.spec[0] : null,
        state: (i, p, s3) => { s3.x = (s3.x || 0) * ps + x; s3.y = (s3.y || 0) * ps + y; s3.sx *= ps; s3.sy *= ps; s3.alpha *= pa; },
      });
      return true;
    };
    const place = (q, sel) => {
      if (place3d(q, sel, q - 4)) return;
      const st = CAE.at(CAE.part('mus', PL, q), tk ? 1 : 0, f);
      if (!st) return;
      const s2 = at(q), x = st.x + slide, y = st.y, sc0 = st.sx || 0.52;
      if (x < -80 || x > 720) return;
      // block /0/3 in this place: chosen (track 0 then 4) or not (track 2)
      const jt = sel ? 0 : 2, jf = sel ? Math.min(4, since) : 0, J = i => CAE.at(CAE.part('mus', JK, i), jt, jf);
      const fr = J(1), win = J(3), stS = J(0), sp = J(4);
      g.save(); g.globalAlpha *= (st.alpha ?? 255) / 255;
      g.translate(WX(x), WY(y)); g.scale(sc0 * WS, sc0 * WS);
      if (sel && win && H4.win[0]) { g.save(); g.scale(win.sx, win.sy); g.drawImage(H4.win[0], -140, -140, 280, 280); g.restore(); }
      const js = fr ? fr.sx : (sel ? 1 : 0.8);
      g.save(); g.scale(js, js);
      const jk = texture('jacket', s2.jacket);
      g.fillStyle = '#000'; g.fillRect(-120, -120, 240, 240);
      if (s2.random) this.drawRandomTile(-120, -120, 240, 240, t);
      else if (s2.folderTile) this.drawFolderTile(-120, -120, 240, 240, s2);
      else if (jk.img) g.drawImage(jk.img, -120, -120, 240, 240);
      else { g.font = 'bold 28px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(s2.name.slice(0, 14), 0, 0); }
      const fp = H4.frame[sel ? 0 : 1];
      if (fp) g.drawImage(fp, -128, -128, 256, 256);
      g.restore();
      if (isFav(s2) && H4.star[0] && stS) { g.save(); g.translate(stS.x, stS.y); g.scale(stS.sx, stS.sy); g.drawImage(H4.star[0], -32, -32); g.restore(); }
      if (sel && ctk && !ctk.any && !s2.random && !s2.folderTile && s2.slot && ctSongOk(ctk, s2.slot) && H4.spec[0] && sp) {
        g.save(); g.translate(sp.x, sp.y); g.rotate((sp.rot || 0) * Math.PI / 180); g.scale(sp.sx, sp.sy); g.drawImage(H4.spec[0], -64, -32); g.restore();
      }
      g.restore();
    };
    // the far places first, so the ones nearer the middle overlap them; the chosen song last
    if (n < 1) return;
    for (const q of [0, 8, 1, 7, 2, 6, 3, 5]) if (n > 1 || q === 4) place(q, false);
    if (slide && this.lastDir > 0) place(9, false);
    place(4, true);
  },
  // the jacket row (DDR II's and HP4's song select: the same place on both - HP4's selMusic block 0 dummy
  // at (320, 151), the panel behind it 860 x 260 around (320, 142))
  jacketRow(t, song, dy = 0) {
    // jacket row, like the game: nine places in a row; the cursor (a bigger jacket in an orange and
    // yellow frame) walks along it and the row scrolls only when the cursor reaches either end
    const since = Math.min(1, (performance.now() - this.moved) / 140);
    const n = this.order.length, big = 205, tw = 116, th = 130, step = 106, gap = 10, tileY = 160 + dy, bigY = 118 + dy;
    const slot = n <= 9 ? this.idx : Math.min(this.slot, n - 1), slide = n > 9 && this.scrolled ? (1 - since) * this.lastDir * step : 0;
    const x0 = 640 - (8 * step + big + 2 * gap) / 2;
    const xAt = p => p < slot ? x0 + p * step : p === slot ? x0 + slot * step + gap : x0 + (p - 1) * step + big + 2 * gap;
    const tile = (p, s2) => {
      const x = xAt(p) + slide;
      if (x < -tw || x > W) return;
      const jk = texture('jacket', s2.jacket), sk = p < slot ? 0.045 : -0.045;
      g.save(); g.transform(1, sk, 0, 1, x, tileY - (p < slot ? 0 : sk * tw));
      g.fillStyle = '#000'; g.fillRect(-3, -3, tw + 6, th + 6);
      if (s2.random) this.drawRandomTile(0, 0, tw, th, t);
      else if (s2.folderTile) this.drawFolderTile(0, 0, tw, th, s2);
      else if (jk.img) g.drawImage(jk.img, 0, 0, tw, th); else { g.fillStyle = '#123'; g.fillRect(0, 0, tw, th); text(s2.name.slice(0, 12), tw / 2, th / 2, 11, '#fff', 'center', 'normal'); }
      const gr = g.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, tw, th);
      if (isFav(s2)) drawStar(16, 16, 12, '#ffd23c');
      g.restore();
    };
    const at = p => this.order[((this.idx - slot + p) % n + n) % n];
    const count = Math.min(9, n);
    // far ones first so the tiles nearer the cursor overlap them
    for (let p = 0; p < slot; p++) tile(p, at(p));
    for (let p = count - 1; p > slot; p--) tile(p, at(p));
    const pop = 0.92 + 0.08 * since, jk = texture('jacket', song.jacket), cx = xAt(slot) + big / 2;
    g.save(); g.translate(cx, bigY + big / 2); g.scale(pop, pop);
    const P = A.pop || {};
    if (P.curBack) g.drawImage(P.curBack, -big / 2 - 16, -big / 2 - 16, big + 32, big + 32);
    else { g.fillStyle = '#ff6a10'; g.fillRect(-big / 2 - 12, -big / 2 - 12, big + 24, big + 24); }
    g.fillStyle = '#000'; g.fillRect(-big / 2 - 2, -big / 2 - 2, big + 4, big + 4);
    if (song.random) this.drawRandomTile(-big / 2, -big / 2, big, big, t);
    else if (song.folderTile) this.drawFolderTile(-big / 2, -big / 2, big, big, song);
    else if (jk.img) g.drawImage(jk.img, -big / 2, -big / 2, big, big); else text(song.name.slice(0, 16), 0, 0, 15, '#fff', 'center');
    if (P.curFrame) g.drawImage(P.curFrame, -big / 2 - 6, -big / 2 - 6, big + 12, big + 12);
    if (isFav(song)) drawStar(-big / 2 + 26, -big / 2 + 28, 20, '#ffd23c');
    // the challenge task's song gets the game's "Specified Song" sticker (selMusic_us.bin /0/3/0/4),
    // over the jacket's lower right, tilted (placed from the Wii's song select)
    const ctk = !song.random && !song.folderTile && SAVE ? ctTask(SAVE) : null;
    if (ctk && !ctk.any && song.slot && ctSongOk(ctk, song.slot)) {
      if (A.specSong === undefined && A.tplOf) {
        A.specSong = null;
        A.tplOf('mus', '/0/3/0/4').then(t => { A.specSong = t[0] ? t[0].canvas : null; }).catch(() => {});
      }
      if (A.specSong) {
        g.save(); g.translate(big * 0.14, big * 0.2); g.rotate(-0.42);
        const bw = big * 0.86, bh = bw * A.specSong.height / A.specSong.width;
        g.drawImage(A.specSong, -bw / 2, -bh / 2, bw, bh); g.restore();
      }
    }
    g.restore();
  },
  // Hottest Party's song select, built from its own pictures (data/ddrmodesel.bin, selcom.bin):
  // the song on the left (banner frame, BPM, stage, the four difficulty bars with your grade and the
  // level in feet), the songs as tabs on the right over the cream curve, a scroll bar at the edge
  drawHP(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp2Sel() ? hp2SelUI() : hpUI();
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const im = (img, x, y, w, h) => { if (img && img.complete && img.naturalWidth) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const ital = (str, x, y, size, col, align = 'left', stroke = '#5a1a00') => {
      g.font = `italic 900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = stroke; g.strokeText(str, x, y);
      g.fillStyle = col; g.fillText(str, x, y);
    };
    // the cream curve behind the list
    if (U.hp2) im(U.curve, 800, 0, 480, 720); else im(U.curve, 760, 0, 520, 720);
    // header
    if (!(U.hp2 ? im(U.header, 0, 6, 832, 96) : im(U.header, 0, 0, 900, 93))) ital('SELECT MUSIC', 40, 34, 32, '#fff');
    // ---- the song: banner frame (banner, BPM, stage)
    const fx = 170, fy = 82, fw = 339, fh = 255, kx = fw / 226, ky = fh / 170;
    im(U.frame, fx, fy, fw, fh);
    // the picture's screen: HP1's frame has a banner window at the top; HP2's frame is all screen
    const bx = U.hp2 ? fx + 0.06 * fw : fx + 12 * kx, by = U.hp2 ? fy + 0.15 * fh : fy + 21 * ky,
          bw = U.hp2 ? 0.80 * fw : 202 * kx, bh = U.hp2 ? 0.72 * fh : 99 * ky;
    if (song.random) this.drawRandomTile(bx, by, bw, bh, t);
    else if (song.folderTile) this.drawFolderTile(bx, by, bw, bh, song);
    else {
      const jk = texture('jacket', song.jacket);
      const sq = U.hp2 && texture('jacket', song.jacket);
      if (sq && sq.img) {                                  // HP2's screen: the song's tile (its design and name tab)
        const k = Math.max(bw / sq.img.width, bh / sq.img.height), sw = bw / k, sh = bh / k;
        g.drawImage(sq.img, (sq.img.width - sw) / 2, (sq.img.height - sh) / 2, sw, sh, bx, by, bw, bh);
      } else if (jk && jk.img && song.disc === 'hp2') {            // HP2's art is the song's name tab: on a dark panel
        g.fillStyle = '#1a1030'; g.fillRect(bx, by, bw, bh);
        const sc = Math.min(bw / jk.img.width, bh / jk.img.height) * 0.95;
        g.drawImage(jk.img, bx + bw / 2 - jk.img.width * sc / 2, by + bh / 2 - jk.img.height * sc / 2, jk.img.width * sc, jk.img.height * sc);
      } else if (jk && jk.img) g.drawImage(jk.img, 0, jk.img.height * 0.27, jk.img.width, jk.img.height * 0.46, bx, by, bw, bh);
    }
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + ' - ' + song.bpm[1];
    if (U.hp2) {                                  // BPM under the screen
      ital('BPM', fx + fw + 14, fy + fh - 46, 18, '#ffe14a', 'left', '#3a2400');
      ital(bpm, fx + fw + 14, fy + fh - 20, 24, '#fff', 'left', '#000');
    } else {
      ital(bpm, fx + 78 * kx, fy + 131 * ky, 21, '#fff', 'left', '#000');
      ital(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', fx + 12 * kx, fy + 152 * ky, 19, '#fff', 'left', '#000');
    }
    // ---- difficulties: the game's bars, your grade on the left, the level in feet on the right
    const lv = levelsOf(song), FOOT = { 4: '#3cc8ff', 1: '#ff9a2a', 2: '#ff4ad0', 3: '#46e04a' };
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, y = 352 + i * 72, on = S.diff === d && !song.random;
      const x = on ? 76 : 96, w = U.hp2 ? 440 : 450, h = U.hp2 ? 76 : 70;
      g.globalAlpha = lvl || song.random ? 1 : 0.4;
      if (!im(U.diff[i], x, y, w, h)) { g.fillStyle = FOOT[d]; g.fillRect(x, y, w, h); ital(DIFFS[di][1], x + 80, y + h / 2, 24, '#fff'); }
      if (on) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.roundRect ? g.roundRect(x + 3, y + 3, w - 18, h - 14, 26) : g.rect(x + 3, y + 3, w - 18, h - 14); g.stroke(); }
      // feet: 10, lit up to the level (HP2's bars have dark feet printed on them: light those up)
      if (U.hp2) for (let k = 0; k < Math.min(10, lvl); k++) {
        const fh2 = h * 0.5, fw2 = fh2 * 20 / 26, fx2 = x + w * (0.584 + k * 0.0372), fy2 = y + h * 0.24;
        if (U.foot && U.foot.complete && U.foot.naturalWidth) { tintFoot(U.foot, FOOT[d]); g.drawImage(tintFoot.cv, fx2, fy2, fw2, fh2); }
      }
      else for (let k = 0; k < 10; k++) {
        const fx2 = x + 262 + k * 16, fy2 = y + 18;
        g.save();
        g.globalAlpha *= k < lvl ? 1 : 0.35;
        if (U.foot && U.foot.complete && U.foot.naturalWidth) { tintFoot(U.foot, FOOT[d]); g.drawImage(tintFoot.cv, fx2, fy2, 15, 22); }
        else { g.fillStyle = FOOT[d]; g.fillRect(fx2 + 3, fy2 + 4, 12, 20); }
        g.restore();
      }
      // your best grade on this chart
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? { E: 1, D: 2, C: 3, B: 4, A: 5, AA: 6, AAA: 7 }[rec.grade] : 0;
      if (gi && U.grades[gi - 1]) im(U.grades[gi - 1], x - 4, y - 4, 74, 70);
      g.globalAlpha = 1;
      if (on) {                                   // the player's cursor
        if (!im(U.p1, x + w - 12, y + 18, 34, 34)) { g.fillStyle = '#ffe000'; g.beginPath(); g.arc(x + w + 4, y + 35, 16, 0, Math.PI * 2); g.fill(); }
      }
    });
    im(U.down, 310, 646, 50, 50);
    // ---- the list
    const n = this.order.length, rowH = 112, cy = 360;
    const anim = clamp((now - this.moved) / 120), shift = (1 - anim) * (this.lastDir || 0) * rowH;
    g.save(); g.beginPath(); g.rect(780, 60, 470, 600); g.clip();
    for (let k = -3; k <= 3; k++) {
      const i = ((this.idx + k) % n + n) % n, s2 = this.order[i], on = k === 0;
      const y = cy + k * rowH + shift - 42, x = 850 + Math.abs(k) * 6, w = 360, h = 86;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(-0.03); g.translate(-(x + w / 2), -(y + h / 2));
      if (!im(on && U.tileOn ? U.tileOn : U.tile, x, y, w, h)) { g.fillStyle = '#ff5a1a'; g.fillRect(x, y, w, h); }
      if (s2.random) ital('RANDOM', x + w / 2, y + h / 2, 34, rainbowAt(t), 'center', '#3a0060');
      else if (s2.folderTile) {                    // a folder: another game's songs, or your custom songs
        ital(s2.name.length > 24 ? s2.name.slice(0, 23) + '…' : s2.name, x + w / 2, y + 34, s2.name.length > 18 ? 20 : 26, '#fff7a0', 'center', '#3a0a00');
        ital(s2.count + ' songs  ▶', x + w / 2, y + 62, 15, '#fff', 'center', '#3a0a00');
      }
      else {
        const jt = s2.disc === 'hp2' ? texture('raw', s2.tab || s2.jacket) : null;
        const ti = s2.disc === 'hp' ? U.titles[s2.slot - 1000] : jt && jt.img ? jt.img : null;
        if (!(ti && (U.hp2 && s2.disc === 'hp2' ? im(ti, x, y, w, h) : im(ti, x + w / 2 - 172, y + h / 2 - 34, 344, 69)))) {
          ital(s2.name.slice(0, 26), x + w / 2, y + 32, 22, '#ffe14a', 'center', '#3a0a00');
          if (s2.artist) ital(s2.artist.slice(0, 30), x + w / 2, y + 60, 15, '#fff', 'center', '#3a0a00');
        }
      }
      g.restore();
      if (on) {                                    // the green frame and its pointer
        if (!im(U.sel, x - 20, y - 14, w + 40, h + 28)) { g.strokeStyle = '#3cff5a'; g.lineWidth = 6; g.strokeRect(x - 6, y - 6, w + 12, h + 12); }
      }
    }
    g.restore();
    im(U.up, 1010, 62, 50, 50); im(U.down, 1010, 606, 50, 50);
    // scroll bar
    if (!im(U.track, 1236, 66, 34, 590)) { g.fillStyle = U.hp2 ? '#5a3a00' : '#4a0a00'; g.fillRect(1240, 66, 22, 590); }
    im(U.thumb, 1238, 70 + 500 * (this.idx / Math.max(1, n - 1)), 30, 80);
    // controls, as the game's dark tabs
    const hints = [['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['S', 'SEARCH'], ['Left/Right', 'DIFFICULTY'], ['Up/Down', 'MUSIC'], ['Tab', 'OPTIONS']];
    hints.forEach(([k, l], i) => {
      const x = 640 + (i % 3) * 212, y = 668 + Math.floor(i / 3) * 28, w = 204;
      g.fillStyle = 'rgba(40,40,40,0.85)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 12, w, 24, 12) : g.rect(x, y - 12, w, 24); g.fill();
      g.font = 'bold 13px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 10, y);
      ital(l, x + w - 10, y, 14, '#fff', 'right', '#000');
    });
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 620, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },

  // Hottest Party 2's song select, laid out from a recording of the real game (Wii pictures are drawn
  // 4:3 and stretched to widescreen, so they're a third wider here than on the disc)
  drawHP2(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp2SelUI();
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const im = (img, x, y, w, h) => { if (img && img.complete && img.naturalWidth) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const lbl = (str, x, y, size, col = '#fff', align = 'left') => {
      g.font = `900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = '#1a1030'; g.strokeText(str, x, y); g.fillStyle = col; g.fillText(str, x, y);
    };
    // the gold panel on the right (its curved edge), the list's scroll bar, and the bottom band
    im(U.curve, 760, 50, 560, 672);
    g.fillStyle = 'rgba(30,20,0,0.85)'; g.fillRect(1258, 130, 14, 520);
    im(U.thumb, 1252, 130 + 410 * (this.idx / Math.max(1, this.order.length - 1)), 26, 110);
    // ---- the list: song tabs on a gentle arc, the cursor's in the green frame
    const n = this.order.length, rowH = 115, cy = 349;
    const anim = clamp((now - this.moved) / 120), shift = (1 - anim) * (this.lastDir || 0) * rowH;
    g.save(); g.beginPath(); g.rect(820, 60, 430, 610); g.clip();
    for (let k = -3; k <= 3; k++) {
      const i = ((this.idx + k) % n + n) % n, s2 = this.order[i], on = k === 0;
      const w = 354, h = 85, x = 868 + Math.abs(k) * 4, y = cy + k * rowH + shift - h / 2;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(0.035 * (k + (on ? 0 : -shift / rowH))); g.translate(-(x + w / 2), -(y + h / 2));
      if (on) im(U.sel, x - 16, y - 12, w + 34, h + 26);
      if (!im(U.tile, x, y, w, h)) { g.fillStyle = '#ff4a1a'; g.fillRect(x, y, w, h); }
      if (s2.random) lbl('RANDOM', x + w / 2, y + h / 2, 30, rainbowAt(t), 'center');
      else if (s2.folderTile) {
        lbl(s2.name, x + w / 2, y + 32, fitSize(s2.name, 26, w - 30), '#fff7a0', 'center');
        lbl(s2.count + ' songs  ▶', x + w / 2, y + 62, 15, '#fff', 'center');
      } else {
        const tab = s2.disc === 'hp2' ? texture('raw', s2.tab || s2.jacket) : null;
        const hp1 = s2.disc === 'hp' ? hpUI().titles[s2.slot - 1000] : null;
        if (!(tab && tab.img ? (g.drawImage(tab.img, x, y, w, h), true) : hp1 && im(hp1, x + 8, y + 6, w - 16, h - 12))) {
          lbl(s2.name, x + w / 2, y + 32, fitSize(s2.name, 26, w - 30), '#ffe14a', 'center');
          if (s2.artist) lbl(s2.artist, x + w / 2, y + 62, fitSize(s2.artist, 16, w - 40), '#fff', 'center');
        }
      }
      g.restore();
    }
    g.restore();
    // ---- header: the gold band and the SELECT MUSIC tab
    if (!im(U.header, 0, -6, 1320, 118)) lbl('SELECT MUSIC', 90, 62, 40, '#fff');
    // ---- the song's box: its picture, then BPM and STAGE
    const bx = 110, by = 120, bw = 324, bh = 242;
    if (!im(U.info, bx, by, bw, bh)) { g.fillStyle = '#101028'; g.fillRect(bx, by, bw, bh); }
    const ax = bx + 6, ay = by + 12, aw = bw - 12, ah = 162;        // the box's white window (BPM and STAGE bars under it)
    if (song.random) this.drawRandomTile(ax, ay, aw, ah, t);
    else if (song.folderTile) this.drawFolderTile(ax, ay, aw, ah, song);
    else {
      // HP2's song picture fills the window, as in the game; other songs show their tile
      const raw = song.disc === 'hp2' ? texture('raw', song.jacket) : null, sq = texture('jacket', song.jacket);
      if (raw && raw.img) g.drawImage(raw.img, ax, ay, aw, ah);
      else if (sq && sq.img) { const k = Math.max(aw / sq.img.width, ah / sq.img.height), sw = aw / k, sh = ah / k;
        g.drawImage(sq.img, (sq.img.width - sw) / 2, (sq.img.height - sh) / 2, sw, sh, ax, ay, aw, ah); }
    }
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    lbl(bpm, bx + 155, by + 0.757 * bh, 20, '#fff');
    lbl('STAGE', bx + 34, by + 0.925 * bh, 18, '#fff'); lbl(':', bx + 128, by + 0.925 * bh, 18, '#fff');
    lbl(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', bx + 155, by + 0.925 * bh, 18, '#fff');
    // ---- difficulties: the four bars, feet lit to the level, your grade on the left, the 1P marker
    const lv = levelsOf(song), FOOT = { 4: '#3cc8ff', 1: '#ff9a2a', 2: '#ff4ad0', 3: '#46e04a' };
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, x = 116, y = 378 + i * 54, w = 401, h = 52, on = S.diff === d && !song.random;
      g.globalAlpha = lvl || song.random ? 1 : 0.4;
      if (!im(U.diff[i], x, y, w, h)) { g.fillStyle = FOOT[d]; g.fillRect(x, y, w, h); lbl(DIFFS[di][1], x + 80, y + h / 2, 22, '#fff'); }
      if (U.foot && U.foot.complete && U.foot.naturalWidth) {
        tintFoot(U.foot, FOOT[d]);
        for (let k = 0; k < Math.min(10, lvl); k++) g.drawImage(tintFoot.cv, x + w * (0.564 + k * 0.0374), y + h * 0.19, w * 0.045, h * 0.58);
      }
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? { E: 1, D: 2, C: 3, B: 4, A: 5, AA: 6, AAA: 7 }[rec.grade] : 0;
      if (gi && U.grades[gi - 1]) im(U.grades[gi - 1], x + 12, y - 4, 64, 54);
      g.globalAlpha = 1;
      if (on) {
        const bob = Math.sin(t * 6) * 2;
        if (!im(U.p1, x + w - 74 + bob, y + 10, 96, 31)) { g.fillStyle = '#3c78ff'; g.beginPath(); g.arc(x + w + 18, y + h / 2, 15, 0, Math.PI * 2); g.fill(); lbl('1', x + w + 18, y + h / 2, 16, '#fff', 'center'); }
      }
    });
    // ---- controls along the bottom band
    g.fillStyle = 'rgba(70,40,0,0.35)'; g.fillRect(0, 676, W, 44);
    const hints = [['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['Up/Down', 'MUSIC'], ['Left/Right', 'DIFFICULTY'], ['S', 'SEARCH'], ['Tab', 'OPTIONS']];
    hints.forEach(([k, l], i) => {
      const w = 196, x = 1280 - (hints.length - i) * (w + 6) - 8, y = 700;
      g.fillStyle = 'rgba(30,30,30,0.85)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 13, w, 26, 6) : g.rect(x, y - 13, w, 26); g.fill();
      g.font = 'bold 13px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 8, y);
      lbl(l, x + w - 8, y, 14, '#fff', 'right');
    });
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 640, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },
  // Hottest Party 3's song select, laid out from a recording of the real game: the orange panel with the
  // jacket row (the cursor's jacket big in the middle), title and artist above, BPM and STAGE under it,
  // the SORT bar, the radar on the left and the four difficulty bars on the right
  drawHP3(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp3SelUI(), n = this.order.length;
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const ok = im => im && im.complete && im.naturalWidth;
    const im = (img, x, y, w, h) => { if (ok(img)) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const lbl = (str, x, y, size, col = '#fff', align = 'center', stroke = '#1a2a6a') => {
      g.font = `900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = stroke; g.strokeText(str, x, y); g.fillStyle = col; g.fillText(str, x, y);
    };
    const tileOf = (s2, x, y, w, h) => {
      if (s2.random) this.drawRandomTile(x, y, w, h, t);
      else if (s2.folderTile) this.drawFolderTile(x, y, w, h, s2);
      else { const jk = texture('jacket', s2.jacket); if (jk && jk.img) g.drawImage(jk.img, x, y, w, h); else { g.fillStyle = '#123'; g.fillRect(x, y, w, h); lbl(s2.name.slice(0, 14), x + w / 2, y + h / 2, 13, '#fff'); } }
    };
    // clouds along the bottom
    im(U.clouds, -20, 600, 1320, 130);
    // ---- the orange panel and the jacket row
    if (!im(U.panel, 7, 24, 1265, 357)) { g.fillStyle = '#ffa020'; g.fillRect(7, 120, 1265, 260); }
    const at = k => this.order[((this.idx + k) % n + n) % n];
    const since = clamp((now - this.moved) / 140), slide = (1 - since) * (this.lastDir || 0);
    // side jackets: four each side, smaller and turned away the further out they are
    const SIDE = [[476, 346, 168, 150], [346, 223, 166, 146], [223, 119, 168, 140], [119, 33, 170, 136]];
    for (let k = 4; k >= 1; k--) {
      for (const dir of [-1, 1]) {
        const [x1, x0, y, h] = SIDE[k - 1], w = x1 - x0, sk = 0.05 * dir;
        const x = dir < 0 ? x0 + slide * 30 : 1280 - x1 + slide * 30;
        if (n < 2) continue;
        g.save(); g.transform(1, dir < 0 ? -sk : sk, 0, 1, x, y + (dir < 0 ? sk * w : 0));
        g.fillStyle = '#000'; g.fillRect(-4, -4, w + 8, h + 8);
        tileOf(at(dir * k), 0, 0, w, h);
        g.restore();
      }
    }
    // the cursor's jacket, big, in its yellow frame
    const bx = 536, by = 113, bw = 206, pop = 0.94 + 0.06 * since;
    g.save(); g.translate(bx + bw / 2, by + bw / 2); g.scale(pop, pop);
    g.fillStyle = '#000'; g.fillRect(-bw / 2 - 6, -bw / 2 - 6, bw + 12, bw + 12);
    tileOf(song, -bw / 2, -bw / 2, bw, bw);
    im(U.bigFrame, -bw / 2 - 14, -bw / 2 - 14, bw + 28, bw + 28);
    g.restore();
    // green arrows either side
    const bob = 0;
    if (ok(U.arrow)) {
      g.save(); g.translate(536 - 6 - bob, 214); g.scale(-1, 1); g.drawImage(U.arrow, 0, -48, 50, 96); g.restore();
      g.drawImage(U.arrow, 744 + 6 + bob, 166, 50, 96);
    }
    // title and artist above the jacket
    const title = song.random ? 'RANDOM' : song.folderTile ? song.name : song.name, artist = song.random || song.folderTile ? '' : (song.artist || '');
    lbl(title, 640, 50, fitSize(title, 30, 420), '#ffe23c', 'center', '#3a1200');
    if (artist) lbl(artist, 640, 82, fitSize(artist, 18, 400), '#fff', 'center', '#3a1200');
    // BPM and STAGE bars under the row
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    lbl(bpm, 736, 342, 20, '#fff', 'right', '#000');             // (the panel picture has the BPM bar)
    if (!im(U.stage, 800, 327, 270, 44)) lbl('STAGE', 840, 346, 17, '#fff');
    lbl(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', 990, 346, 18, '#fff', 'center', '#000');
    // ---- SORT bar with the scroll position
    im(U.sort, 246, 360, 788, 74);
    if (ok(U.thumb)) g.drawImage(U.thumb, 262 + (this.idx / Math.max(1, n - 1)) * 640, 368, 46, 12);
    if (!im(U.sortName, 890, 413, 96, 16)) lbl(this.favOnly ? 'FAVORITE' : this.query ? 'SEARCH' : 'DEFAULT', 935, 421, 14, '#1a2a6a', 'center', '#fff');
    // ---- the radar (left)
    const rx = 320, ry = 528;
    im(U.radar, rx - 128, ry - 120, 256, 248);
    if (!song.random && !song.folderTile) { g.save(); g.translate(rx, ry + 8); g.scale(1.85, 1.85); this.drawRadar(song, 0, 0, 1, true); g.restore(); }
    const LB = U.labels;
    im(LB.STREAM, rx + 2, ry - 140, 90, 30); im(LB.CHAOS, rx + 82, ry - 40, 84, 30); im(LB.FREEZE, rx + 58, ry + 74, 90, 30);
    im(LB.AIR, rx - 118, ry + 86, 54, 30); im(LB.VOLTAGE, rx - 196, ry - 4, 104, 30);
    // ---- difficulties (right): bar, your grade on it, feet lit to the level, the 1P marker on yours
    const lv = levelsOf(song);
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, x = 711, y = 436 + i * 53, w = 360, h = 47;
      g.globalAlpha = lvl || song.random ? 1 : 0.45;
      if (!im(U.bars[i], x, y, w, h)) { g.fillStyle = ['#3cc8ff', '#ffd23c', '#ff4ad0', '#46e04a'][i]; g.fillRect(x, y, w, h); lbl(DIFFS[di][1], x + 120, y + h / 2, 20, '#fff'); }
      for (let k = 0; k < 10; k++) im(U.feet[k < lvl ? i + 1 : 0], x + 226 + k * 13.2, y + 8, 18, 31);
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? ['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(rec.grade) : -1;
      if (gi >= 0) im(U.grades[gi], x + 22, y - 2, 46, 50);
      g.globalAlpha = 1;
      if (S.diff === d && !song.random && !im(U.p1, x + w - 20 + Math.sin(t * 6) * 2, y + 4, 86, 40)) {
        g.fillStyle = '#2a6cff'; g.beginPath(); g.arc(x + w + 20, y + h / 2, 15, 0, Math.PI * 2); g.fill(); lbl('1', x + w + 20, y + h / 2, 16, '#fff');
      }
    });
    // ---- DDR POINTS and the controls along the bottom
    if (!drawPointsPlate()) {
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(70, 664, 150, 22);
      text('DDR POINTS', 145, 675, 15, '#fff', 'center');
      text(String(SAVE.points).padStart(7, '0'), 145, 703, 24, '#ffe86a', 'center');
    }
    const help = [[['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['←→', 'MUSIC'], ['↑↓', 'DIFFICULTY']], [['Q', 'FAVORITE'], ['S', 'SEARCH'], ['Tab', 'OPTIONS'], ['F', 'FOLDER']]];
    help.forEach((row, r) => row.forEach(([k, v], i) => {
      const x = 612 + i * 156, y = 676 + r * 26, w = 150;
      g.fillStyle = 'rgba(30,50,110,0.9)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 11, w, 22, 6) : g.rect(x, y - 11, w, 22); g.fill();
      g.font = 'bold 12px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 7, y);
      lbl(v, x + w - 8, y, 13, '#fff', 'right', '#000');
    }));
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 640, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },
  // one of your custom folders: a folder shape with its name and how many songs are in it
  drawFolderTile(x, y, w, h, f) {
    if (f.jk !== undefined) { const e = texture('jacket', f.jk); if (e.img) { g.drawImage(e.img, x, y, w, h); return; } }
    if (f.myChar) {
      g.fillStyle = '#000'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#ff6a10'; g.lineWidth = Math.max(2, w * 0.02); g.strokeRect(x + w * 0.04, y + h * 0.04, w * 0.92, h * 0.92);
      text('MY', x + w / 2, y + h * 0.4, Math.round(w * 0.17), '#fff', 'center');
      text('CHARACTER', x + w / 2, y + h * 0.6, fitSize('CHARACTER', Math.round(w * 0.15), w * 0.86), '#fff', 'center');
      return;
    }
    if (f.disc) {           // another game's disc (Hottest Party): a disc instead of a folder
      const gd = g.createLinearGradient(x, y, x + w, y + h); gd.addColorStop(0, '#ff8a1c'); gd.addColorStop(1, '#c4127a');
      g.fillStyle = gd; g.fillRect(x, y, w, h);
      const cx = x + w / 2, cy = y + h * 0.36, r = h * 0.25;
      const rg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.6, '#dfe8ff'); rg.addColorStop(1, '#9fb4e6');
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = rg; g.fill();
      g.beginPath(); g.arc(cx, cy, r * 0.18, 0, Math.PI * 2); g.fillStyle = '#c4127a'; g.fill();
      const nm = f.folder.toUpperCase();
      text(nm, x + w / 2, y + h * 0.72, fitSize(nm, Math.round(w * 0.13), w * 0.9), '#fff', 'center');
      text(f.count + ' songs', x + w / 2, y + h * 0.88, Math.round(w * 0.085), '#ffe6f2', 'center', 'normal');
      return;
    }
    const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#1fc27a'); gr.addColorStop(1, '#0a6e48');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const fw = w * 0.62, fh = h * 0.38, fx = x + (w - fw) / 2, fy = y + h * 0.14;
    g.fillStyle = '#ffd65a'; g.fillRect(fx, fy, fw * 0.4, fh * 0.2); g.fillRect(fx, fy + fh * 0.14, fw, fh * 0.86);
    g.fillStyle = '#ffe89a'; g.fillRect(fx, fy + fh * 0.32, fw, fh * 0.68);
    const nm = f.folder.toUpperCase(), size = Math.max(10, Math.min(w * 0.16, w * 1.5 / Math.max(6, nm.length)));
    const nm2 = nm.length > 20 ? nm.slice(0, 19) + '…' : nm;
    text(nm2, x + w / 2, y + h * 0.7, fitSize(nm2, Math.round(size), w * 0.9), '#fff', 'center');
    text(f.count + (f.count === 1 ? ' song' : ' songs'), x + w / 2, y + h * 0.87, Math.round(w * 0.085), '#d6ffe9', 'center', 'normal');
  },
  drawRandomTile(x, y, w, h, t) {
    if (!hpLike()) { const e = texture('jacket', RANDOM_SONG.jk); if (e.img) { g.drawImage(e.img, x, y, w, h); return; } }
    const P = A.pop || {};
    if (P.rainbow) g.drawImage(P.rainbow, x, y, w, h);
    else { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#3cf'); gr.addColorStop(0.5, '#a3f'); gr.addColorStop(1, '#f3a'); g.fillStyle = gr; g.fillRect(x, y, w, h); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, h * 0.45);
    text('?', x + w / 2, y + h * 0.45, h * 0.5, `hsl(${(t * 90) % 360},100%,96%)`, 'center');
    text('RANDOM', x + w / 2, y + h * 0.84, Math.round(w * 0.15), '#fff', 'center');
  },
  // bare: draw onto the pop-up's own radar disc (cx, cy = the disc centre; names on its grey pills)
  drawRadar(song, cx, cy, sc, bare) {
    const panelImg = A.img.radarPanel && A.img.radarPanel[Select.hasBoth() ? 1 : 0];   // pink when the song has SHORT / FULL, else blue
    if (!panelImg && !bare) return;
    if (!bare) g.drawImage(panelImg, cx - 125 * sc, cy - 90 * sc, 250 * sc, 180 * sc);
    // radar bytes per difficulty: chaos, stream, voltage, air, freeze (checked against the real game)
    // Like the game, every difficulty is outlined in its colour; the selected one is filled.
    const ox = cx, oy = bare ? cy : cy + (103 - 90) * sc, R = bare ? 50 : 46 * sc;
    const slots = [[125, 37], [207, 77], [185, 162], [66, 162], [44, 77]];
    const RCOL = { 4: '#40e0ff', 1: '#ffe040', 2: '#ff50c8', 3: '#40f070', 6: '#c070ff' };
    const lv = levelsOf(song);
    const shape = r => {
      const vals = [r[1], r[0], r[4], r[3], r[2]];          // stream (top), chaos, freeze, air, voltage - clockwise
      g.beginPath();
      vals.forEach((v, k) => {
        const ang = -Math.PI / 2 + k * 2 * Math.PI / 5, rr = R * Math.min(1, Math.max(0.03, v / 100));
        const x = ox + Math.cos(ang) * rr, y = oy + Math.sin(ang) * rr;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath();
    };
    const order = [['STREAM'], ['CHAOS'], ['FREEZE'], ['AIR'], ['VOLTAGE']];
    DIFFS.forEach(([d], i) => {
      const r = (song.radar || [])[i];
      if (!r || !(lv[i] > 0)) return;
      shape(r);
      if (d === S.diff) { g.fillStyle = RCOL[d] + '66'; g.fill(); g.lineWidth = 3; }
      else g.lineWidth = 1.5;
      g.strokeStyle = RCOL[d]; g.stroke();
    });
    order.forEach(([name], k) => {
      const [sx, sy] = slots[k];
      if (bare === true) return;                       // (the caller draws its own labels)
      if (bare) { const [bx, by] = bare[k]; blit(A.img.radarNames && A.img.radarNames[name], bx, by, 0.75); }
      else blit(A.img.radarNames && A.img.radarNames[name], cx + (sx - 125) * sc, cy + (sy - 90) * sc, sc * 0.9);
    });
  },
};

// ---- options
const SPEEDS = []; for (let v = 0.25; v <= 8.001; v += 0.25) SPEEDS.push(+v.toFixed(2));
// The options screen, laid out like DDR II's: a grid of option buttons; each opens a page with a row per
// player (player options) or a list of settings, a CONFIRM button and a help line. Labels are the game's
// own pictures where it has one (big = button labels, small = row labels), else text.
const ON_OFF = [true, false], OFF_ON = [false, true];
// Hottest Party's characters (c_001..c_008 on its disc)
const HP_DANCERS = { '001': 'EMI', '002': 'JENNY', '003': 'AFRO', '004': 'RAGE', '005': 'HISPANIC', '006': 'BLACK F', '007': 'KOREA M', '008': 'JAMAICA', off: 'OFF' };
// a setting's ON / OFF wording
const yesNo = v => v ? 'ON' : 'OFF';
// The game's OPTIONS (CselOpt*, select_bin group 10): a 3 x 3 grid - INDIVIDUAL OPTIONS (its own grid of
// player options), ASSIST, SAVE / GAME PLAY, DANCE, CREDIT / GRAPHIC, USER SUPPORT, CONFIRM. Every page lists
// a row per player (or its settings), then CONFIRM. Help lines are the game's (text_eng.bin). Settings that
// only the PC version has are under PC SETTINGS, below the game's grid.
const IND_KEYS = ['speed', 'scroll', 'judgePos', 'freezes', 'colors', 'guideline', 'turn', 'jump', 'cut'];
// INDIVIDUAL OPTIONS' rows (one value per player)
const OPT_IND = [
  { big: 15, name: 'SPEED', help: 'Set the arrow scroll rate.', player: { key: 'speed', values: SPEEDS, fmt: v => 'x' + (v % 1 === 0 ? v.toFixed(1) : v) } },
  { big: 14, name: 'SCROLL', help: 'Sets the arrows\' flow direction.', player: { key: 'scroll', values: ['normal', 'reverse'], fmt: v => v === 'reverse' ? 'REVERSE' : 'NORMAL' } },
  { big: 5, name: 'EVALUATION', help: 'Sets JUDGMENT to appear either above or below the arrows.',
    player: { key: 'judgePos', values: ['normal', 'combo', 'judgment', 'all'], fmt: v => ({ normal: 'NORMAL', combo: 'COMBO', judgment: 'JUDGMENT ONLY', all: 'ALL' })[v] || 'NORMAL',
      helps: { normal: 'Displays JUDGMENT and COMBO above the arrows.', combo: 'Displays COMBO below the arrows.', judgment: 'Displays JUDGMENT below the arrows.', all: 'Displays JUDGMENT and COMBO below the arrows.' } } },
  { big: 6, name: 'FREEZE ARROW', help: 'FREEZE ARROW setting. When turned "OFF", FREEZE ARROWS will appear as normal arrows.', player: { key: 'freezes', values: ON_OFF, fmt: yesNo } },
  { big: 0, name: 'ARROW', help: 'Change color of arrows.', player: { key: 'colors', values: ['rainbow', 'rhythm', 'flat', 'cycle'], fmt: v => ({ rainbow: 'VIVID', rhythm: 'NOTE', flat: 'FLAT', cycle: 'RAINBOW' })[v] || String(v).toUpperCase(),
    helps: { rainbow: 'Default color.', rhythm: 'Arrow color will depend on timing.', flat: 'Arrows will be the same color.', cycle: 'Arrow color will change.' } } },
  { big: 9, name: 'GUIDELINE', help: 'Displays lines indicating 1 measure of music.', player: { key: 'guideline', values: ['beginner', true, false], fmt: v => v === 'beginner' ? 'DEFAULT' : v ? 'ALL' : 'OFF',
    helps: { beginner: 'Show bar lines only for the BEGINNER level.', true: 'Show bar lines for all difficulty levels.', false: 'Hide bar lines for all difficulty levels.' } } },
  { big: 12, name: 'ROTATE', help: 'Change step directions.', player: { key: 'turn', values: ['off', 'mirror', 'left', 'right', 'shuffle'], fmt: v => v === 'off' ? 'NORMAL' : v.toUpperCase(),
    helps: { off: 'Normal arrow directions are used.', mirror: 'Arrow directions are rotated 180 degrees.', left: 'Arrow directions are rotated 90 degrees to the left.', right: 'Arrow directions are rotated 90 degrees to the right.', shuffle: 'Direction of steps is shuffled at random.' } } },
  { big: 11, name: 'JUMP', help: 'Turn JUMP "OFF" and simultaneous step arrows will not be shown.', player: { key: 'jump', values: ON_OFF, fmt: yesNo } },
  { big: 4, name: 'CUT', help: 'When CUT is set to ON, there are no steps for beats less than quarter notes.', player: { key: 'cut', values: OFF_ON, fmt: yesNo } },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
];
// PC SETTINGS' rows (not in the real game)
const OPT_PC = [
  { name: 'APPEARANCE', help: 'HIDDEN: arrows vanish near the top. SUDDEN: they appear late. STEALTH: you can\'t see them. (Not in DDR II.)', player: { key: 'appearance', values: ['visible', 'hidden', 'sudden', 'stealth'] } },
  { name: 'N.G. COMBO', help: 'Whether letting go of a freeze arrow (N.G.) breaks your combo. The real DDR II keeps it (OFF).', player: { key: 'ngBreaksCombo', values: OFF_ON, fmt: yesNo } },
  { name: 'JUDGMENT', help: 'Show the judgment (MARVELOUS, PERFECT...) and combo while you play. (OFF is not in DDR II.)', player: { key: 'evaluation', values: ON_OFF, fmt: yesNo } },
  { name: 'TEAM TURN', help: 'TEAM style: how many steps each player takes before the song switches to the other. AUTO: about 8 turns a song.', player: { key: 'teamTurn', values: ['auto', '16', '32', '64'], fmt: v => v === 'auto' ? 'AUTO' : v + ' STEPS' } },
  { name: 'GHOST', help: 'Your best play of the song dances beside you on the player 2 side, step for step (DANCE MODE, 1 player). A PC extra, not in DDR II.', player: { key: 'ghost', values: OFF_ON, fmt: yesNo } },
  { name: 'EARLY / LATE', help: 'Shows EARLY or LATE under every judgment below MARVELOUS, so you can tell which way you were off. (A PC extra, not in DDR II.)', player: { key: 'earlyLate', values: OFF_ON, fmt: yesNo } },
  { name: 'BALANCE BOARD', hp4only: true, help: 'DDR HP4: a Wii Balance Board paired with Windows (Bluetooth), read through Chrome or Edge.', rows: [
    { name: 'CONNECT', action: 'board', fmt: () => Board.ok ? (Board.total > 2 ? Board.total.toFixed(1) + ' kg' : 'ON') : 'CONNECT',
      help: 'Enter: connect the board (pair it in Windows Bluetooth first: red SYNC button under the battery cover).' },
    { name: 'BALANCE', action: 'boardview', fmt: () => !Board.ok ? '---' : Board.total <= 2 ? 'STEP ON' : (Board.x < 0 ? 'L ' : 'R ') + Math.round(Math.abs(Board.x) * 100) + '%  ' + (Board.y < 0 ? 'B ' : 'F ') + Math.round(Math.abs(Board.y) * 100) + '%',
      help: 'Where your weight is: left / right and front / back of the centre, live.' },
  ] },
  { name: 'SOUND', help: 'Menu sounds and music.', rows: [
    { name: 'MENU SOUNDS', key: 'menuSounds', values: ON_OFF, fmt: yesNo },
    { name: 'MENU MUSIC', key: 'menuMusic', values: ON_OFF, fmt: yesNo },
  ] },
  { name: 'SCREEN', help: 'Song videos, the screen shape and full screen.', rows: [
    { name: 'VIDEO SIZE', key: 'videoSize', values: ['wii', 'full'], fmt: v => v === 'wii' ? 'WII MONITOR' : 'FULL SCREEN' },
    { name: 'SCREEN', key: 'screen', values: ['wide', '4:3'], fmt: v => v === 'wide' ? '16:9' : '4:3' },
    { name: 'FULL SCREEN', action: 'fullscreen', fmt: () => 'F11' },
    { name: 'FRAME RATE', key: 'fps', values: ['max', '60', '120'], fmt: v => v === 'max' ? 'MONITOR' : v + ' FPS',
      help: 'MONITOR: one frame per screen refresh. 60 FPS: like the Wii. 120 FPS: needs a 120 Hz (or faster) screen. Timing is the same either way.' },
    { name: 'STEP TIMING', key: 'judgeModel', values: ['wii', 'exact'], fmt: v => v === 'wii' ? 'WII' : 'EXACT',
      help: 'WII: steps are judged the way the game does it - 60 times a second on the music clock, a press stays fresh for 4 frames and a jump needs both feet within them. EXACT: each press judged at its own moment (a PC extra).' },
    { name: 'FPS COUNTER', key: 'showFps', values: OFF_ON, fmt: yesNo, help: 'Shows the frames drawn each second in the top right corner (F3 turns it on and off too).' },
    { name: 'SONG PROGRESS', key: 'songProgress', values: [false, true], fmt: v => v ? 'ON' : 'OFF',
      help: 'A rainbow bar at the left edge of the screen that fills up as the song goes (a PC extra, like StepMania\'s).' },
    { name: '3D BUFFER', key: 'glFast', values: [false, true], fmt: v => v ? 'FAST' : 'ORIGINAL',
      help: 'FAST: the 3D stage and dancer skip keeping a spare copy of each frame. ORIGINAL: as before. Restart the game (or F5) for it to take effect.' },
  ] },
  { name: 'LIGHTS', help: 'Cabinet lights through an Ultimarc PAC Drive: a panel lights up while you step on it.', rows: [
    { name: 'LIGHTS', key: 'lights', values: ON_OFF, fmt: yesNo },
    { name: 'LIGHT TEST', action: 'lighttest', fmt: () => 'ENTER' },
    { name: 'PAC DRIVE DLL', action: 'pacdll', fmt: () => Options.lightMsg ? (Options.lightOk ? 'FOUND' : 'NOT FOUND') : 'ENTER' },
    { name: 'RESET PINS', action: 'lightreset', fmt: () => 'ENTER' },
  ].concat([1, 2, 3, 4].flatMap(pl => [['L', 'LEFT'], ['D', 'DOWN'], ['U', 'UP'], ['R', 'RIGHT']].map(([d, nm]) =>
    ({ name: 'P' + pl + ' ' + nm, light: 'P' + pl + d })))) },
  { name: 'CUSTOM SONGS', help: 'Make folders and import StepMania songs.', action: () => go(CustomSongs) },
  { name: 'PLAYER DATA', help: 'Pick, make or delete players.', action: () => go(Players.with(Options, Options)) },
  { name: 'CONTROLS', help: 'Set up keys, dance mats and controllers.', action: () => go(Controls) },
  { name: 'DANCE MATS', help: 'Step on each mat so the game knows which mat is which player.', action: () => go(MatCheck.with(Options, false)) },
  { name: 'GAME FOLDER', help: 'Pick your Wii disc, an extracted DDR II folder, or ffmpeg.', action: () => go(Setup.with('')) },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
];
// the top grid of OPTIONS
const OPT_TOP = [
  { big: 10, name: 'INDIVIDUAL OPTIONS', help: 'Change fine settings such as the arrow speed, color, and other aspects.', sub: OPT_IND, reset: 'ind' },
  { big: 1, name: 'ASSIST', help: 'Set options for the assist feature.', rows: [
    { small: 12, name: 'METRONOME', key: 'metronome', values: OFF_ON, fmt: yesNo, help: 'Set the option to use the metronome while dancing.' },
    { small: 8, name: 'HAND CLAP', key: 'clap', values: OFF_ON, fmt: yesNo, help: 'Set the option to hear applause while dancing.' },
    { small: 21, name: 'SONG', key: 'songOn', values: ON_OFF, fmt: yesNo, help: 'Set whether or not to hear the song while dancing.' },
    { small: 23, name: 'TIMING EVALUATION', key: 'timingColor', values: OFF_ON, fmt: yesNo, help: 'Setting to "ON" will change the steps\' color. Early timing will show up blue and late timing pink.' },
  ] },
  { big: 13, name: 'SAVE', help: 'Set saving options.', rows: [
    { small: 0, name: 'AUTO SAVE', key: 'autoSave', values: ON_OFF, fmt: yesNo, help: 'Set options for autosave.' },
    { small: 20, name: 'SAVE', action: 'save', fmt: () => Options.saveMsg || 'SAVE', help: 'Save game data.' },
  ] },
  { big: 7, name: 'GAME PLAY', help: 'Set game play settings.', rows: [
    { small: 24, name: 'VOICE', key: 'voice', values: [true, false, 'noboo'], fmt: v => v === 'noboo' ? 'NO BOOING' : v ? 'ALL' : 'OFF', help: 'Select settings for In-game voice.',
      helps: { true: 'Use all voices.', false: 'Use no voice.', noboo: 'Remove BOOING during gameplay.' } },
    // the game's own labels (text_eng.bin entry 1), easiest first; its 8 gauge rows run hardest..easiest, so
    // the default row (x1.0, our key 'medium') is MEDIUM HARD and the next easier one is MEDIUM
    { small: 5, name: 'GAME LEVEL', key: 'gameLevel', values: ['easiest', 'very easy', 'easy', 'a little easy', 'medium', 'hard', 'very hard', 'hardest'],
      fmt: v => ({ 'a little easy': 'MEDIUM', medium: 'MEDIUM HARD' })[v] || String(v).toUpperCase(), help: 'The higher the level, the faster the Dance Gauge decreases.' },
    { small: 6, name: 'GAME OVER', key: 'gauge', values: ['normal', 'end', 'no fail'], fmt: v => v === 'normal' ? 'NORMAL' : v === 'end' ? 'END OF SONG' : 'OFF',
      help: 'Sets to keep playing or not when the Dance Gauge becomes 0. (Workout/Training Modes aren\'t affected).',
      helps: { normal: 'Ends game when the Dance Gauge becomes zero.', end: 'Continues game after the Dance Gauge becomes zero.', 'no fail': 'You can\'t fail: the Dance Gauge stops at 1. (Not in DDR II.)' } },
    { name: 'FREEZE GUIDE', key: 'freezeGuide', values: ON_OFF, fmt: yesNo, help: 'The explanation page before each song, like the game:\nArrow on BEGINNER, Freeze Arrow otherwise.' },
  ] },
  { big: 17, name: 'DANCE', help: 'Set appearance options.', rows: [
    { small: 29, name: 'DANCER', key: 'dancer', values: ON_OFF, fmt: yesNo, help: 'The dancer on songs without a video.' },
    { small: 13, name: 'MOVIES', key: 'movies', values: ON_OFF, fmt: v => v ? 'NORMAL' : 'OFF', help: 'Sets movies displayed in the game.' },
    { name: 'DDR II STAGE', key: 'ddr2Stage3d', values: [true, false], fmt: v => v ? '3D STAGE' : 'OFF', help: 'DDR II\'s 3D stages behind the dancer.' },
    { name: 'CAMERA WORK', key: 'cameraWork', values: ['default', 'front', 'all'], fmt: v => v === 'front' ? 'FRONT ONLY' : v === 'all' ? 'ALL CAMERAS' : 'DEFAULT',
      helps: { default: 'Automatic camera settings based on mode.', front: 'Only fixed front cameras are used.', all: 'All cameras are used.' } },
    { name: 'COMBO PERFORMANCE', key: 'comboPerf', values: ['50', 'off'], fmt: v => v === 'off' ? 'OFF' : '50',
      helps: { '50': 'Sets the combo performance to 50.', off: 'Setting to "OFF" eliminates the lighting show.' } },
    { name: 'DDR II DANCER', key: 'ddr2Char', values: ['random', 'randomF', 'randomM', '201', '202', '203', '204', '205', '206', '207', '208', '209', 'builtin'], fmt: v => v === 'random' ? 'RANDOM ALL' : v === 'randomF' ? 'RANDOM (GIRLS)' : v === 'randomM' ? 'RANDOM (BOYS)' : v === 'builtin' ? 'BUILT-IN' : (DDR2_CHAR_NAMES[v] || 'DANCER ' + (+v - 200)) + (ddr2CharLockedAt(+v - 1, 0) ? ' (LOCKED)' : ''),
      skip: v => /^\d+$/.test(v) && ddr2CharLockedAt(+v - 1, 0) > 0 },
    { name: 'DANCER LIGHTING', key: 'dancerLight', values: ['pc', 'game'], fmt: v => v === 'game' ? 'GAME STYLE' : 'DDR II PC',
      helps: { pc: 'The built-in dancer keeps DDR II PC\'s own lighting.', game: 'The built-in dancer is lit the game\'s way: the stage\'s colour, the light from the camera and the shading ramp.' } },
    { name: 'DANCER MODEL', action: 'model' },
    { name: 'HOTTEST PARTY DANCER', key: 'hpDancer', values: ['001', '002', '003', '004', '005', '006', '007', '008', 'off'], fmt: v => HP_DANCERS[v] || v },
    { name: 'HOTTEST PARTY STAGE', key: 'hpStage', values: ['random'].concat(Array.from({ length: 41 }, (_, i) => String(i + 1)), [false]), fmt: v => v === 'random' || v === 'song' ? 'RANDOM' : v === false ? 'OFF' : 'STAGE ' + v },
  ] },
  { big: 3, name: 'CREDIT', help: 'View game credits.', action: () => go(Credits) },
  { big: 8, name: 'GRAPHIC', help: 'Change the look of the game screen.', rows: [
    { small: 10, name: 'MARVELOUS', key: 'marvelous', values: ON_OFF, fmt: yesNo, help: 'Enable MARVELOUS judgment ranking.' },
    { small: 22, name: 'TIMING', key: 'offset', step: 5, min: -500, max: 500, fmt: v => (v > 0 ? '+' : '') + v + ' ms', help: 'Modify arrow timing. (Raise it if the arrows feel early.)' },
  ] },
  { big: 16, name: 'USER SUPPORT', help: 'Unlocks your songs and gear from DanceDanceRevolution.', rows: [
    { name: 'SONG UNLOCKS', key: 'unlocks', values: ['off', 'on'], fmt: v => v === 'on' ? 'EARN THEM' : 'ALL OPEN', help: 'ALL OPEN: every song and dancer is open. EARN THEM: unlock them with DDR POINTS, like the game.' },
  ] },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
  { name: 'PC SETTINGS', help: 'Settings of this PC version: controls, mats, sound, screen, lights, custom songs and more.', sub: OPT_PC },
];
// OPTIONS screen (draws whichever page of the lists above is open)
const Options = {
  bgm: 'MU_BGM_FREE',
  i: 0, page: null, row: 0, items: OPT_TOP, stack: [], ask: null,
  enter() { if (this.keep) { this.keep = false; return; } if (!hpLike()) voice('VO_NAR_SELECTOPTION'); this.page = null; this.modelMsg = ''; this.items = OPT_TOP; this.stack = []; this.i = 0; this.ask = null; this.saveMsg = ''; },
  // HP4's HOTTEST PARTY 3 import: the game's own windows, in its order
  hp3Import() {
    const T = k => HP4_TEXT[k] || '';
    sfx('SE_SYS_WINDOWIN');
    this.ask = { wait: true, msg: T(382), run: () => {} };
    setTimeout(() => {
      if (!this.ask || !this.ask.wait) return;
      this.ask = { ok: true, msg: T(377), run: () => {} };
      sfx('SE_SYS_WINDOWIN');
    }, 2200);
  },
  // DEFAULT (Tab): the game's two resets - the individual options, or everything else
  resetAsk() {
    const ind = this.items === OPT_IND;
    this.ask = { i: 0, msg: ind ? 'Would you like to reset the individual options to their default settings?'
                               : 'Would you like to reset everything other than the individual options to their default settings?',
      run: () => {
        if (ind) { for (const k of IND_KEYS) S[k] = DEFAULTS[k]; if (P2 && P2.opts) for (const k of IND_KEYS) delete P2.opts[k]; }
        else for (const pg of OPT_TOP) for (const r of pg.rows || []) if (r.key && r.key in DEFAULTS) S[r.key] = DEFAULTS[r.key];
        saveSettings();
        this.note = ind ? 'The individual options have been restored to their default settings.' : 'All options other than the individual options have been restored to their default settings.';
      } };
    sfx('SE_SYS_WINDOWIN');
  },
  cols: 3,
  // per-player value: player 0 = S (player 1's options); player 1 = player 2's own options
  pget(key, who) { return who ? p2Opts()[key] : S[key]; },
  pset(key, who, v) {
    if (!who) { S[key] = v; saveSettings(); return; }
    P2.opts = P2.opts || {}; P2.opts[key] = v;
    const prof = p2Profile();
    if (prof) { prof.opts = prof.opts || {}; prof.opts[key] = v; writeSave(); }
  },
  // rows on the open page: [{label, get(), change(d), action?}]
  rows() {
    const pg = this.page;
    if (pg.player) {
      const p = pg.player, who = P2 ? [0, 1] : [0];
      return who.map(w => ({ small: 16 + w, name: 'PLAYER ' + (w + 1), sub: w === 0 ? DATA.current : (P2.name || 'GUEST'),
        get: () => (p.fmt || (v => String(v).toUpperCase()))(this.pget(p.key, w)),
        change: d => { const vs = p.values; let j = vs.indexOf(this.pget(p.key, w)); j = Math.max(0, Math.min(vs.length - 1, (j < 0 ? 0 : j) + d)); this.pset(p.key, w, vs[j]); } }));
    }
    return pg.rows.map(r => r.light ? ({ name: r.name,
      // which PAC Drive pin (output) lights this arrow: 1-16 on board 1, 17-32 on board 2... or OFF
      get: () => { const o = Lights.outputOf(r.light); return o ? 'PIN ' + (o > 16 ? (o - 1 >> 4) + 1 + '-' + ((o - 1 & 15) + 1) : o) : 'OFF'; },
      change: d => {
        const map = Object.assign({}, S.lightMap || {});
        let o = Lights.outputOf(r.light) + d;
        if (o < 0) o = 64; if (o > 64) o = 0;
        map[r.light] = o || -1;                 // -1 = no light
        S.lightMap = map; Lights.last = ''; saveSettings();
      },
      action: null,
    }) : ({ small: r.small, name: r.name,
      get: () => r.action === 'model' ? (S.dancerCustom && S.dancerModel ? S.dancerModel.split(/[\\/]/).pop().toUpperCase() : 'BUILT-IN')
                : r.action ? (r.fmt ? r.fmt() : '') : (r.fmt || (v => String(v).toUpperCase()))(S[r.key]),
      change: d => {
        if (r.action === 'model') { if (S.dancerModel) { S.dancerCustom = !S.dancerCustom; Dancer3D.useModel(S.dancerCustom ? '/api/dancermodel' : ''); saveSettings(); } return; }
        if (r.key === 'ddr2Char') Promise.resolve().then(() => ddr2Dancer());
        if (r.action) return;
        if (r.step) S[r.key] = Math.max(r.min, Math.min(r.max, (S[r.key] || 0) + d * r.step));
        else {
          const vs = r.values; let j = vs.indexOf(S[r.key]); j = j < 0 ? 0 : j;
          // (values that are locked - r.skip - are stepped over)
          let k = j + d;
          while (k >= 0 && k < vs.length && r.skip && r.skip(vs[k])) k += d;
          if (k >= 0 && k < vs.length) S[r.key] = vs[k];
        }
        if (r.key === 'screen') fit();
        if (r.key === 'menuMusic') { Bgm.cur = undefined; Bgm.want(this.bgm); }
        saveSettings();
      },
      action: r.action === 'fullscreen' ? () => toggleFullscreen() : r.action === 'model' ? () => this.pickModel()
            : r.action === 'lighttest' ? () => this.lightCall({ start: true }, true)
            : r.action === 'pacdll' ? () => this.lightCall({ pick: true })
            : r.action === 'hp3import' ? () => this.hp3Import()
            : r.action === 'save' ? () => { writeSave(true); this.saveMsg = 'SAVED'; sfx('SE_SYS_DECIDE01'); }
            : r.action === 'board' ? () => { Board.connect().then(() => { this.lightMsg = Board.msg; }); this.lightMsg = 'Choose the board in the browser\'s list...'; }
            : r.action === 'lightreset' ? () => { S.lightMap = null; saveSettings(); Lights.last = ''; this.lightMsg = 'Pins back to: P1 L D U R on 1-4, P2 on 5-8, P3 on 9-12, P4 on 13-16.'; } : null }));
  },
  async lightCall(body, test) {
    this.lightMsg = 'Working...';
    try { const r = await api('/api/lights', body); this.lightOk = r.ok; this.lightMsg = r.msg; } catch (e) { this.lightMsg = String(e); }
    if (test) { Lights.last = ''; Lights.test = performance.now(); if (this.lightOk) this.lightMsg += '  Lighting outputs 1 to 16 in turn...'; }
  },
  // CONFIRM / back: out of a sub-grid, or out of the options
  up() {
    sfx('SE_SYS_WINDOWOUT'); saveSettings();
    if (this.stack.length) { const t = this.stack.pop(); this.items = t.items; this.i = t.i; return; }
    go(this.from || Select);
  },
  input(a, p) {
    if (!p) return;
    const dir = /^P[1-4]([LDUR])$/.exec(a);
    const d = dir ? dir[1] : null;
    if (this.ask && this.ask.wait) return;                  // (a message with no buttons: it moves on by itself)
    if (this.ask && this.ask.ok) {                          // a message with OK
      if (a === 'START' || a === 'BACK') { const q = this.ask; this.ask = null; sfx('SE_SYS_DECIDE01'); q.run(); }
      return;
    }
    if (this.ask) {                                          // YES / NO
      if (d === 'U' || d === 'D' || d === 'L' || d === 'R') { this.ask.i = 1 - this.ask.i; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') { const q = this.ask; this.ask = null; if (q.i === 0) { q.run(); sfx('SE_SYS_DECIDE01'); } else sfx('SE_SYS_WINDOWOUT'); }
      else if (a === 'BACK') { this.ask = null; sfx('SE_SYS_WINDOWOUT'); }
      return;
    }
    if (this.page === null) {                                // the grid of options
      const n = this.items.length, c = this.cols;
      this.note = '';
      if (d === 'L') this.i = (this.i + n - 1) % n;
      else if (d === 'R') this.i = (this.i + 1) % n;
      else if (d === 'U') this.i = this.i - c >= 0 ? this.i - c : this.i + c * Math.floor((n - 1 - this.i) / c);
      else if (d === 'D') this.i = this.i + c < n ? this.i + c : this.i % c;
      else if (a === 'START') {
        const pg = this.items[this.i];
        if (pg.confirm) { this.up(); return; }
        sfx('SE_SYS_DECIDE02');
        if (pg.action) { saveSettings(); this.keep = true; pg.action(); }
        else if (pg.sub) { this.stack.push({ items: this.items, i: this.i }); this.items = pg.sub; this.i = 0; }
        else { this.page = pg; this.row = 0; this.modelMsg = ''; this.saveMsg = ''; }
        return;
      } else if (a === 'BACK') { this.up(); return; }
      else if (a === 'OPTIONS') { if (this.items !== OPT_PC) this.resetAsk(); return; }
      else return;
      sfx('SE_SYS_SELECT01');
      return;
    }
    const rows = this.rows(), n = rows.length + 1;            // + CONFIRM
    if (d === 'U') { this.row = (this.row + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (d === 'D') { this.row = (this.row + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if ((d === 'L' || d === 'R') && this.row < rows.length) { rows[this.row].change(d === 'L' ? -1 : 1); sfx('SE_SYS_SELECT02'); }
    else if (a === 'START') {
      if (this.row < rows.length && rows[this.row].action) { rows[this.row].action(); return; }
      sfx('SE_SYS_DECIDE01'); this.page = null;           // CONFIRM: back to the grid (changes are already kept)
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.page = null; }
  },
  async pickModel() {
    this.modelMsg = 'A file window should open (it may be behind the browser)...';
    try {
      const r = await api('/api/dancermodel', { pick: true });
      if (r.ok && r.path) {
        S.dancerModel = r.path; S.dancerCustom = true; saveSettings();
        this.modelMsg = 'Loading model...';
        await Dancer3D.useModel('/api/dancermodel?v=' + Date.now());
        this.modelMsg = Dancer3D.customErr ? 'Could not use that model: ' + Dancer3D.customErr : 'Using ' + r.path.split(/[\\/]/).pop();
      } else this.modelMsg = 'No model chosen.';
    } catch (e) { this.modelMsg = String(e.message || e); }
  },
  // a label: the game's picture if it has one, else bold text in the same style
  label(img, name, x, y, h, color = '#14306e', align = 'center') {
    if (img) {
      const s = h / img.height, w = img.width * s;
      g.drawImage(img, align === 'center' ? x - w / 2 : x, y - h / 2, w, h);
      return;
    }
    g.save();
    g.font = `bold ${Math.round(h * 1.15)}px "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = color === '#fff' ? '#14306e' : '#fff'; g.strokeText(name, x, y);
    g.fillStyle = color; g.fillText(name, x, y);
    g.restore();
  },
  frame(t) {
    menuBackground(t);
    // (no blue wash: on the Wii OPTIONS has the same bright background as the other menus)
    MenuDancers.draw(t, [[1010, 780, 860, 0.55, 0, false], [250, 760, 700, 0.4, 3, true]]);
    const O = A.opt || {};
    // header: OPTIONS, and a tab naming the open option
    // (select_bin CAE 0x9e5860: the header slides in from 200 to the right over 12 frames, out to the left)
    // (CAE 0x9e5860: title_wind at (193, 30) pivot (215, 40), select_option_U at (193, 35) pivot (110, 25), 1.5 px a
    // unit - the Wii screen matches)
    withMenuIn('title', () => {
      if (O.header) g.drawImage(O.header, 640 + (193 - 320) * 1.5 - 215 * 1.5, 30 * 1.5 - 40 * 1.5, O.header.width * 1.5, O.header.height * 1.5);
      else { g.fillStyle = '#2a7fd6'; g.fillRect(0, 6, 440, 62); }
      if (O.title) g.drawImage(O.title, 640 + (193 - 320) * 1.5 - O.title.width * 0.75, 35 * 1.5 - O.title.height * 0.75, O.title.width * 1.5, O.title.height * 1.5);   // (trimmed: centred on the part's place)
      else this.label(null, 'OPTIONS', 450, 52, 24, '#fff');
    });
    const pg = this.page || (this.stack.length ? this.stack[this.stack.length - 1].items[this.stack[this.stack.length - 1].i] : null);
    if (pg) {
      // the open option's tab (CAE 0x9ea460: opt_wind04 at (497, 11) pivot (105, 52), its word opt_b at (494, 34))
      if (O.tabWin) g.drawImage(O.tabWin, 640 + (497 - 320) * 1.5 - 105 * 1.5, 11 * 1.5 - 52 * 1.5, 210 * 1.5, 104 * 1.5);
      else { g.fillStyle = '#2a7fd6'; g.fillRect(760, 0, 300, 80); }
      const wim = pg.big !== undefined && O.big ? O.big[pg.big] : null;
      this.label(wim, pg.name, 640 + (494 - 320) * 1.5, 34 * 1.5, wim ? wim.height * 1.5 : 18);
    }
    // (the PC's player name: bottom left, out of the way of the game's own header and tab)
    if (DATA.current) text('PLAYER: ' + DATA.current + (P2 ? '   2P: ' + (P2.name || 'GUEST') : ''), 30, 690, 16, '#0d3770', 'left');
  },
  // the YES / NO window (reset to default)
  drawAsk(t) {
    const q = this.ask;
    g.fillStyle = 'rgba(0,20,60,0.45)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,70,170,0.95)'; g.fillRect(300, 180, 680, 330); g.strokeStyle = '#cfefff'; g.lineWidth = 3; g.strokeRect(300, 180, 680, 330);
    if (q.ok || q.wait) {                                   // the game's own message (its line breaks), OK or nothing
      const ls = q.msg.split('\n').map(x => x.trim()).filter(Boolean);
      ls.forEach((ln, k) => text(ln, 640, 345 - (ls.length - 1) * 17 - (q.ok ? 40 : 0) + k * 34, 24, '#fff', 'center'));
      if (q.ok) { const y = 420; g.fillStyle = '#ff8a1e'; g.fillRect(504, y - 6, 272, 68); g.fillStyle = '#d8f6ff'; g.fillRect(510, y, 260, 56); text('OK', 640, y + 28, 28, '#14306e', 'center'); }
      else text('.'.repeat(1 + Math.floor(t * 3) % 3), 640, 470, 28, '#fff', 'center');
      return;
    }
    const words = q.msg.split(/\s+/), lines = [''];
    for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).length > 38) lines.push(w); else lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + w; }
    lines.forEach((ln, k) => text(ln, 340, 225 + k * 34, 24, '#fff', 'left'));
    ['YES', 'NO'].forEach((nm, k) => {
      const y = 360 + k * 72, on = q.i === k;
      if (on) { g.fillStyle = '#ff8a1e'; g.fillRect(510 - 6, y - 6, 260 + 12, 56 + 12); }
      g.fillStyle = '#d8f6ff'; g.fillRect(510, y, 260, 56);
      text(nm, 640, y + 28, 28, '#14306e', 'center');
    });
  },
  // the help window: mes_wind_S_01 (y 381 in the layout), spread wide on the Wii screen - measured there at x 82-1200,
  // y 514-646, the text from x 231 in the game's font, wrapped to short lines (Dolphin 2026-11-18)
  helpBox(msg) {
    const M = A.menu || {}, win = M.helpWinS;
    if (win) {
      if (M.helpMask) { g.save(); g.globalAlpha = 127 / 255; g.translate(0, 646 + 132 / 2 + 6); g.scale(1, -1); g.drawImage(win, 82, -66, 1118, 132); g.restore(); }
      g.drawImage(win, 82, 514, 1118, 132);
    } else { g.fillStyle = 'rgba(20,70,170,0.85)'; g.fillRect(82, 514, 1118, 132); }
    const lines = [];
    for (const para of String(msg || '').split('\n')) {
      let cur = '';
      for (const w of para.split(' ')) { if ((cur + ' ' + w).trim().length > 28 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
      lines.push(cur);
    }
    lines.slice(0, 4).forEach((ln, i) => { if (A.font) gtext(ln, 231, 538 + i * 31, 27, '#fff', 'left', 3.6, 1); else text(ln, 231, 538 + i * 31, 22, '#fff', 'left', 'bold'); });
  },
  draw(t) {
    this.frame(t);
    const O = A.opt || {};
    if (this.page === null) {
      // the grid of option buttons
      // the game's grid (CAE 0x9eaae0: columns x 125 / 320 / 515, rows y 110 / 170 / 230 / 290; 1.5 px a unit): each
      // button opt_wind03 (188 x 60) with its word opt_b (180 x 32), at 0.9 - the chosen one 1.0 with the orange
      // opt_selwind01 (200 x 70) behind it (0x9f7520). PC SETTINGS takes the layout's fourth row.
      const c = this.cols, rowsVis = 4;
      const L = this.items, r0 = Math.max(0, Math.min(Math.ceil(L.length / c) - rowsVis, Math.floor(this.i / c) - 2));
      L.forEach((pg, i) => {
        const r = Math.floor(i / c) - r0;
        if (r < 0 || r >= rowsVis) return;
        const cx = 640 + ([125, 320, 515][i % c] - 320) * 1.5, cy = (110 + 60 * r) * 1.5, on = i === this.i, sc = (on ? 1 : 0.9) * 1.5;
        if (on && O.btnOn) g.drawImage(O.btnOn, cx - 100 * sc, cy - 35 * sc, 200 * sc, 70 * sc);
        if (O.btn) g.drawImage(O.btn, cx - 94 * sc, cy - 30 * sc, 188 * sc, 60 * sc); else { g.fillStyle = on ? '#ff8a1e' : '#1e6fe0'; g.fillRect(cx - 94 * sc, cy - 30 * sc, 188 * sc, 60 * sc); }
        const wim = pg.big !== undefined && O.big ? O.big[pg.big] : null;
        this.label(wim, pg.name, cx, cy, wim ? wim.height * sc : 20 * sc / 1.5, pg.big !== undefined ? '#14306e' : '#fff');
      });
      this.helpBox(this.note || L[this.i].help);
      if (this.ask) this.drawAsk(t);
      // the hints: CONFIRM, BACK, SELECT; DEFAULT, Pointer:SELECT (comAF 0, 3, 4, 17, 32 - two rows, as on the Wii)
      if (A.hints && A.hints[0]) { [0, 3, 4].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24)); [17, 32].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 895 + j * 155, 677, 150, 24)); }
      else text('Arrows: choose    Enter: open    Tab: default    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
      return;
    }
    // one option's page (select_bin CAE 0x9ece80: rows at x 320, y 84 + 45 n; a row 0xa0cec0: opt_wind01 530 x 42
    // pivot (265, 21), its value slot opt_wind01_back at +126 (pivot 120, scale x 1.07), the label at -129, the value
    // at +128, the arrows at +20 (mirrored) / +235, the chosen row inside opt_sel_wind01 (548 x 60) with its value
    // white, the others gold; CONFIRM 0xa19a60: opt_wind02 292 x 42 at -119 with its word at -128.5, chosen inside
    // opt_sel_wind02 (312 x 60); 1.5 px a unit - checked on the Wii screen, SPEED)
    const rows = this.rows(), U = 1.5, RX = d => 640 + d * U, RY = n => (84 + 45 * n) * U;
    const vis = 6, top = Math.max(0, Math.min(rows.length + 1 - vis, this.row - 2));
    if (top > 0) text('▲', W / 2, RY(0) - 52, 18, '#0d3770', 'center');
    if (top + vis < rows.length + 1) text('▼', W / 2, RY(vis - 1) + 46, 18, '#0d3770', 'center');
    rows.forEach((r, k) => {
      if (k < top || k >= top + vis) return;
      const cy = RY(k - top), on = k === this.row;
      if (on) { if (O.rowSel) g.drawImage(O.rowSel, RX(0) - 274 * U, cy - 30 * U, 548 * U, 60 * U); else { g.fillStyle = '#ff8a1e'; g.fillRect(RX(0) - 274 * U, cy - 30 * U, 548 * U, 60 * U); } }
      // (fifo_ddr2_wkmenu.dff: the value box opt_wind01_back, 240 x 32 at 1.07 x, centred at +125.5, is drawn first -
      // the row bar goes over it and its rounded window shows the box)
      if (O.valBar) g.drawImage(O.valBar, RX(125.5) - 128.4 * U, cy - 16 * U, 256.8 * U, 32 * U);
      if (O.rowBar) g.drawImage(O.rowBar, RX(0) - 265 * U, cy - 21 * U, 530 * U, 42 * U); else { g.fillStyle = '#7fe0ff'; g.fillRect(RX(0) - 265 * U, cy - 21 * U, 530 * U, 42 * U); }     // (measured on the Wii: 327 px wide) else { g.fillStyle = '#10307a'; g.fillRect(RX(126) - 128 * U, cy - 16 * U, 257 * U, 32 * U); }
      const sim = r.small !== undefined && O.small ? O.small[r.small] : null;
      this.label(sim, r.name, RX(-129), cy - (r.sub ? 7 : 0), sim ? sim.height * U : 18, '#fff');
      if (r.sub) text(r.sub, RX(-129), cy + 17, 12, '#14306e', 'center', 'normal');
      g.save(); g.font = 'bold 26px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = on ? '#14306e' : '#3a2400'; g.strokeText(r.get(), RX(128), cy + 1);
      g.fillStyle = on ? '#ffffff' : '#ffd23c'; g.fillText(r.get(), RX(128), cy + 1); g.restore();
      if (on) {
        const bob = Math.sin(t * 8) * 2, s2 = 32 * U / (O.arrow ? O.arrow.height : 40) * 0.95;
        if (O.arrow) {
          g.save(); g.translate(RX(20) - bob, cy); g.scale(-s2, s2); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
          g.save(); g.translate(RX(235) + bob, cy); g.scale(s2, s2); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
        } else { text('<', RX(20) - bob, cy, 28, '#ff40c0', 'center'); text('>', RX(235) + bob, cy, 28, '#ff40c0', 'center'); }
      }
    });
    // CONFIRM
    const cyC = RY(rows.length - top), cOn = this.row === rows.length, cShow = rows.length < top + vis;
    if (cShow) {
      if (cOn) { if (O.orangeBar) g.drawImage(O.orangeBar, RX(-119) - 156 * U, cyC - 30 * U, 312 * U, 60 * U); else { g.fillStyle = '#ff8a1e'; g.fillRect(RX(-119) - 156 * U, cyC - 30 * U, 312 * U, 60 * U); } }
      if (O.cyanBar) g.drawImage(O.cyanBar, RX(-119) - 146 * U, cyC - 21 * U, 292 * U, 42 * U); else { g.fillStyle = '#7fe0ff'; g.fillRect(RX(-119) - 146 * U, cyC - 21 * U, 292 * U, 42 * U); }
      this.label(O.confirm, 'CONFIRM', RX(-128.5) + 9 * U, cyC, O.confirm ? O.confirm.height * U : 22, '#ff3ca0');
    }
    const pg = this.page;
    const row = rows[this.row];
    let help = cOn ? 'Confirm changes and return to previous screen.' : pg.help;
    // the game's help for the value now chosen (or the row's own help)
    if (row && !cOn && pg.player) { const h = pg.player.helps && pg.player.helps[String(this.pget(pg.player.key, this.row))]; if (h) help = h; }
    if (row && !cOn && pg.rows && pg.rows[this.row]) { const r = pg.rows[this.row]; help = (r.helps && r.helps[String(S[r.key])]) || r.help || help; }
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'model') help = this.modelMsg || 'Enter: pick a .glb / .gltf model.  Left/Right: built-in dancer or your model.';
    if (row && pg.rows && pg.rows[this.row] && /lighttest|pacdll/.test(pg.rows[this.row].action || '')) help = this.lightMsg || 'P1 arrows light outputs 1-4 (L D U R), P2 5-8, P3 9-12, P4 13-16. Enter: test / pick the DLL.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].light) help = 'Left/Right: pick the PAC Drive pin for this arrow (the chosen pin lights up). OFF: no light. Pins past 16 are on a 2nd board.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'board') help = this.lightMsg || Board.msg || pg.rows[this.row].help;
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'lightreset') help = this.lightMsg || 'Enter: put every arrow back on the standard pins.';
    this.helpBox(help);
    if (this.ask) this.drawAsk(t);
    // the hints: BACK, SELECT, Pointer:SELECT (comAF 3, 4, 32), as on the Wii
    if (A.hints && A.hints[3]) [3, 4, 32].forEach((id, j) => A.hints[id] && g.drawImage(A.hints[id], 740 + j * 155, 651, 150, 24));
    else text('Up/Down: choose    Left/Right: change    Enter: confirm    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// ---- CREDIT: the game's staff roll (text_eng.bin), scrolling up; Up/Down to scroll by hand, Enter/Esc to leave
const Credits = {
  bgm: 'MU_BGM_FREE',
  lines: null, y: 0, at: 0, hand: 0,
  enter() {
    this.at = performance.now(); this.hand = 0;
    if (!this.lines) api('/api/ddr2credits').then(r => { this.lines = (r && r.lines) || []; }).catch(() => { this.lines = []; });
  },
  input(a, p) {
    if (!p) return;
    if (/^P[1-4]U$/.test(a)) this.hand -= 160;
    else if (/^P[1-4]D$/.test(a)) this.hand += 160;
    else if (a === 'START' || a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Options); }
  },
  draw(t) {
    // the Wii's staff roll (Dolphin 2026-11-18): a dark screen - near black at the top left, deep red at the bottom
    // right - the names left-aligned at x 222 in the game's lettering, the roles yellow and the names white, 30 px a
    // line, about 174 px from a group's last name to the next role. (Its drifting particles and arrows aren't
    // traced yet.)
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#05040e'); bg.addColorStop(0.55, '#1a0612'); bg.addColorStop(1, '#5a0a0a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const L = this.lines || [];
    if (!L.length) { text(this.lines ? 'No credits found on the disc.' : 'Loading...', W / 2, H / 2, 26, '#fff', 'center'); return; }
    const LH = 30, GAP = 174;
    let total = 0, prev = null;
    for (const [k, s2] of L) { if (k !== 'name' && prev === 'name') total += GAP - LH; total += LH * s2.split('\n').length; prev = k; }
    const scroll = ((performance.now() - this.at) / 1000 * 60 + this.hand) % (total + H);
    let y = H - scroll; prev = null;
    for (const [k, s2] of L) {
      if (k !== 'name' && prev === 'name') y += GAP - LH;
      for (const ln of s2.split('\n')) {
        if (y > -40 && y < H + 40) {
          if (A.font) gtext(ln, 222, y, 22, k === 'name' ? '#ffffff' : '#ffe83a', 'left', 2.6, 1);
          else text(ln, 222, y, 22, k === 'name' ? '#fff' : '#ffe83a', 'left', 'bold');
        }
        y += LH;
      }
      prev = k;
    }
    // (no button hints on the Wii's staff roll)
  },
};

// ---- controls
const Controls = {
  bgm: 'MU_BGM_FREE',
  i: 0, waiting: false, msg: '',
  input(a, p, t, menuKey) {
    if (!p || this.waiting) return;
    if (a === 'P1U') this.i = (this.i + ACTIONS.length) % (ACTIONS.length + 1);
    else if (a === 'P1D') this.i = (this.i + 1) % (ACTIONS.length + 1);
    else if (a === 'START') {
      if (this.i === ACTIONS.length) { go(Options); return; }
      this.waiting = true; this.msg = 'Press the key, button or panel for ' + ACTIONS[this.i][1] + '  (wait 5 s to cancel)';
      const act = ACTIONS[this.i][0];
      const timer = setTimeout(() => { input.capture = null; this.waiting = false; this.msg = 'Cancelled.'; }, 5000);
      input.capture = b => {
        clearTimeout(timer);
        const list = input.bindings[act] || (input.bindings[act] = []);
        if (!list.some(x => Input.id(x) === Input.id(b))) list.push(b);
        S.bindings = input.bindings; saveSettings();
        this.waiting = false; this.msg = 'Added ' + bindName(b) + ' to ' + ACTIONS[this.i][1];
      };
    } else if (a === 'OPTIONS') {
      if (this.i < ACTIONS.length) {
        const act = ACTIONS[this.i][0];
        input.bindings[act] = [];
        S.bindings = input.bindings; saveSettings();
        this.msg = 'Cleared ' + ACTIONS[this.i][1];
      }
    } else if (a === 'BACK') { sfx('SE_SYS_CANCEL'); go(Options); }
  },
  key(e) {
    if (this.waiting) return;
    if (e.code === 'Delete' && this.i < ACTIONS.length) { this.input('OPTIONS', true); }
    if (e.code === 'KeyR' && e.ctrlKey) { e.preventDefault(); input.setBindings(null); S.bindings = null; saveSettings(); this.msg = 'Reset to defaults.'; }
  },
  draw(t) {
    menuBackground(t);
    text('CONTROLS', 40, 40, 34);
    panel(140, 80, 1000, 580);
    const rows = 12, top = Math.max(0, Math.min(ACTIONS.length + 1 - rows, this.i - 6));
    if (top > 0) text('\u25b2', 640, 90, 16, '#fff', 'center');
    if (top + rows < ACTIONS.length + 1) text('\u25bc', 640, 600, 16, '#fff', 'center');
    ACTIONS.forEach(([act, name], i) => {
      if (i < top || i >= top + rows) return;
      const y = 115 + (i - top) * 40, on = i === this.i;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(150, y - 20, 980, 40); }
      text(name, 180, y, 24, on ? '#ffd23c' : '#fff');
      const list = (input.bindings[act] || []).map(bindName).join(',  ') || '(none)';
      text(list.slice(0, 70), 420, y, 20, '#9fe', 'left', 'normal');
    });
    const y = 115 + (ACTIONS.length - top) * 40, on = this.i === ACTIONS.length;
    if (ACTIONS.length < top + rows) {
      if (on) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(150, y - 20, 980, 40); }
      text('Done', 180, y, 24, on ? '#ffd23c' : '#fff');
    }
    if (this.msg) text(this.msg, W / 2, 625, 20, this.waiting ? '#ffd23c' : '#cfe', 'center', 'normal');
    text('Enter: add a binding   Tab or Delete: clear   Ctrl+R: reset all   Esc: back   (arrow keys/Enter/Esc always work in menus)',
         W / 2, 690, 16, '#789', 'center', 'normal');
  },
};


// ---- custom songs: your own folders ("Rock", "Anime"...) of StepMania songs
const CustomSongs = {
  bgm: 'MU_BGM_FREE',
  folder: null, i: 0, typing: null, confirm: null, msg: '', busy: false,
  enter() { this.folder = null; this.i = 0; this.typing = null; this.confirm = null; this.msg = ''; this.refresh(); },
  async refresh() {
    try { const c = await api('/api/custom/songs'); this.folders = c.folders || []; this.songs = c.songs || []; }
    catch (e) { this.folders = []; this.songs = []; this.msg = 'Could not read the Custom Songs folder.'; }
  },
  async leave() { SONGS = await loadSongs(); },        // song select picks up the changes
  rows() {
    if (this.folder === null) return (this.folders || []).map(f => ({ kind: 'folder', name: f })).concat([{ kind: 'new', name: '+ NEW FOLDER' }]);
    const list = (this.songs || []).filter(s => s.folder === this.folder).sort((a, b) => a.name.localeCompare(b.name));
    return [{ kind: 'files', name: '+ IMPORT SONGS (.sm / .ssc files)' }, { kind: 'pack', name: '+ IMPORT A FOLDER OF SONGS' }]
      .concat(list.map(s => ({ kind: 'song', name: s.name, song: s })), [{ kind: 'delfolder', name: '- DELETE THIS FOLDER' }]);
  },
  async post(body) {
    this.busy = true;
    try { return await api('/api/custom', body); } finally { this.busy = false; await this.refresh(); }
  },
  async input(a, p) {
    if (!p || this.typing !== null || this.busy) return;
    const rows = this.rows(), r = rows[this.i];
    if (this.confirm) {
      const c = this.confirm; this.confirm = null;
      if (a !== 'START') return;
      if (c.kind === 'folder') { await this.post({ delete: c.name }); this.msg = 'Deleted the ' + c.name + ' folder.'; this.i = 0; this.folder = null; if (Select.inFolder === c.name) Select.inFolder = null; }
      else { await this.post({ remove: c.song.slot }); this.msg = 'Removed ' + c.song.name + '.'; this.i = Math.max(0, this.i - 1); }
      return;
    }
    if (/^P[12]U$/.test(a)) { this.i = (this.i + rows.length - 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[12]D$/.test(a)) { this.i = (this.i + 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START' && r) {
      sfx('SE_SYS_DECIDE01');
      if (r.kind === 'new') { this.typing = ''; this.msg = ''; }
      else if (r.kind === 'delfolder') { this.confirm = { kind: 'folder', name: this.folder }; }
      else if (r.kind === 'folder') { this.folder = r.name; this.i = 0; this.msg = ''; }
      else if (r.kind === 'files' || r.kind === 'pack') {
        this.msg = 'A window should open (it may be behind the browser)...';
        const res = await this.post({ import: this.folder, pick: r.kind === 'pack' ? 'folder' : 'files' });
        if (!res.ok) this.msg = res.error || 'Nothing imported.';
        else this.msg = `Imported ${res.added.length} song${res.added.length === 1 ? '' : 's'}` + (res.skipped.length ? ` (${res.skipped.length} already here)` : '') + '.'
                      + (res.noVideo ? `  ${res.noVideo} old-format video${res.noVideo === 1 ? '' : 's'} skipped (install ffmpeg to convert them).` : '');
      }
    } else if (a === 'OPTIONS' && r && (r.kind === 'folder' || r.kind === 'song')) { this.confirm = r; }
    else if (a === 'BACK') {
      sfx('SE_SYS_WINDOWOUT');
      if (this.folder !== null) { const f = this.folder; this.folder = null; this.i = Math.max(0, (this.folders || []).indexOf(f)); }
      else go(Options);
    }
  },
  key(e) {
    if (this.typing === null) return;
    e.preventDefault();
    if (e.code === 'Escape') { this.typing = null; return; }
    if (e.code === 'Backspace') { this.typing = this.typing.slice(0, -1); return; }
    if (e.code === 'Enter') {
      const name = this.typing.trim();
      if (!name) return;
      this.typing = null;
      this.post({ create: name }).then(r => {
        if (!r.ok) { this.msg = r.error || 'Could not make that folder.'; return; }
        this.folder = r.folder; this.i = 0; this.msg = 'Made the ' + r.folder + ' folder. Now import some songs.';
      });
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 &'!().,_+-]/.test(e.key) && this.typing.length < 24) this.typing += e.key;
  },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(this.folder === null ? 'CUSTOM SONGS' : this.folder.toUpperCase(), 210, 44, 30, '#fff', 'center');
    panel(240, 100, 800, 540);
    if (this.typing !== null) {
      text('NEW FOLDER', 640, 170, 30, '#ffd23c', 'center');
      text('Type a name (like Rock or Anime), then press Enter', 640, 225, 20, '#fff', 'center', 'normal');
      g.fillStyle = 'rgba(0,20,70,0.85)'; g.fillRect(400, 270, 480, 66);
      text(this.typing + ((t * 2 | 0) % 2 ? '_' : ' '), 640, 303, 34, '#fff', 'center');
      text('Esc: cancel', 640, 380, 18, '#cfe', 'center', 'normal');
      return;
    }
    const rows = this.rows(), n = 10, top = Math.max(0, Math.min(rows.length - n, this.i - 5));
    if (this.folder === null && !(this.folders || []).length) text('No folders yet. Make one, then import songs into it.', 640, 150, 20, '#fff', 'center', 'normal');
    rows.slice(top, top + n).forEach((r, k) => {
      const i = top + k, y = (this.folder === null && !(this.folders || []).length ? 200 : 140) + k * 46, on = i === this.i;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(270, y - 20, 740, 40); }
      const col = r.kind === 'song' || r.kind === 'folder' ? '#fff' : '#9fffd0';
      text(r.name.slice(0, 44), 300, y, 24, on ? '#ffd23c' : col);
      if (r.kind === 'folder') {
        const cnt = (this.songs || []).filter(s => s.folder === r.name).length;
        text(cnt + (cnt === 1 ? ' song' : ' songs'), 980, y, 18, '#dff', 'right', 'normal');
      } else if (r.kind === 'song') {
        const lv = r.song.single.map((v, j) => v ? DIFFS[j][1][0] + v : '').filter(Boolean).join(' ');
        text(lv, 980, y, 15, '#dff', 'right', 'normal');
      }
    });
    if (this.confirm) {
      g.fillStyle = 'rgba(80,0,20,0.94)'; g.fillRect(360, 300, 560, 120);
      const what = this.confirm.kind === 'folder' ? `Delete the ${this.confirm.name} folder and its songs?` : `Remove ${this.confirm.song.name.slice(0, 30)}?`;
      text(what, 640, 340, 22, '#fff', 'center');
      text('(only DDR II PC\'s copy - your original files stay)   Enter: yes   other: no', 640, 380, 15, '#fcc', 'center', 'normal');
    }
    if (this.busy) text('Working...', 640, 610, 20, '#0d3770', 'center');
    else if (this.msg) text(this.msg, 640, 610, 20, '#0d3770', 'center');
    text(this.folder === null ? 'Enter: open / new folder    Tab: delete folder    Esc: back'
                              : 'Enter: import    Tab: remove song    Esc: back to folders', 640, 690, 17, '#0d3770', 'center', 'normal');
  },
};

// ---- how freeze arrows work (shown before a BEGINNER song that has them)
// HP4's page list (0x800f4fb4; param_3 = the highest difficulty index among the players, 0 = BEGINNER;
// param_4 & 2 = a player on CHOREOGRAPH; param_5 = +0xcc, 2 = Balance Board; param_7 / 8 = style / players)
function hp4ExplainPages(charts) {
  const L = [], board = boardNow(), choreo = charts.some(c => c.built && c.built.kind === 'choreo');
  const top = Math.max(...charts.map(c => Math.max(0, gcRank(c.diff))));
  if (!board && GROUP === 'family' && charts.length >= 2) L.push(34 + Math.min(charts.length, 4) - 1);
  if (board) L.push(18, 19, 17, 30);
  else {
    if (choreo) L.push(15, 33, 31, 32, 34);
    if (top === 0 && !choreo) L.push(4);
    if (top !== 0) L.push(11);
  }
  return L.filter(k => A.img.explain[k]);
}
// the explanation pages shown before a lesson or a first BEGINNER song
const Explain = {
  seen: new Set(),
  // page: which of the game's explanation pictures (comAF /5/4: 4 Arrow, 5-10 STEP LESSON 1-6, 11 Freeze Arrow)
  // (pages = several pages to leaf through with left / right: HP4's CHOREOGRAPH explanation)
  with(next, page = 11, pages = null, auto = false) { this.next = next; this.page = pages ? pages[0] : page; this.pages = pages; this.auto = auto; return this; },
  enter() { this.t0 = performance.now(); sfx('SE_SYS_WINDOWIN'); },
  // (0x800f4258 state 5: START and the Let's dance! hint only once its timer has counted 60 at 60 a second
  // (DAT_802b78bc) and the song has loaded (0x8003f9fc -> 0x800f4fa8 sets +0x24) - the PC has loaded already)
  ready() { return performance.now() - this.t0 >= 1000; },
  input(a, p) {
    if (!p) return;
    if (this.auto) { if (DEMO.on) endDemo(); return; }      // (DEMO PLAY: any button goes back to the title)
    const pg = this.pages, d = /^P[1-4]([LR])$/.exec(a);
    if (pg && d) { if (pg.length < 2) return; const k = pg.indexOf(this.page), n = (k + (d[1] === 'R' ? 1 : -1) + pg.length) % pg.length; this.page = pg[n]; sfx('SE_SYS_SELECT01'); return; }   // (the game wraps around: 0x800f4258 state 5)
    if (a === 'START') { if (!this.ready()) return; /* (DDR II's 0x8010476c too: A only once its timer has counted 60) */ sfx('SE_SYS_DECIDE01'); go(this.next); }
    // (back out of a lesson's explanation: SELECT LESSON)
    // (DDR II: B does nothing on a lesson's explanation page - Wii 2026-11-18; elsewhere it backs out)
    else if (a === 'BACK' && !(!HP4 && this.next && this.next.song && this.next.song.lesson)) { sfx('SE_SYS_WINDOWOUT'); go(this.next && this.next.song && this.next.song.lesson ? LessonSel : this.next); }
  },
  draw(t) {
    // the game's own page: the 640 x 480 picture in the middle of the 854 x 480 screen with its side panels
    // (107 wide each), all at 1.5x; the Let's dance! button (comAF hint 34) at the bottom right - placed
    // from the Wii screenshot (Step Lesson 1)
    const E = A.img.explain, pg = E && E[this.page];
    if (this.auto && this.ready()) { go(this.next); return; }
    if (pg) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (E[0]) g.drawImage(E[0], 0, 0, 107 * 1.5, 720);
      if (E[1]) g.drawImage(E[1], (107 + 640) * 1.5, 0, 107 * 1.5, 720);
      g.drawImage(pg, 107 * 1.5, 0, 640 * 1.5, 720);
      // the game writes "n/N" at the header's right end, "1/1" too (Dolphin 2026-11-17: Freeze Arrow 1/1)
      const np = this.pages ? this.pages.length : 1, ip = this.pages ? this.pages.indexOf(this.page) + 1 : 1;
      if (HP4 || np > 1) gtext(ip + '/' + np, 1077, 61, 44, '#fff', 'right');
      // the hint bar (0x800f627c: a 64-bit mask of comAF hints): (+) SELECT (hint 5) while there are pages to
      // leaf through, (A) Let's dance! (hint 34) once ready; packed from the right, right edge at 800 of the
      // 854-wide screen, middle at y 443 (Dolphin 2026-11-17, 1305-px-wide frame: both hints 100 x 16)
      const hs = [];
      if (HP4 && np > 1) hs.push(5);
      if (this.ready() && !this.auto) hs.push(34);
      let hx = 1200;
      for (const k of hs.reverse()) {
        const h = A.hints && A.hints[k];
        if (h) { hx -= h.width * 1.5; g.drawImage(h, hx, 665 - h.height * 0.75, h.width * 1.5, h.height * 1.5); hx -= 8; }
        else if (k === 34) text("Let's dance!", hx - 75, 665, 20, '#ffe86a', 'center');
      }
      return;
    }
    // laid out like the game's: header, the title on the left, the step zone with two freeze arrows
    // on the right with labels pointing at them, and the instruction under it
    // a dark backdrop with big concentric rings
    const bg = g.createRadialGradient(640, 380, 40, 640, 380, 760);
    bg.addColorStop(0, '#2a3b52'); bg.addColorStop(0.5, '#162436'); bg.addColorStop(1, '#070d16');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const [r, w, c] of [[90, 18, 'rgba(60,140,220,0.35)'], [170, 10, 'rgba(0,0,0,0.45)'], [250, 26, 'rgba(255,255,255,0.05)'], [340, 8, 'rgba(0,0,0,0.5)'], [430, 30, 'rgba(255,255,255,0.04)'], [540, 12, 'rgba(0,0,0,0.45)']]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(640, 380, r, 0, Math.PI * 2); g.stroke();
    }
    const hx = 330, hw = 620;
    g.fillStyle = 'rgba(90,100,120,0.9)'; g.fillRect(hx - 8, -10, hw + 16, 82);
    const hg = g.createLinearGradient(0, 0, 0, 62);
    hg.addColorStop(0, '#9fd8ff'); hg.addColorStop(0.5, '#3d9ef0'); hg.addColorStop(1, '#1f6fd0');
    g.fillStyle = hg; g.fillRect(hx, -4, hw, 66);
    g.strokeStyle = '#0d3f9a'; g.lineWidth = 3; g.strokeRect(hx, -4, hw, 66);
    text('Explanation of Freeze Arrow', 640, 29, 34, '#fff', 'center');
    const title = (str, x, y, size, col) => {
      g.font = `bold ${size}px Georgia, serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.strokeStyle = '#5a1000'; g.lineWidth = size / 5; g.strokeText(str, x, y);
      g.fillStyle = col; g.fillText(str, x, y);
    };
    const og = g.createLinearGradient(0, 85, 0, 125); og.addColorStop(0, '#ffe24a'); og.addColorStop(1, '#ff6a00');
    title('Freeze Arrow', 190, 105, 40, og);
    // the step zone (4 lanes) with freeze arrows on left and right
    const size = 76, lx = [574, 646, 718, 790], ry = 118;
    lx.forEach((x, l) => { if (A.arrowGrey && A.arrowGrey[0][l]) g.drawImage(A.arrowGrey[0][l], x - size / 2, ry - size / 2, size, size); });
    const t1 = performance.now() / 1000;
    [[0, 395], [3, 410]].forEach(([l, end]) => {
      const fz = A.freezeOn && A.freezeOn[l], y = ry + 42 + Math.sin(t1 * 2 + l) * 2;
      if (fz && fz.body) Dancer.prototype.drawFreeze(fz, lx[l], y, end, size, false);
      else { g.fillStyle = '#9fe05a'; g.fillRect(lx[l] - 30, y, 60, end - y); }
      if (fz && fz.head) g.drawImage(fz.head, lx[l] - size / 2, y - size / 2, size, size);
    });
    // red labels with arrows pointing at the freeze arrows
    const callout = (x, y, pts) => {
      g.font = 'bold 26px Georgia, serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeText('Freeze Arrow', x, y);
      g.fillStyle = '#e8101a'; g.fillText('Freeze Arrow', x, y);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
      g.strokeStyle = '#e8101a'; g.lineWidth = 3; g.stroke();
      const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2], an = Math.atan2(ay - by, ax - bx);
      g.fillStyle = '#e8101a'; g.beginPath(); g.moveTo(ax + Math.cos(an) * 6, ay + Math.sin(an) * 6);
      g.lineTo(ax + Math.cos(an + 2.6) * 16, ay + Math.sin(an + 2.6) * 16); g.lineTo(ax + Math.cos(an - 2.6) * 16, ay + Math.sin(an - 2.6) * 16); g.fill();
    };
    callout(330, 182, [[330, 192], [540, 192]]);
    callout(510, 262, [[510, 272], [720, 272], [770, 222]]);
    // the instruction, with a blue arrow beside it
    ['When a Freeze Arrow appears,', 'press and hold down the', 'corresponding button.'].forEach((ln, i) =>
      text(ln, 190, 440 + i * 38, 28, '#fff', 'left'));
    const blue = A.arrow && A.arrow('#3cb4ff', 0, 0); if (blue) g.drawImage(blue, 545, 448, 66, 66);
    // what happens next (this game's own note)
    text('Held to the end: O.K.     Let go too soon: N.G. (the Dance Gauge drops)', 190, 580, 18, '#cfe8ff', 'left', 'normal');
    // after a moment the prompt to go on appears
    if (performance.now() - this.t0 > 1500) {
      const a = 0.65 + 0.35 * Math.sin(performance.now() / 250);
      g.globalAlpha = a; g.fillStyle = '#36c24a'; g.beginPath(); g.arc(1086, 676, 10, 0, Math.PI * 2); g.fill();
      text("Let's dance!", 1104, 677, 20, '#ffe86a', 'left'); g.globalAlpha = 1;
      text('Enter', 1086, 652, 12, '#cfe8ff', 'center', 'normal');
    }
  },
};

// ---- dance mat check: step on each mat so the game knows which mat is which player
const MatCheck = {
  bgm: 'MU_BGM_FREE',
  // the mats to find, in order. game = a VERSUS game is about to start (else: from Options)
  rolesFor(game) {
    const dbl = styleNow() === 'double';
    let list;
    if (game && dbl) list = [['P1', 'PLAYER 1', 'LEFT mat'], ['P2', 'PLAYER 1', 'RIGHT mat'], ['P3', 'PLAYER 2', 'LEFT mat'], ['P4', 'PLAYER 2', 'RIGHT mat']];
    else if (game) list = [['P1', 'PLAYER 1', 'mat'], ['P2', 'PLAYER 2', 'mat']];
    else list = [['P1', 'P1 arrows', 'mat'], ['P2', 'P2 arrows', 'mat'], ['P3', 'P3 arrows', 'mat'], ['P4', 'P4 arrows', 'mat']];
    const seen = new Set(), out = [];
    for (const [k, who, what] of list) {
      const pad = input.padOf(k);
      if (pad === null || seen.has(pad)) continue;       // on keys, or the same device as an earlier mat
      seen.add(pad); out.push({ k, who, what, pad });
    }
    return out;
  },
  with(next, game) { this.next = next; this.game = game; return this; },
  enter() {
    this.roles = this.rolesFor(this.game);
    this.i = 0; this.map = {}; this.msg = ''; this.doneAt = 0;
    if (!this.roles.length) { this.msg = 'No dance mats are mapped yet. Map them in Options > Controls first.'; return; }
    input.padWatch = real => this.found(real);
  },
  leave() { input.padWatch = null; },
  found(real) {
    if (this.doneAt) return;
    if (real in this.map) { this.msg = 'That mat is already ' + this.labelOf(this.map[real]) + '. Step on the next one.'; sfx('SE_SYS_ERROR'); return; }
    this.map[real] = this.roles[this.i].pad;
    this.msg = ''; sfx('SE_SYS_DECIDE01');
    if (++this.i >= this.roles.length) {
      input.padWatch = null; input.setPadMap(this.map);
      this.doneAt = performance.now();
    }
  },
  labelOf(pad) { const r = this.roles.find(r => r.pad === pad); return r ? `${r.who}'s ${r.what}` : 'taken'; },
  update() { if (this.doneAt && performance.now() - this.doneAt > 700) go(this.next); },
  input(a, p, t, menuKey) {
    if (!p) return;
    if (a === 'BACK' && !this.doneAt) { sfx('SE_SYS_WINDOWOUT'); input.matsChecked = true; input.padsChanged = false; go(this.next); }   // keep the mats as they are
  },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('DANCE MATS', 210, 44, 34, '#fff', 'center');
    panel(240, 110, 800, 500);
    if (!this.roles.length) { text(this.msg, 640, 340, 22, '#fff', 'center', 'normal'); text('Esc: back', 640, 560, 18, '#cfe', 'center', 'normal'); return; }
    const r = this.roles[Math.min(this.i, this.roles.length - 1)];
    if (this.doneAt) text('All mats ready!', 640, 200, 40, '#ffd23c', 'center');
    else {
      text(r.who, 640, 175, 40, r.who.startsWith('PLAYER 2') ? '#ff8ab8' : '#7fd8ff', 'center');
      text('Step on your ' + r.what, 640, 230, 32, '#fff', 'center');
      text('(any arrow)', 640, 268, 18, '#cfe', 'center', 'normal');
    }
    this.roles.forEach((x, i) => {
      const y = 330 + i * 46, done = i < this.i, on = i === this.i && !this.doneAt;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(380, y - 20, 520, 40); }
      text(`${x.who}  ${x.what}`, 410, y, 24, on ? '#ffd23c' : '#fff');
      text(done ? 'OK' : on && (t * 2 | 0) % 2 ? '...' : '', 870, y, 24, '#7f7', 'right');
    });
    if (this.msg) text(this.msg, 640, 540, 18, '#ffd0d0', 'center', 'normal');
    text('Esc: skip (keep the mats as they are)', 640, 585, 16, '#cfe', 'center', 'normal');
  },
};

// a custom song's music, decoded by the browser (ogg / mp3 / wav ...)
async function customAudio(song) {
  return audio().decodeAudioData(await bin('/api/custom/audio/' + song.slot));
}
// the song's sample section (SAMPLESTART / SAMPLELENGTH) as its own buffer, for song select
async function customPreview(song) {
  const full = await customAudio(song), sr = full.sampleRate;
  const [st, len] = song.sample || [30, 12];
  const a = Math.max(0, Math.min(full.length - 1, Math.floor(st * sr))), n = Math.max(1, Math.min(full.length - a, Math.floor((len || 12) * sr)));
  const out = audio().createBuffer(full.numberOfChannels, n, sr);
  for (let c = 0; c < full.numberOfChannels; c++) out.copyToChannel(full.getChannelData(c).subarray(a, a + n), c);
  return out;
}

// ---- loading
const Loading = {
  song: null, msg: '', err: '',
  with(song) { this.song = pickVersion(song); return this; },
  async enter() {
    this.msg = 'Loading...'; this.err = '';
    this.at = performance.now();
    // the short close-in's sound (0x8010502c: sound 602 = SE_SYS_SHUTCLOSE)
    loadRing().then(() => { if (RING.parts && scene === this) sfx('SE_SYS_SHUTCLOSE'); });
    const song = this.song;
    HP_LOOK = song.disc === 'hp' || song.disc === 'hp2' || song.disc === 'hp3';
    try {
      const [chartBuf, audioBuf, dance] = await Promise.all([
        song.custom ? api('/api/custom/chart/' + song.slot) : bin('/api/chart/' + song.slot),
        song.custom ? customAudio(song) : bin('/api/audio/' + song.slot),
        // (HP4: with a CHOREOGRAPH player the game dances the song's CHO cue sheet - its own camera shots;
        // main.dol 0x80107084 / 0x8003a6e8, Dolphin 2026-11-17)
        S.dancer && look('dancer') === 'ddr2' && window.Dancer3D ? api('/api/dance/' + danceNo(song) + (HP4 && PCHOREO.some(x => x) ? '?cho=1' : '')).catch(() => null) : null,
        S.dancer && look('dancer') === 'ddr2' ? ddr2Dancer(song.lesson ? '202' : null).catch(e => console.error('ddr2 dancer', e)) : null]);
      this.dance = dance;
      // a Hottest Party song plays on its own 3D stage from the disc
      this.stage = null;
      // a 3D stage from Hottest Party's disc. Its songs dance their own routine; any other song
      // borrows the routine of the Hottest Party song closest to it in BPM (the moves follow measures)
      // (Hottest Party 3 songs use HP2's stages and dancers for now: same engine, their own aren't read yet)
      // Hottest Party 3 plays the song's music video instead of a 3D stage (as the game does)
      const hp3Video = song.disc === 'hp3' && song.movie && song.movie.sync && S.movies !== false;
      // DDR II's own 3D stages: the stage the game picks for this song (server: Game.stage_for). Songs
      // with a music video keep the video, as on the Wii (their stages are the video-screen ones)
      const ddr2Video = song.movie && song.movie.sync && S.movies !== false;
      if (hp3Video) this.stage = null;
      else if (!song.disc && !song.custom && look('stage') === 'ddr2' && S.ddr2Stage3d !== false && window.HPStage) {
        this.msg = 'Building the stage...';
        try {
          // (HP4 DANCE VIEW: stage 201 = STG202 - the play controller's +0xd8 in the Dolphin copy, 0xc9)
          const dvStage = HP4 && S.mode === 'training' && TRAIN.view;
          const r = await fetch('/api/ddr2stage/' + song.slot + (dvStage ? '?n=201&x=1' : HP4 && /^[0-7]$/.test(S.hp4Stage || '') ? '?pick=' + S.hp4Stage : ''));
          // a song with its own video: on stage 28 (the green circuit world) the video plays on the stage's
          // framed monitor, seen head-on, with no dancer (Dolphin footage); otherwise it plays full screen
          let sd = r.ok ? await r.json() : null;
          const pvStage = sd && [27, 28, 29].includes(sd.id);
          if (sd && ddr2Video && !pvStage) sd = null;
          if (sd) {
            this.stage = HPStage.fromData(sd); this.stage.hp2 = 'ddr2';
            // the video stages (27 moon and snow, 28 circuit world, 29 water cave): a fixed head-on view of
            // the framed monitor at the right, no dancer; it plays the song's video, else the stage movie
            if (pvStage) {
              // (camera fitted to the Wii footage vz/pvreal.png, 1 player: the 80 x 45 screen is 46% of the picture's
              // width, its middle at 68% across and just below half way - MEASURED, not traced from main.dol. The
              // old camera, 62 away and dead centre, made the video fill the screen. 2 players / DOUBLE: centred,
              // ASSUMED - no footage of those.)
              const pvOne = !P2 && !GROUP && styleNow() !== 'double';
              const pvX = pvOne ? -30.4 : 0;
              this.stage.pvCam = { eye: [pvX, 1, 117], at: [pvX, 1, -50], roll: 0, fov: 45, near: 1, far: 100000 };
              this.stage.noDancer = true;
              if (ddr2Video) this.stage.setMovie(song.movie.file, { sync: true });
            }
            // backup dancers: only the boss stage has them (Dolphin's file log: normal songs load just
            // your dancer; Unbelievable loads CHR207, CHR208 and CHR209 - yours plus the other two)
            if (Dancer3D.useExtras) {
              let lead = (Dancer3D.customFor || '').match(/ddr2char\/(\d{3})\//);
              const boss = [200, 204, 205].includes(sd.id) && lead;
              // the boss stage always has the same three: CHR208 leads (the first character file the
              // game loads for it, Dolphin's file log; you always play as her), CHR207 and CHR209 behind
              if (boss && lead[1] !== '208') { await Dancer3D.useModel('/api/ddr2char/208/1'); lead = [null, '208']; }
              const trio = ['207', '209'];
              if (boss && sd.introCams && sd.introCams.length) this.stage.bossIntro = true;
              // HP4: two backup dancers as full models, not silhouettes. The play set-up's dancer list (+0x22c
              // count, records of 0x38 at +0x230: +4 character, +8 outfit, +0x30 accessory mask - 0x80107734
              // loads sound/stream/character/CHR<id+1><outfit+1>.bin) held 3 dancers in every Dolphin copy:
              // the lead, then characters 73 and 74 = CHR74 / CHR75, the backup dancers (4-player and 2P
              // copies: outfits 0 / 0 and 1 / 2; DANCE VIEW 1 / 2 and 2 / 1 - the player's MY BACKUP DANCERS
              // choice, menu 0x8005f770; by default random - hp4Backups). They stand at the dance's formation
              // spots 2 / 3 and wear the same accessories as the lead. (Lessons: the teacher dances alone.)
              const hp4Back = HP4 && !boss && !song.lesson;
              const accQ = (Dancer3D.customFor || '').match(/\?acc=\d+/);
              const backUrls = boss ? trio.map(id => '/api/ddr2char/' + id + '/1')
                : hp4Back ? hp4Backups(song.slot).map(b => '/api/ddr2char/' + b + (accQ ? accQ[0] : '')) : [];
              this.stage.backUrls = backUrls;          // (drawDancer puts them back if a menu swapped the set meanwhile)
              await Dancer3D.useExtras(backUrls);
              // normal songs: the backup silhouettes and their picture, as the stage's record says (0 = none)
              // (lessons: none - the teacher dances alone, as on the Wii)
              if (Dancer3D.useSilhouette) await Dancer3D.useSilhouette(boss || hp4Back || song.lesson ? 0 : sd.silhouette || 0);
            }
            // its screens play one of the stage movies (if it has any)
            if (!(pvStage && ddr2Video) && (sd.models.some(m => (m.materials || []).some(t => t.gx && t.gx.movie)) || (sd.variantKinds || []).includes(1)) && S.movies !== false) {
              try {
                const mv = await (await fetch('/api/ddr2movie/' + song.slot + '?n=' + sd.id)).json();
                if (mv.movie) this.stage.setMovie(mv.movie);
                (mv.movies || []).forEach((f, k) => { if (k && f) this.stage.setMovie(f, {}, k); });
              } catch (e) { /* no movie */ }
            }
          }
        } catch (e) { console.error('ddr2 stage', e); this.stage = null; }
      }
      else if ((song.disc === 'hp2' || song.disc === 'hp3' || (look('dancer') === 'hp2' && !hpAvailable() && hp2Available())) && look('stage') === 'hp' && S.hpStage !== false && window.HPStage) {
        // Hottest Party 2's own stages, camera moves and dancers (HP1's dancers stand in if HP2's won't load)
        this.msg = 'Building the stage...';
        try {
          // Hottest Party 3's songs on one of its own stages (HP2's if those can't be read)
          this.stage = song.disc === 'hp3' ? await HPStage.loadHP2('random', 'hp3') : null;
          if (!this.stage && hp2Available()) this.stage = await HPStage.loadHP2('random');
          const dl = look('dancer');
          if (this.stage && S.hpDancer !== 'off' && (dl === 'hp' || dl === 'hp2')) {
            this.msg = 'Bringing in the dancers...';
            let ok = false;
            try {
              let ds = song.slot;
              if (song.disc !== 'hp2') {            // another game's song: the HP2 routine closest in BPM
                const bpm = (song.bpm && +song.bpm[1]) || 130, h2 = SONGS.filter(s => s.disc === 'hp2');
                h2.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
                ds = h2.length ? h2[0].slot : ds;
              }
              // Hottest Party 3's songs get its own dancers dancing their own routine
              ok = song.disc === 'hp3' ? await HPStage.addDancersHP2(this.stage, song.slot, 'hp3') || await HPStage.addDancersHP2(this.stage, ds)
                                       : await HPStage.addDancersHP2(this.stage, ds);
            } catch (e) { console.error('hp2 dancers', e); }
            if (!ok && hpAvailable()) {
              const hps = SONGS.filter(s => s.disc === 'hp'), bpm = (song.bpm && +song.bpm[1]) || 130;
              hps.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
              if (hps.length) await HPStage.addDancers(this.stage, hps[0].slot, S.hpDancer || '001');
            }
          }
        } catch (e) { console.error('hp2 stage', e); this.stage = null; }
      } else
      if (look('stage') === 'hp' && hpAvailable() && S.hpStage !== false && window.HPStage) {
        this.msg = 'Building the stage...';
        let ds = song.slot;
        if (song.disc !== 'hp') {
          const bpm = (song.bpm && +song.bpm[1]) || 130;
          const hps = SONGS.filter(s => s.disc === 'hp');
          hps.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
          ds = hps.length ? hps[0].slot : song.slot;
        }
        try {
          this.stage = await HPStage.load(ds, S.hpStage);
          if (this.stage && S.hpDancer !== 'off' && look('dancer') === 'hp') { this.msg = 'Bringing in the dancers...'; await HPStage.addDancers(this.stage, ds, S.hpDancer || '001'); }
          else if (this.stage && look('dancer') === 'hp2' && hp2Available()) {
            // Hottest Party 2's dancers on any song: the HP2 routine closest in BPM, kept on this song's beat
            const bpm = (song.bpm && +song.bpm[1]) || 130, h2 = SONGS.filter(s => s.disc === 'hp2');
            h2.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
            this.msg = 'Bringing in the dancers...';
            if (h2.length) await HPStage.addDancersHP2(this.stage, song.disc === 'hp2' ? song.slot : h2[0].slot);
          }
        } catch (e) { console.error('stage', e); this.stage = null; }
      }
      this.msg = 'Decoding...';
      await new Promise(r => setTimeout(r, 20));
      BOARD_LESSON = !!(HP4 && song.lesson >= 12);
      const ss4 = song.custom ? chartBuf : DDR.parseSS4(chartBuf);      // custom charts come already in the game's shape
      const charts = DEMO.on ? [{ diff: S.diff, o: S, prof: null, name: 'DEMO' }]
        : [{ diff: S.diff, o: S, prof: DATA.profiles[DATA.current] || null, name: DATA.current || 'PLAYER' }];
      if (P2 && !DEMO.on && GROUP !== 'team') charts.push({ diff: GROUP ? S.diff : P2.diff, o: p2Opts(), prof: p2Profile(), name: P2.name || 'GUEST' });
      // players 3 and 4 (single style only)
      if (P2 && !DEMO.on && GROUP !== 'team' && styleNow() !== 'double') PX.forEach(x => { if (x) charts.push({ diff: GROUP ? S.diff : x.diff, o: pOpts(x), prof: x.name ? DATA.profiles[x.name] || null : null, name: x.name || 'GUEST' }); });
      if (S.mode === 'online' && window.NET && NET.open && !DEMO.on && charts.length === 1)
        charts.push({ diff: NET.peerDiff || S.diff, o: Object.assign({}, S, NET.peerOpts || {}, { gauge: (NET.peerOpts && NET.peerOpts.gauge) || S.gauge, marvelous: true }), prof: null, name: NET.peerName || 'FRIEND', remote: true });
      const gh = ghostFor(song);
      if (gh && charts.length === 1) charts.push({ diff: gh.diff, o: Object.assign({}, S, gh.opts || {}, { marvelous: true, gauge: 'no fail' }), prof: null, name: 'GHOST', ghost: gh });
      if (BATTLE && !DEMO.on && charts.length === 1)
        charts.push({ diff: S.diff, o: Object.assign({}, S, { gauge: 'no fail' }), prof: null, name: 'COM', com: BATTLE.level });
      if (GROUP === 'family') charts.forEach((c, i) => { c.key = familyKey(c.diff, familySide(i, charts.length)); });
      // HP4: each player's own CLASSIC / CHOREOGRAPH (SELECT DANCE); CHOREOGRAPH has BASIC and DIFFICULT
      // only, so a CHOREOGRAPH player on another difficulty takes the nearer of those two
      else if (HP4 && (S.mode || 'free') === 'free' && styleNow() !== 'double' && !DEMO.on) charts.forEach((c, i) => {
        if (c.com !== undefined || c.ghost || c.remote) return;
        if (PCHOREO[i]) { if (!ss4.charts[(c.diff << 8) | 0x1a]) c.diff = [1, 2].find(d => ss4.charts[(d << 8) | 0x1a] && (c.diff === 4 ? d === 1 : d === 2)) || [1, 2].find(d => ss4.charts[(d << 8) | 0x1a]) || c.diff; c.key = (c.diff << 8) | 0x1a; }
        else c.key = (c.diff << 8) | 0x14;
      });
      for (const c of charts) {
        c.built = DDR.buildNotes(ss4, c.key || chartKey(c.diff));
        if (c.built) { const st = (c.key || chartKey(c.diff)) & 0xff; c.built.kind = st === 0x1a || st === 0x2a || st === 0x3a ? 'choreo' : st === 0x4a ? 'board' : 'single'; }
        if (c.built && BOARD_LESSON) c.built.kind = 'board';
        if (!c.built) throw new Error('This difficulty has no chart.');
      }
      const music = song.custom ? audioBuf : toBuffer(DDR.decodeRWAR(audioBuf));
      if (scene !== this) return;
      Play.marks = ss4 && ss4.marks || null;              // (HP4 training: the chart's markers)
      const play = Play.with(song, charts, music, this.dance);
      play.stage = this.stage;
      // like the game: before a BEGINNER song with freeze arrows, explain them (once per player per session)
      const who = song.lesson ? [] : charts.filter(c => c.diff === 4 && c.built.notes.some(n => n.endT !== undefined && n.lane < 4) && !Explain.seen.has(c.name || '?'));   // (not the hands' held markers, lanes 4 / 5)
      // a step lesson starts with its explanation page (the game's STEP LESSON n picture), every time
      if (play.netRemote) go(OnlineWait.with(play));     // ONLINE VERSUS: start together
      else if (song.lesson && song.lesson <= 6) go(Explain.with(play, 4 + song.lesson));
      // (HP4's lessons: table 0x80260918 - pages 5-10 STEP LESSON 1-6, 20-24 CHOREOGRAPH LESSON 1-5, 25-28 the Balance Board lessons)
      else if (HP4 && song.lesson >= 7 && song.lesson <= 15 && A.img.explain && A.img.explain[13 + song.lesson]) go(Explain.with(play, 13 + song.lesson));
      // HP4: before every song, the explanation window (scene 0x1d, 0x80041ac0 -> page list 0x800f4fb4):
      // Balance Board [18, 19, 17, 30]; otherwise FAMILY with 2 / 3 / 4 players first (35 / 36 / 37), then with
      // CHOREOGRAPH [15, 33, 31, 32, 34] (29 instead of 15 only in the first-time tutorial play, task state 1),
      // then 4 (Arrow) when every player is on BEGINNER without CHOREOGRAPH, or 11 (Freeze Arrow) when anyone
      // is above BEGINNER
      else if (HP4 && A.img.explain && !(S.mode === 'training' && !COURSE && !WK && !MC)) {
        const pg = hp4ExplainPages(charts);
        if (pg.length) go(Explain.with(play, pg[0], pg)); else go(play);
      }
      // DEMO PLAY (DDR II): the explanation page on its own for 1 s (see DEMO above)
      else if (DEMO.on && !HP4 && A.img.explain) go(Explain.with(play, charts.every(c => c.diff === 4) ? 4 : 11, null, true));
      // DDR II: the explanation window before every song (scene 0x1d -> 0x80105548): page 4 (Arrow) when the top
      // difficulty is BEGINNER, else 11 (Freeze Arrow), then (A) Let's dance! (Dolphin 2026-11-18: DANCE MODE, 1
      // player, BASIC -> Explanation of Freeze Arrow). (Courses, WORKOUT, team play and the like: not checked
      // on the Wii yet - they keep the older rule, the freeze page once before a BEGINNER song with freezes)
      // (WORKOUT shows it too - Dolphin 2026-11-18: WORKOUT, 1 player, BASIC -> Explanation of Freeze Arrow)
      else if (S.freezeGuide !== false && !DEMO.on && !play.netRemote && ((S.mode || 'free') === 'free' || (WK && S.mode === 'workout')) && !COURSE && !GC && !BATTLE && GROUP !== 'team' && A.img.explain)
        go(Explain.with(play, charts.every(c => c.diff === 4) ? 4 : 11));
      else if (S.freezeGuide !== false && S.freezes !== false && who.length && !DEMO.on) { who.forEach(c => Explain.seen.add(c.name || '?')); go(Explain.with(play)); }
      else if (S.mode === 'training' && !COURSE && !WK && !MC) {
        const tm = charts[0].built.timing, last = Math.max(...charts.map(c => Math.max(0, ...c.built.notes.map(n => n.endT || n.t))));
        // (HP4: the bars run to the song's end marker - main.dol 0x800e6864 uses chart +0x38c2e4 >> 12)
        TrainSet.args = { song, charts, music, dance: this.dance, stage: this.stage, marks: Play.marks };
        go(TrainSet.with(play, HP4 && play.marks && play.marks.end > 0 ? play.marks.end >> 12 : Math.ceil(tm.offAt(last) / 4096)));
      } else go(play);
    } catch (e) { console.error('load', e && e.stack); this.err = String(e.message || e); }
  },
  input(a, p) { if (p && DEMO.on) return endDemo(); if (p && a === 'BACK') go(this.song && this.song.lesson ? LessonSel : Select); },
  draw(t) {
    // the speaker ring closing in, then held until the song starts: the short close-in (track 0, 16
    // frames, sound 602) - the one CSelect plays when the song is decided (main.dol 0x800457c8 ->
    // 0x801004e0 -> 0x8010502c). The long one (track 2 + sound 609) only closes a song's end (0x800421a0).
    if (RING.parts && !this.err) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      drawRing(0, RING.freeze !== undefined ? RING.freeze : Math.min(ringLen(0) - 1, Math.floor((performance.now() - this.at) / 1000 * 30)));
      return;
    }
    menuBackground(t);
    const jk = texture('jacket', this.song.jacket);
    if (jk.img) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(W / 2 - 152, 138, 304, 304); g.drawImage(jk.img, W / 2 - 150, 140, 300, 300); }
    const ti = texture('title', this.song.title);
    if (ti.img) g.drawImage(ti.img, W / 2 - ti.img.width, 470, ti.img.width * 2, ti.img.height * 2);
    else if (this.song.custom || this.song.disc) text(this.song.name, W / 2, 500, 30, '#fff', 'center');
    text(this.err ? 'Could not load: ' + this.err : this.msg, W / 2, 600, 24, this.err ? '#f88' : '#cfe', 'center', 'normal');
  },
};

// ---- gameplay
// Timing and scoring rules read from DDR II's main.dol (normal arrows, normal play mode).
// Times in the game are ticks of 1/150 s (the charts' tick rate). Window table 0x8026f638, row 0:
//   early limits (Almost, Good, Great, Perfect, Marvelous) = -25, -25, -16, -6, -2
//   late  limits                                           =  30,  30,  15,  7,  2
// A step not hit by +30 ticks is a BOO. Judgment ids as the game uses them: 0 BOO .. 5 MARVELOUS.
const TPS = 150;
// DDR II's judgment / O.K. alpha by seconds since it came up: 255 for 46 frames, then 17 less a frame (fifo_ddr2_demo100.dff)
function d2Fade(s) { const f = Math.floor(s * 60); return f < 46 ? 1 : Math.max(0, 255 - 17 * (f - 45)) / 255; }
// judgment names by number: 0 BOO .. 5 MARVELOUS (the number is used everywhere)
const J_NAMES = ['BOO', 'ALMOST', 'GOOD', 'GREAT', 'PERFECT', 'MARVELOUS'];
// the combo count's colours by full-combo tier (0 = broken)
const COMBO_TINTS = { 0: '#58e048', 2: '#6a5cff', 3: '#58e048', 4: '#ffcc30', 5: null };
// a picture coloured in (multiplied, so its outline and shading stay), cached per colour
const TINT_CACHE = new WeakMap();      // (keyed by picture: a dropped picture drops its tints)
// (see above) the picture im coloured col
function tintImg(im, col) {
  if (!im) return im;
  let m = TINT_CACHE.get(im);
  if (!m) TINT_CACHE.set(im, m = {});
  if (!m[col]) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
    m[col] = c;
  }
  return m[col];
}
// judgment colours (for the PC's own text, e.g. EARLY / LATE and the results bars)
const J_COLORS = ['#ff4060', '#c77dff', '#4dc3ff', '#4dff7a', '#ffe14d', '#ffffff'];
// DDR II's timing windows in ticks (TPS = 150 a second), early and late, widest first; used by judgeOf() below
const WIN_EARLY = [-25, -25, -16, -6, -2], WIN_LATE = [30, 30, 15, 7, 2];
// how far before and after a step a press is looked at at all, in seconds
const SEARCH_EARLY = WIN_EARLY[0] / TPS, SEARCH_LATE = WIN_LATE[0] / TPS;
// Hottest Party's rules (its main.dol): windows in frames of 1/60 s from the tables at 0x801ab4a0 (early)
// and 0x801ab4c0 (late), MARVELOUS .. BOO; past +28 frames the step is missed
const HP_WIN_EARLY = [-23, -20, -14, -5, -2, -1], HP_WIN_LATE = [28, 19, 13, 6, 2, 1];   // BOO .. MARVELOUS
// Hottest Party rules: the judgment for a press dtSec seconds off the step
function judgeOfHP(dtSec) {
  const d = dtSec * 60;
  for (let j = 5; j >= 0; j--) if (d >= HP_WIN_EARLY[j] && d < HP_WIN_LATE[j]) return j;
  return 0;
}
// Hottest Party's score (0x801599b0): the chart is worth M = table[difficulty*5 + level-1] x 1000
// (0x801f3cac). With T = steps + freezes, each step or freeze judged is the k-th event and is worth
// k x floor(M / (T(T+1)/2)) (the last one takes what's left, so the chart adds up to M exactly), times
// 10 for MARVELOUS / PERFECT / GREAT / freeze O.K. and 5 for GOOD. Capped at 999,999,999
// HP4 (0x80035654, table 0x80254ce8 - the same numbers): x10 for MARVELOUS / PERFECT / freeze O.K., x5 for
// GREAT and GOOD (a step's judgment >= 4 -> 10, else 5; the score is only added for GOOD or better:
// 0x8002b448 sets the note's flag 0x10 for judgments >= 2)
function hpWeight(p, j) { return p && p.hp4 ? (j >= 4 ? 10 : j >= 2 ? 5 : 0) : (j >= 3 ? 10 : j === 2 ? 5 : 0); }
// Hottest Party's score size (x 1000) by difficulty and level
const HP_SCORE_M = [1000, 1200, 1400, 1600, 1800, 2000, 2400, 2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600,
  6000, 6400, 6800, 7200, 7600, 8000, 8500, 9000, 9500, 10000];
function judgeOf(dtSec) {           // dt = press time - step time (seconds); same checks as 0x8002d484
  const d = dtSec * TPS;
  let j = 5;
  for (let k = 4; k >= 0; k--) {
    if (d >= WIN_EARLY[k] && d <= WIN_LATE[k]) return j;
    j--;
  }
  return 0;
}
// HP4's hand markers are judged with their own windows (0x8002afd8, kinds from 0x8003406c): punch (16) and
// thrust (18) are flag-2 notes -> table 1 of 0x80254c20: from 3 early to 22 late (MARVELOUS within 3, PERFECT 9,
// else GREAT); pose (17), swing (19) and hip roll (21) the same table but flag 0x20 - only a MARVELOUS takes the
// press (0x80036d88); hip bumps (11, flag 0x10) table 0x80254cc0: 3 early to 30 late, all MARVELOUS, also 0x20;
// the lessons' foot markers (0) and the Balance Board hip roll (13, flag 8) the arrows' table (13 with 0x20).
function hp4Judge(row, dt, board) {
  const n = row.notes[0], k = n && n.gk;
  if (k === undefined || k === 8 || k === 9) return judgeOf(dt);
  const only5 = k >= 3 && k <= 7;
  let j;
  if (k === 5 && board) j = judgeOf(dt);
  else {
    const d = dt * TPS, late = k === 6 || k === 7 ? [30, 30, 30, 30, 30] : [22, 22, 22, 9, 3];
    j = 0;
    for (let i = 4; i >= 0; i--) if (d >= -3 && d <= late[i]) { j = i + 1; break; }
  }
  return only5 && j !== 5 ? 0 : j;
}
// Score (0x80037dd4, mode 0): 100000 * sum(weight * count) / (2 * (steps + freezes)), floored, minus the
// number of GREATs and PERFECTs, then x10. (Mode 1, game mode 8: weights 3/2/1 out of 1,000,000, nothing taken off.)
const SCORE_W = [0, 0, 0, 1, 2, 2];       // BOO ALMOST GOOD GREAT PERFECT MARVELOUS
const SCORE_W1 = [0, 0, 0, 1, 2, 3];      // the same in scoring mode 1 (demo play)
// an O.K. freeze counts 2; the score is the weighted sum over 2 x (steps + freezes)
const SCORE_FREEZE_OK = 2, SCORE_DEN = 2;
// Dance level for the grade (0x80037f4c): same shape with these weights, as a percent.
const GRADE_W = [-2, -1, 0, 1, 2, 2], GRADE_OK = 2, GRADE_NG = -2;
// Grade cut-offs per difficulty (0x8026f7d0): AAA, AA, A, B, C (else D)
const GRADE_CUTS = { 0: [100, 87, 77, 67, 47], 1: [100, 85, 75, 65, 45], 2: [100, 87, 77, 67, 53], 3: [100, 90, 80, 70, 56], 4: [100, 90, 80, 70, 56] };
// grade names, best first
const GRADE_NAMES = ['AAA', 'AA', 'A', 'B', 'C', 'D'];
// Life gauge (0x8003806c / 0x800381fc): starts at 500, max 1000, fail below 1.
// Change per judgment by difficulty (0x8026f8d0): [PERFECT/MARVELOUS, GREAT, GOOD/ALMOST, BOO]
const LIFE_DELTA = { 0: [18, 13, 0, -40], 1: [18, 13, 0, -40], 2: [14, 9, 0, -40], 3: [11, 7, 0, -40], 4: [11, 7, 0, -40] };
// Loss multiplier by how many BOO/ALMOST in a row (0x8026f8a0), index = streak - 1, capped at 10
const LOSS_STREAK = [2.0, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.4, 1.2, 1.3, 1.5];
// GAME LEVEL (0x8026f860, index 0 hardest .. 7 easiest; the game starts on index 3): [gain, loss]
const GAME_LEVELS = { hardest: [0.55, 2.0], 'very hard': [0.7, 1.7], hard: [0.8, 1.3], medium: [1, 1],
  'a little easy': [1.2, 0.8], easy: [1.4, 0.7], 'very easy': [1.7, 0.55], easiest: [2.0, 0.35] };
const DIFF_SLOT = { 4: 0, 1: 1, 2: 2, 3: 3, 6: 4 };   // chart difficulty -> the game's difficulty index
const FREEZE_GRACE = 0.25;      // 15 frames: a released panel still counts as held while its 16-frame counter runs down (0x80032eb8); N.G. on the frame it runs out

// One dancer: their chart, options, judgments, score and life. Play runs one, or two in VERSUS.
const DIRS = ['L', 'D', 'U', 'R'];
// one player during a song (see above)
class Dancer {
  constructor(idx, song, built, diff, o, prof, name, lanes) {
    this.idx = idx; this.song = song; this.diff = diff; this.o = o; this.prof = prof; this.name = name;
    this.lanes = lanes; this.style = lanes === 8 ? 'double' : 'single';
    const map = turnMap(lanes, o.turn);
    // (HP4 CHOREOGRAPH: lanes 4 / 5 are the hand markers - they keep their lane: TURN moves the arrows only)
    const hand = n => n.lane >= 4 && n.gk !== undefined;
    let notes = built.notes.map(n => ({ off: n.off, t: n.t, lane: hand(n) || (lanes === 4 && n.lane >= 4) ? n.lane : map[n.lane], endOff: o.freezes || hand(n) ? n.endOff : undefined,
                                        endT: o.freezes || hand(n) ? n.endT : undefined, done: false, q: quant(n.off), foot: n.foot, gk: n.gk, gp: n.gp }));
    if (o.cut) notes = notes.filter(n => n.q === 4 || n.gk !== undefined);
    if (o.punch === false) notes = notes.filter(n => n.gk === undefined);     // (HP4 GIMMICK: PUNCH MARKER OFF)         // CUT: quarter-note steps only
    if (o.jump === false) {                                             // JUMP OFF: one arrow per moment
      const seen = new Set();
      notes = notes.filter(n => { if (n.gk !== undefined) return true; if (seen.has(n.off)) return false; seen.add(n.off); return true; });
    }
    this.notes = notes;
    this.timing = built.timing;
    this.kind = built.kind;                 // (HP4: 'single', 'choreo' or 'board' - its records are kept apart)
    // rows: notes at the same moment are judged together (a hand marker is a row of its own: it's played
    // with the Wii Remote / Nunchuk, not on the mat)
    this.rows = [];
    const byKey = new Map();
    for (const n of this.notes) {
      const hd = n.gk !== undefined, key = hd ? n.off + ':h' + n.lane : n.off + ':a';
      let cur = byKey.get(key);
      if (!cur) { cur = { off: n.off, t: n.t, notes: [], hit: 0, judged: false, hand: hd }; byKey.set(key, cur); this.rows.push(cur); }
      cur.notes.push(n); n.row = cur;
    }
    this.rows.sort((a, b) => a.t - b.t || a.off - b.off);
    this.hands = this.notes.filter(n => n.gk !== undefined);
    this.freezeTotal = this.notes.filter(n => n.endT !== undefined).length;
    this.counts = { MARVELOUS: 0, PERFECT: 0, GREAT: 0, GOOD: 0, ALMOST: 0, BOO: 0, OK: 0, NG: 0 };
    this.jc = [0, 0, 0, 0, 0, 0];
    this.slot = DIFF_SLOT[diff] ?? 1;
    this.score = 0; this.combo = 0; this.comboBroke = false; this.fcTier = 5; this.runTier = 5; this.maxCombo = 0; this.life = 500; this.missRun = 0; this.failed = false;
    this.den = SCORE_DEN * Math.max(1, this.rows.length + this.freezeTotal);
    // which game's timing and scoring this dancer plays by
    // (HP4: DDR II's judging windows - 0x80254c20 is the same table - with Hottest Party's level-based
    // score; see hpWeight / hpEvent)
    this.hp4 = HP4;
    this.hpRules = HP4 || look('score') === 'hp';
    this.searchEarly = this.hpRules && !HP4 ? HP_WIN_EARLY[0] / 60 : SEARCH_EARLY;
    this.searchLate = this.hpRules && !HP4 ? HP_WIN_LATE[0] / 60 : SEARCH_LATE;
    if (this.hpRules) {
      // (HP4: the level of the chart this player dances - CLASSIC's single block or CHOREOGRAPH's / the board's)
      const lvs = HP4 && built.kind ? (song[built.kind] || levelsOf(song)) : levelsOf(song);
      const lv = Math.max(1, Math.min(10, (lvs[DIFFS.findIndex(d => d[0] === diff)] || 1)));   // (clamped 1-10: 0x80027ef0)
      const di = Math.min(4, this.slot === 4 ? 3 : this.slot);
      this.hpM = HP_SCORE_M[Math.min(24, di * 5 + Math.min(5, lv) - 1 + Math.max(0, lv - 5))] * 1000;
      this.hpT = Math.max(1, this.rows.length + this.freezeTotal);
      this.hpUnit = Math.floor(this.hpM / (this.hpT * (this.hpT + 1) / 2));
      this.hpK = 0;
    }
    this.judgeText = null; this.okText = null; this.flash = new Array(lanes).fill(-9); this.holding = [];
    this.bursts = [];
    this.lastNoteT = Math.max(0, ...this.notes.map(n => n.endT || n.t));
  }
  now() { return Play.now(); }
  press(lane, t) {
    this.flash[lane] = this.now();
    // nearest unjudged note in this lane within the window
    let best = null;
    for (const n of this.notes) {
      if (n.done || n.lane !== lane) continue;
      const dt = t - n.t;
      if (dt < this.searchEarly) break;
      if (dt <= this.searchLate && (!best || Math.abs(dt) < Math.abs(t - best.t))) best = n;
    }
    if (!best) return;
    best.done = true; best.hitT = t;
    const row = best.row;
    row.hit++;
    if (best.endT !== undefined) { best.holding = true; this.holding.push(best); }
    // a jump is judged when its last panel goes down, by that press's timing
    if (row.hit === row.notes.length) {
      const j = this.hpRules && !this.hp4 ? judgeOfHP(t - row.t) : this.hp4 ? hp4Judge(row, t - row.t, Play.hpBoard) : judgeOf(t - row.t);
      // (HP4's 0x20 hand markers: a press outside the MARVELOUS window doesn't take them)
      if (this.hp4 && j === 0 && best.gk !== undefined) { best.done = false; best.holding = false; row.hit--; this.holding = this.holding.filter(n => n !== best); return; }
      row.dt = t - row.t; this.judgeRow(row, j);
    }
  }
  judgeRow(row, j) {
    row.judged = true;
    if (this.group && !this.groupApply) { this.group.report(this, row, j); return; }   // FRIENDSHIP / SYNC
    // Marvelous option off: the game still counts a MARVELOUS as one (0x8003ac08 counter 5, so the score's
    // one-off for each GREAT / PERFECT doesn't touch it) and only shows it as PERFECT (+0x583a8 = 4, the results
    // add counters 4 + 5, 0x8003b9dc). jd = what is shown
    const jd = j === 5 && !this.o.marvelous ? 4 : j;
    // DDR II and HP4 (same code, 0x800372bc / 0x80038804): a freeze whose step is missed is dead - no hold, no N.G. and no gauge change (0x80039cfc gives a
    // judgment-0 freeze result 0: its own counter, weight 0 in score and grade, no life in 0x8003b23c, and the
    // results show only released freezes as N.G., 0x800e4618). A jump's freeze panel pressed alone stops too.
    if (j === 0 && (!this.hpRules || this.hp4)) for (const n of row.notes) if (n.endT !== undefined) { n.holding = false; n.missed = true; n.freezeMiss = true; if (this.hp4) this.hpEvent(0); }
    if (this.idx === 0 && !this.remote && Play.netRemote && window.NET) NET.send({ t: 'j', r: this.rows.indexOf(row), j });
    if (this.rec) this.rec.push([this.rows.indexOf(row), j]);       // (for the GHOST: your best play, step by step)
    if (this.teamStats && row.owner !== undefined) {      // TEAM: who got what
      const st = this.teamStats[row.owner]; st[jd] = (st[jd] || 0) + 1;
      st.run = j >= 2 ? st.run + 1 : 0; st.best = Math.max(st.best, st.run);
    }
    row.jd = jd;                          // (kept for DDR II's TIMING CHECK)
    this.jc[j]++; this.counts[J_NAMES[jd]]++;
    // combo continues on GOOD or better; BOO/ALMOST break it and count toward the loss streak
    // the full-combo tier so far (5 MARVELOUS, 4 PERFECT, 3 GREAT, 2 GOOD); a break ends any full combo
    if (j < 2) this.comboBroke = true; else this.fcTier = Math.min(this.fcTier ?? 5, jd);
    // the combo's colour: the worst judgment so far in the song (MARVELOUS white-blue, PERFECT yellow, GREAT green,
    // GOOD blue - the results screen's colours); a break doesn't reset it, the next combo keeps it (user, from the Wii)
    if (j >= 2) this.runTier = Math.min(this.runTier ?? 5, jd);
    if (j >= 2) { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.missRun = 0; }
    else { if (this.mccRun && !this.mccEnd) { this.mccEnd = true; this.mccFinal = this.mccBase + this.combo; this.mccBreakAt = this.now(); }
      this.combo = 0; this.comboBroke = true; this.missRun++; if (this.mcRun && !this.failed) { this.failed = true; this.failAt = this.now(); } }   // MAX COMBO CHALLENGE: a break ends the run
    // HP4: once the combo is 50 or more, every step judged GOOD or better bursts on its lanes (0x80089870 ->
    // 0x8008c2f4: effect bank 2, the combo shown at +0x57ba4; Play.hp4HitFx draws them)
    if (this.hp4 && j >= 2 && this.combo >= 50) (this.hitFxQ || (this.hitFxQ = [])).push({ lanes: row.notes.map(n => n.lane), j, combo: this.combo });
    if (this.hpRules) this.hpEvent(hpWeight(this, j), j); else this.updateScore();
    if (j >= 3 || j === 0) this.lifeChange(j >= 4 ? 0 : j === 3 ? 1 : 3);
    this.judgeText = { owner: row.owner, name: J_NAMES[jd], color: J_COLORS[jd], at: this.now(), el: j > 0 && jd < 5 && row.dt ? (row.dt < 0 ? 'EARLY' : 'LATE') : null };
    // DDR II's lessons say it their own way (comAF /11 pictures 23-27: Awesome!! / Pretty Cool!! / Too Fast!! /
    // Too Slow!! / Try Harder!!, counted on the lesson's results). Traced: a miss is Try Harder!! (Wii); which
    // judgments make the other four is ASSUMED (MARVELOUS / PERFECT, GREAT, then GOOD / ALMOST early or late)
    if (this.lessonD2) {
      const lk = jd >= 4 ? 0 : jd === 3 ? 1 : jd === 0 ? 4 : row.dt < 0 ? 2 : 3;
      this.judgeText.lesson = 23 + lk; this.lessonCounts[lk]++;
    }
    // TIMING EVALUATION: the step flashes blue when early, pink when late
    const tc = S.timingColor && row.dt !== undefined && jd < 5 ? (row.dt < 0 ? '#3c8cff' : '#ff5cc0') : null;
    if (j >= 2 && S.clap && A.ready) A.playSfx('SE_DDR_CLAP');           // HAND CLAP: a clap on every step hit (0x80026b10)
    if (j >= 2) for (const n of row.notes) this.bursts.push({ lane: n.lane, at: this.now(), color: tc || J_COLORS[jd], im: n.gk !== undefined ? this.handPic(n) : null });
    if (this.combo > 0 && this.combo % 100 === 0) {
      const c = Math.min(this.combo, 1000);
      sfx(this.combo > 1000 ? 'VO_NAR_COMBOOVER' : `VO_NAR_${c}COMBO`);
    }
  }
  fullCombo() {   // 0 none, 2 good, 3 great, 4 perfect, 5 marvelous (combo kept through every step, no N.G.)
    if (this.jc[0] || this.jc[1] || this.counts.NG || this.failed) return 0;
    return this.jc[2] ? 2 : this.jc[3] ? 3 : this.jc[4] || !this.o.marvelous ? 4 : 5;
  }
  // Hottest Party: the next step or freeze is judged; w = 10, 5 or 0
  hpEvent(w, j) {
    // (HP4 / HP3, 0x80035654: k = every step judged so far, misses too (0x800381c8 +0x57988, the miss path of
    // 0x80036d88 judges them 0) + every freeze finished, O.K., N.G. or a dead one (0x80038804 +0x579bc);
    // only GOOD and up and O.K. add points)
    this.hpK = Math.min(this.hpT, this.hpK + 1);
    const k = this.hpK, T = this.hpT;
    const v = k === T ? this.hpM - (T * (T - 1) / 2) * this.hpUnit : k * this.hpUnit;
    if (w) this.score = Math.min(999999999, this.score + w * v);
  }
  updateScore() {
    if (this.hpRules) return;
    if (DEMO.on) {                // game mode 8 (0x8026f718 row 1): MARVELOUS 3, PERFECT 2, GREAT 1, freeze 3, of 1,000,000
      let n1 = 3 * this.counts.OK;
      for (let k = 0; k < 6; k++) n1 += SCORE_W1[k] * this.jc[k];
      this.score = Math.floor(1000000 * n1 / (3 * Math.max(1, this.rows.length + this.freezeTotal)));
      return;
    }
    let num = SCORE_FREEZE_OK * this.counts.OK;
    for (let k = 0; k < 6; k++) num += SCORE_W[k] * this.jc[k];
    // then (0x80037ec0, mode 0) one unit off for every GREAT and every PERFECT (counters 3 and 4),
    // not below 0, then x10: only MARVELOUS keeps a step's full value
    this.score = Math.max(0, Math.floor(100000 * num / this.den) - this.jc[3] - this.jc[4]) * 10;
  }
  lifeChange(col) {
    let d = LIFE_DELTA[this.slot][col];
    // GAME LEVEL: the game's 8 levels (0x8026f860, picked by the setting at +5500, default 3 = x1.0): each is
    // [gain multiplier, loss multiplier] applied to every gauge change (0x80038194)
    const lv = GAME_LEVELS[S.gameLevel] || [1, 1];
    d *= d > 0 ? lv[0] : lv[1];
    if (d < 0) {
      if (this.life >= 1000) d *= 2.0; else if (this.life >= 700) d *= 1.2; else if (this.life >= 300) d *= 0.9;
      if (this.combo >= 200) d *= 2.0; else if (this.combo >= 100) d *= 1.8; else if (this.combo >= 50) d *= 1.2;
      d *= LOSS_STREAK[Math.max(0, Math.min(10, this.missRun - 1))];
    }
    d = Math.trunc(d);
    if (this.life > 0) this.life += d;
    if (this.life < 1) {
      this.life = 0;
      if (this.o.gauge === 'normal' && !this.failed) { this.failed = true; this.failAt = this.now(); }
      // END OF SONG: still failed, but the song plays on to the end (the gauge stays empty)
      if (this.o.gauge === 'end' && !this.failed) { this.failed = true; this.failAt = Infinity; }
    }
    if (this.life > 1000) this.life = 1000;
    if (this.o.gauge !== 'normal' && this.o.gauge !== 'end' && this.life < 1) this.life = 1;
    // the crowd (0x800381fc): after every gauge change, a good sign when the gauge is over 700 or the
    // combo over 12, a bad one when the gauge is under 200 (Play.crowd reacts to them)
    this.crowdEv |= this.life > 700 || this.combo > 12 ? 1 : this.life < 200 ? 2 : 0;
  }
  freezeNG(n, t, silent) {
    if (this.rec) this.rec.push(['n', this.notes.indexOf(n), Math.round(t * 1000) / 1000]);
    if (this.idx === 0 && !this.remote && Play.netRemote && window.NET) NET.send({ t: 'ng', n: this.notes.indexOf(n) });
    n.holding = false; n.freezeNG = true; this.counts.NG++; if (this.hpRules) this.hpEvent(0);
    this.lifeChange(3);
    // the real DDR II keeps the combo through a freeze N.G. (tested on the Wii game); Options can make it break
    if (this.o.ngBreaksCombo) { this.combo = 0; this.comboBroke = true; if (this.mcRun && !this.failed) { this.failed = true; this.failAt = this.now(); } }
    if (!silent) this.okText = { name: 'NG', lane: n.lane, at: t };
  }
  grade() {
    if (this.failed) return 'E';
    let num = GRADE_OK * this.counts.OK + GRADE_NG * this.counts.NG;
    for (let k = 0; k < 6; k++) num += GRADE_W[k] * this.jc[k];
    const pct = Math.trunc(100 * num / this.den);
    const cuts = GRADE_CUTS[this.slot];
    for (let i = 0; i < 5; i++) if (pct >= cuts[i]) return GRADE_NAMES[i];
    return 'D';
  }
  // misses and freeze arrows; held(lane) says whether that panel is down
  // ---- the Wii's input model (DDR II 0x80032eb8 / 0x800397c8, HP4 0x80030a0c / 0x80036d88): the game reads the
  // pads and judges once a frame, 60 times a second, at that frame's song time. A panel that goes down is
  // 'fresh' for 4 frames (its counter set to 4, the bit set while it runs down); a step is judged on the first
  // frame it's in the window with every one of its panels fresh (so a jump's feet must land within those 4
  // frames), and when several steps could be, the best judgment wins, the earliest on a tie (with any others
  // at that same time). Then the steps past the window are misses. Here the frames are ticks of 1/60 s of
  // song time on the music clock, whatever the screen's refresh; each press goes into the tick it falls in.
  wii() { return S.judgeModel !== 'exact' && (!this.hpRules || this.hp4) && !this.remote && this.com === undefined && !this.ghostEv; }
  inputPress(lane, t) {
    if (!this.wii()) return this.press(lane, t);
    this.flash[lane] = this.now();
    (this.pq || (this.pq = [])).push([lane, t]);
  }
  wiiTicks(t) {
    const k1 = Math.floor(t * 60);
    if (this.wk === undefined || k1 - this.wk > 600) this.wk = k1 - 1;
    for (let k = this.wk + 1; k <= k1; k++) this.wiiTick(k / 60);
    if (k1 > this.wk) this.wk = k1;
  }
  wiiTick(T) {
    const fr = this.fresh || (this.fresh = {});
    if (this.pq && this.pq.length) this.pq = this.pq.filter(([l, pt]) => { if (pt <= T) { fr[l] = 4; return false; } return true; });
    // (Balance Board MODE: a lane whose next step the board shows right now is pressed this frame - the
    // game sets the press bit every frame the board's code holds)
    if (boardLive()) for (const row of this.rows) {
      const dt = T - row.t;
      if (dt < this.searchEarly) break;
      if (row.judged || dt > this.searchLate) continue;
      for (const n of row.notes) if (!n.done && !(fr[n.lane] > 0)) { const c = boardCode(n, false); if (c >= 0 && Board.code(c)) fr[n.lane] = 1; }
    }
    const on = {};
    for (const l in fr) if (fr[l] > 0) { on[l] = true; fr[l]--; }
    let best = 0, pick = [];
    for (const row of this.rows) {
      const dt = T - row.t;
      if (dt < this.searchEarly) break;
      if (row.judged || dt > this.searchLate) continue;
      if (!row.notes.every(n => !n.done && on[n.lane])) continue;
      const j = this.hp4 ? hp4Judge(row, dt, Play.hpBoard) : judgeOf(dt);
      if (j <= 0) continue;
      if (j > best) { best = j; pick = [row]; }
      else if (j === best) { if (row.t < pick[0].t) pick = [row]; else if (row.t === pick[0].t) pick.push(row); }
    }
    for (const row of pick) {
      for (const n of row.notes) {
        n.done = true; n.hitT = T;
        if (n.endT !== undefined) { n.holding = true; n.lastHeld = T; this.holding.push(n); }
      }
      row.hit = row.notes.length; row.dt = T - row.t;
      this.judgeRow(row, best);
    }
    // the steps the frame has left behind (judged 0, 0x8003ac08)
    for (const row of this.rows) {
      if (row.t >= T - this.searchLate) break;
      if (!row.judged) {
        for (const n of row.notes) if (!n.done) { n.done = true; n.missed = true; }
        this.judgeRow(row, 0);
      }
    }
  }
  update(t, held) {
    if (this.wii()) this.wiiTicks(t);
    for (const row of this.remote || this.wii() ? [] : this.rows) {
      if (row.t > t - this.searchLate) break;
      if (!row.judged) {
        for (const n of row.notes) if (!n.done) { n.done = true; n.missed = true; if (n.endT !== undefined && this.hpRules && !this.hp4) this.freezeNG(n, t, true); }
        this.judgeRow(row, 0);
      }
    }
    for (const n of this.holding) {
      if (!n.holding) continue;
      if (held(n.lane)) n.lastHeld = t;
      else if (((this.hpRules && !this.hp4) || !n.row || n.row.judged) && t - (n.lastHeld || n.hitT) > FREEZE_GRACE && t < n.endT) this.freezeNG(n, t, false);   // (DDR II checks a freeze only once its step is judged, 0x80039cfc)
      if (n.holding && t >= n.endT) {
        n.holding = false; n.freezeOK = true; this.counts.OK++; if (this.hpRules) this.hpEvent(10); else this.updateScore(); this.lifeChange(0);
        this.okText = { name: 'OK', lane: n.lane, at: t };
        this.bursts.push({ lane: n.lane, at: t, color: '#ffe84a' });     // the head flashes as it goes, like the game
      }
    }
    this.holding = this.holding.filter(n => n.holding);
  }
  // lanes, arrows, flashes, judgment and combo. x0 = left edge of the lanes
  draw(t, x0, lw, ry, held, ended) {
    const lanes = this.lanes, size = lw - 6, o = this.o;
    // SCROLL REVERSE: the step zone at the bottom and the arrows coming down. Everything is worked out
    // as if it scrolled up, then put on screen by Y() (a mirror about the step zone)
    const rev = o.scroll === 'reverse', yr = rev ? H - 150 : ry;
    const Y = y => rev ? yr - (y - ry) : y;
    const flipOn = () => { if (rev) { g.save(); g.translate(0, yr + ry); g.scale(1, -1); } };
    const flipOff = () => { if (rev) g.restore(); };
    // Hottest Party's arrows / judgments (each can be picked on its own in DDR CUSTOM)
    const HP = Play.hpArrows || Play.hpJudge ? hpHud() : null, hpOk = HP && HP.ok ? HP : null;
    const hp = Play.hpArrows ? hpOk : null;
    const hj = Play.hpJudge ? (Play.hp2Screen && HP2_HUD && HP2_HUD.ok ? HP2_HUD : hpOk) : null;
    if (!Play.hpBoard && !Play.introOn) {
      // the lane area: translucent blue with white lane lines, like the game. HP4 with 3 / 4 players (not a
      // FRIENDSHIP / SYNC group): each player's column in the player's colour (blue, red, green, yellow) and wide
      // enough to meet its neighbours - measured from a photo of the Wii's 4-player NORMAL screen (the code that
      // draws it isn't traced yet)
      const PS = Play.ps || [], hp4cols = HP4 && PS.length > 2 && !(GROUP && GROUP !== 'family' && partyLayout());
      if (hp4cols && A.img.multiBoard && A.img.multiBoard[0]) {
        // (the game's own board and lane lines are drawn for every player first - drawMultiBoard)
      } else if (hp4cols) {
        const L = Play.layout(), k = PS.indexOf(this), mid = q => q.x0 + 2 * q.lw;
        const span = L.length > 1 ? (mid(L[L.length - 1]) - mid(L[0])) / (L.length - 1) : lanes * lw + 8;
        const COL = ['rgba(0,120,190,0.72)', 'rgba(220,35,5,0.72)', 'rgba(5,190,50,0.72)', 'rgba(175,160,0,0.72)'];
        g.fillStyle = COL[k >= 0 ? k % 4 : 0]; g.fillRect(x0 + lanes * lw / 2 - span / 2, 0, span, H);
      } else if (!HP4 && A.img.board && A.img.board[0] && (lanes === 4 || lanes === 8)) {
        // DDR II: the game's own board (GAME_CMN_US.bin /7/1 and /7/4) - drawDdr2Board
        const go = t - Play.bannerShift() + 1.4;
        if (go >= 0 && !Play.noBoard) drawDdr2Board(x0 + lanes * lw / 2, lw / 64, lanes, Math.max(0, (Play.ps || []).indexOf(this)), go);
      } else { g.fillStyle = 'rgba(16,52,170,0.55)'; g.fillRect(x0 - 4, 0, lanes * lw + 8, H); }
      if (!(hp4cols && A.img.multiBoard && A.img.multiBoard[0]) && !(!HP4 && A.img.board && A.img.board[0] && (lanes === 4 || lanes === 8))) {
        g.fillStyle = 'rgba(255,255,255,0.75)';
        g.fillRect(x0 - 6, 0, 3, H); g.fillRect(x0 + lanes * lw + 3, 0, 3, H);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let l = 1; l < lanes; l++) g.fillRect(x0 + l * lw - 1, 0, 2, H);
      }
    }
    const offNow = this.timing.offAt(t);
    const beat = (((offNow % 1024) + 1024) % 1024) / 1024;
    const aframe = Math.min(6, Math.floor(beat * 7));
    const beatPx = lw * o.speed;
    const yOf = off => ry + (off - offNow) / 1024 * beatPx;
    const dirOf = l => l % 4;
    // (CHOREOGRAPH: the hand markers go down the outside columns - the lane set for hands, 0x80255698 type 2:
    // panel 4 over column 0, panel 5 over column 3)
    const colOf = l => l >= 4 && lanes === 4 ? (l === 4 ? 0 : 3) : l;
    // GUIDELINE: a line across the lanes at every measure
    // (DDR II: SSQ_CMN /0/0 picture 13, 334 x 36 drawn 334 x 32, centred 35 units right of the lanes' middle
    // (it is the bar of the TRAINING MENU's marker without its pill), at every measure on screen, above the
    // step zone too - fifo_ddr2_play2.dff (DANCE MODE) and fifo_ddr2_lessonplay.dff (STEP LESSON 6))
    if (o.guideline === true || (o.guideline === 'beginner' && this.diff === 4)) {
      const bl = !HP4 && !hp && A.barLine, k2 = lw / 64;
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let m = Math.floor(offNow / 4096) * 4096 - 4096 * 4; ; m += 4096) {
        const y = yOf(m);
        if (y > H + 40) break;
        if (bl) { if (Y(y) > -40) g.drawImage(bl, x0 + lanes * lw / 2 + (35 - 167) * k2, Y(y) - 16 * k2, 334 * k2, 32 * k2); }
        else if (y > ry) g.fillRect(x0 - 4, Y(y) - 1, lanes * lw + 8, 2);
      }
    }
    // step zone
    for (let l = 0; l < lanes; l++) {
      const x = x0 + l * lw + lw / 2, d = dirOf(l);
      const down = t - this.flash[l] < 0.08 || held(l);
      const grey = (A.zoneC8 && A.zoneC8(d, false)) || (A.receptor ? A.receptor(d) : A.arrowGrey && A.arrowGrey[0][d]);
      if (hp) {
        const sc = down ? 0.9 : 1, z = size * 1.08 * sc;
        // the dark grey set, turning to the light grey one when pressed and fading back through each beat
        g.drawImage(hp.zone[d], x - z / 2, yr - z / 2, z, z);
        g.globalAlpha = down ? 1 : Math.max(0, 1 - beat * 2.5);
        g.drawImage(hp.zoneOn[d], x - z / 2, yr - z / 2, z, z);
        g.globalAlpha = 1;
      } else if (grey) {
        const sc = down ? 0.9 : 1;
        g.globalAlpha = 1; g.drawImage(grey, x - size * sc / 2, yr - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = down ? 0.55 : 0.35 * (1 - beat);
        g.drawImage(A.arrowMask[d], x - size * sc / 2, yr - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      } else drawArrow(down ? 'flash' : 'receptor', x, yr, d, size);
    }
    // judgment: about a second on screen, then a quick fade; the combo count stays up for as long as the
    // combo lasts. EVALUATION (the game's option) is draw order: NORMAL draws both over the arrows (seen in
    // the real game: the combo covers arrows passing through it); COMBO puts the combo under the arrows,
    // JUDGMENT ONLY the judgment, ALL both. They stay in the same place either way.
    const jAge = this.judgeText ? t - this.judgeText.at : 9;
    const evalOn = !ended && o.evaluation !== false && !(this.drawOwner !== undefined && this.judgeText && this.judgeText.owner !== this.drawOwner), jp = o.judgePos || 'normal';
    const cx = x0 + lanes * lw / 2, cy = rev ? Y(Play.hpBoard ? 362 : 352) - 70 : Play.hpBoard ? 362 : 352;
    const drawJudge = (cy) => {
      // DDR II: its own pictures, static (no zoom or fade seen in 20 traced frames), 0.6 x lane/64 scale,
      // 1.6 lane widths under the step zone's centre (fifo_ddr2_play2.dff)
      const d2 = !HP4 && !hj && A.judgeD2 && (this.judgeText && this.judgeText.lesson && A.judgeLesson ? A.judgeLesson[this.judgeText.lesson - 23] : A.judgeD2[this.judgeText && this.judgeText.name]);
      if (d2 && jAge < 61 / 60) {
        const jy = jp === 'normal' && !rev ? yr + 1.6 * lw : cy;
        // (a new judgment pops in at 0.6625 and shrinks to 0.6 over 10 frames, linear; solid for 46 frames, then out
        // by 17 alpha a frame - fifo_ddr2_demo100.dff, 100 frames of the DOUBLE demo)
        blit(d2, cx, jy, (0.6 + 0.0625 * Math.max(0, 1 - jAge * 6)) * lw / 64, d2Fade(jAge));
        if (this.o.earlyLate && this.judgeText.el) text(this.judgeText.el, cx, jy + 40, 22, this.judgeText.el === 'EARLY' ? '#5ab8ff' : '#ff6ac8', 'center');
        return;
      }
      if (jAge < 1.0) {
        const k = Math.min(1, jAge * 14), fa = jAge > 0.85 ? (1 - jAge) / 0.15 : 1;
        const im = hj ? hj.judge[this.judgeText.name] : A.judge && A.judge[this.judgeText.name];
        const sc = (lanes === 8 ? 0.95 : 0.8) * (1.15 - 0.15 * k);
        g.globalAlpha = fa;
        if (!blit(im, cx, cy, sc, fa)) text(this.judgeText.name, cx, cy, 46, this.judgeText.color, 'center');
        // EARLY / LATE (PC option): small, just under the judgment - blue early, pink late
        if (this.o.earlyLate && this.judgeText.el) text(this.judgeText.el, cx, cy + 40, 22, this.judgeText.el === 'EARLY' ? '#5ab8ff' : '#ff6ac8', 'center');
        g.globalAlpha = 1;
      }
    };
    const drawCombo = (cy) => {
      if (this.combo >= 4 && hj) {
        const hp = hj, str = String(this.combo), dh = 44, dw = dh * 0.78, cw = hp.judge.COMBO.width * dh / 56, tot = str.length * dw + 8 + cw;
        let xx = cx - tot / 2;
        for (const ch of str) { g.drawImage(hp.digits[+ch], xx - dw * 0.14, cy + 102 - dh / 2, dh, dh); xx += dw; }
        g.drawImage(hp.judge.COMBO, xx + 8, cy + 102 - dh / 2, cw, dh);
      } else if (this.combo >= 4 && !HP4 && A.comboD2 && jp === 'normal' && !rev) {
        // DDR II (fifo_ddr2_hits.dff, 640 x 480, lanes 64 wide): digits and word at 0.6, the word's left edge
        // 0.675 lanes left of the lanes' centre, the last digit's left edge 1.144 lanes left, digits 0.469 lanes
        // apart; resting 2.262 lanes under the step zone's centre. On each hit it starts 0.469 lanes lower and
        // rises to rest over 20 frames (1.5 px a frame). Colour sets by full-combo tier (green seen; the others
        // by colour, as the PC's tints)
        const tier = this.runTier ?? 5;
        const C2 = A.comboD2, set = { 5: C2.whiteBlue, 4: C2.yellow, 3: C2.green, 2: C2.blue }[tier] || C2.green;
        if (set) {
          const u = lw / 64, age = this.judgeText ? t - this.judgeText.at : 9;
          const y = yr + (144.75 + 30 * Math.max(0, 1 - age * 3)) * u, dh = 56 * 0.6 * u;
          g.drawImage(set.word, cx - 43.2 * u, y - dh / 2, 224 * 0.6 * u, dh);
          const str = String(this.combo);
          [...str].forEach((ch, i) => g.drawImage(set.digits[+ch], cx + (-73.2 - 30 * (str.length - 1 - i)) * u, y - dh / 2, 33.6 * u, dh));
        }
      } else if (this.combo >= 4) {
        // measured from two real-game shots: the word "combo" starts 13.5% of the lanes' width left of their
        // centre, the count ends 21% left of it; ~97 px under the judgment
        const L = lanes * lw * (lanes === 8 ? 0.5 : 1), cw = A.judge && A.judge.COMBO, wh = 40, ww = cw ? cw.width * wh / cw.height : 0;
        const wx = cx - 0.135 * L + ww / 2, y2 = cy + 97;
        // its colour is the full combo you're on track for, like the FULL COMBO banners: only MARVELOUS =
        // white-blue (the picture's own), PERFECT = gold, GREAT = green, GOOD = blue-purple; once the
        // combo has been broken (or a freeze N.G.) no full combo is possible: green
        const tier = !HP4 && !hpLike() ? this.runTier ?? 5 : this.comboBroke || this.counts.NG ? 0 : this.fcTier ?? 5;   // (DDR II: the song's worst judgment so far)
        const col = COMBO_TINTS[tier];
        const set = col ? A.comboDigits.map(im => tintImg(im, col)) : A.comboDigits, cwi = cw && col ? tintImg(cw, col) : cw;
        const ok = cw && digits(set, String(this.combo), cx - 0.21 * L + 8, y2, 46, 'right', -0.32);
        if (ok) g.drawImage(cwi, wx - ww / 2, y2 - wh / 2, ww, wh);
        else text(this.combo + ' COMBO', cx, y2, 30, '#fff', 'center');
      }
    };
    const drawCombo0 = drawCombo;
    const drawCombo2 = (cy) => {
      drawCombo0(cy);
      if (this.mccBreakAt !== undefined && t - this.mccBreakAt < 1.0) {
        const im = A.img.comboBreak, y2 = cy + 60;
        if (!blit(im, cx, y2, 1)) text('COMBO BREAK', cx, y2, 30, '#ff5aa0', 'center');
      }
    };
    const under = { normal: [], combo: ['c'], judgment: ['j'], all: ['j', 'c'] }[jp] || [];
    if (evalOn) { if (under.includes('j')) drawJudge(cy); if (under.includes('c')) drawCombo2(cy); }
    // notes (far ones first)
    const bottom = H + lw;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.done && !n.missed && !n.holding) continue;     // hit arrows disappear
      if (this.drawOwner !== undefined && n.row && n.row.owner !== this.drawOwner) continue;   // TEAM: each field its player's turns
      let y = yOf(n.off);
      const yEnd = n.endT !== undefined ? yOf(n.endOff) : y;
      if (y > bottom) continue;
      if (yEnd < -lw) continue;
      const x = x0 + colOf(n.lane) * lw + lw / 2, d = dirOf(n.lane);
      if (n.holding) y = ry;
      if (n.missed && n.endT === undefined && y < -lw) continue;
      let alpha = 1;
      if (o.appearance === 'hidden') alpha = clamp((y - 260) / 80);
      else if (o.appearance === 'sudden') alpha = clamp((520 - y) / 80);
      else if (o.appearance === 'stealth') alpha = 0;
      // a missed step goes grey and fades away as it passes the step zone (it doesn't linger under
      // the score panel)
      // (DDR II: a missed step keeps going up the screen at full strength, drawn at 102/255 - fifo_ddr2_play2.dff,
      // fifo_ddr2_lessonplay.dff)
      const greyMiss = n.missed && !HP4 && !hp && n.endT === undefined;
      if (n.missed && !greyMiss) alpha *= 0.5 * clamp((Math.max(y, n.endT !== undefined ? yEnd : y) - (ry - lw * 0.6)) / (lw * 0.6));
      if (alpha <= 0) continue;
      g.globalAlpha = alpha;
      if (n.gk !== undefined && lanes === 4) n.hx = x0 + (n.lane === 4 ? 1 : 3) * lw;   // (HP4: the plates sit over each half)
      if (n.gk !== undefined) { this.drawHand(n, x, y, yEnd, size, Y, flipOn, flipOff); g.globalAlpha = 1; continue; }
      if (hp && n.endT !== undefined) {
        // Hottest Party's freeze arrow: the body tiled from the head down, its tail at the end
        const sc = size / 64, top = y, tailTop = Math.max(top, yEnd - 32 * sc);
        if (n.freezeNG || n.missed) g.globalAlpha = alpha * 0.45;
        flipOn();
        g.save(); g.beginPath(); g.rect(x - size / 2 - 1, top, size + 2, Math.max(0, tailTop - top)); g.clip();
        for (let yy = tailTop; yy > top - 256 * sc; yy -= 256 * sc) g.drawImage(hp.frzBody[d], x - size / 2, yy - 256 * sc, size, 256 * sc);
        g.restore();
        if (yEnd > y) g.drawImage(hp.frzTail[d], x - size / 2, tailTop - 32 * sc, size, 64 * sc);
        flipOff();
        const hz = size * 1.0, yh = Y(y);
        g.drawImage(hp.frzHead[d], x - hz / 2, yh - hz / 2, hz, hz);
        if (n.holding) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 40); g.drawImage(hp.frzHead[d], x - hz / 2, yh - hz / 2, hz, hz); g.globalCompositeOperation = 'source-over'; }
        g.globalAlpha = 1;
        continue;
      }
      if (hp) {
        // the arrow's colour by its timing: beat, 8th, 16th, other - each set has two frames that swap every half beat
        const set = o.colors === 'flat' || o.colors === 'cycle' ? 0 : n.q === 4 ? 0 : n.q === 8 ? 1 : n.q === 16 ? 2 : 3;
        const sp = hpNotes(hp, (((offNow / 4096) % 1) + 1) % 1, beat)[set][d], z = size * 1.04;
        g.drawImage(sp, x - z / 2, Y(y) - z / 2, z, z);
        g.globalAlpha = 1;
        continue;
      }
      // (a lesson's arrows are its own: SSQ_CMN sheet 12 blue for the left foot, 11 red for the right)
      const lessonFz = n.foot && A.lessonFreeze ? A.lessonFreeze[n.foot === 1 ? 1 : 0] : null;
      if (n.endT !== undefined && yEnd > y) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : lessonFz || A.freezeOn;
        flipOn();
        if (fz && fz[d] && fz[d].body) this.drawFreeze(fz[d], x, y, yEnd, size, n.holding);
        else {
          g.fillStyle = n.holding ? 'rgba(120,255,140,0.95)' : 'rgba(60,200,90,0.8)';
          g.fillRect(x - size * 0.32, y, size * 0.64, yEnd - y);
        }
        flipOff();
      }
      if (n.endT !== undefined && A.freezeOn && A.freezeOn[d]) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : lessonFz || A.freezeOn;
        g.drawImage(n.holding && fz[d].headH ? fz[d].headH : fz[d].head, x - size / 2, Y(y) - size / 2, size, size);
      } else {
        // the game's palettes: the four note colours by timing (beat, 8th, 16th, other). On RAINBOW
        // (the game's default) every colour goes once round the colour wheel each measure, the hue
        // falling (cyan, green, yellow, orange, red, pink, violet...) - measured from the real game
        const group = n.q === 4 ? 0 : n.q === 8 ? 1 : n.q === 16 ? 2 : 3;
        let sp = null;
        if (A.c8) {
          // RAINBOW ("arrow color will change"): every arrow one colour, going round the wheel twice a
          // measure - how the game does it isn't read yet **(check)**
          const shift = o.colors === 'rainbow' ? -360 * ((((offNow / 4096) % 1) + 1) % 1) : o.colors === 'cycle' ? -360 * ((((offNow / 2048) % 1) + 1) % 1) : 0;
          // (a lesson's arrows are coloured by foot: left blue, right red - the game's explanation text)
          sp = n.foot ? (A.lessonNote ? A.lessonNote[n.foot === 1 ? 1 : 0][d] : A.noteC8(n.foot === 1 ? 3 : 1, 0, aframe, d, beat < 0.2))
            : A.noteC8(o.colors === 'flat' || o.colors === 'cycle' ? 0 : group, shift, aframe, d, beat < 0.2);   // (measured: white for ~1/5 of each beat)
        } else {
          let top, bot;
          if (n.foot) { const c = A.hex(n.foot === 1 ? TINT[8] : TINT[4]); top = c; bot = c.map(v => v * 0.7); }
          else if (o.colors === 'flat' || o.colors === 'rhythm') { const c = A.hex(o.colors === 'flat' ? TINT.flat : TINT[n.q] || TINT[0]); top = c; bot = c.map(v => v * 0.7); }
          else { const base = n.q === 4 ? 28 : n.q === 8 ? 222 : 288; const hue = Math.round((base + Math.max(0, (n.off - offNow) / 1024) * 55) / 10) * 10 % 360; top = A.hsl(hue, 1, 0.55); bot = A.hsl(hue + 50, 1, 0.5); }
          sp = A.arrowCol ? A.arrowCol(top, bot, aframe, d) : null;
        }
        if (sp && greyMiss) sp = tintImg(sp, 'rgb(102,102,102)');
        if (sp) g.drawImage(sp, x - size / 2, Y(y) - size / 2, size, size);
        else drawArrow(o.colors === 'flat' ? 4 : n.q, x, Y(y), d, size);
      }
      g.globalAlpha = 1;
    }
    // hit flashes
    this.bursts = this.bursts.filter(b => t - b.at < 0.2);
    if (hp) {                                    // Hottest Party: the arrow's white shape flashes and grows
      g.globalCompositeOperation = 'lighter';
      for (const b of this.bursts) {
        if (b.im !== undefined && b.im !== null) continue;
        const k = (t - b.at) / 0.2, x = x0 + b.lane * lw + lw / 2, sc = size * (1.05 + 0.35 * k);
        g.globalAlpha = 0.45 * (1 - k);
        g.drawImage(hp.zoneLit[dirOf(b.lane)], x - sc / 2, yr - sc / 2, sc, sc);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } else if (A.burst) {
      g.globalCompositeOperation = 'lighter';
      for (const b of this.bursts) {
        if (b.im) continue;
        const k = (t - b.at) / 0.2, x = x0 + b.lane * lw + lw / 2, sc = size * (1.1 + 0.5 * k);
        g.globalAlpha = 0.8 * (1 - k);
        g.drawImage(A.burstTint(b.color, dirOf(b.lane)), x - sc / 2, yr - sc / 2, sc, sc);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // a hand marker hit: its picture flashes and grows over its column
    g.globalCompositeOperation = 'lighter';
    for (const b of this.bursts) if (b.im) {
      const k = (t - b.at) / 0.2, im = b.im, sc = size * (1.0 + 0.5 * k);
      if (!im) continue;
      g.globalAlpha = 0.7 * (1 - k);
      const bx = HP4 && lanes === 4 && b.lane >= 4 ? x0 + (b.lane === 4 ? 1 : 3) * lw : x0 + colOf(b.lane) * lw + lw / 2;
      g.drawImage(im, bx - sc / 2, yr - sc / 2, sc, sc);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    for (const n of this.holding) if (n.holding && A.burst && !hp && n.gk === undefined) {
      const x = x0 + n.lane * lw + lw / 2;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 40);
      g.drawImage(A.arrowMask[dirOf(n.lane)], x - size / 2, yr - size / 2, size, size);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (evalOn) { if (!under.includes('j')) drawJudge(cy); if (!under.includes('c')) drawCombo2(cy); }
    // OK / NG under a freeze arrow
    // (DDR II: up for 61 frames - fifo_ddr2_demo100.dff)
    if (this.okText && t - this.okText.at < (!HP4 && !hj ? 61 / 60 : 0.5)) {
      const im = hj ? hj.judge[this.okText.name] : A.judge && A.judge[this.okText.name];
      const x = x0 + colOf(this.okText.lane) * lw + lw / 2;
      const d2 = !HP4 && !hj && !rev && A.judgeD2 && A.judgeD2[this.okText.name], ok2 = t - this.okText.at;
      // DDR II (fifo_ddr2_hits.dff): O.K. at 0.6, 3 px right of the lane's centre and 51.5 px under the step
      // zone's centre (64-px lanes); no pop; solid for 46 frames, then out by 17 alpha a frame (15 frames) -
      // fifo_ddr2_demo100.dff (100 frames: first drawn frame 10, 255 to 55, 238 at 56 ... 17 at 69)
      if (d2) blit(d2, x + 3 * lw / 64, yr + 51.5 * lw / 64, 0.6 * lw / 64, d2Fade(ok2));
      else if (!blit(im, x, rev ? yr - lw * 0.95 : ry + lw * 0.95, lanes === 8 ? 0.5 : 0.6))
        text(this.okText.name, x, rev ? yr - lw * 0.9 : ry + lw * 0.9, 26, this.okText.name === 'OK' ? '#ffe14d' : '#ff4060', 'center');
    }
  }
  // CHOREOGRAPH's hand markers, with SSQ_CMN's own pictures (HP4: sheets 16-52 after the arrows). Which
  // picture goes with which kind is read off the pictures themselves (the PUNCH gloves, the poses, the
  // gloves): the game's drawing code for them isn't traced yet, nor how it shows the direction (param).
  // Kinds (0x8003406c): 1 punch, 2 thrust, 3 pose, 4 swing (held to its end), 6 / 7 hip bump
  handPic(n) {
    const P = A.hyper;
    if (!P) return null;
    const left = n.lane === 4;
    switch (n.gk) {
      case 1: return P[left ? 30 : 32];            // the PUNCH gloves (the word on the left / right)
      case 3: return P[left ? 18 : 22];            // a pose (the figures)
      case 6: case 7: return P[45];                // the hip bump (the round marker)
      case 5: return P[51];                        // the hip roll (the Balance Board picture)
      default: return P[28];                       // a glove: thrust, swing
    }
  }
  // HP4's hand markers, drawn from the game's own tables (renderer 0x800a22ec; HP4_SPEC "Hand marker pictures"):
  // a plate (0x8025bad0: punch 34 + direction (8 = none), thrust 45, pose 46 - 47 when one pose takes both hands -
  // swing 48; 128 x 64, 256 x 64 for 47) and over it the kind's layers (0x8025d1d0..): each a picture rectangle of
  // an SSQ_CMN sheet, its pivot and offset from the marker's middle, a parent layer, a condition on the pose's arm
  // bits and how it turns - 0x20 by the marker's own direction, 0x40 by the other hand's, 45 degrees a step.
  // Punch: with a direction the small glove (28) turned to it with the pointer (sheet 7, 192,0) on it; with none
  // the PUNCH glove (30 left / 32 right). Thrust: sheet 7's chevrons (0,0) turned to the direction. Swing: sheet
  // 7 at (64,0), (128,0) for a parameter of 100 or more. Pose: the figure (18 / 20, 22 for both hands) and an arm
  // per hand - the straight arm (24) turned to the direction, or for a parameter of 100 or more the bent one (26,
  // mirrored for directions 1-5).
  hp4Hand(n, x, y, size, Y) {
    const P = A.hyper, k = n.gk, raw = n.gp || 0, d = raw % 100, f8 = raw >= 100;
    if (!HP4 || !P || x === undefined || ![1, 2, 3, 4].includes(k)) return false;
    const s = size / 64, yy = Y(y), left = n.lane === 4;
    // a pose on both hands at once: one marker over both halves (the partner isn't drawn by itself)
    let both = null;
    if (k === 3) {
      both = this.notes.find(m => m !== n && m.gk === 3 && m.off === n.off && m.lane !== n.lane) || null;
      if (both && n.lane === 5) return true;
    }
    const cx = both && both.hx !== undefined ? (x + both.hx) / 2 : x;
    // the plate (and a held marker's body down to its end: 0x8025bad0's body / start / tail rectangles)
    const plate = k === 1 ? 34 + Math.min(d, 8) : k === 2 ? 45 : k === 4 ? 48 : both ? 47 : 46;
    const pw = plate === 47 ? 256 : 128, im = P[plate];
    if (!im) return false;
    if ((k === 3 || k === 4) && n.endT !== undefined && n.yEnd > y) {
      const y2 = Y(n.yEnd), top = Math.min(yy, y2), bot = Math.max(yy, y2);
      g.drawImage(im, 0, 128, pw, 256, cx - pw / 2 * s, top, pw * s, Math.max(0, bot - top - 32 * s));
      g.drawImage(im, 0, 384, pw, 64, cx - pw / 2 * s, bot - 32 * s, pw * s, 64 * s);
    }
    g.drawImage(im, 0, 0, pw, 64, cx - pw / 2 * s, yy - 32 * s, pw * s, 64 * s);
    // the layers: [sheet, u, v, w, h, pivot x, pivot y, offset x, offset y, slot, parent, turn, condition]
    const L = HP4_HAND_LAYERS[k === 1 ? (d < 8 ? 'punchDir' : (left ? 'punchL' : 'punchR')) : k === 2 ? 'thrust'
      : k === 4 ? (f8 ? 'swing8' : 'swing') : both ? 'poseBoth' : (left ? 'poseL' : 'poseR')];
    // the pose's arm bits (0x800a22ec case 0x11): per hand 1 straight, 2 / 4 the bent arm (2 for directions 0,
    // 6, 7, else 4 - the right hand 2 below 3); the right hand's in the upper half
    const armBits = (m, right) => { const dd = (m.gp || 0) % 100, b8 = (m.gp || 0) >= 100;
      const v = !b8 ? 1 : right ? (dd < 3 ? 2 : 4) : (dd === 0 || dd >= 6 ? 2 : 4); return right ? v << 16 : v; };
    let bits = 0;
    if (k === 3) { if (both) bits = armBits(left ? n : both, false) | armBits(left ? both : n, true); else bits = armBits(n, !left); }
    const dirOf = m => { const dd = (m.gp || 0) % 100; return dd >= 1 && dd < 8 ? dd : 0; };
    const mine = both ? (left ? n : both) : n, other = both ? (left ? both : n) : null;
    // the animation (0x800a18e8): punch - f = 1 - sin(pi u / 1024), u = (2048 x song seconds) mod 1024 (twice a
    // second); with a direction the glove bobs f x -16 and the pointer is scaled (1 - 0.2 f, 1 + 0.4 f), without one
    // the glove scales 1 + 0.2 f. A swing being held scales 1 - 0.2 sin(pi (1 - p^2)), p = how far through it is
    let an = { x: 0, y: 0, sx: 1, sy: 1 };
    const tn = (() => { try { const v = Play.now(); return Number.isFinite(v) ? v : 0; } catch (e) { return 0; } })();
    if (k === 1) {
      const i1 = Math.trunc(2048 * tn);
      let f;
      if (i1 > 0) f = 1 - Math.sin(Math.PI * (i1 & 1023) / 1024);
      else if (-i1 < 1024) f = 1 - 1.2 * Math.sin(Math.PI * (1 - (-i1) / 1024));
      else f = 1 - Math.sin(Math.PI * (1 - ((-i1 - 1024) & 1023) / 1024));
      an = d < 8 ? { x: 0, y: -16 * f, sx: 1 - 0.2 * f, sy: 1 + 0.4 * f } : { x: 0, y: 0, sx: 1 + 0.2 * f, sy: 1 + 0.2 * f };
    } else if (k === 4 && n.holding && n.endT > n.t) {
      const pr = Math.max(0, Math.min(1, (tn - n.t) / (n.endT - n.t))), sc = 1 - 0.2 * Math.sin(Math.PI * (1 - pr * pr));
      an = { x: 0, y: 0, sx: sc, sy: sc };
    }
    const M = [];
    for (const ly of L) {
      const [sh, u, v, w, h, px, py, ox, oy, slot, parent, turn, cond] = ly;
      if (cond && !(cond & bits)) continue;
      // (sheet 7: its palette is rewritten each frame from the song time - A.sheet7, traced from 0x8009fca4)
      const pic = sh === 7 ? (A.sheet7 && A.sheet7(tn) || keyedSheet(P[7], [255, 255, 255])) : P[sh];
      if (!pic) continue;
      let a = 0;
      if (turn & 0x20) a += dirOf(mine) * Math.PI / 4;
      if (turn & 0x40) a += dirOf(other || mine) * Math.PI / 4;
      // the layer's matrix (parent x offset x turn x animation scale x animation offset): its parent's (or the
      // marker's middle), then its offset, its turn, the animation's scale and offset
      const base = parent < 0 ? new DOMMatrix().translate(cx, yy).scale(s) : M[parent] || new DOMMatrix().translate(cx, yy).scale(s);
      let m = base.translate(ox, oy).rotate(a * 180 / Math.PI);
      if (turn & 8) m = m.scale(an.sx, an.sy);
      if (turn & 2) m = m.translate(an.x, an.y);
      M[slot] = m;
      g.save(); g.setTransform(g.getTransform().multiply(m));
      if (w < 0) { g.scale(-1, 1); g.drawImage(pic, u + w, v, -w, h, -px, -py, -w, h); }
      else g.drawImage(pic, u, v, w, h, -px, -py, w, h);
      g.restore();
    }
    return true;
  }
  drawHand(n, x, y, yEnd, size, Y, flipOn, flipOff) {
    n.yEnd = yEnd;
    if (!n.missed && (n.endT === undefined || n.gk === 3 || n.gk === 4) && this.hp4Hand(n, n.hx, y, size + 6, Y)) return;
    const im = this.handPic(n), z = size * 0.95;
    if (n.endT !== undefined && yEnd > y) {
      // a swing: held to its end - its trail down the column
      flipOn();
      const body = A.hyper && A.hyper[46];
      if (body) g.drawImage(body, 0, 0, Math.min(body.width, 64), body.height, x - size * 0.3, y, size * 0.6, yEnd - y);
      else { g.fillStyle = n.holding ? 'rgba(255,220,80,0.9)' : 'rgba(255,170,40,0.75)'; g.fillRect(x - size * 0.25, y, size * 0.5, yEnd - y); }
      flipOff();
    }
    if (n.missed) g.globalAlpha *= 0.6;
    if (im) g.drawImage(im, x - z / 2, Y(y) - z / 2, z, z * im.height / im.width);
    else { g.fillStyle = '#ff8c28'; g.beginPath(); g.arc(x, Y(y), z * 0.4, 0, Math.PI * 2); g.fill(); }
  }
  drawFreeze(fz, x, y, yEnd, size, active) {
    const sc = size / 64, bh = fz.body.height;
    // like the game: khaki yellow, fading from green just under the head; bright yellow while held
    const body = active ? (fz.bodyH || fz.body) : (fz.bodyY || fz.body);
    const tailH = 64, tailSrc = bh - tailH;          // the last 64 rows of the body texture are the tail
    // the tail always ends where the freeze ends; while it's held the arrow is eaten up from the
    // head, so near the end only the bottom of the tail shows under the head, then nothing
    const top = y, tailTop = yEnd - tailH * sc * 0.5;
    const P = 128, from = tailSrc - P;
    const column = (img, clipTop, clipBottom) => {
      if (clipBottom <= clipTop) return;
      g.save(); g.beginPath(); g.rect(x - size / 2 - 1, clipTop, size + 2, clipBottom - clipTop); g.clip();
      for (let yy = tailTop; yy > clipTop - 1; yy -= P * sc) g.drawImage(img, 0, from, 64, P, x - size / 2, yy - P * sc, size, P * sc);
      g.restore();
    };
    column(body, top, tailTop);
    g.save(); g.beginPath(); g.rect(x - size / 2 - 1, top, size + 2, H); g.clip();
    g.drawImage(body, 0, tailSrc, 64, tailH, x - size / 2, tailTop, size, tailH * sc);
    g.restore();
    if (fz.bodyG && tailTop > top) {          // green from the head, fading to yellow about halfway down
      const gh = Math.min(tailTop - top, (tailTop - top) * 0.55 + size * 0.3), orig = g.globalAlpha, a0 = orig * (active ? 0.45 : 1);
      for (let k = 0; k < 12; k++) {
        const y0 = top + gh * k / 12, y1 = top + gh * (k + 1) / 12;
        g.globalAlpha = a0 * (1 - k / 12);
        column(fz.bodyG, y0, y1);
      }
      g.globalAlpha = orig;
    }
  }
  // 3 / 4 players: the game's panel, badge, difficulty, gauge and score at the places in METER_MULTI_US.bin
  drawHudMulti(n, L, t) {
    const M = A.multi[n], i = this.idx, life = this.life / 1000;
    const di = DIFFS.findIndex(d => d[0] === this.diff);
    const ax = L.bars[i].x;
    mspr(M.panels[i], L.bars[i], ax);
    mspr(M.gauges[i], L.gauges[i], ax);
    mspr(M.diffs[di], L.diffs[i], ax);
    // the gauge's pills (gauge01, 8 x 14, one part per pill, left to right) lit like the 1-player gauge
    const cs = L.cells[i], N = cs.length, units = life * N, full = life >= 1, lit = Math.max(1, Math.ceil(units));
    const mph = (((this.timing.offAt(t) / 4096) % 1) + 1) % 1;
    cs.forEach((c, k) => {
      const part = Math.max(0, Math.min(1, units - k));
      if (part <= 0) return;
      let col;
      if (full) col = `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)`;
      else {
        const fromTip = (lit - 1 - k) / Math.max(1, lit);
        const cyan = mph < 0.15 ? fromTip < mph / 0.15 : mph < 0.62 ? true : mph < 0.95 ? (mph - 0.62) / 0.33 - fromTip < 0 : false;
        col = cyan ? 'rgb(34,186,232)' : 'rgb(48,214,122)';
      }
      const x = MX(c.x, ax) + (4 - c.px) * c.sx * 1.5, y = MY(c.y) + (7 - c.py) * c.sy * 1.5;
      const rx = 3.1 * c.sx * 1.5, ry = 5.2 * c.sy * 1.5;
      g.save(); g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
      g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
    });
    if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) mspr(M.danger, L.danger[i], ax);
    mspr(M.badges[i], L.badges[i], ax);
    // the score (Num_00, 28 x 28 digits at the part's scale): measured on the 3- and 4-player screenshots,
    // the last digit's middle is on the part's place, the digits 0.66 digit-widths apart
    const nm = L.nums[i];
    if (nm) {
      const dw = 28 * nm.sx * 1.5, h = 28 * nm.sy * 1.5, adv = dw * 0.66, right = MX(nm.x, ax) + adv / 2, y = MY(nm.y);
      const str = String(this.score).padStart(Play.scoreDigits || 7, '0'), set = A.numbers && A.numbers.white;
      [...str].forEach((ch, k) => {
        const im = set && set[+ch], cx = right - adv * (str.length - k - 0.5);
        if (im) { const w = im.width * h / im.height; g.drawImage(im, cx - w / 2, y - h / 2, w, h); }
        else text(ch, cx, y, h, '#fff', 'center');
      });
    }
  }
  // the life gauge panel above the lanes
  drawHud(x0, width, t, badge, two) {
    if (Play.hpHud && Play.hp2Screen && HP2_HUD) return this.drawHudHP2(HP2_HUD, x0, width, t, badge, two);
    const HP = Play.hpHud ? hpHud() : null;
    if (HP && HP.ok) return this.drawHudHP(HP, x0, width, t, badge, two);
    // DEMO PLAY: the DEMONSTRATION banner where the player's bar goes, and nothing else (Dolphin, 2026-11-18)
    if (DEMO.on && !HP4 && A.img.demoWin) {
      blit(A.img.demoWin, x0 + width / 2, 90, 1.5); blit(A.img.demoTxt, x0 + width / 2, 90, 1.5);
      return;
    }
    // HP4: the panel slides in from the right when the song screen opens (hudSlide)
    const sl = HP4 ? hudSlide(3) : 0;
    if (sl) { g.save(); g.translate(sl, 0); }
    try { this.drawHudPanel(x0, width, t, badge, two, HP4 ? hudSlide(7) - sl : 0); } finally { if (sl) g.restore(); }
  }
  drawHudPanel(x0, width, t, badge, two, badgeDx) {
    const life = this.life / 1000;
    const di = DIFFS.findIndex(d => d[0] === (this.showDiff || this.diff));
    const px = x0 + width / 2 - 183, py = 30, pw = 366, ph = 112;
    // each player's own colour (Wii 4-player screen: 1 blue, 2 red, 3 green, 4 yellow). Players 1 / 2 use
    // the file's blue / red panels; for 3 / 4 the file's green / yellow panels are a different (pill)
    // shape, so the grey panel is tinted green / yellow here (APPROXIMATION, matched to the screenshot)
    const pan = (A.img.meterPanels && this.idx < 2 && A.img.meterPanels[this.idx]) || (this.idx >= 2 ? tintedPanel(this.idx) : null) || A.img.meterPanel;
    if (pan) g.drawImage(pan, px, py, pw, ph);
    else { g.fillStyle = 'rgba(60,140,230,0.9)'; g.fillRect(px, py, pw, ph); }
    const pb = (A.img.meterBadges && A.img.meterBadges[this.idx]) || (this.idx === 1 ? A.img.meterBadge2 : this.idx === 0 ? A.img.meterBadge : null);   // the game's 1-4 badges
    if (!blit(pb, px + 14, py + 50, 1.15) && this.idx >= 1) { g.fillStyle = ['', '#e8508c', '#3cc060', '#f0a020'][this.idx]; g.beginPath(); g.arc(px + 14, py + 50, 20, 0, Math.PI * 2); g.fill(); text(String(this.idx + 1), px + 14, py + 51, 22, '#fff', 'center'); }
    const dl = A.img.meterDiff && A.img.meterDiff[di];
    if (!blit(dl, px + pw / 2 + 26, py + 22, 1.15)) text(DIFFS[di][1], px + pw / 2 + 26, py + 22, 18, DIFFS[di][2], 'center');
    // LED gauge, like the game's (measured from the real game): once a measure the lit pills turn
    // from green to cyan in a quick sweep from the tip leftwards, stay cyan, then turn back to green
    // in a slower, sparkly sweep, again from the tip. The last pill fills from the bottom, and a
    // full gauge cycles through the rainbow.
    const gx = px + 78, gy = py + 38, gs = 1.5, fr = (A.img.meterGauges && A.img.meterGauges[this.idx]) || A.img.meterGauge;
    if (fr) g.drawImage(fr, gx, gy, fr.width * gs, fr.height * gs);
    const N = 22, units = life * N, full = life >= 1, lit = Math.max(1, Math.ceil(units));
    const mph = (((this.timing.offAt(t) / 4096) % 1) + 1) % 1;
    const GREEN = 'rgb(48,214,122)', CYAN = 'rgb(34,186,232)';
    for (let k = 0; k < N; k++) {
      const x = gx + (8.5 + 8 * k) * gs, y = gy + 10 * gs, rx = 3.1 * gs, ry = 4.4 * gs;
      const part = Math.max(0, Math.min(1, units - k));
      if (part <= 0) continue;
      let col;
      if (full) col = `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)`;
      else {
        const fromTip = (lit - 1 - k) / Math.max(1, lit);        // 0 at the tip .. ~1 at the left end
        let cyan;
        if (mph < 0.15) cyan = fromTip < mph / 0.15;
        else if (mph < 0.62) cyan = true;
        else if (mph < 0.95) {
          const front = (mph - 0.62) / 0.33, behind = front - fromTip;
          const spark = ((k * 7919 + Math.floor(t * 20) * 104729) % 97) / 97;
          cyan = behind < 0 ? true : behind < 0.2 ? spark < 0.5 : false;
        } else cyan = false;
        col = cyan ? CYAN : GREEN;
      }
      g.save();
      g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
      g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - 0.6 * gs, y - 1.6 * gs, rx * 0.5, ry * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // score in the dark box under the gauge
    const sx = gx + 182 * gs, sy = gy + 32 * gs;
    const sd = Play.scoreDigits || 7, sz = sd > 7 ? 24 : 30;
    if (!digits(A.numbers && A.numbers.white, String(this.score).padStart(sd, '0'), sx, sy, sz, 'right', -0.3))
      text(String(this.score).padStart(sd, '0'), sx, sy, 26, '#fff', 'right');
    if (two && this.name) text(this.name, px + 44, py + ph - 16, 16, '#0d3770', 'left');
    if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) blit(A.img.meterDanger || A.img.danger, x0 + width / 2, py + ph + 18, 1.2);
    // style badge (one player on a 4-panel chart)
    if (badge && A.img.meterStyle) {
      const bx = x0 + width + 160 + (badgeDx || 0), by = 74;
      blit(A.img.meterStyle, bx, by, 1.4);
      blit(A.img.meterNormal, bx, by - 14, 1.1);
    }
  }
}

// HP4's play screen slide-in (game/GAME_CMN_US.bin /0/0/0, CAE 0x6f800, track 0): every part starts 200
// (of the 640-wide screen) to the right, waits its frames (the player bars and gauges 3, the title / style
// plates 7), then eases in over 9 frames to its place (the offsets the file gives, frame by frame); 30
// frames a second from when the song screen comes up. Returns the canvas offset now.
const HUD_SLIDE = [200, 110.5, 74.6, 50.9, 34.1, 21.9, 13.1, 6.9, 2.9, 0.7, 0];
// (see above) how far the HUD is slid off-screen right now
function hudSlide(wait) {
  const P = Play, t = P && P.now ? P.now() : 0, open = P && P.stage && P.stage.bossIntro ? -10 : -4.6;
  const f = (t - open) * 30 - wait + 1;                  // (the first step lands on the frame after the wait)
  if (f >= HUD_SLIDE.length - 1) return 0;
  if (f <= 0) return HUD_SLIDE[0] * WS;
  const i = Math.floor(f), u = f - i;
  return (HUD_SLIDE[i] + (HUD_SLIDE[i + 1] - HUD_SLIDE[i]) * u) * WS;
}
// Hottest Party's gauge and score panel: the gauge top left (player ball, PLAYER n, STYLE badge beside
// it), the score bottom left in an orange panel with the difficulty on a tab above
Dancer.prototype.drawHudHP = function (hp, x0, width, t, badge, two) {
  const life = this.life / 1000, di = DIFFS.findIndex(d => d[0] === this.diff), pi = this.idx || 0;
  const right = two && pi === 1;
  const im = (img, x, y, w, h) => { if (img && img.naturalWidth) { g.drawImage(img, x, y, w, h); return true; } return false; };
  const k = 1.5, gx = right ? x0 + width - 232 * k + 20 : x0 - 30, gy = 38;
  // the gauge: its frame, the bar inside it (the lit part), the player's ball in the ring
  // (the game draws this frame upside down: the wide dark slot on top for the bar, the PLAYER tab under it)
  if (hp.gauge && hp.gauge.naturalWidth) { g.save(); g.translate(gx, gy + 58 * k); g.scale(1, -1); g.drawImage(hp.gauge, 0, 0, 232 * k, 58 * k); g.restore(); }
  const bx = gx + 46 * k, by = gy + 10 * k, bw = 168 * k, bh = 19 * k;
  g.fillStyle = 'rgba(40,10,0,0.85)'; g.fillRect(bx, by, bw, bh);
  const full = life >= 1;
  g.save(); g.beginPath(); g.rect(bx, by, bw * life, bh); g.clip();
  const grd = g.createLinearGradient(bx, by, bx, by + bh);
  grd.addColorStop(0, full ? `hsl(${(t * 300) % 360},100%,70%)` : '#7ff3ff'); grd.addColorStop(1, full ? `hsl(${(t * 300 + 60) % 360},100%,45%)` : '#1aa0d8');
  g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(bx, by, bw, bh); g.globalAlpha = 1;
  // stripes, like the game's bar
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let sx = bx + ((t * 60) % 12); sx < bx + bw * life; sx += 12) g.fillRect(sx, by, 5, bh);
  g.restore();
  im(hp.ball[pi], gx + 8 * k, gy + 14 * k, 28 * k, 28 * k);
  im(hp.p[pi], gx + 34 * k, gy + 38 * k, 102 * 1.15, 18 * 1.15);
  if (badge) {
    im(hp.style, gx + 226 * k, gy - 2, 156 * 1.45, 44 * 1.45);
    im(hp.single, gx + 226 * k + 78 * 1.45 - 70 * 0.85, gy + 34, 140 * 0.85, 32 * 0.85);
  }
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) im(hp.danger, gx + 120, gy + 95, 74 * 1.6, 12 * 1.6);
  // the score panel
  const sk = 2.25, sx = right ? x0 + width - 150 * sk + 10 : x0 - 30, sy = 600;
  const tab = hp.diff[[4, 1, 2, 3].indexOf(this.diff)];
  g.fillStyle = '#ff5a14'; g.beginPath(); g.roundRect ? g.roundRect(sx + 60, sy - 22, 150, 30, 10) : g.rect(sx + 60, sy - 22, 150, 30); g.fill();
  g.fillStyle = '#2a0a00'; g.beginPath(); g.roundRect ? g.roundRect(sx + 64, sy - 19, 142, 24, 8) : g.rect(sx + 64, sy - 19, 142, 24); g.fill();
  if (!im(tab, sx + 74, sy - 18, 94 * 1.3, 16 * 1.3)) text(DIFFS[di][1], sx + 135, sy - 7, 16, DIFFS[di][2], 'center');
  im(hp.scoreBox, sx, sy, 150 * sk, 38 * sk);
  g.fillStyle = 'rgba(30,8,0,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(sx + 84, sy + 16, 150 * sk - 104, 38 * sk - 32, 10) : g.rect(sx + 84, sy + 16, 150 * sk - 104, 38 * sk - 32); g.fill();
  g.font = 'italic 900 31px "Arial Black", "Segoe UI", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(String(this.score).padStart(Play.scoreDigits || 9, '0'), sx + 150 * sk - 28, sy + 38 * sk / 2 + 1);
  if (two && this.name) text(this.name, sx + 150 * sk / 2, sy + 38 * sk + 14, 16, '#fff', 'center');
};

// Hottest Party 2's gold screen: the gauge top left with the player's ball in its ring, the STYLE badge
// at the top in the middle, the score panel bottom left with the difficulty on its tab
Dancer.prototype.drawHudHP2 = function (h2, x0, width, t, badge, two) {
  const life = this.life / 1000, pi = this.idx || 0, right = two && pi === 1;
  const im = (img, x, y, w, h) => { if (img && img.naturalWidth) { g.drawImage(img, x, y, w, h); return true; } return false; };
  const k = 1.35, gw = 246 * k, gh = 46 * k, gx = right ? W - gw - 60 : 64, gy = 30;
  // the bar first (inside the frame's slot), then the frame over it
  // the frame (its slot shows the empty gauge), then the lit part of the bar over the slot
  im(h2.gauge, gx, gy, gw, gh);
  const bx = gx + 40 * k, by = gy + 6 * k, bw = 198 * k, bh = 12 * k;
  const grd = g.createLinearGradient(bx, by, bx, by + bh), full = life >= 1;
  grd.addColorStop(0, full ? `hsl(${(t * 300) % 360},100%,72%)` : '#fff3a0'); grd.addColorStop(1, full ? `hsl(${(t * 300 + 60) % 360},100%,50%)` : '#ffae20');
  g.save(); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw * life, by); g.lineTo(bx + bw * life - bh * 0.5, by + bh); g.lineTo(bx, by + bh); g.closePath(); g.clip();
  g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(bx, by, bw, bh); g.globalAlpha = 1;
  g.fillStyle = 'rgba(120,50,0,0.35)';
  for (let sx = bx + ((t * 60) % 10); sx < bx + bw * life; sx += 10) g.fillRect(sx, by, 4, bh);
  g.restore();
  im(h2.ball[pi], gx + 6 * k, gy + 7 * k, 30 * k, 30 * k);
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) im(h2.danger, bx + bw - 74 * 1.5 - 6, by + 1, 74 * 1.5, 12 * 1.5);
  if (badge) {
    const sk = 1.45, sw = 156 * sk, sh = 44 * sk, sx2 = W / 2 - sw / 2 + 120;
    im(h2.style, sx2, 12, sw, sh);
    im(h2.single, sx2 + sw / 2 - 70 * 1.25 / 2 * 1.4, 12 + sh * 0.5, 70 * 1.25 * 1.4, 16 * 1.4);
  }
  // the score panel
  const sk = 1.5, pw = 232 * sk, ph = 58 * sk, px = right ? W - pw - 60 : 108, py = 612;
  im(h2.score, px, py, pw, ph);
  const di = [4, 1, 2, 3].indexOf(this.diff);
  im(h2.diff[di >= 0 ? di : 1], px + 74 * sk, py - 1, 94 * 1.25, 16 * 1.25);
  g.font = 'italic 900 34px "Arial Black", "Segoe UI", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.strokeStyle = '#3a2000'; g.lineWidth = 4; g.lineJoin = 'round';
  const str = String(this.score).padStart(Play.scoreDigits || 9, '0');
  g.strokeText(str, px + pw - 30, py + ph * 0.62); g.fillText(str, px + pw - 30, py + ph * 0.62);
  if (two && this.name) text(this.name, px + pw / 2, py + ph + 14, 16, '#fff', 'center');
};

// HP4's backup dancers for a song (CSelect::setPlayerChr, main.dol 0x800463dc, kind 0x2714 "random backup"):
// for each backup slot one of the two backup characters at random (73 / 74 = CHR74 / CHR75, rand & 1), then one
// of its outfits at random among those no other dancer is wearing (CHR7401-04 / CHR7501-04 on the disc). Picked
// once per song, as the game does when the song is chosen; the DANCE VIEW MENU shows the same ones.
let HP4_BACK = null;
// (see above) HP4's backup dancers for a song
function hp4Backups(slot) {
  const lead = (Dancer3D && Dancer3D.customFor || '').match(/ddr2char\/(\d+)\/(\d+)/);
  const key = slot + ':' + (lead ? lead[1] + '/' + lead[2] : '');
  if (HP4_BACK && HP4_BACK.key === key) return HP4_BACK.picks;
  const used = new Set(lead ? [lead[1] + '/' + (+lead[2])] : []), picks = [];
  for (let k = 0; k < 2; k++) {
    let ch = (Math.floor(wiiRandom() * 32768) & 1) ? '75' : '74';
    let free = [1, 2, 3, 4].filter(o => !used.has(ch + '/' + o));
    if (!free.length) { ch = ch === '74' ? '75' : '74'; free = [1, 2, 3, 4].filter(o => !used.has(ch + '/' + o)); }
    const o = free[Math.floor(wiiRandom() * free.length)] || 1;
    used.add(ch + '/' + o); picks.push(ch + '/' + o);
  }
  HP4_BACK = { key, picks };
  return picks;
}
// THE SONG SCREEN: runs the song, the players, the stage and dancers, the HUD and the banners
const Play = {
  // charts: [{built, diff, o, prof, name}] - one per player
  with(song, charts, music, dance) {
    this.song = song; this.music = music; this.dance = dance || null;
    this.two = charts.length > 1;
    // which game each part of the screen looks like (all one game, or mixed in DDR CUSTOM). Hottest
    // Party's pictures come from its disc, so without it everything stays DDR II's
    const has = hpAvailable(), L = k => has && look(k) === 'hp';
    this.hpArrows = L('arrows'); this.hpJudge = L('judge'); this.hpBoard = L('board'); this.hpHud = L('hud'); this.hpBanners = L('banners');
    this.hp = this.hpBoard;
    this.scoreDigits = HP4 || look('score') === 'hp' ? 9 : 7;      // (HP4: "%09d", 0x800c4df0)
    this.hp2Screen = (gameNow() === 'hp2' || gameNow() === 'hp3') && hp2Available();         // Hottest Party 2's own gold screen
    if (this.hp2Screen) hp2Hud();
    if (this.hpArrows || this.hpJudge || this.hpHud || this.hpBanners) hpHud();
    const lanes = S.style === 'double' ? 8 : 4;
    this.lanes = lanes;
    this.ps = charts.map((c, i) => new Dancer(i, song, c.built, c.diff, S.mode === 'relaxed' ? Object.assign({}, c.o, { gauge: 'no fail' }) : c.o, c.prof, c.name, lanes));
    this.cheer = null; this.crowdNext = undefined;
    this.group = GROUP && GROUP !== 'team' && GROUP !== 'family' && this.ps.length > 1 && !DEMO.on ? new GroupJudge(GROUP, this.ps) : null;
    // TEAM (PC extra): one chart, the turns worked out before the song (teamTurns)
    this.team = GROUP === 'team' && this.ps.length === 1 && P2 && !DEMO.on ? teamTurns(this.ps[0]) : null;
    if (this.team) this.two = true;                       // (TEAM: the 2-player screen, one chart split over both fields)
    if (this.team) { this.ps[0].teamStats = [{ run: 0, best: 0 }, { run: 0, best: 0 }]; this.teamNames = [DATA.current || 'PLAYER 1', P2.name || 'GUEST']; this.ps[0].name = this.teamNames.join(' & '); }
    for (const p of this.ps) p.group = this.group;
    // FAMILY with 3 / 4 players: each side's two players are one party (the FRIENDSHIP machinery: party
    // lane 5 / 6 with its members, 0x8003e57c), so they're judged together the FRIENDSHIP way
    if (GROUP === 'family' && this.ps.length > 2 && !DEMO.on)
      for (const side of [0, 1]) {
        const mem = this.ps.filter((p, i) => familySide(i, this.ps.length) === side);
        if (mem.length > 1) { const gj = new GroupJudge('friend', mem); for (const p of mem) p.group = gj; }
      }
    this.netRemote = null; this.netQuit = false;
    // GHOST (PC extra): your own player 1 records its judgments in DANCE MODE; a ghost side replays them
    if ((S.mode || 'free') === 'free' && !COURSE && !WK && !GC && !BATTLE && !DEMO.on && !song.lesson && GROUP !== 'team') {
      const me = this.ps[0]; if (me && !charts[0].ghost && !charts[0].remote) { me.rec = []; me.recOpts = onlineOpts(); }
    }
    charts.forEach((c, i) => { if (c.ghost) { const gp = this.ps[i]; gp.remote = true; gp.ghostEv = c.ghost.ev.slice(); gp.rec = null; } });
    charts.forEach((c, i) => { if (c.com !== undefined) this.ps[i].com = c.com; if (c.remote) { this.ps[i].remote = true; this.netRemote = this.ps[i]; } });
    if (this.netRemote && window.NET) { const rp = this.netRemote; NET.handlers.j = m => (rp.netQueue = rp.netQueue || []).push(m); NET.handlers.ng = NET.handlers.j;
      NET.handlers.quit = () => { this.netQuit = true; }; }
    this.mode = COURSE ? 'course' : WK ? 'workout' : GC ? 'gc' : BATTLE ? 'battle' : (S.mode || 'free');
    this.charts = charts;
    this.train = null; this.view = null;
    // (DDR II WORKOUT: an empty gauge doesn't end the song - Dolphin 2026-11-18, the gauge empty from 0:30, the song played on)
    if (!HP4 && WK && S.mode === 'workout') for (const p of this.ps) p.o = Object.assign({}, p.o, { gauge: 'no fail' });
    if (song.lesson) { this.mode = 'lesson'; for (const p of this.ps) { p.o = Object.assign({}, p.o, { gauge: 'no fail' }); if (!HP4) { p.showDiff = 1; p.lessonD2 = true; p.lessonCounts = [0, 0, 0, 0, 0]; } } }   // (DDR II: a lesson's panel and results say BASIC - Wii, Dolphin 2026-11-18)
    if (this.mode === 'training') {
      const tm = this.ps[0].timing;
      let r = TRAIN.speed / 100, A = TRAIN.from > 1 ? timeAtOff(tm, (TRAIN.from - 1) * 4096) : 0, B = TRAIN.to ? timeAtOff(tm, TRAIN.to * 4096) : Infinity, from = A, fade = 0;
      if (HP4) {
        // HP4 (main.dol 0x80024440): the steps from START BAR x 4096 (not before the first step's marker) to END
        // BAR x 4096 (not past the steps' end marker); 0x8003ea98 starts the music 2 measures before START BAR
        // (from the top when that's measure 1 or earlier), fading in over 1 s, at MUSIC SPEED x0.5 - x1.0
        const mk = this.marks || {}, st = (TRAIN.from - 1) * 4096, en = (TRAIN.to || 1e9) * 4096;
        A = timeAtOff(tm, Math.max(st, mk.steps || 0));
        B = mk.stepsEnd > 0 && en >= mk.stepsEnd ? Infinity : timeAtOff(tm, en);
        from = TRAIN.from - 1 - 2 >= 1 ? timeAtOff(tm, (TRAIN.from - 3) * 4096) : 0;
        fade = from > 0 ? 1 : 0;
        r = +S.musicSpeed || 1;
        // DANCE VIEW (next scene 0x1d): the song and the dance from START BAR to END BAR - no steps, judging or
        // gauge (Dolphin 2026-11-17: no arrows, the BAR counter counting 1, 2, 3 ... from START BAR)
        if (TRAIN.view) {
          A = timeAtOff(tm, st); B = TRAIN.to ? timeAtOff(tm, en) : Infinity; from = A; fade = 0; r = 1;
          this.view = { free: false, yaw: 0, pitch: 0, fov: 50, held: {}, swapAt: -1, last: 0, startBar: TRAIN.from };
        }
      }
      this.train = { rate: r, A, B, from, fade };
      for (const p of this.ps) {
        p.o = Object.assign({}, p.o, { gauge: 'no fail' });
        if (this.view) { p.notes = []; p.rows = []; p.hands = []; }
        p.notes = p.notes.filter(n => n.t >= A - 0.05 && n.t < B);       // just the section's steps
        p.rows = p.rows.filter(rw => rw.t >= A - 0.05 && rw.t < B);
        p.lastNoteT = Math.max(A, ...p.notes.map(n => n.endT || n.t));
        p.freezeTotal = p.notes.filter(n => n.endT !== undefined).length;
        p.den = SCORE_DEN * Math.max(1, p.rows.length + p.freezeTotal);
      }
      this.lastNoteT = Math.max(...this.ps.map(p => p.lastNoteT));
      this.endT = Math.min(this.endT, this.lastNoteT + 1.5);
    }
    if (COURSE && COURSE.i > 0 && COURSE.life[0] !== undefined) this.ps.forEach((p, i) => { p.life = COURSE.life[i]; });
    const mine = this.ps.filter(p => !p.remote && p.com === undefined);
    if (MCC && !(this.mode === 'free' && !this.team && !BATTLE && mine.length >= 1 && mine.length <= 2 && MCC.style === mccStyle())) MCC = null;
    // (the one streak: player 1's, or both players' in FRIENDSHIP / SYNC)
    if (MCC) mine.forEach((p, i) => { if (i === 0 || GROUP === 'sync' || GROUP === 'friend') { p.mccBase = MCC.total; p.mccRun = true; } });
    if (this.mode === 'maxcombo' && MC) this.ps.forEach((p, i) => { p.combo = MC.totals[i] || 0; p.maxCombo = p.combo; p.mcRun = true; });
    this.ended = null; this.saidReady = false; this.saidGo = false;
    for (const k in AUTO_HELD) delete AUTO_HELD[k];
    this.lastNoteT = Math.max(...this.ps.map(p => p.lastNoteT));
    this.endT = this.train ? Math.min(music.duration - 0.2, this.lastNoteT + 1.5) : Math.max(music.duration - 0.2, this.lastNoteT + 1.5);
    if (this.view) this.lastNoteT = this.endT = Math.min(music.duration - 0.2, this.train.B);     // (DANCE VIEW: to END BAR)
    return this;
  },
  enter() {
    this.ringAt = RING.parts ? performance.now() : undefined;
    // the opening's sound (0x80105318: sound 601 = SE_SYS_SHUTOPEN)
    if (RING.parts) sfx('SE_SYS_SHUTOPEN');
    this.bossSnd = false;
    // the combo performance's state (combo object, 0x800fcb90): per player the level reached (+8; 1000 =
    // done for the song), the opening run (counts good steps until the first break, then stops) and the
    // performance running now
    this.faceVal = 0;
    this.apl = { data: null, lv: this.ps.map(() => 0), run: this.ps.map(() => 0), alive: this.ps.map(() => true), last: this.ps.map(() => 0), cur: null };
    const style = this.song && this.song.tier;
    if (S.comboPerf !== 'off' && HP4 && !this.two && !this.hp && this.song && !this.song.lesson && !this.view) loadAppeal('slot:' + this.song.slot).then(d => { if (this.apl) this.apl.data = d; });
    else if (S.comboPerf !== 'off' && !HP4 && style >= 0 && style <= 3 && !this.two && !this.hp) loadAppeal(style).then(d => { if (this.apl) this.apl.data = d; });
    const ctx = audio();
    this.src = ctx.createBufferSource();
    this.src.buffer = this.music;
    this.gain = ctx.createGain();
    this.src.connect(this.gain).connect(ctx.destination);
    if (S.songOn === false) this.gain.gain.value = 0;     // SONG: OFF (steps and sounds only)
    this.lastTick = undefined;
    this.t0 = ctx.currentTime + 4.6;      // room for the song card before READY
    this.cardFx = null; this.cardCol = undefined; this.cardPlate = null; this.cardJack = null; if (HP4) CAE.load('gcu');
    Play.introOn = this.introOn = false;
    this.danceEnd = null;
    // the boss stage's opening (10 s: its three camera moves) plays first, before the song card
    // (Dolphin camtrace: the opening's travel runs 10 s and the song's starts at chart time 0, with the
    // tunnel, the dance and its first camera move; READY comes 0.3 s later - no card pause before it)
    if (this.stage && this.stage.bossIntro && !this.train) this.t0 = ctx.currentTime + 10;
    if (this.train) {                       // training: from measure A, at the chosen speed
      const tr = this.train;
      this.src.playbackRate.value = tr.rate;
      if (HP4) {                            // (the chart clock starts at the music's start point, 2 measures early)
        this.t0 = ctx.currentTime + 4.6 + (tr.A - tr.from) / tr.rate;    // (songTime = A + (now - t0) x rate = from at the music's start)
        this.src.start(ctx.currentTime + 4.6, Math.max(0, tr.from));
        if (tr.fade && this.gain && S.songOn !== false) { const gv = this.gain.gain, at = ctx.currentTime + 4.6, v = gv.value; gv.setValueAtTime(0, at); gv.linearRampToValueAtTime(v, at + tr.fade); }
        this.ticks = [];
      } else {
      this.t0 = ctx.currentTime + (this.train.again ? 1.5 : 4.6);
      this.src.start(this.t0, Math.max(0, tr.A));
      this.ticks = [];
      if (TRAIN.tick) for (const row of this.ps[0].rows) { const at = this.t0 + (row.t - tr.A) / tr.rate + outLatency(); if (at > ctx.currentTime) this.ticks.push(trainTick(ctx, at)); }
      }
    } else this.src.start(this.t0);
    this.quitHeld = 0;
    this.movie = this.song.custom ? (this.song.video && S.movies !== false ? new VideoMovie(this.song.video, this.song.videoStart || 0) : null)
               : this.song.movie && this.song.movie.sync && S.movies !== false && !(this.stage && this.stage.noDancer) ? new Movie(this.song.movie.file, { loop: !this.song.movie.sync }) : null;
    // the dancer (none for two Double players: no room)
    this.choreo = null;
    if (this.dance && S.dancer && !(this.two && this.lanes === 8)) {
      try { this.choreo = Dancer3D.prepare(this.dance, this.song.slot); } catch (e) { console.error('dancer', e); }
    }
  },
  // where the dancer stands: [centre x, top y, width]
  dancerSpot() {
    if (this.two) return [W / 2, 300, 300];
    if (this.lanes === 8) return [1100, 270, 330];
    return [900, 150, 440];
  },
  drawDancer(t) {
    if (!this.choreo) return;
    const bu = this.stage && this.stage.backUrls;
    if (bu && window.Dancer3D && Dancer3D.extrasFor !== bu.join('|') && !this.backLoading) { this.backLoading = true; Dancer3D.useExtras(bu).finally(() => { this.backLoading = false; }); }
    if (this.stage && this.stage.dancers && this.stage.dancers.length) return;     // Hottest Party's own dancers are on its stage
    if (this.stage && this.stage.noDancer) return;                                  // DDR II's video stage: just the monitor
    // like the game: a song with a video shows its video monitor, not a dancer
    // (also while the video is still loading, so the dancer doesn't flash up before it)
    if (this.movie && !this.movie.failed) return;
    const beat = this.danceBeat(t), end = this.danceEndBeat();
    let cv = null;
    // on DDR II's 3D stage the dancer stands in the stage, seen through the stage's camera
    const view = this.stage && this.stage.hp2 === 'ddr2' && this.stage.view;
    // the boss stage's opening: the S part's opening clip (600 frames over the 10 s), at the S part's
    // formation its cues never pick (the three side by side on the ground)
    let intro = null;
    // (the opening's clip is the S part's last one, the 600-frame clip whose hips are placed in the
    // stage - HP4U_053 has it third, HP4U_054 fourth, HP4U_055 sixth; the others are one-measure dance clips)
    const Spart = this.choreo.d && this.choreo.d.S, openClip = Spart && Spart.length ? Spart[Spart.length - 1] : null;
    const hp = openClip && openClip.Hips && openClip.Hips.p;
    if (view && this.stage.introT != null && hp && hp.length > 3 && hp[2] > 2) {
      const pt = this.choreo.part('S'), used = new Set(pt.fcues.map(c => c.k5));
      const form = pt.forms.find((f, i) => !used.has(i)) || null;
      intro = { clip: openClip, f: Math.min(143.99, this.stage.introT / 10 * 144), form };
    }
    // (HP4 0x80040354: while a performance runs only the performer is drawn, at the stage's origin - identity
    // placement - and the shared reference point (+0x41c +0x40) is the origin too; the backups aren't drawn)
    const ap = this.apl && this.apl.cur ? { clip: this.apl.cur.clip, f: Math.min(143.99, Math.max(0, (t - this.apl.cur.t0) / this.apl.cur.len * 144)), solo: !!(this.apl.data && this.apl.data.hp4) } : null;
    // the light show (DDR2_SPEC.md "the light show decoded"): while a combo performance runs the game
    // switches the dancers' ambient colour from the stage's (light preset 0 of the current variant) to
    // the table's clamp(C x F), at once, and back at the end. DDR II PC's own dancer takes that change
    // as the ratio of the two colours on its ambient term (the game's own dancers are not redrawn).
    let tint = null;
    if (ap && this.apl.data && this.apl.data.lights && this.stage && this.stage.data) {
      const L = this.apl.data.lights[this.apl.cur.type], amb = this.stage.data.dancerAmb || [];
      const base = amb[this.stage.variant || 0] || amb[0] || (this.stage.lshow ? this.stage.lshow.dancer() : null);
      if (L && base) tint = L.amb.map((v, k) => base[k] > 0 ? v / base[k] : 1);
    }
    // the dancer lighting switch (Options: DANCER LIGHTING): GAME STYLE lights DDR II PC's own dancer
    // the game's way - the stage's ambient colour for the current variant, swapped for the light
    // show's colour while a combo performance runs
    let ambG = null;
    const Lap = ap && this.apl.data && this.apl.data.lights ? this.apl.data.lights[this.apl.cur.type] : null;
    if (S.dancerLight === 'game' && Lap && this.stage && this.stage.lshow) {
      ambG = Lap.amb.map(v => v / 255);                             // (HP4: the performance's state 4 replaces the light show's)
    } else if (S.dancerLight === 'game' && this.stage && this.stage.lshow && this.stage.lshow.sh.period > 0) {
      ambG = this.stage.lshow.dancer().map(v => v / 255);          // (HP4's light-show stages: the lights' colours now)
    } else if (S.dancerLight === 'game' && this.stage && this.stage.data && this.stage.data.dancerAmb) {
      const amb = this.stage.data.dancerAmb, base = amb[this.stage.variant || 0] || amb[0];
      const L = ap && this.apl.data && this.apl.data.lights ? this.apl.data.lights[this.apl.cur.type] : null;
      const c = L ? L.amb : base;
      if (c) ambG = c.map(v => v / 255);
    }
    // (HP4: light 0's grey G - the light show's G (0x801002ac), or the performance's (0x8028c4d8 +4) while one
    // runs; GAME STYLE uses it as it is, DDR II PC's lights are scaled by performance G / the stage's G)
    const Gst = this.stage && this.stage.lshow ? this.stage.lshow.G : 1;
    const lightG = Lap && Lap.G != null ? Lap.G : Gst, lightGRatio = Lap && Lap.G != null && Gst > 0 ? Lap.G / Gst : 1;
    // the dancers' faces: the dance's expression cues (column 2/3), or the combo performance's face script
    // (0x802bee60 [alt][style][type]: value until frame, 60 a second) which also stops the blinking
    let face = null;
    if (view) {
      const fv = this.choreo.faceAt ? this.choreo.faceAt(beat, end) : null;
      if (fv != null) this.faceVal = fv;
      face = { val: this.faceVal || 0, lock: false };
      const sc = ap && this.apl.data && this.apl.data.faces && (this.apl.data.faces[this.apl.cur.alt || 0] || [])[this.apl.cur.type];
      if (sc && sc.length) {
        const fr = (t - this.apl.cur.t0) * 60;
        const e = sc.find(x => !x[1] || fr < x[1]) || sc[sc.length - 1];
        face = { val: e[0], lock: true };
      }
    }
    try { cv = Dancer3D.render(this.choreo, beat, end, view ? { view, secs: t, intro, appeal: ap, tint: ambG ? null : tint, lightMode: S.dancerLight, ambG, face, hp4: HP4, lightG, lightGRatio } : {}); } catch (e) { console.error('dancer', e); this.choreo = null; return; }
    if (!cv) return;
    if (view) { g.drawImage(cv, 0, 0, W, H); return; }
    const [cx, top, w] = this.dancerSpot(), h = w * cv.height / cv.width;
    // a soft floor shadow, then the dancer
    g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(cx, top + h * 0.885, w * 0.22, w * 0.045, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(cv, cx - w / 2, top, w, h);
  },
  leave() { if (this.cheer) { A.stopSfx(this.cheer.h, 1.5); this.cheer = null; } try { this.src.stop(); } catch (e) {} for (const o of this.ticks || []) { try { o.stop(); } catch (e) {} } this.ticks = []; if (this.movie) { this.movie.close(); this.movie = null; } },
  // song time for a context time; offset > 0 moves the arrows later
  songTime(ctxT) { return this.train ? this.train.A + (ctxT - outLatency() - this.t0) * this.train.rate - S.offset / 1000 : ctxT - outLatency() - this.t0 - S.offset / 1000; },
  now() { return this.songTime(actx.currentTime); },
  // the boss stage: READY comes 0.3 s after chart time 0 (Dolphin footage, 4 fps), 3.3 s later than
  // after a normal song's card
  bannerShift() { return this.stage && this.stage.bossIntro ? 3.3 : 0; },
  // where the dance is (in beats of its own tempo): a song's own dance (the fixed table) runs on the
  // chart's clock in seconds at the dance file's tempo (Dolphin camtrace, London EVOLVED Ver.C: the dance
  // controller's time = chart time, its camera moves change every 5 measures of 190.04 BPM while the
  // chart is at 170); the other dances follow the chart's beats
  danceEndBeat() {
    this.danceBeat(0);
    return this.danceEnd ? this.danceEnd.endBeat : this.danceBeat(this.lastNoteT);
  },
  danceBeat(t) {
    const d = this.dance, bpm = d && d.clock === 'seconds' && d.cues && d.cues.S && d.cues.S.cues && d.cues.S.cues[0] && d.cues.S.cues[0].bpm;
    if (bpm && this.choreo && this.choreo.beatAtSeconds) {
      // the ending: the dance's E part is placed to end with the song - at whole seconds of the chart's
      // last tempo point (0x8003d740 -> 0x80119de4: ticks / 150, a whole number) minus E's length; the
      // loop playing then is cut short (Dolphin camtrace: London EVOLVED Ver.C's E at 86.0 s, twice)
      const ch = this.choreo;
      if (!this.danceEnd) {
        // (the song's length: its song record +36 - main.dol's table, the length the game's schedule
        // holds at +448: Wings of an Angel 185, London EVOLVED 114, both checked in Dolphin memory; the
        // chart's last tempo point only when the record has none)
        const tsec = this.ps[0].timing.s || [], recLen = this.song && this.song.length > 0 ? this.song.length : 0;
        const songEnd = Math.floor(recLen || (tsec.length ? tsec[tsec.length - 1] : 0));
        const E = ch.d.E && ch.d.E.length ? ch.part('E') : null;
        // (0x80119f0c lays S and the loops end to end until a part would pass the song's end minus E's
        // length; that part stops before its first row past that point and E starts there - camtrace +
        // the merged table in memory: S, L01, L02 cut after 66 rows, E at 85.89 s)
        let eStart = Infinity;
        if (E) {
          const limit = songEnd - ch.partLen(E);
          let at = ch.partLen(ch.part('S'));
          for (let k = 0; k < 4000; k++) {
            if (k >= ch.loops.length) ch.reach(ch.loopsLen());
            const pt = ch.loops[k];
            if (!pt) { eStart = at; break; }
            const len = ch.partLen(pt);
            if (at + len <= limit) { at += len; continue; }
            const row = (pt.rows || []).find(r => at + r.t > limit);
            eStart = row ? at + row.t : at + len;
            break;
          }
        }
        const mE = isFinite(eStart) ? ch.beatAtSeconds(eStart) / 4 : Infinity;
        this.danceEnd = { eStart, EM: Math.floor(mE) + 1, endBeat: isFinite(mE) ? 4 * Math.floor(mE) : 1e9, E };
      }
      const de = this.danceEnd;
      if (de.E && t >= de.eStart) return 4 * (de.EM + ch.partMeasure(de.E, t - de.eStart));
      return ch.beatAtSeconds(t);
    }
    if (bpm) return Math.max(0, t) * bpm / 60;
    return this.ps[0].timing.offAt(t) / 1024;
  },
  // a pad action -> [dancer, lane]. VERSUS: each side is its own player. One player: both sides
  // play the same 4 lanes, or the two halves of a Double chart.
  route(a) {
    // CHOREOGRAPH's hand markers: player n's left / right hand (lanes 4 / 5)
    const h = /^P([1-4])H([LR])$/.exec(a);
    if (h) {
      const p = this.two ? this.ps[+h[1] - 1] : +h[1] <= 2 ? this.ps[0] : null, lane = h[2] === 'L' ? 4 : 5;
      return p && p.hands && p.hands.length && p.com === undefined && !p.remote && !handAuto(p, lane) ? [p, lane] : null;
    }
    const m = /^P([1-4])([LDUR])$/.exec(a);
    if (!m) return null;
    const side = +m[1] - 1, d = DIRS.indexOf(m[2]);
    if (this.team) return side < 2 ? [this.ps[0], d] : null;
    if (this.two && this.lanes === 8) return this.ps[side >> 1] && this.ps[side >> 1].com === undefined && !this.ps[side >> 1].remote ? [this.ps[side >> 1], (side & 1) * 4 + d] : null;   // 4 mats
    if (this.two) return side < this.ps.length && this.ps[side].com === undefined && !this.ps[side].remote ? [this.ps[side], d] : null;
    if (side > 1) return null;
    if (this.lanes === 8) return [this.ps[0], side * 4 + d];
    return [this.ps[0], d];
  },
  // TEAM: whose turn it is now - the owner of the next step still to be judged
  teamNow() {
    const rows = this.ps[0].rows; let i = this.teamPtr || 0;
    while (i < rows.length && rows[i].judged) i++;
    this.teamPtr = i;
    return i < rows.length ? rows[i].owner : rows.length ? rows[rows.length - 1].owner : 0;
  },
  // HP4's combo hit bursts (0x80089870 / 0x8008c2f4 / 0x8008bedc): effect bank 2 (GAME_CMN_<region> entry 0/7);
  // effect 0 at a combo of 50-99, 1 at 100+ (2 / 3 with 3 or 4 players, 0x8008c450), its colour set by the
  // judgment (MARVELOUS 0, PERFECT 1, GREAT 2, GOOD 3 - set_color 0x80160484), one per lane, a new one
  // replacing the lane's last. The lanes sit at x -62, -20.7, 20.7, 62 (hands -41.35, 41.35; table
  // 0x80258c20) on the step zone, in screen units - so 41.35 units = one lane here
  hp4HitFx(p, i, x0, lw, ry) {
    const X = this.hfx || (this.hfx = { live: [] });
    if (!X.req && window.TebFx) {
      X.req = true;
      api('/api/hp4bank2').then(j => {
        if (!j || !j.bank2) return;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const gl = c.getContext('webgl', { premultipliedAlpha: false, alpha: true });
        if (!gl) return;
        X.cv = c; X.gl = gl; X.fx = TebFx.create(gl, { bank2: j.bank2 });
      }).catch(() => {});
    }
    const Q = p.hitFxQ; p.hitFxQ = null;
    if (!X.fx) return;
    const OFF = [-62, -20.7, 20.7, 62, -41.35, 41.35], VAR = { 5: 0, 4: 1, 3: 2, 2: 3 };
    const k = lw / 41.35, cx = x0 + 2 * lw;
    const slot = X.slots || (X.slots = {});
    if (Q) for (const ev of Q) {
      const eff = (this.ps.length >= 3 ? 2 : 0) + (ev.combo >= 100 ? 1 : 0);
      for (const l of ev.lanes) {
        const key = i + ':' + l, old = slot[key];
        if (old) old.done = true;
        const M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, OFF[l] || 0, 0, 0, 1];
        const inst = X.fx.play(2, eff, M, { color: VAR[ev.j] || 0 });
        if (inst) { inst.px = { cx, ry, k }; slot[key] = inst; }
      }
    }
    // (drawn once a frame for every player's bursts, after the last player's lanes)
    if (i !== (this.team ? 1 : this.ps.length - 1)) return;
    const now = performance.now(), dt = X.last ? (now - X.last) / 1000 : 0; X.last = now;
    X.fx.update(Math.min(dt, 0.1));
    const all = X.fx.live.slice();
    if (!all.length) return;
    const gl = X.gl, V = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    // each burst with its own player's screen mapping (orthographic, y up, 1 unit = k pixels)
    for (const pass of ['blend', 'add']) {
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, pass === 'add' ? 1 : 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      for (const inst of all) {
        const m = inst.px; if (!m) continue;
        const VP = [2 * m.k / W, 0, 0, 0, 0, 2 * m.k / H, 0, 0, 0, 0, -1 / 20000, 0, 2 * m.cx / W - 1, 1 - 2 * m.ry / H, 0, 1];
        X.fx.live = [inst];
        try { X.fx.draw(VP, V, pass); } catch (e) { console.error('hit effect', e); X.fx = null; return; }
      }
      X.fx.live = all;
      g.save(); g.globalCompositeOperation = pass === 'add' ? 'lighter' : 'source-over'; g.drawImage(X.cv, 0, 0); g.restore();
    }
  },
  heldBy(p, l) {
    const hl = l >= 4 && this.lanes === 4;              // (single: lanes 4 / 5 are CHOREOGRAPH's hands)
    if (boardLive() && !isAuto(p)) { const n = p.holding.find(h => h.holding && h.lane === l), c = n ? boardCode(n, true) : -1; if (c >= 0 && Board.code(c)) return true; }
    if (isAuto(p) || (hl && handAuto(p, l))) return (AUTO_HELD[p.idx + ':' + l] || 0) > this.now();
    if (hl) { const k = l === 4 ? 'L' : 'R'; return this.two ? input.isDown(`P${p.idx + 1}H${k}`) : input.isDown('P1H' + k) || input.isDown('P2H' + k); }
    if (p.com !== undefined || p.remote) return p.holding.some(n => n.lane === l && (n.comHold || 0) > this.now());
    if (this.team) return input.isDown('P1' + DIRS[l % 4]) || input.isDown('P2' + DIRS[l % 4]);
    const d = DIRS[l % 4];
    if (this.two && this.lanes === 8) return input.isDown(`P${p.idx * 2 + (l < 4 ? 1 : 2)}${d}`);
    if (this.two) return input.isDown(`P${p.idx + 1}${d}`);
    if (this.lanes === 8) return input.isDown(`P${l < 4 ? 1 : 2}${d}`);
    return input.isDown('P1' + d) || input.isDown('P2' + d);
  },
  input(a, pressed, perf, menuKey) {
    if (DEMO.on) { if (pressed) endDemo(); return; }
    if (menuKey) return;
    // DANCE VIEW's camera (main.dol 0x800e9fa4 / 0x80055e48 / 0x80056800): A swaps FIXED CAMERA (the dance's own
    // camera moves) and FREE CAMERA; in FREE, B puts the camera back where it starts (0x80055e98)
    if (this.view) {
      const V = this.view;
      if (/^P1[LRUD]$|^P1H[LR]$/.test(a)) V.held[a] = pressed;
      if (pressed && a === 'START') { V.free = !V.free; V.swapAt = this.now(); if (V.free && !V.init) this.viewReset(); sfx('SE_SYS_DECIDE01'); return; }
      if (pressed && a === 'BACK' && V.free) this.viewReset();
      // (+) CAMERA A-D (0x80055fb4, in FREE only): the eye jumps to 65 from (0, 7, 0) along preset k of 0x80256f10 -
      // (46.8, 0, 45.2), (46.8, 0, -45.2), (-46.8, 0, -45.2), (-46.8, 0, 45.2) - fov back to 50; the D-pad turns it
      // from there. Dolphin 2026-11-17: A-D logged exactly at (+-46.8, 7.0, +-45.2). PC: SELECT (Space) = +.
      if (pressed && a === 'SWITCH' && V.free) {   // (Space; the input calls it SWITCH)
        V.preset = ((V.preset ?? -1) + 1) % 4; V.swapAt = this.now(); V.init = true;
        const pv = [[46.8, 45.2], [46.8, -45.2], [-46.8, -45.2], [-46.8, 45.2]][V.preset];
        V.yaw = Math.atan2(pv[0], pv[1]); V.pitch = 0; V.fov = 50; sfx('SE_SYS_SELECT01'); return;
      }
    }
    if (a === 'BACK') { this.quitHeld = pressed ? performance.now() : 0; return; }
    if (this.view) return;
    const r = this.route(a);
    // (the step calories watch every press and release on the mat - DDR II 0x80038374)
    if (r && r[0]) {
      const d = r[0], k = d.kcalSteps || (d.kcalSteps = new StepKcal()), hand = d.lanes === 4 && r[1] >= 4;
      if (!hand) { const id = KCAL_ID[r[1]]; if (id) { if (pressed) k.press(id, performance.now() / 1000); else k.release(id); } }
      else if (pressed) k.hand(weightLb(), this.kcalBpm());
    }
    if (!r || !pressed) return;
    if (this.team) { const side = +(/^P([1-4])/.exec(a) || [0, 1])[1] - 1; if ((this.lanes === 8 ? side >> 1 : side) !== this.teamNow()) return; }
    r[0].inputPress(r[1], this.songTime(ctxTimeAt(perf)));
  },
  kcalBpm() { const b = this.song && this.song.bpm; return Math.round((b && (b[0] || b[1])) || 150); },
  // DANCE VIEW's screen (traced 2026-11-17). Both layouts sit in GAME_CMN_US /0/6: /0/6/0 = the BAR counter -
  // '@dummy' (slides x 274 -> 159 over 24 frames, y 435, scale 0.8), MEASURE_wind_US (the window, 742 -> 542, y 66)
  // and Num_00 (the digit, 762 -> 562, y 71); /0/6/1 = the camera label (pictures FIXED CAMERA, FREE CAMERA,
  // CAMERA (A)-(D); part 0 the old label sliding out left, part 1 the new one in, 10 frames). The label hangs on the
  // counter layout's '@dummy' part (the anchor: same slide-in, its x / y / scale). The Wii draws this screen
  // anamorphic in 16:9: a layout x of 0-640 spreads over the 854-wide screen, pictures keep their size (Dolphin's
  // memory copy: the window's on-screen box 463-621 x 31-101; the video: window centre 722 / 854, label 212).
  // The digits: 0x800eebc4 (3 digits, leading zeros in colour 0x80808080 = grey at half alpha, DAT_802576ac),
  // the comAF /0/0/0 pictures, drawn by the shared 9-digit number layout (memory copy: block 0x920c1060, nine
  // Num_00 parts, the first at 0 and each next one its child at x -18, -36 ... - a child's offset isn't spread by
  // the 16:9 stretch, so the digits are 18 apart on screen) placed at the counter's Num_00.
  // Hints (comAF): FIXED - 38 FREE CAMERA; FREE - 39 FIXED CAMERA, 40 RESET, 41 SCROLL / 42 ZOOM IN, 43 ZOOM OUT,
  // 48-51 CAMERA A-D (the next one); right edge 800 of 854, rows y 443 / 460.
  drawView(t) {
    const V = this.view;
    if (!V.t0) V.t0 = performance.now();
    // (PC: the keys for the Wii buttons the game's hints show - A = Enter, B = Esc, + = Space, 1 / 2 = Z / X)
    { const s = V.free ? 'Enter: fixed camera    Arrows: turn    Z / X: zoom in / out    Space: camera A-D    Esc: reset (hold to quit)'
        : 'Enter: free camera    hold Esc: quit';
      g.save(); g.globalAlpha = 0.85; text(s, W / 2, 712, 14, '#ffffff', 'center', 'normal'); g.restore(); }
    const f = (performance.now() - V.t0) / 1000 * 30;
    const X = x => x * 854 / 640 * 1.5, Y = y => y * 1.5, U = 1.5;
    const tm = this.ps[0].timing, bar = Math.max(1, Math.floor(tm.offAt(Math.max(this.train.A, t)) / 4096) + 1);
    const B = CAE.block('gcu', 12);
    let anchor = null;
    if (B && B.parts) {
      const st = i => CAE.at(B.parts[i], 0, Math.min(f, 30));
      anchor = st(0);
      const w = st(1), nm = st(2), pw = CAE.pic('gcu', B.node, B.parts[1].sprite);
      if (w && pw) { g.save(); g.globalAlpha = (w.alpha ?? 255) / 255; g.drawImage(pw, X(w.x) - w.px * U, Y(w.y) - w.py * U, pw.width * U, pw.height * U); g.restore(); }
      if (nm && A.digits) {
        const s3 = String(Math.min(999, bar)).padStart(3, '0'), a0 = (nm.alpha ?? 255) / 255;
        let lead = true;
        for (let k = 0; k < 3; k++) {
          let d = A.digits[+s3[k]];
          if (!d) continue;
          lead = lead && s3[k] === '0' && k < 2;
          g.save(); g.globalAlpha = a0 * (lead ? 0x80 / 255 : 1);
          if (lead) d = caeTint(d, Array(12).fill(0x80));
          g.drawImage(d, X(nm.x) - ((2 - k) * 18 + nm.px) * U, Y(nm.y) - nm.py * U, 28 * U, 28 * U);
          g.restore();
        }
      }
    }
    const L = CAE.block('gcu', 13);
    if (L && L.parts && anchor) {
      if (!this.viewLabelPics) { this.viewLabelPics = []; A.tplOf('gcu', L.node + '/0/0').then(tt => { this.viewLabelPics = tt.map(x => x.canvas); }).catch(() => {}); }
      const P = this.viewLabelPics, cur = !V.free ? 0 : V.preset >= 0 ? 2 + V.preset : 1, sw = V.swapAt >= 0 ? (t - V.swapAt) * 30 : 99;
      const sc = anchor.sx ?? 1, aa = (anchor.alpha ?? 255) / 255;
      const drawL = (k, part, fr) => {
        const s0 = CAE.at(L.parts[part], 0, fr), im = P[k];
        if (!s0 || !im) return;
        g.save(); g.globalAlpha = aa * (s0.alpha ?? 255) / 255;
        g.drawImage(im, X(anchor.x + s0.x * sc) - s0.px * sc * U, Y(anchor.y + s0.y * sc) - s0.py * sc * U, im.width * sc * U, im.height * sc * U);
        g.restore();
      };
      if (sw < 10 && V.prevLabel !== undefined && V.prevLabel !== cur) { drawL(V.prevLabel, 0, sw); drawL(cur, 1, sw); } else drawL(cur, 1, 10);
      if (sw >= 10 || V.prevLabel === undefined) V.prevLabel = cur;
    }
    const rows = V.free ? [[39, 40, 41], [42, 43, 48 + ((V.preset ?? -1) + 1) % 4]] : [[38]];
    rows.forEach((row, ri) => {
      let hx = 800;
      for (const k of row.slice().reverse()) {
        const h = A.hints && A.hints[k];
        if (!h) continue;
        hx -= h.width;
        g.drawImage(h, hx * U, (443 + ri * 17) * U - h.height * 0.75, h.width * U, h.height * U);
        hx -= 4.5;
      }
    });
  },
  // FREE CAMERA's start (0x80055e98): looking at (0, 7, 0) from 65 in front (DAT_802b6be4 / 6be8), fov 50 (6bec)
  viewReset() { const V = this.view; V.init = true; V.yaw = 0; V.pitch = 0; V.fov = 50; V.preset = -1; },
  // FREE CAMERA each frame (0x80056800): the D-pad turns the eye round (0, 7, 0) by 2 degrees a frame (DAT_802b6bf0
  // / 6bf4) - up / down only while the eye is at most 71 / at least 8 high (6bfc / 6bf8); 1 / 2 take the field of
  // view 2 a frame (6c00) down to 20 / up to 80 (6c08 / 6c04). The distance stays 65.
  viewCam(dt) {
    const V = this.view, k = Math.min(4, dt * 60), D = 0.03491 * k, h = V.held;
    const eyeAt = (yaw, pitch) => [65 * Math.cos(pitch) * Math.sin(yaw), 7 + 65 * Math.sin(pitch), 65 * Math.cos(pitch) * Math.cos(yaw)];
    if (h.P1L) V.yaw += D;
    if (h.P1R) V.yaw -= D;
    const y = eyeAt(V.yaw, V.pitch)[1];
    if (h.P1U && !h.P1D && y <= 71) V.pitch = Math.min(Math.PI / 2 - 0.01, V.pitch + D);
    if (h.P1D && !h.P1U && y >= 8) V.pitch -= D;
    if (h.P1HL) V.fov = Math.max(20, V.fov - 2 * k);
    else if (h.P1HR) V.fov = Math.min(80, V.fov + 2 * k);
    const ls = this.stage && this.stage.leadSpot || [0, 0, 12], e = eyeAt(V.yaw, V.pitch);
    // (the PC draws the lead at the origin and the stage moved by -leadSpot: the game's points move the same way)
    return { eye: [e[0] - ls[0], e[1] - ls[1], e[2] - ls[2]], at: [-ls[0], 7 - ls[1], -ls[2]], roll: 0, fov: V.fov, near: 1, far: 5000 };
  },
  fadeOut() {
    try { this.gain.gain.setTargetAtTime(0, actx.currentTime, 0.6); } catch (e) {}
    if (this.cheer) { A.stopSfx(this.cheer.h, 2); this.cheer = null; }
  },
  // The crowd (main.dol 0x80026b10, the song's sound step): at READY the crowd cheers (SE_DDR_CHEER01, looped)
  // for 6 s then fades out over 5 s; it's quiet from HERE WE GO for 7 measures. After that, on a step that
  // left a player's gauge over 700 or combo over 12 it cheers (CHEER02, looped, 6 s), or on one that left
  // the gauge under 200 it boos (CHEER03) - then at least 17 measures until the next. A cleared song ends
  // with the crowd cheering. VOICE: OFF = no crowd, NO BOOING = no boos.
  crowd(what) {
    const t = this.now(), v = S.voice;
    const on = v !== false && !DEMO.on && A.ready && this.mode !== 'lesson';
    const play = (name, dur, loop) => {
      if (this.cheer) A.stopSfx(this.cheer.h, 0.4);
      const h = { srcs: [] };
      A.playSfx(name, 1, { loop, handle: h });
      this.cheer = { h, until: dur > 0 ? t + dur : Infinity };
    };
    const pos = () => this.ps[0].timing.offAt(Math.max(0, t));
    if (what === 'ready') { if (on) play('SE_DDR_CHEER01', 6, true); return; }
    if (what === 'go') { if (this.cheer) { A.stopSfx(this.cheer.h, 5); this.cheer = null; } this.crowdNext = 7 * 4096; return; }
    if (what === 'end') { if (on) play('SE_DDR_CHEER02', 0, true); return; }
    // every frame: the looped cheer's time runs out, then the crowd reacts to this frame's steps
    if (this.cheer && t > this.cheer.until) { A.stopSfx(this.cheer.h, 5); this.cheer = null; }
    let ev = 0;
    for (const p of this.ps) { ev |= p.crowdEv || 0; p.crowdEv = 0; }
    if (!ev || this.ended || this.crowdNext === undefined || t < 0 || pos() < this.crowdNext) return;
    if (ev & 1) { if (on) { play('SE_DDR_CHEER02', 6, true); this.crowdNext = pos() + 17 * 4096; } }
    else if (on && v !== 'noboo' && this.ps.some(p => !p.failed)) { play('SE_DDR_CHEER03', 0, false); this.crowdNext = pos() + 17 * 4096; }
  },
  update() {
    if (this.ps) { const t = performance.now() / 1000, kg = weightLb(), bpm = this.kcalBpm(); for (const p of this.ps) if (p.kcalSteps) p.kcalSteps.tick(t, kg, bpm); }
    const t = this.now();
    for (const p of this.ps) {
      if (isAuto(p)) {
        for (const n of p.notes) {
          if (n.t > t) break;
          if (!n.done) { AUTO_HELD[p.idx + ':' + n.lane] = n.endT !== undefined ? n.endT : 0; p.press(n.lane, n.t); }
        }
      } else if (p.hands && p.hands.length && p.com === undefined && !p.remote) {
        // CHOREOGRAPH: a hand set to AUTO is played for you (the game: "When the Nunchuk is not used, its
        // notes are auto-played" - SELECT DANCE's explanation, select_bin /14/5)
        for (const n of p.hands) {
          if (n.t > t) break;
          if (!n.done && handAuto(p, n.lane)) { AUTO_HELD[p.idx + ':' + n.lane] = n.endT !== undefined ? n.endT : 0; p.press(n.lane, n.t); }
        }
      }
      if (p.com !== undefined) comStep(p, t);
      if (p.ghostEv) ghostStep(p, t);
      if (p.remote) onlineRemoteStep(p, t);
      p.update(t, l => this.heldBy(p, l));
    }
    if (!this.saidReady && t - this.bannerShift() > -3.0) { this.saidReady = true; sfx('VO_NAR_INGAMEREADY'); this.crowd('ready'); }
    if (!this.saidGo && t > -1.3) { this.saidGo = true; sfx('VO_NAR_INGAMEHEREWEGO'); this.crowd('go'); }
    this.crowd('step');
    // METRONOME (0x80026b10): a tick on every beat, the first beat of each measure its own sound
    if (S.metronome && !this.ended && A.ready) {
      const bt = Math.floor(this.ps[0].timing.offAt(Math.max(0, t)) / 1024);
      if (t >= 0 && this.lastTick !== undefined && bt > this.lastTick) A.playSfx(bt % 4 === 0 ? 'SE_DDR_METRONOME01' : 'SE_DDR_METRONOME02');
      this.lastTick = bt;
    }
    // (held BACK quits: a lesson goes back to SELECT LESSON, everything else to the song list)
    if (this.quitHeld && performance.now() - this.quitHeld > 800) { go(this.mode === 'lesson' ? LessonSel : Select); return; }
    // the song stops when every player has failed, or after the last step
    if (!this.ended && this.ps.filter(p => p.com === undefined && !p.remote).every(p => p.failed && t - p.failAt > 0.2)) { this.ended = { kind: 'failed', at: t }; this.fadeOut(); }
    if (!this.ended && t > this.lastNoteT + 0.6) {
      this.ended = { kind: 'finish', at: t };
      if (this.ps.some(p => !p.failed) && !this.view) this.crowd('end');
      if (this.ps.some(p => p.fullCombo()) && !this.view) sfx('SE_DDR_FULLCOMBO');
    }
    if (this.ended && !this.ended.faded && t - this.ended.at > 2.2) { this.ended.faded = true; this.fadeOut(); }
    // HP4 training: after the section the game goes back to the TRAINING MENU (scene manager: play type 6 -> scene 0x10)
    if (this.train && HP4 && ((this.ended && t - this.ended.at > 3.6) || t > this.endT + 1)) { try { this.src.stop(); } catch (e) {} go(TrainSet); return; }
    if (this.train && !HP4 && TRAIN.repeat && this.ended && t - this.ended.at > 1.2) {     // training: the section again
      try { this.src.stop(); } catch (e) {}
      const again = Play.with(this.song, this.charts.map(c => Object.assign({}, c)), this.music, this.dance);
      again.stage = this.stage; again.train.again = true; go(again); return;
    }
    if ((this.ended && t - this.ended.at > 3.6) || t > this.endT + 1) { if (DEMO.on) return endDemo(); go(Results.with(this)); }
  },
  // The combo performance, each frame (main.dol 0x800fcdc8). Per player: the opening run (+0x5832c)
  // counts good steps until the first break and then stays put; the depth (+52) is 1 for the option's
  // "50" (the only depth the dumps showed). Only up to 85% of the song's measures (+0x301094 against
  // +0x301090) and one at a time:
  //   run broken (run > combo) after a level was reached -> type 4 (the break), then none for the song;
  //   level 0, depth >= 1, run >= 50 -> type 0; level 1, depth >= 2, run >= 100 -> type 1;
  //   level 2, depth >= 3, run >= 200 -> type 2, again at 400, 600, ...
  // A performance plays the lead's motion clip type x 2 (+1 for flagged dancers) and the camera move of
  // the same number, and ends when the motion has played out (0x800fd3c8: dancer +148 = 2).
  appealStep(t) {
    const A = this.apl;
    if (!A || !A.data || !this.stage || this.stage.hp2 !== 'ddr2' || !this.choreo) return;
    // (the player block's +52 is the chart's difficulty, 0 BEGINNER .. 4 CHALLENGE - written with the level at
    // +48 by 0x800339f4: so no performance on BEGINNER, the 100 one from DIFFICULT, the 200 ones from EXPERT)
    const diffIdx = p => ({ 4: 0, 1: 1, 2: 2, 3: 3, 6: 4 })[p.diff] || 0;
    // (HP4: the performance's own stage models, built once the data is in)
    if (A.data.hp4 && A.data.stg && this.stage.addAplStage) this.stage.addAplStage(A.data.stg, 'slot:' + (this.song && this.song.slot));
    if (A.cur) {
      const u = (t - A.cur.t0) / A.cur.len;
      if (u >= 1 || u < 0) { A.cur = null; this.stage.appealCam = null; this.stage.aplStage = null; if (this.stage.fx) this.stage.fx.hideBanks = null; }
      else {
        const cam = A.data.cams[A.cur.idx];
        this.stage.appealCam = cam ? { cam, f: (t - A.cur.t0) * 60 } : null;
        // (HP4 0x8004dc7c / 0x8004bdc0: the stage gives way to model 0x80256a34[type] of GAME_APL_STGnn, and the
        // stage's own spot effects are hidden, 0x8004adb0)
        if (A.data.hp4) {
          const k = (A.data.stgOf || [])[A.cur.type];
          this.stage.aplStage = A.data.stg && A.data.stg[k] ? { k, f: (t - A.cur.t0) * 60 } : null;
          if (this.stage.fx) this.stage.fx.hideBanks = [1, 5];
        }
      }
    }
    if (t < 0 || this.ended) return;
    const tm = this.ps[0].timing;
    const meas = Math.floor(tm.offAt(t) / 4096), total = Math.floor(tm.offAt(this.lastNoteT) / 4096);
    let ev = null;
    this.ps.forEach((p, i) => {
      if (A.alive[i]) { if (p.combo < A.last[i]) A.alive[i] = false; else A.run[i] = p.combo; }
      A.last[i] = p.combo;
      if (A.lv[i] >= 1000 || meas > Math.floor(total * 85 / 100)) return;
      const run = A.run[i];
      if (run > p.combo) { if (A.lv[i] > 0 && !ev) ev = [i, 4]; A.lv[i] = 1000; return; }
      const lv = A.lv[i];
      // (HP4 0x800ecc70: the same, but from level 2 on every 100 - 200, 300, 400 ...)
      const need = lv === 0 ? [1, 50, 0] : lv === 1 ? [2, 100, 1] : [3, A.data.hp4 ? lv * 100 : lv === 2 ? 200 : (lv - 1) * 200, 2];
      if (diffIdx(p) >= need[0] && run >= need[1]) { if (!ev) ev = [i, need[2]]; A.lv[i]++; }
    });
    if (ev && !A.cur) {
      const lead = ((Dancer3D.customFor || '').match(A.data.hp4 ? /ddr2char\/(\d{2,3})\// : /ddr2char\/(\d{3})\//) || [])[1];
      const alt = lead && A.data.alt ? A.data.alt[lead] || 0 : 0;
      const idx = ev[1] * 2 + alt, c = A.data.clips[idx];
      if (c && c.bones) {
        A.cur = { type: ev[1], idx, alt, t0: t, len: c.frames / 60, clip: c.bones };
        // (HP4 0x800ecff4: a type 2 performance also starts the screen ripple, 0x800ebf70 - after a wait of 120
        // frames for style 0, 100 for style 2, 102 for styles 1 / 3 (72 for flagged dancers), it runs 30 frames;
        // only when none is running)
        if (A.data.hp4 && ev[1] === 2) {
          const X = this.aplFx || (this.aplFx = {}), st = A.data.style;
          if (!(X.ripWait > 0) && !(X.ripLeft > 0)) { X.ripWait = st === 1 || st === 3 ? (alt ? 72 : 102) : st === 2 ? 100 : 120; X.ripLeft = 30; }
        }
        // the stage effects (0x800535f0): bank 3 effect A[style][clip], then B[style][type], at the
        // stage's origin (no spot); the set is the song's style (movie manager +0x10000 - 20440: 0 for
        // Wings of an Angel, 1 for a style-1 song in the dumps)
        const fx = this.stage.fx, D = A.data;
        if (fx && D.bank3) {
          fx.addBank(3, D.bank3);
          for (const e of [D.effA && D.effA[idx], D.effB && D.effB[ev[1]]]) if (e >= 0) fx.play(3, e, null, { tag: 'apl' });
        }
      }
    }
  },
  // HP4's two screen effects of the combo performance (the play screen's effect object, 0x800eb8e8; drawn after the
  // 3D scene and before the step zone, 0x80040354):
  // - the afterimage (0x800ebd84 / 0x800ebe0c / 0x800ebe8c): every frame of a performance the screen is copied; when
  //   it ends (0x800ed164 -> 0x800ebcf8(20)) that last picture lies over the play view and fades out over 20
  //   frames (alpha 255 x left / 20, one less each 60th of a second);
  // - the ripple (0x800ec020 / 0x800ec074 / 0x800ec110): after its wait, for 30 frames the screen is copied and drawn
  //   back through game/effmask.tpl (rings), on a square of 2560 x u game units (u = 1 - (left mod 30) / 30) round the
  //   screen's middle; the copy is read twice, shifted by +d and -d (d = 0.04 x (1 - u^2) of the picture) and
  //   averaged (TEV: copy x vertex colour, then half each), its alpha the mask's (vertex colour ffffffff), blended
  //   by alpha
  aplScreenFx(t) {
    const X = this.aplFx || (this.aplFx = {}), A = this.apl;
    const n = Math.max(0, Math.min(10, X.lastT === undefined ? 0 : (t - X.lastT) * 60));
    X.lastT = t;
    const live = !!A.cur;
    const grab = cv => { cv.width = W; cv.height = H; const q = cv.getContext('2d'); q.clearRect(0, 0, W, H); q.drawImage(g.canvas, 0, 0, W, H); return cv; };
    // (0x800ebe0c then 0x800ec020 / 0x800ebe8c / 0x800ec074 / 0x800ec110, then 0x800ebd84 at the end of the frame)
    if (X.fadeLeft > 0) X.fadeLeft = Math.max(0, X.fadeLeft - n);
    const ripOn = X.ripWait <= 0 && X.ripLeft > 0;
    if (ripOn) X.ripCap = grab(X.ripCap || document.createElement('canvas'));
    if (X.fadeLeft > 0 && X.snap) { g.globalAlpha = Math.floor(255 * X.fadeLeft / 20) / 255; g.drawImage(X.snap, 0, 0, W, H); g.globalAlpha = 1; }
    if (X.ripWait > 0) X.ripWait = Math.max(0, X.ripWait - n);
    else if (X.ripLeft > 0) X.ripLeft = Math.max(0, X.ripLeft - n);
    if (X.ripWait <= 0 && X.ripLeft > 0 && X.ripCap) {
      if (!HP4_EFFMASK) {
        HP4_EFFMASK = { img: null };
        fetch('/api/hp4effmask').then(r => r.ok ? r.blob() : null).then(b => b && createImageBitmap(b)).then(im => {
          if (!im) return;
          const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          const q = c.getContext('2d'); q.drawImage(im, 0, 0);
          const px = q.getImageData(0, 0, c.width, c.height);
          for (let i = 0; i < px.data.length; i += 4) { px.data[i + 3] = px.data[i]; px.data[i] = px.data[i + 1] = px.data[i + 2] = 255; }   // (I8: alpha = intensity)
          q.putImageData(px, 0, 0); HP4_EFFMASK.img = c;
        }).catch(() => {});
      }
      const mk = HP4_EFFMASK.img;
      if (mk) {
        const u = 1 - (Math.floor(X.ripLeft) % 30) / 30, d = 0.04 * (1 - u * u), sz = 2560 * u * W / 854;
        const R = X.ripC || (X.ripC = document.createElement('canvas'));
        R.width = W; R.height = H;
        const q = R.getContext('2d');
        q.drawImage(X.ripCap, -d * W, -d * H, W, H);
        q.globalAlpha = 0.5; q.drawImage(X.ripCap, d * W, d * H, W, H); q.globalAlpha = 1;
        q.globalCompositeOperation = 'destination-in';
        q.drawImage(mk, W / 2 - sz / 2, H / 2 - sz / 2, sz, sz);
        q.globalCompositeOperation = 'source-over';
        g.drawImage(R, 0, 0);
      }
    }
    if (live) { X.snap = grab(X.snap || document.createElement('canvas')); X.wasLive = true; }
    else if (X.wasLive) { X.wasLive = false; X.fadeLeft = 20; }
  },
  // before READY the song's card flies out of the video screen like the game's: it starts tiny at
  // the screen's top-left, tumbles up and round in an arc (white back first, flipping to the
  // front), lands over the bottom-right of the screen with a slight tilt, and stays until READY ends
  // HP4's song card: GAME_CMN_US.bin /0/4 (CAE block 10) - track 0 brings it in (51 frames: white blocks
  // fly in, the stand forms, the jacket drops on), it stays through READY, track 1 takes it out (26 frames).
  // The game fills its placeholders: picture 0 = the song's jacket, 1 / 3 = its name plate (title + artist)
  // and the plate's reflection. The stand's colour: one of block 11's 10 colours (/0/5: orange, purple,
  // pink, yellow, cyan, green, blue, dark grey, light grey, sky blue) at random each play - the same song
  // came up green and blue on the Wii. Placed by the screenshots: the jacket's middle at 78.6% of the
  // width (measured before the 3D camera was found - no longer used).
  drawHp4Card(t) {
    const B = CAE.block('gcu', 10), pal = CAE.block('gcu', 11);
    if (!B || !B.parts) return false;
    const k = t + 4.6, fin = 51, outLen = 26, outAt = -0.9;
    if (k < 0.25 || t > outAt + outLen / 30) return true;
    const n = t < outAt ? 0 : 1, f = n === 0 ? Math.min(fin, (k - 0.25) * 30) : (t - outAt) * 30;
    if (this.cardCol === undefined) {
      const cols = pal && pal.parts ? pal.parts.map(p => { const c = Array(12).fill(255); for (const [, nm, v] of p.tracks[0].script) if (typeof nm === 'number' && nm >= 40 && nm <= 51) c[nm - 40] = v; return c; }) : [];
      // (the game's own pick, 0x800cebfc: rand() % 10 -> that colour's 4 corners (0x8015d434) onto the
      // stand's parts 6, 7, 8 (0x8015ce14). rand() = 0x80119d10, state * 0x41c64e6d + 12345, 15 bits from
      // bit 16; srand at start-up (0x8012aca4) from the clock: seconds + minutes + hours + ms + µs)
      this.cardCol = cols.length ? cols[hp4Rand() % 10 % cols.length] : null;
    }
    const jk = texture('jacket', this.song.jacket), ti = texture('title', this.song.title);
    const plate = this.cardPlate || (ti.img ? (this.cardPlate = (() => {
      const c = document.createElement('canvas'); c.width = 232; c.height = 42; const q = c.getContext('2d');
      const sc = Math.min(232 / ti.img.width, 42 / ti.img.height); q.drawImage(ti.img, (232 - ti.img.width * sc) / 2, (42 - ti.img.height * sc) / 2, ti.img.width * sc, ti.img.height * sc);
      return c; })()) : null);
    const jack = this.cardJack || (jk.img ? (this.cardJack = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; c.getContext('2d').drawImage(jk.img, 0, 0, 256, 256); return c; })()) : null);
    // (drawn the game's 3D way: CAE.draw3d - the layout camera, the parts' turns and depth, the reflections masked)
    // (16:9: 0x800ceb38 moves the whole card by +75 layout units (0x802b744c) through 0x8015c380 - or -75
    // (0x802b7448) when the play info's +4 is 8 and its +16 isn't 0, 3 or 4; in 4:3 it stays put)
    const ox = 75;
    CAE.draw3d('gcu', 10, n, f, {
      pic: (i, p) => p.sprite === 0 ? jack : (p.sprite === 1 || p.sprite === 3) ? plate : null,
      state: (i, p, st) => { if (st.col && this.cardCol) st.col = this.cardCol; st.ox = ox; },
    });
    return true;
  },
  drawSongCard(t) {
    // (the boss stage: the card and the footprints come at the start of its opening, over the island,
    // and the card is gone when the night shot begins - Dolphin footage)
    const boss = this.stage && this.stage.bossIntro;
    const k = boss ? t + 10 : t + 4.6;      // seconds since the song screen came up
    if (k < 0.25) return;
    // (DDR II: the card is gone when READY comes up - Wii, STEP LESSON 1: card with the inner footprints, none with READY)
    const f = clamp((k - 0.25) / 1.1), out = boss ? clamp((k - 2.7) / 0.3) : !HP4 ? clamp((t + 3.25) / 0.3) : clamp((t + 1.4) / 0.3);
    const ease = v => 1 - Math.pow(1 - v, 3), e = ease(f);
    const solo = !(this.two || this.lanes === 8);
    // the screen the card comes out of (the video monitor's place) and where it lands
    const sx0 = solo ? 600 : W / 2 - 120, sy0 = solo ? 215 : 260;
    const ex = solo ? 900 : W / 2 + 120, ey = solo ? 420 : 430;
    // a curved path: out of the screen, up over the top, round and down onto its spot
    const c1x = solo ? 920 : W / 2 + 100, c1y = 40, c2x = solo ? 1140 : W / 2 + 330, c2y = 150;
    const bz = (a, b, c, d, u) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
    const cx = bz(sx0, c1x, c2x, ex, e), cy = bz(sy0, c1y, c2y, ey, e);
    const sc = 0.04 + 0.96 * ease(clamp(f * 1.25)), rot = -0.9 * (1 - e) - 0.12;
    const flip = Math.cos(Math.PI * (1 - clamp(f * 1.15)));        // -1 = back, 1 = front
    const sz = 210, w = sz + 50, h = sz + 84, r = 30, x = -w / 2, y = -h / 2;
    const jk = texture('jacket', this.song.jacket), ti = texture('title', this.song.title);
    g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(sc * Math.max(0.04, Math.abs(flip)), sc);
    g.globalAlpha = 1 - out;
    const rr = (x0, y0, ww, hh) => { g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, r) : g.rect(x0, y0, ww, hh); };
    // thickness: the card's darker side
    g.fillStyle = '#8a1aa8'; rr(x + 10, y + 12, w, h); g.fill();
    if (flip < 0) {                                   // the back: white with a pink rim
      g.fillStyle = '#e255f0'; rr(x, y, w, h); g.fill();
      g.fillStyle = '#ffffff'; rr(x + 10, y + 10, w - 20, h - 20); g.fill();
    } else {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f27af5'); gr.addColorStop(1, '#c42fe0');
      g.fillStyle = gr; rr(x, y, w, h); g.fill();
      g.fillStyle = '#ffffff'; rr(x + 8, y + 8, w - 16, h - 16); g.fill();
      g.fillStyle = gr; rr(x + 14, y + 14, w - 28, h - 28); g.fill();
      const jx = -sz / 2 - 6, jy = y + 18;
      g.fillStyle = '#000'; g.fillRect(jx - 4, jy - 4, sz + 8, sz + 8);
      if (jk.img) g.drawImage(jk.img, jx, jy, sz, sz);
      if (ti.img) { const s2 = Math.min(1, (w - 30) / ti.img.width); g.drawImage(ti.img, -ti.img.width * s2 / 2, jy + sz + 6, ti.img.width * s2, ti.img.height * s2); }
      else text(this.song.name.slice(0, 24), 0, jy + sz + 26, 17, '#fff', 'center');
    }
    g.restore(); g.globalAlpha = 1;
  },
  // where each player's lanes go
  layout() {
    if (this.lanes === 8 && this.two) return [{ lw: 66, x0: 40 }, { lw: 66, x0: W - 40 - 8 * 66 }];
    // DOUBLE: 8 lanes of the layout's 64 (96 px) about the screen's middle - the step zone at 170.7-682.7 of 853.3
    // (FIFO log of a DOUBLE demo, fifo_ddr2_double.dff)
    if (this.lanes === 8) return [{ lw: 96, x0: W / 2 - 4 * 96 }];
    if (this.hp && !this.two) return [{ lw: 94, x0: 199 }];
    if (this.hp) return [{ lw: 90, x0: 60 }, { lw: 90, x0: W - 60 - 4 * 90 }];
    if (!this.two) return [{ lw: 96, x0: 92 }];
    // 3 and 4 players (Wii 4-player screenshot, NORMAL): the fields 23.8% of the screen apart, centred at
    // 14.4 / 38.1 / 62.0 / 85.6% of the width, each field 16.6% wide. (3 players: not seen yet - spread
    // the same way over three places, PROVISIONAL)
    // (field centres from METER_MULTI_US.bin's layout; field widths measured: 4 players 16.6% of the
    // screen, 3 players 20.6%)
    if (this.ps.length > 2 && GROUP && GROUP !== 'family' && partyLayout()) return this.ps.map(() => ({ lw: 96, x0: W / 2 - 2 * 96 }));
    if (this.ps.length > 2) {
      // (4 players, HP4: lanes 35.2 of the 853.3-unit screen - the layout's 64 at 0.55 - FIFO log)
      // (3 players, HP4: 44.8 - the layout's 64 at 0.7)
      const n = this.ps.length, lw = HP4 ? W * (n > 3 ? 35.2 : 44.8) / (640 * 4 / 3) : W * (n > 3 ? 0.166 : 0.206) / 4, L = multiLayout(n);
      const cx = L && L.fields.length === n ? L.fields.map(f => f.x / 640) : n > 3 ? [0.144, 0.381, 0.620, 0.856] : [0.172, 0.5, 0.828];
      return this.ps.map((p, i) => ({ lw, x0: W * cx[i] - 2 * lw }));
    }
    return [{ lw: 96, x0: 92 }, { lw: 96, x0: W - 92 - 4 * 96 }];
  },
  draw(t0) {
    const t = this.now();
    // background: the song's video (or a background loop), else the game's gameplay backdrop
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const fr = this.movie && !this.movie.failed ? this.movie.frameAt(Math.max(0, t)) : null;
    let st = null;
    if (this.stage) {
      try {
        if (this.view) { const nw = performance.now() / 1000, dt = this.view.last ? nw - this.view.last : 0; this.view.last = nw; this.stage.pvCam = this.view.free ? this.viewCam(dt) : null; }
        // (DDR II stages follow the dance's cue sheets: which part is danced when)
        this.stage.choreo = this.choreo; this.stage.endBeat = this.danceEndBeat();
        if (this.stage.hp2 === 'ddr2') this.stage.cameraWork = S.cameraWork;
        // (where the dancer shows on screen: 1 player, the game's own 3D projection - GX's projection state in
        // the Dolphin dumps holds the camera's perspective with x scaled by 0.95889 and moved right by 0.28384
        // of the half-screen (p00 1.2456 for the camera's 1.2990, p02 -0.28384; the same in two songs), so the
        // dancer stands at 64% of the screen's width. 2 players: centred. Double: not measured yet.)
        // Those two numbers are the play camera's off-centre frustum (main.dol 0x8005b764, used while camera
        // +0x5c is set): left = -X / a, right = X * a with a = 1 - shift / width, shift = camera +0x60 = 216
        // (set by 0x8003d740) and width = 480 x 16 / 9 - so x is scaled by 2a / (1 + a^2) and moved by
        // (1 - a^2) / (1 + a^2): 0.95887 and 0.28384, the dumps' values.
        // (HP4: no shift - its play camera has the same field (camera +0x54 / +0x58 = 216, 0x80055bbc) but nothing
        // ever sets +0x54: Dolphin 2026-11-17, 1 and 2 players both read +0x54 = 0, and the lead stands centred)
        if (this.stage.hp2 === 'ddr2' && HP4) { this.stage.ndcShift = 0; this.stage.ndcScale = 1; }
        else if (this.stage.hp2 === 'ddr2') {
          const one = !this.two && this.lanes !== 8, a = 1 - 216 / (480 * 16 / 9);
          this.stage.ndcShift = !this.choreo ? 0 : one ? (1 - a * a) / (1 + a * a) : (this.dancerSpot()[0] - W / 2) / (W / 2);
          this.stage.ndcScale = this.choreo && one ? 2 * a / (1 + a * a) : 1;
        }
        this.stage.introT = this.stage.bossIntro && t < 0 && t >= -10 ? t + 10 : null;
        Play.introOn = this.introOn = this.stage.introT != null;
        // the boss opening's sound at c 180 (0x80116478: sound 633 SE_DDR_BOSS for one player, 634
        // SE_DDR_BOSSMULTI for more), with the stage's own effects
        if (this.introOn && this.stage.introT >= 3 && !this.bossSnd) { this.bossSnd = true; sfx(this.two ? 'SE_DDR_BOSSMULTI' : 'SE_DDR_BOSS'); }
        // the formation's look point (s1_look_NN): the dance's camera moves are relative to it (Dolphin
        // memory, boss song: (0,-15,20), (-30,15,-15), (30,15,-15) as the formation changed) - the stage is
        // drawn around it
        if (this.stage.hp2 === 'ddr2') {
          const fm = this.choreo && this.choreo.formAt && !this.stage.noDancer ? this.choreo.formAt(this.danceBeat(Math.max(0, t)), this.stage.endBeat) : null;
          this.stage.leadSpot = fm ? fm.look || (fm.spots && fm.spots[1]) || null : null;
          if (this.apl && this.apl.cur && this.apl.data && this.apl.data.hp4) this.stage.leadSpot = null;
        }
        this.appealStep(t);
        st = this.stage.draw(this.danceBeat(Math.max(0, t)), this.stage.hp2 === 'ddr2' ? t : performance.now() / 1000, t);
      }
      catch (e) { console.error('stage', e); this.stage = null; }
    }
    if (st) {
      g.drawImage(st, 0, 0, W, H);
      // (DDR II: a background-video variant fills the screen behind the dancers)
      const bgv = this.stage && this.stage.bgvFrame && this.stage.bgvFrame();
      if (bgv) g.drawImage(bgv, 0, 0, W, H);
    }
    else if (fr && (S.videoSize === 'full' || this.song.disc === 'hp3')) {      // (Hottest Party 3's music videos fill the screen)
      const sc = Math.max(W / fr.width, H / fr.height);
      g.globalAlpha = 0.85;
      g.drawImage(fr, W / 2 - fr.width * sc / 2, H / 2 - fr.height * sc / 2, fr.width * sc, fr.height * sc);
      g.globalAlpha = 1;
    } else if (A.img.stageBg || A.img.playBg) {
      g.drawImage(A.img.stageBg || A.img.playBg, 0, 0, W, H);
      if (fr && !(this.two && this.lanes === 8)) {      // (no room for the monitor between two Double players)
        // the Wii shows song videos on a monitor beside the player (in the middle for Double and VERSUS)
        // a fixed 16:9 screen in a frosted frame (the video is fitted inside it, black bars around)
        const mw = this.lanes === 8 ? 640 : this.two ? 320 : 606, mh = Math.round(mw * 349 / 606);
        const mx = this.lanes === 8 || this.two ? W / 2 - mw / 2 : 569;
        const my = this.lanes === 8 ? H / 2 - mh / 2 + 40 : this.two ? H / 2 - mh / 2 + 70 : 188;
        g.fillStyle = 'rgba(205,225,255,0.55)'; g.fillRect(mx - 17, my - 12, mw + 34, mh + 24);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.strokeRect(mx - 17, my - 12, mw + 34, mh + 24);
        g.fillStyle = '#000'; g.fillRect(mx, my, mw, mh);
        const fs = Math.min(mw / fr.width, mh / fr.height), fw = fr.width * fs, fh = fr.height * fs;
        g.drawImage(fr, mx + (mw - fw) / 2, my + (mh - fh) / 2, fw, fh);
        const gl = g.createLinearGradient(mx, my, mx + mw, my + mh);
        gl.addColorStop(0, 'rgba(255,255,255,0.12)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(mx, my, mw, mh);
      }
    } else {
      const jk = texture('jacket', this.song.jacket);
      if (jk.img) { g.globalAlpha = 0.18; g.drawImage(jk.img, 0, -280, W, W); g.globalAlpha = 1; }
    }
    this.drawDancer(t);
    if (HP4 && this.apl && this.apl.data && this.apl.data.hp4) this.aplScreenFx(t);
    // the speaker ring opening out round the stage (track 1, 16 frames from the start of play)
    if (RING.parts && this.ringAt !== undefined) {
      const f = RING.freeze !== undefined ? RING.freeze : Math.floor((performance.now() - this.ringAt) / 1000 * 30);
      if (f < ringLen(1)) drawRing(1, f); else this.ringAt = undefined;
    }
    if (this.view) { this.drawView(t); this.drawOpening(t); return; }
    const many = this.ps.length > 2;
    const ry = this.hp ? 156 : many && !(GROUP && GROUP !== 'family' && partyLayout()) ? (this.ps.length > 3 ? (HP4 ? 151.8 * 1.5 : 224) : HP4 ? 156.8 * 1.5 : 232) : 196, lay = this.layout();     // (HP4 4 players: the step zone's middle at y 151.8 of 480 - FIFO log)     // (3 / 4 players: measured on the Wii screenshots)
    // 3 / 4 players: each field is a full-height see-through column in the player's colour
    const party = many && GROUP && GROUP !== 'family' && partyLayout();
    if (many && !party && HP4 && A.img.multiBoard && A.img.multiBoard[0]) { const go = t - this.bannerShift() + 1.4; if (go >= 0) drawMultiBoard(lay, Math.min(1, (1 + Math.floor(go * 30)) / 10)); }
    else if (many && !party) lay.forEach((l, i) => { g.fillStyle = ['rgba(40,90,230,0.45)', 'rgba(220,40,70,0.45)', 'rgba(40,200,90,0.45)', 'rgba(220,210,40,0.45)'][i]; g.fillRect(l.x0 - l.lw * 0.15, 0, l.lw * 4.3, H); });
    (this.team ? [this.ps[0], this.ps[0]] : this.ps).forEach((p, i) => {
      if (this.team) { p.drawOwner = i; p.idx = i; p.name = this.teamNames[i]; }
      const { lw, x0 } = lay[i], width = p.lanes * lw, cx = x0 + width / 2;
      // (FRIENDSHIP / SYNC, 3 / 4 players: one shared field - player 1's, whose judgments are the group's)
      if (party && i > 0) return;
      p.draw(t, x0, lw, ry, l => this.heldBy(p, l), this.ended);
      if (HP4) this.hp4HitFx(p, i, x0, lw, p.o.scroll === 'reverse' ? H - 150 : ry);
      // before the song, footprints show where to stand: the outer panels, then the inner ones,
      // back and forth, then all four blink and they're gone (like the game)
      if ((this.stage && this.stage.bossIntro ? this.introOn && t + 10 < 2.2 : t < (HP4 ? -2.4 : -4.6 + 151 / 60)) && A.img.feet && A.img.feet[0]) {
        // DDR II (fifo_ddr2_ready.dff): the feet fill the lane (64 x 64 on 64-px lanes) and a pair swap is a
        // 6-frame crossfade (alpha 42.5 a frame), not a cut; how long each pair holds is not pinned down (26+
        // frames seen): 0.45 s kept
        const k = this.introOn ? t + 10 : t + 4.6, ft = A.img.feet[p.idx === 1 ? 1 : 0], fs = lw * (HP4 ? 0.8 : 1);
        const all = k > 1.75, on = HP4 && all ? ((k * 8) | 0) % 2 === 0 : true, ph = k / 0.45, outer = (ph | 0) % 2 === 0;
        const xf = HP4 || all ? 0 : Math.max(0, ((ph % 1) * 0.45 - 0.35) / 0.1);     // crossfade over the last 0.1 s
        const d2f = !HP4 && !this.introOn ? feetD2(Math.floor(k * 60)) : null;          // (DDR II: the Wii's own sequence)
        if (on) for (let l = 0; l < p.lanes; l++) {
          const inner = l % 4 === 1 || l % 4 === 2, mine = all || inner !== outer;
          const a = d2f ? d2f[inner ? 1 : 0] : all ? 1 : mine ? 1 - xf : xf;
          if (a <= 0) continue;
          g.globalAlpha = a;
          g.drawImage(ft, x0 + lw * (l + 0.5) - fs / 2, ry - fs / 2, fs, fs);
        }
        g.globalAlpha = 1;
      }
      if (!this.introOn) {
        // (4 players: each player's meter panel scaled to its quarter of the screen - PROVISIONAL)
        // (3 / 4 players: the panel 61% size, its middle at 19.5% of the height - Wii 4-player screenshot)
        const ML = many && !party ? multiLayout(this.ps.length) : null;
        if (party) { const s3 = HP4 ? hudSlide(3) : 0; g.save(); g.translate(s3, 0); try { drawParty(this.ps, t, HP4 ? hudSlide(7) - s3 : 0); } finally { g.restore(); } }
        else if (ML) {
          // (HP4: the meters and the STYLE plate slide in like the 1-2 player screen - hudSlide)
          g.save(); g.translate(HP4 ? hudSlide(3) : 0, 0);
          try { p.drawHudMulti(this.ps.length, ML, t); } finally { g.restore(); }
          // the STYLE plate in the middle with the style's word (NORMAL / SYNC / FRIENDSHIP), once
          if (i === this.ps.length - 1) {
            const M = A.multi[this.ps.length];
            g.save(); g.translate(HP4 ? hudSlide(7) : 0, 0);
            mspr(M.plate, ML.plate);
            mspr(M.words[GROUP === 'sync' ? 1 : GROUP === 'friend' ? 2 : 0], ML.word);
            g.restore();
          }
        }
        else {
          const shrink = many ? 0.61 : 1;
          if (shrink !== 1) { g.save(); g.translate(cx, H * 0.195); g.scale(shrink, shrink); g.translate(-cx, -86); }
          p.drawHud(x0, width, t, !this.two && this.lanes === 4, this.two);
          if (shrink !== 1) g.restore();
        }
      }
      // each player's ending banner (centred when playing alone)
      const bx = this.two ? cx : W / 2, bs = this.two ? 0.78 : 1.25;
      if (this.ended) {
        const k = clamp((t - this.ended.at) * 5), sc = bs * (1.4 - 0.4 * k), fc = p.fullCombo();
        // (DDR II: a play that can't fail - a lesson - ending with the gauge empty says TRY AGAIN: Wii 2026-11-18, STEP
        // LESSON 1 / 6 with no steps hit)
        const tryAg = !HP4 && !p.failed && p.o.gauge === 'no fail' && p.life <= 1 && A.img.tryAgain;
        const kind = p.failed ? 'failed' : tryAg ? 'try' : fc ? 'fc' : 'finish';
        const im = kind === 'try' ? A.img.tryAgain : kind === 'failed' ? (A.img.failed || A.img.tryAgain)
                 : kind === 'fc' ? (fc === 5 ? A.img.fullComboB : fc === 4 ? A.img.fullComboY : fc === 3 ? A.img.fullComboG : A.img.fullComboP || A.img.fullComboG)
                 : (!HP4 && A.img.finished) || A.img.finishY;      // (DDR II: a clear without a full combo says FINISHED, green, centred - Wii screenshot 2026-11-18)
        const label = kind === 'try' ? 'TRY AGAIN' : kind === 'failed' ? 'FAILED' : kind === 'fc' ? 'FULL COMBO' : 'FINISHED';
        const HBs = this.hpBanners && this.hp2Screen && HP2_HUD ? HP2_HUD : this.hpBanners && HP_HUD && HP_HUD.ok ? HP_HUD : null;
        const hb = HBs ? (kind === 'failed' ? HBs.failed : kind === 'fc' ? HBs.cleared : HBs.finished) : null;
        if (hb && hb.naturalWidth) blit(hb, bx, H / 2, sc * 1.2, k); else
        // DDR II's full combo (fifo_ddr2_fullcombo.dff, all MARVELOUS by the autoplay code): FULL COMBO at y -40 over
        // FINISH!! at y 38 (854 x 480 units), the same colour (light blue = MARVELOUS: /0/0/5 + /0/0/8; yellow /0/0/4
        // + /0/0/7; green /0/0/3 + /0/0/6), at 1.0 x about 1.17, the height easing down 0.0015 a frame; a white glow
        // (/7/1/0/0 drawn 256 x 480, alpha 153) and the swirl (/7/4/0/1, 256 x 1024, alpha 102) over the lanes.
        // ASSUMED: the way they come in (READY's bounce - the recording began after it) and the flares (not drawn)
        if (!HP4 && kind === 'fc' && A.img.finishB && A.img.fullComboB) {
          // (tiers: MARVELOUS light blue, PERFECT yellow, GREAT green, GOOD dark blue - /0/0/12 + /0/0/13, seen on the
          // Wii 2026-11-18 with the all-GOOD autoplay)
          const top = fc === 5 ? A.img.fullComboB : fc === 4 ? A.img.fullComboY : fc === 2 && A.img.fullComboP ? A.img.fullComboP : A.img.fullComboG;
          const bot = fc === 5 ? A.img.finishB : fc === 4 ? A.img.finishY : fc === 2 && A.img.finishP ? A.img.finishP : A.img.finishG;
          const f = Math.floor((t - this.ended.at) * 60), m = this.two ? 0.78 / 1.25 : 1;
          const e = f < 21 ? READY_D2[f] : [1.0, Math.max(1.0, 1.2 - 0.0015 * (f - 21))];
          const lx = x0 + width / 2;
          if (A.img.fcGlow) { g.save(); g.globalAlpha = 153 / 255; g.drawImage(A.img.fcGlow, lx - 128 * m * 1.5, 0, 256 * m * 1.5, H); g.restore(); }
          if (A.img.fcSwirl) { g.save(); g.globalAlpha = 102 / 255; g.globalCompositeOperation = 'lighter'; g.drawImage(A.img.fcSwirl, lx - 128 * m * 1.5, H / 2 - 768 * m, 256 * m * 1.5, 1536 * m); g.restore(); }
          for (const [im2, v] of [[top, -40], [bot, 38]]) drawBannerD2(im2, e[0], e[1], 1, -1, bx, H / 2 + v * 1.5 * m, m);   // (tilted, not stretched: see d2Tilt)
        } else if (!HP4 && kind === 'finish' && A.img.finished && !hb) {
          // DDR II's FINISHED (the user's 60 fps Dolphin recording 2026-11-15_20-53-11.mp4, 223.4 s on): it comes in
          // tilted and growing like HERE WE GO!!, lands level at 1.0 (the picture 1:1 in 854 x 480 units, centred);
          // the first step half see-through; a white shine then crosses the letters left to right in about 20 frames
          // (by eye the sizes were 0.46 / 0.89 / 1.32 / 1.68 / 1.76 / 1.57 / 1.24 - HERE WE GO!!'s own curve, so its
          // table is used: HWG_D2, then the same easing to level)
          const f = Math.max(0, Math.floor((t - this.ended.at) * 60)), m = this.two ? 0.78 / 1.25 : 1;
          const e = f < HWG_D2.length ? HWG_D2[f] : [Math.max(1, 1.0049 - 0.0001 * (f - 14)), Math.max(1, 1.2225 - 0.00375 * (f - 14))];
          const fim = A.img.finished, [e1, th] = d2Tilt(e[0], e[1], fim.width / fim.height), w = fim.width * 1.5 * m * e1, h = fim.height * 1.5 * m * e1;
          g.save(); g.translate(bx, H / 2); g.rotate(-th); g.globalAlpha = f < 2 ? 0.5 : 1;
          g.drawImage(fim, -w / 2, -h / 2, w, h);
          const sf = f - 14;                                      // the shine: frames 14-34
          if (sf >= 0 && sf < 22) {
            const cv = this.finShine || (this.finShine = document.createElement('canvas'));
            cv.width = fim.width; cv.height = fim.height;
            const c2 = cv.getContext('2d'); c2.drawImage(fim, 0, 0);
            c2.globalCompositeOperation = 'source-atop';
            const x0s = 123 + (389 - 123) * (sf / 20) - 50, gr = c2.createLinearGradient(x0s, 0, x0s + 100, 0);
            const pk = sf < 2 ? 0.95 : 0.9;
            gr.addColorStop(0, 'rgba(255,255,255,' + (sf < 2 ? 0.5 : 0) + ')'); gr.addColorStop(0.5, 'rgba(255,255,255,' + pk + ')'); gr.addColorStop(1, 'rgba(255,255,255,' + (sf < 2 ? 0.5 : 0) + ')');
            c2.fillStyle = gr; c2.fillRect(0, 0, cv.width, cv.height);
            g.drawImage(cv, -w / 2, -h / 2, w, h);
          }
          g.restore();
        } else
        if (!blit(im, bx, H / 2, sc, k)) text(label, bx, H / 2, this.two ? 40 : 64, '#ffd23c', 'center');
      } else if (p.failed) blit(A.img.failed, bx, H / 2, this.two ? 0.75 : 1.2);
    });
    // banners
    this.drawOpening(t);
  },
  // the song card, READY / HERE WE GO and the quit hint (also over DANCE VIEW's screen)
  drawOpening(t) {
    const bt = t - this.bannerShift();
    // HP4: select_cmn's effect 3 (bank 4) plays while the song card comes in (0x800e3bd0; effwatch on
    // Dolphin: it starts as the song screen opens and runs about 6 s), at the stage's origin
    if (HP4 && !this.cardFx && this.stage && this.stage.fx && this.stage.fx.banks && this.stage.fx.banks[4]) {
      this.cardFx = this.stage.fx.play(4, 3, null, { tag: 'card' }) || true;
    }
    // (the stage only runs its effects from the song's start, so before it the card's effect is stepped here)
    if (this.cardFx && t < 0 && this.stage && this.stage.fx) {
      const dt = this.cardLast != null ? t - this.cardLast : 0;
      if (dt > 0 && dt < 1) this.stage.fx.update(Math.min(dt, 0.1));
    }
    this.cardLast = t;
    if (HP4 && this.drawHp4Card(t)) {} else if (t < -1.1) this.drawSongCard(t);
    const HB = this.hpBanners && this.hp2Screen && HP2_HUD ? HP2_HUD : this.hpBanners && HP_HUD && HP_HUD.ok ? HP_HUD : null, hb = k => HB && HB[k] && HB[k].naturalWidth ? HB[k] : null;
    if (HB) {
      if (bt < -1.4 && bt > -3.0) blit(hb('ready'), W / 2, H / 2, 1.6, clamp((bt + 3.0) * 4));
      else if (bt >= -1.4 && bt < -0.2) blit(hb('hereWeGo'), W / 2, H / 2, 1.5, clamp((-0.2 - bt) * 3));
      else if (t >= -0.2 && t < 0.6) blit(hb('go'), W / 2, H / 2, 1.6 + 0.4 * clamp(t + 0.2), clamp((0.6 - t) * 3));
    } else if (!HP4 && A.img.ready && A.img.hereWeGo) {
      // (DDR II: READY at 99 frames after the play screen comes up - t -4.6 + 1.65 - see READY_D2)
      // HERE WE GO!! comes up 84 frames after READY in a song and is up 88 frames, the last 4 leaving (the user's
      // 60 fps Dolphin videos 2026-11-14_18-39-18.mp4: READY frames 118-174, HERE WE GO!! 202-289; 2026-11-15_17-38-32
      // .mp4 the same gap); 119 after READY in a STEP LESSON (fifo_ddr2_start0-3.dff)
      const gapHW = this.song && this.song.lesson ? 119 : 84;
      const rf = Math.floor((bt + 2.95) * 60), hf = rf - gapHW;
      if (rf >= 0 && rf < READY_D2.length) { const e = READY_D2[rf]; drawBannerD2(A.img.ready, e[0], e[1], (e[2] || 255) / 255, rf < 39 ? -1 : 1); }
      if (hf >= 0 && hf < 88) {
        const left = 87 - hf;
        if (left < 4) { const e = READY_D2[READY_D2.length - 4 + (3 - left)]; drawBannerD2(A.img.hereWeGo, e[0], e[1], e[2] / 255, 1); }
        else {
          if (hf >= 14 && hf < 58) { const k = (hf - 14) / 44; drawBannerD2(A.img.hereWeGo, 1.0109 + 0.022 * Math.min(1, k * 2), 1.23 + 0.117 * Math.min(1, k * 1.8), Math.max(10, 255 - 5.6 * (hf - 14)) / 255); }
          const e = hf < HWG_D2.length ? HWG_D2[hf] : [Math.max(1, 1.0049 - 0.0001 * (hf - 14)), Math.max(1, 1.2225 - 0.00375 * (hf - 14))];
          drawBannerD2(A.img.hereWeGo, e[0], e[1], 1);
        }
      }
    } else
    if (bt < -1.4 && bt > -3.0) { if (!blit(A.img.ready, W / 2, H / 2, 1.2, clamp((bt + 3.0) * 4))) text('READY', W / 2, H / 2, 56, '#ffd23c', 'center'); }
    else if (bt >= -1.4 && bt < 0.3) { if (!blit(A.img.hereWeGo, W / 2, H / 2, 1.2, clamp((0.3 - bt) * 3))) text('HERE WE GO!', W / 2, H / 2, 56, '#ffd23c', 'center'); }
    if (this.quitHeld) text('Hold Esc to quit', W / 2, H - 30, 20, '#fff', 'center', 'normal');
  },
};

// DDR II's READY / HERE WE GO!! (GAME_CMN /0/0/1 and /0/0/2, 512 x 80, centred, 1.5 px a unit) - Dolphin FIFO
// recordings fifo_ddr2_start0-3.dff (STEP LESSON 1, 60 frames a second, the sizes change every 2 frames).
// READY_D2[f] = [x scale, y scale, alpha] f frames after READY comes up: it bounces in (21 frames), settles at
// 1.0 x 1.2 and eases to 1.0 x 1.0, swells a little, then stretches out fading (frames 53-56) - gone at 57.
// HERE WE GO!! comes up 119 frames after READY: the same kind of bounce (14 frames), then 1.005 x 1.2225 easing
// down (y -0.00375 a frame) to 1 x 1; from its frame 14 a copy behind it grows slowly and fades out (alpha 255 ->
// 10 over 44 frames, 6 a frame; scale from 1.0109 x 1.23 to about 1.033 x 1.34). Not seen: how HERE WE GO!!
// leaves (here: as READY does, at the song's 0.3 s - ASSUMED).
const READY_D2 = [[0.4574,1.1412],[0.4574,1.1412],[0.8574,2.1125],[0.8574,2.1125],[1.1957,2.8662],[1.1957,2.8662],[1.4674,3.3525],[1.4674,3.3525],[1.6654,3.5337],[1.6654,3.5337],[1.783,3.41],[1.783,3.41],[1.8201,3.0713],[1.8201,3.0713],[1.7273,2.5725],[1.7273,2.5725],[1.502,2.02],[1.502,2.02],[1.2184,1.5325],[1.2184,1.5325],[1.0049,1.2225],[1.0049,1.2225],[1.0045,1.2],[1.0045,1.2],[1.0039,1.1763],[1.0039,1.1763],[1.0035,1.1525],[1.0035,1.1525],[1.0029,1.1287],[1.0029,1.1287],[1.0023,1.105],[1.0023,1.105],[1.002,1.0813],[1.002,1.0813],[1.0014,1.0575],[1.0014,1.0575],[1.0008,1.035],[1.0002,1.0112],[1.0002,1.0112],[1.0002,1.01],[1.0002,1.01],[1.0008,1.0312],[1.0008,1.0312],[1.0012,1.0525],[1.0012,1.0525],[1.0018,1.0713],[1.0018,1.0713],[1.0021,1.0887],[1.0021,1.0887],[1.0023,1.1038],[1.0023,1.1038],[1.0025,1.1113],[1.0025,1.1113],[1.1031,1.9025,168],[1.1031,1.9025,168],[1.2188,3.0788,84],[1.2188,3.0788,84]];
// (see the CORRECTION below) HERE WE GO's box sizes, one pair per 60th of a second
const HWG_D2 = [[0.4723,1.475],[0.4723,1.475],[0.9287,2.8062],[0.9287,2.8062],[1.3535,3.8462],[1.3535,3.8462],[1.702,4.395],[1.702,4.395],[1.8057,4.0587],[1.8057,4.0587],[1.6092,2.9825],[1.6092,2.9825],[1.2795,1.855],[1.2795,1.855]];
// CORRECTION (2026-11-19, the user's 60 fps Dolphin videos 2026-11-14_18-39-18.mp4 and 2026-11-15_20-53-11.mp4): the
// [x, y] pairs above are the OUTER BOX of a banner that is TILTED, not stretched - a 512 x 80 picture at one scale s
// turned by an angle: box x = s (cos + sin / 6.4), box y = s (6.4 sin + cos). Solved, READY is 0.454 at 14 degrees ->
// 1.80 at 6.4 -> exactly 1.000 at 2.0, the tilt easing 0.1 degree a frame through level and on to 1.0 the other
// way, then 1.09 at 6.7 / 1.21 at 14.3 fading; HERE WE GO!! 0.475 at 19.8 -> 1.79 at 11.7 -> 1.27 at 4.2 -> 1.0.
// The videos show the way round: in tilted up to the right (anticlockwise), out tilted down to the right, and
// HERE WE GO!! leaving as READY does (seen: no longer assumed).
function d2Tilt(sx, sy, r) {
  const t = (sy - sx) / (sx * r - sy / r), th = Math.atan(t);
  return [sx / (Math.cos(th) + Math.sin(th) / r), th];
}
// dir -1 = tilted up to the right (coming in), +1 = down to the right (leaving)
function drawBannerD2(im, sx, sy, a, dir = -1, cx = 639.25, cy = 360, m = 1) {
  if (!im) return false;
  const [sc, th] = d2Tilt(sx, sy, im.width / im.height), w = im.width * sc * 1.5 * m, h = im.height * sc * 1.5 * m;
  g.save(); g.globalAlpha *= a; g.translate(cx, cy); g.rotate(dir * th); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); return true;
}
// the footprints before a DDR II song (fifo_ddr2_start0/1/2.dff), by frames since the play screen came up: the
// outer pair fades in (6 frames), holds, crossfades to the inner pair at 62-66, the outer pair fades back in at
// READY + 5 (frame 104) - all four, still - and all fade out at READY + 46 (frames 146-150)
function feetD2(f) {
  const up = n => Math.min(255, 42.5 * (f - n + 1)) / 255, down = n => Math.max(0, 255 - 42.5 * (f - n + 1)) / 255;
  const outer = f < 0 ? 0 : f < 6 ? up(0) : f < 62 ? 1 : f < 67 ? down(62) : f < 104 ? 0 : f < 110 ? up(104) : f < 146 ? 1 : f < 151 ? down(146) : 0;
  const inner = f < 62 ? 0 : f < 67 ? up(62) : f < 146 ? 1 : f < 151 ? down(146) : 0;
  return [outer, inner];
}
// keep a value between 0 and 1
function clamp(v) { return Math.max(0, Math.min(1, v)); }
// draw one arrow of a kind at (x, y) pointing dir (0 L, 1 D, 2 U, 3 R)
function drawArrow(kind, x, y, dir, size) {
  const sp = sprite(kind, size);
  g.save(); g.translate(x, y); g.rotate(ROT[dir]); g.drawImage(sp, -size / 2, -size / 2); g.restore();
}
// TURN option: which lane each lane's arrows move to (MIRROR, LEFT, RIGHT, SHUFFLE)
function turnMap(lanes, turn = S.turn) {
  const id = [...Array(lanes).keys()];
  const per = (m) => lanes === 8 ? [...m, ...m.map(v => v + 4)] : m;
  switch (turn) {
    case 'mirror': return per([3, 2, 1, 0]);
    case 'left': return per([1, 3, 0, 2]);     // rotate 90° to the left
    case 'right': return per([2, 0, 3, 1]);
    case 'shuffle': {
      const m = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) { const j = Math.floor(wiiRandom() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
      return per(m);
    }
    default: return id;
  }
}

// ---- results
let HP4_MENUMOT = null, HP4_EFFMASK = null;
// RESULTS screen: the count-up, grades, NEW RECORD, the dancer, then saving and what comes next
const Results = {
  bgm: 'MU_BGM_FREE',
  with(play) { this.play = play; this.ps = play && play.ps; return this; },
  input(a, p) {
    // (3 / 4 players: CHANGE INFO turns the cards between the grade and the counts)
    if (p && this.ps && this.ps.length > 2 && (a === 'OPTIONS' || a === 'P1L' || a === 'P1R')) { this.info = !this.info; sfx('SE_SYS_SELECT02'); return; }
    // (DDR II WORKOUT, 1-2 players: CHANGE RESULT (+) turns between CALORIES BURNED and the counts - Wii)
    if (p && !HP4 && WK && this.ps && this.ps.length <= 2 && a === 'OPTIONS') { this.wkCounts = !this.wkCounts; sfx('SE_SYS_SELECT02'); return; }
    // (DDR II TRAINING: CHANGE RESULT (+) opens TIMING CHECK and back; there Up / Down move a bar)
    if (p && !HP4 && this.play && this.play.mode === 'training' && this.ps && this.ps[0]) {
      if (a === 'OPTIONS') { this.tc = !this.tc; if (this.tc) this.tcBar = Math.max(0, (TRAIN.from || 1) - 1); sfx('SE_SYS_SELECT02'); return; }
      if (this.tc && (a === 'P1U' || a === 'P1D')) { const N = Math.max(1, (TRAIN.to || 999)); this.tcBar = Math.max(0, Math.min(N - 1, this.tcBar + (a === 'P1D' ? 1 : -1))); sfx('SE_SYS_SELECT01'); return; }
    }
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    if (this.play && this.play.mode === 'gc' && GC) { gcSongDone(this.ps[0], this.play); return; }
    if (this.play && this.play.mode === 'battle' && BATTLE && this.ps.length > 1) { go(BattleResult.with(this.ps)); return; }
    if (this.play && this.play.mode === 'online') { go(window.NET && NET.open ? Select : ModeSel); return; }
    // (DDR II TRAINING: EXIT goes back to the TRAINING MENU with the same bars, the cursor on PLAY - Wii 2026-11-18)
    if (!HP4 && this.play && this.play.mode === 'training' && TrainSet.args && !COURSE && !WK && !MC) { TrainSet.i = TrainSet.rowsNow.indexOf('START'); go(TrainSet); return; }
    if (this.play && this.play.mode === 'lesson') {
      const p0 = this.ps[0];
      // the lesson's best grade (and full combo) - DDR II's lessons are kept apart from Hottest Party 3's
      const key = lessonKey(this.play.song), old = (SAVE.lessons || {})[key];
      if (!p0.failed && p0.gr && (!old || GRADE_RANK.indexOf(p0.gr) > GRADE_RANK.indexOf(old))) { SAVE.lessons = SAVE.lessons || {}; SAVE.lessons[key] = p0.gr; }
      const fc = p0.fullCombo ? p0.fullCombo() : 0;
      if (fc) { SAVE.lessonFc = SAVE.lessonFc || {}; SAVE.lessonFc[key] = Math.max(SAVE.lessonFc[key] || 0, fc); }
      writeSave();
      go(LessonSel); return;
    }
    if (this.play && this.play.mode === 'workout' && WK) {
      const p0 = this.ps[0], secs = Math.max(0, Math.min(this.play.endT, p0.failed ? p0.failAt : this.play.endT));
      const songKcal = p0.kcalSteps ? p0.kcalSteps.kcal() : workoutKcal(p0, secs);
      WK.kcal += songKcal; WK.secs += secs; WK.songs++;
      // (the profile's DIARY: CUMULATIVE CALORIES BURNED / NUMBER OF SONGS PLAYED)
      if (!HP4 && WK_PROFILE) { WK_PROFILE.kcalTotal = (WK_PROFILE.kcalTotal || 0) + songKcal; WK_PROFILE.songs = (WK_PROFILE.songs || 0) + 1; writeSave(); }
      WK.done = WK.target === 'time' ? WK.secs >= WK.goal : WK.target === 'kcal' ? WK.kcal >= WK.goal : false;
      go(WK.done ? WorkoutResult : Select); return;
    }
    if (this.play && this.play.mode === 'course' && COURSE) {   // a course: on to the next song, or its result
      const p0 = this.ps[0];
      COURSE.scores.push(p0.score); COURSE.life = this.ps.map(p => p.life);
      if (p0.failed) { COURSE.failed = true; go(CourseResult); return; }
      COURSE.i++;
      if (COURSE.i < COURSE.slots.length) startCourseSong(); else go(CourseResult);
      return;
    }
    if (this.play && this.play.mode === 'maxcombo' && MC) {   // the run goes on (pick the next song) or it's over
      MC.songs++;
      if (this.ps.some(p => p.failed)) { go(MCResult.with(this.ps.map(p => p.combo || p.maxCombo), MC.songs)); return; }
      MC.totals = this.ps.map(p => p.combo); go(Select); return;
    }
    const q = (this.awards || []).filter(Boolean);      // each player with user data gets their points card
    const after = q.length ? Points.with(q[0], q.slice(1)) : Select;
    const mine = this.ps.filter(p => !p.remote && p.com === undefined);
    const ws = this.play && this.play.mode === 'free' && !this.play.team && !BATTLE && mine.length >= 1 && mine.length <= 2 && !DEMO.on ? mccAfterSong(this.ps) : [];
    go(ws.length ? MCCWin.with(ws, after) : after);
  },
  // records, play points and challenge-task bonus into the player's own data (guests keep nothing)
  award(p) {
    const prof = p.prof;
    if (!prof || isAuto(p)) return null;              // DEMO plays keep no records or points
    if (this.play && this.play.mode && this.play.mode !== 'free') return null;   // (RELAXED / MAX COMBO keep their own records)
    if (this.play && this.play.team) return null;      // (TEAM plays keep no solo records)
    prof.points = prof.points || 0; prof.records = prof.records || {};
    const key = recKey(p.song.slot, p.style, p.diff, p.kind), old = prof.records[key];
    if (p.rec && !p.failed && p.rec.length) {             // GHOST: keep the best scoring play of this chart
      prof.ghosts = prof.ghosts || {}; const g0 = prof.ghosts[key];
      if (!g0 || p.score > g0.score) prof.ghosts[key] = { score: p.score, diff: p.diff, opts: p.recOpts, ev: p.rec };
    }
    const r = { failed: p.failed, life: p.life, maxCombo: p.maxCombo, grade: p.gr };
    const gi = GRADE_ORDER.indexOf(p.gr);
    const play = p.failed || gi < 0 ? 0 : PLAY_POINTS[p.slot][gi];
    const ct = ctTask(prof);
    let tasks, taskSong = null;
    if (ct) {
      // the game's challenge task: only a cleared play of the right song counts
      const x = { level: p.slot, gauge: Math.floor((p.life || 0) / 10), maxCombo: p.maxCombo || 0, fc: (p.fc || 0) > 0,
                  rank: ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(p.gr) };
      const ok = !p.failed && ctSongOk(ct, p.song.slot);
      tasks = ct.rows.map(k => ({ label: k.label, pts: k.pts, done: ok && !!k.test(x) }));
      taskSong = ct.any ? null : songForSlot(ct.songId + 1) || null;
    } else tasks = TASKS.map(([label, pts, test]) => ({ label, pts, done: !!test(r) }));
    const bonus = tasks.reduce((n, k) => n + (k.done ? k.pts : 0), 0);
    const before = prof.points;
    p.newRecord = !old || p.score > old.score;
    const rank = gr => ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(gr);
    prof.records[key] = {
      score: Math.max(p.score, old ? old.score : 0),
      grade: !old || rank(p.gr) > rank(old.grade) ? p.gr : old.grade,
      fc: Math.max(p.fc || 0, old ? old.fc || 0 : 0),
      // the game keeps its best max combo as a record of its own too (0x800e9374: u16 at song record +84)
      maxCombo: Math.max(p.maxCombo || 0, old ? old.maxCombo || 0 : 0),
      plays: (old ? old.plays || 0 : 0) + 1,
    };
    prof.points = before + play + bonus;
    // the task steps on while there is still something to unlock (0x800e77d8: reward list +148)
    let next = null;
    if (ct && nextUnlock(before)) {
      // (the step stores the profile's points field as it stands then: 0 after a new profile's first
      // play in the Wii dump, though that play gave 2,000 - the points before this play)
      ctStep(prof, before, prof.points);
      const nt = ctTask(prof);
      if (nt) next = { rows: nt.rows.map(k => ({ label: k.label, pts: k.pts })), song: nt.any ? null : songForSlot(nt.songId + 1) || null };
    }
    // what the new total unlocks (player 1's points decide the song list; shown only when unlocking is on)
    const unlocked = p.idx === 0 && S.unlocks === 'on' ? unlockedBetween(before, prof.points).filter(u => u.songs.length) : [];
    return { who: this.ps.length > 1 ? `PLAYER ${p.idx + 1}  ${p.name}` : null, play, bonus, tasks, taskSong, next, before, after: prof.points, unlocked };
  },
  enter() {
    if (!this.ps || !this.ps.length) { go(Select); return; }
    this.t0 = performance.now();
    this.gradeShown = false; this.info = false;
    for (const p of this.ps) { p.gr = p.grade(); p.fc = p.fullCombo(); p.newRecord = false; }
    this.rd = null; this.rfx = this.rfx && this.rfx.fx ? Object.assign(this.rfx, { t0: null, two: false, last: 0 }) : null;
    // (DDR II: no results dancer after a boss song - Valkyrie dimension seen on the Wii 2026-11-18 (CHALLENGE and
    // BEGINNER); VANESSA on the same green video stage did show its dancer, so it's the song, not the stage. The
    // boss list is the user's (DDR II's boss songs); only Valkyrie dimension is checked on the Wii. The game's own
    // rule isn't traced (0x800f14d8 draws the dancer only when the play-kind word, a flag at game +0x14a4 +0x174
    // and res +0x1bf8 allow). Names as the disc's song table spells them.)
    const noDancerStage = !HP4 && Play.song && D2_BOSS_SONGS.has(String(Play.song.name || '').toLowerCase());
    if (S.dancer !== false && this.ps.length <= 2 && window.Dancer3D && !noDancerStage) {
      if (!HP4_MENUMOT) HP4_MENUMOT = api('/api/hp4menumot').catch(() => null);
      HP4_MENUMOT.then(d => { if (scene === this && d) this.rd = { data: d, phase: 0, t0: performance.now() }; });
    }
    sfx('SE_RES_RESULTAPP');
    this.awards = this.ps.map(p => this.award(p));
    writeSave();
  },
  update() {
    const el = (performance.now() - this.t0) / 1000;
    if (!this.gradeShown && el > 1.2) {
      this.gradeShown = true;
      // the announcer (main.dol 0x800f1310): the best grade of the players (the first to reach it,
      // 0x800e2ae8), its line - E says EHARD on EXPERT (the player's difficulty index 3), EEASY otherwise.
      // When someone set a new record or anyone full-combo'd, AAA still says its line, a full combo
      // says FULL, and a new record alone says HIGH.
      const rank = gr => ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(gr);
      const p = this.ps.reduce((a, b) => rank(b.gr) > rank(a.gr) ? b : a);
      const gr = p.gr;
      // (HP4: the grade sound belongs to the dancer's reaction, CselResult 0x800e2f4c - played once (+0x5b4) when
      // the reaction starts (state 1), for player 1's grade (+0xa54): AAA 0x11d SE_RES_RESULTAAA, AA 0x11e, A / B
      // 0x11f, C / D 0x120, E none (SE_RES_RESULTE 0x121 is never played in HP4))
      const g1 = HP4 ? this.ps[0].gr : gr;
      if (!HP4 || g1 !== 'E') sfx(g1 === 'AAA' ? 'SE_RES_RESULTAAA' : g1 === 'AA' ? 'SE_RES_RESULTAA' : g1 === 'A' || g1 === 'B' ? 'SE_RES_RESULTAB' : g1 === 'E' ? 'SE_RES_RESULTE' : 'SE_RES_RESULTCD');
      const line = gr === 'E' ? (p.slot === 3 ? 'VO_NAR_RESULTEHARD' : 'VO_NAR_RESULTEEASY') : 'VO_NAR_RESULT' + gr;
      const fc = this.ps.some(x => x.fc), rec = this.ps.some(x => x.newRecord);
      const vo = !fc && !rec ? line : gr === 'AAA' ? line : fc ? 'VO_NAR_RESULTFULL' : 'VO_NAR_RESULTHIGH';
      setTimeout(() => sfx(vo), 700);
    }
  },
  // HP4: player 1's dancer on the right reacting to the grade (CselResult, main.dol 0x800e2f4c). The grade (+0xa54:
  // 0 E ... 6 AAA, -1 none) picks a reaction slot - AAA 0, AA 1, A / B 2, C / D 3, E 4 - and the dancer's flags
  // (0x80286b68: bit 0 or bit 1) one of two sets of select_cmn motions, three per slot: [slot] for the screen
  // opening (looped), [5 + slot] when the grade shows (once; 0x800d6afc state 5), then [10 + slot] looped
  // (state 6, once the clip has played out). Set bit 0: 12 18 24 30 36 / 13 19 25 31 37 / 14 20 26 32 38; bit 1:
  // 9 15 21 27 33 / 10 16 22 28 34 / 11 17 23 29 35. The dancer stands at (12.5, 2, 21) on the widescreen screen
  // ((12.5, 1.88, 23.5) for AAA with set 1), turned -0.2, seen from (0, 10, 65) looking at (0, 7.5, 0). (The
  // field of view: the menu camera's 45 (0x800e7f28), which in 16:9 becomes a vertical 34.52 - the projection
  // in a Dolphin memory copy of this screen has 3.219 / 1.8107 = tan(22.5) x 3/4 for the same sideways view as 4:3; its sound 0x11d-0x120 for slots 0-3 is played in update.)
  // HP4's results effects (traced 2026-11-18): 0x800e3910 picks them by player 1's grade (+0xa54) - B to AAA:
  // effect 1, C / D: none, E: effect 3 (the grey gloom lines behind the dancer) - and 0x800e3a6c starts it when the
  // grade shows (the dancer's reaction), from effect bank 4 (select_cmn.bin entry 2), placed (16:9) at
  // T x S(0.55) [x R_y(-15 degrees)]: effect 1 at (12, -11, 25), effect 3 at (12, -10.7, 25) turned; AA / AAA
  // also start effect 2 half a second later (0x800e3cec) at (9.5, -10, 32) turned. Their own camera (+0xdc4):
  // eye (0, 0, 65) looking at the origin, up (0, 1, 0), 45 degrees (34.52 high in 16:9), near 1, far 10000;
  // drawn by the scene's draw (0x800d9934) after the dancer, before the cards.
  drawResultFx(el, layer) {
    const X = this.rfx || (this.rfx = { t0: null, two: false });
    const gloom = this.ps[0] && this.ps[0].gr === 'E';
    if ((layer === 'back') !== gloom) return;
    if (!X.fx && window.TebFx && !X.req) {
      X.req = true;
      api('/api/hp4bank4').then(j => {
        if (!j || !j.bank4) return;
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const gl = c.getContext('webgl', { premultipliedAlpha: false, alpha: true });
        if (!gl) return;
        X.cv = c; X.gl = gl; X.fx = TebFx.create(gl, { bank4: j.bank4 });
      }).catch(() => {});
    }
    if (!X.fx || this.ps.length > 2) return;
    const gi = ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(this.ps[0].gr);
    const now = performance.now(), dt = X.last ? (now - X.last) / 1000 : 0; X.last = now;
    const c = Math.cos(-0.2617994), sn = Math.sin(-0.2617994);
    const M = (tr, rot) => { const k = 0.55; return rot ? [c * k, 0, -sn * k, 0, 0, k, 0, 0, sn * k, 0, c * k, 0, tr[0], tr[1], tr[2], 1] : [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, tr[0], tr[1], tr[2], 1]; };
    if (X.t0 === null && el > 1.2) {
      X.t0 = el; X.fx.clear();
      if (gi >= 3) X.fx.play(4, 1, M([12, -11, 25], false), { tag: 'res' });
      else if (gi === 0) X.fx.play(4, 3, M([12, -10.7, 25], true), { tag: 'res' });
    }
    if (X.t0 !== null && !X.two && gi >= 5 && el - X.t0 >= 0.5) { X.two = true; X.fx.play(4, 2, M([9.5, -10, 32], true), { tag: 'res' }); }
    if (X.t0 === null) return;
    X.fx.update(Math.min(dt, 0.1));
    const gl = X.gl, eye = [0, 0, 65];
    const t = 1 / (Math.tan(22.5 * Math.PI / 180) * 0.75), asp = 16 / 9, n = 1, fa = 10000;
    const P = [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0];
    const V = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1];
    const VP = new Array(16);
    for (let cc = 0; cc < 4; cc++) for (let r = 0; r < 4; r++) VP[cc * 4 + r] = P[r] * V[cc * 4] + P[4 + r] * V[cc * 4 + 1] + P[8 + r] * V[cc * 4 + 2] + P[12 + r] * V[cc * 4 + 3];
    for (const [pass, clr, op] of [['blend', 0, 'source-over'], ['add', 1, 'lighter']]) {
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, clr); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      try { X.fx.draw(VP, V, pass); } catch (e) { console.error('results effect', e); X.fx = null; return; }
      g.save(); g.globalCompositeOperation = op; g.drawImage(X.cv, 0, 0); g.restore();
    }
  },
  drawResultDancer(el) {
    const R = this.rd;
    if (!R || !Dancer3D.custom) return;
    if (!HP4 && el < 52 / 60) return;       // (DDR II: the dancer is there from frame 52, all at once - the user's Dolphin video 2026-11-15_20-53-11.mp4)
    const p = this.ps[0], gi = ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(p.gr);
    const slot = gi === 6 ? 0 : gi === 5 ? 1 : gi >= 3 ? 2 : gi >= 1 ? 3 : 4;
    const id = ((Dancer3D.customFor || '').match(/ddr2char\/(\d+)\//) || [])[1], fl = (R.data.flags || {})[id] || 0;
    const setA = (fl & 1) === 1, setB = !setA && (fl & 2) === 2;
    if (!setA && !setB) return;
    const tab = setA ? [12, 18, 24, 30, 36, 13, 19, 25, 31, 37, 14, 20, 26, 32, 38] : [9, 15, 21, 27, 33, 10, 16, 22, 28, 34, 11, 17, 23, 29, 35];
    if (R.phase === 0 && el > 1.2) { R.phase = 1; R.t0 = performance.now(); }
    let c = R.data.clips[tab[R.phase * 5 + slot]];
    let f = (performance.now() - R.t0) / 1000 * 60;
    if (R.phase === 1 && c && f >= c.frames) { R.phase = 2; R.t0 = performance.now(); f = 0; c = R.data.clips[tab[10 + slot]]; }
    if (!c || !c.bones) return;
    if (R.phase !== 1) f = f % Math.max(1, c.frames);
    const pos = !setA && slot === 0 ? [12.5, 1.88, 23.5] : [12.5, 2, 21];
    let cv = null;
    try { cv = Dancer3D.renderClip(c.bones, Math.min(f, c.frames - 0.01), { eye: [0, 10, 65], at: [0, 7.5, 0], fov: 2 * Math.atan(Math.tan(22.5 * Math.PI / 180) * 0.75) * 180 / Math.PI }, pos, -0.2, W, H); } catch (e) { console.error('result dancer', e); this.rd = null; return; }
    if (cv) g.drawImage(cv, 0, 0, W, H);
  },
  // ---- DDR II TRAINING's TIMING CHECK (fifo_ddr2_timing.dff; Wii 2026-11-18): the menu background; header
  // selMusic /0/7/0/1 centred (-0.5, -210) + "TIMING CHECK" selResult /1/0/0/0 (-0.5, -205) (854 x 480 units); the
  // section's chart as in the TRAINING MENU (play-field space: step zone y 120, lanes from x 112, bar markers SSQ
  // /0/0 picture 14 at y 88 + 256 per bar), each step coloured by its judgment; the JUDGMENT COLOR key selResult
  // /1/1/0/0 (210.7, 12) with MARVELOUS / PERFECT / GREAT / GOOD / MISS (/1/1/0/1-5) at x 208.7, y -65 / -12 / 40 /
  // 91 / 143; hints EXIT / SELECT / CHANGE RESULT / CHANGE INFO (comAF 1, 6, 16, 26). Not traced (no steps were
  // hit in the recording): the steps' exact colours (here the judgments' colours) and what SELECT and CHANGE
  // INFO do (here Up / Down move a bar).
  drawTC(t) {
    const T = this.tcA || (this.tcA = {});
    if (!T.loading && A.tplOf) T.loading = (async () => {
      const one = (f, p) => A.tplOf(f, p).then(x => x.map(q => q.canvas)).catch(() => []);
      [T.head, T.title, T.key, T.b1, T.b2, T.b3, T.b4, T.b5] = await Promise.all([['mus', '/0/7/0/1'], ['res', '/1/0/0/0'], ['res', '/1/1/0/0'], ['res', '/1/1/0/1'], ['res', '/1/1/0/2'], ['res', '/1/1/0/3'], ['res', '/1/1/0/4'], ['res', '/1/1/0/5']].map(([f, p]) => one(f, p)));
      T.ok = true;
    })();
    menuBackground(t);
    if (!T.ok) return;
    const U = 1.5, X = u => 640 + u * U, Y = v => 360 + v * U;
    const put = (im, u, v, w, h) => { if (im) g.drawImage(im, X(u) - w * U / 2, Y(v) - h * U / 2, w * U, h * U); };
    const p = this.ps[0], lanes = p.lanes || 4, lw = 64, x0 = 112, bar = this.tcBar || 0;
    // the step zone, then the steps of the bars on screen in their judgments' colours, then the bar markers
    const G = A.arrowGrey && A.arrowGrey[0], dirOf = l => [0, 1, 2, 3][l % 4];
    for (let l = 0; l < lanes; l++) { const im = G && G[dirOf(l)]; if (im) g.drawImage(im, (x0 + lw * l) * 1.5, (120 - 32) * 1.5, 64 * 1.5, 64 * 1.5); }
    for (const row of p.rows || []) {
      const m = row.off / 4096 - bar, y = 120 + m * 256;
      if (m < -0.02 || y > 520) continue;           // (from the shown bar down - nothing above the step zone)
      const col = row.jd !== undefined ? J_COLORS[row.jd] : 'rgb(140,140,140)';
      for (const n of row.notes) { const im = G && G[dirOf(n.lane)]; if (im) g.drawImage(tintImg(im, col), (x0 + lw * n.lane) * 1.5, (y - 32) * 1.5, 64 * 1.5, 64 * 1.5); }
    }
    if (A.barMark) for (let k = bar; k < bar + 2; k++) {
      const y = 88 + 256 * (k - bar);
      g.drawImage(A.barMark, (275.2 - 167) * 1.5, (y - 16) * 1.5, 334 * 1.5, 32 * 1.5);
      const D = A.num28, sz = 15 * 1.5; [...String(k + 1).padStart(3, '0')].forEach((c2, j) => { const im = D && D[+c2]; if (im) g.drawImage(im, (400 + (j - 1) * 10) * 1.5 - sz / 2, y * 1.5 - sz / 2, sz, sz); });
    }
    put(T.head[0], -0.5, -210, 430, 80); put(T.title[0], -0.5, -205, 380, 30);
    put(T.key[0], 210.7, 12, 248, 356);
    [[T.b1, -65], [T.b2, -12], [T.b3, 40], [T.b4, 91], [T.b5, 143]].forEach(([im, v]) => put(im && im[0], 208.7, v, 224, 44));
    [[1, 117.3, 194], [6, 220.3, 194], [16, 323.3, 194], [26, 323.3, 211]].forEach(([id, u, v]) => put(A.hints && A.hints[id], u, v, 100, 16));
    drawPointsPlate();
  },
  draw(t) {
    if (this.tc) return this.drawTC(t);
    menuBackground(t);
    const ps = this.ps, two = ps.length > 1, song = ps[0].song, el = (performance.now() - this.t0) / 1000;
    // (HP4: the scene's draw 0x800d9934 lays layout /0/5 'black01' over the background - black, alpha 0 -> 127
    // over 20 frames at 30 a second (its track 0) - then the dancer (0x800bfd18); the cards and the table come
    // after, undimmed (Dolphin screenshot: background at half brightness, cards not))
    // (DDR II: the same - its selResult has the black01 layouts too, and its results code is HP4's)
    if (HP4 || HP4BG.st) { g.fillStyle = `rgba(0,0,0,${Math.min(127, Math.round(el * 30 * 127 / 20)) / 255})`; g.fillRect(0, 0, W, H); }
    else { g.fillStyle = 'rgba(0,55,75,0.5)'; g.fillRect(0, 0, W, H); }
    // (the game draws dancer and effects into one depth buffer; here they're separate pictures, so the gloom lines
    // (effect 3) go behind the dancer and the rest in front, as on the Dolphin screenshots)
    // (DDR II: its results dancer code 0x800f14d8 and tables are HP4's - Dolphin memory copy: slot 0 at (12.5, 1.88,
    // 23.5), eye (0, 10, 65) -> (0, 7.5, 0), fov 45 (34.52 high))
    if (ps.length <= 2) { this.drawResultFx(el, 'back'); this.drawResultDancer(el); this.drawResultFx(el, 'front'); }
    if (A.img.resMany && A.img.resMany.cards[0] && (ps.length > 2 || HP4 || (A.img.resFew && A.img.resFew.table[0]))) { this.drawMany(t, el); return; }
    // RESULTS tab
    g.fillStyle = 'rgba(160,170,180,0.9)'; g.fillRect(468, -6, 344, 84);
    g.fillStyle = '#2f8fe0'; g.fillRect(476, -6, 328, 76);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(476, -6, 328, 30);
    if (!blit(A.img.resTitle, 640, 44, 1.25)) text('RESULTS', 640, 44, 36, '#fff', 'center');
    // grade cards: player 1 left of the jacket (far left and far right in VERSUS)
    // (3 / 4 players - PROVISIONAL layout, the Wii's is not known yet: two cards each side of the jacket)
    const many = ps.length > 2, MANY_X = [20, 236, 848, 1064];
    ps.forEach(p => this.drawCard(p, many ? MANY_X[p.idx] : two ? (p.idx ? 1044 : 40) : 252, el));
    // jacket in its frame
    const jx = 532, jy = 89, jw = 222, jh = 238;
    if (A.img.resJacketFrame) g.drawImage(A.img.resJacketFrame, jx, jy, jw, jh);
    else { g.fillStyle = '#333'; g.fillRect(jx, jy, jw, jh); }
    const jk = texture('jacket', song.jacket);
    if (jk.img) g.drawImage(jk.img, jx + 18, jy + 12, jw - 36, jw - 36);
    text(two ? (this.play.lanes === 8 ? 'DOUBLE VERSUS' : 'VERSUS') : this.play.lanes === 8 ? 'DOUBLE STYLE' : 'NORMAL STYLE', jx + jw / 2, jy + jh - 18, 18, '#fff', 'center');
    // counts panel: the game's 1-player panel (boxes left, labels right) or its VERSUS panel (1P left, 2P right)
    const sc = 1.48, py = 346;
    const panelImg = two ? A.img.resPanel2P : A.img.resPanel1P, px = two ? 322 : 330;
    if (many) {
      // each player's counts in a column under their card
      const rows = [['MARVELOUS', p => p.counts.MARVELOUS], ['PERFECT', p => p.counts.PERFECT], ['GREAT', p => p.counts.GREAT],
                    ['GOOD', p => p.counts.GOOD], ['MISS', p => p.counts.BOO + p.counts.ALMOST], ['O.K.', p => p.counts.OK],
                    ['NOT QUITE', p => p.counts.NG], ['MAX COMBO', p => p.maxCombo], ['SCORE', p => p.score]];
      ps.forEach(p => {
        const x = MANY_X[p.idx];
        g.fillStyle = 'rgba(20,60,140,0.85)'; g.fillRect(x, 346, 196, 236);
        rows.forEach(([lb, f], i) => {
          if (el < 0.15 + i * 0.08) return;
          text(lb, x + 10, 366 + i * 25, 14, '#bfe6ff');
          text(String(f(p)), x + 186, 366 + i * 25, 18, '#fff', 'right');
        });
      });
    } else {
      if (panelImg) g.drawImage(panelImg, 0, 0, 284 + (two ? 146 : 0), 198, px, py, (284 + (two ? 146 : 0)) * sc, 198 * sc);
      ps.forEach(p => this.drawCounts(p, px + (p.idx ? 416 : 141) * sc, py, sc, el));
    }
    if (!two) {
      // song title on the right where the game shows the dancer
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 1010 - ti.img.width * 0.75, 420, ti.img.width * 1.5, ti.img.height * 1.5);
      else if (song.custom || song.disc) { text(song.name.slice(0, 26), 1010, 440, 24, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 32), 1010, 468, 16, '#dff', 'center', 'normal'); }
      text('Speed x' + ps[0].o.speed, 1010, 500, 18, '#dff', 'center', 'normal');
      if (ps[0].failed) blit(A.img.failed, 1010, 300, 0.8, clamp(el - 1.2));
    } else {
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.6, 652, ti.img.width * 1.2, ti.img.height * 1.2);
      else if (song.custom || song.disc) text(song.name.slice(0, 40), 640, 668, 22, '#fff', 'center');
    }
    // DDR points (each player's own total)
    const pts = (p, x, align) => {
      if (!p.prof) return;
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(align === 'left' ? x : x - 150, 586 + (align === 'left' ? 50 : 0), 150, 22);
      const yy = align === 'left' ? 636 : 586;
      text('DDR POINTS', align === 'left' ? x + 75 : x - 75, yy + 11, 15, '#fff', 'center');
      text(String(p.prof.points).padStart(7, '0') + ' pts', x, yy + 42, 24, '#ffe86a', align);
    };
    if (many) ps.forEach(p => { if (p.prof) { text('DDR POINTS', MANY_X[p.idx] + 98, 598, 14, '#fff', 'center'); text(String(p.prof.points).padStart(7, '0') + ' pts', MANY_X[p.idx] + 98, 620, 20, '#ffe86a', 'center'); } });
    else {
      pts(ps[0], 28, 'left');
      if (two) pts(ps[1], 1252, 'right');
    }
    g.fillStyle = 'rgba(20,50,80,0.85)'; g.fillRect(1040, 640, 200, 34);
    text('Enter  CONTINUE', 1140, 657, 17, '#fff', 'center');
  },
  // 3 / 4 players (selResult CAE 0xedf20 the screen, 0x12b580 a card; laid out on the 854 x 480 screen, 1.5x
  // around the middle - checked against a Wii 4-player screenshot): the RESULTS tab (520, 11 / 29), the jacket
  // frame (520, 139) with the jacket (520, 128) at 0.5, the style words (520, 205), the judgment list (520, 327),
  // and the players' cards at (326, 122) (714, 122) (326, 327) (714, 327): card (0, 0) pivot (72, 99), PLAYER n
  // (0, -81), difficulty (0, -55), grade (0, 21). CHANGE INFO turns a card to its counts: window (0, 8) pivot
  // (58, 77), the eight counts at x 16.5, y -60 .. 45, the score at (32, 61) (last digit's middle on the place).
  // HP4 uses this layout for every number of players, on the Wii's 640 x 480 screen (around 320): 1-2 players
  // = selResult /0/0 (CAE 0x8c6e0) - the cards beside the jacket at (126, 122) (514, 122) and under the jacket
  // the big table (320, 327; pivot 215, 99) with player 1's counts in its left column (x 202, rows 237 + 19n,
  // score at 239, 390) and player 2's in the right (478 / 515); 3-4 players = /0/1 (CAE 0xd7f80, as DDR II's).
  drawMany(t, el) {
    // (DDR II with 1 / 2 players: selResult's 1-2 player screen, CAE 0x976c0 - laid out like HP4's: everything about
    // x 320, cards at (126, 122) / (514, 122), the counts at x 202 / 478 - checked against a Dolphin screenshot)
    const ps = this.ps, few = ps.length <= 2, M = few && !HP4 && A.img.resFew ? Object.assign({}, A.img.resMany, A.img.resFew) : A.img.resMany;
    const song = ps[0].song, X0 = HP4 || few ? 320 : 520;
    const RX = x => 640 + (x - X0) * 1.5, RY = y => y * 1.5;
    const spr = (im, x, y, px, py, sc = 1, a = 1) => { if (!im) return false; g.save(); g.globalAlpha *= a; g.translate(RX(x), RY(y)); g.scale(sc * 1.5, sc * 1.5); g.drawImage(im, -px, -py); g.restore(); return true; };
    // DDR II 1-2 players (fifo_ddr2_fail.dff, 60 a second): the pieces come in from the right, fading in, 3 frames
    // after the black dim starts: tab + title first, the player cards 4 frames later, the jacket frame + style
    // 8, the table 16. Each takes 20 frames: alpha linear 0 -> 255, x from 147 (854-wide units) to the right,
    // easing out (about (1 - u)^3: 108, 78, 55, 37, 23, 13, 6, 2, 0 left every 2 frames)
    const grp = (d, fn) => {
      if (HP4 || !few) return fn();
      const u = clamp((el - 0.05 - d / 60) * 3); if (u <= 0) return;
      g.save(); g.translate(147 * 1.5 * (1 - u) ** 3, 0); g.globalAlpha *= u; fn(); g.restore();
    };
    grp(0, () => { spr(M.titleBar, X0, 11, 123, 50); spr(M.title, X0, 29, 100, 19); });
    const jk = texture('jacket', song.jacket);
    const lanes8 = this.play.lanes === 8;
    grp(8, () => {
      if (HP4 || few) spr(M.frame, X0, 139, 90, 82);          // (the frame lies behind the jacket - depth 9 vs 8)
      if (jk.img) { const s = 256 * 0.5 * 1.5; g.drawImage(jk.img, RX(X0) - s / 2, RY(128) - s / 2, s, s); }
      if (!HP4 && !few) spr(M.frame, X0, 139, 90, 82);
      spr(M.styles[GROUP === 'sync' ? 3 : GROUP === 'friend' ? 4 : GROUP === 'family' ? 5 : lanes8 ? 6 : HP4 && this.play.mode === 'battle' ? 1 : 0], X0, 205, 85, 12);
    });
    const digits = (v, x, y, n, sc = 0.6, col) => {
      // (HP4: 0x800eebc4(handle, part, value, digits, 1) - the shared number layout's Num_00 parts at the row's
      // Num_00 (scale 0.75), each next digit 18 x 0.75 to the left; the digits take the row part's colour (layout
      // keys 37-39), the leading zeros colour 0x80808080 (grey, half alpha); the last digit always shows)
      if (few) {
        const h = 28 * 0.75 * 1.5, adv = 18 * 0.75 * 1.5, str = String(v).padStart(n, '0'), set = A.numbers && A.numbers.white;
        const lead = str.length - String(v).length;
        [...str].forEach((ch, k) => {
          const im = set && set[+ch], dx = RX(x) - adv * (str.length - 1 - k);
          const c = k < lead ? [128, 128, 128] : col || [255, 255, 255], a = k < lead ? 128 / 255 : 1;
          const ti = im && tintImg(im, `rgb(${c[0]},${c[1]},${c[2]})`);     // (GX: texture x the part's colour)
          g.save(); g.globalAlpha *= a;
          if (ti) g.drawImage(ti, dx - h / 2, RY(y) - h / 2, h, h); else text(ch, dx, RY(y), h, '#fff', 'center');
          g.restore();
        });
        return;
      }
      const h = 28 * sc * 1.5, adv = h * 0.66, str = String(v).padStart(n, '0'), set = A.numbers && A.numbers.white, right = RX(x) + adv / 2;
      [...str].forEach((ch, k) => { const im = set && set[+ch], dx = right - adv * (str.length - k - 0.5);
        if (im) { const w = im.width * h / im.height; g.drawImage(im, dx - w / 2, RY(y) - h / 2, w, h); } else text(ch, dx, RY(y), h, '#fff', 'center'); });
    };
    // DDR II WORKOUT (fifo_ddr2_wkres.dff, 854 x 480 units round the middle): the table is CALORIES BURNED
    // (/0/0/0/1 picture 9, at the counts' place) with two rows - CUMULATIVE in red (y 97), FOOT in green (y 129):
    // four whole digits in /0/0/0/9 at 0.85, x -167.9 + 15.3 n, the leading zeros grey at half alpha; '.' (comAF
    // 21) and three decimals at 0.51 from x -109.8, 9.15 apart, 4.8 higher. Here CUMULATIVE = the workout so far
    // with this song, FOOT = this song's steps (what the Wii counts in each is not traced). CHANGE RESULT shows
    // the counts.
    const wkCal = !HP4 && WK && few && !this.wkCounts && M.calTable;
    if (wkCal) grp(16, () => {
      spr(M.calTable, X0, 327, 215, 99);
      const p0 = ps[0], song = p0.kcalSteps ? p0.kcalSteps.kcal() : 0, cum = (WK.kcal || 0) + song;
      const X = u => 640 + u * 1.5, Y = v => 360 + v * 1.5;
      const row = (val, v, col) => {
        const str = Math.min(9999.999, val).toFixed(3), [ip, dp] = str.split('.'), ints = ip.padStart(4, '0'), lead = 4 - ip.length;
        // (selResult /0/0/0/9 holds only a '0' - the recording's values were all 0; the digits here are the results'
        // number set, as the counts use)
        const D10 = (A.numbers && A.numbers.white) || (M.digits && M.digits.length > 9 ? M.digits : null);
        const draw = (im, u, vv, sz, c, a) => { if (!im) return; const ti = tintImg(im, c); g.save(); g.globalAlpha *= a; g.drawImage(ti, X(u) - sz * 0.75, Y(vv) - sz * 0.75, sz * 1.5, sz * 1.5); g.restore(); };
        [...ints].forEach((ch, k) => draw(D10 && D10[+ch], -167.9 + 15.3 * k, v, 23.8, k < lead && k < 3 ? 'rgb(128,128,128)' : col, k < lead && k < 3 ? 0.5 : 1));
        draw(A.num28 && A.num28[21], -109.8, v - 4.8, 14.3, col, 1);
        [...dp].forEach((ch, k) => draw(D10 && D10[+ch], -101.4 + 9.15 * k, v - 4.8, 14.3, col, 1));
      };
      row(cum, 97, 'rgb(255,0,0)'); row(song, 129, 'rgb(54,255,0)');
      // with a CALORIES BURNED goal (fifo_ddr2_wkgoal.dff): TO REACH THE GOAL - box /0/0/0/7 (254 x 48) at (-0.5, 21),
      // 'Kcal' /0/0/0/8 at (97.5, 29); what's left in comAF's number set at 0.75 (21 px), white: four whole digits
      // from x -29.5, 13.5 apart (leading zeros grey, half alpha), '.' at 24.5, three decimals from 37.2, 13.5 apart
      if (WK.target === 'kcal' && M.goalBox) {
        const left = Math.max(0, (WK.goal || 0) - cum), [ip, dp] = Math.min(9999.999, left).toFixed(3).split('.'), ints = ip.padStart(4, '0'), lead = 4 - ip.length;
        const put = (im, u, v, w, h, c, a) => { if (!im) return; const ti = c ? tintImg(im, c) : im; g.save(); g.globalAlpha *= a; g.drawImage(ti, X(u) - w * 0.75, Y(v) - h * 0.75, w * 1.5, h * 1.5); g.restore(); };
        put(M.goalBox, -0.5, 21, 254, 48, null, 1); put(M.goalKcal, 97.5, 29, 36, 16, null, 1);
        const N = A.num28 || [];
        [...ints].forEach((ch, k) => put(N[+ch], -29.5 + 13.5 * k, 25, 21, 21, k < lead && k < 3 ? 'rgb(128,128,128)' : null, k < lead && k < 3 ? 0.5 : 1));
        put(N[21], 24.5, 25, 21, 21, null, 1);
        [...dp].forEach((ch, k) => put(N[+ch], 37.2 + 13.5 * k, 25, 21, 21, null, 1));
      }
      // with a PLAY TIME goal (fifo_ddr2_wkgoaltime.dff): the same box, no 'Kcal', the time left as HH:MM:SS - comAF
      // digits and ':' (20) at 0.75, white, from x -54, 13.5 apart (no grey zeros)
      if (WK.target === 'time' && M.goalBox) {
        const left = Math.max(0, Math.round((WK.goal || 0) - (WK.secs || 0) - Math.max(0, Math.min(this.play.endT, ps[0].failed ? ps[0].failAt : this.play.endT))));
        const str = [Math.floor(left / 3600), Math.floor(left / 60) % 60, left % 60].map(v => String(Math.min(99, v)).padStart(2, '0')).join(':');
        const put = (im, u) => { if (im) g.drawImage(im, X(u) - 21 * 0.75, Y(25) - 21 * 0.75, 21 * 1.5, 21 * 1.5); };
        if (M.goalBox) g.drawImage(M.goalBox, X(-0.5) - 254 * 0.75, Y(21) - 48 * 0.75, 254 * 1.5, 48 * 1.5);
        [...str].forEach((ch, k) => put(A.num28 && A.num28[ch === ':' ? 20 : +ch], -54 + 13.5 * k));
      }
    });
    // DDR II's lessons (fifo_ddr2_lessonres.dff): table picture 10 - Awesome!! / Pretty Cool!! / Too Fast!! / Too Slow!! /
    // Try Harder!! / O.K. / NOT QUITE / MAX COMBO / SCORE, the counts in the rows' places of the table without
    // MARVELOUS, coloured yellow / green / blue / pink / red / yellow / red / yellow
    else if (few && ps[0].lessonD2 && M.lessonTable) grp(16, () => {
      spr(M.lessonTable, X0, 327, 215, 99);
      const p = ps[0], LC = [[255, 246, 0], [54, 255, 0], [33, 198, 236], [241, 36, 195], [241, 36, 36], [255, 246, 0], [255, 0, 0], [243, 253, 0]];
      [...p.lessonCounts, p.counts.OK, p.counts.NG, p.maxCombo].forEach((v, i) => digits(v, 202, 256 + i * 19, 4, 0.6, LC[i]));
      digits(p.score, 221.25, 409, 7);
    });
    else if (few) grp(16, () => {
      // the table: with or without its MARVELOUS row (the option); each player's column of counts
      // (HP4: one player gets the table without the second player's column - pictures 2 / 3)
      const marv = ps[0].o.marvelous !== false, tb = M.table && M.table[(ps.length === 1 ? 2 : 0) + (marv ? 0 : 1)];
      spr(tb, X0, 327, 215, 99);
      // (the rows' digit colours: the 1-2 player layout's Num_00 parts 15-22 / 24-31, keys 37-39)
      const ROWC = [[199, 254, 255], [255, 246, 0], [54, 255, 0], [33, 198, 236], [241, 36, 36], [255, 246, 0], [255, 0, 0], [243, 253, 0]];
      ps.forEach(p => {
        const x = p.idx ? 478 : 202, sx = p.idx ? 515 : 239;
        const vals = [p.counts.MARVELOUS, p.counts.PERFECT, p.counts.GREAT, p.counts.GOOD, p.counts.BOO + p.counts.ALMOST, p.counts.OK, p.counts.NG, p.maxCombo];
        const cols = marv ? ROWC : ROWC.slice(1);
        // (DDR II: the counts and the score come in with the table - fifo_ddr2_tryagain2.dff)
        // (DDR II: they come in with the table at 0 and count up together from frame 47 - every row at the same
        // quickening pace, each stopping at its own number: 3 / 12 / 30 / 57 after 6 / 12 / 18 / 24 frames - and the
        // score with them (8385 / 33240 / 75968 / 137509 / 197101 at 5 / 8 / 11 / 14 / 17 frames; done as the grade
        // comes up): the user's 60 fps Dolphin video 2026-11-15_20-53-11.mp4, 232.8 s. The curves are fitted)
        const rm = HP4 ? 1e9 : Math.max(0, el * 60 - 47), roll = v => Math.min(v, Math.floor(rm * rm / 11)), rollS = v => Math.min(v, Math.floor(185 * Math.pow(rm, 2.5)));
        (marv ? vals : vals.slice(1)).forEach((v, i) => { if (!HP4 || el > 0.4 + i * 0.06) digits(roll(v), x, 237 + (marv ? 0 : 19) + i * 19, 4, 0.6, cols[i]); });
        // (DDR II: the score's Num_00 at x 221.25 / 497.25, 7 digits - the Dolphin screenshot shows 7)
        if (HP4 ? el > 1 : true) { if (HP4) digits(p.score, sx, 390, 9); else digits(rollS(p.score), p.idx ? 497.25 : 221.25, 390 + (marv ? 0 : 19), 7); }
      });
    });
    else spr(M.list, X0, 327, 112, 99);
    const SPOTS = few ? [[126, 122], [514, 122]] : HP4 ? [[126, 122], [514, 122], [126, 327], [514, 327]] : [[326, 122], [714, 122], [326, 327], [714, 327]];
    ps.forEach(p => grp(4, () => {
      const [cx, cy] = SPOTS[p.idx] || SPOTS[0], di = DIFFS.findIndex(d => d[0] === (p.showDiff || p.diff));
      spr(M.cards[p.idx], cx, cy, 72, 99);
      spr(M.players[p.idx], cx, cy - 81, 50, 13);
      if (this.info && !few) {
        spr(M.counts, cx, cy + 8, 58, 77);
        const vals = [p.counts.MARVELOUS, p.counts.PERFECT, p.counts.GREAT, p.counts.GOOD, p.counts.BOO + p.counts.ALMOST, p.counts.OK, p.counts.NG, p.maxCombo];
        const row = (v, x, y, n) => {
          const h = 28 * 0.6 * 1.5, adv = h * 0.66, str = String(v).padStart(n, '0'), set = A.numbers && A.numbers.white, right = RX(x) + adv / 2;
          [...str].forEach((ch, k) => { const im = set && set[+ch], dx = right - adv * (str.length - k - 0.5);
            if (im) { const w = im.width * h / im.height; g.drawImage(im, dx - w / 2, RY(y) - h / 2, w, h); } else text(ch, dx, RY(y), h, '#fff', 'center'); });
        };
        vals.forEach((v, i) => row(v, cx + 16.5, cy - 60 + i * 15, 4));
        row(p.score, cx + 32, cy + 61, 7);
        return;
      }
      if (!spr(M.diffs[di], cx, cy - 55, 60, 11)) text(DIFFS[di][1], RX(cx), RY(cy - 55), 18, DIFFS[di][2], 'center');
      // (DDR II, 1-2 players: the letter comes up 79 frames after the dim starts and grows - 0.53, 0.89, 1.19, 1.62,
      // 1.79, 1.84 every 2 frames (fifo_ddr2_tryagain2.dff) - and rests at 1.0 (fifo_ddr2_resstill.dff); the way back
      // down from 1.84 is ASSUMED to be READY's (1.73, 1.50, 1.22, 1.0))
      const GR_D2 = [0.53, 0.888, 1.188, 1.616, 1.793, 1.844, 1.73, 1.5, 1.22, 1.0];
      if (!HP4 && few ? el > 79 / 60 : el > 1.2) {
        const gf = Math.floor((el - 79 / 60) * 30);
        const k = !HP4 && few ? 1 : clamp((el - 1.2) * 5), sc = !HP4 && few ? 1.5 * GR_D2[Math.min(GR_D2.length - 1, gf)] : 1.5 * (1.5 - 0.5 * k);
        const gi = A.img.grades && A.img.grades[p.gr];
        // (the grade layout 0x1b47c0 / 0x1cb760 hangs off the card's dummy01 at (0, 29): letter (0, -8), NEW RECORD (-5, -12))
        // (DDR II, 1-2 players - the user's 60 fps Dolphin video 2026-11-15_20-53-11.mp4, 233.3 s: the letter SPINS in,
        // a quarter turn anticlockwise at first, level 13 steps (26 frames) later; its true size each 2 frames, from
        // the letter's outline: GS_D2 (the FIFO's 0.53-1.84 were the turned letter's outer box). Angles by eye)
        const GS_D2 = [0.30, 0.61, 0.94, 1.05, 1.17, 1.30, 1.36, 1.42, 1.41, 1.38, 1.31, 1.22, 1.09, 1.06, 1.0];
        const GA_D2 = [90, 88, 78, 58, 50, 44, 36, 30, 25, 19, 12, 6, 3, 0, 0];
        const spin = !HP4 && few && gi, gs = spin ? GS_D2[Math.min(14, Math.max(0, gf))] : 1, ga = spin ? GA_D2[Math.min(14, Math.max(0, gf))] : 0;
        if (spin) { const w = gi.width * 1.5 * gs, h = gi.height * 1.5 * gs; g.save(); g.translate(RX(cx), RY(cy + 21)); g.rotate(-ga * Math.PI / 180); g.drawImage(gi, -w / 2, -h / 2, w, h); g.restore(); } else
        if (!blit(gi, RX(cx), RY(cy + 21), sc, k)) text(p.gr, RX(cx), RY(cy + 21), 90, '#ffd23c', 'center');
        // NEW RECORD across the letter (its size and tilt measured on the Wii screenshot: 187 px wide, 6 degrees)
        // (the Wii shows it on an E too: 3-player screenshot, every card E with NEW RECORD)
        if (p.newRecord && A.img.newRecord) {
          // (DDR II: it comes in with the letter from its second step, growing with it and tilted a little more)
          const im = A.img.newRecord, w = 187 * (spin ? gs : 1), h = im.height * w / im.width;
          if (!spin || gf >= 1) { g.save(); g.globalAlpha *= k; g.translate(RX(cx - 5), RY(cy + 17)); g.rotate(-(6 + ga / 5) * Math.PI / 180); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); }
        }
      }
    }));
    drawPointsPlate();
    // (the game's EXIT / CHANGE INFO buttons, bottom right)
    // ((A) EXIT: comAF hint 1 at the bottom right - Dolphin screenshot, DDR II 1 player)
    if (few && A.hints && A.hints[1]) keyHints('', !HP4 && WK ? [1, 16] : [1], false);      // (WORKOUT: EXIT + CHANGE RESULT - Wii)
    else {
      g.fillStyle = 'rgba(20,50,80,0.85)'; g.fillRect(860, 640, 160, 34); if (!few) g.fillRect(1030, 640, 210, 34);
      text('Enter  EXIT', 940, 657, 17, '#fff', 'center'); if (!few) text('Tab  CHANGE INFO', 1135, 657, 17, '#fff', 'center');
    }
  },
  drawCard(p, cx, el) {
    const cy = 46, cw = 196, ch = 276;
    if (A.img.card) g.drawImage(A.img.card, cx, cy, cw, ch);
    g.fillStyle = A.img.card ? 'rgba(160,236,255,0.55)' : '#7fd4f4'; g.fillRect(cx, cy, cw, ch);
    g.strokeStyle = p.idx ? '#ffd8e6' : '#e8fbff'; g.lineWidth = 4; g.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
    text('PLAYER ' + (p.idx + 1), cx + cw / 2, cy + 30, 22, p.idx ? '#ffe4ee' : '#e8f4ff', 'center');
    if (this.ps.length > 1 && p.name) text(p.name, cx + cw / 2, cy + ch + 13, 18, '#fff', 'center');
    const di = DIFFS.findIndex(d => d[0] === (p.showDiff || p.diff));
    const dl = A.img.diffLabel && A.img.diffLabel[di];
    if (!blit(dl, cx + cw / 2, cy + 64, 1.3)) text(DIFFS[di][1], cx + cw / 2, cy + 64, 20, DIFFS[di][2], 'center');
    if (el > 1.2) {
      const k = clamp((el - 1.2) * 5), sc = 1.45 * (1.5 - 0.5 * k);
      const gi = A.img.grades && A.img.grades[p.gr];
      if (!blit(gi, cx + cw / 2, cy + 170, sc, k)) text(p.gr, cx + cw / 2, cy + 170, 90, '#ffd23c', 'center');
      if (p.fc && A.img.resFull) blit(A.img.resFull[p.fc === 5 ? 3 : p.fc === 4 ? 0 : p.fc === 3 ? 2 : 1] || A.img.resFull[0], cx + cw / 2, cy + 248, 0.95, k);
      if (p.newRecord) {
        g.save(); g.translate(cx + cw / 2, cy + 160); g.rotate(-0.12);
        if (!blit(A.img.newRecord, 0, 0, 1.15, k)) text('NEW RECORD', 0, 0, 26, '#ff60a0', 'center');
        g.restore();
      }
    }
  },
  drawCounts(p, right, py, sc, el) {
    const vals = [p.counts.MARVELOUS, p.counts.PERFECT, p.counts.GREAT, p.counts.GOOD, p.counts.BOO + p.counts.ALMOST,
                  p.counts.OK, p.counts.NG, p.maxCombo, p.score];
    const cols = ['white', 'gold', 'green', 'sky', 'red', 'gold', 'red', 'gold', 'white'];
    vals.forEach((v, i) => {
      const y = py + (10 + i * 19.05) * sc, shown = clamp((el - 0.15 - i * 0.08) * 4);
      if (shown <= 0) return;
      const n = i === 8 ? 7 : 4, str = String(v).padStart(n, '0'), lead = str.length - String(v).length;
      const set = A.numbers && A.numbers[cols[i]], dim = A.numbers && A.numbers.white;
      g.globalAlpha = shown;
      const h = 33, step = h * 0.6;
      if (set && set[0]) {
        for (let k = str.length - 1, x = right; k >= 0; k--, x -= step) {
          const im = (k < lead ? dim : set)[+str[k]];
          g.globalAlpha = shown * (k < lead ? 0.28 : 1);
          g.drawImage(im, x - step - 3, y - h / 2 - 1, h, h);
        }
      } else text(str, right, y, 24, '#fff', 'right');
      g.globalAlpha = 1;
    });
  },
};

// DDR points: the challenge task card, then any songs it unlocked
const Points = {
  bgm: 'MU_BGM_FREE',
  with(a, rest = []) { this.a = a; this.rest = rest; return this; },
  enter() {
    if (!this.a) { go(Select); return; }
    this.t0 = performance.now(); this.page = 0; this.nextShown = false;
    this.a.tasks.forEach((k, i) => { if (k.done) setTimeout(() => { if (scene === this && this.page === 0) sfx('SE_RES_CLEAR01'); }, 500 + i * 300); });
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    // after the task card: the NEXT CHALLENGE TASK (once the task has stepped on)
    if (a === 'START' && this.page === 0 && this.a.next && !this.nextShown) { this.nextShown = true; this.t0 = performance.now(); return; }
    if (a === 'START' && this.page < this.a.unlocked.length) { this.page++; this.t0 = performance.now(); sfx('SE_DDR_FULLCOMBO'); return; }
    // the last task card shown names a specified song: the song list opens on it
    const card = this.nextShown && this.a.next ? this.a.next.song : this.a.taskSong;
    if (card && card.slot) this.jump = card.slot;
    if (this.rest.length) { const j = this.jump; go(Points.with(this.rest[0], this.rest.slice(1))); this.jump = this.jump || j; return; }
    if (this.jump) { S.lastSlot = this.jump; saveSettings(); Select.inFolder = null; Select.query = ''; Select.favOnly = false; }
    this.jump = null;
    go(Select); sfx('VO_NAR_SELECTMUSIC');
  },
  draw(t) {
    menuBackground(t);
    const el = (performance.now() - this.t0) / 1000, A_ = this.a;
    if (this.page > 0) {             // NEW SONG unlocked
      const u = A_.unlocked[this.page - 1], song = u.songs[0];
      g.fillStyle = 'rgba(0,55,75,0.45)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#4aa8f0'; g.fillRect(320, 140, 640, 420);
      g.fillStyle = '#0d2f8a'; g.fillRect(336, 156, 608, 372);
      text('DDR POINTS REACHED!!', W / 2, 200, 34, '#7fe8ff', 'center');
      text('NEW SONG!!', W / 2, 262, 26, '#fff', 'center');
      text(`"${u.label}" Unlocked!`, W / 2, 302, 24, '#fff', 'center');
      const jk = texture('jacket', song.jacket);
      if (jk.img) g.drawImage(jk.img, W / 2 - 80, 340, 160, 160);
      text('Enter  CONFIRM', 900, 545, 16, '#fff', 'right');
      return;
    }
    // challenge task card (the NEXT CHALLENGE TASK card is pink and has only STILL NEEDED)
    const nextCard = this.page === 0 && this.nextShown && A_.next;
    const x = 210, y = 60, w = 860, h = 600;
    g.fillStyle = nextCard ? '#f05ab0' : '#5ab4f0'; g.fillRect(x, y, w, h);
    g.fillStyle = nextCard ? '#c8287e' : '#2f86da'; g.fillRect(x + 10, y + 10, w - 20, h - 20);
    text(nextCard ? 'NEXT CHALLENGE TASK' : 'CHALLENGE TASK', x + 60, y + 50, 34, '#fff');
    if (A_.who) text(A_.who, x + w - 40, y + 50, 26, '#ffe86a', 'right');
    g.fillStyle = nextCard ? '#6a1446' : '#103c8c'; g.fillRect(x + 30, y + 80, 330, 70);
    const tsong = nextCard ? A_.next.song : A_.taskSong;
    if (tsong) {
      // the song's title picture (2Dcommon/comAF_US.bin /10): the title and the artist under it, in the
      // game's yellow lettering - the same picture the game puts on this card
      const tp = tsong.title !== undefined && tsong.title !== null ? texture('title', tsong.title) : null;
      if (tp && tp.img) {
        const sc = Math.min(1.3, 300 / tp.img.width, 62 / tp.img.height);
        g.drawImage(tp.img, x + 195 - tp.img.width * sc / 2, y + 115 - tp.img.height * sc / 2, tp.img.width * sc, tp.img.height * sc);
      } else {
        text(tsong.name, x + 195, y + 105, 22, '#fff86a', 'center');
        if (tsong.artist) text(tsong.artist, x + 195, y + 132, 16, '#fff86a', 'center');
      }
      text('Earn bonus points by clearing the specified', x + 390, y + 103, 18, '#ffb050');
      text('song under the following conditions.', x + 390, y + 127, 18, '#ffb050');
    } else {
      text('ANY SONG', x + 195, y + 115, 32, '#4ab4ff', 'center');
      text('Earn bonus points by clearing any song', x + 390, y + 103, 18, '#ffb050');
      text('under the following conditions.', x + 390, y + 127, 18, '#ffb050');
    }
    (nextCard ? A_.next.rows : A_.tasks).forEach((k, i) => {
      const ry = y + 168 + i * 82;
      g.fillStyle = '#0f2a66'; g.fillRect(x + 30, ry, w - 60, 70);
      text(String(i + 1), x + 58, ry + 35, 40, '#fff', 'center');
      text(`${k.label} for ${k.pts} DDR points.`, x + 90, ry + 35, 21, '#fff');
      const appear = clamp((el - 0.5 - i * 0.3) * 6);
      // each row gets a stamp: CLEARED! (gold) or TRY AGAIN (brown) - the Wii's result card
      if (!nextCard && appear > 0) {
        g.save(); g.translate(x + w / 2 + 40, ry + 35); g.rotate(-0.12); const s = 1.6 - 0.6 * appear; g.scale(s, s);
        g.globalAlpha = appear; text(k.done ? 'CLEARED!' : 'TRY AGAIN', 0, 0, 52, k.done ? '#ffc030' : '#c8783c', 'center'); g.globalAlpha = 1; g.restore();
      }
    });
    const by = y + h - 76;
    g.fillStyle = nextCard ? '#a81e68' : '#1f5cb8'; g.fillRect(x + 10, by - 20, w - 20, 86);
    const nx = nextUnlock(A_.after);
    if (nextCard) {
      if (nx) { text('STILL NEEDED', x + w - 190, by, 20, '#bfe6ff', 'center'); text(Math.max(0, nx.at - A_.after) + ' pts', x + w - 190, by + 34, 30, '#fff', 'center'); }
      text('Enter  CONFIRM', x + w - 30, y + h + 22, 16, '#fff', 'right');
      return;
    }
    const cols = [['PLAY POINTS', A_.play], ['BONUS POINTS', A_.bonus],
                  nx ? ['STILL NEEDED', Math.max(0, nx.at - A_.after)] : ['TOTAL', A_.after]];
    if (nx) text('Next: ' + nx.label + ' at ' + nx.at + ' pts', x + 30, y + h + 22, 16, '#fff');
    cols.forEach(([label, v], i) => {
      const cx = x + 150 + i * 280;
      text(label, cx, by, 20, '#bfe6ff', 'center');
      text(String(v) + ' pts', cx, by + 34, 30, '#fff', 'center');
    });
    text('Enter  CONFIRM', x + w - 30, y + h + 22, 16, '#fff', 'right');
  },
};

// ---------------------------------------------------------------- main loop
cv.addEventListener('click', () => { audio(); if (LEAVE) return; LAST_ACTION = 'START'; if (scene && scene.click) scene.click(); });
// ---- cabinet lights (Ultimarc PAC Drive): a panel's light is on while it's stepped on
const Lights = {
  last: '', test: 0, ok: false,
  outputOf(act) {
    if (S.lightMap && S.lightMap[act]) return Math.max(0, S.lightMap[act]);
    const m = /^P([1-4])([LDUR])$/.exec(act);
    return m ? (m[1] - 1) * 4 + 'LDUR'.indexOf(m[2]) + 1 : 0;
  },
  tick() {
    const bits = [0, 0, 0, 0];
    if (this.test) {                              // light test: each output in turn
      const k = Math.floor((performance.now() - this.test) / 250);
      if (k >= 16) this.test = 0; else bits[0] = 1 << k;
    } else if (scene === Options && Options.page && Options.page.name === 'LIGHTS'
               && (Options.page.rows[Options.row] || {}).light) {
      // choosing a pin: that pin lights up so you can see which light it is
      const o = this.outputOf(Options.page.rows[Options.row].light) - 1;
      if (o >= 0) bits[o >> 4] |= 1 << (o & 15);
    } else if (S.lights !== false) {
      for (const pl of ['P1', 'P2', 'P3', 'P4']) for (const d of 'LDUR') {
        if (!input.isDown(pl + d)) continue;
        const o = this.outputOf(pl + d) - 1;
        if (o >= 0 && o < 64) bits[o >> 4] |= 1 << (o & 15);
      }
    }
    const key = bits.join(',');
    if (key === this.last) return;
    this.last = key;
    fetch('/api/lights', { method: 'POST', body: JSON.stringify({ bits }), keepalive: true }).catch(() => {});
  },
};

// the FRAME RATE option: draw at most 60 / 120 times a second (the browser draws once per screen refresh, so
// this can only lower the rate; everything in the game runs on time, not on frames)
let lastFrameMs = 0;
// frame times kept for the F3 counter
const FPS = { n: [] };
// one frame: read the inputs, update and draw the current scene, then ask for the next frame
function frame(ms) {
  const cap = S.fps === '60' ? 60 : S.fps === '120' ? 120 : 0;
  if (cap) {
    const step = 1000 / cap;
    if (ms - lastFrameMs < step - 1.5) { requestAnimationFrame(frame); return; }
    lastFrameMs = ms - lastFrameMs < step * 2 ? lastFrameMs + step : ms;   // keep an even beat
    if (lastFrameMs > ms) lastFrameMs = ms;
  }
  input.poll();
  try { Lights.tick(); } catch (e) {}
  const t = ms / 1000;
  try {
    if (LEAVE && caeFrame(LEAVE.t0) >= LEAVE_FRAMES) goNow(LEAVE.next);
    if (scene && scene.update) scene.update();
    voiceTick();
    if (scene) scene.draw(t);
    if (typeof BTNASK !== 'undefined' && BTNASK && !YNASK) BtnWin.draw(BTNASK, t);
    if (typeof MSGASK !== 'undefined' && MSGASK) drawMsg(MSGASK);
    if (typeof YNASK !== 'undefined' && YNASK) YesNo.draw(YNASK.msg, YNASK.i, t);
    // the FPS counter: frames drawn in the last second, top right, over everything
    FPS.n.push(ms); while (FPS.n.length && ms - FPS.n[0] > 1000) FPS.n.shift();
    if (S.showFps) {
      const f = FPS.n.length;
      g.save(); g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W - 92, 6, 86, 26);
      text(f + ' FPS', W - 12, 19, 18, f >= 55 ? '#7dff7d' : f >= 30 ? '#ffe86a' : '#ff6a6a', 'right');
      g.restore();
    }
  } catch (e) {
    console.error(e);
    g.fillStyle = '#300'; g.fillRect(0, H - 40, W, 40);
    text('Error: ' + e.message, 20, H - 20, 18, '#fff', 'left', 'normal');
  }
  requestAnimationFrame(frame);
}
go(Boot);
requestAnimationFrame(frame);

// (workout overlays: the counter while dancing, the running total on the song select)
{
  const pd = Play.draw;
  Play.draw = function (t) {
    pd.call(this, t);
    if (this.mode === 'gc' && GC) gcPlayBar(this);
    if (this.team) {
      const p0 = this.ps[0], rows = p0.rows, t3 = this.now(), LL = this.layout();
      p0.idx = 0; p0.drawOwner = undefined; p0.name = this.teamNames.join(' & ');
      const now = this.teamNow(), next = this.team.cuts.find(i => rows[i].t > t3);
      // whose turn: a tag over that player's field
      const La = LL[now] || LL[0];
      text('YOUR TURN', La.x0 + La.lw * this.lanes / 2, 150, 20, now ? '#ff6a8a' : '#5ab8ff', 'center');
      if (next !== undefined) {
        const dt = rows[next].t - t3, who = rows[next].owner, L0 = LL[who] || LL[0];
        if (dt <= 3 && dt > 0) {
          const col = who ? '#ff6a8a' : '#5ab8ff', fl = 0.55 + 0.45 * Math.abs(Math.sin(t3 * 8));
          g.save(); g.globalAlpha = fl;
          text('GET READY', L0.x0 + L0.lw * this.lanes / 2, 300, 40, col, 'center');
          text('PLAYER ' + (who + 1), L0.x0 + L0.lw * this.lanes / 2, 344, 28, '#fff', 'center');
          g.restore();
          // the first arrows of the next turn, waiting at the bottom, with the count
          const yb = H - 90, size = L0.lw - 6;
          for (const nt of rows[next].notes) {
            const x = L0.x0 + nt.lane * L0.lw + L0.lw / 2, d = nt.lane % 4;
            const sp = A.c8 && A.noteC8 ? A.noteC8(0, 0, 0, d, false) : null;
            g.save(); g.globalAlpha = 0.6 + 0.4 * fl;
            if (sp) g.drawImage(sp, x - size / 2, yb - size / 2, size, size); else drawArrow(4, x, yb, d, size);
            g.restore();
          }
          num28(String(Math.ceil(dt)), L0.x0 + L0.lw * this.lanes / 2, yb - 70, 64, 'center', 1);
        }
      }
    }
    if (S.songProgress && !DEMO.on) {                    // SONG PROGRESS (a PC extra): first step to last step
      const t2 = this.now(), first = Math.min(...this.ps.map(p => p.notes.length ? p.notes[0].t : 0)), last = this.lastNoteT;
      // a tall bar at the left edge, filling from the bottom up through the rainbow
      const k2 = clamp((t2 - first) / Math.max(0.1, last - first)), bx = 12, bw = 10, top = 110, bot = H - 30, bh = bot - top;
      g.save(); g.globalAlpha = 0.9;
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(bx - 2, top - 2, bw + 4, bh + 4);
      const gr = g.createLinearGradient(0, bot, 0, top);
      ['#ff2a2a', '#ff9a1a', '#ffe81a', '#3cff4a', '#2ad8ff', '#3a5cff', '#c23cff'].forEach((c, i, L) => gr.addColorStop(i / (L.length - 1), c));
      g.fillStyle = gr; g.fillRect(bx, bot - bh * k2, bw, bh * k2);
      g.fillStyle = '#fff'; g.fillRect(bx - 3, bot - bh * k2 - 1, bw + 6, 2);
      g.restore();
    }
    if (this.mode === 'workout' && WK && this.ps && this.ps[0]) {
      const s2 = Math.max(0, this.now()), secs = WK.secs + Math.min(s2, this.endT);
      if (!HP4) wkTimer(secs);
      else workoutBar(WK.kcal + (this.ps[0].kcalSteps ? this.ps[0].kcalSteps.kcal() : 0), secs);
    }
  };
  const sd = Select.draw;
  Select.draw = function (t) { sd.call(this, t); if (WK && HP4) workoutBar(WK.kcal, WK.secs);     // (DDR II's song select shows nothing - Wii)
  if (GC) gcSelectBar(); };
  const si = Select.input;
  Select.input = function (a, p) {
    if (GC && p && a === 'BACK' && !this.stage && !this.join && !this.inFolder && this.typing === null) { sfx('SE_SYS_WINDOWOUT'); GC = null; go(GCSel); return; }
    if (WK && p && a === 'BACK' && !this.stage && !this.join && !this.inFolder && this.typing === null) {
      // (DDR II: going back to the WORKOUT MENU resets the calories - it asks first, NO chosen; Wii)
      if (!HP4) { askYesNo('Returning to the Workout Menu\nwill reset calorie information.', true, () => { wkSessionEnd(); WK = null; go(WorkoutSet); }); return; }
      sfx('SE_SYS_WINDOWOUT'); go(WK.songs ? WorkoutResult : WorkoutSet); if (!WK.songs) WK = null; return;
    }
    return si.call(this, a, p);
  };
}

// (3 / 4 players on song select: their picks show as the game's markers on SELECT DIFFICULTY)

// TEAM: its split by player over the results
{ const draw0 = Results.draw; Results.draw = function (t, ...rest) { draw0.call(this, t, ...rest); if (this.play && this.play.team) teamStatsPanel(this.play); }; }

// the server quits when the game window closes (server.py watch_pages): say we're here every 5 s, and goodbye
// when the page goes away (a reload says hello again before the server's 6 s are up)
{ const alive = () => fetch('/api/alive').catch(() => {}); alive(); setInterval(alive, 5000);
  addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/bye', '{}'); } catch (e) {} }); }
