import {
  AZUL_DO_EDITOR, CORES_DAS_PISTAS as CORES_NO_NUCLEO, COR_EDITOR, VERMELHO_DO_EDITOR,
} from '@maestra/core/constants/design';

import { CORES_DAS_PISTAS, DS } from '../daw/tokens';

// O CROMO DO EDITOR: as duas superfícies pintam a mesma tela, e este teste é o que as prende.
//
// O editor da web tem a sua folha (`DS`) e o do app lê o `COR_EDITOR` do núcleo. São dois
// objetos porque as duas telas não partilham uma linha de estilo — a web tem CSS, o app tem
// `StyleSheet` — mas são a MESMA pele, e uma cor mudada de um lado só é o tipo de divergência
// que ninguém vê num diff e que aparece meses depois, quando alguém põe os dois telefones lado
// a lado.
//
// Falhou depois de mexer numa cor? Mexa na outra também. É essa a intenção.

describe('a pele do editor é a mesma na web e no app', () => {
  it('as camadas, do fundo para a frente', () => {
    expect(COR_EDITOR.fundoDe).toBe(DS.color.bgBase);
    expect(COR_EDITOR.fundoAte).toBe(DS.color.bgBase);
    expect(COR_EDITOR.painel).toBe(DS.color.bgPainel);
    expect(COR_EDITOR.cabecaDaVersao).toBe(DS.color.bgPista);
    expect(COR_EDITOR.botaoRedondo).toBe(DS.color.bgCampo);
    expect(COR_EDITOR.acaoFundo).toBe(DS.color.bgCampo);
  });

  it('os fios', () => {
    expect(COR_EDITOR.fio).toBe(DS.color.borda);
    expect(COR_EDITOR.contornoDaVersao).toBe(DS.color.borda);
    expect(COR_EDITOR.vazioContorno).toBe(DS.color.bordaForte);
  });

  it('as tintas', () => {
    expect(COR_EDITOR.texto).toBe(DS.color.texto);
    expect(COR_EDITOR.titulo).toBe(DS.color.texto);
    expect(COR_EDITOR.acaoIcone).toBe(DS.color.texto);
    expect(COR_EDITOR.apoio).toBe(DS.color.textoApoio);
    expect(COR_EDITOR.cracha).toBe(DS.color.textoApoio);
    expect(COR_EDITOR.rotulo).toBe(DS.color.textoFraco);
    expect(COR_EDITOR.apoioDoVazio).toBe(DS.color.textoFraco);
    expect(COR_EDITOR.estrela).toBe(DS.color.textoInerte);
  });

  it('o azul da ação e o vermelho da agulha', () => {
    expect(AZUL_DO_EDITOR).toBe(DS.color.primaria);
    expect(VERMELHO_DO_EDITOR).toBe(DS.color.agulha);
    expect(VERMELHO_DO_EDITOR).toBe(DS.color.gravar);
  });

  it('o fundo do editor é chapado — um gradiente num quase-preto é banda, não profundidade', () => {
    expect(COR_EDITOR.fundoDe).toBe(COR_EDITOR.fundoAte);
  });

  // ⚠️ AS CORES DAS FAIXAS TAMBÉM, e estas eram as que faltavam: o núcleo tinha uma paleta
  // PRÓPRIA, de oito cores mais apagadas, e a mesma faixa saía roxa no computador e amarela no
  // telemóvel. Quem punha os dois lado a lado via duas montagens diferentes da mesma música.
  //
  // Este é exatamente o defeito que o comentário do topo deste ficheiro descreve — e que ele
  // não apanhava, porque a paleta das faixas nunca tinha sido presa.
  it('as cores das faixas são a mesma paleta, na mesma ordem', () => {
    expect([...CORES_NO_NUCLEO]).toEqual([...CORES_DAS_PISTAS]);
  });
});
