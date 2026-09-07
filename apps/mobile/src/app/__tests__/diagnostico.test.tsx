import * as React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { StyleSheet } from 'react-native';

import { COR } from '@maestra/core/constants/design';
import { CHAMADA_DO_PLANEJAMENTO } from '@maestra/core/constants/realNarrative';
import { store } from '@maestra/core/store/store';
import Perfil from '../artista/[id]/diagnostico';
import { comDiagnostico, comDiagnosticoV4, semDiagnostico } from './fixtures';

// O prefixo  nao e estilo: o jest recusa a fabrica de  que referencia
// variavel de fora do escopo, e abre excecao so para nomes que comecam assim.
// O prefixo `mock` nao e estilo: o jest recusa fabrica de `jest.mock` que referencie variavel
// de fora do escopo, e abre excecao apenas para nomes que comecam assim.
let mockIdNaRota = comDiagnostico.id;
jest.mock('expo-router', () => ({
  // `Link asChild` so repassa a navegacao: para a tela, o filho e que importa.
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: mockIdNaRota }),
  useRouter: () => ({ back: jest.fn() }),
}));

const semear = () =>
  store.dispatch({
    type: 'artists/fetchArtists/fulfilled',
    payload: [comDiagnostico, comDiagnosticoV4, semDiagnostico],
  });

const montar = () => render(<Provider store={store}><Perfil /></Provider>);

