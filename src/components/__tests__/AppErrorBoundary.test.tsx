import { render, screen } from '@testing-library/react';
import AppErrorBoundary, { ehErroDeChunk } from '../AppErrorBoundary';

describe('deteccao de ChunkLoadError', () => {
  // Regressao de producao: a tela ficou BRANCA no meio do checkout porque um deploy trocou os
  // hashes dos chunks enquanto a aba estava aberta. A mensagem varia por navegador, entao a
  // deteccao nao pode depender so de `name`.
  it('reconhece as formas que o erro assume em cada navegador', () => {
    expect(ehErroDeChunk(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
    expect(ehErroDeChunk(new Error('Loading chunk 5594 failed.'))).toBe(true);
    expect(ehErroDeChunk(new Error('Loading CSS chunk 12 failed.'))).toBe(true);
    expect(ehErroDeChunk(new Error('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
    expect(ehErroDeChunk(new Error('error loading dynamically imported module'))).toBe(true);
  });

  it('nao confunde erro comum com chunk (senao recarregaria em loop por bug de codigo)', () => {
    expect(ehErroDeChunk(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(ehErroDeChunk(null)).toBe(false);
    expect(ehErroDeChunk(undefined)).toBe(false);
  });
});

describe('AppErrorBoundary', () => {
  const Explode = () => { throw new Error('Cannot read properties of undefined'); };

  it('mostra saida em vez de tela branca quando um render quebra', () => {
    const silencio = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppErrorBoundary><Explode /></AppErrorBoundary>);
    // O ponto do componente: existir ALGO na tela, com um caminho de volta.
    expect(screen.getByText(/algo deu errado/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recarregar/i })).toBeInTheDocument();
    silencio.mockRestore();
  });

  it('renderiza os filhos normalmente quando nada quebra', () => {
    render(<AppErrorBoundary><p>conteudo</p></AppErrorBoundary>);
    expect(screen.getByText('conteudo')).toBeInTheDocument();
  });
});
