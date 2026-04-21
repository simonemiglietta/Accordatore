import { NOTE_NAMES } from './shared.js';

const CHORD_TEMPLATES = [
  // Triads
  ["",        [0,4,7]],
  ["m",       [0,3,7]],
  ["dim",     [0,3,6]],
  ["aug",     [0,4,8]],
  ["sus2",    [0,2,7]],
  ["sus4",    [0,5,7]],
  // Sevenths
  ["maj7",    [0,4,7,11]],
  ["7",       [0,4,7,10]],
  ["m7",      [0,3,7,10]],
  ["mMaj7",   [0,3,7,11]],
  ["dim7",    [0,3,6,9]],
  ["m7b5",    [0,3,6,10]],
  ["aug7",    [0,4,8,10]],
  ["augMaj7", [0,4,8,11]],
  ["7sus4",   [0,5,7,10]],
  // Sixths
  ["6",       [0,4,7,9]],
  ["m6",      [0,3,7,9]],
  ["6/9",     [0,4,7,9,2]],
  // Ninths
  ["maj9",    [0,4,7,11,2]],
  ["9",       [0,4,7,10,2]],
  ["m9",      [0,3,7,10,2]],
  ["add9",    [0,4,7,2]],
  ["madd9",   [0,3,7,2]],
  ["9sus4",   [0,5,7,10,2]],
  // Elevenths
  ["11",      [0,4,7,10,2,5]],
  ["m11",     [0,3,7,10,2,5]],
  ["maj11",   [0,4,7,11,2,5]],
  // Thirteenths
  ["13",      [0,4,7,10,2,5,9]],
  ["maj13",   [0,4,7,11,2,5,9]],
  ["m13",     [0,3,7,10,2,5,9]],
  // Power
  ["5",       [0,7]],
];

const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };

function matchChord(pcSet) {
  if (pcSet.size < 2) return null;
  let best = null, bestScore = -1;
  for (let root = 0; root < 12; root++) {
    for (const [name, intervals] of CHORD_TEMPLATES) {
      const chordPcs = new Set(intervals.map(i => (root + i) % 12));
      let matched = 0;
      for (const pc of chordPcs) if (pcSet.has(pc)) matched++;
      const coverage = matched / chordPcs.size;
      const precision = matched / pcSet.size;
      if (matched < 2 || coverage < 0.65 || precision < 0.5) continue;
      const exactBonus = (matched === chordPcs.size && matched === pcSet.size) ? 0.15 : 0;
      const sizePenalty = chordPcs.size > pcSet.size ? (chordPcs.size - pcSet.size) * 0.04 : 0;
      const score = coverage * 0.55 + precision * 0.45 + exactBonus - sizePenalty;
      if (score > bestScore) { bestScore = score; best = { root, name, chordPcs, score, coverage, matched }; }
    }
  }
  return best;
}

function getSlashChord(match, bassPC) {
  if (bassPC === match.root) return null;
  return NOTE_NAMES[match.root] + match.name + "/" + NOTE_NAMES[bassPC];
}

