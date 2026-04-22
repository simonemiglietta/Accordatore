import { metroMuteForRec } from './metronome.js';
import { acquireWakeLock, releaseWakeLock } from './wakelock.js';

let loopAudioCtx = null, loopStream = null;
let mediaRecorder = null, recordedChunks = [];
let loopBuffer = null, loopStretchedBuffer = null;
let loopSource = null, loopGain = null, loopCompressor = null;
let loopState = "idle";
let loopStartTime = 0, loopDuration = 0;
let loopAnimRaf = null;
let loopSpeed = 1.0;

const looperStatus    = document.getElementById("looper-status");
const lbtnRec         = document.getElementById("lbtn-rec");
const lbtnPlay        = document.getElementById("lbtn-play");
const lbtnStop        = document.getElementById("lbtn-stop");
const lbtnClear       = document.getElementById("lbtn-clear");
const loopProgress    = document.getElementById("loop-progress");
const loopSpeedSlider = document.getElementById("loop-speed");
const loopSpeedVal    = document.getElementById("loop-speed-val");
const loopCanvas      = document.getElementById("looper-waveform");
const waveformCtx     = loopCanvas.getContext("2d");

let loopStretchDebounce = null;

function setLoopSpeed(v) {
  loopSpeed = parseInt(v) / 100;
  loopSpeedVal.textContent = v + "%";
  if (!loopBuffer) return;
  clearTimeout(loopStretchDebounce);
  loopStretchDebounce = setTimeout(() => applyStretchInBackground(loopSpeed), 300);
}

function applyStretchInBackground(rate) {
  if (!loopBuffer) return;
  looperStatus.textContent = "↻ Adjusting speed…";
  setTimeout(() => {
    const newBuf = wsola(loopBuffer, rate);
    loopStretchedBuffer = newBuf;
    if (loopState === "playing") swapLoopBuffer(newBuf);
    looperStatus.textContent = loopState === "playing"
      ? "▶ Loop — " + Math.round(rate * 100) + "%"
      : "Sample ready — " + loopBuffer.duration.toFixed(2) + "s";
    looperStatus.className = loopState === "playing" ? "looper-status playing" : "looper-status";
  }, 10);
}

function swapLoopBuffer(newBuf) {
  if (!loopAudioCtx || loopState !== "playing") return;
  const elapsed = (loopAudioCtx.currentTime - loopStartTime) % loopDuration;
  const newStartOffset = (elapsed / loopDuration) * newBuf.duration;
  if (loopSource) { try { loopSource.stop(); } catch(e) {} loopSource = null; }
  loopSource = loopAudioCtx.createBufferSource();
  loopSource.buffer = newBuf;
  loopSource.loop = true;
  loopSource.connect(loopGain);
  loopSource.start(0, newStartOffset);
  loopDuration = newBuf.duration;
  loopStartTime = loopAudioCtx.currentTime - newStartOffset;
}

async function ensureLoopCtx() {
  if (loopAudioCtx && loopStream) return true;
  try {
    loopStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    if (!loopAudioCtx) {
      loopAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // iOS: play silent audio to route to main speaker instead of earpiece
      try {
        const el = document.getElementById("ios-speaker-unlock");
        el.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        el.setAttribute("playsinline", "");
        await el.play().catch(() => {});
      } catch(e) {}
    }
    return true;
  } catch(e) { alert("Cannot access microphone:\n" + e.message); return false; }
}

function trimAndCrossfade(buffer) {
  const sr = buffer.sampleRate, ch = buffer.numberOfChannels;
  const data = [];
  for (let i = 0; i < ch; i++) data.push(buffer.getChannelData(i));
  const THRESH = 0.02, FRAME = 256, len = data[0].length;
  let startS = 0, endS = len;
  for (let i = 0; i < len - FRAME; i += FRAME) {
    let rms = 0; for (let j = 0; j < FRAME; j++) rms += data[0][i+j]**2;
    if (Math.sqrt(rms/FRAME) > THRESH) { startS = Math.max(0, i - FRAME); break; }
  }
  for (let i = len - FRAME; i > startS; i -= FRAME) {
    let rms = 0; for (let j = 0; j < FRAME; j++) rms += data[0][i+j]**2;
    if (Math.sqrt(rms/FRAME) > THRESH) { endS = Math.min(len, i + FRAME*2); break; }
  }
  const trimLen = endS - startS;
  if (trimLen < sr * 0.1) return buffer;
  const xfLen = Math.min(Math.floor(sr * 0.03), Math.floor(trimLen * 0.1));
  const out = loopAudioCtx.createBuffer(ch, trimLen, sr);
  for (let c = 0; c < ch; c++) {
    const src = data[c], dst = out.getChannelData(c);
    for (let i = 0; i < trimLen; i++) dst[i] = src[startS + i];
    for (let i = 0; i < xfLen; i++) {
      const t = i / xfLen;
      dst[i] = dst[i] * t + dst[trimLen - xfLen + i] * (1 - t);
    }
    for (let i = trimLen - xfLen; i < trimLen; i++) {
      dst[i] = dst[i] * (1 - (i - (trimLen - xfLen)) / xfLen);
    }
  }
  // Peak normalize to -1 dBFS
  let peak = 0;
  for (let c = 0; c < ch; c++) {
    const dst = out.getChannelData(c);
    for (let i = 0; i < trimLen; i++) if (Math.abs(dst[i]) > peak) peak = Math.abs(dst[i]);
  }
  if (peak > 0.001) {
    const g = Math.min(0.89 / peak, 8.0);
    for (let c = 0; c < ch; c++) {
      const dst = out.getChannelData(c);
      for (let i = 0; i < trimLen; i++) dst[i] *= g;
    }
  }
  return out;
}

