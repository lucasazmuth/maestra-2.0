import type { CatalogVersion, CatalogVersionFile } from '../../interfaces/maestra';
import { ehPistaDaMix, NOME_DA_MIX, pistasDaVersao, stemsDaVersao } from '../pistasDaVersao';

// Que pistas a mesa carrega para uma gravação — e, sobretudo, POR QUE a mix entra muda.

const arquivo = (over: Partial<CatalogVersionFile>): CatalogVersionFile => ({
  id: 'f-1', version_id: 'v-1', name: 'Voz', file_url: 'voz.wav', kind: 'stem', ...over,
});

const versao = (over: Partial<CatalogVersion> = {}): CatalogVersion => ({
  id: 'v-1', project_id: 'p-1', version_number: 1,
  audio_file: 'mix.wav', ...over,
} as CatalogVersion);

describe('a mix', () => {
  // ⚠️ A DECISÃO MENOS ÓBVIA DO ARQUIVO. A mix já é a soma das camadas: tocá-la junto com elas
  // faz cada instrumento soar duas vezes, ligeiramente desalinhado, e soa a defeito.
  it('entra MUDA quando há stems, e acesa quando é a única', () => {
    const comStems = pistasDaVersao(versao({ files: [arquivo({})] }));
    expect(comStems[0].nome).toBe(NOME_DA_MIX);
    expect(comStems[0].mudaInicial).toBe(true);

    const sozinha = pistasDaVersao(versao({ files: [] }));
    expect(sozinha).toHaveLength(1);
    expect(sozinha[0].mudaInicial).toBe(false);
  });

  it('vem primeiro, e é reconhecível pelo id', () => {
    const pistas = pistasDaVersao(versao({ files: [arquivo({})] }));
    expect(ehPistaDaMix(pistas[0].id)).toBe(true);
    expect(ehPistaDaMix(pistas[1].id)).toBe(false);
  });

  it('sem áudio na gravação, não há pista de mix', () => {
    const pistas = pistasDaVersao(versao({ audio_file: null, files: [arquivo({})] }));
    expect(pistas).toHaveLength(1);
    expect(pistas[0].nome).toBe('Voz');
  });

  it('sem áudio e sem stems, não há o que tocar', () => {
    expect(pistasDaVersao(versao({ audio_file: null, files: [] }))).toEqual([]);
    expect(pistasDaVersao(null)).toEqual([]);
  });
});

describe('os stems', () => {
  it('vêm por posição, e a data desempata', () => {
    // Um envio em lote pode gravar tudo com a mesma posição; sem o desempate, a ordem mudava a
    // cada leitura e as pistas dançavam na tela.
    const nomes = stemsDaVersao(versao({
      files: [
        arquivo({ id: 'c', name: 'Baixo', position: 1, created_at: '2026-01-02' }),
        arquivo({ id: 'a', name: 'Voz', position: 0 }),
        arquivo({ id: 'b', name: 'Bateria', position: 1, created_at: '2026-01-01' }),
      ],
    })).map((f) => f.name);
    expect(nomes).toEqual(['Voz', 'Bateria', 'Baixo']);
  });

  it('anexos ficam de fora — eles não tocam', () => {
    const files = [arquivo({ id: 'a', name: 'Voz' }), arquivo({ id: 'b', name: 'Letra', kind: 'attachment' })];
    expect(stemsDaVersao(versao({ files })).map((f) => f.name)).toEqual(['Voz']);
  });

  it('cada um leva o ganho que ficou guardado', () => {
    const pistas = pistasDaVersao(versao({
      audio_file: null,
      files: [arquivo({ gain: 0.4 }), arquivo({ id: 'f-2', name: 'Bateria', gain: null })],
    }));
    expect(pistas[0].ganhoInicial).toBe(0.4);
    // Sem valor guardado, a pista entra no topo do fader — e não muda.
    expect(pistas[1].ganhoInicial).toBe(1);
  });
});
