import {
  aindaAndando, bpmLegivel, CONFIANCA_BAIXA, tomInseguro, tomLegivel,
  type AnaliseDaVersao, type TrabalhoDeAudio,
} from '@maestra/core/services/db/audioJobs';

// A ANÁLISE DE ÁUDIO, do lado do cliente.
//
// O que se testa aqui é a tradução entre o que a máquina devolve e o que a pessoa lê — e, acima
// de tudo, a regra de que um palpite não pode ter a mesma cara de uma resposta.
//
// O que NÃO se testa aqui: a deteção em si. Ela corre no worker, com o essentia, fora deste
// repositório de testes. Ver `apps/audio-worker/`.

const trabalho = (estado: TrabalhoDeAudio['estado']): TrabalhoDeAudio => ({
  id: 't', artist_id: 'a', version_id: 'v', tipo: 'bpm_tom', estado,
  resultado: null, erro: null, tentativas: 1,
  criado_em: '2026-09-09T00:00:00Z', iniciado_em: null, terminado_em: null,
});

const analise = (tom_confianca: number | null): Pick<AnaliseDaVersao, 'tom_confianca'> =>
  ({ tom_confianca });

describe('quando ainda há o que esperar', () => {
  it('conta o que está na fila e o que está a correr', () => {
    expect(aindaAndando(trabalho('na_fila'))).toBe(true);
    expect(aindaAndando(trabalho('a_correr'))).toBe(true);
  });

  it('não conta o que já acabou, bem ou mal', () => {
    // É isto que faz a sondagem de resgate parar. Contar 'pronto' como andando deixaria a tela
    // a pedir a mesma coisa ao servidor de cinco em cinco segundos, para sempre.
    expect(aindaAndando(trabalho('pronto'))).toBe(false);
    expect(aindaAndando(trabalho('erro'))).toBe(false);
    expect(aindaAndando(null)).toBe(false);
    expect(aindaAndando(undefined)).toBe(false);
  });
});

describe('o tom, na forma em que se escreve', () => {
  it('junta a escala menor à nota', () => {
    expect(tomLegivel('A', 'minor')).toBe('Am');
    expect(tomLegivel('C', 'major')).toBe('C');
  });

  it('sem nota, não inventa nada', () => {
    expect(tomLegivel(null, 'minor')).toBe('');
    expect(tomLegivel('', 'major')).toBe('');
  });
});

describe('o BPM, como se anota na ficha', () => {
  it('arredonda para inteiro', () => {
    // O detector devolve 127,8 e ninguém escreve isso num campo de BPM.
    expect(bpmLegivel(127.8)).toBe('128');
    expect(bpmLegivel(90)).toBe('90');
  });

  it('devolve vazio no que não é um BPM', () => {
    // Vazio, e não "0" nem "NaN": os dois iriam parar ao campo do artista se ele tocasse em
    // "usar", e "0 BPM" é pior do que campo em branco.
    expect(bpmLegivel(null)).toBe('');
    expect(bpmLegivel(0)).toBe('');
    expect(bpmLegivel('nada')).toBe('');
  });
});

describe('a ressalva do tom', () => {
  // ⚠️ ESTA É A REGRA QUE MAIS IMPORTA DESTE ARQUIVO.
  //
  // O `KeyExtractor` confunde relativa maior com menor a toda a hora, porque Am e C têm as
  // mesmas notas. Um palpite mostrado com a mesma cara de um BPM — que é bem mais confiável —
  // engana quem lê, e é o artista que leva o erro para a ficha.
  it('avisa quando a certeza é baixa', () => {
    expect(tomInseguro(analise(0.4))).toBe(true);
  });

  it('não avisa quando a certeza é alta', () => {
    expect(tomInseguro(analise(0.9))).toBe(false);
  });

  it('trata a ausência de confiança como confiança, e não como dúvida', () => {
    // Análise antiga, gravada antes de a coluna existir: sem número, não há motivo para pôr uma
    // ressalva em algo sobre o qual não se sabe nada.
    expect(tomInseguro(analise(null))).toBe(false);
    expect(tomInseguro(null)).toBe(false);
  });

  it('o limiar é o do núcleo, e não um número solto em cada tela', () => {
    // Nasceu duplicado no app e na web. Duas cópias de um limiar divergem no primeiro ajuste, e
    // aí a mesma análise vira palpite num lado e resposta no outro.
    expect(tomInseguro(analise(CONFIANCA_BAIXA - 0.001))).toBe(true);
    expect(tomInseguro(analise(CONFIANCA_BAIXA))).toBe(false);
  });
});
