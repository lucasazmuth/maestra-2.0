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
  setData: (d: { content: ArtistContent; artistName: string; progress: number }) => void;
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
  setData: (d) => set(d),
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  activate: () => set({ active: true }),
  deactivate: () => set({ active: false }),
}));
