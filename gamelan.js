// Gamelan Ensemble — multiplayer instrument app
// Audio: Web Audio API with inharmonic partials matching bronze metallophones
// Network: PeerJS (WebRTC P2P) — no server required
// NOTE: No optional chaining (?.) — kept compatible with older Safari/iOS

// ─────────────────────────────────────────────
// SCALES
// ─────────────────────────────────────────────

// Javanese Pelog frequency ratios (14 slots: 2 octaves)
var PELOG = [
  1.000, 1.077, 1.195, 1.333, 1.491, 1.600, 1.779,   // octave 0
  2.000, 2.154, 2.390, 2.666, 2.982, 3.200, 3.558,   // octave 1
];

// ─────────────────────────────────────────────
// INSTRUMENT DEFINITIONS
// ─────────────────────────────────────────────

var INSTRUMENTS = {
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
    role: 'Leads and ornaments the melody',
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

var INSTRUMENT_ORDER = ['saron','demung','bonang','kempul','gong','kendang'];

// ─────────────────────────────────────────────
// AUDIO SYNTHESIS
// ─────────────────────────────────────────────

function GamelanSynth() {
  this.ctx = null;
  this.out = null;
}

// Returns a promise that resolves to the running AudioContext
GamelanSynth.prototype._boot = function() {
  var self = this;
  if (!self.ctx) {
    self.ctx = new (window.AudioContext || window.webkitAudioContext)();
    var master = self.ctx.createGain();
    master.gain.value = 0.8;
    master.connect(self.ctx.destination);
    self.out = master;
  }
  if (self.ctx.state === 'running') {
    return Promise.resolve(self.ctx);
  }
  return self.ctx.resume().then(function() { return self.ctx; });
};

GamelanSynth.prototype.play = function(instrumentId, noteIndex, velocity) {
  if (velocity === undefined) velocity = 1.0;
  var self = this;
  var inst = INSTRUMENTS[instrumentId];
  if (!inst) return;

  self._boot().then(function(ctx) {
    try {
      if (inst.layout === 'drums') {
        self._drum(ctx, noteIndex, velocity, inst);
      } else {
        self._metal(ctx, noteIndex, velocity, inst);
      }
    } catch(e) {
      // silently ignore audio errors
    }
  }).catch(function() {});
};

GamelanSynth.prototype._metal = function(ctx, noteIndex, velocity, inst) {
  var ratio = PELOG[noteIndex];
  if (!ratio) ratio = 1;
  var freq = inst.baseFreq * ratio;
  var now = ctx.currentTime;
  var decay = inst.decay;

  var env = ctx.createGain();
  env.connect(this.out);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(velocity * 0.6, now + 0.005);
  env.gain.setValueAtTime(velocity * 0.6, now + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, now + decay);

  var partials = inst.partials;
  for (var i = 0; i < partials.length; i++) {
    var p = partials[i];
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * p.r;
    g.gain.value = p.a;
    osc.connect(g);
    g.connect(env);
    osc.start(now);
    osc.stop(now + decay + 0.3);
  }
};

GamelanSynth.prototype._drum = function(ctx, noteIndex, velocity, inst) {
  var s = inst.drumSounds[noteIndex];
  if (!s) return;
  var now = ctx.currentTime;

  var env = ctx.createGain();
  env.connect(this.out);
  env.gain.setValueAtTime(velocity * 0.9, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + s.decay);

  if (s.noise < 0.95) {
    var osc = ctx.createOscillator();
    var og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(s.freq, now);
    osc.frequency.exponentialRampToValueAtTime(s.freqEnd, now + s.decay * 0.35);
    og.gain.value = 1 - s.noise;
    osc.connect(og);
    og.connect(env);
    osc.start(now);
    osc.stop(now + s.decay + 0.05);
  }

  if (s.noise > 0.05) {
    var sr = ctx.sampleRate;
    var len = Math.ceil(s.decay * sr);
    var buf = ctx.createBuffer(1, len, sr);
    var d = buf.getChannelData(0);
    for (var j = 0; j < len; j++) d[j] = Math.random() * 2 - 1;

    var src = ctx.createBufferSource();
    src.buffer = buf;
    var bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = s.freq;
    bpf.Q.value = 4;
    var ng = ctx.createGain();
    ng.gain.value = s.noise;
    src.connect(bpf);
    bpf.connect(ng);
    ng.connect(env);
    src.start(now);
    src.stop(now + s.decay + 0.05);
  }
};

// ─────────────────────────────────────────────
// MULTIPLAYER SESSION (PeerJS)
// ─────────────────────────────────────────────

function GamelanSession() {
  this.peer = null;
  this.conns = {};      // peerId → DataConnection
  this.players = {};    // peerId → { id, name, instrument, isHost }
  this.isHost = false;
  this.code = null;
  this.localId = null;
  this.onNote = null;
  this.onPlayers = null;
  this.onStatus = null;
}

GamelanSession.prototype._genCode = function() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 4; i++) code += c[Math.floor(Math.random() * c.length)];
  return code;
};

