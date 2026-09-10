import {
  ANDAMENTO_COMUM, outroAndamento, podeOuvirSozinho,
  type AnaliseDaVersao, type TrabalhoDeAudio,
} from '../audioJobs';

// O ANDAMENTO OUVIDO SOZINHO.
//
// O detector existe desde sempre e vivia escondido na ficha, atrás de um botão que era preciso
// descobrir. No Espaço JAM ele passa a acontecer por conta própria — e é aí que estas regras
// deixam de ser detalhe: análise custa CPU de verdade e tem cota de dez por mês, e um número
// que se instala sozinho por cima do trabalho de alguém apaga trabalho sem avisar.

const trabalho = (parte: Partial<TrabalhoDeAudio> = {}): TrabalhoDeAudio => ({
  id: 't', artist_id: 'a', version_id: 'v', tipo: 'bpm_tom', estado: 'pronto',
  resultado: null, erro: null, tentativas: 1,
  criado_em: '2026-09-10T00:00:00Z', iniciado_em: null, terminado_em: null,
  ...parte,
});

const analise = (parte: Partial<AnaliseDaVersao> = {}): AnaliseDaVersao => ({
  id: 'x', version_id: 'v', arquivo_sha256: 'sha', motor: 'essentia',
  bpm: 128, bpm_confianca: 0.9, tom: 'C', tom_escala: 'major', tom_confianca: 0.8,
  duracao_segundos: 180, caracteristicas: null, criado_em: '2026-09-10T00:00:00Z',
  ...parte,
});

const pronta = {
  temAudio: true, bpmEscrito: '', analise: null, trabalhos: [], podeEditar: true,
};

describe('podeOuvirSozinho', () => {
  it('gravação com áudio, campo vazio e nada pedido antes: ouve', () => {
    expect(podeOuvirSozinho(pronta)).toBe(true);
  });

  // ⚠️ PREENCHER UM VAZIO NÃO É SOBRESCREVER. Quem escreveu 92 à mão sabe o que fez, e um
  // detector que discorda está errado por definição: o andamento da obra é o que o autor diz.
  it('com andamento escrito, não mexe', () => {
    expect(podeOuvirSozinho({ ...pronta, bpmEscrito: '92' })).toBe(false);
    expect(podeOuvirSozinho({ ...pronta, bpmEscrito: 92 })).toBe(false);
    // Espaço em branco não é andamento: continua vazio.
    expect(podeOuvirSozinho({ ...pronta, bpmEscrito: '  ' })).toBe(true);
  });

  // ⚠️ UMA VEZ POR GRAVAÇÃO, e a memória é o próprio banco. Sem isto, cada recarga da página
  // enfileirava outro trabalho e a cota de dez por mês evaporava numa tarde.
  it('basta ter havido um pedido, em qualquer estado, para nunca mais pedir sozinho', () => {
    for (const estado of ['pronto', 'erro', 'cancelado', 'na_fila', 'a_correr'] as const) {
      expect(podeOuvirSozinho({ ...pronta, trabalhos: [trabalho({ estado })] })).toBe(false);
    }
    // Já haver uma análise guardada é a mesma coisa: não se pede o que já se sabe.
    expect(podeOuvirSozinho({ ...pronta, analise: analise() })).toBe(false);
  });

  // Um trabalho de outro tipo não conta: pedir a letra não é ter pedido o andamento.
  it('trabalho de outro tipo não impede', () => {
    expect(podeOuvirSozinho({ ...pronta, trabalhos: [trabalho({ tipo: 'letra' })] })).toBe(true);
  });

  it('sem áudio não há o que ouvir', () => {
    expect(podeOuvirSozinho({ ...pronta, temAudio: false })).toBe(false);
  });

  // ⚠️ QUEM SÓ OLHA NÃO GASTA A COTA DE QUEM PAGA. A cota é do dono do artista, e um convidado
  // a abrir o projeto dispararia análises na conta dele sem nunca saber.
  it('quem não pode editar não dispara análise', () => {
    expect(podeOuvirSozinho({ ...pronta, podeEditar: false })).toBe(false);
  });
});

describe('outroAndamento', () => {
  // ⚠️ O ERRO CLÁSSICO DE QUALQUER DETECTOR não é falta de certeza, é ambiguidade real: um trap
  // a 140 e o mesmo trap contado em meio-tempo a 70 têm exatamente as mesmas batidas.
  it('oferece a metade quando ela é uma música plausível', () => {
    expect(outroAndamento(170)).toBe(85);
    expect(outroAndamento(140)).toBe(70);
  });

  it('oferece o dobro quando é ele que cai na faixa', () => {
    expect(outroAndamento(60)).toBe(120);
    expect(outroAndamento(75)).toBe(150);
  });

  // 128 não tem alternativa: 64 é lento demais e 256 é rápido demais para serem uma música.
  it('sem alternativa plausível, não oferece nada', () => {
    expect(outroAndamento(128)).toBeNull();
    expect(outroAndamento(100)).toBeNull();
  });

  it('nunca oferece as duas: dentro da faixa, só uma cabe', () => {
    for (let bpm = 20; bpm <= 400; bpm += 1) {
      const outro = outroAndamento(bpm);
      if (outro === null) continue;
      expect(outro === Math.round(bpm / 2) || outro === Math.round(bpm * 2)).toBe(true);
      expect(outro).toBeGreaterThanOrEqual(ANDAMENTO_COMUM.minimo);
      expect(outro).toBeLessThanOrEqual(ANDAMENTO_COMUM.maximo);
    }
  });

  it('sem andamento não há outro', () => {
    expect(outroAndamento(null)).toBeNull();
    expect(outroAndamento(undefined)).toBeNull();
    expect(outroAndamento('')).toBeNull();
    expect(outroAndamento('abc')).toBeNull();
    expect(outroAndamento(0)).toBeNull();
  });
});
