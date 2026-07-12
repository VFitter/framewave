/**
 * Audio → motion. Pure functions over PCM so audio-reactive visuals stay
 * frame-pure: precompute per-frame features once, then every frame reads its
 * own slot. (This is Elijah-grade waveform-visualizer territory, built in.)
 */
export interface AudioFeatureOptions {
  sampleRate: number;
  fps: number;
  /** Smoothing 0..1 (attack/release-style exponential). Default 0.6. */
  smoothing?: number;
}

/** Per-frame RMS amplitude envelope, normalized to 0..1. */
export function amplitudeEnvelope(pcm: Float32Array, opts: AudioFeatureOptions): Float32Array {
  const { sampleRate, fps, smoothing = 0.6 } = opts;
  const samplesPerFrame = sampleRate / fps;
  const frames = Math.max(1, Math.ceil(pcm.length / samplesPerFrame));
  const out = new Float32Array(frames);

  let peak = 1e-9;
  for (let f = 0; f < frames; f++) {
    const start = Math.floor(f * samplesPerFrame);
    const end = Math.min(pcm.length, Math.floor((f + 1) * samplesPerFrame));
    let sum = 0;
    for (let i = start; i < end; i++) sum += pcm[i]! * pcm[i]!;
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    out[f] = rms;
    peak = Math.max(peak, rms);
  }
  // normalize + smooth
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    const v = out[f]! / peak;
    prev = prev * smoothing + v * (1 - smoothing);
    out[f] = prev;
  }
  return out;
}

/**
 * Per-frame energy of a frequency band via the Goertzel algorithm —
 * cheap targeted DFT bins (kick ≈ 50–100 Hz, snare ≈ 150–250 Hz, air ≥ 8 kHz).
 */
export function bandEnvelope(
  pcm: Float32Array,
  lowHz: number,
  highHz: number,
  opts: AudioFeatureOptions,
): Float32Array {
  const { sampleRate, fps, smoothing = 0.6 } = opts;
  const samplesPerFrame = Math.floor(sampleRate / fps);
  const frames = Math.max(1, Math.ceil(pcm.length / samplesPerFrame));
  const out = new Float32Array(frames);

  const bins = 5;
  const freqs: number[] = [];
  for (let i = 0; i < bins; i++) freqs.push(lowHz + ((highHz - lowHz) * i) / (bins - 1));

  let peak = 1e-9;
  for (let f = 0; f < frames; f++) {
    const start = f * samplesPerFrame;
    const end = Math.min(pcm.length, start + samplesPerFrame);
    const n = end - start;
    if (n <= 0) break;
    let energy = 0;
    for (const freq of freqs) {
      const w = (2 * Math.PI * freq) / sampleRate;
      const coeff = 2 * Math.cos(w);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = start; i < end; i++) {
        s0 = pcm[i]! + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      energy += Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2)) / n;
    }
    out[f] = energy / bins;
    peak = Math.max(peak, out[f]!);
  }
  let prev = 0;
  for (let f = 0; f < frames; f++) {
    const v = out[f]! / peak;
    prev = prev * smoothing + v * (1 - smoothing);
    out[f] = prev;
  }
  return out;
}

/** Simple onset (beat-ish) detection: spectral-flux style over the envelope. */
export function detectOnsets(envelope: Float32Array, threshold = 0.15): number[] {
  const onsets: number[] = [];
  for (let i = 2; i < envelope.length; i++) {
    const flux = envelope[i]! - envelope[i - 1]!;
    const prevFlux = envelope[i - 1]! - envelope[i - 2]!;
    if (flux > threshold && prevFlux <= threshold) onsets.push(i);
  }
  return onsets;
}
