import { state } from './tuner.js';
import { noteToFreq } from './shared.js';
import { acquireWakeLock, releaseWakeLock } from './wakelock.js';

let pipeAudioCtx = null, pipeOsc = null, pipeGain = null;
let pipeRunning = false, pipeIntervalId = null;

const pipeDot   = document.getElementById("pipe-dot");
const pipeLabel = document.getElementById("pipe-label");
const pipeBtn   = document.getElementById("pipe-btn");

function pipeStart() {
  const freq = noteToFreq(state.tunings[state.currentTuning][state.selectedString]);
  if (!freq) return;
  if (!pipeAudioCtx) pipeAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (pipeAudioCtx.state === "suspended") pipeAudioCtx.resume();

  pipeRunning = true;
  acquireWakeLock();
  pipeDot.className = "dot on";
  pipeLabel.textContent = "Stop reference note";
  pipeBtn.className = "start-btn active";

  playPipeNote(freq);
  pipeIntervalId = setInterval(() => {
    const f = noteToFreq(state.tunings[state.currentTuning][state.selectedString]);
    if (f) playPipeNote(f);
  }, 2500);
}

function playPipeNote(freq) {
  if (pipeOsc) { try { pipeOsc.stop(); } catch(e){} pipeOsc = null; }

  pipeGain = pipeAudioCtx.createGain();
  pipeGain.gain.setValueAtTime(0, pipeAudioCtx.currentTime);
  pipeGain.gain.linearRampToValueAtTime(0.4, pipeAudioCtx.currentTime + 0.01);
  pipeGain.gain.setValueAtTime(0.4, pipeAudioCtx.currentTime + 1.2);
  pipeGain.gain.linearRampToValueAtTime(0, pipeAudioCtx.currentTime + 2.0);
  pipeGain.connect(pipeAudioCtx.destination);

  pipeOsc = pipeAudioCtx.createOscillator();
  pipeOsc.type = "triangle";
  pipeOsc.frequency.value = freq;
  pipeOsc.connect(pipeGain);
  pipeOsc.start();
  pipeOsc.stop(pipeAudioCtx.currentTime + 2.0);

  const sub = pipeAudioCtx.createOscillator();
  const subGain = pipeAudioCtx.createGain();
  sub.type = "sine";
  sub.frequency.value = freq / 2;
  subGain.gain.value = 0.15;
  sub.connect(subGain); subGain.connect(pipeGain);
  sub.start(); sub.stop(pipeAudioCtx.currentTime + 2.0);
}

function pipeStop() {
  pipeRunning = false;
  releaseWakeLock();
  clearInterval(pipeIntervalId);
  if (pipeOsc) { try { pipeOsc.stop(); } catch(e){} pipeOsc = null; }
  pipeDot.className = "dot";
  pipeLabel.textContent = "Play reference note";
  pipeBtn.className = "start-btn";
}

pipeBtn.addEventListener('click', () => {
  if (pipeRunning) pipeStop(); else pipeStart();
});

// Restart pipe when the selected string or tuning changes
document.addEventListener('stringchange', () => {
  if (pipeRunning) { pipeStop(); pipeStart(); }
});
