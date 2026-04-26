import { NOTE_NAMES, noteToFreq, freqToNote } from './shared.js';

export const TUNINGS = {
  "Standard": ["E2","A2","D3","G3","B3","E4"],
  "Drop D":   ["D2","A2","D3","G3","B3","E4"],
  "Open G":   ["D2","G2","D3","G3","B3","D4"],
  "DADGAD":   ["D2","A2","D3","G3","A3","D4"],
  "Open E":   ["E2","B2","E3","G#3","B3","E4"],
  "Custom":   ["E2","A2","D3","G3","B3","E4"],
};
const STRING_LABELS = ["6th","5th","4th","3rd","2nd","1st"];
const HISTORY_SIZE = 20;

const _savedCustom = localStorage.getItem("custom-tuning");
export const state = {
  tunings: JSON.parse(JSON.stringify(TUNINGS)),
  currentTuning: "Standard",
  selectedString: 0,
};
if (_savedCustom) state.tunings["Custom"] = JSON.parse(_savedCustom);

let tunerAudioCtx = null, analyser = null, tunerRaf = null, micStream = null, tunerOn = false;
let centsHistory = [], lastHistoryTime = 0;

// DOM refs
const tuningsRow        = document.getElementById("tunings-row");
const stringsGrid       = document.getElementById("strings-grid");
const customEditPanel   = document.getElementById("custom-edit-panel");
const editCustomBtn     = document.getElementById("edit-custom-btn");
const detectedNote      = document.getElementById("detected-note");
const detectedFreq      = document.getElementById("detected-freq");
const centsLabel        = document.getElementById("cents-label");
const startBtn          = document.getElementById("start-btn");
const dotEl             = document.getElementById("dot");
const btnLabel          = document.getElementById("btn-label");
const historyBar        = document.getElementById("history-bar");
const sensitivitySlider = document.getElementById("sensitivity");

let customEditing = false;

function enterEditMode() {
  customEditing = true;
  buildCustomInputs();
  stringsGrid.style.display = "none";
  customEditPanel.style.display = "block";
  editCustomBtn.style.display = "none";
}

function exitEditMode() {
  customEditing = false;
  stringsGrid.style.display = "";
  customEditPanel.style.display = "none";
  editCustomBtn.style.display = state.currentTuning === "Custom" ? "block" : "none";
}

for (let i = 0; i < HISTORY_SIZE; i++) {
  const b = document.createElement("div");
  b.className = "hbar";
  b.style.cssText = "background:var(--border);height:3px";
  historyBar.appendChild(b);
}

function getRmsThreshold() {
  return 0.055 - (parseInt(sensitivitySlider.value) - 1) * 0.005;
}

function updateHistory(diff, inTune) {
  centsHistory.push({ diff, inTune });
  if (centsHistory.length > HISTORY_SIZE) centsHistory.shift();
  const bars = historyBar.querySelectorAll(".hbar");
  const offset = HISTORY_SIZE - centsHistory.length;
  bars.forEach((bar, i) => {
    const idx = i - offset;
    if (idx < 0) { bar.style.height = "3px"; bar.style.background = "var(--border)"; return; }
    const e = centsHistory[idx];
    bar.style.height = (3 + (Math.min(Math.abs(e.diff), 50) / 50) * 17).toFixed(1) + "px";
    bar.style.background = e.inTune ? "#1D9E75" : (e.diff > 0 ? "#E57368" : "#378ADD");
  });
}

function resetHistory() {
  centsHistory = [];
  historyBar.querySelectorAll(".hbar").forEach(b => {
    b.style.height = "3px";
    b.style.background = "var(--border)";
  });
}

export function buildTuningBtns() {
  tuningsRow.innerHTML = "";
  Object.keys(state.tunings).forEach(name => {
    const b = document.createElement("button");
    b.className = "tuning-btn" + (name === state.currentTuning ? " active" : "");
    b.textContent = name;
    b.addEventListener('click', () => {
      if (customEditing) exitEditMode();
      state.currentTuning = name;
      state.selectedString = 0;
      buildTuningBtns();
      buildStringBtns();
      buildCustomInputs();
      resetHistory();
    });
    tuningsRow.appendChild(b);
  });
  editCustomBtn.style.display = state.currentTuning === "Custom" ? "block" : "none";
}

export function buildStringBtns() {
  stringsGrid.innerHTML = "";
  state.tunings[state.currentTuning].forEach((note, i) => {
    const freq = noteToFreq(note);
    const b = document.createElement("button");
    b.className = "string-btn" + (i === state.selectedString ? " selected" : "");
    b.innerHTML = `<div class="note">${note}</div><div class="freq">${STRING_LABELS[i]} — ${freq ? freq.toFixed(1) : "?"}Hz</div>`;
    b.addEventListener('click', () => {
      state.selectedString = i;
      buildStringBtns();
      resetHistory();
      document.dispatchEvent(new CustomEvent('stringchange'));
    });
    stringsGrid.appendChild(b);
  });
}

