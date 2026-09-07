// A LEITURA de um diagnóstico REAL: as linhas de cada dimensão, os avisos obrigatórios e o resumo
// financeiro. Uma fonte só para as três superfícies que mostram isso (tela da web, PDF e app).
//
// Por que aqui e não em cada tela: as três montavam as mesmas linhas à mão, com os mesmos rótulos
// copiados. Quando a v4 trocou o formato das entradas (proveniência por campo, base anual, nove
// fontes), as três precisariam mudar juntas — e a que ficasse para trás não quebraria, apenas
// mostraria o número errado, calado.
//
// Referência: "Diagnóstico REAL v4", §11.3 (textos obrigatórios), §7.5 (exibição do E) e §13.2
// (diagnósticos em versão anterior).

import { fmtBRL, fmtNum, FREQ_LABELS, PAGANTE_LABELS, PREMIOS_LABELS_V3, type DimKey } from '../../constants/realCopy';
import { FIXOS } from '../../constants/realTextos';
import { ALIQUOTA_PCT, type Aliquota, type FonteDeReceita, type Proveniencia, type TipoDeContratante } from './index';

/** Uma linha de dado no cartão da dimensão. `num` é formatado pelo consumidor; `valor` já vem pronto. */
export interface LinhaDoRelatorio {
  rotulo: string;
  num?: number | null;
  valor?: string;
  /** 'self' rende o "informado por você" do §11.3.2; 'api' é dado verificado; ausente não se marca. */
  fonte?: Proveniencia;
}

/** Um aviso obrigatório da interface (§11.3). A chave serve para testar sem depender do texto. */
export interface AvisoDoRelatorio { chave: string; texto: string }

// deno-lint-ignore-file no-explicit-any
type Diagnostico = Record<string, any>;

/**
 * Um diagnóstico gravado antes da v4 (§13.2).
 *
 * Os 77 anteriores não têm os dados do E anual (shows por ano, seis cachês, nove fontes, alíquota)
 * nem a autodeclaração de R. Continuam visíveis, marcados, e a saída é refazer — recalcular só a
 * parte que dá não produziria um perfil interpretável, produziria uma mistura de duas metodologias.
 */
export const ehLegado = (ri: Diagnostico | null | undefined): boolean => Number(ri?.version ?? 0) < 4;

/** F17 (§10) — o texto é da autora, e vive com os outros em `constants/realTextos`. */
export const AVISO_LEGADO = FIXOS.F17;

/**
 * Os grupos de comentário do E que MIGRAM para a página "Onde a conta fecha" do PDF (§2).
 *
 * Eles falam de margem, ponto de equilíbrio e composição da receita, que é o assunto daquela
 * página. Sem esta lista, os dois lugares imprimiriam o mesmo parágrafo: a página do E e a do
 * aprofundamento, no mesmo documento, uma depois da outra.
 */
export const GRUPOS_DA_CONTA: readonly string[] = ['E7', 'E5', 'E8'];

/** Os textos obrigatórios do §11.3, na ordem em que a spec os lista. */
export const AVISOS = {
  travaL: 'Sua legitimação ainda não tem um sinal de plataforma. Playlist editorial ou execução em '
    + 'rádio acende esta dimensão.',
  autodeclarado: 'Conecte suas redes no Spotify for Artists e refaça o diagnóstico quando quiser.',
  informadoPorVoce: 'informado por você',
  saldoNegativo: 'Sua carreira consumiu mais do que gerou nos últimos 12 meses.',
  naoSei: 'Você não soube informar esta fonte. Conhecer cada receita é parte da gestão da carreira.',
  informativo: 'informativo, não entra no diagnóstico',
  semBilheteria: 'Sem shows de bilheteria como atração principal, o público real não pode ser comprovado.',
} as const;

/** Os avisos que ESTE diagnóstico precisa mostrar, já filtrados pelas flags do motor. */
export const avisosDoDiagnostico = (ri: Diagnostico | null | undefined): AvisoDoRelatorio[] => {
  if (!ri) return [];
  if (ehLegado(ri)) return [{ chave: 'legado', texto: AVISO_LEGADO }];
  const f = ri.flags ?? {};
  const avisos: AvisoDoRelatorio[] = [];
  if (f.travaL) avisos.push({ chave: 'travaL', texto: AVISOS.travaL });
  if (f.saldoNegativo) avisos.push({ chave: 'saldoNegativo', texto: AVISOS.saldoNegativo });
  if (f.aSemBilheteria) avisos.push({ chave: 'semBilheteria', texto: AVISOS.semBilheteria });
  if (Array.isArray(f.autodeclarados) && f.autodeclarados.length) {
    avisos.push({ chave: 'autodeclarado', texto: AVISOS.autodeclarado });
  }
  if (Array.isArray(f.naoSeiFontes) && f.naoSeiFontes.length) {
    avisos.push({ chave: 'naoSei', texto: AVISOS.naoSei });
  }
  return avisos;
};

