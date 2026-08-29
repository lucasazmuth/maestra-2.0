import fs from 'fs';
import path from 'path';

import { COR_CONVERSAS } from '@maestra/core/constants/design';

// Mesmo molde dos outros testes de cromo, para o cabeçalho do chat e a lista de conversas.

const ler = (arquivo: string) => fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'NytaChat', 'components', arquivo), 'utf8',
);

const fontes = ler('ChatHeader.scss') + ler('ConversationSidebar.scss');

describe('cromo das conversas da Nyta', () => {
  it.each(Object.entries(COR_CONVERSAS))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    expect(fontes).toContain(valor);
  });

  // A lista vira o nível de trás no celular: é isso que faz o "voltar" do chat levar às
  // conversas em vez de sair da Nyta. Se a web deixar de esconder a coluna, o app fica com uma
  // navegação que a web não tem mais.
  it('abaixo de 900px a coluna some e vira gaveta', () => {
    expect(fontes).toContain('900px');
  });
});
