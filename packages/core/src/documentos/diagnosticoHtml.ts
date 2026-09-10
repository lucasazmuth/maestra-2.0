import {
  DIM_META, PROFILE_BITS, PROFILE_MAP, clean, fmtBRL, fmtNum, fmtPct,
} from '../constants/realCopy';
import { METODOLOGIA, QUEM_ASSINA, dimNarrative } from '../constants/realNarrative';
import { tierForAltas } from '../constants/realBadge';
import type { RealIndex } from '../interfaces/maestra';
import {
  CHAMADA_DA_DIMENSAO, LEGENDA_DO_DECLARADO, TINTA_DO_DOCUMENTO as T, URL_DA_MAESTRA,
  composicaoDaReceita, dinheiroRedondo, linhaDeAutoria, linhasDaDimensao, tintaDaDimensao,
  type Autoria,
} from './diagnostico';
import {
  FIXOS, INTRO_DA_DIMENSAO, LEITURA_DA_DIMENSAO, LEITURAS_CURTAS,
} from '../constants/realTextos';
import {
  comentariosDaDimensao, retratoDoPerfil, seloDaDimensao, statusDaBarra,
} from '../services/realEngine/comentarios';
import {
  AVISOS, ehLegado, GRUPOS_DA_CONTA, resumoDoE, SIIC_MENSAL,
} from '../services/realEngine/relatorio';

// O DECK do Diagnóstico REAL em HTML — o mesmo documento que a web baixa, montado como texto.
//
// A web captura o `DiagnosticDoc` (React) página a página e cola cada captura num PDF. No app
// não há DOM para capturar: o HTML daqui é impresso pelo `expo-print`, que produz PDF de
// verdade — com texto selecionável, e não uma foto da tela.
//
// As PÁGINAS e o conteúdo de cada uma são os mesmos dos dois lados (`documentos/diagnostico`
// guarda as tabelas e a procedência dos dados). `src/__tests__/documentoDoDiagnostico.test.ts`
// falha se uma página existir de um lado e não do outro.
//
// A folha é A4 em 96dpi (794×1123), a mesma medida do deck da web.

const escapar = (v: unknown): string => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface DadosDoDocumento {
  realIndex: RealIndex;
  chartmetric?: Record<string, any> | null;
  artistName: string;
  /** A foto do artista, em URL http(s) ou data URI. */
  avatarSrc?: string;
  autoria?: Autoria;
  /** Injetável para o teste: a data que sai na capa e no rodapé. */
  agora?: Date;
}

