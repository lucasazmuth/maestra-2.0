import fs from 'fs';
import path from 'path';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaCcAmex, FaCcMastercard, FaCcVisa } from 'react-icons/fa';

// As marcas do checkout são as MESMAS nas duas superfícies.
//
// O PIX é o vetor da web, copiado. As três bandeiras vêm do `react-icons/fa`, que não existe no
// React Native: foram gravadas como arquivo a partir do próprio pacote. Este teste desenha os
// ícones de novo e compara com o que está em `assets/brand` — se uma atualização do pacote mudar
// o traço, a web muda e o app fica para trás sem ninguém ver.

const raiz = path.join(__dirname, '..', '..');
const doApp = (arquivo: string) =>
  fs.readFileSync(path.join(raiz, 'apps', 'mobile', 'assets', 'brand', arquivo), 'utf8').trim();

/** O react-icons injeta tamanho e estilo no elemento; o arquivo guarda só o desenho. */
const desenho = (Icone: typeof FaCcVisa) =>
  renderToStaticMarkup(React.createElement(Icone))
    .replace(/ style="[^"]*"/, '')
    .replace(/ height="1em" width="1em"/, '')
    .trim();

describe('as marcas do checkout são as mesmas nos dois', () => {
  it('o PIX é cópia idêntica do vetor da web', () => {
    const daWeb = fs.readFileSync(path.join(raiz, 'src', 'assets', 'pix-mark.svg'), 'utf8').trim();
    expect(doApp('pix-mark.svg')).toEqual(daWeb);
  });

  it.each([
    ['Visa', FaCcVisa, 'cc-visa.svg'],
    ['Mastercard', FaCcMastercard, 'cc-mastercard.svg'],
    ['Amex', FaCcAmex, 'cc-amex.svg'],
  ] as const)('a bandeira %s é o desenho do react-icons', (_nome, Icone, arquivo) => {
    expect(doApp(arquivo)).toEqual(desenho(Icone));
  });
});