export function buildCustomInputs() {
  const div = document.getElementById("custom-inputs");
  div.innerHTML = "";
  state.tunings[state.currentTuning].forEach((note, i) => {
    const inp = document.createElement("input");
    inp.value = note;
    inp.placeholder = "es. E2";
    inp.dataset.idx = i;
    div.appendChild(inp);
  });
}

// ── Canvas gauge ──────────────────────────────────
// cy = h - 10 with h=100 intentionally places pivot 20px below the 80px canvas edge,
// creating a proper analog-meter semicircle arc in the visible area.
const gaugeCanvas = document.getElementById("gauge-canvas");
const gaugeCtx    = gaugeCanvas.getContext("2d");
let gaugeNeedleAngle = Math.PI * 1.5;
let gaugeTargetAngle = Math.PI * 1.5;
let gaugeInTune = false;
let gaugeAnimRaf = null;

function resizeGauge() {
  const w = gaugeCanvas.offsetWidth;
  gaugeCanvas.width  = w * window.devicePixelRatio;
  gaugeCanvas.height = 80 * window.devicePixelRatio;
  gaugeCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  drawGauge();
}

function drawGauge() {
  const w = gaugeCanvas.offsetWidth, h = 100;
  gaugeCtx.fillStyle = '#0a0f06';
  gaugeCtx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h - 10, r = Math.min(w * 0.42, 78);

  gaugeCtx.lineCap = "round";

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.8, false);
  gaugeCtx.strokeStyle = "#0d2a08";
  gaugeCtx.lineWidth = 8;
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.5, false);
  gaugeCtx.strokeStyle = "rgba(255,176,0,0.4)";
  gaugeCtx.lineWidth = 8;
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 1.8, false);
  gaugeCtx.strokeStyle = "rgba(255,59,59,0.4)";
  gaugeCtx.lineWidth = 8;
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, r, Math.PI * 1.46, Math.PI * 1.54, false);
  gaugeCtx.strokeStyle = gaugeInTune ? "rgba(57,255,20,1)" : "rgba(57,255,20,0.4)";
  gaugeCtx.lineWidth = 8;
  gaugeCtx.stroke();

  for (let i = -5; i <= 5; i++) {
    const angle = Math.PI * 1.5 + (i / 5) * Math.PI * 0.3;
    const isMajor = i % 5 === 0;
    const r1 = r + 4, r2 = r + (isMajor ? 10 : 6);
    gaugeCtx.beginPath();
    gaugeCtx.moveTo(cx + r1 * Math.cos(angle), cy + r1 * Math.sin(angle));
    gaugeCtx.lineTo(cx + r2 * Math.cos(angle), cy + r2 * Math.sin(angle));
    gaugeCtx.strokeStyle = isMajor ? "#1a7a0a" : "#0d3a06";
    gaugeCtx.lineWidth = isMajor ? 1.5 : 1;
    gaugeCtx.stroke();
  }

  const needleLen = r - 6;
  const nx = cx + needleLen * Math.cos(gaugeNeedleAngle);
  const ny = cy + needleLen * Math.sin(gaugeNeedleAngle);

  gaugeCtx.beginPath();
  gaugeCtx.moveTo(cx, cy);
  gaugeCtx.lineTo(nx, ny);
  gaugeCtx.strokeStyle = "rgba(57,255,20,0.08)";
  gaugeCtx.lineWidth = 5;
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.moveTo(cx, cy);
  gaugeCtx.lineTo(nx, ny);
  gaugeCtx.strokeStyle = "#39ff14";
  gaugeCtx.lineWidth = 2.5;
  gaugeCtx.stroke();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, 5, 0, Math.PI * 2);
  gaugeCtx.fillStyle = "#39ff14";
  gaugeCtx.fill();

  gaugeCtx.beginPath();
  gaugeCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  gaugeCtx.fillStyle = "#0a0f06";
  gaugeCtx.fill();
}

function animateGauge() {
  const diff = gaugeTargetAngle - gaugeNeedleAngle;
  if (Math.abs(diff) > 0.001) {
    gaugeNeedleAngle += diff * 0.18;
    drawGauge();
    gaugeAnimRaf = requestAnimationFrame(animateGauge);
  } else {
    gaugeNeedleAngle = gaugeTargetAngle;
    drawGauge();
    gaugeAnimRaf = null;
  }
}