GamelanSession.prototype._pid = function(code) {
  return 'glp-' + code.toUpperCase();
};

GamelanSession.prototype._emit = function(fn, arg) {
  if (typeof fn === 'function') fn(arg);
};

GamelanSession.prototype._list = function() {
  var arr = [];
  for (var id in this.players) arr.push(this.players[id]);
  return arr;
};

GamelanSession.prototype._bcast = function(msg, skip) {
  for (var id in this.conns) {
    if (id !== skip) {
      try { this.conns[id].send(msg); } catch(e) {}
    }
  }
};

GamelanSession.prototype._pick = function(preferred) {
  var used = {};
  var list = this._list();
  for (var i = 0; i < list.length; i++) used[list[i].instrument] = true;
  if (preferred && !used[preferred]) return preferred;
  for (var j = 0; j < INSTRUMENT_ORDER.length; j++) {
    if (!used[INSTRUMENT_ORDER[j]]) return INSTRUMENT_ORDER[j];
  }
  return 'saron';
};

GamelanSession.prototype.createSession = function(name, instrument) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var code = self._genCode();
    self.peer = new Peer(self._pid(code), {debug: 0});

    self.peer.on('open', function(id) {
      self.isHost = true;
      self.code = code;
      self.localId = id;
      self.players[id] = {id: id, name: name, instrument: instrument, isHost: true};
      self._emit(self.onPlayers, self._list());
      self._emit(self.onStatus, 'Hosting · code: ' + code);
      resolve(code);
    });

    self.peer.on('connection', function(conn) { self._incoming(conn); });

    self.peer.on('error', function(err) {
      self._emit(self.onStatus, 'Connection error – try again');
      reject(err);
    });
  });
};

GamelanSession.prototype.joinSession = function(code, name, instrument) {
  var self = this;
  var norm = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  return new Promise(function(resolve, reject) {
    self.peer = new Peer(undefined, {debug: 0});

    self.peer.on('open', function(localId) {
      self.isHost = false;
      self.code = norm;
      self.localId = localId;

      var conn = self.peer.connect(self._pid(norm), {
        metadata: {name: name, instrument: instrument},
      });

      conn.on('open', function() {
        self.conns[conn.peer] = conn;
        conn.send({type: 'join', id: localId, name: name, instrument: instrument});
        self._emit(self.onStatus, 'Joined session ' + norm);
        resolve();
      });

      conn.on('data', function(d) { self._handleData(d, conn.peer); });

      conn.on('close', function() {
        self._emit(self.onStatus, 'Disconnected');
        self.players = {};
        self._emit(self.onPlayers, []);
      });

      conn.on('error', function() {
        self._emit(self.onStatus, 'Could not connect – check code');
        reject(new Error('connect failed'));
      });
    });

    self.peer.on('error', function(err) {
      self._emit(self.onStatus, 'Error: ' + (err.type || err));
      reject(err);
    });
  });
};

