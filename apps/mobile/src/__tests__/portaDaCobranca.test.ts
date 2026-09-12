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
      // ⚠️ `planos` ENTROU NESTA LISTA NO DIA EM QUE A ROTA MUDOU DE NOME.
      //
      // A regra procurava `assinatura`, e a rota da web passou a chamar-se `/planos`. Sem esta
      // palavra, o endereço que a regra existe para barrar deixava de casar com ela: um
      // `Linking.openURL('…/planos')` numa tela qualquer passaria limpo, e a regra continuaria
      // verde a guardar um nome que já ninguém usa. Uma lista de palavras envelhece com o
      // vocabulário do produto, e este foi o primeiro dia em que isso aconteceu.
      const paraPagamento = aberturas.filter((a) => /assinatura|planos|desbloquear|checkout/i.test(a));
      expect(paraPagamento).toEqual([]);
    },
  );

  it('a chave desliga a venda em um arquivo só', () => {
    const porta = fs.readFileSync(path.join(raiz, PORTA), 'utf8');
    expect(porta).toMatch(/MODO_DE_VENDA/);
    expect(porta).toMatch(/'link-externo' \| 'nenhuma'/);
  });

  // O preço no rótulo do BOTÃO continua a ser o sinal mais visível de anti-steering: um botão que
  // diz "Assine por R$ 39,90" é, ele próprio, a oferta. Na tela de planos o preço é o produto a
  // ser descrito, e não um rótulo de ação — é a distinção que o Spotify também faz.
  it('nenhum botão de bloqueio carrega preço', () => {
    const bloqueio = fs.readFileSync(
      path.join(raiz, 'casca', 'nyta', 'RecursoBloqueado.tsx'), 'utf8',
    );
    expect(bloqueio).not.toMatch(/usePlanPrices|monthlyFmt|onceFmt|\/mês/);
  });
});

// A TELA QUE MOSTRA E NÃO VENDE.
//
// O app deixou de levar ninguém a pagar a assinatura: `/planos` mostra os planos e diz, em texto,
// onde se assina. A pessoa digita o endereço no navegador — e é por isso que a rota da web deixou
// de ser `/assinatura` e passou a `/planos`, que cabe numa frase.
//
// A regressão aqui é de uma linha e parece uma melhoria: alguém "ajuda" quem lê, embrulha o
// endereço num toque que abre o navegador, e a tela volta a ser exatamente o que a 3.1.3 alcança.
// Por fora nada muda.
describe('a tela de planos', () => {
  const tela = fs.readFileSync(path.join(raiz, 'app', 'planos.tsx'), 'utf8');

  /**
   * O ficheiro sem o que é prosa.
   *
   * ⚠️ A REGRA É SOBRE CÓDIGO, e a primeira versão dela não sabia disso: o cabeçalho da tela
   * EXPLICA que ali não entra `Linking` nem `WebBrowser`, e a regra leu a explicação como se
   * fosse a infração. Um caso que proíbe falar do assunto empurra quem vier a seguir a apagar o
   * comentário que diz por que a tela existe.
   */
  const soOCodigo = tela.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('não abre nada, por nenhum caminho', () => {
    expect(soOCodigo).not.toMatch(/Linking/);
    expect(soOCodigo).not.toMatch(/WebBrowser/);
    expect(soOCodigo).not.toMatch(/irParaOCheckout/);
    // E não é vácuo: a tela existe e fala do assunto.
    expect(soOCodigo).toMatch(/ONDE_SE_ASSINA/);
  });

  // ⚠️ E O ENDEREÇO É PARA LER. Ele aparece dentro de um `<Text>`, e nunca como alvo de toque.
  it('o endereço é para ler, não para tocar', () => {
    const { ONDE_SE_ASSINA } = jest.requireActual('@maestra/core/constants/planos');
    expect(ONDE_SE_ASSINA.titulo).toContain(ONDE_SE_ASSINA.endereco);

    const linhas = soOCodigo.split('\n').filter((l) => l.includes('ONDE_SE_ASSINA.endereco'));
    expect(linhas.length).toBeGreaterThan(0);
    linhas.forEach((l) => expect(l).not.toMatch(/onPress|Pressable|href/));
  });
});

