import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';

import { getMyPlatformReview, savePlatformReview } from '../../services/db/platformReviews';
import { PlatformReviewModal } from '.';

jest.mock('../../store/store', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { id: 'user-1' } } }),
}));

jest.mock('../../services/db/platformReviews', () => ({
  getMyPlatformReview: jest.fn(),
  savePlatformReview: jest.fn(),
}));

const getMyPlatformReviewMock = getMyPlatformReview as jest.MockedFunction<typeof getMyPlatformReview>;
const savePlatformReviewMock = savePlatformReview as jest.MockedFunction<typeof savePlatformReview>;

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

beforeEach(() => {
  jest.spyOn(message, 'success').mockImplementation(() => undefined as never);
  getMyPlatformReviewMock.mockResolvedValue(null);
  savePlatformReviewMock.mockResolvedValue({
    id: 'review-1',
    user_id: 'user-1',
    rating: 5,
    comment: 'Muito boa',
    page_path: '/artists',
    created_at: '2026-07-28T12:00:00.000Z',
    updated_at: '2026-07-28T12:00:00.000Z',
  });
});

it('exige nota e envia comentário da avaliação', async () => {
  const onClose = jest.fn();
  render(<PlatformReviewModal open onClose={onClose} />);

  expect(screen.getByRole('button', { name: 'Enviar avaliação' })).toBeDisabled();
  await waitFor(() => expect(getMyPlatformReviewMock).toHaveBeenCalledWith('user-1'));
  await screen.findByText('Selecione de 1 a 5 estrelas');

  fireEvent.click(screen.getAllByRole('radio')[4]);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Muito boa' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar avaliação' }));

  await waitFor(() => {
    expect(savePlatformReviewMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      rating: 5,
      comment: 'Muito boa',
    }));
  });
  expect(onClose).toHaveBeenCalled();
});
