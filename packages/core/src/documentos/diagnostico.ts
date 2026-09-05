import {
  DIM_META, FREQ_LABELS, PAGANTE_LABELS, PREMIOS_LABELS_V3, VINCULO_LABELS, fmtBRL, fmtNum,
} from '../constants/realCopy';

// O DOCUMENTO do Diagnóstico REAL — a parte que não é desenho.
//
// O deck em PDF existe nas duas superfícies: na web ele é capturado de um componente React
// (`src/pages/ArtistCreate/DiagnosticDoc.tsx`), no app ele é impresso a partir de HTML. O que os
// dois PRECISAM ter igual são os NÚMEROS e os RÓTULOS de cada linha — um "Cachê médio" que sai
// de um jeito num PDF e de outro no outro é o mesmo documento contando duas histórias.
//
// Por isso as tabelas de cada dimensão, a composição da receita, a procedência dos dados e a
// linha de autoria moram aqui.

/**
 * Quem gerou o documento.
 *
 * POR QUE EXISTE: qualquer pessoa pode criar um perfil de qualquer artista e preencher o
 * questionário com números inventados. O PDF sai com a marca da Maestra e circula por e-mail e
 * WhatsApp. Sem autoria no papel, não há como responsabilizar quem produziu. O `docId` é
 * determinístico (mesmo diagnóstico, mesmo id), então serve de referência para o suporte.
 */
export interface Autoria { nome: string; email: string; docId: string; vinculo?: string }

/** Uma linha da tabela de uma dimensão. `declarado` marca o que veio do questionário. */
export type LinhaDoDocumento = { label: string; value: string; declarado?: boolean };

/** O nome de exibição de cada fonte de receita. */
export const FONTE_DE_RECEITA: Record<string, string> = {
  streaming: 'Streaming', direitos: 'Direitos', publi: 'Publicidade', aulas: 'Aulas',
  editais: 'Editais', venda: 'Venda / merch', outros: 'Outros',
};

/** A frase de uma linha embaixo do nome de cada dimensão. */
export const CHAMADA_DA_DIMENSAO: Record<'r' | 'e' | 'a' | 'l', string> = {
  r: 'O quanto a sua música alcança gente no digital.',
  e: 'O quanto a sua carreira fatura com música.',
  a: 'O público que aparece, paga ingresso e se conecta de verdade.',
  l: 'O reconhecimento do setor: imprensa, prêmios, plataformas.',
};

/**
 * A escala do papel: tinta cinza-azulada sobre branco.
 *
 * O deck NÃO usa cor para diferenciar estado — quem faz isso é o peso da tipografia e o
 * preenchimento da régua. Os tons do tema escuro (`#21b26e`, `#f5c451`) sumiam no papel.
 */
export const TINTA_DO_DOCUMENTO = {
  ink: '#2c3f63',
  body: '#405985',
  dim: '#56698f',
  mute: '#61749a',
  line: '#e3eaf3',
  soft: '#f7f9fc',
  real: '#2c3f63',
  low: '#8b9ab4',
  goldInk: '#2c3f63',
  goldBg: '#eef2f8',
  danger: '#405985',
} as const;

export const LEGENDA_DO_DECLARADO =
  '† Informado por quem preencheu o diagnóstico. A Maestra não verifica estes dados.';

/** O destino do botão clicável da última página. */
export const URL_DA_MAESTRA = 'https://www.maestramanager.com';

export const dinheiroRedondo = (n: number) => `R$ ${fmtNum(Math.abs(Math.round(n)))}`;

/**
 * PROCEDÊNCIA DO DADO.
 *
 * Alcance e engajamento vêm da API (Spotify/Chartmetric) e ninguém mexe neles. Receita, cachê,
 * shows, público pagante, prêmios e imprensa são autorrelato do questionário. Sem essa distinção
 * no papel, quem recebe o PDF lê "Receita mensal R$ 134,4 mi" como número apurado por nós — e é
 * aí que um diagnóstico forjado ganha aparência de laudo.
 */
const declarado = (r: LinhaDoDocumento): LinhaDoDocumento => ({ ...r, declarado: true });

/** O rodapé de autoria: curto, para caber numa linha entre o domínio e o número da página. */
export const linhaDeAutoria = (a: Autoria, agora = new Date()) =>
  `Gerado por ${a.nome} · ${a.email} · `
  + `${agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · Doc ${a.docId}`;

