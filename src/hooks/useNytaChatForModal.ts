import { useNytaChat, type UseNytaChatReturn } from './useNytaChat';

// O modal flutuante usa o mesmo chat da página — a diferença é só a origem do artista
// (nytaModalStore em vez da URL) e o module_context na requisição. Ver useNytaChat.
//
// Este arquivo era uma cópia de ~670 linhas do useNytaChat, e a duplicação cobrava caro: as
// correções entravam num dos dois e o outro seguia com o bug. Fica aqui só como nome, pros
// pontos de uso do modal continuarem legíveis.

export type UseNytaChatForModalReturn = UseNytaChatReturn;

export function useNytaChatForModal(): UseNytaChatForModalReturn {
  return useNytaChat('modal');
}
