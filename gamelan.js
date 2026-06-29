// Gamelan Ensemble — multiplayer instrument app
// Audio: Web Audio API with inharmonic partials matching bronze metallophones
// Network: PeerJS (WebRTC P2P) — no server required

// ─────────────────────────────────────────────
// SCALES
// ─────────────────────────────────────────────

// Javanese Pelog frequency ratios (14 slots: 2 octaves)
const PELOG = [
  1.000, 1.077, 1.195, 1.333, 1.491, 1.600, 1.779,   // octave 0
  2.000, 2.154, 2.390, 2.666, 2.982, 3.200, 3.558,   // octave 1
];

// ─────────────────────────────────────────────
// INSTRUMENT DEFINITIONS
// ─────────────────────────────────────────────

const INSTRUMENTS = {
  saron: {
    name: 'Saron Barung',
    short: 'Saron',
    role: 'Main melody metallophone',
    bg: '#4ade80', border: '#16a34a', text: '#052e16',
    baseFreq: 220,
    decay: 2.2,
    partials: [{r:1.00,a:1.00},{r:2.44,a:0.28},{r:4.87,a:0.10},{r:7.15,a:0.03}],
    keys: ['1','2','3','4','5','6','7'],
    notes: [0,1,2,3,4,5,6],
    layout: 'keys',
  },
  demung: {
    name: 'Demung',
    short: 'Demung',
    role: 'Low melody (one octave below saron)',
    bg: '#60a5fa', border: '#1d4ed8', text: '#eff6ff',
    baseFreq: 110,
    decay: 3.0,
    partials: [{r:1.00,a:1.00},{r:2.44,a:0.32},{r:4.87,a:0.12}],
    keys: ['1','2','3','4','5','6','7'],
    notes: [0,1,2,3,4,5,6],
    layout: 'keys',
  },
  bonang: {
    name: 'Bonang Barung',
    short: 'Bonang',
    role: 'Leads & ornaments the melody',
    bg: '#c084fc', border: '#7e22ce', text: '#faf5ff',
    baseFreq: 220,
    decay: 1.4,
    partials: [{r:1.00,a:1.00},{r:1.58,a:0.55},{r:2.40,a:0.25},{r:3.50,a:0.08}],
    keys: ["1","2","3","5","6","1'","2'","3'","5'","6'"],
    notes: [0,1,2,4,5,7,8,9,11,12],
    layout: 'bonang',
  },
  kempul: {
    name: 'Kempul & Kenong',
    short: 'Kempul',
    role: 'Punctuates sections with medium gongs',
    bg: '#fb923c', border: '#c2410c', text: '#fff7ed',
    baseFreq: 110,
    decay: 5.5,
    partials: [{r:1.00,a:1.00},{r:1.51,a:0.60},{r:2.07,a:0.28},{r:3.31,a:0.12}],
    keys: ['6','5','3','2'],
    notes: [5,4,2,1],
    layout: 'gong-row',
  },
  gong: {
    name: 'Gong Ageng',
    short: 'Gong',
    role: 'Marks the end of each full phrase',
    bg: '#facc15', border: '#a16207', text: '#1c1917',
    baseFreq: 55,
    decay: 12.0,
    partials: [{r:1.00,a:1.00},{r:1.51,a:0.70},{r:2.07,a:0.45},{r:3.31,a:0.22},{r:4.78,a:0.10}],
    keys: ['GONG'],
    notes: [5],
    layout: 'gong-single',
  },
  kendang: {
    name: 'Kendang',
    short: 'Kendang',
    role: 'Controls tempo and energy',
    bg: '#a8a29e', border: '#57534e', text: '#fafaf9',
    baseFreq: 0,
    decay: 0.5,
    partials: [],
    keys: ['Dag','Tung','Pak','Tak'],
    notes: [0,1,2,3],
    layout: 'drums',
    drumSounds: [
      {freq:160, freqEnd:110, decay:0.55, noise:0.15},
      {freq:240, freqEnd:180, decay:0.40, noise:0.20},
      {freq:380, freqEnd:320, decay:0.18, noise:0.55},
      {freq:580, freqEnd:520, decay:0.10, noise:0.80},
    ],
  },
};

const INSTRUMENT_ORDER = ['saron','demung','bonang','kempul','gong','kendang'];