/**
 * Os avisos que NÃO têm lugar próprio na entrega, e por isso precisam de um bloco no topo.
 *
 * Todos os textos do §11.3 continuam obrigatórios; o que muda é ONDE eles aparecem. Quatro deles
 * pertencem a uma dimensão e são impressos dentro do cartão dela, onde ganham o contexto que o
 * texto sozinho não tem:
 *
 *   travaL          → cartão do L
 *   saldoNegativo   → cartão do E
 *   semBilheteria   → cartão do A
 *   naoSei          → cartão do E, nomeando a fonte ("Não informado: Editora")
 *   autodeclarado   → cartão do R, que é onde moram os campos que aceitam autodeclaração
 *
 * Repetir os mesmos textos num bloco no alto, sem dizer de qual fonte ou de qual campo se trata,
 * é a mesma frase duas vezes — e a primeira, a genérica, chega antes do artista ter lido um
 * número sequer. O que sobra para o topo é o aviso de VERSÃO, que fala do documento inteiro e
 * não cabe em cartão nenhum.
 */
export const avisosSemLugarProprio = (ri: Diagnostico | null | undefined): AvisoDoRelatorio[] =>
  avisosDoDiagnostico(ri).filter((a) => a.chave === 'legado');

/** O valor e a origem de um campo de entrada da v4. Fora da v4, devolve o número cru sem origem. */
const medida = (ri: Diagnostico, campo: string): { value: number | null; fonte?: Proveniencia } => {
  const m = ri?.inputs?.[campo];
  if (m && typeof m === 'object') return { value: m.value ?? null, fonte: m.source };
  return { value: m == null ? null : Number(m) };
};

const linhaDeMedida = (ri: Diagnostico, rotulo: string, campo: string): LinhaDoRelatorio => {
  const { value, fonte } = medida(ri, campo);
  return { rotulo, num: value, fonte };
};

/** Os rótulos dos tipos de contratante, para o gráfico de cachê (§7.5). */
export const ROTULO_DO_CONTRATANTE: Record<TipoDeContratante, string> = {
  corporativos: 'Corporativos',
  orgaosPublicos: 'Órgãos públicos',
  particulares: 'Particulares',
  produtores: 'Produtores de eventos',
  casasDeShow: 'Casas de show',
  outros: 'Outros',
};

/** Os rótulos curtos das nove fontes, para a tabela de receita (§7.5). */
export const ROTULO_DA_FONTE: Record<FonteDeReceita, string> = {
  distribuidora: 'Distribuidora',
  editora: 'Editora',
  associacao: 'Associação (direitos de execução)',
  publi: 'Publis e ativações',
  patrocinios: 'Patrocínios e editais',
  aulas: 'Aulas, cursos e mentorias',
  produtos: 'Produtos físicos',
  financiamento: 'Financiamento coletivo',
  outras: 'Outras fontes',
};

export const ROTULO_DA_ALIQUOTA: Record<Aliquota, string> = {
  ate6: 'Até 6%', '6-10': 'De 6% a 10%', '10-15': 'De 10% a 15%', acima15: 'Acima de 15%', nao_sei: 'Não sei',
};

/**
 * Remuneração média mensal do setor cultural formal (SIIC/IBGE, edição vigente).
 *
 * [EXIBIÇÃO] §7.3: entra no relatório como comparação e NUNCA no índice. O corte do E vem da PNAD
 * (P95 da renda individual), que é outra coisa — misturar as duas trocaria a régua do método.
 */
export const SIIC_MENSAL = 4_658;
export const SIIC_ANUAL = SIIC_MENSAL * 12;

