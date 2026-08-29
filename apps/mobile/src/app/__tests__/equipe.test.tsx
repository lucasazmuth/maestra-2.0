import { render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import type { ArtistMember } from '@maestra/core/interfaces/maestra';
import { store } from '@maestra/core/store/store';
import Equipe from '../artista/[id]/equipe';
import { comDiagnostico } from './fixtures';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'a-1' }),
  useRouter: () => ({ back: jest.fn() }),
}));

const mockListar = jest.fn();
jest.mock('@maestra/core/services/db/members', () => ({
  listMembers: (...a: unknown[]) => mockListar(...a),
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

  it('usa os rotulos de acesso do nucleo, os mesmos da web', async () => {
    mockListar.mockResolvedValue([membro({ id: 'm-1', access_levels: ['plan', 'agenda'] })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Plano de ação')).toBeTruthy());
    expect(tela.getByText('Agenda')).toBeTruthy();
  });

  // A linha e para reconhecer, nao para auditar: acima de tres, o resto vira "+N", como na web.
  it('resume os acessos acima de tres', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', access_levels: ['plan', 'agenda', 'catalog', 'team', 'full'] }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('+2')).toBeTruthy());
  });

  it('quem nao tem acesso nenhum e dito, e nao fica em branco', async () => {
    mockListar.mockResolvedValue([membro({ id: 'm-1', access_levels: [] })]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Sem acessos')).toBeTruthy());
  });

  it('separa ativo de pendente na contagem', async () => {
    mockListar.mockResolvedValue([
      membro({ id: 'm-1', status: 'active' }),
      membro({ id: 'm-2', status: 'active' }),
      membro({ id: 'm-3', status: 'pending' }),
    ]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('2 ativos, 1 pendente')).toBeTruthy());
    expect(tela.getAllByText('Ativo')).toHaveLength(2);
    expect(tela.getByText('Pendente')).toBeTruthy();
  });

  it('equipe vazia explica onde se convida', async () => {
    mockListar.mockResolvedValue([]);
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Ninguém na equipe')).toBeTruthy());
  });

  it('erro de carga diz indisponibilidade, nao ausencia', async () => {
    mockListar.mockRejectedValue(new Error('sem rede'));
    const tela = await montar();
    await waitFor(() => expect(tela.getByText('Equipe indisponível')).toBeTruthy());
    expect(tela.queryByText('Ninguém na equipe')).toBeNull();
  });
});
