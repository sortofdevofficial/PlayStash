export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

export function playSound(type) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === "chop") {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.09);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (type === "mine") {
    osc.type = "square";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === "place") {
    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}

// Procedural Ambient Wind, Bird Chirps, and Campfire Crackle
let windGain, windFilter;
export let gustIntensity = 0;

export function initAmbientAudio() {
  window.addEventListener("pointerdown", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
  }, { once: true });

  // Wind Loop
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  windFilter = audioCtx.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 280;

  windGain = audioCtx.createGain();
  windGain.gain.value = 0; // wind disabled by user request

  const lfo = audioCtx.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain);
  lfoGain.connect(windFilter.frequency);
  lfo.start();

  whiteNoise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(audioCtx.destination);
  whiteNoise.start();

  // Wind Gust Events – disabled
  /* setInterval(() => {
    if (Math.random() > 0.35) {
      gustIntensity = 1.0;
      const now = audioCtx.currentTime;
      windGain.gain.setValueAtTime(0.08, now);
      windGain.gain.exponentialRampToValueAtTime(0.03, now + 2.5);
      windFilter.frequency.setValueAtTime(650, now);
      windFilter.frequency.exponentialRampToValueAtTime(280, now + 2.5);
    }
  }, 3500); */


  // Procedural Bird Chirps
  setInterval(() => {
    if (Math.random() > 0.4 && audioCtx.state === "running") {
      const birdOsc = audioCtx.createOscillator();
      const birdGain = audioCtx.createGain();
      birdOsc.type = "sine";
      birdOsc.connect(birdGain);
      birdGain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const baseFreq = 2200 + Math.random() * 600;
      birdOsc.frequency.setValueAtTime(baseFreq, now);
      birdOsc.frequency.exponentialRampToValueAtTime(baseFreq + 400, now + 0.08);
      birdGain.gain.setValueAtTime(0.04, now);
      birdGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      birdOsc.start(now);
      birdOsc.stop(now + 0.12);
    }
  }, 4500);
}

export function updateGusts() {
  if (gustIntensity > 0) gustIntensity -= 0.008;
}