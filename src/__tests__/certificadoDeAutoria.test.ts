import fs from 'fs';
import path from 'path';

import {
  carimboLegivel, montarCertificadoDeAutoria, tamanhoLegivel,
  type DadosDoCertificado,
} from '@maestra/core/documentos/certificadoHtml';
import { AVISO_DO_CERTIFICADO, hashLegivel } from '@maestra/core/services/db/certificados';

// O CERTIFICADO DE AUTORIA — o documento e as três coisas que ele afirma.
//
// Um certificado que erra a data, o hash ou o aviso do que ele NÃO é vale menos do que não
// existir: o artista confia nele exatamente no dia em que precisa, e é tarde para descobrir.
//
// O hash em si não é testado aqui: quem o calcula é o servidor, a partir do arquivo no Storage
// (`supabase/functions/version-certify`). Deste lado testa-se o que o cliente faz com ele.

const HASH = 'a'.repeat(8) + 'b'.repeat(8) + 'c'.repeat(8) + 'd'.repeat(8)
  + 'e'.repeat(8) + 'f'.repeat(8) + '0'.repeat(8) + '1'.repeat(8);

const dados: DadosDoCertificado = {
  musica: 'Vento sul',
  versao: 'guia vocal',
  artista: 'Karinah',
  autorNome: 'Lucas Andrade',
  sha256: HASH,
  algoritmo: 'sha-256',
  arquivoNome: 'vento-sul-guia.wav',
  arquivoBytes: 45 * 1024 * 1024,
  certificadoEm: '2026-09-08T14:30:00.000Z',
};

describe('o hash, para o olho humano', () => {
  it('quebra em grupos de oito, sem perder nem inventar caractere', () => {
    const legivel = hashLegivel(HASH);
    expect(legivel).toBe('aaaaaaaa bbbbbbbb cccccccc dddddddd eeeeeeee ffffffff 00000000 11111111');
    // O que importa não é o formato: é que os 64 caracteres continuem lá, na mesma ordem.
    expect(legivel.replace(/ /g, '')).toBe(HASH);
  });
});

describe('a data do carimbo', () => {
  // A DATA É A ÚNICA COISA QUE ESTE DOCUMENTO AFIRMA. Se ela mudasse conforme o fuso de quem
  // abre o PDF, o mesmo certificado diria 8 de setembro em São Paulo e 9 em Tóquio — e a
  // afirmação inteira deixaria de valer.
  it('põe a hora de Brasília para um instante em UTC', () => {
    // 14:30 UTC = 11:30 em Brasília, no mesmo dia.
    expect(carimboLegivel('2026-09-08T14:30:00.000Z')).toBe('08/09/2026 às 11:30 (horário de Brasília)');
  });

  it('não deixa o dia escorregar quando a hora em UTC já virou', () => {
    // 01:00 UTC do dia 9 ainda é dia 8 em Brasília.
    expect(carimboLegivel('2026-09-09T01:00:00.000Z')).toContain('08/09/2026');
  });

  it('nomeia o fuso no código, em vez de herdar o do ambiente', () => {
    // ⚠️ ESTA ASSERÇÃO OLHA PARA O CÓDIGO, e não para a saída, porque a saída aqui não consegue
    // provar nada: esta máquina JÁ roda em America/Sao_Paulo, então "fixa Brasília" e "herda o
    // fuso do ambiente" produzem exatamente o mesmo texto, e os dois testes acima passariam com
    // o defeito no lugar. Numa máquina em UTC eles quebrariam — o que é pior ainda, porque o
    // teste passaria a depender de onde roda.
    //
    // (Tentei antes fixar `process.env.TZ` no topo do arquivo. Não funciona: o Node resolve o
    // fuso antes do teste começar, e o Jest continuou a ver America/Sao_Paulo.)
    //
    // Ler o fonte é o mesmo caminho que `documentoDoDiagnostico.test.ts` já usa para proteger
    // uma invariante que a saída não expõe.
    const fonte = fs.readFileSync(
      path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'documentos', 'certificadoHtml.ts'),
      'utf8',
    );
    const carimbo = fonte.slice(fonte.indexOf('export const carimboLegivel'));
    // Uma vez para a data e outra para a hora: esquecer numa das duas é o erro provável.
    expect((carimbo.match(/timeZone: 'America\/Sao_Paulo'/g) || []).length).toBe(2);
  });

  it('não inventa data quando o que chega não é uma', () => {
    expect(carimboLegivel('nada disto')).toBe('—');
  });
});

describe('o tamanho do arquivo', () => {
  it('sai em MB, que é como se fala de uma música', () => {
    expect(tamanhoLegivel(45 * 1024 * 1024)).toBe('45 MB');
    expect(tamanhoLegivel(Math.round(1.5 * 1024 * 1024))).toBe('1,5 MB');
  });

  it('mostra um traço em vez de "0 MB" quando o tamanho não veio', () => {
    expect(tamanhoLegivel(null)).toBe('—');
    expect(tamanhoLegivel(0)).toBe('—');
  });
});

describe('o documento', () => {
  const html = montarCertificadoDeAutoria(dados);

  it('diz, no corpo, que não é registro de direito autoral', () => {
    // ESTE É O TESTE QUE MAIS IMPORTA. A palavra "certificado" num produto de música puxa ECAD
    // e Biblioteca Nacional sozinha, e deixar essa confusão de pé é prometer uma proteção que
    // não existe. O aviso não é rodapé miúdo: mora no corpo, e sai do núcleo.
    expect(html).toContain(AVISO_DO_CERTIFICADO);
    expect(AVISO_DO_CERTIFICADO).toMatch(/não é registro de direito autoral/i);
    expect(AVISO_DO_CERTIFICADO).toMatch(/Biblioteca Nacional/);
    expect(AVISO_DO_CERTIFICADO).toMatch(/ECAD/);
  });

  it('carrega a obra, o autor, o hash e a data', () => {
    expect(html).toContain('Vento sul');
    expect(html).toContain('guia vocal');
    expect(html).toContain('Karinah');
    expect(html).toContain('Lucas Andrade');
    expect(html).toContain(hashLegivel(HASH));
    expect(html).toContain('08/09/2026');
  });

  it('imprime numa folha só', () => {
    // O deck do diagnóstico tem `page-break-after` porque tem doze páginas. Este tem uma, e um
    // quebra-página aqui produziria uma segunda folha em branco em todo PDF emitido.
    expect(html).not.toContain('page-break-after');
    expect((html.match(/class="pg"/g) || []).length).toBe(1);
  });

  it('escapa o que vem do artista, em vez de deixar virar marcação', () => {
    const comBicho = montarCertificadoDeAutoria({
      ...dados,
      musica: '<script>alert(1)</script>',
      autorNome: 'Ana & Beto',
    });
    expect(comBicho).not.toContain('<script>');
    expect(comBicho).toContain('&lt;script&gt;');
    expect(comBicho).toContain('Ana &amp; Beto');
  });
});
