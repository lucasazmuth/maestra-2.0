import { fireEvent, render, screen } from '@testing-library/react';

import { NytaModalHeader } from './NytaModalHeader';

jest.mock('../../utils/isMobile', () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock('../../pages/Wizard/chat/nytaPersona', () => ({
  NytaAvatar: () => <span data-testid="nyta-avatar" />,
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(() => ({
      matches: false,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  });

  Object.defineProperty(global, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});

describe('NytaModalHeader', () => {
  it('abre a confirmação somente depois de selecionar Limpar histórico', async () => {
    render(<NytaModalHeader onClear={jest.fn()} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mais opções' }));

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Falar com o suporte' })).not.toBeInTheDocument();
    expect(screen.queryByText('Limpar histórico?')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Limpar histórico' }));

    expect(await screen.findByText('Limpar histórico?')).toBeInTheDocument();
  });
});