function wsola(buffer, rate) {
  if (Math.abs(rate - 1.0) < 0.01) return buffer;
  const sr = buffer.sampleRate, ch = buffer.numberOfChannels;
  const inLen = buffer.length;
  const outLen = Math.round(inLen / rate);
  const frameSize = Math.round(sr * 0.08);
  const hopOut    = Math.round(sr * 0.02);
  const hopIn     = Math.round(hopOut * rate);
  const outBuf = loopAudioCtx.createBuffer(ch, outLen, sr);
  for (let c = 0; c < ch; c++) {
    const inp = buffer.getChannelData(c);
    const out = outBuf.getChannelData(c);
    const win = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) win[i] = 0.5 * (1 - Math.cos(2*Math.PI*i/(frameSize-1)));
    let inPos = 0, outPos = 0;
    while (outPos + frameSize < outLen && inPos + frameSize < inLen) {
      const searchRadius = Math.round(hopIn * 0.5);
      const searchStart = Math.max(0, inPos - searchRadius);
      const searchEnd   = Math.min(inLen - frameSize, inPos + searchRadius);
      let bestOffset = inPos, bestCorr = -Infinity;
      const refStart = Math.max(0, outPos - hopOut);
      const refLen   = Math.min(frameSize, outPos - refStart);
      if (refLen > 16) {
        for (let s = searchStart; s <= searchEnd; s += 4) {
          let corr = 0;
          for (let k = 0; k < refLen; k++) corr += out[refStart + k] * (inp[s + k] || 0);
          if (corr > bestCorr) { bestCorr = corr; bestOffset = s; }
        }
      }
      for (let k = 0; k < frameSize && outPos + k < outLen && bestOffset + k < inLen; k++) {
        out[outPos + k] += inp[bestOffset + k] * win[k];
      }
      inPos  = bestOffset + hopIn;
      outPos += hopOut;
    }
    let peak = 0;
    for (let i = 0; i < outLen; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
    if (peak > 0.01) { const scale = Math.min(1.0, 0.95 / peak); for (let i = 0; i < outLen; i++) out[i] *= scale; }
  }
  return outBuf;
}

async function looperRec() {
  if (loopState === "recording") return;
  if (loopState === "playing") looperStop();
  if (!await ensureLoopCtx()) return;

  metroMuteForRec(true);
  recordedChunks = []; loopBuffer = null; loopStretchedBuffer = null;
  drawWaveform(null); loopProgress.style.width = "0%";

  mediaRecorder = new MediaRecorder(loopStream);
  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    metroMuteForRec(false);
    looperStatus.textContent = "Processing…"; looperStatus.className = "looper-status processing";
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const raw = await loopAudioCtx.decodeAudioData(await blob.arrayBuffer());
    loopBuffer = trimAndCrossfade(raw);
    loopStretchedBuffer = loopSpeed < 0.99 ? wsola(loopBuffer, loopSpeed) : loopBuffer;
    loopDuration = loopStretchedBuffer.duration;
    drawWaveform(loopBuffer);
    looperStatus.textContent = `Sample ready — ${loopBuffer.duration.toFixed(2)}s`;
    looperStatus.className = "looper-status";
    lbtnPlay.disabled = false; lbtnClear.disabled = false;
    lbtnRec.classList.remove("rec-active");
    loopSpeedSlider.disabled = false;
  };

  mediaRecorder.start();
  loopState = "recording";
  looperStatus.textContent = "● Recording…"; looperStatus.className = "looper-status recording";
  lbtnRec.classList.add("rec-active"); lbtnStop.disabled = false; lbtnPlay.disabled = true;
}

