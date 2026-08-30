import fs from 'fs';
import path from 'path';

import { COR_EQUIPE } from '@maestra/core/constants/design';

// A Equipe do app nativo tem que ser a MESMA da web no celular.
//
// ⚠️ O que mais engana aqui não é cor: é o que a web ESCONDE. Abaixo de 600px ela some com as
// pílulas de acesso da linha (`.accessSummary { display: none }`), e a linha fica com foto, nome,
// e-mail, selo de estado e "···". Eu tinha portado uma pílula-resumo que a web não mostra — e
// tinha um teste meu exigindo ela. Ler o SCSS inteiro não revela isso; só o bloco do celular.

const scss = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Team', 'Team.module.scss'),
  'utf8',
);
const semEspacos = (valor: string) => valor.replace(/\s+/g, '');

const celular = scss.slice(scss.indexOf('@media (max-width: 600px)'));

describe('cromo da Equipe', () => {
  it('o bloco do celular foi localizado', () => {
    expect(celular).toBeTruthy();
    expect(celular).toContain('.accessSummary');
  });

  it.each(Object.entries(COR_EQUIPE))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(semEspacos(scss)).toContain(semEspacos(valor));
  });

  // A regra que motivou o comentário de cima.
  it('as pílulas de acesso somem da linha no celular', () => {
    expect(semEspacos(celular)).toContain(semEspacos('.accessSummary { display: none; }'));
  });

  // Os três estados têm cores próprias: verde, âmbar e vermelho. Sem isso, "Pendente" e
  // "Recusado" ficariam iguais — e são coisas bem diferentes para quem administra a equipe.
  it('cada estado do membro tem cor própria', () => {
    expect(scss).toContain(COR_EQUIPE.ativoTexto);
    expect(scss).toContain(COR_EQUIPE.pendenteTexto);
    expect(scss).toContain(COR_EQUIPE.recusadoTexto);
    expect(new Set([
      COR_EQUIPE.ativoTexto, COR_EQUIPE.pendenteTexto, COR_EQUIPE.recusadoTexto,
    ]).size).toBe(3);
  });

  // O cartão de acesso é caixa de SELEÇÃO, não bolinha: são várias escolhas ao mesmo tempo.
  it('o acesso é caixa de seleção, e não bolinha', () => {
    const cartao = scss.slice(scss.indexOf('.permission,'));
    expect(cartao).toContain('border-radius: 10px');
    expect(cartao).not.toContain('border-radius: 50%');
  });
});
