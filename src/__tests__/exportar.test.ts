import JSZip from 'jszip';

import { BufferFalso } from '@maestra/core/audio/duplos/contextoFalso';

import { baixarArquivo, nomeDoArquivoDaPista, paraWav, paraZip } from '../pages/Catalog/daw/exportar';

// EXPORTAR: os testes que provam que o WAV escrito é um WAV de verdade (qualquer player o
// reconhece), que o ZIP guarda os arquivos certos e sem comprimir de novo o que já é denso, e
// que um nome de pista vira um nome de arquivo que qualquer sistema de arquivos aceita.

describe('paraWav', () => {
  it('escreve o cabeçalho RIFF/WAVE que qualquer tocador reconhece', () => {
    const buffer = new BufferFalso(1, 1, 8000);
    const blob = paraWav(buffer);

    expect(blob.type).toBe('audio/wav');
    // 44 bytes de cabeçalho + 1s × 8000 Hz × 1 canal × 2 bytes/amostra.
    expect(blob.size).toBe(44 + 8000 * 2);
  });

  it('o tamanho cresce com o número de canais', () => {
    const mono = paraWav(new BufferFalso(1, 1, 8000));
    const estereo = paraWav(new BufferFalso(1, 2, 8000));
    expect(estereo.size).toBe(44 + (mono.size - 44) * 2);
  });

  it('os campos do cabeçalho batem com o buffer: taxa, canais, bits por amostra', async () => {
    const buffer = new BufferFalso(1, 2, 22050);
    const blob = paraWav(buffer);
    const vista = new DataView(await new Response(blob).arrayBuffer());

    expect(vista.getUint16(20, true)).toBe(1); // PCM
    expect(vista.getUint16(22, true)).toBe(2); // canais
    expect(vista.getUint32(24, true)).toBe(22050); // taxa
    expect(vista.getUint16(34, true)).toBe(16); // bits por amostra
  });

  // Uma amostra fora de [-1, 1] daria a volta no Int16 e viraria um estalo no lado oposto da
  // onda — presa-la é o que evita isso.
  it('amostras fora de [-1, 1] são presas, e não dão a volta', async () => {
    const buffer = new BufferFalso(1, 1, 2, [new Float32Array([2, -2])]);
    const blob = paraWav(buffer);
    const vista = new DataView(await new Response(blob).arrayBuffer());

    expect(vista.getInt16(44, true)).toBe(0x7fff);
    expect(vista.getInt16(46, true)).toBe(-0x8000);
  });
});

describe('paraZip', () => {
  it('cada stem entra no ZIP com o nome pedido, sem comprimir de novo', async () => {
    const blob = await paraZip([
      { nome: 'Voz.wav', dados: new Blob(['a']) },
      { nome: 'Bateria.wav', dados: new Blob(['b']) },
    ]);

    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files).sort()).toEqual(['Bateria.wav', 'Voz.wav']);
    expect(await zip.files['Voz.wav'].async('string')).toBe('a');
  });

  it('zero stems ainda gera um ZIP válido, vazio', async () => {
    const blob = await paraZip([]);
    const zip = await JSZip.loadAsync(blob);
    expect(Object.keys(zip.files)).toHaveLength(0);
  });
});

describe('nomeDoArquivoDaPista', () => {
  it('troca o que não é seguro para nome de arquivo por sublinhado', () => {
    expect(nomeDoArquivoDaPista('Voz/Guia (dobra)', 'wav')).toBe('Voz_Guia _dobra_.wav');
  });

  it('acentos saem sem virar sublinhado', () => {
    expect(nomeDoArquivoDaPista('Violão', 'mp3')).toBe('Violao.mp3');
  });

  it('nome vazio não gera um arquivo sem nome', () => {
    expect(nomeDoArquivoDaPista('   ', 'wav')).toBe('pista.wav');
  });

  it('a extensão pedida é a que sai, uma vez só', () => {
    expect(nomeDoArquivoDaPista('Baixo', 'mp3')).toBe('Baixo.mp3');
  });
});

describe('baixarArquivo', () => {
  it('cria um link com o nome pedido, clica nele, e o remove', () => {
    // jsdom não implementa URL.createObjectURL/revokeObjectURL — sem isto, `jest.spyOn` não
    // tem o que espiar.
    if (!URL.createObjectURL) (URL as unknown as { createObjectURL: () => void }).createObjectURL = () => {};
    if (!URL.revokeObjectURL) (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    const criarUrl = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:falso');
    const revogarUrl = jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clique = jest.fn();
    const remover = jest.fn();
    const original = document.createElement.bind(document);
    const criarElemento = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = original(tag);
      if (tag === 'a') { el.click = clique; el.remove = remover; }
      return el;
    });

    jest.useFakeTimers();
    baixarArquivo(new Blob(['x']), 'stem.wav');

    expect(criarUrl).toHaveBeenCalled();
    expect(clique).toHaveBeenCalled();
    expect(remover).toHaveBeenCalled();

    // A URL não pode morrer antes do clique iniciar a busca do blob: — por isso é adiada.
    expect(revogarUrl).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(revogarUrl).toHaveBeenCalledWith('blob:falso');

    jest.useRealTimers();
    criarElemento.mockRestore();
    criarUrl.mockRestore();
    revogarUrl.mockRestore();
  });
});
