import { NOTE_NAMES, noteToFreq } from './shared.js';

const SCALES = {
  'pent-min': [0, 3, 5, 7, 10],
  'pent-maj': [0, 2, 4, 7, 9],
  'major':    [0, 2, 4, 5, 7, 9, 11],
  'minor':    [0, 2, 3, 5, 7, 8, 10],
};

let scaleRoot = 'A';
let scaleType = 'pent-min';
let scaleBpm = 80;
let patternLen = 6;
let difficulty = 'easy';
let currentPattern = null;
let isPlaying = false;
let loopActive = false;
let loopTimer = null;
let playGen = 0;
let scaleAudioCtx = null;

function ensureCtx() {
  if (!scaleAudioCtx) {
    scaleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const silent = scaleAudioCtx.createBuffer(1, 1, scaleAudioCtx.sampleRate);
    const src = scaleAudioCtx.createBufferSource();
    src.buffer = silent;
    src.connect(scaleAudioCtx.destination);
    src.start(0);
  }
  if (scaleAudioCtx.state === 'suspended') scaleAudioCtx.resume();
}

// Stability weight by interval from root (0=tonic … 11=major seventh)
const STABILITY = { 0: 4, 7: 3, 4: 2.5, 3: 2.5, 5: 2, 9: 2, 8: 1.5, 10: 1.5, 2: 1.2, 11: 1 };

function spreadWeight(semitoneDist) {
  if (semitoneDist === 0) return 0.6;   // same note: ok ma non esagerato
  if (semitoneDist <= 3)  return 1.0;   // step / piccolo skip
  if (semitoneDist <= 5)  return 0.65;  // skip
  if (semitoneDist <= 8)  return 0.3;   // salto
  return 0.1;                           // salto grande
}

function weightedPick(pool, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function buildNotePool() {
  const rootIdx = NOTE_NAMES.indexOf(scaleRoot);
  const intervals = SCALES[scaleType];

  const full = [];
  for (const oct of [2, 3, 4, 5]) {
    for (const interval of intervals) {
      const semitone = rootIdx + interval;
      const noteOct = oct + Math.floor(semitone / 12);
      if (noteOct >= 2 && noteOct <= 5) {
        const label = NOTE_NAMES[semitone % 12];
        full.push({
          name: label + noteOct,
          label,
          midi: (noteOct + 1) * 12 + NOTE_NAMES.indexOf(label),
          interval,
        });
      }
    }
  }

  if (difficulty === 'easy') {
    return full.filter(n => {
      const oct = parseInt(n.name.slice(-1));
      return oct === 3 || oct === 4;
    });
  }

  const windowSize = intervals.length * 2;
  const maxStart = Math.max(0, full.length - windowSize);
  const start = Math.floor(Math.random() * (maxStart + 1));
  return full.slice(start, start + windowSize);
}

function generatePattern() {
  const pool = buildNotePool();
  if (!pool.length) return [];

  let cur = weightedPick(pool, pool.map(n => STABILITY[n.interval] ?? 1));

  if (difficulty === 'easy') {
    const result = [{ ...cur, duration: 1, muted: false }];
    for (let i = 1; i < patternLen; i++) {
      const w = pool.map(n => (STABILITY[n.interval] ?? 1) * spreadWeight(Math.abs(n.midi - cur.midi)));
      cur = weightedPick(pool, w);
      result.push({ ...cur, duration: 1, muted: false });
    }
    return result;
  }

  // Medium: riempie patternLen beat con note (1 o 2 beat) e muting (15%)
  const result = [{ ...cur, duration: 1, muted: false }];
  let remaining = patternLen - 1;

  while (remaining > 0) {
    if (Math.random() < 0.15) {
      result.push({ ...cur, label: '×', duration: 1, muted: true });
      remaining -= 1;
    } else {
      const w = pool.map(n => (STABILITY[n.interval] ?? 1) * spreadWeight(Math.abs(n.midi - cur.midi)));
      cur = weightedPick(pool, w);
      const duration = (remaining >= 2 && Math.random() < 0.25) ? 2 : 1;
      result.push({ ...cur, duration, muted: false });
      remaining -= duration;
    }
  }

  return result;
}

// Karplus-Strong — beatMult allunga il decay per note prolungate
function pluck(ctx, freq, beatMult = 1) {
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const decay = Math.min(60 / scaleBpm * 2 * beatMult, 3.5);
  const bufLen = Math.ceil(sr * decay);
  const buf = ctx.createBuffer(1, bufLen, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
  for (let i = period; i < bufLen; i++) d[i] = 0.499 * (d[i - period] + d[i - period + 1]);
  const t = ctx.currentTime + 0.005;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + decay + 0.05);
}

// Rumore impulsivo per simulare palm mute / nota smorzata
function mute(ctx) {
  const t = ctx.currentTime + 0.005;
  const sr = ctx.sampleRate;
  const bufLen = Math.ceil(sr * 0.07);
  const buf = ctx.createBuffer(1, bufLen, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 5);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, t);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.08);
}

// Scheduling via setTimeout: ogni nota parte esattamente quando il timer scatta
function playPattern(pattern, onNote, onEnd) {
  ensureCtx();
  const beatMs = 60000 / scaleBpm;
  let timeMs = 80;

  pattern.forEach((note, i) => {
    const t = timeMs;
    setTimeout(() => {
      if (note.muted) {
        mute(scaleAudioCtx);
      } else {
        const freq = noteToFreq(note.name);
        if (freq) pluck(scaleAudioCtx, freq, note.duration || 1);
      }
      onNote(i);
    }, t);
    timeMs += (note.duration || 1) * beatMs;
  });

  setTimeout(onEnd, timeMs);
}