async function looperPlay() {
  if (!loopStretchedBuffer || loopState === "recording") return;
  if (loopState === "playing") { looperStop(); return; }

  // iOS suspends the context when the app is backgrounded; resume under user gesture
  await loopAudioCtx.resume();

  loopGain = loopAudioCtx.createGain();
  loopGain.gain.value = 8.0; // aggressive boost — limiter below catches clipping

  // Brick-wall limiter to prevent clipping at the boosted gain
  loopCompressor = loopAudioCtx.createDynamicsCompressor();
  loopCompressor.threshold.value = -1;
  loopCompressor.knee.value = 0;
  loopCompressor.ratio.value = 20;
  loopCompressor.attack.value = 0.001;
  loopCompressor.release.value = 0.05;
  loopGain.connect(loopCompressor);
  loopCompressor.connect(loopAudioCtx.destination);

  loopSource = loopAudioCtx.createBufferSource();
  loopSource.buffer = loopStretchedBuffer;
  loopSource.loop = true;
  loopSource.connect(loopGain);
  loopSource.start();
  acquireWakeLock();
  loopStartTime = loopAudioCtx.currentTime;
  loopDuration = loopStretchedBuffer.duration;
  loopState = "playing";
  looperStatus.textContent = `▶ Loop — ${Math.round(loopSpeed*100)}%`;
  looperStatus.className = "looper-status playing";
  lbtnPlay.classList.add("play-active");
  lbtnPlay.querySelector(".licon").textContent = "▮▮";
  lbtnStop.disabled = false;
  animateProgress();
}

function looperStop() {
  const wasPlaying = loopState === "playing";
  if (loopSource) { try { loopSource.stop(); } catch(e) {} loopSource = null; }
  if (mediaRecorder && mediaRecorder.state === "recording") mediaRecorder.stop();
  if (wasPlaying) releaseWakeLock();
  if (loopAnimRaf) { cancelAnimationFrame(loopAnimRaf); loopAnimRaf = null; }
  loopState = "idle"; loopProgress.style.width = "0%";
  looperStatus.textContent = loopBuffer ? `Sample ready — ${loopBuffer.duration.toFixed(2)}s` : "Press REC to start";
  looperStatus.className = "looper-status";
  lbtnPlay.classList.remove("play-active");
  lbtnPlay.querySelector(".licon").textContent = "▶";
  lbtnRec.classList.remove("rec-active");
  lbtnStop.disabled = true;
  if (loopBuffer) { lbtnPlay.disabled = false; lbtnClear.disabled = false; }
}

function looperClear() {
  looperStop();
  loopBuffer = null; loopStretchedBuffer = null; loopDuration = 0;
  loopSpeedSlider.value = 100; loopSpeedVal.textContent = "100%"; loopSpeed = 1.0;
  loopSpeedSlider.disabled = true;
  drawWaveform(null);
  looperStatus.textContent = "Press REC to start"; looperStatus.className = "looper-status";
  lbtnPlay.disabled = true; lbtnClear.disabled = true; lbtnStop.disabled = true;
}

function animateProgress() {
  if (loopState !== "playing") return;
  const elapsed = (loopAudioCtx.currentTime - loopStartTime) % loopDuration;
  loopProgress.style.width = ((elapsed / loopDuration) * 100).toFixed(1) + "%";
  loopAnimRaf = requestAnimationFrame(animateProgress);
}

function drawWaveform(buffer) {
  const w = loopCanvas.offsetWidth || 300, h = 60;
  loopCanvas.width = w; loopCanvas.height = h;
  waveformCtx.fillStyle = "#050a03"; waveformCtx.fillRect(0, 0, w, h);
  if (!buffer) {
    waveformCtx.strokeStyle = "#1a7a0a"; waveformCtx.lineWidth = 1;
    waveformCtx.beginPath(); waveformCtx.moveTo(0, h/2); waveformCtx.lineTo(w, h/2); waveformCtx.stroke();
    return;
  }
  const data = buffer.getChannelData(0), step = Math.ceil(data.length / w);
  waveformCtx.strokeStyle = "#39ff14"; waveformCtx.lineWidth = 1.5; waveformCtx.beginPath();
  for (let i = 0; i < w; i++) {
    let mn = 1, mx = -1;
    for (let j = 0; j < step; j++) { const v = data[i*step+j]||0; if(v<mn)mn=v; if(v>mx)mx=v; }
    const y1 = ((1+mn)/2)*h, y2 = ((1+mx)/2)*h;
    if (i===0) waveformCtx.moveTo(i,y1); else waveformCtx.lineTo(i,y1);
    waveformCtx.lineTo(i,y2);
  }
  waveformCtx.stroke();
}

drawWaveform(null);

// ── Event listeners ───────────────────────────────
lbtnRec.addEventListener('click', looperRec);
lbtnPlay.addEventListener('click', looperPlay);
lbtnStop.addEventListener('click', looperStop);
lbtnClear.addEventListener('click', looperClear);
loopSpeedSlider.addEventListener('input', e => setLoopSpeed(e.target.value));
