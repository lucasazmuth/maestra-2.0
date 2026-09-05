import fs from 'fs';
import path from 'path';

// A ordem do boot: a porta de ambiente ANTES de tudo.
//
// O `ambiente()` guarda o que resolveu na primeira chamada, e quem chega primeiro não é uma
// tela: é o `supabase-js`, que ao ser criado já dispara a recuperação da sessão — e o cliente é
// criado no import de `lib/supabase.ts`. A primeira leitura da sessão acontece, portanto,
// durante a avaliação dos imports.
//
// Registrar no layout raiz não bastava: em ES modules os imports são avaliados antes do corpo do
// módulo. O app abria logado assim mesmo, mas por CORRIDA — a leitura seguinte já pegava o
// depósito certo. Num aparelho mais lento essa corrida se perde, e o sintoma é abrir deslogado
// de vez em quando: o pior tipo de defeito, porque não reproduz na máquina de quem programa.

const app = path.join(__dirname, '..', '..', '..');

describe('ordem do boot', () => {
  it('o entry do app é o index.js próprio, e não o do expo-router', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
    expect(pkg.main).toBe('index.js');
  });

  it('o ambiente é registrado antes do expo-router', () => {
    const entry = fs.readFileSync(path.join(app, 'index.js'), 'utf8');
    const ambiente = entry.indexOf("import './src/nucleo/ambienteApp'");
    const router = entry.indexOf("import 'expo-router/entry'");

    expect(ambiente).toBeGreaterThan(-1);
    expect(router).toBeGreaterThan(-1);
    expect(ambiente).toBeLessThan(router);
  });

  // O registro tem que acontecer no IMPORT do módulo, não só quando alguém chama a função —
  // senão o entry importaria um módulo que não faz nada.
  // O dayjs nasce em inglês e a Agenda escreve o mês por extenso — "29 de August de 2026" foi o
  // que apareceu na tela antes disto.
  it('o idioma das datas é carregado no boot', () => {
    const entry = fs.readFileSync(path.join(app, 'index.js'), 'utf8');
    expect(entry).toContain("import './src/nucleo/idioma'");

    const idioma = fs.readFileSync(path.join(app, 'src', 'nucleo', 'idioma.ts'), 'utf8');
    expect(idioma).toContain("dayjs.locale('pt-br')");
  });

  it('o módulo do ambiente registra ao ser importado', () => {
    const fonte = fs.readFileSync(path.join(app, 'src', 'nucleo', 'ambienteApp.ts'), 'utf8');
    const semComentarios = fonte.replace(/^\s*\/\/.*$/gm, '');

    expect(semComentarios).toMatch(/^ligarAmbienteDoApp\(\);$/m);
  });
});
