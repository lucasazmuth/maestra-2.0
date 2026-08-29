import { FC, useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

import { ONDA_DA_VERSAO } from '@maestra/core/constants/design';

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
    // As opções moram no núcleo: o app nativo roda o MESMO wavesurfer dentro de um WebView, e
    // duas cópias desta lista dariam duas ondas diferentes para o mesmo arquivo.
    const wavesurfer = WaveSurfer.create({ container, url: audioUrl, ...ONDA_DA_VERSAO });

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
