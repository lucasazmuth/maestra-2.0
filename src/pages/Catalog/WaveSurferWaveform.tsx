import { FC, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

type WaveSurferWaveformProps = {
  audioUrl: string;
  currentTime: number;
  onSeek: (time: number) => void;
  className?: string;
};

/**
 * Waveform real da versão. O WaveSurfer só desenha e controla a posição: a
 * reprodução continua centralizada no LocalPlayerBar, evitando dois áudios
 * concorrentes para a mesma versão.
 */
const WaveSurferWaveform: FC<WaveSurferWaveformProps> = ({ audioUrl, currentTime, onSeek, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<WaveSurfer | null>(null);
  const onSeekRef = useRef(onSeek);
  const currentTimeRef = useRef(currentTime);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    onSeekRef.current = onSeek;
  }, [onSeek]);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !audioUrl) return undefined;

    setState('loading');
    const wavesurfer = WaveSurfer.create({
      container,
      url: audioUrl,
      height: 60,
      waveColor: '#405985',
      progressColor: '#2f60f6',
      cursorWidth: 0,
      barWidth: 3,
      barGap: 4,
      barRadius: 3,
      barMinHeight: 3,
      normalize: true,
      interact: true,
      dragToSeek: true,
      hideScrollbar: true,
    });

    instanceRef.current = wavesurfer;
    wavesurfer.on('ready', () => {
      wavesurfer.setTime(Math.max(0, currentTimeRef.current));
      setState('ready');
    });
    wavesurfer.on('error', () => setState('error'));
    wavesurfer.on('interaction', (time) => onSeekRef.current(time));

    return () => {
      instanceRef.current = null;
      wavesurfer.destroy();
    };
  }, [audioUrl]);

  useEffect(() => {
    if (instanceRef.current && Number.isFinite(currentTime)) {
      instanceRef.current.setTime(Math.max(0, currentTime));
    }
  }, [currentTime]);

  return (
    <div className={className} data-waveform-renderer='wavesurfer' data-waveform-state={state}>
      <div ref={containerRef} className='wavesurfer-host' aria-label='Waveform da versão' />
      {state === 'loading' && <span className='wavesurfer-loading'>Analisando áudio…</span>}
      {state === 'error' && <span className='wavesurfer-error'>Não foi possível ler a waveform</span>}
    </div>
  );
};

export default WaveSurferWaveform;
