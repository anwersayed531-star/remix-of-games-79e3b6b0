import { useCallback, useRef } from "react";

// Web Audio API sound generator - no external files needed
const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function ensureCtx() {
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function playTone(freq: number, duration: number, type: OscillatorType = "sine", vol = 0.15) {
  if (!audioCtx) return;
  ensureCtx();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration: number, vol = 0.08) {
  if (!audioCtx) return;
  ensureCtx();
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, audioCtx.currentTime);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start();
}

export type SoundType = "move" | "capture" | "check" | "win" | "draw" | "click" | "dice" | "pieceSlide" | "error" | "turnChange";

const SOUNDS: Record<SoundType, () => void> = {
  move: () => {
    playTone(300, 0.12, "triangle", 0.12);
    setTimeout(() => playTone(400, 0.08, "triangle", 0.08), 50);
  },
  capture: () => {
    playNoise(0.15, 0.12);
    setTimeout(() => playTone(200, 0.2, "sawtooth", 0.08), 50);
  },
  check: () => {
    playTone(600, 0.15, "square", 0.1);
    setTimeout(() => playTone(800, 0.15, "square", 0.1), 100);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, "triangle", 0.12), i * 120);
    });
  },
  draw: () => {
    playTone(400, 0.3, "sine", 0.1);
    setTimeout(() => playTone(350, 0.4, "sine", 0.08), 200);
  },
  click: () => playTone(500, 0.06, "triangle", 0.08),
  dice: () => {
    for (let i = 0; i < 6; i++) {
      setTimeout(() => playNoise(0.04, 0.15), i * 40);
    }
    setTimeout(() => playTone(450, 0.1, "triangle", 0.1), 260);
  },
  pieceSlide: () => {
    playTone(250, 0.1, "sine", 0.06);
    setTimeout(() => playTone(350, 0.08, "sine", 0.06), 80);
  },
  error: () => {
    playTone(200, 0.2, "square", 0.08);
    setTimeout(() => playTone(150, 0.3, "square", 0.06), 100);
  },
  turnChange: () => playTone(380, 0.08, "triangle", 0.06),
};

export function useGameSounds() {
  const enabled = useRef(true);

  const play = useCallback((sound: SoundType) => {
    if (!enabled.current) return;
    try { SOUNDS[sound](); } catch {}
  }, []);

  const toggle = useCallback(() => {
    enabled.current = !enabled.current;
    return enabled.current;
  }, []);

  return { play, toggle, enabled };
}
