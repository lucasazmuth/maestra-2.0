import { create } from 'zustand';

/**
 * Uma faixa na fila do player local.
 *
 * Mora aqui, e nao no `LocalPlayerBar`, porque e dado: o componente que desenha a barra e um
 * detalhe da web, e o store precisa do tipo sem depender de interface nenhuma.
 */
export interface LocalTrack {
  id: string;
  title: string;
  subtitle?: string;
  cover?: string | null;
  url: string;
  fullViewUrl?: string;
}

// Estado compartilhado do player de faixas do catálogo. Usado por:
//  - Layout: esconde o banner "Assine o Maestra Pro" enquanto o player está aberto (`open`);
//  - linha do Catálogo: mostra play/pause em sincronia (`currentId` + `playing`) e controla a faixa
//    atual via `toggle` (a função é registrada pelo player, que controla o <audio> imperativamente).
// `playing` apenas REFLETE o estado real do <audio> (via eventos play/pause) — nunca controla o
// áudio direto (evita loop de feedback play/pause).
interface LocalPlayerState {
  open: boolean;
  tracks: LocalTrack[];
  currentId: string | null;
  playing: boolean;
  time: number;
  duration: number;
  toggle: (() => void) | null; // registrada pelo LocalPlayerBar; a linha do catálogo chama
  seek: ((time: number) => void) | null;
  setOpen: (v: boolean) => void;
  setTracks: (tracks: LocalTrack[]) => void;
  setCurrentId: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  setTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setToggle: (fn: (() => void) | null) => void;
  setSeek: (fn: ((time: number) => void) | null) => void;
}

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  open: false,
  tracks: [],
  currentId: null,
  playing: false,
  time: 0,
  duration: 0,
  toggle: null,
  seek: null,
  setOpen: (v) => set({ open: v }),
  setTracks: (tracks) => set({ tracks }),
  setCurrentId: (id) => set({ currentId: id, time: 0, duration: 0 }),
  setPlaying: (v) => set({ playing: v }),
  setTime: (time) => set({ time }),
  setDuration: (duration) => set({ duration }),
  setToggle: (fn) => set({ toggle: fn }),
  setSeek: (fn) => set({ seek: fn }),
}));
