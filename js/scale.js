import { NOTE_NAMES, noteToFreq } from './shared.js';

const SCALES = {
  'pent-min': [0, 3, 5, 7, 10],
  'pent-maj': [0, 2, 4, 7, 9],
  'major':    [0, 2, 4, 5, 7, 9, 11],
  'minor':    [0, 2, 3, 5, 7, 8, 10],
};

// ── Lick library ─────────────────────────────────
// s = semitones from root · d = beats (0.5=croma, 1=quarto, 2=metà) · t = technique · bs = bendSemitones
const LICKS = [
  { name: "Pentatonic Descent",  notes: [{s:12,d:0.5},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Blues Ascent",        notes: [{s:0,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:7,d:0.5},{s:10,d:0.5},{s:12,d:1}] },
  { name: "BB King Bend",        notes: [{s:5,d:0.333},{s:7,d:0.333},{s:10,d:0.333},{s:12,d:1.5,t:'bend',bs:2},{s:10,d:0.5},{s:7,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Slow Blues",          notes: [{s:12,d:2,t:'bend',bs:2},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Hendrix Curl",        notes: [{s:7,d:1.5,t:'bend',bs:1},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Bend & Release",      notes: [{s:7,d:2,t:'bendRelease',bs:2},{s:5,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:0,d:1}] },
  { name: "Clapton Run",         notes: [{s:12,d:0.5},{s:10,d:0.5},{s:12,d:0.5},{s:10,d:0.5},{s:7,d:0.5},{s:10,d:0.5},{s:7,d:1}] },
  { name: "Hammer-on Run",       notes: [{s:0,d:0.5},{s:3,d:0.5,t:'ho'},{s:5,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Pull-off Lick",       notes: [{s:12,d:0.5},{s:10,d:0.5},{s:7,d:0.5,t:'po'},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Classic Resolution",  notes: [{s:5,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:3,d:1.5},{s:0,d:1}] },
  { name: "Albert King",         notes: [{s:10,d:0.5},{s:12,d:1.5,t:'bend',bs:2},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Page Style",          notes: [{s:0,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:7,d:0.5},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Double Pentatonic",   notes: [{s:0,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:7,d:0.5},{s:10,d:0.5},{s:12,d:0.5},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Root Bounce",         notes: [{s:0,d:0.5},{s:3,d:0.5},{s:0,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Vibrato High",        notes: [{s:12,d:1.5,t:'bend',bs:1},{s:10,d:0.5},{s:12,d:1.5,t:'bend',bs:2},{s:10,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:0,d:1}] },
  { name: "Blue Note",           notes: [{s:0,d:0.667},{s:3,d:0.333},{s:5,d:0.667},{s:6,d:0.333},{s:7,d:1},{s:5,d:0.667},{s:3,d:0.333},{s:0,d:1}] },
  { name: "Descending Sequence", notes: [{s:12,d:0.333},{s:10,d:0.333},{s:7,d:0.333},{s:10,d:0.333},{s:7,d:0.333},{s:5,d:0.333},{s:7,d:0.333},{s:5,d:0.333},{s:3,d:0.333},{s:0,d:1}] },
  { name: "Minor-Major Bend",    notes: [{s:0,d:0.5},{s:3,d:1.5,t:'bend',bs:1},{s:5,d:0.5},{s:3,d:0.5},{s:5,d:0.5},{s:3,d:1,t:'bend',bs:1},{s:0,d:1}] },
  { name: "Mixolydian Run",      notes: [{s:10,d:0.5},{s:9,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:4,d:0.5},{s:2,d:0.5},{s:0,d:1}] },
  { name: "Pentatonic Skip",     notes: [{s:0,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:7,d:0.5},{s:5,d:0.5},{s:10,d:0.5},{s:7,d:0.5},{s:12,d:1}] },
  { name: "High Scream",         notes: [{s:15,d:0.5},{s:14,d:0.5},{s:12,d:0.5},{s:10,d:0.5},{s:12,d:1.5,t:'bend',bs:2},{s:10,d:0.5},{s:7,d:0.5},{s:0,d:1}] },
  { name: "Gary Moore",          notes: [{s:12,d:2,t:'bend',bs:2},{s:10,d:1},{s:7,d:2,t:'bendRelease',bs:2},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
  { name: "Chromatic Approach",  notes: [{s:0,d:0.5},{s:3,d:0.5},{s:4,d:0.5},{s:5,d:1},{s:7,d:0.5},{s:5,d:0.5},{s:3,d:0.5},{s:0,d:1}] },
];

function lickToPattern(lick) {
  const rootIdx = NOTE_NAMES.indexOf(scaleRoot);
  let prevLabel = null;
  return lick.notes.map(n => {
    const total = rootIdx + (n.s || 0);
    const octShift = Math.floor(total / 12);
    const noteIdx = ((total % 12) + 12) % 12;
    const noteOct = 3 + octShift;
    const label = NOTE_NAMES[noteIdx];
    const fromLabel = (n.t === 'ho' || n.t === 'po') ? prevLabel : null;
    prevLabel = label;
    return {
      name: label + noteOct, label, interval: ((n.s || 0) % 12 + 12) % 12,
      midi: (noteOct + 1) * 12 + noteIdx,
      duration: n.d || 1, muted: false,
      technique: n.t || null, fromLabel, bendSemitones: n.bs || null,
    };
  });
}

let scaleRoot = 'A';
let scaleType = 'pent-min';
let scaleBpm = 80;
let patternLen = 6;
let difficulty = 'easy';
let selectedLickIdx = 0;
let currentPattern = null;
let revealedPattern = null;
let isPlaying = false;
let loopActive = false;
let loopTimer = null;
let playGen = 0;
let scaleAudioCtx = null;
let guitarWave = null; // PeriodicWave warm guitar-like per i bend
let masterBus = null;  // shared output bus → dry + reverb send

function ensureCtx() {
  if (!scaleAudioCtx) {
    scaleAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const silent = scaleAudioCtx.createBuffer(1, 1, scaleAudioCtx.sampleRate);
    const src = scaleAudioCtx.createBufferSource();
    src.buffer = silent;
    src.connect(scaleAudioCtx.destination);
    src.start(0);

    // Armonici chitarra elettrica — serie più completa per timbro più ricco
    const N = 16;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    imag[1]=1.00; imag[2]=0.45; imag[3]=0.20; imag[4]=0.09;
    imag[5]=0.05; imag[6]=0.03; imag[7]=0.02; imag[8]=0.012;
    imag[9]=0.008; imag[10]=0.005; imag[11]=0.004; imag[12]=0.003;
    guitarWave = scaleAudioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

    // Master bus: dry → destination, + reverb send → convolver → destination
    masterBus = scaleAudioCtx.createGain();
    masterBus.gain.value = 1.0;
    masterBus.connect(scaleAudioCtx.destination);

    // Impulse response: small room (~1.2s, slightly warm/dark)
    const sr = scaleAudioCtx.sampleRate;
    const irLen = Math.ceil(sr * 1.2);
    const ir = scaleAudioCtx.createBuffer(2, irLen, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      const pre = Math.floor(sr * 0.015); // 15ms pre-delay
      for (let i = pre; i < irLen; i++) {
        const t = (i - pre) / (irLen - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 1.8);
      }
      // One-pole LP per scurire la coda (rimuove l'harshness digitale)
      let z = 0;
      for (let i = 0; i < irLen; i++) z = d[i] = z * 0.35 + d[i] * 0.65;
      if (c === 1) for (let i = 0; i < irLen; i++) d[i] *= 0.88; // larghezza stereo
    }
    const convolver = scaleAudioCtx.createConvolver();
    convolver.buffer = ir;
    const reverbSend = scaleAudioCtx.createGain();
    reverbSend.gain.value = 0.25;
    masterBus.connect(reverbSend);
    reverbSend.connect(convolver);
    convolver.connect(scaleAudioCtx.destination);
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

  // Medium / Hard: sliding window across adjacent scale forms
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
    const result = [{ ...cur, duration: 1, muted: false, technique: null }];
    for (let i = 1; i < patternLen; i++) {
      const w = pool.map(n => (STABILITY[n.interval] ?? 1) * spreadWeight(Math.abs(n.midi - cur.midi)));
      cur = weightedPick(pool, w);
      result.push({ ...cur, duration: 1, muted: false, technique: null });
    }
    return result;
  }

  // Medium / Hard: riempie patternLen beat con note (0.5/1/2 beat) e muting (15%)
  const result = [{ ...cur, duration: 1, muted: false, technique: null, bendSemitones: null }];
  let remaining = patternLen - 1;
  let lastTechnique = null;
  let lastBendSemitones = 2;

  while (remaining > 0) {
    if (Math.random() < 0.15) {
      const muteDur = (remaining >= 0.5 && Math.random() < 0.35) ? 0.5 : 1;
      result.push({ ...cur, label: '×', duration: muteDur, muted: true, technique: null, bendSemitones: null });
      remaining -= muteDur;
      lastTechnique = null;
    } else {
      const w = pool.map(n => (STABILITY[n.interval] ?? 1) * spreadWeight(Math.abs(n.midi - cur.midi)));
      const prev = cur;
      cur = weightedPick(pool, w);

      let duration = 1;
      let technique = null;
      let fromLabel = null;
      let bendSemitones = null;

      if (difficulty === 'hard') {
        const semiDist = cur.midi - prev.midi;
        if (Math.random() < 0.25 && Math.abs(semiDist) >= 1 && Math.abs(semiDist) <= 3) {
          // hammer-on / pull-off
          technique = semiDist > 0 ? 'ho' : 'po';
          fromLabel = prev.label;
          const longProb = technique === 'po' ? 0.42 : 0.28;
          if (remaining >= 2 && Math.random() < longProb) duration = 2;
          else if (remaining >= 0.5 && Math.random() < 0.35) duration = 0.5;
          else duration = 1;
        } else if (Math.random() < 0.22) {
          // famiglia dei bend — mai su crome (il gesto ha bisogno di tempo)
          bendSemitones = Math.random() < 0.45 ? 1 : 2;

          if (lastTechnique === 'bend' && remaining >= 1 && Math.random() < 0.55) {
            technique = 'prebend';
            bendSemitones = lastBendSemitones;
            duration = 1;
          } else if (remaining >= 2 && Math.random() < 0.38) {
            technique = 'bendRelease';
            duration = 2;
          } else {
            technique = 'bend';
            duration = (remaining >= 2 && Math.random() < 0.32) ? 2 : 1;
          }

          lastBendSemitones = bendSemitones;
        } else {
          if (remaining >= 2 && Math.random() < 0.20) duration = 2;
          else if (remaining >= 0.5 && Math.random() < 0.35) duration = 0.5;
          else duration = 1;
        }
      } else {
        if (remaining >= 2 && Math.random() < 0.20) duration = 2;
        else if (remaining >= 0.5 && Math.random() < 0.35) duration = 0.5;
        else duration = 1;
      }

      lastTechnique = technique;
      result.push({ ...cur, duration, muted: false, technique, fromLabel, bendSemitones });
      remaining -= duration;
    }
  }

  return result;
}

// KS helper — costruisce il buffer con eccitazione personalizzabile
function ksBuffer(ctx, freq, beatMult, fillFn) {
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const decay = Math.min(60 / scaleBpm * 1.2 * beatMult, 2.5);
  const bufLen = Math.ceil(sr * decay);
  const buf = ctx.createBuffer(1, bufLen, sr);
  const d = buf.getChannelData(0);
  fillFn(d, period);
  // Loss freq-dipendente: note gravi sostengono più a lungo (come corde reali)
  const loss = 0.9995 + 0.0004 * Math.min(1, 180 / freq);
  for (let i = period; i < bufLen; i++) {
    d[i] = loss * 0.499 * (d[i - period] + d[i - period + 1]);
  }
  return { buf, decay };
}

// Pluck: due voci detuned di 4 cents → battimento naturale da corda reale
function pluck(ctx, freq, beatMult = 1, amplitude = 0.8) {
  const fillFn = (d, period) => {
    for (let i = 0; i < period; i++) {
      const p = i / period;
      const warm = Math.sin(Math.PI * p) * 0.52;
      const h2   = Math.sin(2 * Math.PI * p) * 0.30;
      const h3   = Math.sin(3 * Math.PI * p) * 0.12;
      const atk  = (Math.random() * 2 - 1) * Math.exp(-p * 10) * 0.36; // noise concentrato all'attacco
      d[i] = warm + h2 + h3 + atk;
    }
  };
  const { buf, decay } = ksBuffer(ctx, freq, beatMult, fillFn);
  const t = ctx.currentTime + 0.005;

  const src1 = ctx.createBufferSource();
  src1.buffer = buf;
  const src2 = ctx.createBufferSource();
  src2.buffer = buf;
  src2.detune.value = 4; // 4 cents → leggero chorus/battimento da corda

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(freq * 12, 7500);
  lp.Q.value = 0.5;

  // Risonanza corpo chitarra
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = Math.min(Math.max(freq * 1.6, 180), 260);
  body.Q.value = 2.2;
  body.gain.value = 6;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(amplitude * 0.50, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  src1.connect(lp); src2.connect(lp);
  lp.connect(body); body.connect(gain); gain.connect(masterBus);
  src1.start(t);         src1.stop(t + decay + 0.05);
  src2.start(t + 0.001); src2.stop(t + decay + 0.05);
}

// Hammer-on: eccitazione sinusoidale liscia, attacco lento (nessun transiente di plettro)
function pluckHO(ctx, freq, beatMult = 1) {
  const { buf, decay } = ksBuffer(ctx, freq, beatMult, (d, period) => {
    for (let i = 0; i < period; i++) d[i] = Math.sin(Math.PI * i / period);
  });
  const t = ctx.currentTime + 0.005;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(freq * 11, 7000);
  lp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.42, t + 0.022);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(lp); lp.connect(gain); gain.connect(masterBus);
  src.start(t);
  src.stop(t + decay + 0.05);
}

// Pull-off: semiseno + spike iniziale (snap del dito che tira la corda lateralmente)
function pluckPO(ctx, freq, beatMult = 1) {
  const { buf, decay } = ksBuffer(ctx, freq, beatMult, (d, period) => {
    for (let i = 0; i < period; i++) {
      const p = i / period;
      // Snap asimmetrico: dito che tira la corda lateralmente → attacco tagliente
      const snap = p < 0.15 ? p / 0.15 : -(p - 0.15) / 0.85;
      d[i] = snap * 0.65 + Math.sin(Math.PI * p) * 0.25 + (Math.random() * 2 - 1) * 0.10;
    }
  });
  const t = ctx.currentTime + 0.005;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // Filtro largo: preserva il carattere snap del pull-off
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(freq * 18, 11000);
  lp.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.65, t);
  gain.gain.exponentialRampToValueAtTime(0.42, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(lp); lp.connect(gain); gain.connect(masterBus);
  src.start(t);
  src.stop(t + decay + 0.05);
}

// Shared bend filter chain builder
function buildBendChain(ctx, osc, freq, t, decay) {
  // Usa la PeriodicWave warm se disponibile
  if (guitarWave) osc.setPeriodicWave(guitarWave);
  else osc.type = 'sawtooth';

  // Transiente di pick: leggero (corda già tesa = meno click)
  const nBuf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.016), ctx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 4);
  const nSrc = ctx.createBufferSource();
  nSrc.buffer = nBuf;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.26, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.016);
  nSrc.connect(nGain); nGain.connect(masterBus);
  nSrc.start(t);

  // Filtro passa-basso: parte brillante (freq * 8), poi si scalda
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 8, t);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.8, t + decay * 0.5);
  lp.Q.value = 0.7;

  // Corpo chitarra: leggermente ridotto
  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = Math.max(200, freq * 1.5);
  body.Q.value = 1.5;
  body.gain.value = 5; // era 7

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.44, t + 0.015); // attacco più morbido (era 0.009)
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  osc.connect(lp); lp.connect(body); body.connect(gain); gain.connect(masterBus);
  return gain;
}

// Bend ascendente: freq → freq+semitones. Vibrato automatico sui beat lunghi.
function playBend(ctx, freq, beatMult = 1, semitones = 2) {
  const t = ctx.currentTime + 0.005;
  const beatDur = 60 / scaleBpm;
  const decay = Math.min(beatDur * 1.2 * beatMult, 2.5);
  const targetFreq = freq * Math.pow(2, semitones / 12);
  const bendDur = beatMult >= 2 ? beatDur * 0.75 : Math.min(decay * 0.5, 0.5);
  const bendEnd = t + bendDur;

  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(targetFreq, bendEnd);

  // Vibrato dopo il bend per note lunghe
  if (beatMult >= 2 && decay > 1.0) {
    const vStart = bendEnd + 0.12;
    const vEnd = t + decay * 0.88;
    const vLen = vEnd - vStart;
    if (vLen > 0.25) {
      const vHz = 5.5, vDepth = 0.004;
      const N = Math.max(48, Math.round(vLen * vHz * 8));
      const curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const env = Math.min(1, i / (N * 0.28));
        curve[i] = targetFreq * (1 + vDepth * env * Math.sin(2 * Math.PI * i * vHz / (N / vLen)));
      }
      osc.frequency.setValueCurveAtTime(curve, vStart, vLen);
    }
  }

  buildBendChain(ctx, osc, freq, t, decay);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

// Bend-release: sale verso targetFreq nel primo beat, poi ridiscende alla nota base
function playBendRelease(ctx, freq, beatMult = 2, semitones = 2) {
  const t = ctx.currentTime + 0.005;
  const beatDur = 60 / scaleBpm;
  const decay = Math.min(beatDur * 1.2 * beatMult, 2.5);
  const targetFreq = freq * Math.pow(2, semitones / 12);
  const upEnd   = t + beatDur * 0.72;
  const holdEnd = upEnd + 0.06;
  const downEnd = t + beatDur * 1.55;

  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(targetFreq, upEnd);
  osc.frequency.setValueAtTime(targetFreq, holdEnd);
  osc.frequency.exponentialRampToValueAtTime(freq, downEnd);

  buildBendChain(ctx, osc, freq, t, decay);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

// Prebend-release: corda già in bend, rilascia verso il basso. Nessun transiente di pick.
function playPrebend(ctx, freq, beatMult = 1, semitones = 2) {
  const t = ctx.currentTime + 0.005;
  const beatDur = 60 / scaleBpm;
  const decay = Math.min(beatDur * 1.2 * beatMult, 2.5);
  const startFreq = freq * Math.pow(2, semitones / 12);
  const releaseEnd = t + Math.min(beatDur * 0.6, 0.55);

  const osc = ctx.createOscillator();
  if (guitarWave) osc.setPeriodicWave(guitarWave); else osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(freq, releaseEnd);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 3.5, t); // corda già in bend: scuro
  lp.frequency.exponentialRampToValueAtTime(freq * 1.7, t + decay * 0.5);
  lp.Q.value = 0.7;

  const body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = Math.max(200, freq * 1.5);
  body.Q.value = 1.5;
  body.gain.value = 5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.30, t); // niente attacco: corda già vibrante
  gain.gain.exponentialRampToValueAtTime(0.001, t + decay);

  osc.connect(lp); lp.connect(body); body.connect(gain); gain.connect(masterBus);
  osc.start(t);
  osc.stop(t + decay + 0.05);
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
  gain.connect(masterBus);
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
        if (freq) {
          const bm = note.duration || 1;
          const bs = note.bendSemitones ?? 2;
          if      (note.technique === 'bend')        playBend(scaleAudioCtx, freq, bm, bs);
          else if (note.technique === 'bendRelease') playBendRelease(scaleAudioCtx, freq, bm, bs);
          else if (note.technique === 'prebend')     playPrebend(scaleAudioCtx, freq, bm, bs);
          else if (note.technique === 'ho')          pluckHO(scaleAudioCtx, freq, bm);
          else if (note.technique === 'po')          pluckPO(scaleAudioCtx, freq, bm);
          else                                       pluck(scaleAudioCtx, freq, bm);
        }
      }
      onNote(i);
    }, t);
    timeMs += (note.duration || 1) * beatMs;
  });

  setTimeout(onEnd, timeMs);
}

