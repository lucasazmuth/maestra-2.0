// ─────────────────────────────────────────────────────────────────────────────
// A SELEÇÃO dos comentários do relatório — os gatilhos, sem nenhum texto.
//
// Fonte: "Diagnóstico REAL · Especificação do Relatório · v4" (§4 a §11). Os textos moram em
// `constants/realTextos.ts`, e a separação é deliberada: quem escreve não precisa ler condicional
// para trocar uma vírgula, e quem programa não precisa reler 136 parágrafos para mudar um corte.
//
// As três regras que governam tudo (§4):
//   1. UM comentário por grupo, no máximo. Dentro do grupo os gatilhos têm precedência, e o
//      primeiro que casar vence — por isso a ordem das listas abaixo é conteúdo, não estilo.
//   2. Na TELA, até três comentários por dimensão, na prioridade declarada em cada seção.
//      O que não cabe fica só no PDF.
//   3. No PDF, todos os aplicáveis, na ordem dos IDs.
//
// Os gatilhos leem SÓ estado do motor (§4). Onde a spec precisa de um número que o motor não
// calcula (a sobra de 20%, os 15% de participação, os 80% de concentração), o número está aqui,
// e não no `CUTS` — são cortes de EXIBIÇÃO, e misturá-los com os do índice faria parecer que
// mudar um texto muda uma nota.

import { fmtPct, type DimKey } from '../../constants/realCopy';
import {
  COMENTARIOS, FIXOS, RETRATOS, RETRATOS_DO_BEGINNER, type EstagioDoBeginner,
} from '../../constants/realTextos';
import { ehLegado, resumoDoE, SIIC_ANUAL } from './relatorio';

export type Superficie = 'tela' | 'pdf';

export interface Comentario {
  /** O ID da spec ("R2.c", "E3.f"). É o que permite conferir texto por texto com o documento. */
  id: string;
  /** O grupo a que ele pertence. Só sai um por grupo. */
  grupo: string;
  /** O texto inteiro, interpolado. */
  texto: string;
  /** A primeira frase, que a maquete renderiza em negrito. */
  lead: string;
  /** O resto do parágrafo. Vazio quando o comentário tem uma frase só. */
  corpo: string;
}

/**
 * Parte o comentário na primeira frase.
 *
 * A maquete renderiza todo comentário com a abertura em negrito e o resto normal, e essa abertura
 * é sempre a primeira frase do texto — não um campo separado. Fazer o corte aqui evita que cada
 * uma das três superfícies invente a própria regra.
 *
 * O corte é no ponto SEGUIDO DE ESPAÇO, e não em qualquer ponto: "R$ 2.000" e "R$ 25.200" têm
 * ponto de milhar, e cortar neles partiria a frase no meio de um número.
 */
export const partirNaPrimeiraFrase = (texto: string): { lead: string; corpo: string } => {
  const i = texto.indexOf('. ');
  if (i < 0) return { lead: texto, corpo: '' };
  return { lead: texto.slice(0, i + 1), corpo: texto.slice(i + 2) };
};

// deno-lint-ignore-file no-explicit-any
type Diagnostico = Record<string, any>;

// ── Cortes de EXIBIÇÃO (§4: "o número está definido aqui, e não na spec do motor") ──────────
const EXIBICAO = {
  /** E2: concentração que dispara "quase tudo vem de uma fonte só". */
  fonteDominante: 0.80,
  /** E2: participação mínima para uma fonte contar como "perna". */
  fonteRelevante: 0.15,
  /** E3: sobra (saldo ÷ receita) que separa folga, zona neutra e limite. */
  sobraComFolga: 0.20,
  sobraNoLimite: 0.10,
  /** E3.e: custo fixo que consome mais da metade da receita. */
  fixoPesado: 0.50,
  /** E5: quando um cachê descola dos demais, e quando todos são parecidos. */
  cacheDescolado: 2,
  cacheParecido: 1.25,
  /** §5.1: os estágios invisíveis do Beginner. */
  beginnerQuaseAcendendo: 55,
  beginnerSaiuDoZero: 35,
  /** §4: a faixa "perto" da gradação de posição. */
  pertoDe: 50,
  pertoAte: 69,
} as const;

