import { acquireWakeLock, releaseWakeLock } from './wakelock.js';

let metroBpm = 120, metroBeats = 4;
let metroRunning = false, metroMuted = false;
let metroNextTime = 0, metroCurBeat = 0, metroSchedulerId = null;
let metroAudioCtx = null;

const metroToggleBtn = document.getElementById("metro-toggle");
const metroBpmValEl  = document.getElementById("metro-bpm-val");
const metroBpmSlider = document.getElementById("metro-bpm");
const metroBeatsEl   = document.getElementById("metro-beats");
const metroMutedNote = document.getElementById("metro-muted-note");

function buildMetroBeats() {
  metroBeatsEl.innerHTML = "";
  for (let i = 0; i < metroBeats; i++) {
    const d = document.createElement("div");
    d.className = "metro-beat" + (i === 0 ? " accent" : "");
    metroBeatsEl.appendChild(d);
  }
}
buildMetroBeats();

function metroBpmChange(v) {
  metroBpm = parseInt(v);
  metroBpmValEl.textContent = metroBpm;
}

export function metroAdjBpm(delta) {
  metroBpm = Math.max(40, Math.min(240, metroBpm + delta));
  metroBpmSlider.value = metroBpm;
  metroBpmValEl.textContent = metroBpm;
}

function metroSig(beats, btn) {
  document.querySelectorAll(".metro-sig-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  metroBeats = beats;
  metroCurBeat = 0;
  buildMetroBeats();
}

function ensureMetroCtx() {
  if (!metroAudioCtx) metroAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (metroAudioCtx.state === "suspended") metroAudioCtx.resume();
}

function metroSchedule() {
  if (!metroRunning) return;
  ensureMetroCtx();
  const interval = 60 / metroBpm;
  while (metroNextTime < metroAudioCtx.currentTime + 0.1) {
    scheduleTick(metroNextTime, metroCurBeat);
    metroNextTime += interval;
    metroCurBeat = (metroCurBeat + 1) % metroBeats;
  }
  metroSchedulerId = setTimeout(metroSchedule, 25);
}

function scheduleTick(time, beat) {
  const isAccent = beat === 0;
  if (!metroMuted) {
    const osc = metroAudioCtx.createOscillator(), env = metroAudioCtx.createGain();
    osc.connect(env); env.connect(metroAudioCtx.destination);
    osc.frequency.value = isAccent ? 1000 : 700;
    env.gain.setValueAtTime(isAccent ? 0.6 : 0.35, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.start(time); osc.stop(time + 0.05);
  }
  const delay = Math.max(0, (time - metroAudioCtx.currentTime) * 1000);
  setTimeout(() => { flashBeat(beat); trainerOnBeat(); }, delay);
}

function flashBeat(beat) {
  const dots = metroBeatsEl.querySelectorAll(".metro-beat");
  dots.forEach((d, i) => d.classList.toggle("lit", i === beat));
  clearTimeout(flashBeat._off);
  flashBeat._off = setTimeout(() => dots.forEach(d => d.classList.remove("lit")), 80);
}

export function metroMuteForRec(mute) {
  metroMuted = mute;
  metroMutedNote.textContent = mute ? "🔇 Audio muted during recording" : "";
}

export function metroToggle() {
  if (metroRunning) {
    metroRunning = false;
    clearTimeout(metroSchedulerId);
    metroBeatsEl.querySelectorAll(".metro-beat").forEach(d => d.classList.remove("lit"));
    metroToggleBtn.textContent = "▶";
    metroToggleBtn.className = "metro-toggle";
    releaseWakeLock();
  } else {
    ensureMetroCtx();
    metroRunning = true;
    acquireWakeLock();
    metroCurBeat = 0;
    metroNextTime = metroAudioCtx.currentTime + 0.05;
    metroToggleBtn.textContent = "⏹";
    metroToggleBtn.className = "metro-toggle on";
    metroSchedule();
  }
}

// ── BPM Trainer ───────────────────────────────────
let trainerRunning = false;
let trainerStep = 2;
let trainerPeriod = 4;
let trainerTarget = 160;
let trainerBeatCount = 0;

const trainerToggleBtn  = document.getElementById("trainer-toggle");
const trainerStepValEl  = document.getElementById("trainer-step-val");
const trainerStatusEl   = document.getElementById("trainer-status");
const trainerPeriodSlider = document.getElementById("trainer-period");
const trainerTargetSlider = document.getElementById("trainer-target");

function trainerPeriodChange(v) {
  trainerPeriod = parseInt(v);
  document.getElementById("trainer-period-val").textContent = v + " bt";
}

function trainerPeriodAdj(delta) {
  trainerPeriod = Math.max(1, Math.min(32, trainerPeriod + delta));
  trainerPeriodSlider.value = trainerPeriod;
  document.getElementById("trainer-period-val").textContent = trainerPeriod + " bt";
}

function trainerTargetChange(v) {
  trainerTarget = parseInt(v);
  document.getElementById("trainer-target-val").textContent = v;
}

function trainerStepAdj(delta) {
  trainerStep = Math.max(1, Math.min(20, trainerStep + delta));
  trainerStepValEl.textContent = (trainerStep > 0 ? "+" : "") + trainerStep;
}

function trainerToggle() {
  if (trainerRunning) {
    trainerRunning = false;
    trainerToggleBtn.textContent = "▶";
    trainerToggleBtn.className = "trainer-toggle";
    trainerStatusEl.textContent = "";
    trainerBeatCount = 0;
  } else {
    if (!metroRunning) metroToggle();
    trainerRunning = true;
    trainerBeatCount = 0;
    trainerToggleBtn.textContent = "⏹";
    trainerToggleBtn.className = "trainer-toggle on";
    trainerUpdateStatus();
  }
}

function trainerUpdateStatus() {
  if (!trainerRunning) return;
  const remaining = trainerPeriod - (trainerBeatCount % trainerPeriod);
  trainerStatusEl.textContent = metroBpm + " BPM → target " + trainerTarget + " | next step in " + remaining + " bt";
}

function trainerOnBeat() {
  if (!trainerRunning) return;
  trainerBeatCount++;
  if (trainerBeatCount % trainerPeriod === 0) {
    const newBpm = metroBpm + trainerStep;
    if ((trainerStep > 0 && newBpm >= trainerTarget) || (trainerStep < 0 && newBpm <= trainerTarget)) {
      metroBpm = trainerTarget;
      metroBpmSlider.value = trainerTarget;
      metroBpmValEl.textContent = trainerTarget;
      trainerRunning = false;
      trainerToggleBtn.textContent = "Start";
      trainerToggleBtn.className = "trainer-toggle";
      trainerStatusEl.textContent = "✓ Target " + trainerTarget + " BPM reached!";
      return;
    }
    metroBpm = Math.max(40, Math.min(240, newBpm));
    metroBpmSlider.value = metroBpm;
    metroBpmValEl.textContent = metroBpm;
  }
  trainerUpdateStatus();
}

export function getMetroInfo() {
  if (!metroRunning || !metroAudioCtx) return null;
  const beatDurMs = 60000 / metroBpm;
  const barDurMs = beatDurMs * metroBeats;
  const msToNextBeat = Math.max(0, (metroNextTime - metroAudioCtx.currentTime) * 1000);
  const beatsUntilBar = metroCurBeat === 0 ? 0 : (metroBeats - metroCurBeat);
  let msToNextBar = msToNextBeat + beatsUntilBar * beatDurMs;
  if (msToNextBar < 150) msToNextBar += barDurMs;
  return { bpm: metroBpm, beats: metroBeats, beatDurMs, barDurMs, msToNextBeat, msToNextBar };
}

// ── Event listeners ───────────────────────────────
metroToggleBtn.addEventListener('click', metroToggle);

metroBpmSlider.addEventListener('input', e => metroBpmChange(e.target.value));

document.querySelectorAll('.metro-step-btn').forEach(btn => {
  btn.addEventListener('click', () => metroAdjBpm(parseInt(btn.dataset.delta)));
});

document.querySelectorAll('.metro-sig-btn').forEach(btn => {
  btn.addEventListener('click', () => metroSig(parseInt(btn.dataset.beats), btn));
});

trainerToggleBtn.addEventListener('click', trainerToggle);

trainerPeriodSlider.addEventListener('input', e => trainerPeriodChange(e.target.value));
trainerTargetSlider.addEventListener('input', e => trainerTargetChange(e.target.value));

document.querySelectorAll('.trainer-step-btn').forEach(btn => {
  btn.addEventListener('click', () => trainerStepAdj(parseInt(btn.dataset.delta)));
});

document.querySelectorAll('.trainer-period-btn').forEach(btn => {
  btn.addEventListener('click', () => trainerPeriodAdj(parseInt(btn.dataset.delta)));
});
