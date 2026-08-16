import { create } from 'zustand';

// Termo do campo de busca do topo.
//
// O campo vive no AppLayout e a lista que ele filtra vive na página — dois componentes irmãos,
// sem estado em comum. O campo existia desconectado desde o redesenho: sem `value`, sem
// `onChange`, sem nada por trás. Datilografar ali não fazia absolutamente nada.
//
// Zustand em vez de query param na URL: o termo é um filtro de tela, não um endereço. Colocá-lo
// no endereço encheria o histórico de navegação a cada tecla e faria "voltar" desfazer letras.
interface GlobalSearchState {
  termo: string;
  setTermo: (t: string) => void;
  limpar: () => void;
}

export const useGlobalSearch = create<GlobalSearchState>((set) => ({
  termo: '',
  setTermo: (termo) => set({ termo }),
  limpar: () => set({ termo: '' }),
}));

/** Normaliza para comparar: sem acento, sem caixa, sem espaço nas pontas. */
export const normalizar = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
