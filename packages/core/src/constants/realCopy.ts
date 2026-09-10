// Dados e textos compartilhados do diagnóstico REAL (usados na tela, no PDF de apresentação e
// no app nativo).
//
// Subiu de `src/pages/ArtistCreate` para o núcleo quando o app ganhou a tela do diagnóstico. São
// TEXTOS — a frase que interpreta cada dimensão, os rótulos do autorrelato, a linha de status do
// boletim. Duas cópias dariam dois diagnósticos diferentes para os mesmos números, e ninguém
// perceberia, porque os dois continuariam soando bem.
import { PROFILES } from '../services/realEngine';

export type DimKey = 'r' | 'e' | 'a' | 'l';

// Formata números grandes em PT-BR (ex.: 2465588 → "2,5 mi").
export const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return String(n);
};

// Moeda BR sem centavos (R$ 1.800).
export const fmtBRL = (n: number): string =>
  Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';

/**
 * Acima de quanto um valor em reais passa a ser abreviado, no relatório REAL (§11).
 *
 * ⚠️ O CORTE É DEZ MIL, E NÃO MIL. Abreviando a partir de mil, "R$ 1.200" virava "R$ 1 mil": o
 * relatório apagava R$ 200 de alguém para poupar dois caracteres, e num diagnóstico financeiro
 * a precisão é a coisa. Acima de dez mil a casa decimal já basta para o número ser lido de
 * relance, e o que se perde não muda decisão nenhuma.
 */
const ABREVIA_DINHEIRO_ACIMA_DE = 10_000;

/**
 * O dinheiro como o relatório REAL o escreve (§11): "R$ 1.200", "R$ 25,2 mil", "R$ 2,8 mi".
 *
 * ⚠️ NÃO É O `fmtBRL`, e isto é de propósito. Aquele serve o resto do produto — preço de plano,
 * pagamento, painel do admin —, onde abreviar seria errado: ninguém quer ver a própria fatura
 * como "R$ 25,2 mil". Esta regra é do relatório, e só dele.
 *
 * O sinal vem junto quando o valor é negativo. As casas decimais só aparecem quando dizem
 * alguma coisa: "R$ 25 mil" e não "R$ 25,0 mil".
 */
export const dinheiroDoRelatorio = (n: number): string => {
  if (!Number.isFinite(n)) return '—';
  const sinal = n < 0 ? '−' : '';
  const v = Math.abs(Math.round(n));
  if (v <= ABREVIA_DINHEIRO_ACIMA_DE) return `${sinal}R$ ${v.toLocaleString('pt-BR')}`;
  const [valor, unidade] = v >= 1_000_000 ? [v / 1_000_000, 'mi'] : [v / 1000, 'mil'];
  const escrito = valor.toFixed(1).replace(/[.,]0$/, '').replace('.', ',');
  return `${sinal}R$ ${escrito} ${unidade}`;
};

// Porcentagem BR (4.2 → "4,2%").
export const fmtPct = (n: number): string => `${Number(n).toFixed(1).replace('.', ',')}%`;

// Remove travessões dos textos vindos do banco — leitura mais humana.
export const clean = (s: string) => s.replace(/\s*—\s*/g, ', ');

// Rótulos do autorrelato V3 (índice → texto para a exibição).
//
// A escala tem SETE níveis (0..6) e o índice precisa bater com as opções do quiz
// (ArtistCreate/index.tsx) e com CUTS.premiosNota do motor. A lista tinha seis itens: cada
// resposta era exibida um degrau ACIMA do que a artista respondeu — quem foi só indicada a um
// prêmio internacional (5) aparecia como se tivesse ganhado —, e quem de fato ganhou (6) caía
// fora da lista e virava "—".
// Vínculo declarado com o artista (ver a pergunta `vinculo` no QUIZ). O rótulo é o que sai na capa
// do PDF, então é redigido em terceira pessoa, para o documento e não para quem responde.
/**
 * Os DOIS cabeçalhos da entrega do diagnóstico.
 *
 * São momentos diferentes do mesmo documento. A ENTREGA é a primeira vez — o fim da criação e a
 * tela de desbloquear —, e fala com quem acabou de responder o quiz. A REVISITA é o módulo dentro
 * do perfil, onde a mesma pessoa volta meses depois: ali o "está pronto" soaria como se o
 * diagnóstico tivesse acabado de sair de novo.
 *
 * Moram aqui porque as duas superfícies precisam dizer as MESMAS palavras. Enquanto cada lado
 * tinha as suas, o app usava o cabeçalho de revisita nas TRÊS telas, inclusive na hora da
 * entrega, e a web usava o da entrega em duas: o mesmo momento, dois textos.
 */
export const CABECALHO_DA_ENTREGA = {
  titulo: (nome?: string | null) => `Seu diagnóstico de carreira está pronto, ${nome || 'seu artista'}.`,
  apoio: 'Baseado nos seus dados reais: Spotify, redes sociais e o que você nos contou.',
  /** Sem Spotify não há dado de plataforma: a copy não promete o que não foi medido. */
  apoioSemSpotify: 'Baseado no que você nos contou. Quando você conectar o Spotify, a gente '
    + 'atualiza com seus números de plataforma.',
} as const;

export const CABECALHO_DA_REVISITA = {
  chapeu: 'Onde você está',
  titulo: 'Diagnóstico REAL',
  apoio: 'Sua fase de carreira atual, com base nos seus dados reais.',
} as const;

