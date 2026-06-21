import { useNytaModalStore } from '../stores/nytaModalStore';
import { useActiveModuleContext } from './useActiveModuleContext';
import type { ActiveModuleContext } from '../utils/moduleMapping';

export interface UseNytaModalReturn {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  openWithPrompt: (prompt: string) => void;
  close: () => void;
  moduleContext: ActiveModuleContext;
}

export function useNytaModal(): UseNytaModalReturn {
  const isOpen = useNytaModalStore((s) => s.isOpen);
  const toggle = useNytaModalStore((s) => s.toggle);
  const open = useNytaModalStore((s) => s.open);
  const openWithPrompt = useNytaModalStore((s) => s.openWithPrompt);
  const close = useNytaModalStore((s) => s.close);

  const moduleContext = useActiveModuleContext();

  return { isOpen, toggle, open, openWithPrompt, close, moduleContext };
}