const ESTILO = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; }
  /*
    A folha é A4 (595×842pt). Em impressão o WebKit converte 1px em 0,75pt, então a página é
    desenhada em 793×1120px — 594,75×840pt, dentro da folha com uma sobra de menos de um ponto.
    Números maiores (os 794×1123px que o A4 tem a 96dpi) estouram a folha por frações de ponto,
    e cada página do deck vaza para uma segunda: o PDF sai com 24 páginas em vez de 12, metade
    delas em branco.

    O tamanho do PAPEL não vem daqui: a regra @page acima é ignorada na impressão do WKWebView,
    e quem manda é a chamada do expo-print (ver nucleo/documentos.ts, no app).
  */
  .pg {
    width: 793px; height: 1120px; background: #fff; color: ${T.body};
    padding: 60px 64px; display: flex; flex-direction: column; overflow: hidden;
    page-break-after: always; position: relative;
  }
  .pg:last-child { page-break-after: auto; }
  .cab { display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 22px; border-bottom: 1px solid ${T.line}; }
  .marca { font-weight: 800; font-size: 17px; color: ${T.ink}; letter-spacing: -0.01em; }
  .chapeu { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
    color: ${T.real}; }
  .corpo { flex: 1; display: flex; flex-direction: column; padding-top: 40px; }
  .rodape { display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
    font-size: 12px; color: ${T.mute}; letter-spacing: 0.04em; padding-top: 18px;
    border-top: 1px solid ${T.line}; }
  .autoria { flex: 1 1 auto; min-width: 0; text-align: center; font-size: 9.5px; letter-spacing: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .capa { justify-content: space-between; align-items: center; text-align: center; }
  .capaMeio { display: flex; flex-direction: column; align-items: center; }
  .capaFoto { width: 180px; height: 180px; border-radius: 50%; object-fit: cover;
    margin-bottom: 30px; }
  .capaChapeu { font-size: 14px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
    color: ${T.real}; margin-bottom: 14px; }
  .capaNome { font-weight: 800; font-size: 64px; line-height: 1.02; letter-spacing: -0.02em;
    margin-bottom: 22px; color: ${T.ink}; }
  .capaPerfil { font-size: 20px; color: ${T.dim}; }
  .capaPerfil b { color: ${T.real}; font-weight: 800; }
  .capaPe { font-size: 13px; color: ${T.mute}; letter-spacing: 0.04em; }
  .capaFonte { font-size: 11px; line-height: 1.5; color: ${T.mute}; max-width: 460px;
    margin-top: 10px; }
  .capaAutoria { font-size: 10px; line-height: 1.5; color: ${T.mute}; margin-top: 12px; }

  .perfilChapeu { font-size: 13px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase;
    color: ${T.real}; margin-bottom: 14px; }
  .perfilNome { font-weight: 800; font-size: 92px; line-height: 0.95; letter-spacing: -0.03em;
    margin-bottom: 24px; color: ${T.ink}; }
  .perfilDesc { font-size: 20px; line-height: 1.5; color: ${T.dim}; margin: 0 0 36px; max-width: 600px; }
  .padrao { display: flex; flex-wrap: wrap; gap: 18px 48px; padding: 26px 0;
    border-top: 1px solid ${T.line}; border-bottom: 1px solid ${T.line}; margin-bottom: 38px; }
  .padraoItem { display: flex; align-items: baseline; gap: 13px; }
  .padraoLetra { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700;
    font-size: 36px; line-height: 1; }
  .padraoPalavra { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
    color: ${T.dim}; }
  .revelaTitulo { font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: ${T.ink}; margin-bottom: 16px; }
  .revela { list-style: none; padding: 0; margin: 0; }
  .revela li { position: relative; padding-left: 22px; font-size: 18px; line-height: 1.5;
    color: ${T.dim}; margin-bottom: 16px; }
  .revela li:before { content: '▸'; position: absolute; left: 0; color: ${T.real}; }

  .secao { font-weight: 800; font-size: 40px; line-height: 1.1; margin-bottom: 34px;
    letter-spacing: -0.01em; color: ${T.ink}; }
  .nota { font-size: 15px; line-height: 1.6; color: ${T.mute}; margin-top: auto; }

  .dimCab { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
  .dimLetra { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 700;
    font-size: 54px; line-height: 1; }
  .dimTitulo { font-weight: 800; font-size: 30px; color: ${T.ink}; line-height: 1.15; }
  .dimTituloSub { font-weight: 600; font-size: 18px; color: ${T.mute}; }
  .dimTag { font-size: 14px; color: ${T.dim}; margin-top: 4px; }
  .dimNota { margin-left: auto; text-align: right; white-space: nowrap; }
  .dimSelo { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px; }
  .dimValor { display: block; font-weight: 800; font-size: 34px; color: ${T.ink}; line-height: 1; }
  .dimMax { font-size: 15px; font-weight: 700; color: ${T.mute}; }
  .regua { position: relative; height: 10px; border-radius: 9999px; background: #eaf0f8;
    overflow: hidden; margin-bottom: 8px; }
  .reguaCheia { height: 100%; border-radius: 9999px; }
  .dimEstado { font-size: 14px; color: ${T.mute}; margin-bottom: 20px; }
  /* No PDF a intro vem ABERTA (§2): aqui não há toque para expandir, e o documento é onde a
     explicação inteira cabe. */
  /* A página de leitura repete a letra e o nome da dimensão, para o leitor saber de quem ela é. */
  .dimCabLeitura { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .dimIntro { font-size: 11px; line-height: 1.5; color: ${T.mute}; margin: 0 0 12px; }
  /* A frase de leitura é a resposta curta da dimensão: barra à esquerda, como na maquete. */
  .dimLeitura { font-size: 12.5px; line-height: 1.55; color: ${T.ink}; margin: 0 0 14px;
    border-left: 3px solid ${T.real}; padding: 11px 14px; background: ${T.soft}; }
  .dimLinhas { display: flex; flex-direction: column; margin-bottom: 14px; }
  .dimLinha { display: flex; justify-content: space-between; align-items: baseline; padding: 9px 0;
    border-top: 1px solid ${T.line}; font-size: 15px; color: ${T.dim}; }
  .dimLinha:first-child { border-top: none; }
  .dimLinha b { color: ${T.ink}; font-size: 18px; font-weight: 800; }
  .adaga { color: ${T.mute}; font-size: 12px; }
  .fonteNota { font-size: 11.5px; line-height: 1.5; color: ${T.mute}; margin-bottom: 16px; }
  .aviso { font-size: 12.5px; line-height: 1.55; color: ${T.mute}; background: ${T.soft};
    border: 1px solid ${T.line}; border-radius: 12px; padding: 12px 14px; margin-bottom: 18px; }
  .bloco { margin-bottom: 18px; }
  .blocoTitulo { font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: ${T.ink}; margin-bottom: 10px; }
  /* O selo de "não entra no diagnóstico" (§11.3.5) anda junto do título do bloco informativo. */
  .blocoNota { font-size: 10.5px; font-weight: 600; letter-spacing: 0; text-transform: none;
    color: ${T.mute}; }
  /* A página "Onde a conta fecha": cartões de número e barras comparativas. */
  .tituloDaSecao { font-size: 26px; font-weight: 800; letter-spacing: -0.4px; color: ${T.ink};
    margin-bottom: 18px; }
  .contaGrade { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
  .contaCartao { flex: 1 1 150px; border: 1px solid ${T.line}; border-radius: 10px;
    padding: 12px 14px; background: ${T.soft}; }
  .contaRotulo { display: block; font-size: 10.5px; color: ${T.mute}; margin-bottom: 6px; }
  .contaValor { font-size: 17px; color: ${T.ink}; }
  .contaLinha { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .contaNome { flex: 0 0 150px; font-size: 11.5px; color: ${T.mute}; }
  .contaTrilho { flex: 1; height: 8px; border-radius: 9999px; background: ${T.line}; overflow: hidden; }
  .contaBarra { display: block; height: 100%; border-radius: 9999px; background: ${T.real}; }
  .contaNumero { flex: 0 0 90px; text-align: right; font-size: 11.5px; color: ${T.ink}; }
  .comp { display: flex; flex-wrap: wrap; gap: 10px 26px; }
  .compItem { display: flex; align-items: baseline; gap: 7px; }
  .compPct { font-weight: 800; font-size: 20px; color: ${T.ink}; }
  .compLabel { font-size: 14px; color: ${T.dim}; }
  .saude { display: flex; gap: 26px; margin-bottom: 10px; }
  .saudeItem { display: flex; flex-direction: column; }
  .saudeItem span { font-size: 13px; color: ${T.mute}; }
  .saudeItem b { font-size: 20px; font-weight: 800; color: ${T.ink}; }
  .pilulas { display: flex; gap: 8px; }
  .pilula { font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 9999px;
    border: 1px solid ${T.line}; color: ${T.mute}; }
  .pilulaOn { background: ${T.goldBg}; color: ${T.ink}; }
  .eng { display: flex; justify-content: space-between; font-size: 14px; color: ${T.dim};
    padding: 6px 0; }
  .revelaBloco { margin-top: auto; border-top: 1px solid ${T.line}; padding-top: 18px; }
  /* Na página de leitura o bloco vem logo abaixo da frase, e não empurrado para o pé: ali ele é
     o assunto da página, não o rodapé dela. */
  .revelaSolto { margin-top: 18px; }
  .revelaLead { font-weight: 800; font-size: 20px; color: ${T.ink}; margin-bottom: 10px;
    line-height: 1.3; }
  .revelaPara { font-size: 13.5px; line-height: 1.5; color: ${T.dim}; margin: 0 0 8px; }
  .revelaPara b { color: ${T.ink}; }

  .cidade { display: flex; align-items: center; gap: 18px; margin-bottom: 18px; }
  .cidadeNome { width: 200px; font-size: 18px; color: ${T.ink}; }
  .cidadeTrilho { flex: 1; height: 12px; background: #eaf0f8; border-radius: 9999px; overflow: hidden; }
  .cidadeBarra { height: 100%; border-radius: 9999px; background: ${T.ink}; }
  .cidadeVal { width: 90px; text-align: right; font-size: 16px; color: ${T.body}; font-weight: 700; }

  .lista { display: flex; align-items: center; gap: 14px; padding: 8px 0;
    border-top: 1px solid ${T.line}; }
  .listaEditorial { font-size: 10px; font-weight: 800; color: ${T.real}; letter-spacing: 0.06em; }
  .listaNome { flex: 1; font-size: 16px; font-weight: 600; color: ${T.ink}; }
  .listaVal { font-size: 14px; font-weight: 700; color: ${T.dim}; }

  .mapaLinha { display: flex; align-items: flex-start; gap: 18px; padding: 12px 0;
    border-top: 1px solid ${T.line}; }
  .mapaLinha:first-child { border-top: none; }
  .mapaTier { width: 96px; font-size: 13px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.04em; color: ${T.mute}; }
  .mapaChips { display: flex; flex-wrap: wrap; gap: 8px; }
  .mapaChip { font-size: 13px; font-weight: 700; color: ${T.dim}; padding: 6px 12px;
    border-radius: 9999px; background: #fff; border: 1px solid ${T.line}; }
  .mapaChipOn { color: #fff; background: ${T.real}; border-color: ${T.real}; font-weight: 800; }
  .mapaBits { font-size: 10px; letter-spacing: 0.08em; color: ${T.low}; margin-left: 6px; }
  .topo { display: flex; gap: 12px; align-items: flex-start; margin-top: 18px; padding: 14px;
    background: ${T.soft}; border: 1px solid ${T.line}; border-radius: 12px;
    font-size: 13px; line-height: 1.55; color: ${T.dim}; }
  .topoSelo { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; padding: 4px 8px;
    border-radius: 6px; background: ${T.goldBg}; color: ${T.ink}; }

  .metodoIntro { font-size: 17px; line-height: 1.5; color: ${T.dim}; margin: 0 0 18px; }
  .metodoGrade { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 18px; }
  .metodoCartao { width: calc(50% - 9px); background: ${T.soft}; border: 1px solid ${T.line};
    border-radius: 16px; padding: 22px; }
  .metodoLetra { display: inline-block; width: 38px; height: 38px; line-height: 38px;
    text-align: center; border-radius: 10px; background: #eef2f8; color: ${T.real};
    font-weight: 800; font-size: 19px; margin-bottom: 14px; }
  .metodoNome { font-weight: 800; font-size: 18px; margin-bottom: 7px; color: ${T.ink}; }
  .metodoDesc { font-size: 14.5px; line-height: 1.5; color: ${T.dim}; }

  .assinaNome { font-weight: 800; font-size: 40px; color: ${T.ink}; margin-bottom: 6px; }
  .assinaPapel { font-size: 16px; font-weight: 700; color: ${T.real}; margin-bottom: 22px; }
  .assinaPara { font-size: 15.5px; line-height: 1.65; color: ${T.dim}; margin: 0 0 14px; }
  .assinaDestaque { font-size: 16px; line-height: 1.6; font-weight: 700; color: ${T.ink};
    border-left: 3px solid ${T.real}; padding-left: 14px; margin-top: 8px; }

  .fim { justify-content: space-between; align-items: center; text-align: center; }
  .fimMeio { display: flex; flex-direction: column; align-items: center; max-width: 600px; }
  .fimChapeu { font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;
    color: ${T.real}; margin-bottom: 16px; }
  .fimTitulo { font-weight: 800; font-size: 44px; line-height: 1.1; color: ${T.ink};
    margin-bottom: 20px; letter-spacing: -0.02em; }
  .fimTexto { font-size: 17px; line-height: 1.6; color: ${T.dim}; margin: 0 0 28px; }
  .fimBotao { display: inline-block; font-size: 16px; font-weight: 800; color: #fff;
    background: ${T.ink}; padding: 14px 28px; border-radius: 9999px; text-decoration: none; }
`;

/** O cabeçalho e o rodapé de uma página interna. */
const moldura = (
  numero: number, total: number, chapeu: string, corpo: string, autoria?: Autoria, agora?: Date,
) => `
  <div class="pg">
    <div class="cab">
      <span class="marca">Maestra</span>
      ${chapeu ? `<span class="chapeu">${escapar(chapeu)}</span>` : ''}
    </div>
    <div class="corpo">${corpo}</div>
    <div class="rodape">
      <span>maestramanager.com</span>
      ${autoria ? `<span class="autoria">${escapar(linhaDeAutoria(autoria, agora))}</span>` : ''}
      <span>${numero} / ${total}</span>
    </div>
  </div>`;

/**
 * As páginas de uma dimensão: os números e a leitura.
 *
 * No legado é UMA página, e cabe. Da v4 em diante são DUAS, porque a página passou a carregar a
 * intro fixa, a frase de leitura e todos os comentários aplicáveis — junto com a tabela e os
 * avisos, isso passa de uma A4, e a A4 do PDF não pagina: o que sobra é cortado, calado.
 *
 * A divisão não é por medida de altura, é editorial e fixa: a primeira página é o RETRATO (nota,
 * régua, tabela, avisos e blocos), a segunda é a LEITURA (o que a dimensão significa, a frase do
 * seu caso e os comentários). Assim o número de páginas do deck é previsível, e nenhum artista
 * com muitos comentários estoura o papel.
 */
const paginasDaDimensao = (
  dk: 'r' | 'e' | 'a' | 'l', proxima: () => number, total: number, ri: any, cm: any,
  autoria?: Autoria, agora?: Date,
): string[] => {
  const meta = DIM_META.find((m) => m.key === dk)!;
  const alta = !!ri.pattern?.[dk];
  const topo = !!ri.dimTopIcon?.[dk];
  const nota = Math.max(0, Math.min(100, Math.round(Number(ri.boletim?.[dk] ?? 0))));
  const cor = tintaDaDimensao(alta, topo);
  const linhas = linhasDaDimensao(dk, ri, cm);
  const narrativa = dimNarrative(dk, ri);
  const inp = ri.inputs || {};
  const rev = ri.revenue || {};
  const comp = dk === 'e' ? composicaoDaReceita(ri) : [];
  const resumo = resumoDoE(ri);
  const legado = ehLegado(ri);
  // A v4 lê o SALDO ANUAL direto do motor; o legado ainda multiplica a base mensal por doze.
  const faturamento = resumo ? resumo.receitaAnual : Math.round(Number(rev.total ?? 0) * 12);
  const investimento = resumo ? resumo.investimentoAnual : Math.round(Number(inp.investimento ?? 0));
  const saldo = resumo ? resumo.saldo : faturamento - investimento;
  const temCnpj = resumo ? ri.raw?.temCnpj === true : !!inp.temCnpj;
  const temEmpresario = resumo ? ri.raw?.temEmpresario === true : !!inp.temEmpresario;
  const eng = ri.engagement || {};
  const temDeclarado = linhas.some((r) => r.declarado);

  const cabecalho = `
    <div class="dimCab">
      <span class="dimLetra" style="color:${cor}">${meta.letter}</span>
      <div>
        <div class="dimTitulo">${escapar(meta.full)}
          <span class="dimTituloSub">· ${escapar(meta.sub)}</span></div>
        <div class="dimTag">${escapar(CHAMADA_DA_DIMENSAO[dk])}</div>
      </div>
      <div class="dimNota">
        <span class="dimSelo" style="${topo
          ? `background:${T.goldBg};color:${T.goldInk}`
          : alta ? `background:${cor};color:#fff` : `background:#eef2f8;color:${T.body}`}">
          ${escapar(seloDaDimensao(ri, dk).rotulo)}</span>
        <span class="dimValor">${nota}<span class="dimMax">/100</span></span>
      </div>
    </div>

    <div class="regua">
      <div class="reguaCheia" style="width:${topo ? 100 : nota}%;background:${cor}"></div>
    </div>
    <div class="dimEstado">${escapar(statusDaBarra(ri, dk))}</div>

    <div class="dimLinhas">
      ${linhas.map((r) => `
        <div class="dimLinha">
          <span>${escapar(r.label)}${r.declarado ? '<span class="adaga">†</span>' : ''}</span>
          <b>${escapar(r.value)}</b>
        </div>`).join('')}
    </div>
    ${temDeclarado ? `<div class="fonteNota">${escapar(LEGENDA_DO_DECLARADO)}</div>` : ''}

    ${dk === 'e' ? `<div class="aviso">Receita, cachê e número de shows foram
      <b>informados por quem preencheu</b> este diagnóstico. A Maestra não tem como apurar
      faturamento e não verifica estes valores.</div>` : ''}

    ${dk === 'e' && resumo && resumo.saldo < 0
      ? `<div class="aviso">${escapar(AVISOS.saldoNegativo)}</div>` : ''}
    ${dk === 'e' && resumo?.fontes.some((f) => f.naoSei)
      ? `<div class="aviso"><b>Não informado:</b>
        ${escapar(resumo.fontes.filter((f) => f.naoSei).map((f) => f.rotulo).join(', '))}.
        ${escapar(AVISOS.naoSei)}</div>` : ''}
    ${dk === 'a' && !legado && ri.flags?.aSemBilheteria
      ? `<div class="aviso">${escapar(AVISOS.semBilheteria)}</div>` : ''}
    ${dk === 'l' && !legado && ri.flags?.travaL
      ? `<div class="aviso">${escapar(AVISOS.travaL)}</div>` : ''}

    ${/* Cachê, composição e saúde financeira saíram daqui na v4: são o corpo da página "Onde a
         conta fecha", e repetir os mesmos números duas vezes estourava esta página. O legado, que
         não tem aquela página, continua imprimindo os dois blocos que sempre teve. */ ''}
    ${dk === 'e' && !resumo && comp.length ? `<div class="bloco">
      <div class="blocoTitulo">Composição da receita</div>
      <div class="comp">${comp.map((s) => `<div class="compItem">
        <span class="compPct">${s.pct}%</span>
        <span class="compLabel">${escapar(s.label)}</span></div>`).join('')}</div>
    </div>` : ''}

    ${dk === 'e' && !resumo && (faturamento > 0 || investimento > 0) ? `<div class="bloco">
      <div class="blocoTitulo">Saúde financeira · 12 meses</div>
      <div class="saude">
        <div class="saudeItem"><span>Faturamento</span><b>${dinheiroRedondo(faturamento)}</b></div>
        <div class="saudeItem"><span>Investimento</span><b>${dinheiroRedondo(investimento)}</b></div>
        <div class="saudeItem"><span>Saldo</span>
          <b style="color:${saldo >= 0 ? T.real : T.danger}">
            ${saldo >= 0 ? '+' : '−'}${dinheiroRedondo(saldo)}</b></div>
      </div>
      <div class="pilulas">
        <span class="pilula ${temCnpj ? 'pilulaOn' : ''}">${temCnpj ? 'Com CNPJ' : 'Sem CNPJ'}</span>
        <span class="pilula ${temEmpresario ? 'pilulaOn' : ''}">${temEmpresario ? 'Com empresário' : 'Sem empresário'}</span>
      </div>
    </div>` : ''}

    ${dk === 'a' && (['instagram', 'tiktok', 'youtube'] as const).some((k) => eng[k])
      ? `<div class="bloco">
        <div class="blocoTitulo">Engajamento por rede${legado ? '' : ` <span class="blocoNota">${escapar(AVISOS.informativo)}</span>`}</div>
        ${(['instagram', 'tiktok', 'youtube'] as const).map((k) => {
          const e = eng[k];
          if (!e) return '';
          const nome = k === 'instagram' ? 'Instagram' : k === 'tiktok' ? 'TikTok' : 'YouTube';
          return `<div class="eng"><span>${nome}</span>
            <b>${fmtPct(e.value)}</b></div>`;
        }).join('')}
      </div>` : ''}

`;

  const leitura = `
    ${!legado ? `<div class="dimCabLeitura">
      <span class="dimLetra" style="color:${cor}">${meta.letter}</span>
      <div><div class="dimTitulo">${escapar(meta.full)}
        <span class="dimTituloSub">· ${escapar(meta.sub)}</span></div></div>
    </div>
    <div class="blocoTitulo">O que é esta frente</div>
    <p class="dimIntro">${escapar(INTRO_DA_DIMENSAO[dk])}</p>
    <p class="dimLeitura">${escapar(LEITURA_DA_DIMENSAO[dk][alta ? 'alto' : 'baixo'])}</p>` : ''}

    <div class="revelaBloco${legado ? '' : ' revelaSolto'}">
      <div class="revelaTitulo">O que isso revela</div>
      ${legado
        ? `<div class="revelaLead">${escapar(narrativa.headline)}</div>
           ${narrativa.paras.map((p) => `<p class="revelaPara">
             <b>${escapar(p.lead)}</b> ${escapar(p.body)}</p>`).join('')}`
        // No PDF saem TODOS os comentários aplicáveis (§4), e não os três da tela.
        // Os comentários da conta saem daqui quando existe a página de aprofundamento: lá eles
        // têm os números do lado, e no mesmo documento o parágrafo não pode aparecer duas vezes.
        : comentariosDaDimensao(ri, dk, { superficie: 'pdf', chartmetric: cm })
            .filter((c) => !(dk === 'e' && resumo && GRUPOS_DA_CONTA.includes(c.grupo)))
            .map((c) => `
            <p class="revelaPara"><b>${escapar(c.lead)}</b> ${escapar(c.corpo)}</p>`).join('')}
    </div>`;

  const titulo = `${meta.full} · ${meta.sub}`;
  // No legado as duas metades cabem juntas, e o deck continua com uma página por dimensão.
  if (legado) return [moldura(proxima(), total, titulo, cabecalho + leitura, autoria, agora)];
  return [
    moldura(proxima(), total, titulo, cabecalho, autoria, agora),
    moldura(proxima(), total, `${titulo} · a leitura`, leitura, autoria, agora),
  ];
};

/**
 * Monta o deck inteiro.
 *
 * A ordem é a mesma da web: capa, perfil, as quatro dimensões, cidades (se houver), plataformas
 * (se houver), os 16 perfis, metodologia, quem assina e o próximo passo.
 */
export function montarDocumentoDoDiagnostico({
  realIndex, chartmetric, artistName, avatarSrc, autoria, agora = new Date(),
}: DadosDoDocumento): string {
  const ri = realIndex as any;
  const perfil = realIndex.profile;
  const cidades = chartmetric?.top_cities as { name: string; country: string; listeners: number }[] | undefined;
  const playlists = chartmetric?.playlists as { count?: number; top?: { name: string; followers?: number; editorial?: boolean }[] } | undefined;
  const similares = chartmetric?.similar as unknown[] | undefined;
  const inp = ri.inputs || {};
  const hoje = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const temCidades = !!cidades?.length;
  const temPlataformas = !!(playlists?.top?.length || similares?.length);
  // A página "Onde a conta fecha" só existe quando há um resumo do E para aprofundar — ou seja,
  // não existe no legado, que não tem os custos decompostos.
  const temContaFecha = !!resumoDoE(ri);
  // 10 fixas + a segunda página de cada dimensão (só fora do legado) + as condicionais.
  const total = 10 + (ehLegado(ri) ? 0 : 4)
    + (temCidades ? 1 : 0) + (temPlataformas ? 1 : 0) + (temContaFecha ? 1 : 0);
  let n = 1; // a capa é a 1 e não leva número
  const proxima = () => (n += 1);

  const paginas: string[] = [];

  // 1 — CAPA
  paginas.push(`
    <div class="pg capa">
      <div class="marca">Maestra</div>
      <div class="capaMeio">
        ${avatarSrc ? `<img class="capaFoto" src="${escapar(avatarSrc)}" alt="">` : ''}
        <div class="capaChapeu">Diagnóstico de carreira</div>
        <div class="capaNome">${escapar(artistName)}</div>
        <div class="capaPerfil">Perfil <b>${escapar(perfil.name)}</b></div>
      </div>
      <div>
        <div class="capaPe">Índice REAL · metodologia Anita Carvalho · ${escapar(hoje)}</div>
        <div class="capaFonte">Alcance e engajamento medidos via Spotify e Chartmetric. Receita,
          agenda e reconhecimento conforme informado por quem preencheu o diagnóstico, sem
          verificação da Maestra.</div>
        ${autoria ? `<div class="capaAutoria">${escapar(linhaDeAutoria(autoria, agora))}
          ${autoria.vinculo ? `<br>Vínculo declarado com o artista: <b>${escapar(autoria.vinculo)}</b>` : ''}
        </div>` : ''}
      </div>
    </div>`);

  // 2 — O PERFIL
  paginas.push(moldura(proxima(), total, 'O seu perfil', `
    <div class="perfilChapeu">Seu perfil de carreira</div>
    <div class="perfilNome">${escapar(perfil.name)}</div>
    <p class="perfilDesc">${escapar(retratoDoPerfil(ri)?.texto ?? clean(perfil.description))}</p>
    <div class="padrao">
      ${DIM_META.map((d) => `<div class="padraoItem">
        <span class="padraoLetra" style="color:${ri.pattern?.[d.key] ? T.real : '#8492ac'}">${d.letter}</span>
        <span class="padraoPalavra">${escapar(d.full)}</span>
      </div>`).join('')}
    </div>
    ${/* §13.3 — o bloco de bullets saiu: o retrato acima e os comentários por dimensão cobrem
          o que ele dizia. O legado o mantém, porque lá não há retrato que o substitua. */ ''}
    ${ehLegado(ri) ? `<div class="revelaTitulo">O que o seu diagnóstico revela</div>
    <ul class="revela">
      ${(perfil.insights || []).map((it: string) => `<li>${escapar(clean(it))}</li>`).join('')}
    </ul>` : ''}`, autoria, agora));

  // 3–6 — AS DIMENSÕES
  DIM_META.forEach((d) => {
    paginas.push(...paginasDaDimensao(d.key as 'r' | 'e' | 'a' | 'l', proxima, total, ri, chartmetric ?? null, autoria, agora));
  });

  // 7 — ONDE A CONTA FECHA (só no PDF, §2)
  //
  // É o aprofundamento do E: o que a tela não comporta sem virar planilha. Aqui cabem a margem
  // por show, o ponto de equilíbrio, o cachê por tipo de contratante e a referência do setor —
  // os números que respondem "quantos shows eu preciso vender por ano".
  const contaFecha = resumoDoE(ri);
  if (temContaFecha && contaFecha) {
    const numero = (rotulo: string, valor: string) => `<div class="contaCartao">
      <span class="contaRotulo">${escapar(rotulo)}</span>
      <b class="contaValor">${escapar(valor)}</b></div>`;
    const barra = (rotulo: string, valor: number, teto: number, texto: string) => `<div class="contaLinha">
      <span class="contaNome">${escapar(rotulo)}</span>
      <span class="contaTrilho"><span class="contaBarra"
        style="width:${teto > 0 ? Math.max(2, Math.round((valor / teto) * 100)) : 2}%"></span></span>
      <b class="contaNumero">${escapar(texto)}</b></div>`;
    const tetoDoCache = Math.max(...contaFecha.cache.map((c) => c.valor), 1);
    const composicaoDoPdf = [
      { rotulo: 'Shows', valor: contaFecha.receitaShows },
      ...contaFecha.fontes.filter((f) => f.valor > 0).map((f) => ({ rotulo: f.rotulo, valor: f.valor })),
    ].filter((x) => x.valor > 0).sort((x, y) => y.valor - x.valor);
    const tetoDaComposicao = Math.max(...composicaoDoPdf.map((x) => x.valor), 1);
    const doE = comentariosDaDimensao(ri, 'e', { superficie: 'pdf', chartmetric: chartmetric ?? null });
    const soDaConta = doE.filter((c) => ['E7', 'E5', 'E8'].includes(c.grupo));

    paginas.push(moldura(proxima(), total, 'Aprofundamento', `
      <div class="tituloDaSecao">Onde a conta fecha</div>

      <div class="blocoTitulo">Saúde financeira · 12 meses</div>
      <div class="contaGrade">
        ${numero('Receita', dinheiroRedondo(contaFecha.receitaAnual))}
        ${numero('Custos e investimento', dinheiroRedondo(contaFecha.investimentoAnual))}
        <!-- ⚠️ O saldo ajustado não é exibido (v4.4, §12 e §13 item 15): é pontuação, não
             dinheiro. O efeito dele vive na nota e no estado da dimensão. -->
        ${numero('Saldo', `${contaFecha.saldo >= 0 ? '+' : '−'}${dinheiroRedondo(contaFecha.saldo)}`)}
        ${contaFecha.receitaLiquidaEstimada != null
          ? numero(`Receita líquida estimada (${contaFecha.aliquotaRotulo ?? ''})`, dinheiroRedondo(contaFecha.receitaLiquidaEstimada))
          : ''}
      </div>
      <div class="pilulas" style="margin:-8px 0 14px">
        <span class="pilula ${ri.raw?.temCnpj === true ? 'pilulaOn' : ''}">${ri.raw?.temCnpj === true ? 'Com CNPJ' : 'Sem CNPJ'}</span>
        <span class="pilula ${ri.raw?.temEmpresario === true ? 'pilulaOn' : ''}">${ri.raw?.temEmpresario === true ? 'Com empresário' : 'Sem empresário'}</span>
      </div>
      <div class="fonteNota" style="margin:0 0 14px">A média mensal do setor cultural formal é
        ${escapar(fmtBRL(SIIC_MENSAL))} (SIIC/IBGE). Este saldo equivale a
        ${escapar(contaFecha.vezesOSetor.toFixed(1).replace('.', ','))}× esse patamar.</div>

      ${contaFecha.margemPorShow != null ? `
        <div class="blocoTitulo">Margem por show e ponto de equilíbrio</div>
        <div class="contaGrade">
          ${numero('Cachê médio', dinheiroRedondo(contaFecha.cacheMedio))}
          ${numero('Custo médio por show', dinheiroRedondo(contaFecha.custoPorShow))}
          ${numero('Margem por show', dinheiroRedondo(contaFecha.margemPorShow))}
          ${numero('Shows pra cobrir o fixo do ano', contaFecha.pontoEquilibrioShows == null ? 'não fecha' : String(contaFecha.pontoEquilibrioShows))}
        </div>` : ''}

      ${contaFecha.cache.length ? `
        <div class="blocoTitulo">Cachê médio por tipo de contratante</div>
        ${contaFecha.cache.map((c) => barra(c.rotulo, c.valor, tetoDoCache, dinheiroRedondo(c.valor))).join('')}` : ''}

      ${composicaoDoPdf.length ? `
        <div class="blocoTitulo">Composição da receita anual</div>
        ${composicaoDoPdf.map((x) => barra(x.rotulo, x.valor, tetoDaComposicao, dinheiroRedondo(x.valor))).join('')}` : ''}

      ${soDaConta.length ? `<div class="revelaBloco">
        ${soDaConta.map((c) => `<p class="revelaPara"><b>${escapar(c.lead)}</b> ${escapar(c.corpo)}</p>`).join('')}
      </div>` : ''}
    `, autoria, agora));
  }

  // AUDIÊNCIA & ALCANCE
  if (temCidades) {
    const maior = cidades![0].listeners || 1;
    paginas.push(moldura(proxima(), total, 'Audiência & alcance', `
      <div class="secao">Onde seus ouvintes estão</div>
      ${cidades!.slice(0, 5).map((c) => `<div class="cidade">
        <span class="cidadeNome">${escapar(c.name)}</span>
        <span class="cidadeTrilho"><span class="cidadeBarra"
          style="display:block;width:${Math.max(8, Math.round((c.listeners / maior) * 100))}%"></span></span>
        <span class="cidadeVal">${fmtNum(c.listeners)}</span>
      </div>`).join('')}
      <p class="nota">Compare onde te ouvem com onde você toca: as praças com ouvintes mas sem show
        são público presencial já aquecido.</p>`, autoria, agora));
  }

  // PLATAFORMAS
  if (temPlataformas) {
    paginas.push(moldura(proxima(), total, 'Plataformas', `
      <div class="secao">Sua presença nas plataformas</div>
      ${playlists?.top?.length ? `<div class="bloco">
        <div class="blocoTitulo">Playlists onde sua música está${playlists.count ? ` · ${playlists.count} no total` : ''}</div>
        ${playlists.top.slice(0, 8).map((p) => `<div class="lista">
          ${p.editorial ? '<span class="listaEditorial">EDITORIAL</span>' : ''}
          <span class="listaNome">${escapar(p.name)}</span>
          ${p.followers != null ? `<span class="listaVal">${fmtNum(p.followers)}</span>` : ''}
        </div>`).join('')}
      </div>` : ''}
      <div class="bloco">
        <div class="blocoTitulo">Imprensa em detalhe</div>
        ${inp.imprensaRepercussao
          ? `<p class="revelaPara"><b>Você já apareceu na imprensa.</b> Esse tipo de cobertura é
              difícil de conseguir e pesa muito na legitimação: mostra que a sua história interessa
              além do nicho.</p>
             <p class="revelaPara">${inp.imprensaFrequencia === 'perene'
               ? '<b>Sua presença na mídia é constante.</b> Você aparece de forma perene, não só em lançamentos. Consistência é o que transforma imprensa em legitimação sustentada.'
               : '<b>Sua imprensa ainda é pontual.</b> Concentrada em lançamentos, ela vira legitimação sustentada quando ganha constância ao longo do ano.'}</p>`
          : `<p class="revelaPara"><b>A imprensa ainda não repercutiu o seu trabalho.</b> Presença em
              veículos é um capital que abre portas que números sozinhos não abrem, e costuma vir
              com estratégia de posicionamento.</p>`}
      </div>`, autoria, agora));
  }

  // OS 16 PERFIS
  paginas.push(moldura(proxima(), total, 'Os 16 perfis', `
    <div class="secao">Sua posição entre os 16 perfis</div>
    <p class="nota" style="margin:0 0 16px">Cada perfil é uma combinação das quatro dimensões.
      O seu está destacado.</p>
    ${PROFILE_MAP.map((andar, i) => {
      const altas = 4 - i;
      return `<div class="mapaLinha">
        <div class="mapaTier">${tierForAltas(altas)}<br>${altas} ${altas === 1 ? 'alta' : 'altas'}</div>
        <div class="mapaChips">
          ${andar.names.map((nome) => {
            const bits = PROFILE_BITS[nome];
            const marcados = bits
              ? (['r', 'e', 'a', 'l'] as const).filter((k) => bits[k]).map((k) => k.toUpperCase()).join('')
              : '';
            return `<span class="mapaChip ${nome === perfil.name ? 'mapaChipOn' : ''}">
              ${escapar(nome)}${marcados ? `<span class="mapaBits">${marcados}</span>` : ''}</span>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}
    <div class="topo">
      <span class="topoSelo">TOP</span>
      <div><b>Top Tier.</b> Quando uma dimensão atinge o nível de excelência (o topo absoluto da
        escala), ela ganha o selo Top Tier no seu diagnóstico. Vale para qualquer perfil e qualquer
        das quatro dimensões. Quando as quatro acendem em Top Tier ao mesmo tempo, o perfil é
        TOP ICON.</div>
    </div>`, autoria, agora));

  // METODOLOGIA
  paginas.push(moldura(proxima(), total, 'Metodologia', `
    <div class="secao">${escapar(METODOLOGIA.title)}</div>
    ${METODOLOGIA.intro.map((p) => `<p class="metodoIntro">${escapar(p)}</p>`).join('')}
    <div class="metodoGrade">
      ${METODOLOGIA.dims.map((m) => `<div class="metodoCartao">
        <span class="metodoLetra">${escapar(m.l)}</span>
        <div class="metodoNome">${escapar(m.t)}</div>
        <div class="metodoDesc">${escapar(m.d)}</div>
      </div>`).join('')}
    </div>
    <p class="nota">${escapar(METODOLOGIA.outro)}</p>`, autoria, agora));

  // QUEM ASSINA
  paginas.push(moldura(proxima(), total, 'Quem assina', `
    <div class="assinaNome">${escapar(QUEM_ASSINA.name)}</div>
    <div class="assinaPapel">${escapar(QUEM_ASSINA.role)}</div>
    ${QUEM_ASSINA.paras.map((p) => `<p class="assinaPara">${escapar(p)}</p>`).join('')}
    <p class="assinaDestaque">${escapar(QUEM_ASSINA.highlight)}</p>`, autoria, agora));

  // O PRÓXIMO PASSO
  paginas.push(`
    <div class="pg fim">
      <div class="marca">Maestra</div>
      <div class="fimMeio">
        <div class="fimChapeu">O próximo passo</div>
        <div class="fimTitulo">Você sabe onde está. Agora, para onde ir.</div>
        <p class="fimTexto">O diagnóstico é o retrato da sua carreira hoje. O planejamento completo
          com a Nyta transforma esse retrato em um plano de ação real: objetivos, estratégias
          priorizadas, cronograma e modelagem financeira, construídos com a metodologia que já
          orientou centenas de artistas.</p>
        <a class="fimBotao" href="${URL_DA_MAESTRA}">Comece seu planejamento com a Nyta</a>
      </div>
      <div class="capaPe">maestramanager.com</div>
    </div>`);

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Diagnóstico REAL · ${escapar(artistName)}</title>
    <style>${ESTILO}</style></head><body>${paginas.join('')}</body></html>`;
}
