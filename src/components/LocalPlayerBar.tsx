import { FC, useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipNext,
  VolumeIcon,
  VolumeMuteIcon,
  CloseIcon,
} from './Icons';
import { FiMaximize2 } from 'react-icons/fi';
import { useLocalPlayerStore } from '../stores/localPlayerStore';

// Player fixo no rodapé (estilo barra do Spotify) para faixas cadastradas no sistema
// (audio_file no bucket `catalog`). Controles: anterior/play/pause/próxima, progresso e volume.

export interface LocalTrack {
  id: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
  url: string;
  fullViewUrl?: string;
}

interface Props {
  tracks: LocalTrack[];
  currentId: string;
  onChangeTrack: (id: string) => void;
  onClose: () => void;
  onTrackClick?: () => void;
  onOpenFullView?: (track: LocalTrack) => void;
}

const fmt = (s: number): string => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const ctrlBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
};

export const LocalPlayerBar: FC<Props> = ({ tracks, currentId, onChangeTrack, onClose, onTrackClick, onOpenFullView }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // `playing` no store apenas REFLETE o <audio> (via eventos) — pra a LINHA do catálogo exibir e
  // controlar em sincronia. O controle do áudio é IMPERATIVO (togglePlay) — sem efeito que
  // "sincroniza" playing→áudio (isso criava loop play/pause).
  const playing = useLocalPlayerStore((s) => s.playing);
  const setPlaying = useLocalPlayerStore((s) => s.setPlaying);
  const setStoreTime = useLocalPlayerStore((s) => s.setTime);
  const setStoreDuration = useLocalPlayerStore((s) => s.setDuration);
  const setStoreCurrentId = useLocalPlayerStore((s) => s.setCurrentId);
  const setStoreToggle = useLocalPlayerStore((s) => s.setToggle);
  const setStoreSeek = useLocalPlayerStore((s) => s.setSeek);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const index = tracks.findIndex((t) => t.id === currentId);
  const track = tracks[index];
  const playable = !!track?.url;

  // Play/pause imperativo do <audio> (os eventos play/pause atualizam o store `playing`).
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track?.url) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, [track?.url]);

  const seekTo = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio || !track?.url) return;
    audio.currentTime = Math.max(0, Math.min(value, audio.duration || value));
    setTime(audio.currentTime);
    setStoreTime(audio.currentTime);
  }, [setStoreTime, track?.url]);

  // Publica no store: faixa atual (pra a lista sincronizar) e a função de toggle (pra a lista
  // controlar o mesmo <audio>). Limpa o toggle ao desmontar.
  useEffect(() => {
    setStoreCurrentId(currentId);
  }, [currentId, setStoreCurrentId]);
  useEffect(() => {
    setStoreToggle(togglePlay);
    return () => setStoreToggle(null);
  }, [togglePlay, setStoreToggle]);
  useEffect(() => {
    setStoreSeek(seekTo);
    return () => setStoreSeek(null);
  }, [seekTo, setStoreSeek]);

  // (Re)carrega e toca quando a faixa muda (o evento onPlay atualiza o store).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (!track.url) {
      audio.removeAttribute('src');
      audio.load();
      setPlaying(false);
      setTime(0);
      setDuration(0);
      setStoreTime(0);
      setStoreDuration(0);
      return;
    }
    audio.src = track.url;
    audio.volume = muted ? 0 : volume;
    audio.play().catch(() => {});
    setTime(0);
    setDuration(0);
    setStoreTime(0);
    setStoreDuration(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const goTo = (dir: -1 | 1) => {
    if (!tracks.length) return;
    const next = (index + dir + tracks.length) % tracks.length;
    onChangeTrack(tracks[next].id);
  };

  if (!track) return null;

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    seekTo(v);
  };

  // Layout (ref. Frame 75): card #333842 arredondado. Desktop = controles + progresso + volume
  // À ESQUERDA, capa + info no MEIO, fechar à direita. Estrutura PLANA (irmãos) pra o mobile
  // reordenar via `order` no CSS sem quebrar o desktop.
  return (
    <div className='local-player-bar'>
      {/* Progresso slim no rodapé — só mobile (no desktop o progresso é inline). Sem thumb; o
          preenchido (--pct) é feito via gradiente no CSS. */}
      <input
        className='lpb-progress-mobile'
        type='range'
        min={0}
        max={duration || 0}
        step={0.5}
        value={time}
        onChange={seek}
        aria-label='Progresso do áudio'
        style={{ ['--pct' as string]: duration ? `${(time / duration) * 100}%` : '0%' }}
      />
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setTime(e.currentTarget.currentTime);
          setStoreTime(e.currentTarget.currentTime);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setStoreDuration(e.currentTarget.duration);
        }}
        onEnded={() => (tracks.length > 1 ? goTo(1) : setPlaying(false))}
      />

      {/* Controles */}
      <div className='lpb-controls'>
        <button title='Anterior' style={ctrlBtn} onClick={() => goTo(-1)} disabled={tracks.length < 2}>
          <SkipBack />
        </button>
        <button
          className='lpb-play'
          title={playable ? (playing ? 'Pausar' : 'Tocar') : 'Áudio pendente'}
          onClick={togglePlay}
          disabled={!playable}
        >
          {playing ? <Pause color="#ffffff" /> : <Play color="#ffffff" />}
        </button>
        <button title='Próxima' style={ctrlBtn} onClick={() => goTo(1)} disabled={tracks.length < 2}>
          <SkipNext />
        </button>
      </div>

      {/* Progresso (desktop inline) */}
      <div className='lpb-progress'>
        <span className='lpb-time'>{fmt(time)}</span>
        <input className='lpb-seek' type='range' min={0} max={duration || 0} step={0.5} value={time} onChange={seek} />
        <span className='lpb-time'>{fmt(duration)}</span>
      </div>

      {/* Volume */}
      <div className='lpb-volume'>
        <button title={muted ? 'Ativar som' : 'Mudo'} style={ctrlBtn} onClick={() => setMuted(!muted)}>
          {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
        </button>
        <input
          className='lpb-volume-slider'
          type='range'
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            setMuted(false);
          }}
        />
      </div>

      {/* Faixa: capa + info (meio no desktop, começo no mobile) */}
      <button
        type='button'
        className='lpb-track'
        onClick={onTrackClick}
        aria-label={`Abrir música ${track.title} em Músicas`}
        title='Abrir em Músicas'
      >
        <img className='lpb-cover' src={track.cover || `${process.env.PUBLIC_URL}/images/playlist.png`} alt='' />
        <div className='lpb-meta'>
          <div className='lpb-title'>{track.title}</div>
          {track.subtitle && <div className='lpb-sub'>{track.subtitle}</div>}
        </div>
      </button>

      {onOpenFullView && track.fullViewUrl && (
        <button
          type='button'
          className='lpb-expand'
          title='Abrir visualização completa'
          aria-label={`Abrir visualização completa de ${track.title}`}
          style={ctrlBtn}
          onClick={() => onOpenFullView(track)}
        >
          <FiMaximize2 />
        </button>
      )}

      {/* Fechar */}
      <button className='lpb-close' title='Fechar player' style={ctrlBtn} onClick={onClose}>
        <CloseIcon />
      </button>
    </div>
  );
};

export default LocalPlayerBar;
