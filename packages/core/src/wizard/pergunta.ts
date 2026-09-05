// A pergunta de cada passo do wizard mora em UM lugar só: o negrito da fala da Nyta.
//
// O balão destaca a pergunta e o campo de digitar repete ela como placeholder. Manter os dois
// textos separados seria garantir que um dia eles divergissem — bastaria alguém reescrever a fala
// e esquecer do campo, e o usuário leria uma pergunta no balão e outra logo abaixo. Aqui o campo
// deriva do balão, então reescrever a fala já corrige o campo.

// Um trecho entre `**`. `[\s\S]` no lugar do ponto porque a flag `s` exige um target mais novo
// que o do projeto, e falas longas quebram linha no meio do destaque.
const NEGRITO = /\*\*([\s\S]+?)\*\*/g;

/**
 * A pergunta em destaque de uma fala. Quando ha mais de um negrito, vale o ULTIMO: as falas da
 * Nyta explicam antes e perguntam depois, entao o que esta mais perto do campo e o que ele deve
 * repetir.
 */
export const perguntaEmDestaque = (texto?: string): string | null => {
  if (!texto) return null;
  let ultima: string | null = null;
  NEGRITO.lastIndex = 0;
  for (let m = NEGRITO.exec(texto); m; m = NEGRITO.exec(texto)) {
    const trecho = m[1].trim();
    if (trecho) ultima = trecho;
  }
  return ultima;
};

// Limite do placeholder. O campo tem uma linha só: acima disso o texto some na borda em vez de
// ajudar. A pergunta inteira continua visível no balão logo acima, que é o lugar dela.
const LIMITE = 72;

// A pergunta quase sempre comeca no meio da fala ("Vamos para os bastidores: quais artistas...").
// Recortada, ela vira a primeira palavra do campo e precisa de maiuscula — sem isso o placeholder
// parece um pedaco de frase perdido em vez de uma pergunta.
const comMaiuscula = (frase: string): string => frase.charAt(0).toUpperCase() + frase.slice(1);

/** Placeholder do campo: a pergunta do passo, ou o texto genérico quando o passo não tem uma. */
export const placeholderDaPergunta = (pergunta: string | null): string => {
  if (!pergunta) return 'Escreva sua resposta…';
  if (pergunta.length <= LIMITE) return comMaiuscula(pergunta);
  // Corta na palavra, nunca no meio dela: "quer ser reconhecid…" seria pior que a frase curta.
  const corte = pergunta.slice(0, LIMITE);
  const ultimoEspaco = corte.lastIndexOf(' ');
  const encurtada = (ultimoEspaco > 40 ? corte.slice(0, ultimoEspaco) : corte).replace(/[,;:\s]+$/, '');
  return `${comMaiuscula(encurtada)}…`;
};

/**
 * Fecha um `**` que a maquina de escrever ainda nao terminou de digitar. Sem isto, o negrito
 * aparece como dois asteriscos crus no meio da fala e so vira negrito quando a frase acaba —
 * o texto "pula" na tela. Fechando, ele ja nasce em negrito e vai crescendo.
 */
export const fecharNegritoAberto = (parcial: string): string => {
  // Um `*` sozinho no fim e metade de um `**` que ainda nao chegou; renderizado, viraria itálico.
  const limpo = parcial.replace(/\*{1,2}$/, '');
  const aberturas = limpo.split('**').length - 1;
  return aberturas % 2 === 1 ? `${limpo}**` : limpo;
};
