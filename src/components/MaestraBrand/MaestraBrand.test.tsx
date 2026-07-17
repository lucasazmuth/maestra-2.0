import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MaestraBrand } from '.';

jest.mock('../../assets/brand/maestra-symbol.svg', () => ({
  __esModule: true,
  ReactComponent: () => <svg data-testid='symbol' />,
}));
jest.mock('../../assets/brand/maestra-wordmark.svg', () => ({
  __esModule: true,
  ReactComponent: () => <svg data-testid='wordmark' />,
}));

const renderBrand = (element: ReactElement): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(element);
  return host.firstElementChild as HTMLElement;
};

describe('MaestraBrand', () => {
  it.each(['symbol', 'wordmark', 'lockup'] as const)('renderiza a variante %s com nome acessível', (variant) => {
    const brand = renderBrand(<MaestraBrand variant={variant} tone='light' />);
    expect(brand).toHaveAttribute('role', 'img');
    expect(brand).toHaveAttribute('aria-label', 'Maestra');
    expect(brand).toHaveAttribute('data-brand-variant', variant);
  });

  it('aceita tom, selo Beta, classe, estilo e rótulo customizado', () => {
    const brand = renderBrand(
      <MaestraBrand
        variant='lockup'
        tone='dark'
        beta
        className='custom-brand'
        style={{ fontSize: 32 }}
        aria-label='Maestra Beta'
      />
    );
    expect(brand).toHaveClass('custom-brand');
    expect(brand).toHaveStyle({ fontSize: '32px' });
    expect(brand).toHaveAttribute('data-brand-tone', 'dark');
    expect(brand).toHaveTextContent('Beta');
  });

  it('pode ser decorativa', () => {
    const brand = renderBrand(<MaestraBrand variant='symbol' tone='light' aria-hidden='true' />);
    expect(brand).not.toHaveAttribute('role');
    expect(brand).toHaveAttribute('aria-hidden', 'true');
  });
});