function getPitchClasses(analyser, ctx) {
  const fftSize = analyser.fftSize;
  const buf = new Float32Array(fftSize);
  analyser.getFloatFrequencyData(buf);
  const sr = ctx.sampleRate, binHz = sr / fftSize;

  const sorted = Array.from(buf).filter(v => v > -140).sort((a,b) => a-b);
  const noiseFloor = sorted.length ? sorted[Math.floor(sorted.length * 0.4)] : -90;
  const margin = 18 - chordSens * 1.2;
  const threshold = noiseFloor + margin;

  const minBin = Math.max(1, Math.floor(70 / binHz));
  const maxBin = Math.min(buf.length - 1, Math.ceil(1400 / binHz));
  const minPeakDist = Math.max(1, Math.floor(15 / binHz));
  const peaks = [];

  for (let i = minBin + 1; i < maxBin - 1; i++) {
    if (buf[i] < threshold) continue;
    if (buf[i] <= buf[i-1] || buf[i] <= buf[i+1]) continue;
    let isPeak = true;
    for (let j = Math.max(minBin, i - minPeakDist); j <= Math.min(maxBin, i + minPeakDist); j++) {
      if (j !== i && buf[j] >= buf[i]) { isPeak = false; break; }
    }
    if (!isPeak) continue;
    const alpha = buf[i-1], beta = buf[i], gamma = buf[i+1];
    const denom = alpha - 2*beta + gamma;
    const frac = denom !== 0 ? 0.5 * (alpha - gamma) / denom : 0;
    peaks.push({ bin: i, mag: buf[i], freq: (i + frac) * binHz });
  }

  if (peaks.length === 0) return { pcEnergy: new Float32Array(12), bassPC: -1 };

  peaks.sort((a, b) => b.mag - a.mag);
  const suppressed = new Set();
  for (let pi = 0; pi < peaks.length; pi++) {
    if (suppressed.has(pi)) continue;
    const f0 = peaks[pi].freq;
    for (let h = 2; h <= 6; h++) {
      const hFreq = f0 * h;
      if (hFreq > 1400) break;
      for (let pj = pi + 1; pj < peaks.length; pj++) {
        if (suppressed.has(pj)) continue;
        const ratio = peaks[pj].freq / hFreq;
        if (ratio > 0.98 && ratio < 1.02) suppressed.add(pj);
      }
    }
  }

  const pcEnergy = new Float32Array(12);
  let bassPC = -1, bassMaxMag = -Infinity;
  for (let pi = 0; pi < peaks.length; pi++) {
    if (suppressed.has(pi)) continue;
    const { freq, mag } = peaks[pi];
    const midi = 12 * Math.log2(freq / 440) + 69;
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    pcEnergy[pc] += Math.pow(10, mag / 20);
    if (freq < 330 && mag > bassMaxMag) { bassMaxMag = mag; bassPC = pc; }
  }
  return { pcEnergy, bassPC };
}

let chordAudioCtx = null, chordAnalyser = null, chordMicStream = null;
let chordRunning = false, chordRaf = null;
let chordSens = 5;

const chordStartBtn  = document.getElementById("chord-start-btn");
const chordDot       = document.getElementById("chord-dot");
const chordBtnLabel  = document.getElementById("chord-btn-label");
const chordMain      = document.getElementById("chord-main");
const chordSub       = document.getElementById("chord-sub");
const chordNotesEl   = document.getElementById("chord-notes");
const chordAliases   = document.getElementById("chord-aliases");
const chordBarsEl    = document.getElementById("chord-bars");
const chordSpecCanvas = document.getElementById("chord-spectrum");
const chordSpecCtx   = chordSpecCanvas.getContext("2d");

for (let i = 0; i < 12; i++) {
  const b = document.createElement("div"); b.className = "chord-bar";
  const lbl = document.createElement("div");
  lbl.style.cssText = "font-size:9px;color:#aaa;text-align:center;margin-top:2px";
  lbl.textContent = NOTE_NAMES[i];
  const wrap = document.createElement("div");
  wrap.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:stretch";
  wrap.appendChild(b); wrap.appendChild(lbl);
  chordBarsEl.appendChild(wrap);
}

let chordHistory = [], chordHistorySize = 4;