function setNeedle(cents) {
  const clamped = Math.max(-50, Math.min(50, cents));
  gaugeTargetAngle = Math.PI * 1.5 + (clamped / 50) * Math.PI * 0.3;
  if (!gaugeAnimRaf) gaugeAnimRaf = requestAnimationFrame(animateGauge);
}

resizeGauge();
window.addEventListener("resize", resizeGauge);

// ── Pitch detection ────────────────────────────────
function autoCorrelate(buf, sr) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < getRmsThreshold()) return -1;
  let r1 = 0, r2 = SIZE - 1;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < 0.2) { r2 = SIZE - i; break; }
  buf = buf.slice(r1, r2);
  const n = buf.length, c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) c[i] += buf[j] * buf[j + i];
  let d = 0; while (c[d] > c[d + 1]) d++;
  let mx = -1, mp = -1;
  for (let i = d; i < n; i++) if (c[i] > mx) { mx = c[i]; mp = i; }
  const x1 = c[mp-1], x2 = c[mp], x3 = c[mp+1];
  const a = (x1 + x3 - 2*x2)/2, b2 = (x3-x1)/2;
  let T0 = mp; if (a) T0 -= b2/(2*a);
  return sr / T0;
}

function tunerUpdate(ts) {
  if (!analyser) return;
  tunerRaf = requestAnimationFrame(tunerUpdate);
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  const freq = autoCorrelate(buf, tunerAudioCtx.sampleRate);
  if (freq > 60 && freq < 1400) {
    const { name, cents } = freqToNote(freq);
    detectedNote.textContent = name;
    detectedFreq.textContent = freq.toFixed(1) + " Hz";
    setNeedle(cents);
    const tf = noteToFreq(state.tunings[state.currentTuning][state.selectedString]);
    let inTune = false, diff = cents;
    if (tf) {
      diff = Math.round(1200 * Math.log2(freq / tf));
      if (Math.abs(diff) <= 5) {
        centsLabel.textContent = "✓ In tune!";
        centsLabel.className = "cents-label in-tune";
        inTune = true; gaugeInTune = true;
        detectedNote.classList.add("in-tune");
      } else if (diff > 5) {
        centsLabel.textContent = `+${diff} cents — lower`;
        centsLabel.className = "cents-label sharp";
        gaugeInTune = false; detectedNote.classList.remove("in-tune");
      } else {
        centsLabel.textContent = `${diff} cents — raise`;
        centsLabel.className = "cents-label flat";
        gaugeInTune = false; detectedNote.classList.remove("in-tune");
      }
    }
    if (!lastHistoryTime || ts - lastHistoryTime > 100) { lastHistoryTime = ts; updateHistory(diff, inTune); }
  }
}

startBtn.addEventListener('click', async () => {
  if (tunerOn) {
    tunerOn = false;
    if (tunerRaf) cancelAnimationFrame(tunerRaf);
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (tunerAudioCtx) tunerAudioCtx.close();
    analyser = tunerAudioCtx = micStream = null;
    gaugeInTune = false;
    dotEl.className = "dot";
    btnLabel.textContent = "Start microphone";
    startBtn.className = "start-btn";
    centsLabel.textContent = "select a string and start";
    centsLabel.className = "cents-label";
    detectedNote.textContent = "—";
    detectedFreq.textContent = "0.0 Hz";
    setNeedle(0);
    resetHistory();
    return;
  }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    tunerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = tunerAudioCtx.createAnalyser();
    analyser.fftSize = 2048;
    tunerAudioCtx.createMediaStreamSource(micStream).connect(analyser);
    tunerOn = true;
    dotEl.className = "dot on";
    btnLabel.textContent = "Stop microphone";
    startBtn.className = "start-btn active";
    requestAnimationFrame(tunerUpdate);
  } catch(e) { alert("Cannot access microphone:\n" + e.message); }
});

sensitivitySlider.addEventListener('input', e => {
  document.getElementById('sens-val').textContent = e.target.value;
});

document.getElementById("apply-btn").addEventListener('click', () => {
  const inputs = document.getElementById("custom-inputs").querySelectorAll("input");
  const newNotes = Array.from(inputs).map(i => i.value.trim());
  if (newNotes.some(n => noteToFreq(n) === null)) {
    alert("Invalid note! Use format like E2, G#3…");
    return;
  }
  state.tunings["Custom"] = newNotes;
  localStorage.setItem("custom-tuning", JSON.stringify(newNotes));
  state.currentTuning = "Custom";
  state.selectedString = 0;
  buildTuningBtns();
  buildStringBtns();
  resetHistory();
  exitEditMode();
});

document.getElementById("cancel-btn").addEventListener('click', exitEditMode);
editCustomBtn.addEventListener('click', enterEditMode);
