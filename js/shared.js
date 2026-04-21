export const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

export function noteToFreq(note) {
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return null;
  const n = NOTE_NAMES.indexOf(m[1]);
  if (n < 0) return null;
  return 440 * Math.pow(2, ((parseInt(m[2]) + 1) * 12 + n - 69) / 12);
}

export function freqToNote(freq) {
  if (freq <= 0) return { name: "—", cents: 0 };
  const midi = 12 * Math.log2(freq / 440) + 69;
  const midiR = Math.round(midi);
  return {
    name: NOTE_NAMES[((midiR % 12) + 12) % 12] + (Math.floor(midiR / 12) - 1),
    cents: Math.round((midi - midiR) * 100)
  };
}
