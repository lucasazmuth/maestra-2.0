import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { useRota, configurarRota, reiniciarRota } from '../rota';
import { useRotaDoNavegador } from '../rotaWeb';

// O núcleo lê a rota por uma porta para poder rodar sob o Expo Router no app. O que não pode
// mudar é o comportamento da web: `useArtist` e companhia continuam recebendo o mesmo `:id` que
// recebiam do `useParams`.

const Espia = () => {
  const { caminho, parametros } = useRota();
  return <span data-testid='rota'>{`${caminho} | ${parametros.id ?? '-'}`}</span>;
};

const montarEm = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path='/artists/:id/*' element={<Espia />} />
        <Route path='*' element={<Espia />} />
      </Routes>
    </MemoryRouter>
  );

describe('porta de rota', () => {
  // `setupTests.ts` importa `rotaWeb`, então o registro da web já vale em todo teste — é o que
  // mantém os testes de tela existentes exercitando exatamente o caminho de produção.
  afterEach(() => configurarRota(useRotaDoNavegador));

  it('entrega o caminho e o :id como o react-router entregava', () => {
    montarEm('/artists/abc-123/catalogo');
    expect(screen.getByTestId('rota')).toHaveTextContent('/artists/abc-123/catalogo | abc-123');
  });

  it('fora do escopo de artista, não há id', () => {
    montarEm('/dashboard');
    expect(screen.getByTestId('rota')).toHaveTextContent('/dashboard | -');
  });

  it('sem superfície registrada, devolve rota vazia em vez de estourar', () => {
    // Um hook do núcleo não deve derrubar a árvore por configuração ausente: o caminho vazio já
    // leva os consumidores ao comportamento de "fora de qualquer artista".
    reiniciarRota();
    expect(() => render(<Espia />)).not.toThrow();
    expect(screen.getByTestId('rota')).toHaveTextContent('| -');
  });

  it('a superfície pode trocar a implementação inteira', () => {
    // É este caso que o app nativo usa: quem responde lá é o Expo Router.
    reiniciarRota();
    configurarRota(() => ({ caminho: '/de-outro-lugar', parametros: { id: 'do-expo' } }));
    render(<Espia />);
    expect(screen.getByTestId('rota')).toHaveTextContent('/de-outro-lugar | do-expo');
  });
});
