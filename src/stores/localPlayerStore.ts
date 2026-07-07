import { create } from 'zustand';

// Estado compartilhado do player de faixas do catálogo. Usado por:
//  - Layout: esconde o banner "Assine o Maestra Pro" enquanto o player está aberto (`open`);
//  - linha do Catálogo: mostra play/pause em sincronia (`currentId` + `playing`) e controla a faixa
//    atual via `toggle` (a função é registrada pelo player, que controla o <audio> imperativamente).
// `playing` apenas REFLETE o estado real do <audio> (via eventos play/pause) — nunca controla o
// áudio direto (evita loop de feedback play/pause).
interface LocalPlayerState {
  open: boolean;
  currentId: string | null;
  playing: boolean;
  toggle: (() => void) | null; // registrada pelo LocalPlayerBar; a linha do catálogo chama
  setOpen: (v: boolean) => void;
  setCurrentId: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  setToggle: (fn: (() => void) | null) => void;
}

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  open: false,
  currentId: null,
  playing: false,
  toggle: null,
  setOpen: (v) => set({ open: v }),
  setCurrentId: (id) => set({ currentId: id }),
  setPlaying: (v) => set({ playing: v }),
  setToggle: (fn) => set({ toggle: fn }),
}));
