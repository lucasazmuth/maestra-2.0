// Vídeos de apoio da Nyta.
//
// São por PERGUNTA, não por etapa: cada um reforça um momento específico da conversa em que a
// pergunta é difícil de responder no vazio. Por isso a chave é o `stage` do beat (o sub-passo),
// e não o índice da etapa — dentro de uma etapa só há vários beats, e a maioria não precisa de
// vídeo nenhum.
//
// Ancorado no STAGE e não no número da etapa também por segurança: os stages são a identidade
// estável de cada pergunta em `chat/script.ts`, enquanto a numeração das etapas é posicional e
// muda se alguma for inserida ou removida.
//
// Pode ser a URL COMPLETA, em qualquer formato do YouTube, ou só o id: o `extractYouTubeId` do
// componente resolve os dois. Stage sem entrada aqui simplesmente não mostra vídeo.

/** Vídeo do convite (tela "Oi, [artista]" com o CTA de começar) — antes de qualquer pergunta. */
export const VIDEO_CONVITE = 'https://www.youtube.com/watch?v=-Zg9NF1SSgw';

/**
 * stage do beat → vídeo de reforço.
 *
 * Os stages vêm de `nextBeat` em `chat/script.ts`. Um stage escrito errado aqui não quebra nada:
 * simplesmente nunca casa e o vídeo não aparece — então, ao mexer, confira contra o `script.ts`.
 */
export const BEAT_VIDEOS: Record<string, string> = {
  // Etapa 1 · Identidade
  // "Agora, uma referência que pode ser mais desafiadora: a de POSICIONAMENTO…"
  'ref.posicionamento': 'https://www.youtube.com/watch?v=_aSEHa5ih0k',

  // Etapa 2 · Visão
  // "E aqui eu não tô falando de público-alvo. Tô falando de onde você espera que venha a validação…"
  'vision.porQuem': 'https://www.youtube.com/watch?v=ImQVUQo1y3I',
  // "Diante de tantas características que você carrega como artista, em quais vamos jogar luz?"
  'vision.oQueFalam': 'https://www.youtube.com/watch?v=WOKQUImEbqo',

  // Etapa 3 · Missão
  // "Vamos pensar a sua carreira como qualquer outro negócio por um instante…"
  'mission.entrega': 'https://www.youtube.com/watch?v=kskXFwsQnUE',

  // Etapa 5 · Objetivos
  // "Chegou a hora dos objetivos — os alvos concretos que vão medir se a estratégia tá funcionando."
  objectives: 'https://www.youtube.com/watch?v=iMCLLqhBT1o',

  // Etapa 6 · Diagnóstico (o pedido dizia "etapa 6"; internamente as oportunidades são o
  // Diagnóstico, e é a pergunta que manda — não o número)
  // "Oportunidade não é exclusividade sua. Ela existe pra qualquer artista…"
  'swot.opportunities': 'https://www.youtube.com/watch?v=dyC3z3ttGqo',

  // Etapa 8 · Prioridades (idem: o pedido dizia "etapa 7"; "por onde começar" é a priorização)
  // "Aqui eu vou te pedir atenção total. É a hora de definir por onde começar."
  priority: 'https://www.youtube.com/watch?v=n6r6k5pb0z8',
};

/**
 * A abertura da conversa ("Então te peço uma licença: deixa eu olhar pra sua carreira como um
 * negócio junto com você?") não é um beat — vem do `buildOpening`. Por isso fica fora do mapa.
 */
export const VIDEO_ABERTURA = 'https://www.youtube.com/watch?v=hNBn1zBguE8';