GamelanSession.prototype._incoming = function(conn) {
  var self = this;
  conn.on('open', function() {
    self.conns[conn.peer] = conn;
    try { conn.send({type: 'player_list', players: self._list()}); } catch(e) {}
  });
  conn.on('data', function(d) { self._handleData(d, conn.peer); });
  conn.on('close', function() {
    delete self.players[conn.peer];
    delete self.conns[conn.peer];
    self._bcast({type: 'player_left', id: conn.peer});
    self._emit(self.onPlayers, self._list());
  });
};

GamelanSession.prototype._handleData = function(d, fromId) {
  var self = this;
  if (d.type === 'join') {
    if (self.isHost) {
      var inst = self._pick(d.instrument);
      self.players[d.id] = {id: d.id, name: d.name, instrument: inst, isHost: false};
      var msg = {type: 'player_list', players: self._list()};
      self._bcast(msg);
      self._emit(self.onPlayers, self._list());
    }
  } else if (d.type === 'note') {
    self._emit(self.onNote, {instrument: d.instrument, noteIndex: d.noteIndex, velocity: d.velocity, from: d.from});
    if (self.isHost) self._bcast(d, fromId);
  } else if (d.type === 'player_list') {
    self.players = {};
    for (var i = 0; i < d.players.length; i++) {
      self.players[d.players[i].id] = d.players[i];
    }
    self._emit(self.onPlayers, self._list());
  } else if (d.type === 'player_left') {
    delete self.players[d.id];
    self._emit(self.onPlayers, self._list());
  } else if (d.type === 'assign') {
    var target = self.players[d.targetId];
    if (target) target.instrument = d.instrument;
    self._emit(self.onPlayers, self._list());
    if (self.isHost) self._bcast(d, fromId);
  }
};

GamelanSession.prototype.sendNote = function(instrument, noteIndex, velocity) {
  if (velocity === undefined) velocity = 1.0;
  var msg = {type: 'note', instrument: instrument, noteIndex: noteIndex, velocity: velocity, from: this.localId};
  if (this.isHost) {
    this._bcast(msg, this.localId);
  } else {
    for (var id in this.conns) {
      try { this.conns[id].send(msg); } catch(e) {}
      break; // send to host only (first connection)
    }
  }
};

GamelanSession.prototype.assignInstrument = function(targetId, instrument) {
  var target = this.players[targetId];
  if (!target) return;
  target.instrument = instrument;
  this._bcast({type: 'assign', targetId: targetId, instrument: instrument});
  this._emit(this.onPlayers, this._list());
};

GamelanSession.prototype.myInstrument = function() {
  var me = this.players[this.localId];
  return me ? me.instrument : null;
};

GamelanSession.prototype.destroy = function() {
  if (this.peer) {
    try { this.peer.destroy(); } catch(e) {}
    this.peer = null;
  }
  this.conns = {};
  this.players = {};
};

// ─────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────

function GamelanUI() {
  this.synth = new GamelanSynth();
  this.session = null;
  this.soloInst = 'saron';
  this.myName = 'Player' + Math.floor(Math.random() * 999 + 1);
  this.tab = null;
  this._rippleTimers = {};
  this._statusTimer = null;
}

GamelanUI.prototype.mount = function(tabEl) {
  this.tab = tabEl;
  this._draw();
};

GamelanUI.prototype._curInst = function() {
  if (this.session) {
    var mi = this.session.myInstrument();
    return mi || this.soloInst;
  }
  return this.soloInst;
};

GamelanUI.prototype._draw = function() {
  if (!this.tab) return;
  this.tab.innerHTML = this._tpl();
  this._bind();
};

GamelanUI.prototype._esc = function(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
};

