import { create } from 'zustand';
import type { ArtistContent } from '../interfaces/maestra';

// Estado da coluna de resultados do Planejamento Estratégico. O Wizard publica aqui os dados
// (draft, nome, progresso) e o AppLayout renderiza a coluna como irmã da navbar e da página —
// assim ela é uma 3ª coluna real do layout, não um painel dentro da página.
interface WizardPanelState {
  active: boolean; // o Wizard está montado (mostra/esconde a coluna no layout)
  open: boolean; // o usuário deixou a coluna visível
  content: ArtistContent;
  artistName: string;
  progress: number;
  // Persistência publicada pelo Wizard: permite à coluna editar entregáveis (visão, missão…)
  // gravando pelo MESMO caminho do chat (fila de persist + updateArtistContent).
  persist: ((patch: Partial<ArtistContent>) => Promise<void>) | null;
  setData: (d: { content: ArtistContent; artistName: string; progress: number }) => void;
  setPersist: (fn: ((patch: Partial<ArtistContent>) => Promise<void>) | null) => void;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  activate: () => void;
  deactivate: () => void;
}

export const useWizardPanelStore = create<WizardPanelState>((set) => ({
  active: false,
  open: true,
  content: {},
  artistName: '',
  progress: 0,
  persist: null,
  setData: (d) => set(d),
  setPersist: (fn) => set({ persist: fn }),
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  activate: () => set({ active: true }),
  deactivate: () => set({ active: false, persist: null }),
}));
