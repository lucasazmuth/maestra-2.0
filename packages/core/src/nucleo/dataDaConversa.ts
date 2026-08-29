// A data curta da lista de conversas.
//
// Como as pessoas leem uma lista de conversas: hoje vira hora, esta semana vira o dia da
// semana, o resto vira dia/mês. Uma data completa em toda linha ocupa espaço e não ajuda a
// distinguir uma conversa da outra — que é a única coisa que a lista precisa fazer.
//
// Vivia dentro do componente da web. Subiu pro núcleo quando o app nativo ganhou a mesma lista:
// duas implementações desta regra dariam listas que se leem diferente lado a lado.

export const dataDaConversa = (iso: string, agora = new Date()): string => {
  const d = new Date(iso);

  if (d.toDateString() === agora.toDateString()) {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
  }

  const dias = (agora.getTime() - d.getTime()) / 86400000;
  if (dias < 7) {
    // O ponto do "seg." sai: numa coluna estreita ele é ruído, e a abreviação já se lê sozinha.
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '');
  }

  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
};
