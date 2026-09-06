import * as React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { CHAMADA_DO_PLANEJAMENTO } from '@maestra/core/constants/realNarrative';
import { store } from '@maestra/core/store/store';
import Perfil from '../artista/[id]/diagnostico';
import { comDiagnostico, semDiagnostico } from './fixtures';

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
    payload: [comDiagnostico, semDiagnostico],
  });

const montar = () => render(<Provider store={store}><Perfil /></Provider>);

describe('diagnostico REAL em leitura', () => {
  beforeEach(() => {
    semear();
    mockIdNaRota = comDiagnostico.id;
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
  it('diz quanto falta para acender e para o Top Tier', async () => {
    const tela = await montar();
    // r = 78, ja aceso: faltam 22 para o Top Tier.
    expect(tela.getByText('Aceso · faltam 22 pts para Top Tier')).toBeTruthy();
    // e = 34, apagado: faltam 36 para acender e 66 para o Top Tier.
    expect(tela.getByText('Faltam 36 pts para acender · 66 pts para Top Tier')).toBeTruthy();
  });

  // A placa e o Indice REAL sao o "momento uau" da entrega, e o app nao tinha nem um nem outro.
  it('mostra a placa da fase e o Índice REAL', async () => {
    const tela = await montar();
    expect(tela.getByText('SEU PERFIL DE CARREIRA')).toBeTruthy();
    expect(tela.getByText('ÍNDICE REAL')).toBeTruthy();
    // Uma alta (r) → a placa de nivel 1. Ela aparece duas vezes: no cartão do perfil e na
    // linha "1 alta" do mapa dos 16.
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
