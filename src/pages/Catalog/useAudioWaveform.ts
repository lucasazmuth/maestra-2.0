import { useEffect, useState } from 'react';

export type WaveformState = 'idle' | 'loading' | 'ready' | 'fallback';

const fallbackBars = [28, 46, 35, 68, 42, 56, 31, 73, 48, 60, 38, 64, 27, 52, 71, 44, 58, 33, 67, 41, 54, 30, 75, 47, 62, 36, 69, 43, 57, 32, 74, 45, 61, 37, 66, 40, 55, 29, 72, 49, 59, 34, 65, 46, 53, 31, 70, 42];
const cache = new Map<string, number[]>();
const inflight = new Map<string, Promise<number[]>>();

const decodeWaveform = async (url: string, bars: number): Promise<number[]> => {
  const existing = cache.get(url);
  if (existing) return existing;

  let pending = inflight.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Não foi possível ler o áudio');
      const arrayBuffer = await response.arrayBuffer();
      const Context = window.AudioContext || (window as any).webkitAudioContext;
      if (!Context) throw new Error('AudioContext indisponível');
      const context = new Context();
      try {
        const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
        const channel = decoded.getChannelData(0);
        const bucketSize = Math.max(1, Math.floor(channel.length / bars));
        const samples = Array.from({ length: bars }, (_, bucket) => {
          const start = bucket * bucketSize;
          const end = Math.min(channel.length, start + bucketSize);
          let sum = 0;
          for (let index = start; index < end; index += 1) sum += Math.abs(channel[index]);
          return end > start ? sum / (end - start) : 0;
        });
        const max = Math.max(...samples, 0.001);
        const normalized = samples.map((sample) => Math.round(18 + Math.min(1, sample / max) * 78));
        cache.set(url, normalized);
        return normalized;
      } finally {
        void context.close();
      }
    })();
    inflight.set(url, pending);
  }

  try {
    return await pending;
  } finally {
    inflight.delete(url);
  }
};

export const useAudioWaveform = (url?: string | null, bars = 48): { bars: number[]; state: WaveformState } => {
  const [result, setResult] = useState<{ bars: number[]; state: WaveformState }>(() =>
    url && cache.has(url) ? { bars: cache.get(url) || fallbackBars, state: 'ready' } : { bars: fallbackBars, state: url ? 'loading' : 'idle' }
  );

  useEffect(() => {
    let active = true;
    if (!url) {
      setResult({ bars: fallbackBars, state: 'idle' });
      return () => { active = false; };
    }
    const cached = cache.get(url);
    if (cached) {
      setResult({ bars: cached, state: 'ready' });
      return () => { active = false; };
    }
    setResult({ bars: fallbackBars, state: 'loading' });
    decodeWaveform(url, bars)
      .then((next) => active && setResult({ bars: next, state: 'ready' }))
      .catch(() => active && setResult({ bars: fallbackBars, state: 'fallback' }));
    return () => { active = false; };
  }, [url, bars]);

  return result;
};