// ── DOM ───────────────────────────────────────────
const playBtn       = document.getElementById('scale-play-btn');
const againBtn      = document.getElementById('scale-again-btn');
const revealBtn     = document.getElementById('scale-reveal-btn');
const newBtn        = document.getElementById('scale-new-btn');
const loopBtn       = document.getElementById('scale-loop-btn');
const dotsEl        = document.getElementById('scale-pattern-dots');
const notesEl       = document.getElementById('scale-pattern-notes');
const actionRow     = document.getElementById('scale-action-row');
const patCard       = document.getElementById('scale-pattern-card');
const bpmSlider     = document.getElementById('scale-bpm');
const bpmValEl      = document.getElementById('scale-bpm-val');
const lenValEl      = document.getElementById('scale-len-val');
const lickPickerEl  = document.getElementById('scale-lick-picker');
const lenRowEl      = document.getElementById('scale-len-row');

function buildLickPicker() {
  lickPickerEl.innerHTML = '';
  LICKS.forEach((lick, i) => {
    const btn = document.createElement('button');
    btn.className = 'scale-lick-item' + (i === selectedLickIdx ? ' active' : '');
    btn.textContent = lick.name;
    btn.addEventListener('click', () => {
      selectedLickIdx = i;
      lickPickerEl.querySelectorAll('.scale-lick-item')
        .forEach((b, j) => b.classList.toggle('active', j === i));
    });
    lickPickerEl.appendChild(btn);
  });
}

