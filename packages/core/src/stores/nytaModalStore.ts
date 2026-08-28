import { create } from 'zustand';
import type { ActiveModuleContext } from '../utils/moduleMapping';

interface NytaModalState {
  isOpen: boolean;
  isAnimating: boolean;
  moduleContext: ActiveModuleContext;
  // Pergunta a ser enviada automaticamente assim que o modal abrir (ex.: chips do Dashboard).
  pendingPrompt: string | null;

  toggle: () => void;
  open: () => void;
  openWithPrompt: (prompt: string) => void;
  clearPendingPrompt: () => void;
  close: () => void;
  setModuleContext: (ctx: ActiveModuleContext) => void;
}

export const useNytaModalStore = create<NytaModalState>((set, get) => ({
  isOpen: false,
  isAnimating: false,
  moduleContext: {
    module: 'unknown',
    artistId: null,
    artistName: null,
    rawPath: '',
  },
  pendingPrompt: null,

  toggle: () => {
    const { isOpen, open, close } = get();
    if (isOpen) close();
    else open();
  },

  open: () => set({ isOpen: true, isAnimating: false }),

  // Abre o modal e enfileira uma pergunta para ser enviada assim que ele montar.
  openWithPrompt: (prompt) => set({ isOpen: true, isAnimating: false, pendingPrompt: prompt }),

  clearPendingPrompt: () => set({ pendingPrompt: null }),

  close: () => {
    set({ isAnimating: true });
    setTimeout(() => {
      set({ isOpen: false, isAnimating: false });
    }, 250);
  },

  setModuleContext: (ctx) => set({ moduleContext: ctx }),
}));
