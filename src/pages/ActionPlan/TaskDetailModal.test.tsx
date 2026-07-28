import { fireEvent, render, screen } from '@testing-library/react';

import type { ActionTask } from '../../interfaces/maestra';
import { TaskDetailModal } from './TaskDetailModal';

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

const task: ActionTask = {
  id: 'task-1',
  description: 'Preparar material de venda',
  type: 'acoes',
  status: 'todo',
  comments: [
    {
      id: 'comment-1',
      body: 'Validar primeira versão.',
      authorName: 'Lucas De Andrade',
      authorAvatarUrl: 'https://example.com/lucas.jpg',
      createdAt: '2026-07-27T23:16:00.000Z',
    },
  ],
};

describe('TaskDetailModal', () => {
  it('edita a tarefa, adiciona comentário e mantém a exclusão dentro do modal', async () => {
    const onSave = jest.fn();
    const onAddComment = jest.fn();
    const onEditComment = jest.fn();
    const onDeleteComment = jest.fn();
    const onDelete = jest.fn();

    render(
      <TaskDetailModal
        open
        task={task}
        strategyTitle="Estruturar a venda de shows"
        assignees={[]}
        canEdit
        canDelete
        onClose={jest.fn()}
        onSave={onSave}
        onAddComment={onAddComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('tab', { name: 'Geral' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Comentários/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir tarefa' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Descreva a tarefa'), {
      target: { value: 'Preparar material comercial atualizado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Preparar material comercial atualizado',
    }));

    fireEvent.click(screen.getByRole('tab', { name: /^Comentários/ }));
    expect(screen.getByRole('img', { name: 'Foto de Lucas De Andrade' })).toHaveAttribute(
      'src',
      'https://example.com/lucas.jpg'
    );
    fireEvent.change(screen.getByPlaceholderText('Escreva um comentário…'), {
      target: { value: 'Validar o material com a equipe.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    expect(onAddComment).toHaveBeenCalledWith('Validar o material com a equipe.');

    fireEvent.click(screen.getByRole('button', { name: 'Editar comentário' }));
    fireEvent.change(screen.getByDisplayValue('Validar primeira versão.'), {
      target: { value: 'Validar versão final.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onEditComment).toHaveBeenCalledWith('comment-1', 'Validar versão final.');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir comentário' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    expect(onDeleteComment).toHaveBeenCalledWith('comment-1');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir tarefa' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  }, 15000);
});