// ─────────────────────────────────────────────
// AUDIO SYNTHESIS
// ─────────────────────────────────────────────

class GamelanSynth {
  constructor() {
    this.ctx = null;
    this.out = null;
  }

  _boot() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.knee.value = 6;
      comp.ratio.value = 3;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      comp.connect(this.ctx.destination);
      this.out = comp;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(instrumentId, noteIndex, velocity = 1.0) {
    const ctx = this._boot();
    const inst = INSTRUMENTS[instrumentId];
    if (!inst) return;

    if (inst.layout === 'drums') {
      this._drum(ctx, noteIndex, velocity, inst);
    } else {
      this._metal(ctx, instrumentId, noteIndex, velocity, inst);
    }
  }

  _metal(ctx, instrumentId, noteIndex, velocity, inst) {
    const freq = inst.baseFreq * (PELOG[noteIndex] || 1);
    const now = ctx.currentTime;
    const decay = inst.decay;

    const env = ctx.createGain();
    env.connect(this.out);
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(velocity * 0.55, now + 0.004);
    env.gain.setValueAtTime(velocity * 0.55, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    inst.partials.forEach(({r, a}) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * r;
      g.gain.value = a;
      osc.connect(g);
      g.connect(env);
      osc.start(now);
      osc.stop(now + decay + 0.2);
    });
  }

  _drum(ctx, noteIndex, velocity, inst) {
    const s = inst.drumSounds[noteIndex];
    if (!s) return;
    const now = ctx.currentTime;

    const env = ctx.createGain();
    env.connect(this.out);
    env.gain.setValueAtTime(velocity * 0.9, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + s.decay);

    // Tonal body
    if (s.noise < 0.95) {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(s.freq, now);
      osc.frequency.exponentialRampToValueAtTime(s.freqEnd, now + s.decay * 0.35);
      og.gain.value = 1 - s.noise;
      osc.connect(og);
      og.connect(env);
      osc.start(now);
      osc.stop(now + s.decay + 0.05);
    }

    // Noise attack
    if (s.noise > 0.05) {
      const sr = ctx.sampleRate;
      const len = Math.ceil(s.decay * sr);
      const buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = s.freq;
      bpf.Q.value = 4;
      const ng = ctx.createGain();
      ng.gain.value = s.noise;
      src.connect(bpf);
      bpf.connect(ng);
      ng.connect(env);
      src.start(now);
    }
  }
}

// ─────────────────────────────────────────────
// MULTIPLAYER SESSION (PeerJS)
// ─────────────────────────────────────────────

class GamelanSession {
  constructor() {
    this.peer = null;
    this.conns = new Map();   // peerId → DataConnection
    this.players = new Map(); // peerId → { id, name, instrument, isHost }
    this.isHost = false;
    this.code = null;
    this.localId = null;
    this.onNote = null;
    this.onPlayers = null;
    this.onStatus = null;
  }

