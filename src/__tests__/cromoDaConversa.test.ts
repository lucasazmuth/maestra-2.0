import fs from 'fs';
import path from 'path';

// DOIS condutores para a MESMA conversa.
//
// O roteiro, as falas e os motores vivem no núcleo, e são os mesmos nas duas superfícies. O que
// pode divergir é o tratamento: um beat novo entra no roteiro e só um dos lados o trata — na web
// a pergunta aparece, no app o widget não vem e a conversa trava sem erro nenhum.
//
// Este teste lê o `WidgetSpec` e o `PrepareAction` do núcleo e exige que os dois condutores
// tratem TODOS os casos. É de FONTE de propósito: montar o wizard inteiro para exercitar 22
// widgets custaria mais do que entrega, e o que precisa ser garantido é simples.

const raiz = path.join(__dirname, '..', '..');
const ler = (...p: string[]) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const script = ler('packages', 'core', 'src', 'wizard', 'script.ts');
const naWeb = ler('src', 'pages', 'Wizard', 'chat', 'NytaChat.tsx');
const noApp = [
  ler('apps', 'mobile', 'src', 'app', 'wizard', '[id].tsx'),
  ler('apps', 'mobile', 'src', 'casca', 'wizard', 'useConversa.ts'),
].join('\n');

/** Os `kind` declarados no tipo `WidgetSpec`. */
const widgets = (): string[] => {
  const bloco = script.slice(script.indexOf('export type WidgetSpec'), script.indexOf('export type PrepareAction'));
  return Array.from(bloco.matchAll(/kind: '([a-zA-Z]+)'/g)).map((m) => m[1]);
};

/** As ações do tipo `PrepareAction`. */
const preparos = (): string[] => {
  const bloco = script.slice(script.indexOf('export type PrepareAction'), script.indexOf('export interface Beat'));
  return Array.from(bloco.matchAll(/'([a-zA-Z]+)'/g)).map((m) => m[1]);
};

describe('a conversa é a mesma nas duas superfícies', () => {
  it('o roteiro declara os widgets e os preparos que os dois leem', () => {
    expect(widgets().length).toBeGreaterThan(15);
    expect(preparos()).toEqual(
      expect.arrayContaining(['assembleVision', 'assembleMission', 'generateStrategies', 'summary']),
    );
  });

  it.each(widgets())('o widget "%s" é tratado na web e no app', (kind) => {
    expect(naWeb).toContain(`case '${kind}'`);
    expect(noApp).toContain(`case '${kind}'`);
  });

  it.each(preparos())('o preparo "%s" é tratado na web e no app', (acao) => {
    expect(naWeb).toContain(`'${acao}'`);
    expect(noApp).toContain(`'${acao}'`);
  });

  // Os dois gravam no MESMO `artists.content`. Uma diferença de chave aqui é um plano que a outra
  // superfície não enxerga.
  it.each([
    ['identity', 'a identidade'],
    ['objectives', 'os objetivos'],
    ['swotInputs', 'as marcações da SWOT'],
    ['swotAnalysis', 'a SWOT montada'],
    ['strategies', 'as estratégias'],
    ['executiveSummary', 'o resumo executivo'],
    ['wizardBackTrail', 'a trilha do voltar'],
  ])('%s (%s) é gravado com a mesma chave nos dois', (chave) => {
    expect(naWeb + ler('src', 'pages', 'Wizard', 'index.tsx')).toContain(chave);
    expect(noApp).toContain(chave);
  });
});
