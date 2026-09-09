import fs from 'fs';
import path from 'path';

import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_TITULO, ALTURA_DO_TRANSPORTE, CORES_DAS_PISTAS,
  DS, ENCAIXE, LARGURA_DAS_FERRAMENTAS, LARGURA_DAS_PISTAS, PIXELS_POR_SEGUNDO, TIPOS_DE_PISTA,
  corDaPista,
} from '../pages/Catalog/daw/tokens';

// O EDITOR do Espaço JAM é o desenho do projeto de referência que o dono do produto deixou
// (`~/Downloads/Digital Audio WAVE`, `ProjectHomePageDAW.tsx` e `src/styles/tokens.ts`).
//
// Este teste é o que impede a cópia de virar aproximação. Os valores abaixo foram lidos daquele
// arquivo, à vírgula — e o dia em que alguém "arredondar" 88 para 90 ou trocar o laranja por
// azul da marca, a suíte diz onde estava escrito o contrário.
//
// ⚠️ ESTA TELA NÃO SEGUE O DESIGN SYSTEM CLARO DO RESTO DO PRODUTO, e é de propósito: um editor
// de música é escuro, denso e de contraste alto porque se olha para ele durante horas e o que
// interessa são formas de onda. Ableton, Logic, Pro Tools, Reaper — todos escuros.

const ler = (...partes: string[]) => fs.readFileSync(path.join(__dirname, '..', ...partes), 'utf8');

const editor = ler('pages', 'Catalog', 'daw', 'EditorDaGravacao.tsx');
const clipe = ler('pages', 'Catalog', 'daw', 'Clipe.tsx');
const casca = ler('pages', 'Catalog', 'daw', 'editor.module.scss');
const biblioteca = ler('pages', 'Catalog', 'daw', 'Biblioteca.tsx');

describe('cromo do editor do Espaço JAM', () => {
  // As dimensões da referência. São elas que dão à tela a densidade de um editor: uma faixa de
  // 160px cabe uma onda legível e cinco controlos no cabeçalho, e uma de 40 não cabe nada.
  it('as dimensões são as da referência', () => {
    expect(PIXELS_POR_SEGUNDO).toBe(60);
    expect(ALTURA_DA_PISTA).toBe(160);
    expect(ALTURA_DA_REGUA).toBe(30);
    expect(LARGURA_DAS_FERRAMENTAS).toBe(256);
    expect(LARGURA_DAS_PISTAS).toBe(256);
    expect(ALTURA_DO_TITULO).toBe(68);
    expect(ALTURA_DO_TRANSPORTE).toBe(62);
    // O encaixe do arrasto: um quarto de segundo.
    expect(ENCAIXE).toBe(0.25);
  });

  it('as cores são as da referência: escuro, com o azul na ação e o vermelho na agulha', () => {
    expect(DS.color.bgBase).toBe('#1a1a1e');
    expect(DS.color.bgPainel).toBe('#212127');
    expect(DS.color.bgPista).toBe('#2a2a32');
    expect(DS.color.primaria).toBe('#3b82f6');
    expect(DS.color.agulha).toBe('#ef4444');
  });

  it('a paleta das pistas dá a volta', () => {
    expect(CORES_DAS_PISTAS).toHaveLength(6);
    // A sétima pista repete a primeira, em vez de ficar sem cor.
    expect(corDaPista(6)).toBe(CORES_DAS_PISTAS[0]);
    // E um índice negativo não estoura o array.
    expect(corDaPista(-1)).toBe(CORES_DAS_PISTAS[5]);
  });

  it('os quatro tipos de pista existem, e o áudio é o primeiro', () => {
    expect(TIPOS_DE_PISTA.map((t) => t.valor)).toEqual(['audio', 'synth', 'piano', 'drums']);
  });

  // A tela é ESCURA. Um editor claro seria o único do mercado, e não por bom motivo.
  it('a tela é escura, e o fundo do corpo acompanha', () => {
    expect(editor).toContain('DS.color.bgBase');
    expect(casca).toContain('#1a1a1e');
  });

  // ⚠️ Quem faz o editor cobrir o app é o `display: none` na moldura, e não o z-index. O Espaço
  // JAM já teve 2147483000 aqui, e o número nunca fez nada.
  it('a moldura do app é escondida, e a camada sai do token', () => {
    expect(casca).toContain('body.jam-space-open .top-navigation');
    expect(casca).toContain('body.jam-space-open .app-rail');
    expect(casca).toContain('body.jam-space-open .mobile-nav');
    expect(casca).toContain('var(--z-tela-cheia)');
  });

  // As quatro zonas do desenho: biblioteca, cabeçalhos, régua e faixas. Sem uma delas não é um
  // editor — é um tocador com enfeites.
  it('as quatro zonas estão na tela', () => {
    expect(biblioteca).toContain('LARGURA_DAS_FERRAMENTAS');
    expect(editor).toContain('<Biblioteca');
    expect(editor).toContain('LARGURA_DAS_PISTAS');
    expect(editor).toContain('ALTURA_DA_REGUA');
    expect(editor).toContain('ALTURA_DA_PISTA');
  });

  // ⚠️ A pasta é lida NO NAVEGADOR e nada sobe até alguém arrastar. Enviar tudo o que a pessoa
  // abriu paga armazenamento e egress por ficheiros que ela nem ia usar, e enche a montagem de
  // pistas que ninguém pediu.
  it('a biblioteca pré-visualiza a pasta, e só o arrasto envia', () => {
    expect(biblioteca).toContain('webkitdirectory');
    expect(biblioteca).toContain('draggable');
    expect(biblioteca).toContain('Nada sobe para a nuvem enquanto você não');
    // E o lote continua a existir: um projeto de stems tem dez faixas, e uma a uma ninguém faz.
    expect(biblioteca).toContain('Enviar todos como pistas');
    expect(editor).toContain('largarNaFaixa');
  });

  // Os controlos que a referência mostra em cada pista, e o Master no topo.
  it('cada pista tem tipo, mudo, solo, volume e panorama; e há um Master', () => {
    expect(editor).toContain('Tipo da pista');
    expect(editor).toContain('Panorama de');
    expect(editor).toContain('Volume geral');
    // ⚠️ Mudo e solo em cores diferentes: são as duas ações mais usadas de uma mesa, e são
    // opostas. Pintadas iguais quando acesas, ninguém sabe qual carregou.
    expect(editor).toContain("botaozinho(calada, DS.color.textoFraco)");
    expect(editor).toContain("botaozinho(Boolean(daMesa?.solo), '#f59e0b')");
  });

  // As duas vistas da mesma montagem: a linha do tempo responde "o que toca quando", a mesa
  // responde "como isto soa junto".
  it('há as duas abas, e a mesa tem faders verticais', () => {
    expect(editor).toContain('Linha do tempo');
    expect(editor).toContain('MesaDeCanais');
    expect(editor).toContain("writingMode: 'vertical-lr'");
  });

  // O clipe é o que separa um editor de uma mesa: ele mora num INSTANTE.
  it('o clipe é posicionado no tempo, corta na agulha e some com clique duplo', () => {
    expect(clipe).toContain('inicio * escala');
    expect(clipe).toContain('agulha > inicio');
    expect(clipe).toContain('DIVIDIR');
    expect(clipe).toContain('onDoubleClick');
  });
});
