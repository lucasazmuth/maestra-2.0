import { create } from 'zustand';

// Sinaliza se o player de faixas do catálogo está aberto. Usado pelo Layout para ESCONDER o
// banner "Assine o Maestra Pro" enquanto o player está no ar (o player ocupa o lugar do banner
// no rodapé). O player vive no Catálogo; o banner, no Layout — por isso o estado global.
interface LocalPlayerState {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const useLocalPlayerStore = create<LocalPlayerState>((set) => ({
  open: false,
  setOpen: (v) => set({ open: v }),
}));
