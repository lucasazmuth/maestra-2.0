import { render, userEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import type { ArtistMember } from '@maestra/core/interfaces/maestra';
import { store } from '@maestra/core/store/store';
import Equipe from '../artista/[id]/equipe';
import { comDiagnostico } from './fixtures';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const mockListar = jest.fn();
const mockConvidar = jest.fn();
const mockAtualizar = jest.fn();
const mockRemover = jest.fn();
jest.mock('@maestra/core/services/db/members', () => ({
  listMembers: (...a: unknown[]) => mockListar(...a),
  inviteMember: (...a: unknown[]) => mockConvidar(...a),
  updateMember: (...a: unknown[]) => mockAtualizar(...a),
  removeMember: (...a: unknown[]) => mockRemover(...a),
}));

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

const membro = (over: Partial<ArtistMember>): ArtistMember => ({
  id: 'm-0', artist_id: 'a-1', email: 'pessoa@exemplo.com',
  access_levels: ['plan'], status: 'active', ...over,
});

const montar = () => render(<Provider store={store}><Equipe /></Provider>);

describe('equipe', () => {
  beforeEach(() => {
    store.dispatch({ type: 'artists/fetchArtists/fulfilled', payload: [comDiagnostico] });
    mockListar.mockReset();
    mockConvidar.mockReset();
    mockAtualizar.mockReset();
    mockRemover.mockReset();
  });

  it('mostra quem tem acesso, com nome e e-mail', async () => {
    mockListar.mockResolvedValue([membro({ id: 'm-1', name: 'Rita Alves', email: 'rita@exemplo.com' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Rita Alves')).toBeTruthy());
    expect(tela.getByText('rita@exemplo.com')).toBeTruthy();
  });

  // Sem nome cadastrado, a web usa o trecho antes do @. Um e-mail repetido duas vezes na linha
  // nao ajuda ninguem a reconhecer a pessoa.
  it('sem nome, usa o inicio do e-mail', async () => {
    mockListar.mockResolvedValue([membro({ id: 'm-1', name: null, email: 'joana@exemplo.com' })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('joana')).toBeTruthy());
  });

  // ⚠️ A linha NAO mostra acesso: a folha da web esconde `.accessSummary` abaixo de 600px. Eu
  // tinha portado uma pilula-resumo que a web nao mostra aqui, e este teste chegou a exigi-la.
  // Quem quer auditar acesso abre o "···", que e onde a lista completa esta.
  it('a linha nao mostra acesso — ele fica na folha do membro', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', name: 'Rita Alves', access_levels: ['plan', 'agenda'] }),
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Rita Alves')).toBeTruthy());

    expect(tela.queryByText('Plano de ação')).toBeNull();
    expect(tela.queryByText('2 acessos')).toBeNull();

    await usuario.press(tela.getByLabelText('Mais opções de Rita Alves'));

    // Na folha os rotulos sao os do NUCLEO, os mesmos da web, com a dica de cada um.
    expect(await tela.findByLabelText('Plano de ação')).toBeTruthy();
    expect(tela.getByText('Ver e editar tarefas e prazos')).toBeTruthy();
    expect(tela.getByLabelText('Plano de ação').props.accessibilityState.checked).toBe(true);
    expect(tela.getByLabelText('Músicas').props.accessibilityState.checked).toBe(false);
  });

  // "Acesso completo" nao e mais um modulo: marca-lo limpa os outros, e os quatro aparecem
  // incluidos e TRAVADOS — o acesso ja os cobre, e desmarcar um deles nao significaria nada.
  it('acesso completo cobre os módulos, e os trava', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', name: 'Rita Alves', access_levels: ['full'] }),
    ]);
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Rita Alves')).toBeTruthy());
    await usuario.press(tela.getByLabelText('Mais opções de Rita Alves'));

    const musicas = await tela.findByLabelText('Músicas');
    expect(musicas.props.accessibilityState.checked).toBe(true);
    expect(musicas.props.accessibilityState.disabled).toBe(true);
  });

  it('mudar os acessos de um membro grava, e a linha acompanha', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', name: 'Rita Alves', access_levels: ['plan'] }),
    ]);
    mockAtualizar.mockResolvedValue(
      membro({ id: 'm-1', name: 'Rita Alves', access_levels: ['plan', 'agenda'] }),
    );
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Rita Alves')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Mais opções de Rita Alves'));
    await usuario.press(await tela.findByLabelText('Agenda'));
    await usuario.press(tela.getByLabelText('Salvar alterações'));

    await waitFor(() => expect(mockAtualizar).toHaveBeenCalled());
    expect(mockAtualizar.mock.calls[0][1].access_levels).toEqual(['plan', 'agenda']);
  });

  // Convidar sem escolher modulo nenhum entra na equipe sem poder abrir nada — provavel
  // esquecimento, ja que da pra desmarcar tudo de uma vez pelo "Acesso completo".
  it('convite exige e-mail válido e ao menos um acesso', async () => {
    mockListar.mockResolvedValue([]);
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(tela.getByLabelText('Convidar membro')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Convidar membro'));
    await usuario.type(await tela.findByLabelText('E-mail do convidado'), 'nao-e-email');
    await usuario.press(tela.getByLabelText('Enviar convite'));

    expect(await tela.findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(mockConvidar).not.toHaveBeenCalled();
  });

  it('convite manda o e-mail, o nome e os acessos escolhidos', async () => {
    mockListar.mockResolvedValue([]);
    mockConvidar.mockResolvedValue(membro({ id: 'm-9', name: 'Rui', email: 'rui@exemplo.com' }));
    const usuario = userEvent.setup();
    const tela = await montar();
    await waitFor(() => expect(tela.getByLabelText('Convidar membro')).toBeTruthy());

    await usuario.press(tela.getByLabelText('Convidar membro'));
    await usuario.type(await tela.findByLabelText('Nome do convidado'), 'Rui');
    await usuario.type(tela.getByLabelText('E-mail do convidado'), 'rui@exemplo.com');
    await usuario.press(tela.getByLabelText('Enviar convite'));

    await waitFor(() => expect(mockConvidar).toHaveBeenCalled());
    expect(mockConvidar.mock.calls[0][0]).toMatchObject({
      artistId: 'a-1', email: 'rui@exemplo.com', name: 'Rui', accessLevels: ['plan'],
    });
    // E a pessoa convidada entra na lista sem precisar recarregar.
    expect(await tela.findByText('Rui')).toBeTruthy();
  });

  // A contagem "2 ativos, 1 pendente" saiu do cabecalho: a web nao a mostra, e o estado de cada
  // um ja esta na propria linha. O que precisa continuar legivel e quem esta ativo e quem nao.
  it('cada membro diz o proprio estado', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', status: 'active' }),
      membro({ id: 'm-2', status: 'active' }),
      membro({ id: 'm-3', status: 'pending' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getAllByText('Ativo')).toHaveLength(2));
    expect(tela.getByText('Pendente')).toBeTruthy();
  });

  // O texto e o da web: quem chega numa equipe vazia precisa saber o que fazer, e agora da pra
  // fazer aqui mesmo.
  it('equipe vazia convida a começar', async () => {
    mockListar.mockResolvedValue([]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Sua equipe começa aqui')).toBeTruthy());
    expect(tela.getByLabelText('Convidar membro')).toBeTruthy();
  });

  it('erro de carga diz indisponibilidade, nao ausencia', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Equipe indisponível')).toBeTruthy());
    expect(tela.queryByText('Sua equipe começa aqui')).toBeNull();
  });
});