// ── DOM ───────────────────────────────────────────
const playBtn    = document.getElementById('scale-play-btn');
const againBtn   = document.getElementById('scale-again-btn');
const revealBtn  = document.getElementById('scale-reveal-btn');
const newBtn     = document.getElementById('scale-new-btn');
const loopBtn    = document.getElementById('scale-loop-btn');
const dotsEl     = document.getElementById('scale-pattern-dots');
const notesEl    = document.getElementById('scale-pattern-notes');
const actionRow  = document.getElementById('scale-action-row');
const patCard    = document.getElementById('scale-pattern-card');
const bpmSlider  = document.getElementById('scale-bpm');
const bpmValEl   = document.getElementById('scale-bpm-val');
const lenValEl   = document.getElementById('scale-len-val');

function renderDots(pattern, activeIdx = -1) {
  dotsEl.innerHTML = '';
  pattern.forEach((note, i) => {
    const d = document.createElement('div');
    let cls = 'scale-dot';
    if (i === activeIdx) cls += ' active';
    if (note.muted)      cls += ' muted';
    if (note.duration === 2) cls += ' long';
    d.className = cls;
    if (note.muted) d.textContent = '×';
    dotsEl.appendChild(d);
  });
}

function renderNotes(pattern) {
  notesEl.innerHTML = '';
  pattern.forEach(note => {
    const pill = document.createElement('span');
    pill.className = 'scale-note-pill' + (note.muted ? ' muted' : '');
    pill.textContent = note.label + (note.duration === 2 ? ' ─' : '');
    notesEl.appendChild(pill);
  });
  notesEl.style.display = 'flex';
}

function resetPlayUI() {
  isPlaying = false;
  loopActive = false;
  clearTimeout(loopTimer);
  loopTimer = null;
  playBtn.textContent = '▶ Play Pattern';
  playBtn.disabled = false;
  if (currentPattern) {
    renderDots(currentPattern);
    actionRow.style.display = 'flex';
  }
}

function startPlay(pattern) {
  if (isPlaying) return;
  isPlaying = true;
  const gen = ++playGen;
  patCard.style.display = 'block';
  actionRow.style.display = 'none';
  notesEl.style.display = 'none';
  renderDots(pattern);

  if (loopActive) {
    playBtn.textContent = '■ Stop';
    playBtn.disabled = false;
  } else {
    playBtn.textContent = '▶ Play Pattern';
    playBtn.disabled = true;
  }

  playPattern(
    pattern,
    i => { if (playGen === gen) renderDots(pattern, i); },
    () => {
      if (playGen !== gen) return;
      isPlaying = false;
      renderDots(pattern);
      if (loopActive) {
        // 1-beat pause between repetitions
        loopTimer = setTimeout(() => {
          if (loopActive) startPlay(pattern);
        }, 60000 / scaleBpm);
      } else {
        playBtn.textContent = '▶ Play Pattern';
        playBtn.disabled = false;
        actionRow.style.display = 'flex';
      }
    }
  );
}

function updateLenDisplay() {
  lenValEl.textContent = patternLen + ' n';
}

// ── Events ────────────────────────────────────────
playBtn.addEventListener('click', () => {
  if (loopActive || isPlaying) {
    playGen++;
    resetPlayUI();
    return;
  }
  currentPattern = generatePattern();
  startPlay(currentPattern);
});

againBtn.addEventListener('click', () => {
  if (currentPattern) startPlay(currentPattern);
});

revealBtn.addEventListener('click', () => {
  if (currentPattern) renderNotes(currentPattern);
});

loopBtn.addEventListener('click', () => {
  if (!currentPattern || isPlaying) return;
  loopActive = true;
  startPlay(currentPattern);
});

newBtn.addEventListener('click', () => {
  currentPattern = generatePattern();
  notesEl.style.display = 'none';
  actionRow.style.display = 'none';
  startPlay(currentPattern);
});

bpmSlider.addEventListener('input', e => {
  scaleBpm = parseInt(e.target.value);
  bpmValEl.textContent = scaleBpm;
});

document.querySelectorAll('.scale-bpm-step').forEach(btn => {
  btn.addEventListener('click', () => {
    scaleBpm = Math.max(40, Math.min(240, scaleBpm + parseInt(btn.dataset.delta)));
    bpmSlider.value = scaleBpm;
    bpmValEl.textContent = scaleBpm;
    const pct = ((scaleBpm - 40) / 200) * 100;
    bpmSlider.style.setProperty('--fill', pct + '%');
  });
});

document.querySelectorAll('.scale-len-step').forEach(btn => {
  btn.addEventListener('click', () => {
    patternLen = Math.max(4, Math.min(12, patternLen + parseInt(btn.dataset.delta)));
    updateLenDisplay();
  });
});

document.querySelectorAll('.scale-root-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scale-root-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    scaleRoot = btn.dataset.note;
  });
});

document.querySelectorAll('.scale-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scale-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    scaleType = btn.dataset.type;
  });
});

document.querySelectorAll('.scale-diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scale-diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});