GamelanUI.prototype._tpl = function() {
  var instId = this._curInst();
  var inst = INSTRUMENTS[instId];
  var inSession = !!this.session;
  var isHost = inSession && this.session.isHost;
  var code = inSession ? this.session.code : '';

  return '<div class="gln-root">' +
    this._introTpl(inSession) +
    '<section class="gln-session-panel">' +
    (inSession ? this._sessionActiveTpl(code, isHost) : this._sessionIdleTpl()) +
    '</section>' +
    '<div class="gln-inst-header" style="background:' + inst.bg + ';border-color:' + inst.border + ';color:' + inst.text + '">' +
      '<div class="gln-inst-info">' +
        '<span class="gln-inst-name">' + this._esc(inst.name) + '</span>' +
        '<span class="gln-inst-role">' + this._esc(inst.role) + '</span>' +
      '</div>' +
      (!inSession ? '<button class="gln-cycle-btn" id="glnCycleBtn" title="Switch instrument">&#8645;</button>' : '') +
    '</div>' +
    '<div class="gln-keys-area" id="glnKeysArea">' + this._keysTpl(instId) + '</div>' +
    (inSession ? '<div class="gln-players" id="glnPlayers">' + this._playersTpl() + '</div>' : '') +
    (!inSession ? this._pickerTpl(instId) : '') +
    '</div>';
};

GamelanUI.prototype._introTpl = function(inSession) {
  if (inSession) {
    return '<div class="gln-intro gln-intro-compact">' +
      '&#127928; Shared session &middot; everyone in the room hears what everyone plays' +
      '</div>';
  }
  return '<div class="gln-intro">' +
    '<h2 class="gln-intro-title">Gamelan Ensemble</h2>' +
    '<p class="gln-intro-lede">Gamelan is a community instrument — it is traditionally played as a group, ' +
    'not alone, and the music only comes together when everyone plays their part. This is a collective practice, ' +
    'and this tab lets you do that together, live, from your own phones.</p>' +
    '<ol class="gln-intro-steps">' +
      '<li><strong>One person hosts.</strong> Tap <em>Create Session</em> below to start and get a 4-letter code.</li>' +
      '<li><strong>Everyone else joins.</strong> On your own phone, type that code into the <em>Join</em> box.</li>' +
      '<li><strong>Pick your instrument.</strong> Saron, Demung, Bonang, Kempul, Gong or Kendang — each plays a different role in the ensemble.</li>' +
      '<li><strong>Play together.</strong> Tap the keys — whatever anyone in the group plays, everyone hears, in real time.</li>' +
    '</ol>' +
    '</div>';
};

GamelanUI.prototype._sessionIdleTpl = function() {
  return '<div class="gln-sess-idle">' +
    '<div class="gln-name-row">' +
      '<label class="gln-label">Your name</label>' +
      '<input class="gln-name-input" id="glnName" value="' + this._esc(this.myName) + '" maxlength="20">' +
    '</div>' +
    '<div class="gln-sess-btns">' +
      '<button class="gln-btn gln-create-btn" id="glnCreate">Create Session</button>' +
      '<div class="gln-join-row">' +
        '<input class="gln-code-input" id="glnCodeInput" placeholder="CODE" maxlength="4">' +
        '<button class="gln-btn gln-join-btn" id="glnJoin">Join</button>' +
      '</div>' +
    '</div>' +
    '<p class="gln-sess-hint">Create a session and share the 4-letter code with friends</p>' +
    '</div>';
};

GamelanUI.prototype._sessionActiveTpl = function(code, isHost) {
  return '<div class="gln-sess-active">' +
    (isHost ?
      '<div class="gln-code-display">' +
        '<span class="gln-code-label">Share code</span>' +
        '<span class="gln-code-big" id="glnCodeBig">' + this._esc(code) + '</span>' +
      '</div>' :
      '<span class="gln-joined-badge">Connected &middot; ' + this._esc(code) + '</span>'
    ) +
    '<button class="gln-btn gln-leave-btn" id="glnLeave">Leave</button>' +
    '</div>';
};