/** O resumo financeiro da entrega (§7.5). Devolve `null` fora da v4. */
export const resumoDoE = (ri: Diagnostico | null | undefined) => {
  if (!ri || ehLegado(ri)) return null;
  const rev = ri.revenue ?? {};
  const cache = (Object.entries(rev.cacheByType ?? {}) as [TipoDeContratante, number][])
    .filter(([, v]) => Number(v) > 0)
    .map(([tipo, valor]) => ({ tipo, rotulo: ROTULO_DO_CONTRATANTE[tipo] ?? tipo, valor: Number(valor) }));
  const fontes = (Object.entries(rev.receitaOutras ?? {}) as [FonteDeReceita, { valor: number; naoSei: boolean }][])
    .filter(([, v]) => Number(v?.valor) > 0 || v?.naoSei)
    .map(([fonte, v]) => ({ fonte, rotulo: ROTULO_DA_FONTE[fonte] ?? fonte, valor: Number(v.valor) || 0, naoSei: !!v.naoSei }));
  const aliquota: Aliquota | null = rev.aliquota ?? null;
  return {
    showsPerYear: Number(rev.showsPerYear) || 0,
    cache,
    cacheMedio: Number(rev.cacheMedio) || 0,
    receitaShows: Number(rev.receitaShows) || 0,
    fontes,
    receitaOutrasTotal: Number(rev.receitaOutrasTotal) || 0,
    receitaAnual: Number(rev.receitaAnual) || 0,
    // O investimento decomposto (v4.1, §7.5): o total continua existindo para a linha de saldo,
    // e as três parcelas alimentam o gráfico de composição do custo.
    custoPorShow: Number(rev.custoPorShow) || 0,
    custoShowsAnual: Number(rev.custoShowsAnual) || 0,
    custoFixoMensal: Number(rev.custoFixoMensal) || 0,
    custoFixoAnual: Number(rev.custoFixoAnual) || 0,
    investLancamentos12m: Number(rev.investLancamentos12m) || 0,
    investimentoAnual: Number(rev.investimentoAnual) || 0,
    saldo: Number(rev.saldo) || 0,
    bonus: Number(rev.bonus) || 1,
    saldoAjustado: Number(rev.saldoAjustado) || 0,
    aliquota,
    aliquotaRotulo: aliquota ? ROTULO_DA_ALIQUOTA[aliquota] : null,
    aliquotaPct: aliquota && aliquota !== 'nao_sei' ? ALIQUOTA_PCT[aliquota] : null,
    receitaLiquidaEstimada: rev.receitaLiquidaEstimada ?? null,
    margemPorShow: rev.margemPorShow ?? null,
    pontoEquilibrioShows: rev.pontoEquilibrioShows ?? null,
    // Quantas vezes a média do setor cultural formal (§7.3). Só comparação, nunca cálculo.
    vezesOSetor: SIIC_ANUAL > 0 ? (Number(rev.receitaAnual) || 0) / SIIC_ANUAL : 0,
    // §7.5 — quem não tem empresário recebe a recomendação, e é o mesmo dado que dá o bônus do E.
    recomendarEmpresariamento: ri.raw?.temEmpresario === false,
  };
};