// ─────────────────────────── Leitura do diagnóstico ───────────────────────────
//
// Um objeto só, montado uma vez, com tudo que os gatilhos consultam. Sem ele cada predicado
// repetiria a mesma navegação por `ri.components.a[1].high`, e um índice trocado passaria
// despercebido em quinze lugares.
const ler = (ri: Diagnostico) => {
  const comp = (lista: any[], chave: string) => lista?.find((c) => c.key === chave) ?? {};
  const r = ri.components?.r ?? [];
  const a = ri.components?.a ?? [];
  const l = ri.components?.l ?? {};
  const bruto = ri.raw ?? {};
  const resumo = resumoDoE(ri);
  const rPresentes = r.filter((c: any) => c.present);
  return {
    ri,
    bruto,
    resumo,
    nota: ri.boletim ?? { r: 0, e: 0, a: 0, l: 0 },
    acesa: ri.pattern ?? {},
    topTier: ri.dimTopIcon ?? {},
    flags: ri.flags ?? {},
    // R
    ouvintes: comp(r, 'listeners'),
    redes: comp(r, 'socialFollowers'),
    video: comp(r, 'videoViews'),
    rPresentes,
    rAltos: rPresentes.filter((c: any) => c.high).length,
    // A
    conversao: comp(a, 'conversion'),
    circulacao: comp(a, 'shows'),
    pagante: comp(a, 'pagante'),
    aAltos: a.filter((c: any) => c.high).length,
    // L
    l,
    premiosNivel: Math.max(0, Math.min(6, Math.round(Number(bruto.premios) || 0))),
    notaImprensa: Number(l.imprensa?.nota) || 0,
    temPlaylist: l.playlists?.bin === 1,
    temRadio: l.radio?.bin === 1,
    sinalPlataforma: !!l.sinalPlataforma,
  };
};

type Ctx = ReturnType<typeof ler>;

/** A participação de cada fonte na receita anual, shows incluídos como fonte (§7.4). */
const composicao = (c: Ctx) => {
  const total = c.resumo?.receitaAnual ?? 0;
  if (!c.resumo || total <= 0) return [] as { rotulo: string; valor: number; pct: number }[];
  const partes = [
    { rotulo: 'Shows', valor: c.resumo.receitaShows },
    ...c.resumo.fontes.map((f) => ({ rotulo: f.rotulo, valor: f.valor })),
  ].filter((p) => p.valor > 0);
  return partes
    .map((p) => ({ ...p, pct: p.valor / total }))
    .sort((x, y) => y.pct - x.pct);
};

/** A sobra: quanto do que entrou ficou. `null` quando não houve receita para comparar. */
const sobra = (c: Ctx): number | null => {
  const total = c.resumo?.receitaAnual ?? 0;
  if (!c.resumo || total <= 0) return null;
  return c.resumo.saldo / total;
};

const PORTE_ORDEM: Record<string, number> = { pequeno: 1, medio: 2, grande: 3 };

/** O maior porte de veículo marcado na matriz de imprensa (§9.6). `null` quando não houve. */
const maiorPorte = (c: Ctx): string | null => {
  if (!c.bruto.imprensaRepercussao) return null;
  const celulas = Array.isArray(c.bruto.imprensaMatrix) ? c.bruto.imprensaMatrix : [];
  let melhor: string | null = null;
  for (const cel of celulas) {
    if (!melhor || (PORTE_ORDEM[cel?.porte] ?? 0) > (PORTE_ORDEM[melhor] ?? 0)) melhor = cel?.porte ?? melhor;
  }
  return melhor;
};

const naFaixa = (n: number, de: number, ate: number) => n >= de && n <= ate;

// ─────────────────────────── Os grupos e seus gatilhos ───────────────────────────
//
// A ORDEM dentro de `itens` é a precedência da spec: o primeiro que casar vence, e os demais do
// mesmo grupo não saem. Mudar a ordem muda o comentário que o artista lê.

interface Grupo {
  nome: string;
  /** Só entra no PDF (§4). */
  soPdf?: boolean;
  /** Condição para o grupo inteiro rodar (ex.: R2 só quando R está apagada). */
  quandoOGrupo?: (c: Ctx) => boolean;
  itens: { id: string; quando: (c: Ctx) => boolean }[];
}