GamelanUI.prototype._playersTpl = function() {
  if (!this.session) return '';
  var players = this.session._list();
  var myId = this.session.localId;
  var isHost = this.session.isHost;
  var html = '';
  for (var i = 0; i < players.length; i++) {
    var p = players[i];
    var inst = INSTRUMENTS[p.instrument] || INSTRUMENTS.saron;
    var isMe = p.id === myId;
    var badge = '<span class="gln-p-inst" style="background:' + inst.bg + ';color:' + inst.text + ';border-color:' + inst.border + '">' + this._esc(inst.short) + '</span>';
    var assign = '';
    if (isHost && !isMe) {
      assign = '<select class="gln-assign-sel" data-target="' + this._esc(p.id) + '">';
      for (var j = 0; j < INSTRUMENT_ORDER.length; j++) {
        var iid = INSTRUMENT_ORDER[j];
        assign += '<option value="' + iid + '"' + (p.instrument === iid ? ' selected' : '') + '>' + INSTRUMENTS[iid].short + '</option>';
      }
      assign += '</select>';
    }
    html += '<div class="gln-player-row' + (isMe ? ' gln-me' : '') + '">' +
      '<span class="gln-p-dot" style="background:' + inst.bg + '"></span>' +
      '<span class="gln-p-name">' + this._esc(p.name) + (isMe ? ' (you)' : '') + '</span>' +
      (isHost && !isMe ? assign : badge) +
      '</div>';
  }
  return html;
};

GamelanUI.prototype._pickerTpl = function(curInstId) {
  var html = '<div class="gln-picker" id="glnPicker"><p class="gln-picker-label">Choose your instrument:</p><div class="gln-picker-grid">';
  for (var i = 0; i < INSTRUMENT_ORDER.length; i++) {
    var id = INSTRUMENT_ORDER[i];
    var ii = INSTRUMENTS[id];
    html += '<button class="gln-pick-btn' + (curInstId === id ? ' active' : '') + '" data-pick="' + id + '" style="--pbg:' + ii.bg + ';--pbdr:' + ii.border + ';--ptxt:' + ii.text + '">' + this._esc(ii.short) + '</button>';
  }
  html += '</div></div>';
  return html;
};

GamelanUI.prototype._keysTpl = function(instId) {
  var inst = INSTRUMENTS[instId];
  if (!inst) return '';
  var layout = inst.layout;
  var keys = inst.keys;
  var notes = inst.notes;
  var bg = inst.bg, border = inst.border, text = inst.text;

  if (layout === 'keys') {
    var html = '<div class="gln-key-row">';
    for (var i = 0; i < keys.length; i++) {
      html += this._key(instId, notes[i], keys[i], bg, border, text);
    }
    return html + '</div>';
  }

  if (layout === 'bonang') {
    var top = keys.slice(0,5), topN = notes.slice(0,5);
    var bot = keys.slice(5), botN = notes.slice(5);
    var h = '<div class="gln-bonang-grid"><div class="gln-bonang-row">';
    for (var a = 0; a < top.length; a++) h += this._circKey(instId, topN[a], top[a], bg, border, text, '');
    h += '</div><div class="gln-bonang-row">';
    for (var b = 0; b < bot.length; b++) h += this._circKey(instId, botN[b], bot[b], bg, border, text, '');
    return h + '</div></div>';
  }

  if (layout === 'gong-row') {
    var gr = '<div class="gln-gong-row">';
    for (var c = 0; c < keys.length; c++) gr += this._circKey(instId, notes[c], keys[c], bg, border, text, 'lg');
    return gr + '</div>';
  }

  if (layout === 'gong-single') {
    return '<div class="gln-gong-single">' + this._circKey(instId, notes[0], 'GONG', bg, border, text, 'xl') + '</div>';
  }

  if (layout === 'drums') {
    var dr = '<div class="gln-drum-grid">';
    for (var d = 0; d < keys.length; d++) dr += this._drumPad(instId, notes[d], keys[d], bg, border, text);
    return dr + '</div>';
  }

  return '';
};

GamelanUI.prototype._key = function(inst, noteIdx, lbl, bg, border, text) {
  return '<button class="gln-key" data-inst="' + inst + '" data-note="' + noteIdx + '" style="background:' + bg + ';border-color:' + border + ';color:' + text + '" aria-label="Play note ' + this._esc(lbl) + '">' + this._esc(lbl) + '</button>';
};

GamelanUI.prototype._circKey = function(inst, noteIdx, lbl, bg, border, text, size) {
  var cls = 'gln-circ-key' + (size ? ' gln-circ-' + size : '');
  return '<button class="' + cls + '" data-inst="' + inst + '" data-note="' + noteIdx + '" style="background:' + bg + ';border-color:' + border + ';color:' + text + '" aria-label="Play ' + this._esc(lbl) + '">' + this._esc(lbl) + '</button>';
};

