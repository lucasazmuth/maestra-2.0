import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

import { store } from '@maestra/core/store/store';

import { comDiagnostico, semDiagnostico } from '@/app/__tests__/fixtures';
import { Cabecalho } from '@/casca/Cabecalho';

// O sino conta as não lidas e escuta o realtime. O que este arquivo guarda é UMA armadilha:
// o Supabase indexa canais por NOME, e `.on()` num canal já inscrito estoura em tempo de render.
//
// Dois cabeçalhos vivos ao mesmo tempo é situação normal aqui: ao trocar de artista, a casca
// velha ainda está montada quando a nova monta. Isso quebrou a tela duas vezes — a primeira com
// um cabeçalho por aba, a segunda ao trocar de perfil.

const canais: string[] = [];
const inscritos = new Set<string>();

const canal = (nome: string) => {
  const eu = {
    on: () => {
      // O comportamento real: registrar um ouvinte num canal já inscrito é erro.
      if (inscritos.has(nome)) throw new Error(`cannot add callbacks for ${nome} after subscribe()`);
      return eu;
    },
    subscribe: () => { inscritos.add(nome); },
  };
  return eu;
};

jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    channel: (nome: string) => { canais.push(nome); return canal(nome); },
    removeChannel: jest.fn(),
  },
}));

jest.mock('@maestra/core/services/db/notifications', () => ({
  countUnread: jest.fn().mockResolvedValue(3),
}));

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

jest.mock('@/nucleo/sessao', () => ({
  useSessao: () => ({ sessao: { user: { id: 'u-1' } }, carregando: false }),
}));

const MEDIDAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

beforeEach(() => { canais.length = 0; inscritos.clear(); });

describe('cabeçalho do artista', () => {
  it('mostra o artista e a contagem de não lidas', async () => {
    const tela = await render(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={MEDIDAS}>
          <Cabecalho artista={comDiagnostico} id={comDiagnostico.id} />
        </SafeAreaProvider>
      </Provider>,
    );
    // A marca, e nao o nome do artista: lendo o DOM da web em execucao, o chip do artista nao e
    // renderizado em lugar nenhum — quem diz de quem e a tela e a foto na ilha de baixo.
    expect(tela.getByText('Maestra')).toBeTruthy();
    await waitFor(() => expect(tela.getByLabelText('Notificações (3 não lidas)')).toBeTruthy());
  });

  // A regressão em si: dois cabeçalhos ao mesmo tempo, como no instante da troca de perfil.
  it('dois cabeçalhos vivos não disputam o mesmo canal', async () => {
    await render(
      <Provider store={store}>
        <SafeAreaProvider initialMetrics={MEDIDAS}>
          <Cabecalho artista={comDiagnostico} id={comDiagnostico.id} />
          <Cabecalho artista={semDiagnostico} id={semDiagnostico.id} />
        </SafeAreaProvider>
      </Provider>,
    );

    await waitFor(() => expect(canais.length).toBeGreaterThanOrEqual(2));
    expect(new Set(canais).size).toBe(canais.length);
  });
});