describe('diagnostico REAL em leitura', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnostico.id;
  });

  // O cabeçalho é o mesmo dos outros módulos, e sem o kicker: "ONDE VOCÊ ESTÁ" repetia em nove
  // caracteres o que o título e a descrição já diziam.
  it('usa o cabeçalho padrão dos módulos, sem kicker', async () => {
    const tela = await montar();

    expect(tela.getByText('Diagnóstico REAL')).toBeTruthy();
    expect(tela.getByText('Sua fase de carreira atual, com base nos seus dados reais.')).toBeTruthy();
    expect(tela.queryByText('ONDE VOCÊ ESTÁ')).toBeNull();
  });

  it('mostra o perfil que o motor atribuiu', async () => {
    const tela = await montar();
    expect(tela.getByText('Em construção')).toBeTruthy();
    expect(tela.getByText('Alcance crescendo, receita ainda irregular.')).toBeTruthy();
  });

  // A tela nao calcula: o `realIndex` vem gravado. Se um numero aqui divergir do que o motor
  // produziu, o erro esta no DESENHO — e e exatamente isso que este teste protege.
  it('desenha o boletim com as quatro notas do indice, sem recalcular', async () => {
    const tela = await montar();
    // Cada nota aparece uma vez no cartao da sua dimensao. `getAllBy` porque "12" tambem
    // aparece dentro de "12 meses" da saude financeira — o que interessa e que a nota exista.
    for (const nota of ['78', '34', '51', '12']) {
      expect(tela.getAllByText(nota, { exact: false }).length).toBeGreaterThan(0);
    }
  });

  // ⚠️ A dimensao E e EARNINGS, nao "Economics". O app dizia Economics, e o proprio teste
  // exigia isso — os dois errados juntos. Os nomes agora saem de `DIM_META`, no nucleo, que e a
  // mesma lista que a web e o PDF leem.
  it('nomeia as quatro dimensoes com os nomes do nucleo', async () => {
    const tela = await montar();
    // Cada nome aparece DUAS vezes: na linha do Índice REAL e no cartão da dimensão. É assim
    // na web também — o índice resume, o cartão detalha.
    for (const nome of ['Reach', 'Earnings', 'Audience', 'Legitimacy']) {
      expect(tela.getAllByText(nome)).toHaveLength(2);
    }
    expect(tela.queryByText('Economics')).toBeNull();
  });

  // Sem a linha de status, o numero nao diz se a dimensao acendeu — 78 e muito ou pouco? A web
  // responde com quanto FALTA, que e mais util do que o valor do corte.
  it('diz quanto falta para acender e para o TOP ICON', async () => {
    const tela = await montar();
    // r = 78, ja aceso: faltam 22 para o TOP ICON.
    expect(tela.getByText('Aceso · faltam 22 pts para TOP ICON')).toBeTruthy();
    // e = 34, apagado: faltam 36 para acender e 66 para o TOP ICON.
    expect(tela.getByText('Faltam 36 pts para acender · 66 pts para TOP ICON')).toBeTruthy();
  });

  // A placa e o Indice REAL sao o "momento uau" da entrega, e o app nao tinha nem um nem outro.
  it('mostra a placa da fase e as quatro dimensões do índice', async () => {
    const tela = await montar();
    expect(tela.getByText('SEU PERFIL DE CARREIRA')).toBeTruthy();
    // O rótulo "ÍNDICE REAL" saiu do herói: eram três caixas-altas espaçadas no mesmo bloco, e o
    // cabeçalho dois dedos acima já diz "Diagnóstico REAL". Quem carrega o sentido agora são as
    // quatro letras com a palavra embaixo — é isso que precisa estar na tela.
    expect(tela.queryByText('ÍNDICE REAL')).toBeNull();
    // A caixa-alta é do estilo, não do texto: o nó guarda "Reach", e é assim que se procura.
    for (const palavra of ['Reach', 'Earnings', 'Audience', 'Legitimacy']) {
      expect(tela.getAllByText(palavra).length).toBeGreaterThan(0);
    }
    // Uma alta (r) → a placa de nivel 1. Ela aparece duas vezes: no herói e na linha "1 alta"
    // do mapa dos 16.
    expect(tela.getAllByLabelText('Placa standard · 1')).toHaveLength(2);
  });

  // O mapa dos 16 diz onde a pessoa esta E o que existe acima dela — e a metade que motiva.
  it('situa o perfil entre os 16, com os que estão acima', async () => {
    const tela = await montar();
    expect(tela.getByText('SUA POSIÇÃO ENTRE OS 16 PERFIS')).toBeTruthy();
    expect(tela.getByText('Icon')).toBeTruthy();
    expect(tela.getByText('Beginner')).toBeTruthy();
    expect(tela.getByText('4 altas')).toBeTruthy();
  });

  // A narrativa por dimensao vem do NUCLEO (`dimNarrative`), a mesma que a web e o PDF usam.
  // Tres textos diferentes para os mesmos numeros seria o pior defeito possivel nesta tela.
  it('traz a narrativa "O que isso revela" de cada dimensão', async () => {
    const tela = await montar();
    expect(tela.getAllByText('O que isso revela')).toHaveLength(4);
  });

  // Duas chamadas primárias na mesma tela disputam a decisão em vez de conduzi-la. Baixar o
  // PDF era azul sólido, do mesmo peso do convite para o planejamento; na web os dois botões de
  // "levar o diagnóstico" são secundários, e só o convite é primário.
  it('baixar o PDF é um botão secundário, não disputa com o convite', async () => {
    const tela = await montar();
    const estilo = StyleSheet.flatten(
      tela.getByLabelText('Baixar o diagnóstico em PDF').props.style,
    ) as { backgroundColor?: string; borderWidth?: number };

    expect(estilo.backgroundColor).not.toBe(COR.primaria);
    expect(estilo.backgroundColor).toBe(COR.superficie);
    expect(estilo.borderWidth).toBe(1);
  });

  // O convite para o planejamento NÃO entra aqui: esta tela é a de um perfil já liberado, e
  // um botão de compra no fim dele seria cobrar de novo por algo já pago. É o mesmo
  // `showPlanningCta` desligado da web.
  it('não convida para o planejamento: este perfil já foi liberado', async () => {
    const tela = await montar();

    expect(tela.queryByText(CHAMADA_DO_PLANEJAMENTO.titulo)).toBeNull();
    expect(tela.queryByLabelText(CHAMADA_DO_PLANEJAMENTO.botao)).toBeNull();
  });

  it('mostra quem assina o Índice REAL', async () => {
    const tela = await montar();
    expect(tela.getByText('Anita Carvalho')).toBeTruthy();
  });

  it('mostra as leituras do perfil', async () => {
    const tela = await montar();
    expect(tela.getByText('O alcance já sustenta um show fora da cidade.')).toBeTruthy();
    expect(tela.getByText('A receita depende de um único canal.')).toBeTruthy();
  });

  // O texto e o da web ("Diagnóstico indisponível"), e nao uma frase minha.
  it('perfil sem diagnostico explica o que fazer, em vez de mostrar tela vazia', async () => {
    mockIdNaRota = semDiagnostico.id;
    const tela = await montar();
    expect(tela.getByText('Diagnóstico indisponível')).toBeTruthy();
    expect(tela.queryByText('ÍNDICE REAL')).toBeNull();
  });
});

