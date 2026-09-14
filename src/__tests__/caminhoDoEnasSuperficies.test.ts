import fs from 'fs';
import path from 'path';

// ⚠️ AS QUATRO SUPERFÍCIES TÊM DE FAZER A MESMA PERGUNTA, E NO MESMO SÍTIO.
//
// Tela da web, PDF da web, PDF do núcleo e app mostram os mesmos três blocos do E — composição da
// receita, cachê por tipo e saúde financeira — e desde a v4.5 os três só existem quando o artista
// detalhou. A pergunta mora uma vez só, em `detalhouOE`.
//
// Este teste existe porque o modo de falhar aqui é CALADO: uma superfície que fique para trás não
// quebra, não avisa e não aparece no log. Ela imprime "Receita R$ 0 · Custos R$ 0" para quem
// acabou de dizer que ganha dez mil por mês, enquanto as outras três mostram a faixa. O artista vê
// dois documentos do mesmo diagnóstico a dizerem coisas diferentes sobre o dinheiro dele.
const raiz = path.join(__dirname, '..', '..');
const SUPERFICIES: [string, string][] = [
  ['tela da web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticReport.tsx')],
  ['PDF da web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticDoc.tsx')],
  ['PDF do núcleo', path.join(raiz, 'packages', 'core', 'src', 'documentos', 'diagnosticoHtml.ts')],
  ['app nativo', path.join(raiz, 'apps', 'mobile', 'src', 'casca', 'diagnostico', 'CartaoDaDimensao.tsx')],
];
const fontes = SUPERFICIES.map(([nome, p]) => [nome, fs.readFileSync(p, 'utf8')] as const);

describe('o caminho do E nas quatro superfícies', () => {
  it.each(fontes)('a %s pergunta pelo ajudante do núcleo', (_nome, fonte) => {
    expect(fonte).toContain('detalhouOE');
  });

  // A regra não é "ninguém pode ler `caminho`": é que a decisão tem um dono. `relatorio.ts` lê o
  // campo cru uma vez e devolve a resposta; quem o reler aqui passa a ser um segundo dono, e dois
  // donos divergem no dia em que a regra mudar de forma.
  it.each(fontes)('e a %s não redecide o caminho por conta própria', (_nome, fonte) => {
    expect(fonte).not.toMatch(/caminho\s*===\s*['"]direto['"]/);
    expect(fonte).not.toMatch(/revenue\??\.caminho/);
  });

  // O convite (F22) vai onde a conta estaria: três blocos que somem sem explicação são um cartão
  // truncado, e não uma resposta.
  it.each(fontes)('a %s põe o convite a detalhar no lugar da conta', (_nome, fonte) => {
    expect(fonte).toContain('conviteADetalhar');
  });

  // §3 — os dois chips de estrutura aparecem nos DOIS caminhos, e é por isso que eles não podem
  // viver só dentro do bloco da conta. No PDF eles moravam na página "Onde a conta fecha", que
  // deixa de existir no direto; no app, só a ausência aparecia.
  it.each(fontes)('a %s mostra as duas respostas de estrutura, e não só a ausência', (_nome, fonte) => {
    expect(fonte).toContain('Com CNPJ');
    expect(fonte).toContain('Com empresário');
  });
});