const TECHNIQUE_SYMBOL = { bend: '↑', bendRelease: '↑↓', prebend: '↓', ho: 'h', po: 'p' };
const DEGREE_NAMES = ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'];

function renderDots(pattern, activeIdx = -1) {
  dotsEl.innerHTML = '';
  pattern.forEach((note, i) => {
    const d = document.createElement('div');
    let cls = 'scale-dot';
    if (i === activeIdx)      cls += ' active';
    if (note.muted)           cls += ' muted';
    if (note.duration < 1)    cls += ' short';
    if (note.duration >= 2)   cls += ' long';
    if (note.technique)       cls += ' ' + note.technique;
    d.className = cls;
    if (note.muted)          d.textContent = '×';
    else if (note.technique) d.textContent = TECHNIQUE_SYMBOL[note.technique] ?? '';
    dotsEl.appendChild(d);
  });
}

function renderNotes(pattern) {
  notesEl.innerHTML = '';
  pattern.forEach(note => {
    const pill = document.createElement('span');
    const tech = note.technique;
    pill.className = 'scale-note-pill' + (note.muted ? ' muted' : tech ? ' ' + tech : '');

    if (note.muted) {
      pill.textContent = '×';
    } else {
      const sym = tech ? (TECHNIQUE_SYMBOL[tech] ?? '') : '';
      const dur = note.duration === 2 ? ' ─' : '';
      const main = document.createElement('span');
      main.textContent = (note.fromLabel ? note.fromLabel + '→' : '') + note.label + dur + sym;
      pill.appendChild(main);

      const deg = DEGREE_NAMES[note.interval % 12];
      if (deg) {
        const sup = document.createElement('span');
        sup.className = 'scale-note-degree';
        sup.textContent = deg;
        pill.appendChild(sup);
      }
    }

    notesEl.appendChild(pill);
  });
  notesEl.style.display = 'flex';
  revealedPattern = pattern;
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
  if (pattern !== revealedPattern) notesEl.style.display = 'none';
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
  currentPattern = difficulty === 'licks'
    ? lickToPattern(LICKS[selectedLickIdx])
    : generatePattern();
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
  if (difficulty === 'licks') {
    selectedLickIdx = Math.floor(Math.random() * LICKS.length);
    lickPickerEl.querySelectorAll('.scale-lick-item')
      .forEach((b, j) => b.classList.toggle('active', j === selectedLickIdx));
    currentPattern = lickToPattern(LICKS[selectedLickIdx]);
  } else {
    currentPattern = generatePattern();
  }
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
    patternLen = Math.max(4, Math.min(16, patternLen + parseInt(btn.dataset.delta)));
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
    const isLicks = difficulty === 'licks';
    lickPickerEl.classList.toggle('visible', isLicks);
    lenRowEl.style.display = isLicks ? 'none' : '';
    if (isLicks) buildLickPicker();
  });
});