const GRUPOS: Record<DimKey, Grupo[]> = {
  // ══════════════════════════ R · Alcance ══════════════════════════
  r: [
    {
      nome: 'R1',
      itens: [
        { id: 'R1.a', quando: (c) => !!c.topTier.r },
        { id: 'R1.b', quando: (c) => !!c.acesa.r },
        { id: 'R1.c', quando: (c) => !c.acesa.r && naFaixa(c.nota.r, EXIBICAO.pertoDe, EXIBICAO.pertoAte) },
        { id: 'R1.d', quando: (c) => !c.acesa.r && naFaixa(c.nota.r, 1, 49) },
        { id: 'R1.e', quando: (c) => !c.acesa.r && c.nota.r === 0 },
      ],
    },
    {
      nome: 'R2',
      quandoOGrupo: (c) => !c.acesa.r,
      itens: [
        { id: 'R2.e', quando: (c) => c.rPresentes.length === 1 },
        // "ouvintes alto; seguidores e vídeo (presentes) baixos": o que importa é que TODAS as
        // outras frentes presentes estejam baixas, e não que as duas existam.
        {
          id: 'R2.a',
          quando: (c) => !!c.ouvintes.high
            && c.rPresentes.filter((x: any) => x.key !== 'listeners').length > 0
            && c.rPresentes.every((x: any) => x.key === 'listeners' || !x.high),
        },
        { id: 'R2.b', quando: (c) => !!c.redes.high && !!c.ouvintes.present && !c.ouvintes.high },
        { id: 'R2.c', quando: (c) => !!c.ouvintes.high && !!c.redes.high && !!c.video.present && !c.video.high },
        { id: 'R2.d', quando: (c) => c.rPresentes.length > 0 && c.rPresentes.every((x: any) => !x.high) },
      ],
    },
    {
      nome: 'R3',
      itens: [{ id: 'R3', quando: (c) => (c.flags.autodeclarados?.length ?? 0) > 0 }],
    },
  ],

  // ══════════════════════════ E · Sustentabilidade ══════════════════════════
  e: [
    {
      nome: 'E1',
      itens: [
        { id: 'E1.a', quando: (c) => !!c.topTier.e },
        { id: 'E1.b', quando: (c) => !!c.acesa.e },
        { id: 'E1.c', quando: (c) => !c.acesa.e && naFaixa(c.nota.e, EXIBICAO.pertoDe, EXIBICAO.pertoAte) },
        { id: 'E1.d', quando: (c) => !c.acesa.e && naFaixa(c.nota.e, 1, 49) },
        { id: 'E1.e', quando: (c) => (c.resumo?.saldoAjustado ?? 0) <= 0 },
      ],
    },
    {
      nome: 'E2',
      soPdf: true,
      itens: [
        // Sem receita nenhuma não há composição a comentar: "toda a sua receita vem do palco"
        // seria falso para quem não faturou nada.
        { id: 'E2.d', quando: (c) => (c.resumo?.receitaAnual ?? 0) > 0 && c.resumo?.receitaOutrasTotal === 0 },
        { id: 'E2.a', quando: (c) => (composicao(c)[0]?.pct ?? 0) >= EXIBICAO.fonteDominante },
        { id: 'E2.c', quando: (c) => composicao(c).filter((p) => p.pct >= EXIBICAO.fonteRelevante).length >= 3 },
        { id: 'E2.b', quando: (c) => composicao(c).filter((p) => p.pct >= EXIBICAO.fonteRelevante).length === 2 },
      ],
    },
    {
      nome: 'E3',
      itens: [
        { id: 'E3.b', quando: (c) => (c.resumo?.saldo ?? 0) < 0 },
        { id: 'E3.a', quando: (c) => (c.resumo?.saldo ?? 0) > 0 && (sobra(c) ?? 0) >= EXIBICAO.sobraComFolga },
        { id: 'E3.c', quando: (c) => (c.resumo?.saldo ?? 0) > 0 && (sobra(c) ?? 1) < EXIBICAO.sobraNoLimite },
      ],
    },
    // Os alertas de custo são grupos SEPARADOS de propósito: a spec diz que "cada um dispara de
    // forma independente" e que podem coexistir. Se fossem um grupo só, a regra do "um por grupo"
    // esconderia dois dos três.
    { nome: 'E3.custoLancamento', soPdf: true, itens: [{ id: 'E3.d', quando: (c) => !!c.resumo && c.resumo.investLancamentos12m === 0 }] },
    {
      nome: 'E3.custoFixo',
      soPdf: true,
      itens: [{
        id: 'E3.e',
        quando: (c) => !!c.resumo && c.resumo.receitaAnual > 0
          && c.resumo.custoFixoAnual > EXIBICAO.fixoPesado * c.resumo.receitaAnual,
      }],
    },
    {
      nome: 'E3.custoShow',
      soPdf: true,
      itens: [{
        id: 'E3.f',
        quando: (c) => !!c.resumo && c.resumo.custoPorShow > 0 && c.resumo.cacheMedio > 0
          && c.resumo.custoPorShow >= c.resumo.cacheMedio,
      }],
    },
    {
      nome: 'E4',
      itens: [
        { id: 'E4.a', quando: (c) => !c.bruto.temCnpj && !c.bruto.temEmpresario },
        { id: 'E4.b', quando: (c) => !!c.bruto.temCnpj && !c.bruto.temEmpresario },
        { id: 'E4.c', quando: (c) => !c.bruto.temCnpj && !!c.bruto.temEmpresario },
        { id: 'E4.d', quando: (c) => !!c.bruto.temCnpj && !!c.bruto.temEmpresario },
      ],
    },
    {
      nome: 'E5',
      soPdf: true,
      quandoOGrupo: (c) => (c.resumo?.cache.length ?? 0) >= 2,
      itens: [
        {
          id: 'E5.a',
          quando: (c) => {
            const v = (c.resumo?.cache ?? []).map((x) => x.valor);
            const max = Math.max(...v);
            const demais = v.filter((x) => x !== max);
            if (!demais.length) return false;
            const media = demais.reduce((s, x) => s + x, 0) / demais.length;
            return media > 0 && max >= EXIBICAO.cacheDescolado * media;
          },
        },
        {
          id: 'E5.b',
          quando: (c) => {
            const v = (c.resumo?.cache ?? []).map((x) => x.valor);
            const min = Math.min(...v);
            return min > 0 && Math.max(...v) <= EXIBICAO.cacheParecido * min;
          },
        },
      ],
    },
    { nome: 'E6', itens: [{ id: 'E6', quando: (c) => (c.flags.naoSeiFontes?.length ?? 0) > 0 }] },
    {
      nome: 'E7',
      soPdf: true,
      itens: [
        // E7.a fala do ponto de equilíbrio; sem custo fixo não existe equilíbrio a cobrir, e a
        // frase ficaria sem sentido. E7.b só depende da margem.
        { id: 'E7.a', quando: (c) => (c.resumo?.margemPorShow ?? 0) > 0 && c.resumo?.pontoEquilibrioShows != null },
        { id: 'E7.b', quando: (c) => c.resumo?.margemPorShow != null && c.resumo.margemPorShow <= 0 },
      ],
    },
    {
      nome: 'E8',
      soPdf: true,
      quandoOGrupo: (c) => (c.resumo?.saldoAjustado ?? 0) > 0,
      itens: [
        { id: 'E8.a', quando: (c) => (c.resumo?.saldoAjustado ?? 0) >= SIIC_ANUAL },
        { id: 'E8.b', quando: (c) => (c.resumo?.saldoAjustado ?? 0) < SIIC_ANUAL },
      ],
    },
  ],

  // ══════════════════════════ A · Público real ══════════════════════════
  a: [
    {
      nome: 'A1',
      itens: [
        { id: 'A1.a', quando: (c) => !!c.topTier.a },
        { id: 'A1.b', quando: (c) => !!c.acesa.a },
        { id: 'A1.f', quando: (c) => !c.conversao.present },
        { id: 'A1.c', quando: (c) => !c.acesa.a && c.aAltos === 2 },
        { id: 'A1.d', quando: (c) => !c.acesa.a && c.aAltos === 1 },
        { id: 'A1.e', quando: (c) => !c.acesa.a && c.aAltos === 0 },
      ],
    },
    {
      nome: 'A2',
      quandoOGrupo: (c) => !c.acesa.a,
      itens: [
        { id: 'A2.e', quando: (c) => c.bruto.fazBilheteria === false },
        { id: 'A2.a', quando: (c) => !!c.conversao.high && (!c.circulacao.high || !c.pagante.high) },
        { id: 'A2.b', quando: (c) => !!c.circulacao.high && !!c.pagante.high && !c.conversao.high },
        { id: 'A2.c', quando: (c) => !!c.circulacao.high && !c.pagante.high },
        { id: 'A2.d', quando: (c) => !c.circulacao.high && !!c.pagante.high },
        { id: 'A2.f', quando: (c) => !c.circulacao.high && !c.pagante.high },
      ],
    },
    {
      nome: 'A3',
      itens: [
        { id: 'A3.a', quando: (c) => redesComEngajamento(c).length > 0 },
        { id: 'A3.b', quando: (c) => redesComEngajamento(c).length === 0 },
      ],
    },
  ],

  // ══════════════════════════ L · Legitimação ══════════════════════════
  l: [
    {
      nome: 'L1',
      itens: [
        { id: 'L1.a', quando: (c) => !!c.topTier.l },
        { id: 'L1.b', quando: (c) => !!c.acesa.l },
        { id: 'L1.f', quando: (c) => !!c.flags.travaL },
        { id: 'L1.c', quando: (c) => !c.acesa.l && naFaixa(c.nota.l, EXIBICAO.pertoDe, EXIBICAO.pertoAte) },
        { id: 'L1.d', quando: (c) => !c.acesa.l && naFaixa(c.nota.l, 1, 49) },
        { id: 'L1.e', quando: (c) => !c.acesa.l && c.nota.l === 0 },
      ],
    },
    {
      nome: 'L2',
      // Roda quando L está apagada OU quando acendeu pela exceção do prêmio internacional.
      quandoOGrupo: (c) => !c.acesa.l || !c.sinalPlataforma,
      itens: [
        { id: 'L2.e', quando: (c) => !!c.acesa.l && !c.sinalPlataforma },
        { id: 'L2.a', quando: (c) => c.notaImprensa > 0 && !c.temPlaylist && !c.temRadio },
        { id: 'L2.b', quando: (c) => (c.temPlaylist || c.temRadio) && c.notaImprensa === 0 },
        { id: 'L2.c', quando: (c) => c.premiosNivel > 0 && c.notaImprensa === 0 && !c.sinalPlataforma },
        { id: 'L2.d', quando: (c) => c.premiosNivel === 0 && c.notaImprensa === 0 && !c.sinalPlataforma },
      ],
    },
    {
      nome: 'L3',
      itens: [
        { id: 'L3.a', quando: (c) => c.premiosNivel === 0 },
        { id: 'L3.b', quando: (c) => naFaixa(c.premiosNivel, 1, 2) },
        { id: 'L3.c', quando: (c) => naFaixa(c.premiosNivel, 3, 4) },
        { id: 'L3.d', quando: (c) => naFaixa(c.premiosNivel, 5, 6) },
      ],
    },
    {
      nome: 'L4',
      itens: [
        { id: 'L4.a', quando: (c) => maiorPorte(c) == null },
        { id: 'L4.b', quando: (c) => ['pequeno', 'medio'].includes(maiorPorte(c) ?? '') },
        { id: 'L4.c', quando: (c) => maiorPorte(c) === 'grande' },
      ],
    },
    {
      nome: 'L5',
      quandoOGrupo: (c) => !!c.bruto.imprensaRepercussao,
      itens: [
        { id: 'L5.a', quando: (c) => c.bruto.imprensaFrequencia === 'esporadico' },
        { id: 'L5.b', quando: (c) => c.bruto.imprensaFrequencia === 'lancamento' },
        { id: 'L5.c', quando: (c) => c.bruto.imprensaFrequencia === 'perene' },
      ],
    },
    // §9.8 pede DOIS comentários: um de playlist e um de rádio. Dois grupos, não um.
    { nome: 'L6.playlist', itens: [{ id: 'L6.a', quando: (c) => c.temPlaylist }, { id: 'L6.b', quando: (c) => !c.temPlaylist }] },
    { nome: 'L6.radio', itens: [{ id: 'L6.c', quando: (c) => c.temRadio }, { id: 'L6.d', quando: (c) => !c.temRadio }] },
    {
      nome: 'L7',
      soPdf: true,
      itens: [{ id: 'L7', quando: (c) => !!c.acesa.e && !!c.acesa.a && !c.acesa.l }],
    },
  ],
};

