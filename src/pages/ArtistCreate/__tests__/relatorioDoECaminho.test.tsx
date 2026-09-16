import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';
import { computeRealIndexV4, type RealInputsV4 } from '@maestra/core/services/realEngine';
import { DiagnosticReport } from '../DiagnosticReport';

// O jsdom não tem `IntersectionObserver`, e o relatório usa dois para decidir quando mostrar o CTA
// flutuante. Um esboço basta: o que este ficheiro mede é o conteúdo do cartão do E, não a barra.
beforeAll(() => {
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() { /* nada a observar num render sem rolagem */ }
    unobserve() {}
    disconnect() {}
  };
});

// ⚠️ A TELA DA WEB NÃO TINHA TESTE DE RENDER, e por isso os portões do E passavam despercebidos:
// abrir a composição da receita e a saúde financeira no caminho direto não fazia nenhum teste
// falhar. É o modo de falhar mais caro desta rodada — três blocos com zeros para quem acabou de
// dizer que ganha dez mil por mês, e as outras três superfícies a mostrarem a faixa.
const entradas = (over: Partial<RealInputsV4> = {}): RealInputsV4 => ({
  spotifyConnected: true,
  spotifyListeners: 200_000, igFollowers: 80_000, tiktokFollowers: null, youtubeMonthlyViews: null,
  spotifyFollowers: 60_000, deezerFans: null,
  igEngagement: null, tiktokEngagement: null, youtubeEngagement: null,
  editorialPlaylists: 3, radioAirplay180d: null,
  igFollowersSelf: null, tiktokFollowersSelf: null, youtubeViews28dSelf: null,
  showsPerYear: 40,
  // O detalhe vai nos DOIS casos de propósito: no direto ele prova que a faixa manda, e sem ele
  // os blocos não apareceriam de qualquer forma — o teste ficaria verde sem os portões.
  cacheByType: { corporativos: 6_000, produtores: 2_000 },
  revenueSources: { distribuidora: 12_000 },
  custoPorShow: 800, custoFixoMensal: 1_500, investLancamentos12m: 20_000,
  temCnpj: true, aliquota: null, temEmpresario: true,
  fazBilheteria: false, pagantePct: null,
  premios: 4, imprensaRepercussao: true,
  imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
  ...over,
});

const montar = (over: Partial<RealInputsV4> = {}) => render(
  <Provider store={store}>
    <DiagnosticReport
      realIndex={computeRealIndexV4(entradas(over)) as never}
      artistName="Bia Moraes"
      enableStickyCta={false}
      showPlanningCta={false}
    />
  </Provider>,
);

// O relatório renderiza o deck do PDF escondido dentro de si, para a exportação. Então cada texto
// do E aparece DUAS vezes no DOM: uma na tela e outra no documento. É por isso que as afirmações
// positivas contam ocorrências em vez de exigirem uma só — e as negativas continuam exatas, que é
// o que interessa: zero no caminho direto tem de ser zero nas duas.
const aparece = (texto: string | RegExp) => screen.getAllByText(texto).length;

describe('§12 o cartão do E na tela da web', () => {
  it('não expõe o quadro de engajamento por rede no relatório', () => {
    montar();
    expect(screen.queryByText('Engajamento por rede')).toBeNull();
  });

  it('no caminho direto não mostra a conta que ninguém informou', () => {
    montar({ saldoFaixa: 5 });
    expect(screen.queryByText('Composição da receita')).toBeNull();
    expect(screen.queryByText('Saúde financeira · 12 meses')).toBeNull();
    expect(screen.queryByText('Cachê médio por tipo de contratante')).toBeNull();
  });

  it('mostra a faixa escolhida, mensal e anual, e o convite a detalhar', () => {
    montar({ saldoFaixa: 5 });
    expect(aparece('De R$ 6 mil a R$ 10 mil por mês')).toBeGreaterThan(0);
    expect(aparece('de R$ 72 mil a R$ 120 mil por ano')).toBeGreaterThan(0);
    // ⚠️ O TÍTULO É O QUE PRENDE A TELA. O texto do F22 sai também no deck do PDF embutido, então
    // contá-lo deixava passar a tela perder o bloco: sobrava a ocorrência do documento e o teste
    // continuava verde. "De onde vem e pra onde vai" é da tela e só dela.
    expect(aparece('De onde vem e pra onde vai')).toBeGreaterThan(0);
    expect(aparece(/detalhe receitas e custos/)).toBeGreaterThan(0);
  });

  // §3 — os dois chips aparecem nos dois caminhos, e a tela sempre os mostrou. É o que o app
  // não fazia, e é por isso que este teste afirma o comportamento dos dois lados.
  it('e os dois chips de estrutura continuam lá', () => {
    montar({ saldoFaixa: 5 });
    expect(aparece('Com CNPJ')).toBeGreaterThan(0);
    expect(aparece('Com empresário')).toBeGreaterThan(0);
  });

  it('no caminho detalhado a conta inteira volta', () => {
    montar();
    expect(aparece('Composição da receita')).toBeGreaterThan(0);
    expect(aparece('Saúde financeira · 12 meses')).toBeGreaterThan(0);
    expect(aparece('Cachê médio por tipo de contratante')).toBeGreaterThan(0);
    expect(screen.queryByText('De onde vem e pra onde vai')).toBeNull();
    expect(screen.queryByText(/detalhe receitas e custos/)).toBeNull();
  });
});
