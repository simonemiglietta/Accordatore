# 🎸 Guitar Tuner — Pip-Boy PWA

A Pip-Boy styled guitar utility app built as a Progressive Web App. Works offline, installable on iOS and Android. No dependencies, no build step — plain HTML, CSS, and vanilla ES modules.

**Features:** Chromatic tuner · Looper with time-stretching · Metronome + BPM trainer · Chord detector · Pitch pipe

---

## Architecture

```
accordatore.html   — Shell: CSS + HTML structure only, no inline JS
manifest.json      — PWA manifest (name, icons, display mode)
sw.js              — Service worker: cache-first strategy, offline support
js/
  app.js           — Entry point: tab navigation, slider fills, SW registration, install banner
  shared.js        — Pure utilities: NOTE_NAMES, noteToFreq(), freqToNote()
  tuner.js         — Chromatic tuner module
  looper.js        — Looper module
  metronome.js     — Metronome + BPM trainer module
  chord.js         — Chord detection module
  pipe.js          — Pitch pipe module
```

The HTML file is a pure shell — it contains only CSS and markup. All logic lives in ES modules loaded via a single `<script type="module" src="js/app.js"></script>`. No bundler, no transpiler.

Modules communicate through **DOM events** rather than direct imports where possible (e.g. `pipe.js` listens for a `stringchange` CustomEvent dispatched by `tuner.js` when the user selects a different string), keeping cross-module coupling minimal.

---

## Modules

### `shared.js`
Stateless helpers shared across modules.
- `NOTE_NAMES` — chromatic scale array
- `noteToFreq(note)` — converts a note string like `"E2"` to its frequency in Hz using equal temperament (A4 = 440 Hz)
- `freqToNote(freq)` — converts a frequency to the nearest note name + cents deviation

### `tuner.js`
Chromatic tuner using the **autocorrelation** algorithm on microphone input.

1. Captures audio via `getUserMedia`
2. Feeds it into a Web Audio `AnalyserNode` (FFT size 2048)
3. On each animation frame, reads the time-domain buffer and runs autocorrelation to find the fundamental period → frequency
4. Compares detected frequency against the selected string's target frequency, displays cents deviation
5. Draws an analog-style **canvas gauge** (semicircular arc with animated needle) and a stability history bar
6. Dispatches `stringchange` CustomEvent when the user selects a different string

RMS threshold (adjustable via sensitivity slider) gates the detector against ambient noise.

### `looper.js`
Records audio via `MediaRecorder`, processes it, and loops it back.

**Recording pipeline:**
1. `getUserMedia` with echo/noise/AGC cancellation disabled (raw signal)
2. `MediaRecorder` captures chunks into a `Blob`
3. On stop: decoded with `AudioContext.decodeAudioData`, then `trimAndCrossfade()` removes leading/trailing silence and applies a short crossfade at the loop boundary to avoid clicks

**Time-stretching (WSOLA):**
The speed slider triggers a pitch-preserving time-stretch via a custom **WSOLA** (Waveform Similarity Overlap-Add) implementation:
- Analysis frames of ~80ms with a Hann window
- 20ms output hop, scaled input hop based on rate
- Cross-correlation search within a ±½ hop window to find the best-matching frame in the input signal
- Output normalized to avoid gain artifacts

Stretching runs in a `setTimeout` (off the main event loop) so playback isn't interrupted. If the loop is already playing when the stretch completes, `swapLoopBuffer()` does a seamless swap mid-cycle, preserving playback position.

A `DynamicsCompressor` node is inserted in the playback chain to tame transient peaks.

**iOS speaker unlock:** a silent WAV blob is played via an `<audio>` element to force audio output to the main speaker instead of the earpiece.

### `metronome.js`
Web Audio-based metronome using the **scheduler pattern** (not `setInterval`) for accurate timing.

A `setTimeout` loop running every 25ms schedules oscillator notes slightly ahead of time into the `AudioContext` timeline (`currentTime + 0.1s` lookahead). This avoids the jitter of `setInterval` for audio scheduling while using `setTimeout` for the visual flash of beat indicators.

Supports time signatures 2/4, 3/4, 4/4, 6/8. Accent on beat 1 (1000 Hz vs 700 Hz, higher gain).

**BPM Trainer:** increments BPM by a configurable step every N beats, automatically stopping when the target BPM is reached. Hooks into the metronome's beat callback (`trainerOnBeat()`).

Auto-mutes audio during looper recording to prevent bleed-through.

### `chord.js`
Real-time chord detection from microphone using FFT analysis.

**Pipeline:**
1. `AnalyserNode` at FFT size 8192 (high frequency resolution, ~5 Hz/bin at 44.1 kHz) with smoothing 0.82
2. **Adaptive noise floor** — median of the lower 40th percentile of bins, used to set a per-frame threshold
3. **Peak picking** — local maxima above threshold with minimum peak distance (~15 Hz separation), sub-bin accuracy via parabolic interpolation
4. **Harmonic suppression** — peaks that are harmonics (2×–6×) of a stronger peak are removed, isolating fundamentals
5. **Chroma accumulation** — surviving peaks are mapped to pitch classes (0–11), weighted by linear amplitude
6. **Chord matching** — the active pitch class set is matched against a template library (triads, sevenths, ninths, elevenths, thirteenths, power chords) scored by coverage × precision with bonuses for exact matches
7. **Stability buffer** — chord display only updates when the last 4 frames agree (prevents flickering)

Detects inversions (slash chords) from the lowest detected pitch below 330 Hz. Enharmonic aliases are shown alongside the primary name.

### `pipe.js`
Plays the reference pitch for the currently selected string using two stacked oscillators:
- Main: triangle wave at target frequency
- Sub: sine wave at half frequency (one octave down), gain 0.15, adds body

Amplitude envelope: 10ms attack → sustain at 0.4 → fade out between 1.2s and 2.0s. Repeats every 2.5 seconds while active.

Listens for the `stringchange` CustomEvent from `tuner.js` and seamlessly restarts with the new frequency.

### `app.js`
Entry point. Responsibilities:
- Binds tab navigation via `data-tab` attributes
- Initialises the tuner UI (tuning buttons, string grid, custom inputs)
- Drives the **slider fill** visual: reads each `input[type=range]`'s value/min/max and sets a `--fill` CSS custom property, which the track gradient reads to show the selected portion in green
- Registers the service worker
- Handles the PWA install banner (`beforeinstallprompt` / `appinstalled`)

### `sw.js`
Cache-first service worker. All app files are pre-cached on install under a versioned cache key (`guitar-tuner-vN`). On activate, old cache versions are deleted. Fetch handler returns cached response or falls back to network.

> **Note:** bump the cache version string on every deploy to force clients to pick up new files.

---

## PWA & Offline

The app is fully functional offline once installed. On iOS, install via **Share → Add to Home Screen** in Safari. The `beforeinstallprompt` install banner works on Chrome/Android only (iOS does not support it).

HTTPS is required for the service worker (and therefore offline support and PWA installability).

---

## Audio Contexts

Each module that uses audio creates its own `AudioContext`:
- `tuner.js` — microphone input only (no output)
- `looper.js` — microphone input + AudioBuffer playback
- `metronome.js` — oscillator output only
- `chord.js` — microphone input only (no output)
- `pipe.js` — oscillator output only

Keeping contexts separate avoids cross-module coupling and simplifies lifecycle management. Browser limits on simultaneous AudioContexts (typically 6+) are not a concern at this scale.
