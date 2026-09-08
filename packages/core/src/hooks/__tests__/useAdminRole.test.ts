import { renderHook, waitFor } from '@testing-library/react';

const mockMaybeSingle = jest.fn();
const mockRpc = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }),
    }),
    // O hook busca papel e modulos juntos; sem o rpc o Promise.all rejeita e nada carrega.
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// O prefixo `mock` e exigido pelo jest: sem ele a fabrica do jest.mock nao pode ler a variavel.
let mockUsuario: { id: string } | null = { id: 'u1' };
jest.mock('../../store/store', () => ({
  useAppSelector: (sel: (s: any) => unknown) => sel({ auth: { user: mockUsuario } }),
}));

// eslint-disable-next-line import/first
import { useAdminRole } from '../useAdminRole';

const comPapel = (role: string | null, modulos: string[] = []) => {
  mockMaybeSingle.mockResolvedValue({ data: role ? { role } : null });
  mockRpc.mockResolvedValue({ data: modulos, error: null });
};

beforeEach(() => {
  mockUsuario = { id: 'u1' };
  mockMaybeSingle.mockReset();
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: [], error: null });
});

// O mesmo defeito do consentimento vivia aqui: o `RequireFullAdmin` troca a tela por um spinner
// global enquanto `carregando` for verdade, e reverificar a MESMA pessoa o ligava de novo. Com o
// supabase-js reconferindo a sessão a cada volta de aba, um admin no meio de um formulário do
// painel perdia o que tinha digitado só por ter ido olhar outra aba.
describe('useAdminRole quando a aba volta', () => {
  it('reverificar a mesma pessoa não volta para o spinner', async () => {
    comPapel('admin');
    const { result, rerender } = renderHook(() => useAdminRole());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    // A resposta da reverificação fica pendurada: o que importa é o estado NO MEIO dela.
    mockMaybeSingle.mockReturnValue(new Promise(() => {}));
    mockRpc.mockReturnValue(new Promise(() => {}));
    mockUsuario = { id: 'u1' };
    rerender({});

    expect(result.current.carregando).toBe(false);
    expect(result.current.ehAdminPleno).toBe(true);
  });

  // Trocar de conta precisa esperar: mostrar o painel pleno para quem ainda não foi verificado,
  // mesmo por um instante, é a falha que não se desfaz.
  it('outra pessoa volta a esperar', async () => {
    comPapel('admin');
    const { result, rerender } = renderHook(() => useAdminRole());
    await waitFor(() => expect(result.current.carregando).toBe(false));

    mockMaybeSingle.mockReturnValue(new Promise(() => {}));
    mockRpc.mockReturnValue(new Promise(() => {}));
    mockUsuario = { id: 'u2' };
    rerender({});

    expect(result.current.carregando).toBe(true);
  });
});

describe('useAdminRole', () => {
  // Errar para o lado permissivo aqui abre exclusao de conta, cupons e push para um vendedor.
  it.each([
    ['admin', [] as string[], true, true],
    ['super_admin', [] as string[], true, true],
    // Membro do time so opera o CRM se tiver o modulo: o papel sozinho nao concede mais nada.
    ['sales', ['vendas'], false, true],
    ['sales', [] as string[], false, false],
  ])('papel %s com modulos %j: admin pleno=%s, opera CRM=%s', async (role, mods, pleno, crm) => {
    comPapel(role, mods as string[]);
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.papel).toBe(role);
    expect(result.current.ehAdminPleno).toBe(pleno);
    expect(result.current.operaCrmDeVendas).toBe(crm);
  });

  // O menu e os porteiros de rota chamam `podeAcessar`. Errar para o lado permissivo aqui mostra
  // telas que a pessoa nao alcanca, e ela bate na RLS com a tela ja aberta.
  it('podeAcessar respeita a lista de modulos', async () => {
    comPapel('sales', ['vendas', 'avaliacoes']);
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.podeAcessar('vendas')).toBe(true);
    expect(result.current.podeAcessar('avaliacoes')).toBe(true);
    expect(result.current.podeAcessar('usuarios')).toBe(false);
    expect(result.current.podeAcessar('push')).toBe(false);
  });

  it('admin pleno alcanca tudo sem precisar de modulo concedido', async () => {
    comPapel('super_admin', []);
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.podeAcessar('usuarios')).toBe(true);
    expect(result.current.podeAcessar('push')).toBe(true);
  });

  it('quem nao esta em platform_admins nao e nada', async () => {
    comPapel(null);
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.papel).toBeNull();
    expect(result.current.ehAdminPleno).toBe(false);
    expect(result.current.operaCrmDeVendas).toBe(false);
  });

  // A lista de papeis e explicita justamente para isto: papel novo que ninguem mapeou nao pode
  // virar admin pleno por omissao.
  it('papel desconhecido nao vira admin pleno', async () => {
    comPapel('financeiro');
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ehAdminPleno).toBe(false);
    expect(result.current.operaCrmDeVendas).toBe(false);
  });

  it('sem usuario logado nao consulta o banco', async () => {
    mockUsuario = null;
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(mockMaybeSingle).not.toHaveBeenCalled();
    expect(result.current.papel).toBeNull();
  });
});