/** A prioridade na TELA, por dimensão (§6, §7, §8, §9). Até três. */
const PRIORIDADE_NA_TELA: Record<DimKey, string[]> = {
  r: ['R1', 'R2', 'R3'],
  // §7 — "E6 também na tela se houver não sei, substituindo E4".
  e: ['E1', 'E3', 'E4'],
  a: ['A1', 'A2', 'A3'],
  l: ['L1', 'L2', 'L4'],
};
const MAXIMO_NA_TELA = 3;

// ─────────────────────────── Formatação das variáveis (§11) ───────────────────────────

/**
 * Dinheiro dentro do texto corrido: "reais sem centavos; acima de 10 mil, abreviar".
 *
 * O texto já traz o "R$" antes da chave ("rendeu R$ {receita_anual}"), então a variável sai SEM
 * o prefixo. A maquete abrevia 1.200 como "1,2 mil" num lugar e escreve 2.000 por extenso noutro;
 * seguimos a regra escrita do §11, que é a que se pode aplicar sem exceção.
 */
const dinheiroDoTexto = (n: number): string => {
  const v = Math.abs(Math.round(n));
  const enxuto = (x: number) => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (v >= 1_000_000) return `${enxuto(v / 1_000_000)} mi`;
  if (v >= 10_000) return `${enxuto(v / 1_000)} mil`;
  return v.toLocaleString('pt-BR');
};