/** As linhas de dado do cartão de uma dimensão (v4). Fora da v4, devolve lista vazia. */
export const linhasDaDimensao = (
  ri: Diagnostico | null | undefined,
  dim: DimKey,
  cm?: Record<string, any> | null,
): LinhaDoRelatorio[] => {
  if (!ri || ehLegado(ri)) return [];
  const bruto = ri.raw ?? {};
  const rev = ri.revenue ?? {};

  if (dim === 'r') {
    return [
      linhaDeMedida(ri, 'Ouvintes Spotify', 'spotifyListeners'),
      linhaDeMedida(ri, 'Instagram', 'igFollowers'),
      linhaDeMedida(ri, 'TikTok', 'tiktokFollowers'),
      linhaDeMedida(ri, 'YouTube (views/mês)', 'youtubeMonthlyViews'),
    ];
  }

  if (dim === 'e') {
    // A v4 lê SALDO, não receita: mostrar só o faturamento contaria a metade que agrada e
    // esconderia a que decide a dimensão.
    // §12 — a tabela do E mostra as PARCELAS do custo, não só o total. É o que permite ao artista
    // conferir a própria conta: o total sozinho não diz se o peso está no show, no fixo ou no
    // lançamento, e é essa distinção que muda a decisão.
    const linhas: LinhaDoRelatorio[] = [
      { rotulo: 'Shows (12 meses)', valor: String(Number(rev.showsPerYear) || 0), fonte: 'self' },
      { rotulo: 'Receita (12 meses)', valor: fmtBRL(Number(rev.receitaAnual) || 0), fonte: 'self' },
      { rotulo: 'Custo médio por show', valor: fmtBRL(Number(rev.custoPorShow) || 0), fonte: 'self' },
      { rotulo: 'Custo fixo mensal', valor: fmtBRL(Number(rev.custoFixoMensal) || 0), fonte: 'self' },
      { rotulo: 'Investimento em lançamentos', valor: fmtBRL(Number(rev.investLancamentos12m) || 0), fonte: 'self' },
      { rotulo: 'Custos e investimento (12 meses)', valor: fmtBRL(Number(rev.investimentoAnual) || 0), fonte: 'self' },
      { rotulo: 'Saldo', valor: fmtBRL(Number(rev.saldo) || 0), fonte: 'self' },
    ];
    const bonus = Number(rev.bonus) || 1;
    if (bonus > 1) {
      linhas.push({
        rotulo: 'Saldo ajustado',
        valor: `${fmtBRL(Number(rev.saldoAjustado) || 0)} (bônus de ${Math.round((bonus - 1) * 100)}%)`,
        fonte: 'self',
      });
    }
    return linhas;
  }

  if (dim === 'a') {
    const conv = ri.components?.a?.find((c: any) => c.key === 'conversion');
    const listeners = medida(ri, 'spotifyListeners').value;
    const followers = medida(ri, 'spotifyFollowers').value;
    return [
      {
        rotulo: 'Conversão (seguidores ÷ ouvintes)',
        valor: conv?.present && listeners && followers
          ? `${(followers / listeners * 100).toFixed(1).replace('.', ',')}%`
          : 'Sem dado',
        fonte: conv?.present ? 'api' : 'absent',
      },
      { rotulo: 'Shows (12 meses)', valor: String(Number(rev.showsPerYear) || 0), fonte: 'self' },
      {
        rotulo: 'Público pagante',
        valor: bruto.fazBilheteria ? (PAGANTE_LABELS[bruto.pagantePct] ?? '—') : 'Não faz bilheteria',
        fonte: 'self',
      },
      linhaDeMedida(ri, 'Seguidores Spotify', 'spotifyFollowers'),
    ];
  }

  const l = ri.components?.l ?? {};
  const playlists = l.playlists ?? {};
  const radio = l.radio ?? {};
  const execucoes = ri.raw?.radioAirplay180d;
  return [
    { rotulo: 'Prêmios', valor: PREMIOS_LABELS_V3[Number(bruto.premios ?? 0)] ?? '—', fonte: 'self' },
    {
      rotulo: 'Imprensa',
      valor: bruto.imprensaRepercussao ? (FREQ_LABELS[bruto.imprensaFrequencia] ?? 'Sim') : 'Não',
      fonte: 'self',
    },
    {
      rotulo: 'Playlists editoriais',
      // Consulta vazia ≠ consulta que não aconteceu (§4): a primeira é um zero que pesa, a
      // segunda é ausência que renormaliza os pesos. Dizer "0" nas duas apagaria a diferença.
      valor: playlists.present
        ? String(bruto.editorialPlaylists ?? cm?.playlists?.count ?? 0)
        : 'Sem dado',
      fonte: playlists.present ? 'api' : 'absent',
    },
    {
      rotulo: 'Execução em rádio',
      // Abaixo de 6 execuções em 180 dias o componente é AUSENTE, não zero (§9.5). Mostrar o
      // número mede a presença; "Sim" esconderia o tamanho dela.
      valor: radio.present && execucoes != null
        ? `${fmtNum(Math.round(Number(execucoes)))} execuções`
        : 'Sem dado',
      fonte: radio.present ? 'api' : 'absent',
    },
  ];
};

/** O engajamento, quando a API entregou. [SUSPENSO] no cálculo, exibido com rótulo (§8.2, §11.3.5). */
export const engajamentoExibido = (ri: Diagnostico | null | undefined) => {
  const e = ri?.engagement ?? {};
  return (['instagram', 'tiktok', 'youtube'] as const)
    .map((rede) => (e[rede] ? { rede, ...e[rede] } : null))
    .filter(Boolean) as { rede: 'instagram' | 'tiktok' | 'youtube'; value: number; cut: number; above: boolean }[];
};
