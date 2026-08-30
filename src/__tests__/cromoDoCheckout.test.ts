import fs from 'fs';
import path from 'path';

import { COR_CHECKOUT, COR_SUCESSO } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo: as cores que o app nativo usa no checkout têm de
// existir na folha da web.
//
// ⚠️ O kit nasceu ESCURO (`#0b0b11`, `#15151c`, o roxo `#9a4fd1`) e a folha ainda carrega esse
// tema no topo — quem lê o começo do arquivo porta um checkout preto. O que vale no desbloqueio
// é o bloco `.light`, e é de lá que estes valores saem.
const folhas = [
  fs.readFileSync(
    path.join(__dirname, '..', 'components', 'checkout', 'checkout.module.scss'), 'utf8',
  ),
  fs.readFileSync(
    path.join(__dirname, '..', 'pages', 'ArtistCreate', 'ArtistCreate.module.scss'), 'utf8',
  ),
  // Duas cores não moram em folha nenhuma: o verde do desconto do PIX está numa cor inline do
  // `ProfileUnlock`, e a tela de sucesso é toda em estilo inline. Conferir só o SCSS as
  // deixaria livres para divergir.
  fs.readFileSync(path.join(__dirname, '..', 'pages', 'ProfileUnlock', 'index.tsx'), 'utf8'),
  fs.readFileSync(path.join(__dirname, '..', 'components', 'PaymentSuccessScreen.tsx'), 'utf8'),
].join('\n');
const semEspacos = folhas.replace(/\s+/g, '');

describe('cromo do checkout', () => {
  it('a folha é a do kit que o desbloqueio usa', () => {
    expect(folhas).toContain('.payBtn');
    expect(folhas).toContain('.cartIncludes');
    expect(folhas).toContain('.methodOn');
  });

  it.each([...Object.entries(COR_CHECKOUT), ...Object.entries(COR_SUCESSO)])(
    '%s (%s) é o valor que a web usa',
    (_nome, valor) => {
      expect(semEspacos).toContain(String(valor).replace(/\s+/g, ''));
    },
  );
});
