// ONLINE VERSUS (a PC extra): two copies of DDR II PC, each with its own disc, play the same song together over
// the internet. No server of ours: the browsers connect directly (WebRTC). The host's game makes a code, the
// friend pastes it and sends back a reply code; a public STUN server only tells each side its own address.
// Only small messages go across: the song picked, ready / go, and each player's judgments as they happen.
// Each game judges its own steps on its own computer, so the delay between the two never touches timing.
(function () {
  const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  const pack = async obj => {           // JSON -> deflate -> base64url, so the code is short enough to paste
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let out = bytes;
    try { out = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) {}
    let s = ''; out.forEach(b => s += String.fromCharCode(b));
    return 'DDR2-' + (out === bytes ? 'J' : 'Z') + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unpack = async code => {
    code = String(code || '').trim().replace(/\s+/g, '');
    const m = /^DDR2-([JZ])(.+)$/.exec(code); if (!m) throw new Error('That is not a DDR II PC code.');
    const bin = atob(m[2].replace(/-/g, '+').replace(/_/g, '/')), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const raw = m[1] === 'Z' ? new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : bytes;
    return JSON.parse(new TextDecoder().decode(raw));
  };
  const gathered = pc => new Promise(res => {          // wait for every address (no trickle: one code each way)
    if (pc.iceGatheringState === 'complete') return res();
    const done = () => { if (pc.iceGatheringState === 'complete') res(); };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(res, 4000);
  });

  // the connection and its messages
  const Net = {
    pc: null, ch: null, host: false, open: false, peerName: '', peerDiff: null, peerOpts: null, rtt: 0, handlers: {}, log: [],
    reset() { try { this.ch && this.ch.close(); this.pc && this.pc.close(); } catch (e) {} Object.assign(this, { pc: null, ch: null, open: false, peerName: '', peerDiff: null, rtt: 0 }); },
    send(m) { if (this.open) try { this.ch.send(JSON.stringify(m)); } catch (e) {} },
    wire(ch) {
      this.ch = ch;
      ch.onopen = () => { this.open = true; this.send({ t: 'hello', name: DATA.current || 'PLAYER' }); if (this.host) this.pinger(); };
      ch.onclose = () => { this.open = false; this.closed = true; };
      ch.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.on(m); };
    },
    pinger() { clearInterval(this.pt); this.pt = setInterval(() => this.send({ t: 'ping', a: performance.now() }), 2000); },
    on(m) {
      if (m.t === 'hello') this.peerName = String(m.name || 'PLAYER').slice(0, 16);
      else if (m.t === 'ping') this.send({ t: 'pong', a: m.a });
      else if (m.t === 'pong') { this.rtt = performance.now() - m.a; this.send({ t: 'rtt', v: this.rtt }); }
      else if (m.t === 'rtt') this.rtt = m.v;
      const h = this.handlers[m.t]; if (h) h(m);
    },
    async hostStart() {
      this.reset(); this.host = true; this.closed = false;
      this.pc = new RTCPeerConnection({ iceServers: STUN });
      this.wire(this.pc.createDataChannel('ddr', { ordered: true }));
      await this.pc.setLocalDescription(await this.pc.createOffer());
      await gathered(this.pc);
      return pack({ sdp: this.pc.localDescription.sdp, type: this.pc.localDescription.type });
    },
    async hostFinish(code) { const d = await unpack(code); if (d.type !== 'answer') throw new Error('Paste your friend\'s REPLY code here.'); await this.pc.setRemoteDescription(d); },
    async join(code) {
      this.reset(); this.host = false; this.closed = false;
      const d = await unpack(code); if (d.type !== 'offer') throw new Error('Paste the HOST\'s code here.');
      this.pc = new RTCPeerConnection({ iceServers: STUN });
      this.pc.ondatachannel = e => this.wire(e.channel);
      await this.pc.setRemoteDescription(d);
      await this.pc.setLocalDescription(await this.pc.createAnswer());
      await gathered(this.pc);
      return pack({ sdp: this.pc.localDescription.sdp, type: this.pc.localDescription.type });
    },
  };
  window.NET = Net;

  // ---- the setup screen: HOST or JOIN, then the codes (a small HTML panel over the game for copy / paste)
  const css = 'position:fixed;left:50%;top:54%;transform:translate(-50%,-50%);width:min(760px,92vw);background:rgba(10,30,90,0.94);border:3px solid #fff;border-radius:10px;padding:18px;color:#fff;font:15px "Segoe UI",Arial,sans-serif;z-index:50';
  const OnlineSetup = {
    bgm: 'MU_BGM_FREE',
    enter() { this.step = 'pick'; this.i = 0; this.msg = ''; this.box = null; Net.handlers = {}; },
    leave() { if (this.box) { this.box.remove(); this.box = null; } },
    panel(html) {
      if (!this.box) { this.box = document.createElement('div'); this.box.style.cssText = css; document.body.appendChild(this.box); }
      this.box.innerHTML = html;
      this.box.querySelectorAll('textarea').forEach(t => { t.style.cssText = 'width:100%;height:84px;margin:6px 0;font:12px monospace;background:#081b4a;color:#cfe;border:1px solid #6af;border-radius:6px'; t.addEventListener('keydown', e => e.stopPropagation()); });
      this.box.querySelectorAll('button').forEach(b => b.style.cssText = 'margin:4px 8px 4px 0;padding:8px 16px;font:bold 14px "Segoe UI",Arial;background:#ff3ca0;color:#fff;border:0;border-radius:6px;cursor:pointer');
      return this.box;
    },
    async host() {
      this.step = 'busy'; this.msg = 'Making your code...';
      try {
        const code = await Net.hostStart();
        const b = this.panel(`<b>1.</b> Send this code to your friend (Discord, text, anything):<textarea readonly id="oc">${code}</textarea>
          <button id="cp">COPY CODE</button><br><br><b>2.</b> Paste the REPLY code your friend sends back:<textarea id="rc" placeholder="DDR2-..."></textarea>
          <button id="go">CONNECT</button> <button id="bk">BACK</button><div id="ms" style="margin-top:6px;color:#ffe86a"></div>`);
        b.querySelector('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(code); b.querySelector('#ms').textContent = 'Copied.'; };
        b.querySelector('#bk').onclick = () => this.back();
        b.querySelector('#go').onclick = async () => {
          try { await Net.hostFinish(b.querySelector('#rc').value); b.querySelector('#ms').textContent = 'Connecting...'; this.step = 'wait'; }
          catch (e) { b.querySelector('#ms').textContent = e.message || String(e); }
        };
        this.step = 'codes'; this.msg = '';
      } catch (e) { this.msg = 'Could not start: ' + (e.message || e); this.step = 'pick'; }
    },
    join() {
      this.step = 'codes';
      const b = this.panel(`Paste the HOST's code:<textarea id="hc" placeholder="DDR2-..."></textarea><button id="mk">MAKE REPLY CODE</button> <button id="bk">BACK</button>
        <div id="rp"></div><div id="ms" style="margin-top:6px;color:#ffe86a"></div>`);
      b.querySelector('#bk').onclick = () => this.back();
      b.querySelector('#mk').onclick = async () => {
        b.querySelector('#ms').textContent = 'Making your reply code...';
        try {
          const code = await Net.join(b.querySelector('#hc').value);
          b.querySelector('#rp').innerHTML = `<br>Send this REPLY code back to the host:<textarea readonly id="rcode">${code}</textarea><button id="cp">COPY REPLY</button>`;
          b.querySelector('#rp textarea').style.cssText = 'width:100%;height:84px;margin:6px 0;font:12px monospace;background:#081b4a;color:#cfe;border:1px solid #6af;border-radius:6px';
          const cp = b.querySelector('#cp'); cp.style.cssText = 'margin:4px 0;padding:8px 16px;font:bold 14px "Segoe UI",Arial;background:#ff3ca0;color:#fff;border:0;border-radius:6px;cursor:pointer';
          cp.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(code); b.querySelector('#ms').textContent = 'Copied. Waiting for the host to connect...'; };
          b.querySelector('#ms').textContent = 'Waiting for the host to connect...'; this.step = 'wait';
        } catch (e) { b.querySelector('#ms').textContent = e.message || String(e); }
      };
    },
    back() { Net.reset(); this.leave(); this.step = 'pick'; this.msg = ''; },
    input(a, p) {
      if (!p || this.box) return;
      if (a === 'P1U' || a === 'P1D' || a === 'P1L' || a === 'P1R') { this.i = 1 - this.i; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START' && this.step === 'pick') { sfx('SE_SYS_DECIDE01'); if (this.i === 0) this.host(); else this.join(); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); Net.reset(); go(ModeSel); }
    },
    click() { this.input('START', true); },
    draw(t) {
      menuBackground(t);
      menuTitle(null, 'ONLINE VERSUS');
      if (Net.open && this.step !== 'done') {            // connected: on to the songs (single style, like VERSUS)
        this.step = 'done'; this.leave(); sfx('SE_SYS_DECIDE02');
        S.style = 'single'; GROUP = null; P2 = null; PX = []; BATTLE = null; MCC = null; Select.query = '';
        // the friend's pick (on the guest): the same song, at your own difficulty if its chart is there
        Net.handlers.song = m => {
          const song = typeof songForSlot === 'function' ? songForSlot(m.slot) : null;
          const lv = song ? levelsOf(song) || [] : [];
          if (!song || !lv.some(x => x > 0)) { Net.send({ t: 'nosong' }); Select.note = 'You do not have the song the host picked'; Select.noteAt = performance.now(); return; }
          // the guest picks their own difficulty: SELECT DIFFICULTY opens on the host's song
          if (scene !== Select) go(Select);
          Select.inFolder = null; Select.favOnly = false; Select.query = ''; Select.buildOrder(); Select.applySearch('');
          const i = Select.order.findIndex(s2 => s2.slot === m.slot || (s2.alt && s2.alt.slot === m.slot));
          if (i < 0) { Net.send({ t: 'nosong' }); return; }
          const e = Select.order[i]; S.short = !!(e.alt && e.alt.slot === m.slot);
          Select.idx = i; Select.fixDiff(); Select.stage = 'diff'; Select.stageAt = performance.now(); Select.okAt = 0;
          Net.pendingSong = m;
          Select.note = (Net.peerName || 'The host') + ' picked this song: choose your difficulty'; Select.noteAt = performance.now();
          voice('VO_NAR_SELDIFF');
        };
        go(Select); return;
      }
      if (this.step === 'pick' || this.step === 'busy') {
        ['HOST A GAME', 'JOIN A GAME'].forEach((s, i) => {
          const on = i === this.i, x = 640 + (i - 0.5) * 360, y = 330;
          g.fillStyle = on ? 'rgba(200,40,120,0.92)' : 'rgba(20,40,110,0.85)'; g.fillRect(x - 150, y - 60, 300, 120);
          g.strokeStyle = on ? '#ffe86a' : '#fff'; g.lineWidth = on ? 5 : 3; g.strokeRect(x - 150, y - 60, 300, 120);
          text(s, x, y, 28, on ? '#ffe86a' : '#fff', 'center');
        });
        text(this.msg || 'Both players need DDR II PC and their own disc. The host picks the songs.', 640, 470, 18, '#fff', 'center', 'normal');
        keyHints('Left/Right: select    Enter: confirm    Esc: back');
      }
    },
  };
  window.OnlineSetup = OnlineSetup;

  // ---- in a song: the friend's judgments arrive as messages and are applied to their side of the screen
  window.onlineRemoteStep = function (p, t) {
    const q = p.netQueue || (p.netQueue = []);
    while (q.length) {
      const m = q.shift();
      if (m.t === 'j') {
        const row = p.rows[m.r]; if (!row || row.judged) continue;
        row.hit = row.notes.length; row.dt = 0;
        for (const n of row.notes) { n.done = true; n.hitT = row.t; p.flash[n.lane] = t; if (m.j > 0 && n.endT !== undefined) { n.holding = true; n.comHold = Infinity; p.holding.push(n); } }
        p.judgeRow(row, m.j);
      } else if (m.t === 'ng') {
        const n = p.notes[m.n]; if (n && n.holding) n.comHold = 0;          // let go: N.G. after the grace time
      }
    }
  };
  // both games load the song, then say ready; the host says go and both start together
  window.OnlineWait = {
    bgm: null,
    with(play) { this.play = play; this.at = performance.now(); this.goAt = null; this.mine = false; this.theirs = false; return this; },
    enter() {
      Net.handlers.ready = () => { this.theirs = true; };
      Net.handlers.go = m => { this.goAt = performance.now() + Math.max(0, m.in - Net.rtt / 2); };
      Net.send({ t: 'ready' }); this.mine = true;
    },
    input(a, p) { if (p && a === 'BACK') { Net.send({ t: 'quit' }); go(Select); } },
    draw(t) {
      if (Net.host && this.theirs && this.goAt === null) { Net.send({ t: 'go', in: 1500 }); this.goAt = performance.now() + 1500; }
      if (this.goAt !== null && performance.now() >= this.goAt) { go(this.play); return; }
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      text(Net.closed ? 'Your friend disconnected.' : 'Waiting for ' + (Net.peerName || 'your friend') + '...', 640, 360, 26, '#fff', 'center');
    },
  };
})();