/** "A", "A e B", "A, B e C". */
const listaNatural = (itens: string[]): string => {
  if (itens.length <= 1) return itens[0] ?? '';
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
};

const maiuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const POR_EXTENSO = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
const porExtenso = (n: number) => POR_EXTENSO[n] ?? String(n);

/** A fração em palavras do E8.b ("cerca de metade", "cerca de um quinto"). */
const FRACAO_EM_PALAVRAS: Record<number, string> = {
  2: 'cerca de metade', 3: 'cerca de um terço', 4: 'cerca de um quarto', 5: 'cerca de um quinto',
  6: 'cerca de um sexto', 7: 'cerca de um sétimo', 8: 'cerca de um oitavo', 9: 'cerca de um nono',
  10: 'cerca de um décimo',
};
const fracaoEmPalavras = (razao: number): string => {
  if (razao <= 0) return 'bem menos';
  const denominador = Math.round(1 / razao);
  return FRACAO_EM_PALAVRAS[denominador] ?? 'menos de um décimo';
};

/** Os nomes dos campos autodeclarados, na linguagem do relatório (§11, `{campos}`). */
const NOME_DO_CAMPO: Record<string, string> = {
  spotifyListeners: 'ouvintes no Spotify',
  igFollowers: 'seguidores no Instagram',
  tiktokFollowers: 'seguidores no TikTok',
  youtubeMonthlyViews: 'visualizações no YouTube',
  spotifyFollowers: 'seguidores no Spotify',
};

