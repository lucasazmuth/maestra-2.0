import { FC, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipNext,
  VolumeIcon,
  VolumeMuteIcon,
  CloseIcon,
} from './Icons';

// Player fixo no rodapé (estilo barra do Spotify) para faixas cadastradas no sistema
// (audio_file no bucket `catalog`). Controles: anterior/play/pause/próxima, progresso e volume.

export interface LocalTrack {
  id: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
  url: string;
}

interface Props {
  tracks: LocalTrack[];
  currentId: string;
  onChangeTrack: (id: string) => void;
  onClose: () => void;
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

export const LocalPlayerBar: FC<Props> = ({ tracks, currentId, onChangeTrack, onClose }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const index = tracks.findIndex((t) => t.id === currentId);
  const track = tracks[index];

  // (Re)carrega e toca quando a faixa muda.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    audio.src = track.url;
    audio.volume = muted ? 0 : volume;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    setTime(0);
    setDuration(0);
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

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  if (!track) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        background: '#000',
        borderTop: '1px solid #1f1f1f',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => (tracks.length > 1 ? goTo(1) : setPlaying(false))}
      />

      {/* Esquerda: faixa atual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '25%', minWidth: 160 }}>
        <img
          src={track.cover || `${process.env.PUBLIC_URL}/images/playlist.png`}
          alt=''
          style={{ width: 52, height: 52, borderRadius: 4, objectFit: 'cover' }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {track.title}
          </div>
          {track.subtitle && (
            <div style={{ color: '#b3b3b3', fontSize: 12 }}>{track.subtitle}</div>
          )}
        </div>
      </div>

      {/* Centro: controles + progresso */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button title='Anterior' style={ctrlBtn} onClick={() => goTo(-1)} disabled={tracks.length < 2}>
            <SkipBack />
          </button>
          <button
            title={playing ? 'Pausar' : 'Tocar'}
            onClick={togglePlay}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: 'none',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {playing ? <Pause /> : <Play />}
          </button>
          <button title='Próxima' style={ctrlBtn} onClick={() => goTo(1)} disabled={tracks.length < 2}>
            <SkipNext />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 560 }}>
          <span style={{ color: '#b3b3b3', fontSize: 11, minWidth: 34, textAlign: 'right' }}>
            {fmt(time)}
          </span>
          <input
            type='range'
            min={0}
            max={duration || 0}
            step={0.5}
            value={time}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = v;
              setTime(v);
            }}
            style={{ flex: 1, accentColor: '#af2896', height: 4, cursor: 'pointer' }}
          />
          <span style={{ color: '#b3b3b3', fontSize: 11, minWidth: 34 }}>{fmt(duration)}</span>
        </div>
      </div>

      {/* Direita: volume + fechar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '25%',
          minWidth: 160,
          justifyContent: 'flex-end',
        }}
      >
        <button title={muted ? 'Ativar som' : 'Mudo'} style={ctrlBtn} onClick={() => setMuted(!muted)}>
          {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type='range'
          min={0}
          max={1}
          step={0.02}
          value={muted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number(e.target.value));
            setMuted(false);
          }}
          style={{ width: 100, accentColor: '#af2896', height: 4, cursor: 'pointer' }}
        />
        <button title='Fechar player' style={{ ...ctrlBtn, marginLeft: 6 }} onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
};

export default LocalPlayerBar;
