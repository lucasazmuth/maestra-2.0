import fs from 'fs';
import path from 'path';

// UMA PORTA SÓ PARA A COBRANÇA.
//
// O app leva quem vai pagar para o checkout da web. Isso é o que as diretrizes de anti-steering
// alcançam (App Store 3.1.3, política de Pagamentos do Play), e a permissão para esse link muda
// de país para país e mudou várias vezes de 2024 para cá.
//
// Por isso existe UM lugar que decide: `nucleo/loja.ts`. Se a revisão recusar, `MODO_DE_VENDA`
// vira `'nenhuma'` e os botões param de levar para fora — em um arquivo, não em sete.
//
// Este teste existe porque a regressão é silenciosa: alguém "conserta" um botão com um
// `Linking.openURL` direto, o app continua funcionando, e a chave deixa de desligar aquela tela.

const raiz = path.join(__dirname, '..');
const PORTA = path.join('nucleo', 'loja.ts');

const arquivos: string[] = [];
const varrer = (dir: string) => {
  for (const nome of fs.readdirSync(dir)) {
    const alvo = path.join(dir, nome);
    if (fs.statSync(alvo).isDirectory()) {
      if (nome === '__tests__' || nome === '__mocks__') continue;
      varrer(alvo);
    } else if (/\.tsx?$/.test(nome)) {
      arquivos.push(alvo);
    }
  }
};
varrer(raiz);

describe('a porta da cobrança', () => {
  it.each(arquivos.filter((a) => !a.endsWith(PORTA)).map((a) => [path.relative(raiz, a), a]))(
    '%s não abre o checkout por conta própria',
    (_nome, caminho) => {
      const fonte = fs.readFileSync(caminho, 'utf8');
      const aberturas = fonte.match(/Linking\.openURL\([^)]*\)/g) ?? [];
      const paraPagamento = aberturas.filter((a) => /assinatura|desbloquear|checkout/i.test(a));
      expect(paraPagamento).toEqual([]);
    },
  );

  it('a chave desliga a venda em um arquivo só', () => {
    const porta = fs.readFileSync(path.join(raiz, PORTA), 'utf8');
    expect(porta).toMatch(/MODO_DE_VENDA/);
    expect(porta).toMatch(/'link-externo' \| 'nenhuma'/);
  });

  // O preço no rótulo do botão é o sinal mais visível de anti-steering. Ele mora no checkout.
  it('nenhum botão de bloqueio carrega preço', () => {
    const bloqueio = fs.readFileSync(
      path.join(raiz, 'casca', 'nyta', 'RecursoBloqueado.tsx'), 'utf8',
    );
    expect(bloqueio).not.toMatch(/usePlanPrices|monthlyFmt|onceFmt|\/mês/);
  });
});

// O CADASTRO É AQUI DENTRO.
//
// Ele já foi um link para a web, e apontava para `${SITE}/cadastro` em duas telas — uma rota
// que nunca existiu no `App.tsx`: quem tocava o botão saía do app e caía num 404. Hoje a conta
// nasce no app, e nenhuma tela deve mandar ninguém ao navegador para se cadastrar.
//
// A regressão é silenciosa: o app abre o navegador e o problema aparece do outro lado.
describe('o cadastro', () => {
  it.each(arquivos.map((a) => [path.relative(raiz, a), a]))(
    '%s não manda ninguém ao navegador para se cadastrar',
    (_nome, caminho) => {
      const fonte = fs.readFileSync(caminho, 'utf8');
      const aberturas = fonte.match(/Linking\.openURL\([^)]*\)/g) ?? [];
      expect(aberturas.filter((a) => /cadastro|signup/i.test(a))).toEqual([]);
    },
  );
});
