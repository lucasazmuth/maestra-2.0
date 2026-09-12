import fs from 'fs';
import path from 'path';

// NINGUÉM MANDA PARA O LOGIN ANTES DE SABER SE HÁ SESSÃO.
//
// Cada tela lê a sessão por conta própria (`useSessao`), e toda leitura começa em "ainda não
// sei": nasce com `sessao` nula por um render, até o disco responder. Uma tela que decida nesse
// render manda para `/entrar` quem está perfeitamente autenticado.
//
// Em oito telas isso era o piscar clássico — o login aparecia por meio segundo e sumia. Na nona,
// a do consentimento, era o app inteiro travado: ela mandava para `/entrar`, de onde o
// `PortaoDaSessao` trazia de volta para `/perfis`, de onde o `PortaoDoConsentimento` devolvia
// para o consentimento, que mandava outra vez para `/entrar`. Três peças em roda, a tela
// desenhada com todos os toques engolidos, e o React a derrubar tudo com "Maximum update depth
// exceeded". Quem entra pela Apple cai exatamente aí, porque é quem ainda não consentiu.
//
// A regra lê os ficheiros porque a lista de telas cresce sozinha: uma tela nova com a guarda
// errada não teria teste nenhum a apanhá-la.

const telas = path.join(__dirname, '..', 'app');

const arquivos: string[] = [];
const varrer = (dir: string) => {
  for (const nome of fs.readdirSync(dir)) {
    const alvo = path.join(dir, nome);
    if (fs.statSync(alvo).isDirectory()) {
      if (nome === '__tests__' || nome === '__mocks__') continue;
      varrer(alvo);
    } else if (nome.endsWith('.tsx')) {
      arquivos.push(alvo);
    }
  }
};
varrer(telas);

/** O desvio para o login, com a condição que o precede. */
const GUARDADO = /if\s*\(([^)]*)\)\s*return\s*<Redirect\s+href="\/entrar"/g;
/** E o desvio, sob qualquer forma — para conferir que nenhum escapou à leitura de cima. */
const QUALQUER = /<Redirect\s+href="\/entrar"/g;

const comDesvio = arquivos
  .map((caminho) => [path.relative(telas, caminho), fs.readFileSync(caminho, 'utf8')] as const)
  .filter(([, fonte]) => QUALQUER.test(fonte) && ((QUALQUER.lastIndex = 0), true));

describe('quem manda para o login espera a sessão', () => {
  // Se este número cair para zero, a regra acima passou a não olhar para nada — que é o modo
  // silencioso de uma regra de ficheiro morrer.
  it('há telas a conferir', () => {
    expect(comDesvio.length).toBeGreaterThan(0);
  });

  it.each(comDesvio.map(([nome, fonte]) => [nome, fonte]))(
    '%s não desvia enquanto a sessão ainda carrega',
    (_nome, fonte) => {
      const condicoes = [...(fonte as string).matchAll(GUARDADO)].map((m) => m[1]);

      // Toda condição tem de olhar para o "ainda não sei" antes de decidir.
      for (const condicao of condicoes) expect(condicao).toMatch(/carregand/);

      // E nenhum desvio pode ter ficado fora da conta: um `<Redirect href="/entrar">` escrito de
      // outra forma passaria pela regra sem ser lido, e a regra ficaria verde sem ver.
      const total = ((fonte as string).match(QUALQUER) ?? []).length;
      expect(condicoes).toHaveLength(total);
    },
  );
});