/** As frentes de A, como o texto as chama (§11, `{frente_faltante}` e `{frente_alta}`). */
const NOME_DA_FRENTE: Record<string, string> = {
  conversion: 'a conversão',
  shows: 'a circulação',
  pagante: 'o público pagante',
};

/** As dimensões, como o BEG.2 as chama (§11, `{dimensao}`). */
const NOME_DA_DIMENSAO: Record<DimKey, string> = {
  r: 'o alcance',
  e: 'a sustentabilidade',
  a: 'o público real',
  l: 'a legitimação',
};

const REDES = [
  { chave: 'instagram', nome: 'Instagram' },
  { chave: 'tiktok', nome: 'TikTok' },
  { chave: 'youtube', nome: 'YouTube' },
] as const;

const redesComEngajamento = (c: Ctx) =>
  REDES.map((r) => ({ nome: r.nome, dado: c.ri.engagement?.[r.chave] }))
    .filter((r) => r.dado != null) as { nome: string; dado: { value: number } }[];

// ─────────────────────────── Interpolação ───────────────────────────

const variaveis = (c: Ctx, cm?: Record<string, any> | null): Record<string, string> => {
  const rev = c.resumo;
  const comp = composicao(c);
  const caches = (rev?.cache ?? []).map((x) => x.valor);
  const maxCache = caches.length ? Math.max(...caches) : 0;
  const demaisCaches = caches.filter((x) => x !== maxCache);
  const eng = redesComEngajamento(c);
  const playlists = Number(c.bruto.editorialPlaylists ?? cm?.playlists?.count ?? 0);
  const nomesDasPlaylists = ((cm?.playlists?.top ?? []) as { name: string; editorial?: boolean }[])
    .filter((p) => p.editorial).map((p) => p.name);
  const razaoSiic = (rev?.saldoAjustado ?? 0) / SIIC_ANUAL;
  const faltante = [c.conversao, c.circulacao, c.pagante].find((x: any) => !x.high);
  const alta = [c.conversao, c.circulacao, c.pagante].find((x: any) => x.high);

  return {
    n_altos: String(c.rAltos),
    n_frentes: String(c.rPresentes.length),
    campos: maiuscula(listaNatural((c.flags.autodeclarados ?? []).map((k: string) => NOME_DO_CAMPO[k] ?? k))),
    receita_anual: dinheiroDoTexto(rev?.receitaAnual ?? 0),
    investimento_anual: dinheiroDoTexto(rev?.investimentoAnual ?? 0),
    saldo_abs: dinheiroDoTexto(Math.abs(rev?.saldo ?? 0)),
    fonte_dominante: comp[0]?.rotulo ?? '',
    pct: `${Math.round((comp[0]?.pct ?? 0) * 100)}%`,
    fonte1: comp[0]?.rotulo ?? '',
    fonte2: comp[1]?.rotulo ?? '',
    tipo_dominante: (rev?.cache.find((x) => x.valor === maxCache)?.rotulo ?? '').toLowerCase(),
    cache_max: dinheiroDoTexto(maxCache),
    cache_medio: dinheiroDoTexto(demaisCaches.length ? demaisCaches.reduce((s, x) => s + x, 0) / demaisCaches.length : 0),
    fontes_nao_sei: listaNatural((c.flags.naoSeiFontes ?? []).map((f: string) => {
      const achado = rev?.fontes.find((x) => x.fonte === f);
      return (achado?.rotulo ?? f).toLowerCase();
    })),
    margem_show: dinheiroDoTexto(rev?.margemPorShow ?? 0),
    shows_equilibrio: String(rev?.pontoEquilibrioShows ?? 0),
    shows_ano: String(rev?.showsPerYear ?? 0),
    // O E8 usa a MESMA chave com dois formatos: número quando rende mais que o setor, fração em
    // palavras quando rende menos. É assim na spec, e o texto de cada um já traz o resto da frase.
    x: razaoSiic >= 1 ? razaoSiic.toFixed(1).replace('.', ',') : fracaoEmPalavras(razaoSiic),
    frente_faltante: NOME_DA_FRENTE[faltante?.key] ?? '',
    frente_alta: NOME_DA_FRENTE[alta?.key] ?? '',
    rede_1: eng[0]?.nome ?? '',
    taxa_1: eng[0] ? fmtPct(eng[0].dado.value).replace('%', '') : '',
    n_playlists: String(playlists),
    lista: nomesDasPlaylists.length
      ? listaNatural(nomesDasPlaylists.slice(0, 5)) + (nomesDasPlaylists.length > 5 ? ' e outras' : '')
      : '',
    execucoes: String(Math.round(Number(c.bruto.radioAirplay180d ?? 0))),
    n: porExtenso((['r', 'e', 'a', 'l'] as DimKey[]).filter((d) => c.nota[d] >= EXIBICAO.beginnerSaiuDoZero).length),
    dimensao: NOME_DA_DIMENSAO[(['r', 'e', 'a', 'l'] as DimKey[])
      .reduce((mel, d) => (c.nota[d] > c.nota[mel] ? d : mel), 'r' as DimKey)],
  };
};