// ── v4: a mesma tela, lendo o formato novo ───────────────────────────────────────────────────
//
// O fixture da v3 continua valendo (os 77 diagnósticos antigos seguem visíveis, §13.2), e é por
// isso que ele não foi substituído: os dois caminhos precisam funcionar ao mesmo tempo. O que
// este bloco protege é o caminho NOVO, que lê `raw`, `revenue` e `flags` — se o cartão continuar
// procurando `inputs.showsPerMonth`, ele não quebra, só mostra zero.
describe('diagnostico REAL na v4', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnosticoV4.id;
  });

  it('mostra a receita ANUAL, e não uma base mensal', async () => {
    const tela = await montar();
    // 60 shows × média de 4.000 + 20.000 da distribuidora = 260.000
    expect(tela.getByText('R$ 260 mil')).toBeTruthy();
    // O rótulo do autorrelato carrega a adaga da procedência, então casa por prefixo.
    expect(tela.getByText(/^Receita \(12 meses\)/)).toBeTruthy();
  });

  it('mostra o cachê por tipo de contratante', async () => {
    const tela = await montar();
    expect(tela.getByText('Cachê médio por tipo de contratante')).toBeTruthy();
    expect(tela.getByText('Corporativos')).toBeTruthy();
  });

  it('circulação e público pagante saem em base anual', async () => {
    const tela = await montar();
    expect(tela.getByText(/^Shows \(12 meses\)/)).toBeTruthy();
    expect(tela.getByText('Não faz bilheteria')).toBeTruthy();
  });

  it('diz que o engajamento não entra no diagnóstico', async () => {
    const tela = await montar();
    expect(tela.getByText('informativo, não entra no diagnóstico')).toBeTruthy();
  });

  it('mostra os textos obrigatórios que se aplicam a este diagnóstico', async () => {
    const tela = await montar();
    // Sem bilheteria (§11.3.6) aparece DUAS vezes de propósito: no bloco de avisos do topo, que
    // é o que quem só passa os olhos vê, e dentro do cartão do A, junto do número a que se
    // refere. É o mesmo desenho da web.
    expect(tela.getAllByText(/o público real não pode ser comprovado/)).toHaveLength(2);
    // A fonte "não sei" (§11.3.4), idem: no topo e na composição da receita.
    expect(tela.getAllByText(/parte da gestão da carreira/).length).toBeGreaterThanOrEqual(1);
  });

  // §13.2 — um diagnóstico da versão anterior tem que DIZER que é, e não herdar os avisos da v4:
  // as flags novas nem existem nele. O app nativo não mostrava isso; só a web mostrava.
  it('um diagnóstico legado recebe o aviso da versão, e só ele', async () => {
    mockIdNaRota = comDiagnostico.id;
    const tela = await montar();
    expect(tela.getByText(/versão anterior do método/)).toBeTruthy();
    expect(tela.queryByText(/o público real não pode ser comprovado/)).toBeNull();
  });

  it('não chama de execução em rádio um airplay abaixo do piso de 6', async () => {
    const tela = await montar();
    // 3 execuções em 180 dias: o componente é AUSENTE (§9.5), e "Não" afirmaria o que não se sabe.
    expect(tela.getByText('Execução em rádio')).toBeTruthy();
    expect(tela.getAllByText('Sem dado').length).toBeGreaterThan(0);
  });
});