// O NOME DA COISA É "PLANO", E NÃO "ASSINATURA".
//
// Decisão de produto, com a tela de conta do Spotify à frente: a secção chama-se "Seu plano",
// diz QUAL é o plano de hoje, e só depois oferece os outros. "Assinar" continua a ser o verbo,
// na tela de planos — é o que o Spotify também faz.
//
// A regra olha para o RÓTULO desenhado, e não para a palavra no ficheiro: `temAssinatura` é o
// nome de uma variável e pode ficar. Uma regra que proibisse a palavra inteira obrigaria a
// renomear código que ninguém lê na tela.
describe('o vocabulário do plano, na conta', () => {
  const conta = fs.readFileSync(path.join(raiz, 'app', 'conta.tsx'), 'utf8');
  const tituloDe = (rotulo: string) => `tituloDoCartao}>${rotulo}<`;

  it('a secção chama-se "Seu plano"', () => {
    expect(conta).toContain(tituloDe('Seu plano'));
    expect(conta).not.toContain(tituloDe('Assinatura'));
  });

  // E ela diz qual é o plano ANTES de oferecer outro: era uma frase que a pessoa tinha de ler
  // até ao fim para descobrir o próprio plano.
  it('mostra o plano de hoje', () => {
    expect(conta).toContain("temAssinatura ? 'Maestra PRO' : 'Maestra Free'");
  });
});