GamelanUI.prototype._drumPad = function(inst, noteIdx, lbl, bg, border, text) {
  return '<button class="gln-drum-pad" data-inst="' + inst + '" data-note="' + noteIdx + '" style="background:' + bg + ';border-color:' + border + ';color:' + text + '" aria-label="Play ' + this._esc(lbl) + '">' + this._esc(lbl) + '</button>';
};

// ── events ────────────────────────────────────

GamelanUI.prototype._bind = function() {
  var self = this;

  // Pre-warm audio context on any touch in this tab (helps iOS unlock)
  self.tab.addEventListener('touchstart', function() {
    self.synth._boot().catch(function(){});
  }, {once: true, passive: true});

  // Instrument keys
  self._bindKeys();

  // Session controls
  var createBtn = self.tab.querySelector('#glnCreate');
  if (createBtn) createBtn.addEventListener('click', function() { self._onCreate(); });

  var joinBtn = self.tab.querySelector('#glnJoin');
  if (joinBtn) joinBtn.addEventListener('click', function() { self._onJoin(); });

  var codeInput = self.tab.querySelector('#glnCodeInput');
  if (codeInput) {
    codeInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') self._onJoin(); });
    codeInput.addEventListener('input', function() {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  var leaveBtn = self.tab.querySelector('#glnLeave');
  if (leaveBtn) leaveBtn.addEventListener('click', function() { self._onLeave(); });

  var cycleBtn = self.tab.querySelector('#glnCycleBtn');
  if (cycleBtn) {
    cycleBtn.addEventListener('click', function() {
      var idx = INSTRUMENT_ORDER.indexOf(self.soloInst);
      self.soloInst = INSTRUMENT_ORDER[(idx + 1) % INSTRUMENT_ORDER.length];
      self._draw();
    });
  }

  var pickBtns = self.tab.querySelectorAll('[data-pick]');
  for (var i = 0; i < pickBtns.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        self.soloInst = btn.dataset.pick;
        self._draw();
      });
    })(pickBtns[i]);
  }

  self._bindAssign();

  var codeBig = self.tab.querySelector('#glnCodeBig');
  if (codeBig) {
    codeBig.style.cursor = 'pointer';
    codeBig.title = 'Tap to copy';
    codeBig.addEventListener('click', function() {
      var code = self.session ? self.session.code : '';
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).catch(function(){});
      }
      codeBig.textContent = 'COPIED!';
      setTimeout(function() { codeBig.textContent = code; }, 1400);
    });
  }

  var nameInput = self.tab.querySelector('#glnName');
  if (nameInput) {
    nameInput.addEventListener('input', function() { self.myName = nameInput.value || 'Player'; });
  }
};

GamelanUI.prototype._bindKeys = function() {
  var self = this;
  var keys = self.tab.querySelectorAll('[data-inst][data-note]');
  for (var i = 0; i < keys.length; i++) {
    (function(el) {
      el.addEventListener('touchstart', function(e) {
        e.preventDefault();
        self._press(el);
      }, {passive: false});
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        self._press(el);
      });
    })(keys[i]);
  }
};

GamelanUI.prototype._bindAssign = function() {
  var self = this;
  var sels = self.tab.querySelectorAll('.gln-assign-sel');
  for (var i = 0; i < sels.length; i++) {
    (function(sel) {
      sel.addEventListener('change', function() {
        if (self.session) self.session.assignInstrument(sel.dataset.target, sel.value);
      });
    })(sels[i]);
  }
};

GamelanUI.prototype._press = function(el) {
  var instId = el.dataset.inst;
  var noteIdx = parseInt(el.dataset.note, 10);
  this.synth.play(instId, noteIdx);
  if (this.session) this.session.sendNote(instId, noteIdx);
  this._ripple(el, false);
};