  _code() {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length:4}, () => c[Math.floor(Math.random()*c.length)]).join('');
  }

  _pid(code) { return 'glp-' + code.toUpperCase(); }

  createSession(name, instrument) {
    return new Promise((resolve, reject) => {
      const code = this._code();
      this.peer = new Peer(this._pid(code), {debug:0});

      this.peer.on('open', id => {
        this.isHost = true;
        this.code = code;
        this.localId = id;
        this.players.set(id, {id, name, instrument, isHost:true});
        this.onPlayers?.(this._list());
        this.onStatus?.('Hosting · code: ' + code);
        resolve(code);
      });

      this.peer.on('connection', conn => this._incoming(conn));
      this.peer.on('error', err => {
        this.onStatus?.('Connection error – try again');
        reject(err);
      });
    });
  }

  joinSession(code, name, instrument) {
    return new Promise((resolve, reject) => {
      const norm = code.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
      this.peer = new Peer(undefined, {debug:0});

      this.peer.on('open', localId => {
        this.isHost = false;
        this.code = norm;
        this.localId = localId;

        const conn = this.peer.connect(this._pid(norm), {
          metadata: {name, instrument},
        });

        conn.on('open', () => {
          this.conns.set(conn.peer, conn);
          conn.send({type:'join', id:localId, name, instrument});
          this.onStatus?.('Joined session ' + norm);
          resolve();
        });

        conn.on('data', d => this._data(d, conn.peer));
        conn.on('close', () => {
          this.onStatus?.('Disconnected');
          this.players.clear();
          this.onPlayers?.([]);
        });
        conn.on('error', () => {
          this.onStatus?.('Could not connect – check code');
          reject(new Error('connect failed'));
        });
      });

      this.peer.on('error', err => {
        this.onStatus?.('Error: ' + err.type);
        reject(err);
      });
    });
  }

  _incoming(conn) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      conn.send({type:'player_list', players:this._list()});
    });
    conn.on('data', d => this._data(d, conn.peer));
    conn.on('close', () => {
      this.players.delete(conn.peer);
      this.conns.delete(conn.peer);
      this._bcast({type:'player_left', id:conn.peer});
      this.onPlayers?.(this._list());
    });
  }

  _data(d, fromId) {
    switch(d.type) {
      case 'join':
        if (this.isHost) {
          const inst = this._pick(d.instrument);
          this.players.set(d.id, {id:d.id, name:d.name, instrument:inst, isHost:false});
          this._bcast({type:'player_list', players:this._list()});
          this.onPlayers?.(this._list());
        }
        break;
      case 'note':
        this.onNote?.(d.instrument, d.noteIndex, d.velocity, d.from);
        if (this.isHost) this._bcast(d, fromId);
        break;
      case 'player_list':
        this.players.clear();
        d.players.forEach(p => this.players.set(p.id, p));
        this.onPlayers?.(this._list());
        break;
      case 'player_left':
        this.players.delete(d.id);
        this.onPlayers?.(this._list());
        break;
      case 'assign':
        const p = this.players.get(d.targetId);
        if (p) p.instrument = d.instrument;
        this.onPlayers?.(this._list());
        if (this.isHost) this._bcast(d, fromId);
        break;
    }
  }

  sendNote(instrument, noteIndex, velocity = 1.0) {
    const msg = {type:'note', instrument, noteIndex, velocity, from:this.localId};
    if (this.isHost) this._bcast(msg, this.localId);
    else {
      const c = this.conns.values().next().value;
      c?.send(msg);
    }
  }

  assignInstrument(targetId, instrument) {
    const p = this.players.get(targetId);
    if (!p) return;
    p.instrument = instrument;
    this._bcast({type:'assign', targetId, instrument});
    this.onPlayers?.(this._list());
  }

  _bcast(msg, skip = null) {
    this.conns.forEach((c, id) => { if (id !== skip) c.send(msg); });
  }

  _list() { return Array.from(this.players.values()); }

  _pick(preferred) {
    const used = new Set(this._list().map(p => p.instrument));
    if (preferred && !used.has(preferred)) return preferred;
    for (const id of INSTRUMENT_ORDER) if (!used.has(id)) return id;
    return 'saron';
  }

  myInstrument() { return this.players.get(this.localId)?.instrument || null; }

  destroy() {
    this.peer?.destroy();
    this.peer = null;
    this.conns.clear();
    this.players.clear();
  }
}

// ─────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────

class GamelanUI {
  constructor() {
    this.synth = new GamelanSynth();
    this.session = null;
    this.soloInst = 'saron';
    this.myName = 'Player' + Math.floor(Math.random() * 999 + 1);
    this.tab = null;
    this._rippleTimers = new Map();
  }

  mount(tabEl) {
    this.tab = tabEl;
    this._draw();
  }

  // ── current instrument ──────────────────────
  _curInst() {
    return this.session ? (this.session.myInstrument() || this.soloInst) : this.soloInst;
  }

  // ── main render ─────────────────────────────
  _draw() {
    if (!this.tab) return;
    this.tab.innerHTML = this._tpl();
    this._bind();
  }

