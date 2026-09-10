import { haQuantoTempo, legendaDaMusica } from '../legendaDaMusica';

// A legenda dizia "V1 · versão principal" em TODAS as linhas: a mesma frase em todas, que por
// isso não distinguia nenhuma — e falava de um modelo (versões) que saiu do produto.
//
// O que ela diz agora é o que muda de linha para linha: quem mexeu por último e há quanto
// tempo. Estes testes prendem as três coisas que isso pode estragar — mentir sobre o tempo,
// mostrar um nome sem contexto, e escrever separadores em volta de campos vazios.

const AGORA = new Date('2026-09-10T12:00:00.000Z').getTime();
const atras = (ms: number) => new Date(AGORA - ms).toISOString();

const MINUTO = 60_000;
const HORA = 3_600_000;
const DIA = 86_400_000;

describe('haQuantoTempo', () => {
  it('cobre as faixas, do minuto ao ano', () => {
    expect(haQuantoTempo(atras(10_000), AGORA)).toBe('agora mesmo');
    expect(haQuantoTempo(atras(5 * MINUTO), AGORA)).toBe('há 5 min');
    expect(haQuantoTempo(atras(3 * HORA), AGORA)).toBe('há 3 h');
    expect(haQuantoTempo(atras(DIA), AGORA)).toBe('ontem');
    expect(haQuantoTempo(atras(5 * DIA), AGORA)).toBe('há 5 dias');
    expect(haQuantoTempo(atras(60 * DIA), AGORA)).toBe('há 2 meses');
    expect(haQuantoTempo(atras(400 * DIA), AGORA)).toBe('há 1 ano');
  });

  // ⚠️ O relógio do computador de quem usa não é de confiança. Sem esta guarda, uma máquina
  // adiantada faz a lista dizer "há -3 dias" — e quem lê deixa de confiar no resto.
  it('data no futuro não vira tempo negativo', () => {
    expect(haQuantoTempo(new Date(AGORA + 3 * DIA).toISOString(), AGORA)).toBeNull();
  });

  it('sem data, ou com data ilegível, não inventa nada', () => {
    expect(haQuantoTempo(null, AGORA)).toBeNull();
    expect(haQuantoTempo(undefined, AGORA)).toBeNull();
    expect(haQuantoTempo('', AGORA)).toBeNull();
    expect(haQuantoTempo('não é uma data', AGORA)).toBeNull();
  });
});

describe('legendaDaMusica', () => {
  it('quem mexeu por último vem primeiro, com o tempo ao lado', () => {
    expect(legendaDaMusica({ last_edited_by: 'Ana', updated_at: atras(2 * DIA) }, AGORA))
      .toBe('Editado por Ana · há 2 dias');
  });

  // O nome sozinho não diz se foi hoje ou no ano passado — e é o "quando" que faz a lista
  // servir para retomar trabalho.
  it('sem nome, o tempo entra sozinho', () => {
    expect(legendaDaMusica({ updated_at: atras(3 * HORA) }, AGORA)).toBe('Editado há 3 h');
  });

  it('junta gênero e lançamento depois da edição', () => {
    const legenda = legendaDaMusica(
      { last_edited_by: 'Ana', updated_at: atras(DIA), genre: 'Axé', release_date: '2026-12-25' },
      AGORA,
    );
    expect(legenda).toBe('Editado por Ana · ontem · Axé · 25 de dez.');
  });

  // Sem isto a linha sai com separadores a apontar para o nada: "· Axé ·".
  it('campo vazio não deixa separador solto', () => {
    expect(legendaDaMusica({ genre: 'Rock' }, AGORA)).toBe('Rock');
    expect(legendaDaMusica({}, AGORA)).toBe('');
    expect(legendaDaMusica({ last_edited_by: '   ', updated_at: atras(DIA) }, AGORA))
      .toBe('Editado ontem');
  });

  // A frase antiga era igual em todas as linhas: dizia o modelo, não a música.
  it('não fala mais de versões', () => {
    const legenda = legendaDaMusica(
      { last_edited_by: 'Ana', updated_at: atras(DIA), genre: 'Pop' },
      AGORA,
    );
    expect(legenda).not.toContain('versão');
    expect(legenda).not.toMatch(/\bV\d/);
  });
});
