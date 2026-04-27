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
  return Array.from({ length: patternLen }, () => pool[Math.floor(Math.random() * pool.length)]);
}

function pluck(ctx, freq, startTime, beatDur) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.55, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.min(beatDur * 1.8, 2.5));
  osc.start(startTime);
  osc.stop(startTime + Math.min(beatDur * 1.8, 2.5) + 0.05);
}

function playPattern(pattern, onNote, onEnd) {
  ensureCtx();
  const beatDur = 60 / scaleBpm;
  const t0 = scaleAudioCtx.currentTime + 0.2;
  pattern.forEach((note, i) => {
    const freq = noteToFreq(note.name);
    if (freq) pluck(scaleAudioCtx, freq, t0 + i * beatDur, beatDur);
    const delayMs = (t0 + i * beatDur - scaleAudioCtx.currentTime) * 1000;
    setTimeout(() => onNote(i), Math.max(0, delayMs));
  });
  const endMs = (t0 + pattern.length * beatDur - scaleAudioCtx.currentTime) * 1000;
  setTimeout(onEnd, Math.max(0, endMs));
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
    scaleBpm = Math.max(40, Math.min(160, scaleBpm + parseInt(btn.dataset.delta)));
    bpmSlider.value = scaleBpm;
    bpmValEl.textContent = scaleBpm;
    const pct = ((scaleBpm - 40) / 120) * 100;
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