export const VINCULO_LABELS: Record<string, string> = {
  sou_o_artista: 'o próprio artista',
  equipe: 'integrante da equipe do artista',
  representante: 'representante do artista',
  conhecendo: 'nenhum, declarou estar apenas conhecendo a ferramenta',
};

export const PREMIOS_LABELS_V3 = [
  'Nenhum',
  'Indicação local ou regional',
  'Prêmio local ou regional',
  'Indicação nacional',
  'Prêmio nacional',
  'Indicação internacional',
  'Prêmio internacional',
];
export const PAGANTE_LABELS: Record<string, string> = { ate50: 'Até 50%', '51-69': '51 a 69%', '70-94': '70 a 94%', '95-100': '95 a 100%' };
export const FREQ_LABELS: Record<string, string> = { esporadico: 'Esporádica', lancamento: 'Em lançamentos', perene: 'Perene' };

/**
 * A linha de status da barra nos diagnósticos de versão ANTERIOR.
 *
 * O caminho atual usa `statusDaBarra` (F3, F4 e F5 da spec do relatório). Este aqui sobrevive só
 * para os diagnósticos gravados antes da v4, que não têm os estados que aquela função lê.
 *
 * A nomenclatura foi corrigida junto (relatório v4.2, §1.7): "Top Tier" é o patamar de elite de
 * UMA DIMENSÃO, e "TOP ICON" é o PERFIL de quem é Top Tier nas quatro. Este texto chamava de TOP
 * ICON o topo de uma dimensão, que é o perfil inteiro sendo prometido a quem acendeu uma frente.
 * E "Acesa" no feminino, porque é a dimensão que acende.
 */
export const dimStatusText = (score: number, acende: boolean, topTier = false): string => {
  const s = Math.round(score);
  const toTop = Math.max(0, 100 - s);
  if (topTier) return 'Top Tier: o patamar mais alto desta frente.';
  if (acende) return `Acesa. Faltam ${toTop} pontos para o Top Tier.`;
  const toOn = Math.max(0, 70 - s);
  return `Faltam ${toOn} pontos para acender e ${toTop} para o Top Tier.`;
};

// Padrão R·E·A·L (alto/baixo) por nome de perfil — derivado da chave de 4 bits do motor.
// Usado no mapa dos 16 perfis (bolinhas cheias/vazias por dimensão).
export const PROFILE_BITS: Record<string, { r: boolean; e: boolean; a: boolean; l: boolean }> =
  Object.fromEntries(Object.entries(PROFILES).map(([key, def]) => [
    def.name, { r: key[0] === '1', e: key[1] === '1', a: key[2] === '1', l: key[3] === '1' },
  ]));

export const DIM_META: { key: DimKey; letter: string; name: string; full: string; sub: string }[] = [
  { key: 'r', letter: 'R', name: 'Reach · Alcance', full: 'Reach', sub: 'Alcance' },
  // ⚠️ "GANHOS", E NÃO "SUSTENTABILIDADE" (relatório v4.3, §2 e Apêndice B item 9). A palavra
  // antiga descrevia uma consequência; o que a dimensão mede é o que a música rendeu depois de
  // pagar o que custou. E "sustentabilidade" já significa outra coisa fora da música.
  { key: 'e', letter: 'E', name: 'Earnings · Ganhos', full: 'Earnings', sub: 'Ganhos' },
  { key: 'a', letter: 'A', name: 'Audience · Público real', full: 'Audience', sub: 'Público real' },
  { key: 'l', letter: 'L', name: 'Legitimacy · Legitimação', full: 'Legitimacy', sub: 'Legitimação' },
];

// Frases de interpretação por dimensão (alto/baixo) — doc de conteúdo §3.
export const DIM_PHRASE: Record<DimKey, { high: string; low: string }> = {
  r: {
    high: 'Sua música alcança gente além da sua bolha. O algoritmo e as playlists estão trabalhando por você.',
    low: 'Seu alcance digital ainda está abaixo do típico do mercado. Esse costuma ser o ponto de partida de quem quer crescer.',
  },
  e: {
    high: 'Sua carreira já gera receita acima do típico. A música está pagando as contas, e mais.',
    low: 'Sua carreira ainda não se sustenta financeiramente. Isso é mais comum do que parece, e tem solução estratégica.',
  },
  a: {
    high: 'Você tem público de verdade: gente que aparece, compra ingresso e segue a música. Isso é difícil de construir e vale muito.',
    low: 'Seu público comprometido ainda está em construção. A diferença entre quem te alcança e quem realmente te escolhe ainda é grande.',
  },
  l: {
    high: 'Prêmios e imprensa já validam o seu trabalho. O mercado e a crítica reconhecem o que você faz.',
    low: 'Seu trabalho ainda não foi validado por prêmios ou imprensa de expressão. Esse reconhecimento costuma vir com estratégia, não só com talento.',
  },
};

// Mapa dos 16 perfis por "andar" (nº de dimensões altas), do Icon (4) ao Beginner (0).
export const PROFILE_MAP: { tier: string; names: string[] }[] = [
  { tier: '4 acesas', names: ['Icon'] },
  { tier: '3 acesas', names: ['Hit', 'Spotlight', 'Underpaid', 'Analog'] },
  { tier: '2 acesas', names: ['Digital', 'Potential', 'Hype', 'Rising', 'Outlier', 'Bet'] },
  { tier: '1 acesa', names: ['Influencer', 'Moneymaker', 'Paradox', 'Cult'] },
  { tier: '0 acesas', names: ['Beginner'] },
];
