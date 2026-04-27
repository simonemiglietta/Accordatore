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
let currentPattern = null;
let isPlaying = false;
let scaleAudioCtx = null;

function ensureCtx() {
  if (!scaleAudioCtx) scaleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (scaleAudioCtx.state === 'suspended') scaleAudioCtx.resume();
}

function buildNotePool() {
  const rootIdx = NOTE_NAMES.indexOf(scaleRoot);
  const intervals = SCALES[scaleType];
  const pool = [];
  for (const oct of [3, 4]) {
    for (const interval of intervals) {
      const semitone = rootIdx + interval;
      const noteOct = oct + Math.floor(semitone / 12);
      pool.push({ name: NOTE_NAMES[semitone % 12] + noteOct, label: NOTE_NAMES[semitone % 12] });
    }
  }
  return pool;
}

function generatePattern() {
  const pool = buildNotePool();
  const len = 4 + Math.floor(Math.random() * 3);
  return Array.from({ length: len }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function pluck(ctx, freq, startTime, beatDur) {
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const bufLen = Math.ceil(sr * beatDur * 2.2);
  const buf = ctx.createBuffer(1, bufLen, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
  for (let i = period; i < bufLen; i++) d[i] = 0.499 * (d[i - period] + d[i - period + 1]);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + beatDur * 2.2);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(startTime);
  src.stop(startTime + beatDur * 2.2);
}

function playPattern(pattern, onNote, onEnd) {
  ensureCtx();
  const beatDur = 60 / scaleBpm;
  const t0 = scaleAudioCtx.currentTime + 0.1;
  pattern.forEach((note, i) => {
    const freq = noteToFreq(note.name);
    if (freq) pluck(scaleAudioCtx, freq, t0 + i * beatDur, beatDur);
    const delay = (t0 + i * beatDur - scaleAudioCtx.currentTime) * 1000;
    setTimeout(() => onNote(i), Math.max(0, delay));
  });
  const totalMs = (t0 + pattern.length * (60 / scaleBpm) - scaleAudioCtx.currentTime) * 1000;
  setTimeout(onEnd, Math.max(0, totalMs));
}

// ── DOM ───────────────────────────────────────────
const playBtn   = document.getElementById('scale-play-btn');
const againBtn  = document.getElementById('scale-again-btn');
const revealBtn = document.getElementById('scale-reveal-btn');
const newBtn    = document.getElementById('scale-new-btn');
const dotsEl    = document.getElementById('scale-pattern-dots');
const notesEl   = document.getElementById('scale-pattern-notes');
const actionRow = document.getElementById('scale-action-row');
const patCard   = document.getElementById('scale-pattern-card');
const bpmSlider = document.getElementById('scale-bpm');
const bpmValEl  = document.getElementById('scale-bpm-val');

function renderDots(pattern, activeIdx = -1) {
  dotsEl.innerHTML = '';
  pattern.forEach((_, i) => {
    const d = document.createElement('div');
    d.className = 'scale-dot' + (i === activeIdx ? ' active' : '');
    dotsEl.appendChild(d);
  });
}

function renderNotes(pattern) {
  notesEl.innerHTML = '';
  pattern.forEach(note => {
    const pill = document.createElement('span');
    pill.className = 'scale-note-pill';
    pill.textContent = note.label;
    notesEl.appendChild(pill);
  });
  notesEl.style.display = 'flex';
}

function startPlay(pattern) {
  if (isPlaying) return;
  isPlaying = true;
  patCard.style.display = 'block';
  actionRow.style.display = 'none';
  notesEl.style.display = 'none';
  renderDots(pattern);
  playBtn.disabled = true;

  playPattern(
    pattern,
    i => renderDots(pattern, i),
    () => {
      isPlaying = false;
      renderDots(pattern);
      actionRow.style.display = 'flex';
      playBtn.disabled = false;
    }
  );
}

// ── Events ────────────────────────────────────────
playBtn.addEventListener('click', () => {
  currentPattern = generatePattern();
  startPlay(currentPattern);
});

againBtn.addEventListener('click', () => {
  if (currentPattern) startPlay(currentPattern);
});

revealBtn.addEventListener('click', () => {
  if (currentPattern) renderNotes(currentPattern);
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

document.querySelectorAll('.scale-step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    scaleBpm = Math.max(40, Math.min(160, scaleBpm + parseInt(btn.dataset.delta)));
    bpmSlider.value = scaleBpm;
    bpmValEl.textContent = scaleBpm;
    const pct = ((scaleBpm - 40) / 120) * 100;
    bpmSlider.style.setProperty('--fill', pct + '%');
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
