import { renderHook, waitFor } from '@testing-library/react';

const mockMaybeSingle = jest.fn();
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }),
    }),
  },
}));

// O prefixo `mock` e exigido pelo jest: sem ele a fabrica do jest.mock nao pode ler a variavel.
let mockUsuario: { id: string } | null = { id: 'u1' };
jest.mock('../../store/store', () => ({
  useAppSelector: (sel: (s: any) => unknown) => sel({ auth: { user: mockUsuario } }),
}));

// eslint-disable-next-line import/first
import { useAdminRole } from '../useAdminRole';

const comPapel = (role: string | null) => {
  mockMaybeSingle.mockResolvedValue({ data: role ? { role } : null });
};

beforeEach(() => {
  mockUsuario = { id: 'u1' };
  mockMaybeSingle.mockReset();
});

describe('useAdminRole', () => {
  // Errar para o lado permissivo aqui abre exclusao de conta, cupons e push para um vendedor.
  it.each([
    ['admin', true, true],
    ['super_admin', true, true],
    ['sales', false, true],
  ])('papel %s: admin pleno=%s, opera CRM=%s', async (role, pleno, crm) => {
    comPapel(role);
    const { result } = renderHook(() => useAdminRole());

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.papel).toBe(role);
    expect(result.current.ehAdminPleno).toBe(pleno);
    expect(result.current.operaCrmDeVendas).toBe(crm);
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