/**
 * Troca as chaves pelo valor. Duas notações da spec precisam de tratamento próprio:
 *
 * - `{, rede_2 taxa_2%}` (A3.a) é um GRUPO OPCIONAL, não uma variável: o trecho inteiro só
 *   aparece quando existe uma segunda rede com dado.
 * - `playlist{s} editorial{is}` (L6.a) não fecha por sufixo, porque o plural de "editorial" é
 *   "editoriais" e não "editorialis". A concordância é resolvida na frase toda.
 */
const interpolar = (texto: string, vars: Record<string, string>, c: Ctx): string => {
  const eng = redesComEngajamento(c);
  let saida = texto;

  saida = saida.replace(
    '{, rede_2 taxa_2%}',
    eng[1] ? `, ${eng[1].nome} ${fmtPct(eng[1].dado.value)}` : '',
  );
  const nPlaylists = Number(vars.n_playlists) || 0;
  saida = saida.replace(
    'playlist{s} editorial{is}',
    nPlaylists === 1 ? 'playlist editorial' : 'playlists editoriais',
  );

  return saida.replace(/\{(\w+)\}/g, (inteiro, chave) => vars[chave] ?? inteiro);
};

// ─────────────────────────── A API pública ───────────────────────────

export interface OpcoesDoRelatorio {
  /** `tela` corta em três comentários por dimensão; `pdf` traz todos (§4). */
  superficie?: Superficie;
  /** O resumo da Chartmetric, quando o texto precisa dele (os nomes das playlists, em L6.a). */
  chartmetric?: Record<string, any> | null;
}

/**
 * Os comentários de uma dimensão, já escolhidos e interpolados.
 *
 * Devolve lista vazia para diagnóstico de versão anterior: os gatilhos leem estado que a v3 não
 * calculava, e inventar um comentário sobre dado que não existe é pior do que não comentar. O
 * legado tem o aviso F17, e só.
 */
