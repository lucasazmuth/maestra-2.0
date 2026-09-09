import fs from 'fs';
import path from 'path';

import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_TOPO, CORES_DAS_PISTAS, DS, ENCAIXE,
  LARGURA_DA_LATERAL, ZOOM_PADRAO, corDaPista,
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

describe('cromo do editor do Espaço JAM', () => {
  // As dimensões da referência. São elas que dão à tela a densidade de um editor: uma faixa de
  // 88px cabe uma onda legível, e uma de 40 não.
  it('as dimensões são as da referência', () => {
    expect(ZOOM_PADRAO).toBe(80);
    expect(ALTURA_DA_PISTA).toBe(88);
    expect(ALTURA_DA_REGUA).toBe(32);
    expect(LARGURA_DA_LATERAL).toBe(220);
    expect(ALTURA_DO_TOPO).toBe(116);
    // O encaixe do arrasto: um quarto de segundo.
    expect(ENCAIXE).toBe(0.25);
  });

  it('as cores de fundo e de texto são as da referência', () => {
    expect(DS.color.bgBase).toBe('#0E0E0E');
    expect(DS.color.bgSurface).toBe('#141414');
    expect(DS.color.bgRaised).toBe('#1A1A1A');
    expect(DS.color.textPrimary).toBe('#E8E8F0');
    expect(DS.color.textTertiary).toBe('#6B6B80');
    // O laranja é a ação, a agulha e o corte; o verde é o play.
    expect(DS.color.primary).toBe('#E95216');
    expect(DS.color.success).toBe('#33EB28');
  });

  it('a paleta das pistas é a da referência, e dá a volta', () => {
    expect(CORES_DAS_PISTAS).toEqual(['#E95216', '#AEE916', '#33EB28', '#14B4FF', '#FFD727', '#FF272A']);
    // A sétima pista repete a primeira, em vez de ficar sem cor.
    expect(corDaPista(6)).toBe(CORES_DAS_PISTAS[0]);
    // E um índice negativo não estoura o array.
    expect(corDaPista(-1)).toBe(CORES_DAS_PISTAS[5]);
  });

  // A tela é ESCURA. Um editor claro seria o único do mercado, e não por bom motivo.
  it('a tela é escura, e o fundo do corpo acompanha', () => {
    expect(editor).toContain('DS.color.bgBase');
    expect(casca).toContain('#0e0e0e');
  });

  // ⚠️ Quem faz o editor cobrir o app é o `display: none` na moldura, e não o z-index. O Espaço
  // JAM já teve 2147483000 aqui, e o número nunca fez nada.
  it('a moldura do app é escondida, e a camada sai do token', () => {
    expect(casca).toContain('body.jam-space-open .top-navigation');
    expect(casca).toContain('body.jam-space-open .app-rail');
    expect(casca).toContain('var(--z-tela-cheia)');
  });

  // As três zonas do editor. Sem uma delas não é um editor — é um tocador com enfeites.
  it('as três zonas estão na tela: lateral, régua e faixas', () => {
    expect(editor).toContain('LARGURA_DA_LATERAL');
    expect(editor).toContain('ALTURA_DA_REGUA');
    expect(editor).toContain('ALTURA_DA_PISTA');
  });

  // O clipe é o que separa um editor de uma mesa: ele mora num INSTANTE, e é por isso que a sua
  // posição na tela sai de `start_seconds × escala`.
  it('o clipe é posicionado no tempo, e a tesoura corta na agulha', () => {
    expect(clipe).toContain('inicio * escala');
    expect(clipe).toContain('agulha > inicio');
    expect(clipe).toContain('DIVIDIR');
  });
});
