import { buildTuningBtns, buildStringBtns } from './tuner.js';
import './looper.js';
import './metronome.js';
import './chord.js';
import './pipe.js';

// Slider fill: keeps the selected portion green on webkit
function updateSliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', pct + '%');
}
function initSliders() {
  document.querySelectorAll('input[type=range]').forEach(input => {
    updateSliderFill(input);
    input.addEventListener('input', () => updateSliderFill(input));
  });
}

// Tab navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    btn.classList.add('active');
  });
});

initSliders();

// Init tuner UI
buildTuningBtns();
buildStringBtns();

// Splash title fade (single call)
setTimeout(() => {
  const t = document.getElementById('splash-title');
  if (t) t.classList.add('hidden');
}, 1500);

// PWA service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// PWA install banner
let deferredInstallPrompt = null;
const installBanner  = document.getElementById('install-banner');
const installBtn     = document.getElementById('install-btn');
const installDismiss = document.getElementById('install-dismiss');

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBanner.style.display = 'flex';
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.style.display = 'none';
});

installDismiss.addEventListener('click', () => {
  installBanner.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
  installBanner.style.display = 'none';
  deferredInstallPrompt = null;
});