GamelanUI.prototype._ripple = function(el, isRemote) {
  var cls = isRemote ? 'gln-remote' : 'gln-pressed';
  el.classList.add(cls);
  var key = (el.dataset.inst || '') + '-' + (el.dataset.note || '') + (isRemote ? '-r' : '');
  if (this._rippleTimers[key]) clearTimeout(this._rippleTimers[key]);
  var self = this;
  this._rippleTimers[key] = setTimeout(function() {
    el.classList.remove('gln-pressed', 'gln-remote');
  }, isRemote ? 300 : 140);
};

GamelanUI.prototype._flashRemote = function(instId, noteIdx) {
  var sel = '[data-inst="' + instId + '"][data-note="' + noteIdx + '"]';
  var els = this.tab.querySelectorAll(sel);
  for (var i = 0; i < els.length; i++) this._ripple(els[i], true);
};

// ── session actions ───────────────────────────

GamelanUI.prototype._readName = function() {
  var inp = this.tab.querySelector('#glnName');
  if (inp) this.myName = inp.value.trim() || 'Player';
};

GamelanUI.prototype._onCreate = function() {
  var self = this;
  self._readName();
  if (self.session) { self.session.destroy(); self.session = null; }
  var sess = new GamelanSession();
  self._hookSession(sess);
  sess.createSession(self.myName, self.soloInst).then(function() {
    self.session = sess;
    self._draw();
  }).catch(function() {
    self._showStatus('Could not create session – check internet connection');
  });
};

GamelanUI.prototype._onJoin = function() {
  var self = this;
  self._readName();
  var input = self.tab.querySelector('#glnCodeInput');
  var code = input ? input.value.trim().toUpperCase() : '';
  if (code.length !== 4) { self._showStatus('Enter the 4-letter code'); return; }

  if (self.session) { self.session.destroy(); self.session = null; }
  var sess = new GamelanSession();
  self._hookSession(sess);
  sess.joinSession(code, self.myName, self.soloInst).then(function() {
    self.session = sess;
    self._draw();
  }).catch(function() {
    self._showStatus('Could not join – check the code and try again');
  });
};

GamelanUI.prototype._onLeave = function() {
  if (this.session) { this.session.destroy(); this.session = null; }
  this._draw();
};

GamelanUI.prototype._hookSession = function(sess) {
  var self = this;

  sess.onNote = function(data) {
    if (data.from === sess.localId) return;
    self.synth.play(data.instrument, data.noteIndex, data.velocity);
    self._flashRemote(data.instrument, data.noteIndex);
  };

  sess.onPlayers = function() {
    var pl = self.tab.querySelector('#glnPlayers');
    if (pl) pl.innerHTML = self._playersTpl();
    self._bindAssign();

    var keysArea = self.tab.querySelector('#glnKeysArea');
    if (keysArea) {
      keysArea.innerHTML = self._keysTpl(self._curInst());
      self._bindKeys();
    }
    self._refreshHeader();
  };

  sess.onStatus = function(msg) { self._showStatus(msg); };
};

GamelanUI.prototype._refreshHeader = function() {
  var inst = INSTRUMENTS[this._curInst()];
  var hdr = this.tab.querySelector('.gln-inst-header');
  if (!hdr || !inst) return;
  hdr.style.background = inst.bg;
  hdr.style.borderColor = inst.border;
  hdr.style.color = inst.text;
  var nm = hdr.querySelector('.gln-inst-name');
  var rl = hdr.querySelector('.gln-inst-role');
  if (nm) nm.textContent = inst.name;
  if (rl) rl.textContent = inst.role;
};

GamelanUI.prototype._showStatus = function(msg) {
  var bar = this.tab.querySelector('.gln-status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'gln-status-bar';
    var root = this.tab.querySelector('.gln-root');
    if (root) root.insertBefore(bar, root.firstChild);
  }
  bar.textContent = msg;
  bar.classList.add('visible');
  if (this._statusTimer) clearTimeout(this._statusTimer);
  this._statusTimer = setTimeout(function() { bar.classList.remove('visible'); }, 3500);
};

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────

export function initGamelan(tabEl) {
  var ui = new GamelanUI();
  ui.mount(tabEl);
  return ui;
}