/** As linhas da tabela de uma dimensão (V3). */
export function linhasDaDimensao(
  dk: 'r' | 'e' | 'a' | 'l', ri: any, cm: any,
): LinhaDoDocumento[] {
  const inp = ri.inputs || {};
  const rev = ri.revenue || {};
  const numeroOu = (n: number | null | undefined) => (n != null ? fmtNum(Number(n)) : null);

  const linhas: (LinhaDoDocumento | null)[] = dk === 'r'
    ? [
      { label: 'Ouvintes Spotify', value: numeroOu(cm?.monthly_listeners ?? inp.spotifyListeners) ?? '–' },
      inp.igFollowers != null ? { label: 'Instagram', value: fmtNum(inp.igFollowers) } : null,
      inp.tiktokFollowers != null ? { label: 'TikTok', value: fmtNum(inp.tiktokFollowers) } : null,
      inp.youtubeMonthlyViews != null ? { label: 'YouTube mensal', value: fmtNum(inp.youtubeMonthlyViews) } : null,
    ]
    : dk === 'e'
      ? [
        declarado({ label: 'Receita mensal', value: fmtBRL(Number(rev.total ?? 0)) }),
        declarado({ label: 'Shows / mês', value: String(inp.showsPerMonth ?? 0) }),
        declarado({ label: 'Cachê médio', value: fmtBRL(Number(inp.cache ?? 0)) }),
      ]
      : dk === 'a'
        ? [
          declarado({ label: 'Shows / mês', value: String(inp.showsPerMonth ?? 0) }),
          declarado({
            label: '% público pagante',
            value: inp.fazBilheteria ? (PAGANTE_LABELS[inp.pagantePct] ?? '–') : 'Não faz bilheteria',
          }),
          inp.spotifyFollowers != null ? { label: 'Seguidores Spotify', value: fmtNum(inp.spotifyFollowers) } : null,
          inp.deezerFans != null ? { label: 'Fãs Deezer', value: fmtNum(inp.deezerFans) } : null,
        ]
        : [
          declarado({ label: 'Prêmios', value: PREMIOS_LABELS_V3[Number(inp.premios ?? 0)] ?? '–' }),
          declarado({
            label: 'Imprensa',
            value: inp.imprensaRepercussao ? (FREQ_LABELS[inp.imprensaFrequencia] ?? 'Sim') : 'Não',
          }),
          { label: 'Playlists editoriais', value: String(inp.editorialPlaylists ?? cm?.playlists?.count ?? 0) },
          // Nulo é ausência de DADO, não ausência de execução; com dado, mostra o número.
          {
            label: 'Execução em rádio',
            value: inp.radioAirplay == null
              ? 'Sem dado'
              : Number(inp.radioAirplay) > 0
                ? `${fmtNum(Math.round(Number(inp.radioAirplay)))} execuções`
                : 'Não',
          },
        ];

  return linhas.filter((r): r is LinhaDoDocumento => r != null);
}

/** A composição da receita, em porcentagem e da maior para a menor. */
export function composicaoDaReceita(ri: any): { label: string; pct: number }[] {
  const rev = ri.revenue || {};
  const partes: { label: string; value: number }[] = [];
  if (Number(rev.shows) > 0) partes.push({ label: 'Shows', value: Number(rev.shows) });
  Object.entries(rev.sources || {}).forEach(([k, v]) => {
    if (Number(v) > 0) partes.push({ label: FONTE_DE_RECEITA[k] || k, value: Number(v) });
  });
  const total = partes.reduce((s, x) => s + x.value, 0);
  if (!total) return [];
  return partes
    .sort((a, b) => b.value - a.value)
    .map((s) => ({ label: s.label, pct: Math.round((s.value / total) * 100) }));
}

/** A cor da letra e da régua de uma dimensão, conforme o estado. */
export const tintaDaDimensao = (alta: boolean, topo: boolean) =>
  (topo ? TINTA_DO_DOCUMENTO.goldInk : alta ? TINTA_DO_DOCUMENTO.real : TINTA_DO_DOCUMENTO.low);

/** As quatro dimensões, na ordem do documento. */
export const DIMENSOES_DO_DOCUMENTO = DIM_META;

/**
 * Monta a autoria a partir da sessão e do diagnóstico.
 *
 * O `docId` é DETERMINÍSTICO: sai do perfil mais o instante em que o diagnóstico foi CALCULADO,
 * que já está salvo. Duas exportações da mesma entrega geram o mesmo id, então ele serve de
 * referência estável quando alguém traz um PDF para o suporte conferir — e é o mesmo id nas duas
 * superfícies, que é o que faz dele uma referência.
 *
 * Sem e-mail na sessão não há autoria: não há o que afirmar sobre quem gerou.
 */
export function autoriaDoDocumento(entrada: {
  email?: string | null;
  nome?: string | null;
  artistId?: string | null;
  /** `realIndex.computedAt` — o instante do cálculo, não o do download. */
  calculadoEm?: string | null;
  /** O vínculo declarado com o artista (`content.titularidade.vinculo`). */
  vinculo?: string | null;
}): Autoria | undefined {
  const email = entrada.email?.trim();
  if (!email) return undefined;
  const carimbo = Date.parse(String(entrada.calculadoEm ?? '')) || 0;
  return {
    nome: entrada.nome?.trim() || email.split('@')[0],
    email,
    docId: `${(entrada.artistId || 'sem-perfil').slice(0, 8)}-${carimbo.toString(36)}`.toUpperCase(),
    vinculo: entrada.vinculo ? (VINCULO_LABELS[entrada.vinculo] ?? entrada.vinculo) : undefined,
  };
}
