import { COR } from '@maestra/core/constants/design';

// O CROMO do wizard.
//
// A web declara estes valores como tokens `--wz-*` no topo de `src/pages/Wizard/styles.scss`, e
// eles governam a tela inteira — as bolhas, os cartões, os chips, a régua da priorização. Aqui
// eles viram um objeto; `src/__tests__/cromoDoWizard.test.ts` compara os dois.
//
// Não é o `COR` geral do app de propósito: o wizard tem uma escala própria, com cinzas mais
// frios e um azul-tinta que só existe aqui.
export const WZ = {
  blue: COR.primaria,
  blueInk: '#4267b9',
  blueSoft: '#eaf0ff',
  blueTint: 'rgba(51, 97, 255, 0.08)',
  /** Títulos e texto forte. */
  ink: '#52668d',
  /** Corpo. */
  text: '#61749a',
  /** Secundário. */
  muted: '#8e9eb8',
  /** Espaço reservado e desabilitado. */
  faint: '#aebbd0',
  /** Texto secundário LEGÍVEL — micro-rótulos, barra da etapa. */
  quiet: '#5f7191',
  quietStrong: '#5a6c8c',
  /** Pontos e marcadores. */
  marker: '#7f90ad',
  line: '#e8edf5',
  line2: '#dce4f0',
  surface: '#ffffff',
  /** Preenchimento sutil: bolha da Nyta, trilhos. */
  surface2: '#f5f7fb',
  canvas: '#fafbfc',
  danger: '#f13131',
  /** Âmbar escurecido o bastante para carregar texto branco (SWOT). */
  warn: '#b0720f',
  ok: '#29cc39',
  /** O contorno da bolha, que a folha escreve solto na regra da `.nyta-bubble`. */
  bolhaContorno: '#e3eaf3',
} as const;

/** As medidas que a folha guarda como tokens, e que o celular usa. */
export const WZ_MEDIDA = {
  /** Recuo lateral do chat no celular (`--wiz-gutter-m`). */
  recuo: 14,
  /** Avatar da Nyta no fio da conversa (`--wiz-avatar`). */
  avatar: 26,
} as const;