export const comentariosDaDimensao = (
  ri: Diagnostico | null | undefined,
  dim: DimKey,
  opcoes: OpcoesDoRelatorio = {},
): Comentario[] => {
  if (!ri || ehLegado(ri)) return [];
  const superficie = opcoes.superficie ?? 'tela';
  const c = ler(ri);
  const vars = variaveis(c, opcoes.chartmetric);

  // Um por grupo: dentro do grupo, o primeiro gatilho que casar vence (§4).
  const escolhidos: Comentario[] = [];
  for (const grupo of GRUPOS[dim]) {
    if (superficie === 'tela' && grupo.soPdf) continue;
    if (grupo.quandoOGrupo && !grupo.quandoOGrupo(c)) continue;
    const item = grupo.itens.find((i) => i.quando(c));
    if (!item) continue;
    const bruto = COMENTARIOS[item.id];
    if (!bruto) continue;
    const texto = interpolar(bruto, vars, c);
    escolhidos.push({ id: item.id, grupo: grupo.nome, texto, ...partirNaPrimeiraFrase(texto) });
  }

  if (superficie === 'pdf') return escolhidos;

  // Na tela, a ordem é a prioridade da seção, e não a ordem dos IDs.
  //
  // O E tem uma troca declarada (§7): quando há fonte marcada "não sei", o E6 ENTRA no lugar do
  // E4. Não é um quarto comentário — é o mesmo espaço, ocupado por quem tem mais a dizer naquele
  // diagnóstico.
  let ordem = PRIORIDADE_NA_TELA[dim];
  if (dim === 'e' && escolhidos.some((x) => x.grupo === 'E6')) ordem = ['E1', 'E3', 'E6'];

  return ordem
    .map((nome) => escolhidos.find((x) => x.grupo === nome))
    .filter((x): x is Comentario => !!x)
    .slice(0, MAXIMO_NA_TELA);
};

/**
 * O estágio invisível do Beginner (§5.1).
 *
 * O artista sempre vê "Beginner"; o que muda é o texto. A precedência é a da spec: uma frente
 * quase acendendo conta mais do que duas que só saíram do zero.
 */
export const estagioDoBeginner = (ri: Diagnostico): EstagioDoBeginner => {
  const nota = ri.boletim ?? {};
  const dims: DimKey[] = ['r', 'e', 'a', 'l'];
  if (dims.some((d) => (nota[d] ?? 0) >= EXIBICAO.beginnerQuaseAcendendo)) return 'BEG.2';
  if (dims.filter((d) => (nota[d] ?? 0) >= EXIBICAO.beginnerSaiuDoZero).length >= 2) return 'BEG.1';
  return 'BEG.0';
};

/**
 * O retrato do perfil (§5.2), com as variáveis do Beginner já resolvidas.
 *
 * Devolve `null` no legado: os retratos descrevem a leitura da v4, e colar um deles sobre um
 * diagnóstico antigo afirmaria coisas que aquele cálculo não sustenta.
 */
export const retratoDoPerfil = (
  ri: Diagnostico | null | undefined,
): { texto: string; estagio?: EstagioDoBeginner } | null => {
  if (!ri || ehLegado(ri)) return null;
  const chave = ri.profile?.key as string | undefined;
  if (!chave) return null;
  if (chave !== '0000') {
    const texto = RETRATOS[chave];
    return texto ? { texto } : null;
  }
  const estagio = estagioDoBeginner(ri);
  const c = ler(ri);
  return { texto: interpolar(RETRATOS_DO_BEGINNER[estagio], variaveis(c), c), estagio };
};

/**
 * O selo do estado da dimensão (§3).
 *
 * "Top Tier" é o patamar de elite DE UMA DIMENSÃO; "TOP ICON" é o PERFIL que acende quando as
 * quatro estão em Top Tier (§1.7). São coisas diferentes, e a maquete confirma: os selos das
 * dimensões são APAGADA / ACESA / TOP TIER, e TOP ICON só aparece junto do nome do perfil.
 */
export const seloDaDimensao = (
  ri: Diagnostico | null | undefined,
  dim: DimKey,
): { rotulo: string; estado: 'apagada' | 'acesa' | 'topTier' } => {
  if (ri?.dimTopIcon?.[dim]) return { rotulo: 'TOP TIER', estado: 'topTier' };
  if (ri?.pattern?.[dim]) return { rotulo: 'ACESA', estado: 'acesa' };
  return { rotulo: 'APAGADA', estado: 'apagada' };
};

/** A linha de status da barra: F3 (apagada), F4 (acesa) ou F5 (Top Tier). §10. */
export const statusDaBarra = (ri: Diagnostico | null | undefined, dim: DimKey): string => {
  const nota = Math.max(0, Math.min(100, Math.round(Number(ri?.boletim?.[dim]) || 0)));
  if (ri?.dimTopIcon?.[dim]) return FIXOS.F5;
  const paraTopTier = String(Math.max(0, 100 - nota));
  if (ri?.pattern?.[dim]) return FIXOS.F4.replace('{y}', paraTopTier);
  return FIXOS.F3.replace('{x}', String(Math.max(0, 70 - nota))).replace('{y}', paraTopTier);
};
