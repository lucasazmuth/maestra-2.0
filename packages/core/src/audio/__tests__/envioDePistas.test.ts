import { MAXIMO_DE_PISTAS } from '../../constants/maestra';
import { validarPistas } from '../envioDePistas';

// O que entra e o que não entra, antes de gastar rede.

const MB = 1024 * 1024;

describe('a validação do lote', () => {
  it('aceita MP3 e WAV, recusa o resto pelo formato', () => {
    const { aceites, recusados } = validarPistas(
      [{ nome: 'voz.wav' }, { nome: 'bateria.mp3' }, { nome: 'baixo.aiff' }],
      0,
    );
    expect(aceites.map((a) => a.nome)).toEqual(['voz.wav', 'bateria.mp3']);
    expect(recusados).toEqual([{ nome: 'baixo.aiff', motivo: 'formato não aceito — use MP3 ou WAV' }]);
  });

  it('recusa o que é grande demais', () => {
    const { aceites, recusados } = validarPistas(
      [{ nome: 'ok.wav', tamanho: 40 * MB }, { nome: 'enorme.wav', tamanho: 90 * MB }],
      0,
    );
    expect(aceites.map((a) => a.nome)).toEqual(['ok.wav']);
    expect(recusados[0].motivo).toBe('maior que 60 MB');
  });

  // ⚠️ A contagem inclui o que já foi aceito NESTA leva. Sem isso, mandar seis de uma vez com
  // quatro já no banco aceitaria as seis, e o teto de pistas seria decorativo.
  it('conta o que já existe e o que já entrou na mesma leva', () => {
    const oito = Array.from({ length: 8 }, (_, i) => ({ nome: `p${i}.wav` }));
    const { aceites, recusados } = validarPistas(oito, MAXIMO_DE_PISTAS - 2);
    expect(aceites).toHaveLength(2);
    expect(recusados).toHaveLength(6);
    expect(recusados[0].motivo).toBe(`o limite é ${MAXIMO_DE_PISTAS} pistas`);
  });

  it('cheio, não aceita nenhum', () => {
    const { aceites } = validarPistas([{ nome: 'voz.wav' }], MAXIMO_DE_PISTAS);
    expect(aceites).toHaveLength(0);
  });

  it('sem tamanho conhecido, o formato ainda manda', () => {
    // O seletor nem sempre diz o tamanho; isso não pode virar um passe livre para qualquer
    // extensão.
    expect(validarPistas([{ nome: 'x.flac' }], 0).aceites).toHaveLength(0);
    expect(validarPistas([{ nome: 'x.wav' }], 0).aceites).toHaveLength(1);
  });
});
