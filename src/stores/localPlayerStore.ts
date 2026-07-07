import { create } from 'zustand';

// Estado compartilhado do player de faixas do catálogo. Usado por:
//  - Layout: esconde o banner "Assine o Maestra Pro" enquanto o player está aberto (`open`);
//  - linha do Catálogo: mostra play/pause em sincronia com o player (`currentId` + `playing`) e
//    controla o play/pause da faixa atual (togglePlaying).
// O player vive no Catálogo; o banner, no Layout — por isso o estado global.
interface LocalPlayerState {
  open: boolean; // player montado (uma faixa selecionada)
  currentId: string | null; // id da faixa no player
  playing: boolean; // tocando (fonte da verdade; o <audio> sincroniza com isto)
  setOpen: (v: boolean) => void;
  setCurrentId: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
}

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  open: false,
  currentId: null,
  playing: false,
  setOpen: (v) => set({ open: v }),
  setCurrentId: (id) => set({ currentId: id }),
  setPlaying: (v) => set({ playing: v }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
}));