  _tpl() {
    const inst = INSTRUMENTS[this._curInst()];
    const inSession = !!this.session;
    const isHost = this.session?.isHost;
    const code = this.session?.code;

    return `
<div class="gln-root">

  <!-- Session panel -->
  <section class="gln-session-panel">
    ${inSession ? this._sessionActiveTpl(code, isHost) : this._sessionIdleTpl()}
  </section>

  <!-- Instrument header -->
  <div class="gln-inst-header" style="background:${inst.bg};border-color:${inst.border};color:${inst.text}">
    <div class="gln-inst-info">
      <span class="gln-inst-name">${inst.name}</span>
      <span class="gln-inst-role">${inst.role}</span>
    </div>
    ${!inSession ? `<button class="gln-cycle-btn" id="glnCycleBtn" title="Switch instrument">&#8645;</button>` : ''}
  </div>

  <!-- Keys / pads -->
  <div class="gln-keys-area" id="glnKeysArea">
    ${this._keysTpl(this._curInst())}
  </div>

  <!-- Players list (in session) -->
  ${inSession ? `<div class="gln-players" id="glnPlayers">${this._playersTpl()}</div>` : ''}

  <!-- Solo instrument picker (when not in session) -->
  ${!inSession ? `
  <div class="gln-picker" id="glnPicker">
    <p class="gln-picker-label">Choose your instrument:</p>
    <div class="gln-picker-grid">
      ${INSTRUMENT_ORDER.map(id => {
        const ii = INSTRUMENTS[id];
        return `<button class="gln-pick-btn${this._curInst()===id?' active':''}"
          data-pick="${id}"
          style="--pbg:${ii.bg};--pbdr:${ii.border};--ptxt:${ii.text}">
          ${ii.short}
        </button>`;
      }).join('')}
    </div>
  </div>` : ''}

</div>`;
  }

  _sessionIdleTpl() {
    return `
    <div class="gln-sess-idle">
      <div class="gln-name-row">
        <label class="gln-label">Your name</label>
        <input class="gln-name-input" id="glnName" value="${this._esc(this.myName)}" maxlength="20">
      </div>
      <div class="gln-sess-btns">
        <button class="gln-btn gln-create-btn" id="glnCreate">Create Session</button>
        <div class="gln-join-row">
          <input class="gln-code-input" id="glnCodeInput" placeholder="CODE" maxlength="4">
          <button class="gln-btn gln-join-btn" id="glnJoin">Join</button>
        </div>
      </div>
      <p class="gln-sess-hint">Create a session and share the 4-letter code with friends</p>
    </div>`;
  }

  _sessionActiveTpl(code, isHost) {
    return `
    <div class="gln-sess-active">
      ${isHost ? `<div class="gln-code-display">
        <span class="gln-code-label">Share code</span>
        <span class="gln-code-big" id="glnCodeBig">${code}</span>
      </div>` : `<span class="gln-joined-badge">Connected · ${code}</span>`}
      <button class="gln-btn gln-leave-btn" id="glnLeave">Leave</button>
    </div>`;
  }

  _playersTpl() {
    if (!this.session) return '';
    const players = this.session._list();
    const myId = this.session.localId;
    const isHost = this.session.isHost;
    return players.map(p => {
      const inst = INSTRUMENTS[p.instrument] || INSTRUMENTS.saron;
      const isMe = p.id === myId;
      const badge = `<span class="gln-p-inst" style="background:${inst.bg};color:${inst.text};border-color:${inst.border}">${inst.short}</span>`;
      const assign = isHost && !isMe ? `
        <select class="gln-assign-sel" data-target="${p.id}">
          ${INSTRUMENT_ORDER.map(id => `<option value="${id}"${p.instrument===id?' selected':''}>${INSTRUMENTS[id].short}</option>`).join('')}
        </select>` : '';
      return `<div class="gln-player-row${isMe?' gln-me':''}">
        <span class="gln-p-dot" style="background:${inst.bg}"></span>
        <span class="gln-p-name">${this._esc(p.name)}${isMe?' (you)':''}</span>
        ${isHost && !isMe ? assign : badge}
      </div>`;
    }).join('');
  }

  _keysTpl(instId) {
    const inst = INSTRUMENTS[instId];
    if (!inst) return '';
    const {layout, keys, notes, bg, border, text} = inst;

    if (layout === 'keys') {
      return `<div class="gln-key-row">
        ${keys.map((lbl, i) => this._key(instId, notes[i], lbl, bg, border, text)).join('')}
      </div>`;
    }

    if (layout === 'bonang') {
      const top = keys.slice(0,5), topN = notes.slice(0,5);
      const bot = keys.slice(5),  botN = notes.slice(5);
      return `<div class="gln-bonang-grid">
        <div class="gln-bonang-row">${top.map((l,i)=>this._circKey(instId,topN[i],l,bg,border,text)).join('')}</div>
        <div class="gln-bonang-row">${bot.map((l,i)=>this._circKey(instId,botN[i],l,bg,border,text)).join('')}</div>
      </div>`;
    }

    if (layout === 'gong-row') {
      return `<div class="gln-gong-row">
        ${keys.map((lbl, i) => this._circKey(instId, notes[i], lbl, bg, border, text, 'lg')).join('')}
      </div>`;
    }

    if (layout === 'gong-single') {
      return `<div class="gln-gong-single">
        ${this._circKey(instId, notes[0], 'GONG', bg, border, text, 'xl')}
      </div>`;
    }

    if (layout === 'drums') {
      return `<div class="gln-drum-grid">
        ${keys.map((lbl, i) => this._drumPad(instId, notes[i], lbl, bg, border, text)).join('')}
      </div>`;
    }

    return '';
  }

  _key(inst, noteIdx, lbl, bg, border, text) {
    return `<button class="gln-key"
      data-inst="${inst}" data-note="${noteIdx}"
      style="background:${bg};border-color:${border};color:${text}"
      aria-label="Play note ${lbl}">${lbl}</button>`;
  }

  _circKey(inst, noteIdx, lbl, bg, border, text, size='') {
    return `<button class="gln-circ-key${size?' gln-circ-'+size:''}"
      data-inst="${inst}" data-note="${noteIdx}"
      style="background:${bg};border-color:${border};color:${text}"
      aria-label="Play ${lbl}">${lbl}</button>`;
  }

  _drumPad(inst, noteIdx, lbl, bg, border, text) {
    return `<button class="gln-drum-pad"
      data-inst="${inst}" data-note="${noteIdx}"
      style="background:${bg};border-color:${border};color:${text}"
      aria-label="Play ${lbl}">${lbl}</button>`;
  }

  // ── events ──────────────────────────────────
  _bind() {
    const $ = id => this.tab.querySelector('#' + id);
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };

    // Instrument keys – use touchstart for zero latency on iOS
    this.tab.querySelectorAll('[data-inst][data-note]').forEach(el => {
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        this._press(el);
      }, {passive: false});
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        this._press(el);
      });
    });

    // Session: create
    on('glnCreate', 'click', () => this._onCreate());

    // Session: join
    on('glnJoin', 'click', () => this._onJoin());
    const codeInput = $('glnCodeInput');
    if (codeInput) {
      codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') this._onJoin(); });
      codeInput.addEventListener('input', () => {
        codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
      });
    }

    // Session: leave
    on('glnLeave', 'click', () => this._onLeave());

    // Solo instrument cycle button
    on('glnCycleBtn', 'click', () => {
      const idx = (INSTRUMENT_ORDER.indexOf(this.soloInst) + 1) % INSTRUMENT_ORDER.length;
      this.soloInst = INSTRUMENT_ORDER[idx];
      this._draw();
    });

    // Solo instrument picker buttons
    this.tab.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.soloInst = btn.dataset.pick;
        this._draw();
      });
    });

    // Host: assign instrument dropdowns
    this.tab.querySelectorAll('.gln-assign-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        this.session?.assignInstrument(sel.dataset.target, sel.value);
      });
    });

    // Code display: tap to copy
    const codeBig = $('glnCodeBig');
    if (codeBig) {
      codeBig.style.cursor = 'pointer';
      codeBig.title = 'Tap to copy';
      codeBig.addEventListener('click', () => {
        navigator.clipboard?.writeText(this.session?.code || '').catch(()=>{});
        codeBig.textContent = 'COPIED!';
        setTimeout(() => { codeBig.textContent = this.session?.code || ''; }, 1400);
      });
    }

    // Name input: update myName on change
    const nameInput = $('glnName');
    if (nameInput) {
      nameInput.addEventListener('input', () => { this.myName = nameInput.value || 'Player'; });
    }
  }

  _press(el) {
    const instId = el.dataset.inst;
    const noteIdx = parseInt(el.dataset.note, 10);
    // Play immediately
    this.synth.play(instId, noteIdx);
    // Broadcast
    this.session?.sendNote(instId, noteIdx);
    // Visual feedback
    this._ripple(el, false);
  }

  _ripple(el, isRemote) {
    el.classList.add(isRemote ? 'gln-remote' : 'gln-pressed');
    const key = el.dataset.inst + '-' + el.dataset.note + (isRemote?'-r':'');
    clearTimeout(this._rippleTimers.get(key));
    this._rippleTimers.set(key, setTimeout(() => {
      el.classList.remove('gln-pressed', 'gln-remote');
    }, isRemote ? 300 : 140));
  }

  _flashRemote(instId, noteIdx) {
    const sel = `[data-inst="${instId}"][data-note="${noteIdx}"]`;
    this.tab.querySelectorAll(sel).forEach(el => this._ripple(el, true));
  }

  // ── session actions ─────────────────────────
  async _onCreate() {
    this._readName();
    if (this.session) this.session.destroy();
    this.session = new GamelanSession();
    this._hookSession();

    try {
      await this.session.createSession(this.myName, this.soloInst);
    } catch(e) {
      this._showStatus('Could not create session – check internet connection');
      this.session = null;
    }
    this._draw();
  }

  async _onJoin() {
    this._readName();
    const input = this.tab.querySelector('#glnCodeInput');
    const code = (input?.value || '').trim().toUpperCase();
    if (code.length !== 4) { this._showStatus('Enter the 4-letter code'); return; }

    if (this.session) this.session.destroy();
    this.session = new GamelanSession();
    this._hookSession();

    try {
      await this.session.joinSession(code, this.myName, this.soloInst);
    } catch(e) {
      this._showStatus('Could not join – check the code and try again');
      this.session = null;
      this._draw();
      return;
    }
    this._draw();
  }

  _onLeave() {
    this.session?.destroy();
    this.session = null;
    this._draw();
  }

  _hookSession() {
    if (!this.session) return;

    this.session.onNote = (inst, noteIdx, vel, fromId) => {
      if (fromId === this.session?.localId) return;
      this.synth.play(inst, noteIdx, vel);
      this._flashRemote(inst, noteIdx);
    };

    this.session.onPlayers = () => {
      // Refresh players list section without full redraw
      const pl = this.tab.querySelector('#glnPlayers');
      if (pl) pl.innerHTML = this._playersTpl();

      // Re-bind assign dropdowns
      this.tab.querySelectorAll('.gln-assign-sel').forEach(sel => {
        sel.addEventListener('change', () => {
          this.session?.assignInstrument(sel.dataset.target, sel.value);
        });
      });

      // If my instrument changed, redraw keys area
      const keysArea = this.tab.querySelector('#glnKeysArea');
      if (keysArea) {
        keysArea.innerHTML = this._keysTpl(this._curInst());
        this._bindKeys();
      }

      // Refresh instrument header
      this._refreshHeader();
    };

    this.session.onStatus = msg => this._showStatus(msg);
  }

  _bindKeys() {
    this.tab.querySelectorAll('[data-inst][data-note]').forEach(el => {
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        this._press(el);
      }, {passive: false});
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        this._press(el);
      });
    });
  }

  _refreshHeader() {
    const inst = INSTRUMENTS[this._curInst()];
    const hdr = this.tab.querySelector('.gln-inst-header');
    if (!hdr || !inst) return;
    hdr.style.background = inst.bg;
    hdr.style.borderColor = inst.border;
    hdr.style.color = inst.text;
    const nm = hdr.querySelector('.gln-inst-name');
    const rl = hdr.querySelector('.gln-inst-role');
    if (nm) nm.textContent = inst.name;
    if (rl) rl.textContent = inst.role;
  }

  _showStatus(msg) {
    let bar = this.tab.querySelector('.gln-status-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'gln-status-bar';
      this.tab.querySelector('.gln-root')?.prepend(bar);
    }
    bar.textContent = msg;
    bar.classList.add('visible');
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => bar.classList.remove('visible'), 3500);
  }

  _readName() {
    const inp = this.tab.querySelector('#glnName');
    if (inp) this.myName = inp.value.trim() || 'Player';
  }

  _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

// ─────────────────────────────────────────────
// BOOTSTRAP – called from main.js
// ─────────────────────────────────────────────

export function initGamelan(tabEl) {
  const ui = new GamelanUI();
  ui.mount(tabEl);
  return ui;
}
