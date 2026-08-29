import fs from 'fs';
import path from 'path';

// Os ícones do app nativo têm que ser os MESMOS arquivos da web.
//
// O Metro não alcança `src/assets/icons` (fora da pasta do app), então cada ícone existe em
// duas cópias. Aproximar com uma família pronta — Feather e parecidos — foi justamente o tipo
// de "quase igual" que fez o app parecer outro produto; e uma cópia que deriva em silêncio
// produz o mesmo efeito, só que mais devagar.
//
// Mesmo molde do `edgeSharedCopies.test.ts`, que já guarda as cópias de `_shared`.

const daWeb = path.join(__dirname, '..', 'assets', 'icons');
const doApp = path.join(__dirname, '..', '..', 'apps', 'mobile', 'assets', 'icons');

const svgsDoApp = fs.existsSync(doApp)
  ? fs.readdirSync(doApp).filter((n) => n.endsWith('.svg'))
  : [];

describe('ícones do app nativo', () => {
  it('o app tem a pasta de ícones copiada', () => {
    expect(svgsDoApp.length).toBeGreaterThan(0);
  });

  it.each(svgsDoApp)('%s é idêntico ao da web', (nome) => {
    const original = path.join(daWeb, nome);
    // Um arquivo que só existe no app é tão suspeito quanto um divergente: ou veio de outro
    // lugar, ou foi apagado da web e ficou órfão aqui.
    expect(fs.existsSync(original)).toBe(true);
    expect(fs.readFileSync(path.join(doApp, nome), 'utf8')).toBe(fs.readFileSync(original, 'utf8'));
  });
});
