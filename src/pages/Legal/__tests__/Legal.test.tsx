import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import Legal from '..';

// O VOLTAR DOS DOCUMENTOS PRECISA DE UM DESTINO.
//
// Esta página abre de TRÊS sítios, e num deles não há histórico nenhum: o cadastro e o
// consentimento ligam para cá com `target='_blank'`, e numa aba recém-aberta um `navigate(-1)`
// não vai a lado nenhum — o único controlo da página não fazia nada. Quem chega por um link de
// e-mail cai no mesmo caso, ou é atirado para fora do produto.
//
// E o destino depende de quem lê: a página é PÚBLICA, e o rodapé da landing manda para cá gente
// sem conta nenhuma.

const mockNavigate = jest.fn();
let mockKey = 'default';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ key: mockKey, pathname: '/legal/termos' }),
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

const montar = (logado: boolean) => {
  const store = configureStore({
    reducer: { auth: (state = { user: logado ? { id: 'u-1' } : null }) => state },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/legal/termos']}>
        <Routes>
          <Route path='/legal/:slug' element={<Legal />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockKey = 'default';
});

describe('o voltar dos documentos legais', () => {
  // `key` diferente de 'default' é a prova de que existe uma entrada anterior no histórico.
  it('com histórico, recua', () => {
    mockKey = 'ab12cd';
    montar(true);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // ⚠️ SEM HISTÓRICO, O RECUO NÃO VAI A LADO NENHUM — é o caso da aba aberta pelo cadastro.
  it('sem histórico e logado, vai para os perfis', () => {
    montar(true);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/artists');
    expect(mockNavigate).not.toHaveBeenCalledWith(-1);
  });

  // A página é pública: mandar quem não tem conta para uma rota autenticada seria trocar um beco
  // sem saída por outro.
  it('sem histórico e sem conta, vai para a landing', () => {
    montar(false);

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
