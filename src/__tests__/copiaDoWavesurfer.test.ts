import fs from 'fs';
import path from 'path';

import { ONDA_DA_VERSAO } from '@maestra/core/constants/design';

// A onda do app nativo é a MESMA da web — não uma imitação com barras.
//
// O app não tem como decodificar um MP3 para descobrir o desenho da onda; o motor do WebView
// tem. Então ele roda o wavesurfer.js lá dentro, com o arquivo embutido (a página não busca
// nada na rede) e com as MESMAS opções, que moram no núcleo.
//
// Este teste guarda os dois elos: que o arquivo embutido é byte a byte o do pacote instalado, e
// que a web não voltou a declarar as opções à mão. Sem ele, uma atualização do wavesurfer
// deixaria as duas superfícies desenhando versões diferentes da mesma gravação — e ninguém
// perceberia, porque as duas continuariam desenhando ALGUMA onda.

const raiz = path.join(__dirname, '..', '..');

const embutido = fs.readFileSync(
  path.join(raiz, 'apps', 'mobile', 'src', 'casca', 'jam', 'wavesurfer.gerado.ts'),
  'utf8',
);
const doPacote = fs.readFileSync(
  path.join(raiz, 'node_modules', 'wavesurfer.js', 'dist', 'wavesurfer.min.js'),
  'utf8',
);

describe('a onda do app é o wavesurfer da web', () => {
  it('o arquivo embutido é o do pacote instalado, sem uma vírgula de diferença', () => {
    // `[\s\S]` no lugar da flag `s`: o alvo do tsconfig é anterior ao ES2018, e a flag nem
    // compila. O babel do jest aceitava — o `tsc` é que reprova.
    const declarado = embutido.match(/export const WAVESURFER = ("[\s\S]*");?\s*$/)?.[1];
    expect(declarado).toBeTruthy();
    expect(JSON.parse(declarado as string)).toBe(doPacote);
  });

  // O arquivo é gerado, e o cabeçalho diz por onde. Sem isso alguém edita à mão, e a próxima
  // sincronização apaga a edição sem aviso.
  it('o arquivo se declara gerado, e nomeia o comando', () => {
    expect(embutido).toContain('npm run wavesurfer:sync');
  });

  it('a versão no cabeçalho é a que está instalada', () => {
    const instalada = JSON.parse(fs.readFileSync(
      path.join(raiz, 'node_modules', 'wavesurfer.js', 'package.json'), 'utf8',
    )).version;
    expect(embutido).toContain(`wavesurfer.js ${instalada}`);
  });

  it('a web lê as opções do núcleo, e não as declara à mão', () => {
    const componente = fs.readFileSync(
      path.join(raiz, 'src', 'pages', 'Catalog', 'WaveSurferWaveform.tsx'), 'utf8',
    );
    expect(componente).toContain('ONDA_DA_VERSAO');
    // As duas que mais mudariam sem ninguém pensar duas vezes.
    expect(componente).not.toContain('waveColor:');
    expect(componente).not.toContain('barWidth:');
  });

  // Os valores em si: são eles que dão àquela onda a densidade que ela tem.
  it('as opções são as que a folha da web mede', () => {
    expect(ONDA_DA_VERSAO).toMatchObject({
      height: 60,
      waveColor: '#405985',
      progressColor: '#2f60f6',
      barWidth: 3,
      barGap: 4,
      barRadius: 3,
      barMinHeight: 3,
      cursorWidth: 0,
    });
  });
});