function chordUpdate() {
  if (!chordAnalyser) return;
  chordRaf = requestAnimationFrame(chordUpdate);

  const { pcEnergy, bassPC } = getPitchClasses(chordAnalyser, chordAudioCtx);

  const fftBuf = new Float32Array(chordAnalyser.frequencyBinCount);
  chordAnalyser.getFloatFrequencyData(fftBuf);
  const sw = chordSpecCanvas.offsetWidth || 300;
  chordSpecCanvas.width = sw; chordSpecCanvas.height = 50;
  chordSpecCtx.fillStyle = "#050a03"; chordSpecCtx.fillRect(0, 0, sw, 50);
  chordSpecCtx.strokeStyle = "#39ff14"; chordSpecCtx.lineWidth = 1.5;
  chordSpecCtx.beginPath();
  const step = Math.floor(fftBuf.length / sw);
  for (let x = 0; x < sw; x++) {
    let mx = -Infinity;
    for (let j = 0; j < step; j++) mx = Math.max(mx, fftBuf[x*step+j]||(-140));
    const y = ((mx + 140) / 100) * 50;
    x === 0 ? chordSpecCtx.moveTo(x, 50-y) : chordSpecCtx.lineTo(x, 50-y);
  }
  chordSpecCtx.stroke();

  const maxE = Math.max(...pcEnergy);
  if (maxE < 1e-6) return;
  const normE = Array.from(pcEnergy).map(e => e / maxE);
  const activePCs = new Set();
  normE.forEach((e, i) => { if (e > 0.15) activePCs.add(i); });

  const bars = chordBarsEl.querySelectorAll(".chord-bar");
  normE.forEach((e, i) => {
    bars[i].style.height = Math.max(2, e * 34) + "px";
    bars[i].className = "chord-bar";
  });

  const match = matchChord(activePCs);
  const matchKey = match ? (match.root + "_" + match.name) : "";
  chordHistory.push(matchKey);
  if (chordHistory.length > chordHistorySize) chordHistory.shift();
  const stableMatch = chordHistory.length === chordHistorySize &&
    chordHistory.every(k => k === matchKey) && match;

  if (stableMatch) {
    const rootName = NOTE_NAMES[match.root];
    chordMain.textContent = rootName + match.name;
    activePCs.forEach(pc => bars[pc].classList.add(pc === match.root ? "root" : "active"));

    chordNotesEl.innerHTML = "";
    const sorted = [match.root, ...[...activePCs].filter(p => p !== match.root)
      .sort((a,b) => ((a-match.root+12)%12)-((b-match.root+12)%12))];
    sorted.forEach(pc => {
      if (!activePCs.has(pc)) return;
      const pill = document.createElement("span");
      pill.className = "chord-note-pill" + (pc === match.root ? " root" : "");
      pill.textContent = NOTE_NAMES[pc];
      chordNotesEl.appendChild(pill);
    });

    const slashName = (bassPC >= 0 && bassPC !== match.root) ? getSlashChord(match, bassPC) : null;
    chordSub.textContent = slashName ? "anche: " + slashName : (match.name === "" ? "accordo maggiore" : "");

    const aliasParts = [];
    const enh = ENHARMONIC[rootName];
    if (enh) aliasParts.push(enh + match.name);
    if (slashName) {
      const enhSlash = ENHARMONIC[NOTE_NAMES[match.root]];
      if (enhSlash) aliasParts.push(enhSlash + match.name + "/" + NOTE_NAMES[bassPC]);
    }
    chordAliases.textContent = aliasParts.length ? "≡ " + aliasParts.join("  ") : "";
  } else if (activePCs.size > 0 && !stableMatch) {
    if (!match) {
      chordMain.textContent = "···";
      chordSub.textContent = ""; chordNotesEl.innerHTML = ""; chordAliases.textContent = "";
    }
    [...activePCs].forEach(pc => bars[pc].classList.add("active"));
  } else if (activePCs.size === 0) {
    chordMain.textContent = "—";
    chordSub.textContent = ""; chordNotesEl.innerHTML = ""; chordAliases.textContent = "";
    chordHistory = [];
  }
}

document.getElementById("chord-sens").addEventListener('input', e => {
  chordSens = parseInt(e.target.value);
  document.getElementById("chord-sens-val").textContent = e.target.value;
});

chordStartBtn.addEventListener('click', async () => {
  if (chordRunning) {
    chordRunning = false;
    if (chordRaf) cancelAnimationFrame(chordRaf);
    if (chordMicStream) chordMicStream.getTracks().forEach(t => t.stop());
    if (chordAudioCtx) chordAudioCtx.close();
    chordAudioCtx = chordAnalyser = chordMicStream = null;
    chordDot.className = "dot"; chordBtnLabel.textContent = "Start microphone";
    chordStartBtn.className = "start-btn";
    chordMain.textContent = "—"; chordSub.textContent = "";
    chordNotesEl.innerHTML = ""; chordAliases.textContent = "";
    return;
  }
  try {
    chordMicStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    chordAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    chordAnalyser = chordAudioCtx.createAnalyser();
    chordAnalyser.fftSize = 8192;
    chordAnalyser.smoothingTimeConstant = 0.82;
    chordAudioCtx.createMediaStreamSource(chordMicStream).connect(chordAnalyser);
    chordRunning = true;
    chordDot.className = "dot on"; chordBtnLabel.textContent = "Stop microphone";
    chordStartBtn.className = "start-btn active";
    requestAnimationFrame(chordUpdate);
  } catch(e) { alert("Cannot access microphone:\n" + e.message); }
});