// AS QUATRO SAÍDAS QUE ABRIAM O NAVEGADOR.
//
// "Seja PRO" no menu, "Ver planos" na conta e os dois avisos de recurso bloqueado chamavam
// `irParaOCheckout({ destino: 'assinatura' })` e saíam do app. Hoje vão para `/planos`.
//
// O desbloqueio de perfil NÃO entra nesta regra: é pagamento único, continua cobrado dentro do
// app por decisão do produto, e as duas telas de bloqueio ainda o encaminham.
describe('a assinatura não sai mais do app', () => {
  const AS_QUATRO: readonly (readonly [string, string])[] = [
    ['casca/marca/MenuDoSistema.tsx', path.join('casca', 'marca', 'MenuDoSistema.tsx')],
    ['app/conta.tsx', path.join('app', 'conta.tsx')],
    ['casca/nyta/RecursoBloqueado.tsx', path.join('casca', 'nyta', 'RecursoBloqueado.tsx')],
    ['casca/AvisoDoPro.tsx', path.join('casca', 'AvisoDoPro.tsx')],
  ];

  it.each(AS_QUATRO)('%s não manda assinar pela loja', (_nome, relativo) => {
    const fonte = fs.readFileSync(path.join(raiz, relativo), 'utf8');
    expect(fonte).not.toMatch(/destino:\s*'assinatura'/);
    // E leva mesmo a alguém: sem isto, apagar o botão faria o caso passar.
    expect(fonte).toMatch(/'\/planos'/);
  });

  // ⚠️ A CHAVE TEM DE DESLIGAR DE VERDADE. Ela era uma promessa escrita no comentário do
  // `loja.ts`: nenhuma linha de código a lia antes de abrir o navegador. Quem contasse com ela
  // para desligar a venda depois de uma recusa da revisão descobriria no ciclo seguinte.
  it('a chave em "nenhuma" impede a saída, e não só a documenta', () => {
    const porta = fs.readFileSync(path.join(raiz, PORTA), 'utf8');
    expect(porta).toMatch(/if \(alvo\.destino === 'assinatura' && MODO_DE_VENDA === 'nenhuma'\) return;/);
    // A guarda vem ANTES de qualquer abertura — depois dela, não desliga nada.
    expect(porta.indexOf("MODO_DE_VENDA === 'nenhuma'")).toBeLessThan(porta.indexOf('Linking.openURL'));
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

// OS DOCUMENTOS E O SUPORTE, DENTRO DO APP.
//
// Os três abriam o navegador. Num app que vai para a loja isso é o contrário do que se quer: os
// termos e a política são o que a pessoa precisa de ler ANTES de aceitar, e o suporte é onde ela
// chega já com um problema. Mandá-la para fora — para uma aba que pode nem abrir — é perder as
// três no pior momento.
describe('as telas de termos, privacidade e suporte', () => {
  const legal = fs.readFileSync(path.join(raiz, 'app', 'legal', '[slug].tsx'), 'utf8');
  const suporte = fs.readFileSync(path.join(raiz, 'app', 'suporte.tsx'), 'utf8');
  const conta = fs.readFileSync(path.join(raiz, 'app', 'conta.tsx'), 'utf8');
  const consentimento = fs.readFileSync(path.join(raiz, 'app', 'consentimento.tsx'), 'utf8');

  it('a conta leva às telas, e não ao site', () => {
    ['/legal/termos', '/legal/privacidade', '/suporte'].forEach((rota) => {
      expect(conta).toContain(`'${rota}'`);
    });
    // E o `SITE` deixou de ser aberto nestas linhas: o que sobrar dele na tela é outro assunto.
    expect(conta).not.toMatch(/openURL\(`\$\{SITE\}\/(termos|privacidade|suporte)`\)/);
  });

  // ⚠️ A TELA DO CONSENTIMENTO É O CASO QUE IMPORTA: é ali que se pede o aceite, e o link para o
  // documento tem de abrir o documento.
  it('o consentimento liga para as telas do app', () => {
    expect(consentimento).toContain("router.push('/legal/termos')");
    expect(consentimento).toContain("router.push('/legal/privacidade')");
    expect(consentimento).toContain("router.push('/suporte')");
  });

  // ⚠️ O TEXTO LEGAL NÃO É COPIADO. Ele vive em `constants/legal.ts` e as duas superfícies
  // desenham-no; um segundo texto seriam dois contratos diferentes com o mesmo nome, e o que
  // vale é o que a pessoa leu.
  it('o documento vem do núcleo, e o parse é o partilhado', () => {
    expect(legal).toContain("from '@maestra/core/constants/legal'");
    expect(legal).toContain('LEGAL_DOCS[slug]');
    expect(legal).toContain("from '@maestra/core/nucleo/markdownDaNyta'");
    // Nem um pedaço de contrato escrito aqui: o ficheiro é curto porque só desenha.
    expect(legal.length).toBeLessThan(6000);
  });

  it('os canais do suporte vêm do núcleo', () => {
    expect(suporte).toContain("from '@maestra/core/constants/legal'");
    ['SUPPORT_EMAIL', 'SUPPORT_WHATSAPP', 'SUPPORT_WHATSAPP_DISPLAY'].forEach((nome) => {
      expect(suporte).toContain(nome);
    });
    // O endereço e o número NÃO escritos à mão: eles já estiveram copiados em três telas da web,
    // e um errado num dos lugares só aparecia em produção.
    expect(suporte).not.toMatch(/maestra@|\+55 21/);
  });

  // ⚠️ UM TOQUE QUE NÃO FAZ NADA É PIOR DO QUE UM BOTÃO AUSENTE, e este é o caso conhecido: o
  // comentário da tela da web diz que o `mailto:` "só servia para quem tem cliente de e-mail
  // configurado — no celular costuma abrir nada". Quem toca e não vê reação conclui que o
  // suporte não funciona, e é justamente quem já está com um problema.
  it('o canal que o aparelho não abre deixa o endereço copiado', () => {
    expect(suporte).toContain('Linking.canOpenURL');
    expect(suporte).toContain('Clipboard.setStringAsync');
    // E a pessoa fica a saber: uma cópia silenciosa é igual a não acontecer nada.
    expect(suporte).toContain('Copiado para a área de transferência');
  });
});
